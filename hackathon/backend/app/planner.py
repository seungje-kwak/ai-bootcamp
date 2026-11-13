"""Course pipeline (10장): filter -> LLM (or rules) -> validate -> timing -> rows.

LLM picks places/order/stay/reason. Python owns ids, distance, times, move method (10.1).
"""
from __future__ import annotations

import logging
import math
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

from . import config
from .errors import ApiError
from .llm import LLMError, call_llm
from .schemas import LLMCourse, LLMItem

log = logging.getLogger("mypace.planner")
KST = timezone(timedelta(hours=9))  # Korea has no DST (R-15)
WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
INTEREST_LABEL = {
    "nature": "nature", "market": "markets", "cafe": "cafés",
    "food": "local food", "culture": "culture and history", "photo": "photo spots",
}
SINGULAR_LABEL = {
    "nature": "Some time in nature", "market": "A market stop", "cafe": "A café break",
    "food": "A local food stop", "culture": "A culture and history stop", "photo": "A photo stop",
}


# --------------------------------------------------------------------------- time helpers
def to_min(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def to_hhmm(minutes: int) -> str:
    minutes %= 24 * 60
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def round_up5(m: int) -> int:
    return ((m + 4) // 5) * 5


def today_kst_dow() -> str:
    return WEEKDAYS[datetime.now(KST).weekday()]


# --------------------------------------------------------------------------- trip window (trip-time FR-3, FR-6)
_HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def check_time_window(start_time: str, end_time: str) -> tuple[int, int]:
    """Minutes of a valid start/end pair. Anything else is 422 INVALID_TIME_WINDOW."""
    def bad(message: str) -> ApiError:
        return ApiError(422, "INVALID_TIME_WINDOW", message)

    if not _HHMM.match(start_time or "") or not _HHMM.match(end_time or ""):
        raise bad("start_time and end_time must look like HH:MM.")
    start, end = to_min(start_time), to_min(end_time)
    if start % config.TIME_STEP_MIN or end % config.TIME_STEP_MIN:
        raise bad("Times must be on the hour or half hour.")
    if not to_min(config.MIN_START) <= start <= to_min(config.MAX_START):
        raise bad(f"start_time must be between {config.MIN_START} and {config.MAX_START}.")
    if end > to_min(config.MAX_END):
        raise bad(f"end_time must be {config.MAX_END} or earlier.")
    if not config.MIN_TRIP_MIN <= end - start <= config.MAX_TRIP_MIN:
        raise bad(f"The day must be {config.MIN_TRIP_MIN // 60} to {config.MAX_TRIP_MIN // 60} hours long.")
    return start, end


def item_bounds(trip_min: int) -> tuple[int, int]:
    """FR-6 with h = trip_min / 60: min = max(2, round(h * 0.65)), max = max(min, round(h * 0.9)),
    round(x) = floor(x + 0.5). Whole-number arithmetic so 0.65 and 0.9 do not pick up float error."""
    lo = max(2, (trip_min * 13 + 600) // 1200)
    hi = max(lo, (trip_min * 3 + 100) // 200)
    return lo, hi


# --------------------------------------------------------------------------- opening hours (trip-time FR-8)
def open_window(p: dict) -> Optional[tuple[int, int]]:
    """(open, close) in minutes, or None when the place is always open (both fields null)."""
    o, c = p.get("open_time"), p.get("close_time")
    if not o or not c:
        return None
    return to_min(o), to_min(c)      # "24:00" -> 1440


def fits_hours(p: dict, start_min: int, stay_min: int) -> bool:
    w = open_window(p)
    return w is None or (start_min >= w[0] and start_min + stay_min <= w[1])


def hours_filter(places: list[dict], start_min: int, end_min: int) -> list[dict]:
    """F-10: drop a place when its opening hours and the trip overlap for less than avg_stay_min."""
    out = []
    for p in places:
        w = open_window(p)
        if w is None or min(w[1], end_min) - max(w[0], start_min) >= p["avg_stay_min"]:
            out.append(p)
    return out


# --------------------------------------------------------------------------- distance (10.6)
def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def route_m(a: dict, b: dict) -> float:
    return haversine_m(a["lat"], a["lng"], b["lat"], b["lng"]) * config.DETOUR_FACTOR


def move_between(a: dict, b: dict, max_walk_min: int) -> tuple[str, int]:
    d = route_m(a, b)
    walk = math.ceil(d / config.WALK_M_PER_MIN)
    if walk <= max_walk_min:
        return "walk", walk
    return "taxi", math.ceil(d / config.TAXI_M_PER_MIN) + config.TAXI_EXTRA_MIN


# --------------------------------------------------------------------------- filtering (10.2)
@dataclass
class TripCtx:
    profile: dict                     # user_profile incl. conditions
    start_min: int
    end_min: int
    min_items: int
    max_items: int
    needs_lunch: bool
    origin: Optional[dict] = None     # place dict
    exclude_ids: set[int] = field(default_factory=set)
    fixed_first_category: Optional[str] = None   # "food" for hungry, closed place's category for closed
    fixed_first_any: bool = False                # closed: fall back to any category
    reason: Optional[str] = None
    keep_ids: list[int] = field(default_factory=list)


def _passes_diet(p: dict, diet: str) -> bool:
    f = p.get("food_options")
    if not f:
        return True
    if not f.get("solo_ok"):
        return False
    if diet == "vegan":
        return bool(f.get("vegan"))
    if diet == "vegetarian":
        return bool(f.get("vegetarian") or f.get("vegan"))
    if diet == "halal":
        return bool(f.get("halal"))
    return True


def base_filter(places: list[dict], profile: dict, exclude_ids: set[int], level_bonus: int = 0) -> list[dict]:
    """F-1..F-6 and F-8. F-10 (opening hours), F-7 (lunch) and F-9 (count) are applied afterwards."""
    cond = profile.get("conditions") or {}
    allowed = int(profile["fitness_level"])
    if profile["condition_today"] == "tired" or cond.get("low_walking"):
        allowed = 1
    allowed += level_bonus
    dow = today_kst_dow()
    out = []
    for p in places:
        acc = p["accessibility"]
        if config.REQUIRE_VERIFIED and (not p.get("image_url") or not p.get("last_verified_at")):
            continue                                                        # F-1
        if dow in (p.get("closed_days") or []):
            continue                                                        # F-2
        if not _passes_diet(p, profile["diet"]):
            continue                                                        # F-3
        if acc["walking_level"] > allowed:
            continue                                                        # F-4
        if profile["avoid_slopes"] and acc["terrain"] != "flat":
            continue                                                        # F-5
        if cond.get("indoor_only") and not acc["indoor"]:
            continue                                                        # F-6
        if p["id"] in exclude_ids:
            continue                                                        # F-8
        out.append(p)
    return out


def limit_candidates(cands: list[dict], interests: list[str], needs_lunch: bool) -> list[dict]:
    """F-9: keep interests first, cap at MAX_CANDIDATES, keep >=3 food when lunch is needed."""
    if len(cands) <= config.MAX_CANDIDATES:
        return cands
    ranked = sorted(cands, key=lambda p: (p["category"] not in interests, p["accessibility"]["fatigue_score"]))
    kept = ranked[: config.MAX_CANDIDATES]
    if needs_lunch:
        food_in = [p for p in kept if p["category"] == "food"]
        if len(food_in) < 3:
            extra = [p for p in ranked[config.MAX_CANDIDATES:] if p["category"] == "food"][: 3 - len(food_in)]
            non_food = [p for p in kept if p["category"] != "food"]
            kept = non_food[: config.MAX_CANDIDATES - len(food_in) - len(extra)] + food_in + extra
    return kept


def window_has_lunch(start_min: int, end_min: int) -> bool:
    """Q-08 default: the remaining window covers lunch time."""
    return start_min <= to_min("12:30") and end_min >= to_min(config.LUNCH_WINDOW[1])


# --------------------------------------------------------------------------- rule planner (10.8 P1)
def _rule_reason(p: dict, profile: dict, ctx: TripCtx, rest: bool) -> str:
    acc, f = p["accessibility"], p.get("food_options")
    parts: list[str] = []
    if f:
        bits = []
        if f.get("solo_ok"):
            bits.append("you can order for one")
        diet = profile["diet"]
        if diet in ("vegan", "vegetarian", "halal") and f.get(diet):
            bits.append(f"there are {diet} options")
        if f.get("english_menu"):
            bits.append("there is an English menu")
        lead = "A place to eat" if p["category"] == "food" else "A café stop"
        parts.append(lead + (" where " + ", ".join(bits) if bits else "") + ".")
    elif p["category"] in profile["interests"]:
        parts.append(f"You said you enjoy {INTEREST_LABEL[p['category']]}, and this is one of them.")
    else:
        parts.append(f"{SINGULAR_LABEL[p['category']]} to round out your day.")
    if (profile.get("conditions") or {}).get("indoor_only") and acc["indoor"]:
        parts.append("It's indoors, so the rain won't matter.")
    elif acc["terrain"] == "flat" and acc["walking_level"] == 1:
        parts.append("Flat ground with little walking.")
    if rest:
        parts.append("Take a seat and rest here.")
    text = " ".join(parts)
    return text[:200]


def rule_plan(cands: list[dict], ctx: TripCtx, fixed_first: Optional[dict]) -> LLMCourse:
    profile = ctx.profile
    interests = set(profile["interests"])
    low = profile["condition_today"] == "tired" or (profile.get("conditions") or {}).get("low_walking") \
        or int(profile["fitness_level"]) == 1
    max_walk = int(profile["max_walk_min"])
    lunch_lo, lunch_hi = to_min("11:30"), to_min("13:30")

    def score(p: dict) -> float:
        s = 3.0 if p["category"] in interests else 0.0
        if p["id"] in ctx.keep_ids:
            s += 2.0
        s -= p["accessibility"]["fatigue_score"] * (0.8 if low else 0.2)
        if low and p["category"] == "cafe":
            s += 1.0
        return s

    chosen: list[dict] = []
    remaining = {p["id"]: p for p in cands}
    prev, t = ctx.origin, ctx.start_min
    lunch_done = not ctx.needs_lunch

    def arrival(p: dict) -> int:
        if prev is None:
            return t
        return round_up5(t + move_between(prev, p, max_walk)[1])

    def take(p: dict) -> None:
        nonlocal prev, t, lunch_done
        a = arrival(p)
        chosen.append(p)
        remaining.pop(p["id"], None)
        if p["category"] == "food":
            lunch_done = True
        prev, t = p, a + p["avg_stay_min"]

    if fixed_first is not None:
        take(fixed_first)

    while len(chosen) < ctx.max_items and remaining:
        # lunch is impossible (no food left, or the window already passed) -> stop reserving a slot
        if not lunch_done and (t > lunch_hi or not any(p["category"] == "food" for p in remaining.values())):
            lunch_done = True
        options = []
        for p in remaining.values():
            a = arrival(p)
            if a + p["avg_stay_min"] > ctx.end_min:
                continue
            if not fits_hours(p, a, p["avg_stay_min"]):                      # FR-8
                continue
            is_food = p["category"] == "food"
            if is_food and lunch_done:
                continue
            if not lunch_done:
                if is_food and not (lunch_lo <= a <= lunch_hi):
                    continue
                # a non-food stop must not push lunch past 13:30
                if not is_food and a + p["avg_stay_min"] > lunch_hi - 10 and a < lunch_hi:
                    continue
            dist_km = route_m(prev, p) / 1000 if prev else 0.0
            v = score(p) - dist_km * 1.2 + (10.0 if (is_food and not lunch_done) else 0.0)
            options.append((v, p))
        if not options:
            break
        options.sort(key=lambda x: -x[0])
        take(options[0][1])

    if not chosen:
        raise ApiError(409, "NO_CANDIDATES", "No places fit these choices.")
    items = []
    for i, p in enumerate(chosen, start=1):
        rest = bool(low and p["category"] == "cafe")
        items.append(LLMItem(place_id=p["id"], order=i, stay_min=p["avg_stay_min"],
                             reason_en=_rule_reason(p, profile, ctx, rest), is_rest_stop=rest))
    return LLMCourse(items=items)


# --------------------------------------------------------------------------- LLM input (10.3)
def build_llm_input(cands: list[dict], ctx: TripCtx, fixed_first_id: Optional[int]) -> dict:
    p = ctx.profile
    cond = p.get("conditions") or {}
    return {
        "traveler": {k: p[k] for k in ("interests", "fitness_level", "max_walk_min", "avoid_slopes",
                                       "condition_today", "diet")},
        "trip": {
            "start_time": to_hhmm(ctx.start_min),
            "end_time": to_hhmm(ctx.end_min),
            "time_budget_min": ctx.end_min - ctx.start_min,
            "min_items": ctx.min_items,
            "max_items": ctx.max_items,
            "needs_lunch": ctx.needs_lunch,
            "indoor_only": bool(cond.get("indoor_only")),
            "low_walking": bool(cond.get("low_walking")),
            "origin": ({"name_en": ctx.origin["name_en"], "lat": ctx.origin["lat"], "lng": ctx.origin["lng"]}
                       if ctx.origin else None),
        },
        "replan": (None if ctx.reason is None else {
            "reason": ctx.reason, "fixed_first_place_id": fixed_first_id, "keep_if_possible": ctx.keep_ids,
        }),
        "candidates": [{
            "id": c["id"], "name_en": c["name_en"], "category": c["category"],
            "description_en": c["description_en"], "lat": c["lat"], "lng": c["lng"],
            "avg_stay_min": c["avg_stay_min"],
            "open_time": c.get("open_time"), "close_time": c.get("close_time"),
            "walking_level": c["accessibility"]["walking_level"], "terrain": c["accessibility"]["terrain"],
            "indoor": c["accessibility"]["indoor"], "fatigue_score": c["accessibility"]["fatigue_score"],
            "food": ({k: c["food_options"][k] for k in ("solo_ok", "vegan", "vegetarian", "halal",
                                                         "english_menu", "signature_menu_en")}
                     if c.get("food_options") else None),
        } for c in cands],
    }


# --------------------------------------------------------------------------- validation (10.5)
def validate(out: LLMCourse, cands_by_id: dict[int, dict], fixed_first: Optional[dict]) -> list[LLMItem]:
    items = [i for i in out.items if i.place_id in cands_by_id]                      # V-2
    seen, uniq = set(), []
    for i in sorted(items, key=lambda x: x.order):                                    # V-3 / V-6 sort
        if i.place_id not in seen:
            seen.add(i.place_id)
            uniq.append(i)
    if fixed_first is not None:                                                       # V-4
        first = next((i for i in uniq if i.place_id == fixed_first["id"]), None)
        if first is None:
            first = LLMItem(place_id=fixed_first["id"], order=1, stay_min=fixed_first["avg_stay_min"],
                            reason_en="A nearby alternative so you can keep going from where you are.")
        uniq = [first] + [i for i in uniq if i.place_id != fixed_first["id"]]
    for i in uniq:                                                                    # V-5
        if i.stay_min < 10 or i.stay_min > 240:
            i.stay_min = cands_by_id[i.place_id]["avg_stay_min"]
    if not uniq:                                                                      # V-7
        raise LLMError("no valid items after validation")
    return uniq


# --------------------------------------------------------------------------- timing (10.6)
def _timed_rows(entries: list[LLMItem], places_by_id: dict[int, dict], ctx: TripCtx) -> list[dict]:
    max_walk = int(ctx.profile["max_walk_min"])
    rows, prev, t = [], ctx.origin, ctx.start_min
    for e in entries:
        p = places_by_id[e.place_id]
        if prev is None:
            method, mins, start = None, None, t
        else:
            method, mins = move_between(prev, p, max_walk)
            start = round_up5(t + mins)
        rows.append({"place_id": p["id"], "start_time": to_hhmm(start), "stay_min": e.stay_min,
                     "move_method": method, "move_min": mins, "reason_en": e.reason_en[:300],
                     "is_rest_stop": bool(e.is_rest_stop), "_start": start, "_end": start + e.stay_min})
        prev, t = p, start + e.stay_min
    return rows


def schedule(entries: list[LLMItem], places_by_id: dict[int, dict], ctx: TripCtx) -> list[dict]:
    entries = list(entries)
    while True:
        rows = _timed_rows(entries, places_by_id, ctx)
        while len(rows) > 1 and rows[-1]["_end"] > ctx.end_min:                     # rule 7
            rows.pop()
        # FR-8: drop the first stop that is outside its opening hours, then time the rest again
        bad = next((n for n, r in enumerate(rows)
                    if not fits_hours(places_by_id[r["place_id"]], r["_start"], r["stay_min"])), None)
        if bad is None:
            break
        del entries[bad]
        if not entries:
            raise ApiError(409, "NO_CANDIDATES", "No places are open at these times.")
    for r in rows:
        r.pop("_start")
        r.pop("_end")
    return rows


# --------------------------------------------------------------------------- pipeline
def _nearest(origin: dict, pool: list[dict]) -> Optional[dict]:
    return min(pool, key=lambda p: route_m(origin, p)) if pool else None


def run_pipeline(places: list[dict], ctx: TripCtx, min_candidates: int) -> list[dict]:
    """10.2 -> 10.6. Returns schedule rows (without order/status/course_id)."""
    places_by_id = {p["id"]: p for p in places}
    def filtered(level_bonus: int) -> list[dict]:
        ok = base_filter(places, ctx.profile, ctx.exclude_ids, level_bonus=level_bonus)
        return hours_filter(ok, ctx.start_min, ctx.end_min)                           # F-10

    base = filtered(0)
    if len(base) < min_candidates:
        base = filtered(1)

    fixed_first = None
    if ctx.fixed_first_category:
        origin = ctx.origin
        max_walk = int(ctx.profile["max_walk_min"])
        # the fixed first stop must be open for its whole stay when the traveler gets there (FR-8)
        open_on_arrival = [p for p in base if fits_hours(
            p, round_up5(ctx.start_min + move_between(origin, p, max_walk)[1]), p["avg_stay_min"])]
        same = [p for p in open_on_arrival if p["category"] == ctx.fixed_first_category]
        fixed_first = _nearest(origin, same) or (_nearest(origin, open_on_arrival) if ctx.fixed_first_any else None)
        if fixed_first is None:
            raise ApiError(409, "NO_CANDIDATES", "No places fit right now.")

    cands = base
    if not ctx.needs_lunch:                                                           # F-7
        cands = [p for p in cands if p["category"] != "food" or (fixed_first and p["id"] == fixed_first["id"])]
    cands = limit_candidates(cands, ctx.profile["interests"], ctx.needs_lunch)        # F-9
    if fixed_first and all(p["id"] != fixed_first["id"] for p in cands):
        cands = [fixed_first] + cands
    if len(cands) < min_candidates:
        raise ApiError(409, "NO_CANDIDATES", "No places fit these choices.")

    ctx.min_items = max(1, min(ctx.min_items, len(cands)))
    ctx.max_items = max(ctx.min_items, min(ctx.max_items, len(cands)))
    ctx.keep_ids = [i for i in ctx.keep_ids if any(c["id"] == i for c in cands)]
    cands_by_id = {c["id"]: c for c in cands}

    entries = None
    if config.USE_LLM:
        llm_input = build_llm_input(cands, ctx, fixed_first["id"] if fixed_first else None)
        for attempt in (1, 2):                                                        # 10.8: one retry
            try:
                entries = validate(call_llm(llm_input), cands_by_id, fixed_first)
                break
            except LLMError as e:
                log.warning("LLM attempt %d failed: %s", attempt, e)
        if entries is None and not config.LLM_FALLBACK_RULES:
            raise ApiError(502, "LLM_FAILED", "Could not build a plan right now.")
    if entries is None:
        entries = validate(rule_plan(cands, ctx, fixed_first), cands_by_id, fixed_first)
    return schedule(entries, places_by_id, ctx)


def new_course(places: list[dict], profile_in: dict, start_time: str, end_time: str) -> tuple[dict, list[dict]]:
    start, end = check_time_window(start_time, end_time)
    profile = dict(profile_in)
    profile["conditions"] = {"indoor_only": False, "low_walking": False}
    profile["start_time"], profile["end_time"] = start_time, end_time      # server-owned, like conditions
    min_items, max_items = item_bounds(end - start)
    ctx = TripCtx(profile=profile, start_min=start, end_min=end, min_items=min_items, max_items=max_items,
                  needs_lunch=window_has_lunch(start, end))
    rows = run_pipeline(places, ctx, min_candidates=2)
    course_id = str(uuid.uuid4())
    from .store import now_iso
    course = {"id": course_id, "user_profile": profile, "tier": "free", "created_at": now_iso()}
    items = [{"course_id": course_id, "order": n, **r, "status": "current" if n == 1 else "upcoming"}
             for n, r in enumerate(rows, start=1)]
    return course, items


@dataclass
class ReplanResult:
    user_profile: dict
    statuses: dict[int, str]
    delete_orders: list[int]
    new_items: list[dict]
    report_place_id: Optional[int]


def replan(places: list[dict], course: dict, items: list[dict], reason: str, current_order: int) -> ReplanResult:
    places_by_id = {p["id"]: p for p in places}
    current = next((i for i in items if i["order"] == current_order), None)
    if current is None:
        raise ApiError(404, "COURSE_ITEM_NOT_FOUND", "That stop is not in this plan.")

    profile = dict(course["user_profile"])
    cond = dict(profile.get("conditions") or {"indoor_only": False, "low_walking": False})
    excluded = set(profile.get("_excluded_place_ids") or [])
    statuses = {i["order"]: ("done" if i["order"] < current_order else
                             "current" if i["order"] == current_order else "upcoming") for i in items}

    if profile.get("end_time"):
        end_min = to_min(profile["end_time"])
    else:  # course saved before the trip-time change: only `duration` (FR-11)
        budget = config.HALF_DAY_MIN if profile.get("duration") == "half_day" else config.FULL_DAY_MIN
        end_min = to_min(items[0]["start_time"]) + budget
    cur_place = places_by_id.get(current["place_id"])
    if cur_place is None:
        raise ApiError(404, "PLACE_NOT_FOUND", "Place not found.")

    report_place_id = None
    if reason == "closed":
        kept = [i for i in items if i["order"] < current_order]
        start = to_min(current["start_time"])
        first_order = current_order
        excluded.add(cur_place["id"])
        report_place_id = cur_place["id"]
        delete_orders = [i["order"] for i in items if i["order"] >= current_order]
    else:
        kept = [i for i in items if i["order"] <= current_order]
        start = to_min(current["start_time"]) + current["stay_min"]
        first_order = current_order + 1
        delete_orders = [i["order"] for i in items if i["order"] > current_order]
    if reason == "rain":
        cond["indoor_only"] = True
    if reason == "tired":
        cond["low_walking"] = True
    profile["conditions"] = cond
    profile["_excluded_place_ids"] = sorted(excluded)

    kept_place_ids = {i["place_id"] for i in kept}
    kept_has_food = any(places_by_id.get(pid, {}).get("category") == "food" for pid in kept_place_ids)
    needs_lunch = reason != "hungry" and not kept_has_food and window_has_lunch(start, end_min)
    upcoming_ids = [i["place_id"] for i in items if i["order"] > current_order]

    has_fixed = reason in ("closed", "hungry")
    remaining = end_min - start
    if remaining < 30 and not has_fixed:
        new_rows: list[dict] = []
    else:
        ctx = TripCtx(
            profile=profile, start_min=start, end_min=max(end_min, start + 60),
            min_items=1, max_items=max(1, (max(remaining, 60)) // 70),
            needs_lunch=needs_lunch, origin=cur_place,
            exclude_ids=kept_place_ids | excluded, reason=reason, keep_ids=upcoming_ids,
            fixed_first_category=("food" if reason == "hungry" else cur_place["category"] if reason == "closed" else None),
            fixed_first_any=(reason == "closed"),
        )
        if reason == "hungry":
            ctx.needs_lunch = False
        new_rows = run_pipeline(places, ctx, min_candidates=1)

    new_items = []
    for n, r in enumerate(new_rows):
        order = first_order + n
        status = "current" if (reason == "closed" and n == 0) else "upcoming"
        new_items.append({"course_id": course["id"], "order": order, **r, "status": status})
    # statuses only for rows we keep
    statuses = {o: s for o, s in statuses.items() if o not in delete_orders}
    return ReplanResult(profile, statuses, delete_orders, new_items, report_place_id)
