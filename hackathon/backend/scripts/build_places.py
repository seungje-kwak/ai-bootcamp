"""Normalize data/seed/*.csv into the PRD shapes (8장, 9.3) and write backend/app/data/*.json.

- category: seed values (history_culture, museum, beach, ...) -> PRD enum (nature, market, cafe, food, culture, photo)
- terrain: free-text description -> flat / slope / steep
- closed_days: free text -> ["mon".."sun"]
- price_level: free/low/mid/high -> 0/1/2/3
- open_time / close_time: "HH:MM" or both empty (always open). A badly formed value stops the build
- places outside the map bounds (7.2) are skipped (Q-13 default)

Run:  backend/.venv/Scripts/python.exe backend/scripts/build_places.py
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED = ROOT / "data" / "seed"
OUT = ROOT / "backend" / "app" / "data"

# Jeju main island. This is the range app/data/places.json was built with on 2026-11-13
# (data/seed_jeju_all/README.md). frontend/config/map.ts still shows Jeju City only.
BOUNDS = {"lngMin": 126.13, "lngMax": 126.99, "latMin": 33.10, "latMax": 33.58}

CATEGORY_MAP = {
    "nature": "nature",
    "park": "nature",
    "oreum_hike": "nature",
    "beach": "photo",
    "history_culture": "culture",
    "museum": "culture",
    "market_shopping": "market",
    "restaurant": "food",
    "cafe": "cafe",
}
# Iconic photo spots get the photo category regardless of the seed value.
CATEGORY_OVERRIDE = {1: "photo", 8: "photo"}

PRICE_MAP = {"free": 0, "low": 1, "mid": 2, "high": 3}
DAYS = {
    "mon": "mon", "monday": "mon", "tue": "tue", "tuesday": "tue",
    "wed": "wed", "wednesday": "wed", "thu": "thu", "thursday": "thu",
    "fri": "fri", "friday": "fri", "sat": "sat", "saturday": "sat",
    "sun": "sun", "sunday": "sun",
}


def read(name: str) -> list[dict]:
    with open(SEED / name, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def to_bool(v: str) -> bool | None:
    v = (v or "").strip().lower()
    if v == "true":
        return True
    if v == "false":
        return False
    return None


def to_int(v: str) -> int | None:
    v = (v or "").strip()
    return int(float(v)) if v else None


def parse_closed_days(text: str) -> list[str]:
    """Weekly closures only. Anything like 'none', 'Outdoor: none' -> []."""
    t = (text or "").strip()
    if not t or t.lower().startswith(("none", "outdoor: none", "park: none", "listed as open", "opens only")):
        return []
    first = re.split(r"[;(]", t, maxsplit=1)[0]
    found = []
    for word in re.findall(r"[A-Za-z]+", first):
        d = DAYS.get(word.lower())
        if d and d not in found:
            found.append(d)
    return found


def terrain_of(text: str) -> str:
    t = (text or "").lower()
    if "steep" in t:
        return "steep"
    if any(k in t for k in ("uphill", "slope", "hillside", "climb")):
        return "slope"
    return "flat"


def image_source_of(raw: str) -> str | None:
    """Photo credit in English (Q-16)."""
    s = (raw or "").split(" (")[0].strip()
    if not s:
        return None
    if "한국관광공사" in s:
        return "Korea Tourism Organization (TourAPI)"
    if "visitjeju" in s.lower().replace(" ", ""):
        return "VisitJeju"
    return s


HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def parse_open_close(pid: int, open_raw: str, close_raw: str) -> tuple[str | None, str | None]:
    """Both empty -> (None, None) = always open. close_time may be "24:00" (open past midnight)."""
    o, c = (open_raw or "").strip(), (close_raw or "").strip()
    if not o and not c:
        return None, None
    if not o or not c:
        raise ValueError(f"place {pid}: open_time and close_time must both be set or both be empty ({o!r}, {c!r})")
    if not HHMM.match(o):
        raise ValueError(f"place {pid}: open_time {o!r} is not HH:MM")
    if c != "24:00" and not HHMM.match(c):
        raise ValueError(f"place {pid}: close_time {c!r} is not HH:MM")
    if o >= c:
        raise ValueError(f"place {pid}: open_time {o} must be earlier than close_time {c}")
    return o, c


def in_bounds(lat: float, lng: float) -> bool:
    return BOUNDS["latMin"] <= lat <= BOUNDS["latMax"] and BOUNDS["lngMin"] <= lng <= BOUNDS["lngMax"]


def main() -> int:
    acc = {int(r["place_id"]): r for r in read("place_accessibility.csv")}
    food = {int(r["place_id"]): r for r in read("food_options.csv")}

    places, skipped = [], []
    for r in read("places.csv"):
        pid = int(r["id"])
        if not r["lat"].strip() or not r["lng"].strip():
            skipped.append((pid, r["name_en"], "no coordinates"))
            continue
        lat, lng = float(r["lat"]), float(r["lng"])
        if not in_bounds(lat, lng):
            skipped.append((pid, r["name_en"], "outside map bounds"))
            continue
        a = acc.get(pid)
        if a is None:
            skipped.append((pid, r["name_en"], "no accessibility row"))
            continue

        open_time, close_time = parse_open_close(pid, r.get("open_time", ""), r.get("close_time", ""))
        category = CATEGORY_OVERRIDE.get(pid) or CATEGORY_MAP.get(r["category"].strip(), "culture")
        f = food.get(pid)
        food_options = None
        if f is not None:
            food_options = {
                "solo_ok": bool(to_bool(f["solo_ok"])),
                "vegan": bool(to_bool(f["vegan"])),
                "vegetarian": bool(to_bool(f["vegetarian"])),
                "halal": bool(to_bool(f["halal"])),
                "english_menu": bool(to_bool(f["english_menu"])),
                "signature_menu_en": (f["signature_menu_en"].split(" (")[0].split(" - ")[0].strip() or None),
                "allergens": f["allergens"].strip() or None,
            }

        places.append({
            "id": pid,
            "source_poi_id": r["poi_id"].strip() or None,
            "name_en": r["name_en"].strip(),
            "name_ko": r["name_ko"].strip(),
            "category": category,
            "description_en": r["description_en"].strip(),
            "lat": lat,
            "lng": lng,
            "address_ko": r["address_ko"].strip(),
            "image_url": r["image_url"].strip() or None,
            "image_source": image_source_of(r["image_source"]) if r["image_url"].strip() else None,
            "avg_stay_min": to_int(r["avg_stay_min"]) or 45,
            "opening_hours": r["opening_hours"].strip() or None,
            "open_time": open_time,
            "close_time": close_time,
            "closed_days": parse_closed_days(r["closed_days"]),
            "price_level": PRICE_MAP.get(r["price_level"].strip().lower()),
            "last_verified_at": r["last_verified_at"].strip() or None,
            "source_date": "2015-12-31" if r["poi_id"].strip() else None,
            "accessibility": {
                "walking_level": max(1, min(3, to_int(a["walking_level"]) or 1)),
                "terrain": terrain_of(a["terrain"]),
                "has_stairs": to_bool(a["has_stairs"]),
                "wheelchair_ok": to_bool(a["wheelchair_ok"]),
                "indoor": bool(to_bool(a["indoor"])),
                "has_seating": to_bool(a["has_seating"]),
                "restroom": to_bool(a["restroom"]),
                "nearest_public_restroom_m": to_int(a.get("nearest_public_restroom_m", "")),
                "fatigue_score": max(1, min(5, to_int(a["fatigue_score"]) or 1)),
            },
            "food_options": food_options,
        })

    kept_ids = {p["id"] for p in places}
    cards = []
    for c in read("phrase_cards.csv"):
        pid = to_int(c["place_id"])
        if pid is not None and pid not in kept_ids:
            continue
        cards.append({
            "id": int(c["id"]),
            "place_id": pid,
            "situation": c["situation"].strip(),
            "text_en": c["text_en"].strip(),
            "text_ko": c["text_ko"].strip(),
        })

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "places.json").write_text(json.dumps(places, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "phrase_cards.json").write_text(json.dumps(cards, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"places: {len(places)} kept, {len(skipped)} skipped; phrase cards: {len(cards)}")
    for pid, name, why in skipped:
        print(f"  skipped {pid:>2} {name} ({why})")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except ValueError as e:
        print(f"ERROR: {e}")
        sys.exit(1)
