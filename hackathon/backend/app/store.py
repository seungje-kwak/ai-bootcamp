"""Data access. LocalStore (JSON file) by default, SupabaseStore when SUPABASE_URL/SUPABASE_SERVICE_KEY are set.

Both stores expose the same methods and return plain dicts:
  place        -> PRD 9.3 `Place` (with nested accessibility / food_options)
  course row   -> {id, user_profile, tier, created_at}
  item row     -> {course_id, order, place_id, start_time, stay_min, move_method, move_min,
                   reason_en, is_rest_stop, status}
"""
from __future__ import annotations

import copy
import json
import threading
import time
from datetime import datetime, timezone
from typing import Any, Optional, Protocol

from . import config


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class Store(Protocol):
    def list_places(self) -> list[dict]: ...
    def list_phrase_cards(self) -> list[dict]: ...
    def get_course(self, course_id: str) -> Optional[dict]: ...
    def get_items(self, course_id: str) -> list[dict]: ...
    def create_course(self, course: dict, items: list[dict]) -> None: ...
    def apply_replan(self, course_id: str, user_profile: dict, statuses: dict[int, str],
                     delete_orders: list[int], new_items: list[dict], report_place_id: Optional[int]) -> None: ...
    def set_tier(self, course_id: str, tier: str) -> None: ...
    def add_report(self, place_id: int, type_: str) -> dict: ...
    def replace_course(self, course: dict, items: list[dict]) -> None: ...


