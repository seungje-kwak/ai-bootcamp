"""The 14 areas a traveler can pick (tasks/prd-start-area.md): which area a place is in, and
whether an area has enough places to be picked (FR-4)."""
from __future__ import annotations

import json
from typing import Optional

from . import config
from .errors import ApiError

# Each eup / myeon is one area. Every dong of a city is in that city's downtown area.
EUP_MYEON = {
    "한림읍": "hallim", "애월읍": "aewol", "구좌읍": "gujwa", "조천읍": "jocheon",
    "한경면": "hangyeong", "추자면": "chuja", "우도면": "udo",
    "대정읍": "daejeong", "남원읍": "namwon", "성산읍": "seongsan",
    "안덕면": "andeok", "표선면": "pyoseon",
}
PUBLIC_KEYS = ("id", "group", "name_en", "name_ko", "description_en", "center_lat", "center_lng")


def area_of_address(address_ko: str) -> Optional[str]:
    """Area id from a Korean address, or None when the address does not say.
    The eup / myeon name is looked for first, because "제주시" is in those addresses too."""
    address = address_ko or ""
    for name, area_id in EUP_MYEON.items():
        if name in address:
            return area_id
    if "제주시" in address:
        return "jeju-city"
    if "서귀포시" in address:
        return "seogwipo-city"
    return None


def load_seed_areas() -> list[dict]:
    return json.loads((config.SEED_DATA_DIR / "areas.json").read_text(encoding="utf-8"))


def _counts(places: list[dict]) -> bool:
    """FR-4 for the places of one area."""
    if config.REQUIRE_VERIFIED:      # same rule as the planner's F-1
        places = [p for p in places if p.get("image_url") and p.get("last_verified_at")]
    food = [p for p in places if p["category"] == "food"]
    solo = [p for p in food if (p.get("food_options") or {}).get("solo_ok")]
    cafes = [p for p in places if p["category"] == "cafe"]
    easy = [p for p in places if p["accessibility"]["walking_level"] == 1 and p["accessibility"]["terrain"] == "flat"]
    indoor = [p for p in places if p["accessibility"]["indoor"]]
    return (len(places) >= config.AREA_MIN_PLACES and len(food) >= config.AREA_MIN_FOOD
            and len(solo) >= config.AREA_MIN_SOLO_FOOD and len(cafes) >= config.AREA_MIN_CAFE
            and len(easy) >= config.AREA_MIN_EASY and len(indoor) >= config.AREA_MIN_INDOOR)


def summaries(areas: list[dict], places: list[dict]) -> list[dict]:
    """`GET /areas` rows: every area in sort_order, with its place count and whether it can be picked."""
    by_area: dict[str, list[dict]] = {}
    for p in places:
        by_area.setdefault(p.get("area_id"), []).append(p)
    out = []
    for a in sorted(areas, key=lambda a: a["sort_order"]):
        mine = by_area.get(a["id"], [])
        out.append({**{k: a[k] for k in PUBLIC_KEYS}, "place_count": len(mine), "selectable": _counts(mine)})
    return out


def check_area(area_id: str, areas: list[dict], places: list[dict]) -> None:
    """422 INVALID_AREA unless `area_id` is one of the areas and can be picked (FR-3)."""
    row = next((a for a in summaries(areas, places) if a["id"] == area_id), None)
    if row is None:
        raise ApiError(422, "INVALID_AREA", "That area does not exist.")
    if not row["selectable"]:
        raise ApiError(422, "INVALID_AREA", "That area is not ready yet.")
