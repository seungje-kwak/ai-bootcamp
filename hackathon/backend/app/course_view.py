"""Build the `Course` response (9.3) and apply the free 3-stop rule (9.6) in one place."""
from __future__ import annotations

from . import config

ITEM_KEYS = ("order", "place_id", "start_time", "stay_min", "move_method", "move_min",
             "reason_en", "is_rest_stop", "status")
GENERIC_FOOD_CARD_SITUATION = "restaurant"
GENERIC_FOOD_CARD_LIMIT = 3


def _public_profile(profile: dict) -> dict:
    out = {k: v for k, v in profile.items() if not k.startswith("_")}
    out.setdefault("conditions", {"indoor_only": False, "low_walking": False})
    return out


def _cards_for(place: dict, cards: list[dict]) -> list[dict]:
    own = [c for c in cards if c.get("place_id") == place["id"]]
    if place["category"] in ("food", "cafe"):
        generic = [c for c in cards if c.get("place_id") is None and c["situation"] == GENERIC_FOOD_CARD_SITUATION]
        own = generic[:GENERIC_FOOD_CARD_LIMIT] + own
    return [{"situation": c["situation"], "text_en": c["text_en"], "text_ko": c["text_ko"]} for c in own]


def _visible_gaps(gaps: list[dict], visible: list[dict], locked: int) -> list[dict]:
    """P1 US-P06: with stops locked, only the free meal times that start before the last visible stop
    ends leave the server (9.6)."""
    if locked == 0:
        return gaps
    if not visible:
        return []
    last = visible[-1]
    h, m = last["start_time"].split(":")
    end = int(h) * 60 + int(m) + int(last["stay_min"])
    return [g for g in gaps if int(g["start_time"][:2]) * 60 + int(g["start_time"][3:]) < end]


def build_course(course: dict, items: list[dict], places: list[dict], cards: list[dict]) -> dict:
    by_id = {p["id"]: p for p in places}
    items = sorted((i for i in items if i["place_id"] in by_id), key=lambda i: i["order"])
    premium = course["tier"] == "premium"
    total = len(items)
    visible = items if premium else items[: config.FREE_ITEM_LIMIT]   # hidden items never leave the server
    out_items = []
    for it in visible:
        place = by_id[it["place_id"]]
        row = {k: it.get(k) for k in ITEM_KEYS}
        row["is_rest_stop"] = bool(row["is_rest_stop"])
        row["place"] = place
        row["phrase_cards"] = _cards_for(place, cards) if premium else []
        out_items.append(row)
    locked = 0 if premium else max(0, total - config.FREE_ITEM_LIMIT)
    # a course saved before meal_gaps existed has none (US-P06)
    gaps = sorted(course.get("meal_gaps") or [], key=lambda g: g["start_time"])
    return {
        "id": course["id"],
        "tier": course["tier"],
        "created_at": course["created_at"],
        "user_profile": _public_profile(course["user_profile"]),
        "total_items": total,
        "locked_count": locked,
        "items": out_items,
        "meal_gaps": _visible_gaps(gaps, visible, locked),
    }
