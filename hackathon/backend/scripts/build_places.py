"""Normalize data/seed/*.csv into the PRD shapes (8장, 9.3) and write backend/app/data/*.json.

- category: seed values (history_culture, museum, beach, ...) -> PRD enum (nature, market, cafe, food, culture, photo)
- terrain: free-text description -> flat / slope / steep
- closed_days: free text -> ["mon".."sun"]
- price_level: free/low/mid/high -> 0/1/2/3
- open_time / close_time: "HH:MM" or both empty (always open). A badly formed value stops the build
- places outside the map bounds (7.2) are skipped (Q-13 default)
- place_type / avg_stay_min: the seed category, `nature` split into forest / waterfall / port by the English
  name; an empty stay time gets the type's default (tasks/prd-recommendation-p1.md FR-17, FR-17a)
- area_id: from the coordinates and the Jeju boundary file (app/areas.py area_of_point). When the point is
  in no boundary, from address_ko (area_of_address). When neither says, the build stops
  (tasks/prd-recommendation-p0.md US-R06). Places whose two answers differ are listed at the end

Run:  backend/.venv/Scripts/python.exe backend/scripts/build_places.py
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.areas import area_of_address, area_of_point  # noqa: E402
from app.config import STAY_BY_TYPE  # noqa: E402

SEED = ROOT / "data" / "seed"
OUT = ROOT / "backend" / "app" / "data"

# All of Jeju: the main island, Udo and the Chuja Islands (start-area FR-10).
# Must be the same as `bounds` in frontend/config/map.ts.
BOUNDS = {"lngMin": 126.10, "lngMax": 127.00, "latMin": 33.10, "latMax": 34.00}

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


# tasks/prd-recommendation-p1.md FR-17a: a `nature` place becomes the first type its English name matches.
NATURE_SPLIT = [
    (re.compile(r"forest|gotjawal|arboretum"), "forest"),
    (re.compile(r"falls|waterfall"), "waterfall"),
    (re.compile(r"\bport\b|harbou?r"), "port"),
]


def place_type_of(pid: int, seed_category: str, name_en: str) -> str:
    """FR-17a: the seed category, with `nature` split by name. A category FR-17 does not list stops the build."""
    t = seed_category.strip()
    if t not in STAY_BY_TYPE:
        raise ValueError(f"place {pid}: category {t!r} has no stay time in config.STAY_BY_TYPE")
    if t == "nature":
        name = name_en.lower()
        t = next((kind for rx, kind in NATURE_SPLIT if rx.search(name)), "nature")
    return t


def in_bounds(lat: float, lng: float) -> bool:
    return BOUNDS["latMin"] <= lat <= BOUNDS["latMax"] and BOUNDS["lngMin"] <= lng <= BOUNDS["lngMax"]


def main() -> int:
    acc = {int(r["place_id"]): r for r in read("place_accessibility.csv")}
    food = {int(r["place_id"]): r for r in read("food_options.csv")}

    places, skipped, moved = [], [], []
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

        by_address = area_of_address(r["address_ko"])
        area_id = area_of_point(lat, lng) or by_address
        if area_id is None:
            raise ValueError(f"place {pid} ({r['name_en']}): cannot tell the area from its coordinates "
                             f"or from address_ko {r['address_ko']!r}")
        if by_address != area_id:
            moved.append((pid, r["name_ko"].strip(), r["address_ko"].strip(), by_address, area_id))
        open_time, close_time = parse_open_close(pid, r.get("open_time", ""), r.get("close_time", ""))
        category = CATEGORY_OVERRIDE.get(pid) or CATEGORY_MAP.get(r["category"].strip(), "culture")
        place_type = place_type_of(pid, r["category"], r["name_en"])
        f = food.get(pid)
        food_options = None
        if f is not None:
            # true / false / null: an empty cell is "not known", not "no" (prd-recommendation-p0 US-R03)
            food_options = {
                "solo_ok": to_bool(f["solo_ok"]),
                "vegan": to_bool(f["vegan"]),
                "vegetarian": to_bool(f["vegetarian"]),
                "halal": to_bool(f["halal"]),
                "english_menu": to_bool(f["english_menu"]),
                "signature_menu_en": (f["signature_menu_en"].split(" (")[0].split(" - ")[0].strip() or None),
                "allergens": f["allergens"].strip() or None,
            }

        places.append({
            "id": pid,
            "source_poi_id": r["poi_id"].strip() or None,
            "name_en": r["name_en"].strip(),
            "name_ko": r["name_ko"].strip(),
            "category": category,
            "place_type": place_type,
            "description_en": r["description_en"].strip(),
            "lat": lat,
            "lng": lng,
            "address_ko": r["address_ko"].strip(),
            "area_id": area_id,
            "image_url": r["image_url"].strip() or None,
            "image_source": image_source_of(r["image_source"]) if r["image_url"].strip() else None,
            # FR-17: the seed value when there is one (28 places), otherwise the default of the type
            "avg_stay_min": to_int(r["avg_stay_min"]) or STAY_BY_TYPE[place_type][0],
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
    print("place types (FR-17): places, mean avg_stay_min (all / without a seed stay time)")
    seeded = {int(r["id"]) for r in read("places.csv") if r["avg_stay_min"].strip()}
    for t in STAY_BY_TYPE:
        mine = [p for p in places if p["place_type"] == t]
        plain = [p["avg_stay_min"] for p in mine if p["id"] not in seeded]
        if mine:
            print(f"  {t:16} {len(mine):>4}  {sum(p['avg_stay_min'] for p in mine) / len(mine):6.1f}"
                  f"  {sum(plain) / len(plain) if plain else 0:6.1f}")
    print(f"area from coordinates differs from the address rule: {len(moved)} places")
    for pid, name, address, by_address, area_id in moved:
        print(f"  {pid:>4} {name} | {address} | {by_address} -> {area_id}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except ValueError as e:
        print(f"ERROR: {e}")
        sys.exit(1)