def _load_json(name: str) -> Any:
    return json.loads((config.LOCAL_DATA_DIR / name).read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
class LocalStore:
    """Places come from app/data/*.json (built from data/seed). Courses persist to backend/local_db.json."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._places = _load_json("places.json")
        self._cards = _load_json("phrase_cards.json")
        self._mtime = -1.0
        self._db: dict = {"courses": {}, "course_items": {}, "place_reports": []}
        self._reload()

    def _reload(self) -> None:
        """Pick up writes from other processes (e.g. scripts/reset_emma.py while the server runs)."""
        f = config.LOCAL_DB_FILE
        if f.exists() and f.stat().st_mtime != self._mtime:
            self._db = json.loads(f.read_text(encoding="utf-8"))
            self._mtime = f.stat().st_mtime

    def _save(self) -> None:
        tmp = config.LOCAL_DB_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._db, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(config.LOCAL_DB_FILE)
        self._mtime = config.LOCAL_DB_FILE.stat().st_mtime

    def list_places(self) -> list[dict]:
        return copy.deepcopy(self._places)

    def list_phrase_cards(self) -> list[dict]:
        return copy.deepcopy(self._cards)

    def get_course(self, course_id: str) -> Optional[dict]:
        self._reload()
        c = self._db["courses"].get(course_id)
        return copy.deepcopy(c) if c else None

    def get_items(self, course_id: str) -> list[dict]:
        self._reload()
        items = self._db["course_items"].get(course_id, [])
        return sorted(copy.deepcopy(items), key=lambda i: i["order"])

    def create_course(self, course: dict, items: list[dict]) -> None:
        with self._lock:
            self._reload()
            self._db["courses"][course["id"]] = copy.deepcopy(course)
            self._db["course_items"][course["id"]] = copy.deepcopy(items)
            self._save()

    def replace_course(self, course: dict, items: list[dict]) -> None:
        self.create_course(course, items)

    def apply_replan(self, course_id, user_profile, statuses, delete_orders, new_items, report_place_id) -> None:
        with self._lock:
            self._reload()
            self._db["courses"][course_id]["user_profile"] = copy.deepcopy(user_profile)
            kept = []
            for it in self._db["course_items"].get(course_id, []):
                if it["order"] in delete_orders:
                    continue
                if it["order"] in statuses:
                    it["status"] = statuses[it["order"]]
                kept.append(it)
            kept.extend(copy.deepcopy(new_items))
            self._db["course_items"][course_id] = sorted(kept, key=lambda i: i["order"])
            if report_place_id is not None:
                self._db["place_reports"].append({"place_id": report_place_id, "type": "closed", "created_at": now_iso()})
            self._save()

    def set_tier(self, course_id: str, tier: str) -> None:
        with self._lock:
            self._reload()
            self._db["courses"][course_id]["tier"] = tier
            self._save()

    def add_report(self, place_id: int, type_: str) -> dict:
        row = {"place_id": place_id, "type": type_, "created_at": now_iso()}
        with self._lock:
            self._reload()
            self._db["place_reports"].append(row)
            self._save()
        return row


# ---------------------------------------------------------------------------
class SupabaseStore:
    """Tables from sql/schema.sql. Writes happen only after the planner succeeded (10.7 step 5)."""

    PLACE_TTL_SEC = 60

    def __init__(self) -> None:
        from supabase import create_client  # imported lazily so local mode needs no network

        self._sb = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
        self._places_cache: tuple[float, list[dict]] | None = None
        self._cards_cache: tuple[float, list[dict]] | None = None

    @staticmethod
    def _one(v: Any) -> Optional[dict]:
        if isinstance(v, list):
            return v[0] if v else None
        return v

    def list_places(self) -> list[dict]:
        if self._places_cache and time.time() - self._places_cache[0] < self.PLACE_TTL_SEC:
            return copy.deepcopy(self._places_cache[1])
        rows = (self._sb.table("places")
                .select("*, place_accessibility(*), food_options(*)")
                .order("id").execute().data)
        places = []
        for r in rows:
            acc = self._one(r.pop("place_accessibility", None))
            food = self._one(r.pop("food_options", None))
            if acc is None:  # 8.10: every place must have an accessibility row
                continue
            acc.pop("place_id", None)
            if food:
                food.pop("place_id", None)
            r["closed_days"] = r.get("closed_days") or []
            r["accessibility"] = acc
            r["food_options"] = food
            places.append(r)
        self._places_cache = (time.time(), places)
        return copy.deepcopy(places)

    def list_phrase_cards(self) -> list[dict]:
        if self._cards_cache and time.time() - self._cards_cache[0] < self.PLACE_TTL_SEC:
            return copy.deepcopy(self._cards_cache[1])
        rows = self._sb.table("phrase_cards").select("*").execute().data
        self._cards_cache = (time.time(), rows)
        return copy.deepcopy(rows)

    def get_course(self, course_id: str) -> Optional[dict]:
        try:
            rows = self._sb.table("courses").select("*").eq("id", course_id).limit(1).execute().data
        except Exception:  # invalid uuid -> treat as not found
            return None
        return rows[0] if rows else None

    def get_items(self, course_id: str) -> list[dict]:
        rows = self._sb.table("course_items").select("*").eq("course_id", course_id).execute().data
        return sorted(rows, key=lambda i: i["order"])

    def create_course(self, course: dict, items: list[dict]) -> None:
        self._sb.table("courses").insert(course).execute()
        try:
            if items:
                self._sb.table("course_items").insert(items).execute()
        except Exception:
            # no half-written course (US-02)
            self._sb.table("courses").delete().eq("id", course["id"]).execute()
            raise

    def replace_course(self, course: dict, items: list[dict]) -> None:
        self._sb.table("course_items").delete().eq("course_id", course["id"]).execute()
        self._sb.table("courses").upsert(course).execute()
        if items:
            self._sb.table("course_items").insert(items).execute()

    def apply_replan(self, course_id, user_profile, statuses, delete_orders, new_items, report_place_id) -> None:
        """PostgREST reads `order=` in a URL as the sort option, so rows can't be filtered by the
        "order" column (Q-05). Instead: build the full new item list, delete the course's items by
        course_id, insert the new list, and put the old rows back if the insert fails."""
        sb = self._sb
        old = self.get_items(course_id)
        kept = []
        for it in old:
            if it["order"] in delete_orders:
                continue
            row = dict(it)
            row["status"] = statuses.get(it["order"], it["status"])
            kept.append(row)
        final = sorted(kept + [dict(n) for n in new_items], key=lambda i: i["order"])

        sb.table("course_items").delete().eq("course_id", course_id).execute()
        try:
            if final:
                sb.table("course_items").insert(final).execute()
        except Exception:
            if old:
                sb.table("course_items").insert(old).execute()  # keep the previous plan (US-09)
            raise
        sb.table("courses").update({"user_profile": user_profile}).eq("id", course_id).execute()
        if report_place_id is not None:
            sb.table("place_reports").insert({"place_id": report_place_id, "type": "closed"}).execute()

    def set_tier(self, course_id: str, tier: str) -> None:
        self._sb.table("courses").update({"tier": tier}).eq("id", course_id).execute()

    def add_report(self, place_id: int, type_: str) -> dict:
        rows = self._sb.table("place_reports").insert({"place_id": place_id, "type": type_}).execute().data
        r = rows[0]
        return {"place_id": r["place_id"], "type": r["type"], "created_at": r["created_at"]}


_store: Optional[Store] = None


def get_store() -> Store:
    global _store
    if _store is None:
        _store = SupabaseStore() if config.USE_SUPABASE else LocalStore()
    return _store
