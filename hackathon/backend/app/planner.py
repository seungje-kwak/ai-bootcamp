"""Course pipeline (10장, tasks/prd-recommendation-p1.md 8장):

  1. filter (F-1..F-8, F-10) -> meals_needed -> F-7
  2. anchor (seed) -> candidates (a food quota per meal)
  3. rule planner (seed) or LLM -> validate -> fit the trip window (drop / shrink)
  4. improve_order (2-opt)
  5. ensure_meals -> rest stop
  6. timing (not_before, 30-min moves, opening hours)
  7. fit_stays (shrink -> stretch)

LLM picks places/order/stay/reason. Python owns ids, distance, times, move method (10.1).
"""
from __future__ import annotations

import bisect
import itertools
import logging
import math
import random
import re
import secrets
import uuid
from collections import Counter
from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

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
ONBOARDING_KEYS = ("interests", "fitness_level", "max_walk_min", "avoid_slopes", "condition_today", "diet")


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


def new_seed() -> int:
    """US-P14: a course made without a seed gets a random one. Tests replace this function."""
    return secrets.randbits(31)


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


# --------------------------------------------------------------------------- meals (P1 FR-3 to FR-5)
def meal_window(meal: str) -> tuple[int, int]:
    """The arrival window of a meal in minutes (FR-4)."""
    a0, a1 = config.MEALS[meal]["arrive"]
    return to_min(a0), to_min(a1)


def meals_needed(start_min: int, end_min: int) -> list[str]:
    """FR-5: the meals of a trip [start, end], in time order. A meal is needed when the trip overlaps its
    core time by MEAL_MIN_OVERLAP minutes and there are MEAL_GAP_MIN minutes left from
    a = max(start, arrival window start), with a no later than the window end."""
    out = []
    for meal, m in config.MEALS.items():
        c0, c1 = to_min(m["core"][0]), to_min(m["core"][1])
        a0, a1 = meal_window(meal)
        a = max(start_min, a0)
        if min(end_min, c1) - max(start_min, c0) >= config.MEAL_MIN_OVERLAP and a <= a1 \
                and a + config.MEAL_GAP_MIN <= end_min:
            out.append(meal)
    return sorted(out, key=lambda m: meal_window(m)[0])


def meal_of_arrival(arrive_min: int, meals: list[str], early_min: int = 0) -> Optional[str]:
    """The first of `meals` whose arrival window [start - early_min, end] holds `arrive_min`."""
    for m in meals:
        a0, a1 = meal_window(m)
        if a0 - early_min <= arrive_min <= a1:
            return m
    return None


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


def open_for_meal(p: dict, meal: str) -> bool:
    """FR-7: some arrival inside the meal's window leaves the place open for its whole stay."""
    w = open_window(p)
    if w is None:
        return True
    a0, a1 = meal_window(meal)
    a = max(w[0], a0)
    return a <= a1 and a + p["avg_stay_min"] <= w[1]


# --------------------------------------------------------------------------- stay time (P1 FR-17b)
def _round5(x: float) -> int:
    return int(x / 5 + 0.5) * 5


def stay_range(p: dict) -> tuple[int, int]:
    """FR-17b: (low, high) minutes a stop may stay. The type's range, widened to the place's own
    avg_stay_min. A place without place_type (older data): 0.75x to 2x of avg_stay_min, at least 20,
    at most 180, rounded to 5. The high end is never over MAX_STAY_MIN (V-5)."""
    avg = int(p["avg_stay_min"])
    t = config.STAY_BY_TYPE.get(p.get("place_type") or "")
    if t is not None:
        lo, hi = min(t[1], avg), max(t[2], avg)
    else:
        lo, hi = _round5(max(20, avg * 0.75)), _round5(min(avg * 2, 180))
    hi = min(hi, config.MAX_STAY_MIN)
    return min(lo, hi), hi


# --------------------------------------------------------------------------- evening spots (P1 FR-14)
_EVENING_CACHE: dict[tuple, bool] = {}
_EVENING_RX = re.compile("|".join(re.escape(w) for w in config.EVENING_WORDS), re.IGNORECASE)


def is_evening_spot(p: dict) -> bool:
    """FR-14: the name or description has one of EVENING_WORDS. Worked out once per place."""
    key = (p["id"], p.get("name_en"), p.get("description_en"))
    v = _EVENING_CACHE.get(key)
    if v is None:
        v = _EVENING_CACHE[key] = bool(_EVENING_RX.search(f"{p.get('name_en') or ''} {p.get('description_en') or ''}"))
    return v


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
    meals: list[str] = field(default_factory=list)   # P1 FR-5: meals still to fill, in time order
    origin: Optional[dict] = None     # place dict
    exclude_ids: set[int] = field(default_factory=set)
    fixed_first_category: Optional[str] = None   # "food" for hungry, closed place's category for closed
    fixed_first_any: bool = False                # closed: fall back to any category
    reason: Optional[str] = None
    keep_ids: list[int] = field(default_factory=list)
    anchor: Optional[dict] = None     # FR-9: the place the candidates are gathered around (run_pipeline sets it)
    rng: Optional[random.Random] = None          # P1 FR-19: the only randomness. None: always the best option
    stats: dict = field(default_factory=dict)    # what ensure_meals did (the eval reads meal_repaired)
    fixed_first_id: Optional[int] = None         # run_pipeline sets it
    # tasks/prd-travel-range.md FR-5: a shuffle's lists of hub centres to stay away from, tried in order
    # (the first that leaves a hub is used; when none does, no hub is avoided). A new course has none.
    avoid: list[list[dict]] = field(default_factory=list)
    _moves: dict = field(default_factory=dict, repr=False)

    def move(self, a: dict, b: dict) -> tuple[str, int]:
        """move_between with this traveler's max_walk_min, worked out once per pair."""
        key = (a["id"], b["id"], a["lat"], a["lng"], b["lat"], b["lng"])
        m = self._moves.get(key)
        if m is None:
            m = self._moves[key] = move_between(a, b, int(self.profile["max_walk_min"]))
        return m


def is_low_walker(profile: dict) -> bool:
    """Tired today, the low_walking condition, or fitness level 1."""
    return (profile["condition_today"] == "tired" or bool((profile.get("conditions") or {}).get("low_walking"))
            or int(profile["fitness_level"]) == 1)


def _passes_diet(p: dict, diet: str) -> bool:
    """F-3 (prd-recommendation-p0 FR-5): food places only. Each option is true / false / null (not known).
    solo_ok: only false is dropped. A diet needs its option to be true: null does not count."""
    if p["category"] != "food":
        return True
    f = p.get("food_options")
    if not f:
        return True
    if f.get("solo_ok") is False:
        return False
    if diet == "vegan":
        return f.get("vegan") is True
    if diet == "vegetarian":
        return f.get("vegetarian") is True or f.get("vegan") is True
    if diet == "halal":
        return f.get("halal") is True
    return True


def base_filter(places: list[dict], profile: dict, exclude_ids: set[int], level_bonus: int = 0) -> list[dict]:
    """F-1..F-6 and F-8. F-10 (opening hours), F-7 (meals) and F-9 (count) are applied afterwards."""
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


def _within(center: dict, radius_m: float):
    """A test `p -> haversine_m(center, p) <= radius_m` that skips the asin / sqrt (same result)."""
    lat0, lng0 = math.radians(center["lat"]), math.radians(center["lng"])
    cos0 = math.cos(lat0)
    limit = math.sin(radius_m / 2 / 6371000.0) ** 2

    def inside(p: dict) -> bool:
        lat = math.radians(p["lat"])
        a = math.sin((lat - lat0) / 2) ** 2 + cos0 * math.cos(lat) * math.sin((math.radians(p["lng"]) - lng0) / 2) ** 2
        return a <= limit
    return inside


def km_between(a: dict, b: dict) -> float:
    """Straight-line km. `b` may be a bare {"lat", "lng"} point (an old course's centre, FR-6)."""
    return haversine_m(a["lat"], a["lng"], b["lat"], b["lng"]) / 1000


# --------------------------------------------------------------------------- hubs (tasks/prd-travel-range.md v0.3)
@dataclass
class Hub:
    """A neighbourhood: its centre place, its density (pool places within ANCHOR_RADIUS_KM, itself
    included) and the restaurants within that radius."""
    place: dict
    density: int
    food: list[dict] = field(default_factory=list)

    def fed(self, meals: list[str]) -> bool:
        """FR-1 step 5: every meal has a restaurant open for it in the hub."""
        return all(any(open_for_meal(p, m) for p in self.food) for m in meals)


def find_hubs(pool: list[dict], ctx: TripCtx) -> list[Hub]:
    """FR-1. Hub candidates are the pool places in `interests` (the whole pool when there are none). Each
    gets its density over the whole pool. Densest first (then the smaller id), a place becomes a hub when
    its density is HUB_MIN_PLACES or more and it is more than HUB_SEPARATION_KM from every hub before it.
    No hub at all: the densest place alone, ranked as P0 FR-9 did (a place with a restaurant open for every
    needed meal first, then density, then more food when a meal is needed, then the smaller id). Without
    that first rule a big area's course can end up more than MAX_MOVE_MIN from every dinner place
    (pyoseon dinner 37% in the P1 eval). No randomness."""
    if not pool:
        return []
    interests = set(ctx.profile["interests"])
    choices = [p for p in pool if p["category"] in interests] or pool
    radius = config.ANCHOR_RADIUS_KM * 1000
    # only places within the radius in latitude can be within it at all: look at that band only
    by_lat = sorted(pool, key=lambda p: p["lat"])
    lats = [p["lat"] for p in by_lat]
    band = math.degrees(radius / 6371000.0)
    rows = []
    for c in choices:
        inside = _within(c, radius)
        lo, hi = bisect.bisect_left(lats, c["lat"] - band), bisect.bisect_right(lats, c["lat"] + band)
        near = [p for p in by_lat[lo:hi] if inside(p)]
        rows.append(Hub(c, len(near), [p for p in near if p["category"] == "food"]))
    rows.sort(key=lambda h: (-h.density, h.place["id"]))
    hubs: list[Hub] = []
    for h in rows:
        if h.density < config.HUB_MIN_PLACES:
            break
        if all(km_between(h.place, o.place) > config.HUB_SEPARATION_KM for o in hubs):
            hubs.append(h)
    if hubs:
        return hubs
    food_first = bool(ctx.meals)
    return [min(rows, key=lambda h: (not h.fed(ctx.meals), -h.density, -len(h.food) if food_first else 0,
                                     h.place["id"]))]


def _weighted(options: list, weights: list[float], rng: Optional[random.Random]):
    """One option with probability proportional to its weight. Without rng: the heaviest (the first on a tie)."""
    if rng is None:
        return options[max(range(len(options)), key=lambda i: (weights[i], -i))]
    return rng.choices(options, weights=weights)[0]


def pick_hub(hubs: list[Hub], ctx: TripCtx, avoid: list[dict] = ()) -> Optional[Hub]:
    """FR-2: drop the hubs within HUB_SEPARATION_KM of a point in `avoid`; of the rest, the ones that can
    serve every needed meal (all of the rest when none can); one of them with a probability proportional to
    its density. Without ctx.rng: the densest. None when `avoid` leaves no hub."""
    left = [h for h in hubs if not any(km_between(h.place, a) <= config.HUB_SEPARATION_KM for a in avoid)]
    if not left:
        return None
    fed = [h for h in left if h.fed(ctx.meals)] or left
    return _weighted(fed, [h.density for h in fed], ctx.rng)


def course_hub(hubs: list[Hub], ctx: TripCtx) -> tuple[Optional[Hub], int]:
    """FR-2 with FR-5 step 3: (the hub, how many of ctx.avoid's lists were given up). Each list of ctx.avoid
    is tried in order; when none leaves a hub, no hub is avoided."""
    for level, avoid in enumerate(ctx.avoid):
        hub = pick_hub(hubs, ctx, avoid)
        if hub is not None:
            return hub, level
    return pick_hub(hubs, ctx), len(ctx.avoid)


def pick_anchor(pool: list[dict], ctx: TripCtx) -> Optional[dict]:
    """P0 FR-9 as tasks/prd-travel-range.md FR-2 changed it. Replanning: the stop the traveler is at. New
    course: the centre of the hub course_hub picks. Without ctx.rng: the densest hub (P1 FR-19's "one of
    the top 3, evenly" is gone). Records the hub count (eval) and how many avoid lists were given up."""
    if ctx.origin is not None:
        return ctx.origin
    if not pool:
        return None
    hubs = find_hubs(pool, ctx)
    hub, level = course_hub(hubs, ctx)
    ctx.stats["hub_count"], ctx.stats["avoid_level"] = len(hubs), level
    return hub.place


def limit_candidates(cands: list[dict], interests: list[str], meals: list[str], anchor: Optional[dict],
                     min_candidates: int, fixed_first: Optional[dict] = None) -> list[dict]:
    """F-9 (FR-10): the MAX_CANDIDATES places closest to the anchor, with room for meals and cafés
    and no more than CATEGORY_CAP of one category. Returned closest first.
    P1 FR-7: for each meal, the QUOTA_FOOD closest restaurants open for that meal (a restaurant picked
    for both meals is kept once)."""
    if anchor is None or not cands:
        return list(cands)
    dist = {p["id"]: haversine_m(anchor["lat"], anchor["lng"], p["lat"], p["lng"]) for p in cands}
    if fixed_first is not None and fixed_first["id"] not in dist:
        dist[fixed_first["id"]] = haversine_m(anchor["lat"], anchor["lng"], fixed_first["lat"], fixed_first["lng"])

    def by_distance(p: dict) -> tuple:
        return dist[p["id"]], p["id"]

    near = [p for p in cands if dist[p["id"]] <= config.CANDIDATE_MAX_RADIUS_KM * 1000]   # 1
    pool = sorted(near if len(near) >= min_candidates else cands, key=by_distance)          # 2

    kept: list[dict] = []
    kept_ids: set[int] = set()
    count: Counter = Counter()

    def add(p: dict) -> None:
        kept.append(p)
        kept_ids.add(p["id"])
        count[p["category"]] += 1

    def fill(category_ok, cap: int) -> None:
        for p in pool:
            if len(kept) >= config.MAX_CANDIDATES:
                return
            c = p["category"]
            if p["id"] in kept_ids or not category_ok(c) or count[c] >= cap:
                continue
            add(p)

    for meal in meals:                                                                      # 3
        mine = 0
        for p in pool:
            if mine >= config.QUOTA_FOOD or len(kept) >= config.MAX_CANDIDATES:
                break
            if p["category"] != "food" or not open_for_meal(p, meal):
                continue
            if p["id"] not in kept_ids:
                add(p)
            mine += 1
    fill(lambda c: c == "cafe", config.QUOTA_CAFE)                                          # 4
    fill(lambda c: c in interests, config.CATEGORY_CAP)                                     # 5
    fill(lambda c: c not in interests, config.CATEGORY_CAP)                                 # 6
    if fixed_first is not None and fixed_first["id"] not in kept_ids:                      # 7
        kept.append(fixed_first)
        if len(kept) > config.MAX_CANDIDATES:
            kept.remove(max((p for p in kept if p is not fixed_first), key=by_distance))
    return sorted(kept, key=by_distance)                                                    # 8


# --------------------------------------------------------------------------- rule planner (10.8 P1)
def _rule_reason(p: dict, profile: dict, ctx: TripCtx, rest: bool) -> str:
    acc, f = p["accessibility"], p.get("food_options")
    parts: list[str] = []
    if f:
        bits = []
        # only true values: null means not known and is never written as "no" (or "yes")
        if f.get("solo_ok") is True:
            bits.append("you can order for one")
        diet = profile["diet"]
        if diet in ("vegan", "vegetarian", "halal") and f.get(diet) is True:
            bits.append(f"there are {diet} options")
        if f.get("english_menu") is True:
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


def stop_score(p: dict, ctx: TripCtx) -> float:
    """The part of the rule planner score that does not depend on time or the stops around it."""
    profile = ctx.profile
    low = is_low_walker(profile)
    s = 3.0 if p["category"] in profile["interests"] else 0.0
    if p["id"] in ctx.keep_ids:
        s += 2.0
    s -= p["accessibility"]["fatigue_score"] * (0.8 if low else 0.2)
    if low and p["category"] == "cafe":
        s += config.REST_CAFE_BONUS                                          # P1 FR-14
    if p["category"] == "food" and (p.get("food_options") or {}).get("solo_ok") is True:
        s += config.SOLO_OK_BONUS
    return s


def _pick(options: list[tuple[float, dict]], rng: Optional[random.Random]) -> dict:
    """P1 FR-19: one of the PICK_TOP_K best options within PICK_MARGIN of the best, picked evenly."""
    options = sorted(options, key=lambda o: (-o[0], o[1]["id"]))
    if rng is None:
        return options[0][1]
    top = [p for v, p in options[:config.PICK_TOP_K] if v >= options[0][0] - config.PICK_MARGIN]
    return rng.choice(top)


def rule_plan(cands: list[dict], ctx: TripCtx, fixed_first: Optional[dict]) -> LLMCourse:
    """P1 FR-8: P0's lunch rule for every meal in ctx.meals. Before the next meal's arrival window opens,
    no other stop may end past 10 minutes before the window closes; inside the window a restaurant gets
    +10; outside it no restaurant is picked. A meal that can no longer be filled is skipped (ensure_meals
    fills it). FR-14 adds the same-category penalties and the evening bonus."""
    profile = ctx.profile
    low = is_low_walker(profile)
    evening_from = to_min(config.EVENING_FROM)
    chosen: list[dict] = []
    remaining = {p["id"]: p for p in cands}
    prev, t = ctx.origin, ctx.start_min
    pending = list(ctx.meals)                      # meals not filled or skipped yet, in time order

    def arrival(p: dict) -> int:
        if prev is None:
            return t
        return round_up5(t + ctx.move(prev, p)[1])

    def take(p: dict) -> None:
        nonlocal prev, t
        a = arrival(p)
        chosen.append(p)
        remaining.pop(p["id"], None)
        if p["category"] == "food" and pending and meal_of_arrival(a, pending[:1]):
            pending.pop(0)
        prev, t = p, a + p["avg_stay_min"]

    if fixed_first is not None:
        take(fixed_first)

    while len(chosen) < ctx.max_items and remaining:
        # the next meal is impossible (window passed, or no food left) -> stop reserving a slot for it
        while pending and (t > meal_window(pending[0])[1]
                           or not any(p["category"] == "food" for p in remaining.values())):
            pending.pop(0)
        nxt = meal_window(pending[0]) if pending else None
        options = []
        for p in remaining.values():
            a = arrival(p)
            stay = p["avg_stay_min"]
            if a + stay > ctx.end_min:
                continue
            if not fits_hours(p, a, stay):                                  # FR-8
                continue
            is_food = p["category"] == "food"
            if is_food and (nxt is None or not nxt[0] <= a <= nxt[1]):
                continue
            # a non-food stop must not push the next meal past the end of its window
            if not is_food and nxt is not None and a + stay > nxt[1] - 10 and a < nxt[1]:
                continue
            if prev is not None and ctx.move(prev, p)[1] > config.MAX_MOVE_MIN:
                continue                                                     # start-area FR-9
            # FR-11: the first stop is measured from the anchor (no move, no travel time)
            base = prev if prev is not None else ctx.anchor
            dist_km = route_m(base, p) / 1000 if base is not None else 0.0
            v = stop_score(p, ctx) - dist_km * 1.2
            if is_food:
                v += 10.0
            else:                                                            # P1 FR-14
                if len(chosen) >= 2 and chosen[-1]["category"] == chosen[-2]["category"] == p["category"]:
                    v -= config.SAME_CATEGORY_RUN_PENALTY
                elif chosen and chosen[-1]["category"] == p["category"]:
                    v -= config.SAME_CATEGORY_PENALTY
            if a >= evening_from and is_evening_spot(p):
                v += config.EVENING_BONUS
            options.append((v, p))
        if not options:
            break
        take(_pick(options, ctx.rng))

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
        "traveler": {k: p[k] for k in ONBOARDING_KEYS},
        "trip": {
            "start_time": to_hhmm(ctx.start_min),
            "end_time": to_hhmm(ctx.end_min),
            "time_budget_min": ctx.end_min - ctx.start_min,
            "min_items": ctx.min_items,
            "max_items": ctx.max_items,
            # P1 US-P09
            "meals": [{"meal": m, "arrive_from": config.MEALS[m]["arrive"][0],
                       "arrive_by": config.MEALS[m]["arrive"][1]} for m in ctx.meals],
            "indoor_only": bool(cond.get("indoor_only")),
            "low_walking": bool(cond.get("low_walking")),
            "origin": ({"name_en": ctx.origin["name_en"], "lat": ctx.origin["lat"], "lng": ctx.origin["lng"]}
                       if ctx.origin else None),
            # FR-12: new course only. A replan starts from trip.origin instead
            "anchor": ({"lat": ctx.anchor["lat"], "lng": ctx.anchor["lng"]}
                       if ctx.anchor is not None and ctx.origin is None else None),
        },
        "replan": (None if ctx.reason is None else {
            "reason": ctx.reason, "fixed_first_place_id": fixed_first_id, "keep_if_possible": ctx.keep_ids,
        }),
        "candidates": [{
            "id": c["id"], "name_en": c["name_en"], "category": c["category"],
            "description_en": c["description_en"], "lat": c["lat"], "lng": c["lng"],
            "avg_stay_min": c["avg_stay_min"],
            "min_stay_min": stay_range(c)[0], "max_stay_min": stay_range(c)[1],     # P1 US-P12
            "evening_spot": is_evening_spot(c),                                       # P1 US-P10
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
        if i.stay_min < 10 or i.stay_min > config.MAX_STAY_MIN:
            i.stay_min = cands_by_id[i.place_id]["avg_stay_min"]
    if not uniq:                                                                      # V-7
        raise LLMError("no valid items after validation")
    return uniq


# --------------------------------------------------------------------------- entries and timing (10.6, P1 FR-10)
@dataclass
class Entry:
    """One step of a course while it is built: a stop (place_id) or a free meal time (place_id None)."""
    place_id: Optional[int]
    stay_min: int
    reason_en: str = ""
    is_rest_stop: bool = False
    meal: Optional[str] = None          # the meal this stop or free time is for
    not_before: Optional[int] = None    # earliest start: waiting happens before it
    arrive_by: Optional[int] = None     # latest start (FR-10: a filled meal stays filled)
    gap_reason: Optional[str] = None    # free meal time: "no_diet_match" or "none_nearby"

    @property
    def is_gap(self) -> bool:
        return self.place_id is None


@dataclass
class Slot:
    start: int
    end: int
    move_method: Optional[str]
    move_min: Optional[int]
    wait: int = 0                       # minutes waited for not_before


def timeline(entries: list[Entry], by_id: dict[int, dict], ctx: TripCtx) -> list[Slot]:
    """Start = previous end + move, rounded up to 5 minutes, then no earlier than not_before.
    A free meal time has no move and starts when the previous step ends (or at not_before). The move to
    the stop after it is measured from the last place before it."""
    slots, prev, t = [], ctx.origin, ctx.start_min
    for e in entries:
        if e.is_gap:
            s = max(t, e.not_before or t)
            slots.append(Slot(s, s + e.stay_min, None, None, s - t))
            t = s + e.stay_min
            continue
        p = by_id[e.place_id]
        if prev is None:
            method, mins, natural = None, None, t
        else:
            method, mins = ctx.move(prev, p)
            natural = round_up5(t + mins)
        s = max(natural, e.not_before or natural)
        slots.append(Slot(s, s + e.stay_min, method, mins, s - natural))
        prev, t = p, s + e.stay_min
    return slots


def course_ok(entries: list[Entry], slots: list[Slot], by_id: dict[int, dict], ctx: TripCtx) -> bool:
    """FR-10, the rules every change (ensure, 2-opt, stay changes) must keep. Lower bounds (a meal's
    window start, an evening spot's 16:30) are not_before values, so timeline() already keeps them.
    Also: the day does not start by waiting (trip-time: the first stop starts at the start time), and
    there are no more stops than ctx.max_items (trip-time FR-6)."""
    if slots and slots[0].wait > 0:
        return False
    if sum(not e.is_gap for e in entries) > ctx.max_items:
        return False
    for e, s in zip(entries, slots):
        if s.end > ctx.end_min:
            return False
        if e.arrive_by is not None and s.start > e.arrive_by:
            return False
        if e.is_gap:
            continue
        if (s.move_min or 0) > config.MAX_MOVE_MIN:
            return False
        if not fits_hours(by_id[e.place_id], s.start, e.stay_min):
            return False
    if ctx.fixed_first_id is not None and (not entries or entries[0].place_id != ctx.fixed_first_id):
        return False
    return True


def idle_min(entries: list[Entry], slots: list[Slot], ctx: TripCtx) -> int:
    """P1 FR-2: trip time not spent at a stop, moving or in a free meal time (waits and the end)."""
    busy = sum(e.stay_min + (s.move_min or 0) for e, s in zip(entries, slots))
    return ctx.end_min - ctx.start_min - busy


def to_entries(items: list[LLMItem], by_id: dict[int, dict]) -> list[Entry]:
    """US-P13: a stay is first cut to its place's stay_range."""
    out = []
    for i in items:
        lo, hi = stay_range(by_id[i.place_id])
        out.append(Entry(i.place_id, min(max(i.stay_min, lo), hi), i.reason_en, bool(i.is_rest_stop)))
    return out


def _shrink(entries: list[Entry], by_id: dict[int, dict], ctx: TripCtx) -> list[Slot]:
    """FR-18 step 1: while the day runs past the end, take STAY_STEP_MIN off non-food stops from the back,
    each down to its low end. Returns the new timeline."""
    slots = timeline(entries, by_id, ctx)
    for n in range(len(entries) - 1, -1, -1):
        if slots[-1].end <= ctx.end_min:
            break
        e = entries[n]
        if e.is_gap or by_id[e.place_id]["category"] == "food" or n == 0 and ctx.fixed_first_id is not None:
            continue
        lo = stay_range(by_id[e.place_id])[0]
        while e.stay_min > lo and slots[-1].end > ctx.end_min:
            e.stay_min = max(lo, e.stay_min - config.STAY_STEP_MIN)
            slots = timeline(entries, by_id, ctx)
    return slots


def fit_window(entries: list[Entry], by_id: dict[int, dict], ctx: TripCtx) -> list[Entry]:
    """Make a planned list keep the hard rules: drop the first stop that is too far to reach (start-area
    FR-9), shrink stays and then drop the last stop while the day runs past the end (FR-18 step 1, rule 7),
    and drop the first stop outside its opening hours (FR-8). Time again after every drop."""
    entries = [replace(e) for e in entries]
    while True:
        slots = timeline(entries, by_id, ctx)
        far = next((n for n, s in enumerate(slots) if (s.move_min or 0) > config.MAX_MOVE_MIN), None)
        if far is not None:
            del entries[far]
            if not entries:
                raise ApiError(409, "NO_CANDIDATES", "No places are close enough.")
            continue
        slots = _shrink(entries, by_id, ctx)
        while len(entries) > 1 and slots[-1].end > ctx.end_min:                     # rule 7
            entries.pop()
            slots = slots[:-1]
        bad = next((n for n, (e, s) in enumerate(zip(entries, slots))
                    if not e.is_gap and not fits_hours(by_id[e.place_id], s.start, e.stay_min)), None)
        if bad is None:
            return entries
        del entries[bad]
        if not entries:
            raise ApiError(409, "NO_CANDIDATES", "No places are open at these times.")


def claim_windows(entries: list[Entry], by_id: dict[int, dict], ctx: TripCtx) -> list[Entry]:
    """Pin what the plan already does right, so later steps keep it (FR-10): a food stop arriving inside
    a needed meal's window fills that meal (FR-6; a second one in the same window is dropped), and an
    evening spot reached at 16:30 or later is not moved before 16:30."""
    slots = timeline(entries, by_id, ctx)
    open_meals = [m for m in ctx.meals if not any(e.meal == m for e in entries)]
    claimed = {e.meal for e in entries if e.meal}
    evening_from = to_min(config.EVENING_FROM)
    out = []
    for n, (e, s) in enumerate(zip(entries, slots)):
        if e.is_gap:
            out.append(e)
            continue
        p = by_id[e.place_id]
        fixed = n == 0 and ctx.fixed_first_id is not None
        if p["category"] == "food" and not e.meal and not fixed:
            m = meal_of_arrival(s.start, open_meals)
            if m is not None:
                e.meal, (e.not_before, e.arrive_by) = m, meal_window(m)
                open_meals.remove(m)
                claimed.add(m)
            elif meal_of_arrival(s.start, sorted(claimed)) is not None:
                continue                                    # a second restaurant for a meal already filled
        if not fixed and s.start >= evening_from and is_evening_spot(p):
            e.not_before = max(e.not_before or 0, evening_from)
        out.append(e)
    return out


# --------------------------------------------------------------------------- 2-opt (P1 FR-16)
def _travel(entries: list[Entry], by_id: dict[int, dict], ctx: TripCtx) -> tuple[int, int]:
    """(taxi legs, move minutes), counted from the replan origin, or for a new course from the anchor.
    Taxi legs come first: a taxi is quicker than a 20-minute walk, so comparing minutes alone turns walks
    into taxi rides (eval 2026-11-16: taxi legs 1.71 -> 2.50 on minutes, 1.47 with this order)."""
    prev, taxis, total = ctx.origin or ctx.anchor, 0, 0
    for e in entries:
        if e.is_gap:
            continue
        p = by_id[e.place_id]
        if prev is not None:
            method, mins = ctx.move(prev, p)
            taxis += method == "taxi"
            total += mins
        prev = p
    return taxis, total


def improve_order(entries: list[Entry], by_id: dict[int, dict], ctx: TripCtx) -> list[Entry]:
    """FR-16: reverse stops i..j (i < j, never the fixed first stop) when that makes the trip shorter
    (fewer taxi legs, then fewer move minutes; see _travel) and the course still keeps FR-10. Repeat until
    nothing gets shorter (MAX_2OPT_ROUNDS at most)."""
    lo = 1 if ctx.fixed_first_id is not None else 0
    best = _travel(entries, by_id, ctx)
    for _ in range(config.MAX_2OPT_ROUNDS):
        found = None
        for i in range(lo, len(entries) - 1):
            for j in range(i + 1, len(entries)):
                trial = entries[:i] + entries[i:j + 1][::-1] + entries[j + 1:]
                cost = _travel(trial, by_id, ctx)
                if cost < best and course_ok(trial, timeline(trial, by_id, ctx), by_id, ctx):
                    found = trial, cost
                    break
            if found:
                break
        if found is None:
            break
        entries, best = found
    return entries


# --------------------------------------------------------------------------- meals and rest stop (P1 FR-9, FR-11)
GAP_MESSAGES = {
    "no_diet_match": "We couldn't find a {diet}-friendly restaurant in this area, so we kept {start}–{end} free for {meal}.",
    "none_nearby": "No restaurant we know is open near your stops at this time, so we kept {start}–{end} free for {meal}.",
}


def _prev_place(entries: list[Entry], pos: int, by_id: dict[int, dict], ctx: TripCtx) -> Optional[dict]:
    for e in reversed(entries[:pos]):
        if not e.is_gap:
            return by_id[e.place_id]
    return ctx.origin or ctx.anchor


def _insert_best(entries: list[Entry], pool: list[Optional[dict]], make: Callable[[Optional[dict]], Entry],
                 by_id: dict[int, dict], ctx: TripCtx) -> Optional[list[Entry]]:
    """FR-9 steps 2 to 5: try each position with the 10 places of `pool` closest to the step before it
    (`None` in the pool is a free meal time). When nothing fits, also try leaving out 1 or 2 of the 3
    lowest-scoring stops that may go. Of the plans that keep FR-10, the one with the fewest stops left
    out, then the least move time, then the smallest place id; then (a free meal time) the one starting
    closest to the meal's core time, then the later position."""
    lo = 1 if ctx.fixed_first_id is not None else 0
    movable = [n for n, e in enumerate(entries) if n >= lo and not e.is_gap and not e.meal
               and e.place_id not in ctx.keep_ids]
    lowest = sorted(movable, key=lambda n: (stop_score(by_id[entries[n].place_id], ctx), -n))[:3]
    drops = [()] + [(n,) for n in lowest] + list(itertools.combinations(sorted(lowest), 2))
    for size in (0, 1, 2):
        best_key, best = None, None
        for drop in (d for d in drops if len(d) == size):
            kept = [e for n, e in enumerate(entries) if n not in drop]
            for pos in range(lo, len(kept) + 1):
                prev = _prev_place(kept, pos, by_id, ctx)
                options = [None] if pool == [None] else sorted(
                    pool, key=lambda p: (route_m(prev, p) if prev else 0.0, p["id"]))[:10]
                for p in options:
                    trial = kept[:pos] + [make(p)] + kept[pos:]
                    slots = timeline(trial, by_id, ctx)
                    if not course_ok(trial, slots, by_id, ctx):
                        continue
                    new = trial[pos]
                    core = to_min(config.MEALS[new.meal]["core"][0]) if new.meal else 0
                    key = (_travel(trial, by_id, ctx), p["id"] if p else 0,
                           abs(slots[pos].start - core) if new.meal else 0, -pos)
                    if best_key is None or key < best_key:
                        best_key, best = key, trial
        if best is not None:
            return best
    return None


def _gap_reason(area_places: list[dict], diet: str) -> str:
    """FR-11: no_diet_match when the traveler has a diet and no restaurant of the area passes F-3."""
    if diet != "none" and not any(p["category"] == "food" and _passes_diet(p, diet) for p in area_places):
        return "no_diet_match"
    return "none_nearby"


def ensure_meals(entries: list[Entry], by_id: dict[int, dict], ctx: TripCtx, cands: list[dict],
                 region: list[dict], area_places: list[dict]) -> list[Entry]:
    """FR-9: every meal in ctx.meals ends up with exactly one restaurant arriving in its window or one
    free meal time. In time order, for a meal not filled yet:
      0. a restaurant already in the plan that is early is kept for the meal (it waits for the window);
      1. else a restaurant from the candidates, then from the whole area (`region`), is put in;
      2. else a free meal time (45 min) is put in; as a last resort the stops after it are cut."""
    for meal in ctx.meals:
        if any(e.meal == meal for e in entries):
            continue
        a0, a1 = meal_window(meal)
        lo = 1 if ctx.fixed_first_id is not None else 0
        done = None
        for n, e in enumerate(entries):                                                 # 0
            if n < lo or e.is_gap or e.meal or by_id[e.place_id]["category"] != "food":
                continue
            trial = entries[:n] + [replace(e, meal=meal, not_before=a0, arrive_by=a1)] + entries[n + 1:]
            if course_ok(trial, timeline(trial, by_id, ctx), by_id, ctx):
                done = trial
                break
        used = {e.place_id for e in entries if not e.is_gap}
        r1 = [p for p in cands if p["category"] == "food" and p["id"] not in used]
        r1_ids = {p["id"] for p in r1}
        r2 = [p for p in region if p["category"] == "food" and p["id"] not in used and p["id"] not in r1_ids]

        def food_entry(p: dict) -> Entry:
            return Entry(p["id"], stay_range(p)[0], _rule_reason(p, ctx.profile, ctx, False),
                         meal=meal, not_before=a0, arrive_by=a1)
        for group in (r1, r2):                                                          # 1
            if done is None and group:
                done = _insert_best(entries, group, food_entry, by_id, ctx)
        if done is None:                                                                # 2
            reason = _gap_reason(area_places, ctx.profile["diet"])
            gap = Entry(None, config.MEAL_GAP_MIN, meal=meal, not_before=a0, arrive_by=a1, gap_reason=reason)
            done = _insert_best(entries, [None], lambda _: replace(gap), by_id, ctx)
            for cut in range(len(entries), lo - 1, -1):
                if done is not None:
                    break
                trial = entries[:cut] + [replace(gap)]
                if course_ok(trial, timeline(trial, by_id, ctx), by_id, ctx):
                    done = trial
            if done is None:
                log.warning("no room for the %s free time; adding it at the end", meal)
                done = entries + [replace(gap)]
        entries = done
        ctx.stats["meal_repaired"] = ctx.stats.get("meal_repaired", 0) + 1
    return entries


def ensure_rest_stop(entries: list[Entry], by_id: dict[int, dict], ctx: TripCtx, cands: list[dict],
                     region: list[dict]) -> list[Entry]:
    """US-P10: a traveler who should not walk much, with 3 or more stops and no café, gets the closest
    café that fits, the same way ensure_meals puts a restaurant in. When none fits, nothing changes."""
    stops = [e for e in entries if not e.is_gap]
    if not is_low_walker(ctx.profile) or len(stops) < 3 or any(by_id[e.place_id]["category"] == "cafe" for e in stops):
        return entries
    used = {e.place_id for e in stops}
    for group in ([p for p in cands if p["category"] == "cafe" and p["id"] not in used],
                  [p for p in region if p["category"] == "cafe" and p["id"] not in used]):
        if not group:
            continue
        out = _insert_best(entries, group, lambda p: Entry(p["id"], stay_range(p)[0], _rule_reason(
            p, ctx.profile, ctx, True), is_rest_stop=True), by_id, ctx)
        if out is not None:
            return out
    return entries


# --------------------------------------------------------------------------- stay times (P1 FR-18)
def fit_stays(entries: list[Entry], by_id: dict[int, dict], ctx: TripCtx) -> list[Entry]:
    """FR-18. 1: past the end -> shrink non-food stops from the back (to their low end), then drop the
    last stop and start again. 2: while there are STAY_STEP_MIN idle minutes, add STAY_STEP_MIN to the
    first stop that can take it, in this order: the stop right before a wait, a stop in the traveler's
    interests, a café for a traveler who should not walk much, any other stop, a restaurant. Earlier
    stops first within a rank. A stop can take it while under its high end and the course keeps FR-10."""
    entries = [replace(e) for e in entries]
    while True:
        slots = _shrink(entries, by_id, ctx)
        if slots[-1].end <= ctx.end_min or len(entries) <= 1:
            break
        entries.pop()
    interests = set(ctx.profile["interests"])
    low = is_low_walker(ctx.profile)
    step = config.STAY_STEP_MIN

    def rank(n: int) -> int:
        p = by_id[entries[n].place_id]
        if n + 1 < len(entries) and slots[n + 1].wait > 0:
            return 1
        if p["category"] == "food":
            return 5
        if p["category"] in interests:
            return 2
        if low and p["category"] == "cafe":
            return 3
        return 4

    while idle_min(entries, slots, ctx) >= step:
        order = sorted((n for n, e in enumerate(entries) if not e.is_gap), key=lambda n: (rank(n), n))
        for n in order:
            e = entries[n]
            hi = stay_range(by_id[e.place_id])[1]
            if e.stay_min >= hi:
                continue
            old = e.stay_min
            e.stay_min = min(hi, old + step)
            trial = timeline(entries, by_id, ctx)
            if course_ok(entries, trial, by_id, ctx):
                slots = trial
                break
            e.stay_min = old
        else:
            break
    # what is left before a stop is less than STAY_STEP_MIN (start times are rounded up to 5 minutes):
    # the stop before it keeps the traveler until then. No start time moves.
    for n in range(len(entries) - 1):
        e, nxt = entries[n], slots[n + 1]
        slack = nxt.start - slots[n].end - (nxt.move_min or 0)
        if e.is_gap or slack <= 0 or e.stay_min + slack > stay_range(by_id[e.place_id])[1]:
            continue
        e.stay_min += slack
        trial = timeline(entries, by_id, ctx)
        if course_ok(entries, trial, by_id, ctx):
            slots = trial
        else:
            e.stay_min -= slack
    return entries


# --------------------------------------------------------------------------- output
def _rows(entries: list[Entry], by_id: dict[int, dict], ctx: TripCtx) -> tuple[list[dict], list[dict]]:
    """Course item rows (without order/status/course_id) and the free meal times (FR-11)."""
    rows, gaps = [], []
    for e, s in zip(entries, timeline(entries, by_id, ctx)):
        if e.is_gap:
            start, end = to_hhmm(s.start), to_hhmm(s.end)
            gaps.append({"meal": e.meal, "start_time": start, "end_time": end, "reason": e.gap_reason,
                         "message_en": GAP_MESSAGES[e.gap_reason].format(
                             diet=ctx.profile["diet"], start=start, end=end, meal=e.meal)})
            continue
        rows.append({"place_id": e.place_id, "start_time": to_hhmm(s.start), "stay_min": e.stay_min,
                     "move_method": s.move_method, "move_min": s.move_min, "reason_en": e.reason_en[:300],
                     "is_rest_stop": bool(e.is_rest_stop)})
    return rows, gaps


def schedule(items: list[LLMItem], places_by_id: dict[int, dict], ctx: TripCtx) -> list[dict]:
    """Time a list of stops and drop the ones that break the hard rules (fit_window)."""
    entries = fit_window(to_entries(items, places_by_id), places_by_id, ctx)
    return _rows(entries, places_by_id, ctx)[0]


# --------------------------------------------------------------------------- pipeline
class NoFixedFirst(ApiError):
    """A replan found no place for its fixed first stop."""

    def __init__(self) -> None:
        super().__init__(409, "NO_CANDIDATES", "No places fit right now.")


def _nearest(origin: dict, pool: list[dict]) -> Optional[dict]:
    return min(pool, key=lambda p: route_m(origin, p)) if pool else None


@dataclass
class Prepared:
    base: list[dict]                  # F-1..F-6, F-8, F-10 (ensure_meals' whole-area restaurants)
    cands: list[dict]                 # F-7, F-9
    fixed_first: Optional[dict]


def prepare(places: list[dict], ctx: TripCtx, min_candidates: int) -> Prepared:
    """Steps 1 and 2: filters, the fixed first stop of a replan, the anchor and the candidates."""
    def filtered(level_bonus: int) -> list[dict]:
        ok = base_filter(places, ctx.profile, ctx.exclude_ids, level_bonus=level_bonus)
        return hours_filter(ok, ctx.start_min, ctx.end_min)                           # F-10

    base = filtered(0)
    if len(base) < min_candidates:
        base = filtered(1)

    fixed_first = None
    if ctx.fixed_first_category:
        origin = ctx.origin
        # the fixed first stop must be close enough (start-area FR-9) and open for its whole stay
        # when the traveler gets there (FR-8)
        moves = {p["id"]: ctx.move(origin, p)[1] for p in base}
        open_on_arrival = [p for p in base if moves[p["id"]] <= config.MAX_MOVE_MIN and fits_hours(
            p, round_up5(ctx.start_min + moves[p["id"]]), p["avg_stay_min"])]
        same = [p for p in open_on_arrival if p["category"] == ctx.fixed_first_category]
        fixed_first = _nearest(origin, same) or (_nearest(origin, open_on_arrival) if ctx.fixed_first_any else None)
        if fixed_first is None:
            raise NoFixedFirst()
        ctx.fixed_first_id = fixed_first["id"]

    cands = base
    if not ctx.meals:                                                                 # F-7
        cands = [p for p in cands if p["category"] != "food" or (fixed_first and p["id"] == fixed_first["id"])]
    ctx.anchor = pick_anchor(cands, ctx)                                              # FR-9
    if ctx.origin is None and ctx.anchor is not None:          # tasks/prd-travel-range.md FR-4
        ctx.profile["_hub_id"] = ctx.anchor["id"]
        ctx.profile["_seen_hubs"] = [ctx.anchor["id"]]       # shuffle_course replaces it (FR-5 step 5)
    cands = limit_candidates(cands, ctx.profile["interests"], ctx.meals, ctx.anchor,  # F-9
                             min_candidates, fixed_first)
    return Prepared(base, cands, fixed_first)


def run_pipeline(places: list[dict], ctx: TripCtx, min_candidates: int) -> tuple[list[dict], list[dict]]:
    """10.2 -> 10.6 and P1 8장. `places` are the places of the area. Returns the schedule rows (without
    order/status/course_id) and the free meal times."""
    places_by_id = {p["id"]: p for p in places}
    hungry_meal = None
    prep = prepare(places, ctx, min_candidates)
    fixed_first, cands = prep.fixed_first, prep.cands
    if fixed_first is not None and ctx.fixed_first_category == "food":
        # FR-12: the hungry stop fills the meal whose window (opened an hour early) holds its arrival
        arrive = round_up5(ctx.start_min + ctx.move(ctx.origin, fixed_first)[1])
        hungry_meal = meal_of_arrival(arrive, list(config.MEALS), early_min=60)
        ctx.meals = [m for m in ctx.meals if m != hungry_meal]
    if len(cands) < min_candidates:
        raise ApiError(409, "NO_CANDIDATES", "No places fit these choices.")

    ctx.min_items = max(1, min(ctx.min_items, len(cands)))
    ctx.max_items = max(ctx.min_items, min(ctx.max_items, len(cands)))
    ctx.keep_ids = [i for i in ctx.keep_ids if any(c["id"] == i for c in cands)]
    cands_by_id = {c["id"]: c for c in cands}

    items = None
    if config.USE_LLM:
        llm_input = build_llm_input(cands, ctx, fixed_first["id"] if fixed_first else None)
        for attempt in (1, 2):                                                        # 10.8: one retry
            try:
                items = validate(call_llm(llm_input), cands_by_id, fixed_first)
                break
            except LLMError as e:
                log.warning("LLM attempt %d failed: %s", attempt, e)
        if items is None and not config.LLM_FALLBACK_RULES:
            raise ApiError(502, "LLM_FAILED", "Could not build a plan right now.")
    if items is None:
        items = validate(rule_plan(cands, ctx, fixed_first), cands_by_id, fixed_first)

    entries = fit_window(to_entries(items, places_by_id), places_by_id, ctx)
    if ctx.fixed_first_id is not None and entries[0].place_id != ctx.fixed_first_id:
        ctx.fixed_first_id = None                       # dropped by fit_window: nothing to keep first
    elif hungry_meal is not None:
        entries[0].meal = hungry_meal
    entries = claim_windows(entries, places_by_id, ctx)
    entries = improve_order(entries, places_by_id, ctx)                               # 4
    entries = ensure_meals(entries, places_by_id, ctx, cands, prep.base, places)      # 5
    entries = ensure_rest_stop(entries, places_by_id, ctx, cands, prep.base)
    entries = fit_stays(entries, places_by_id, ctx)                                   # 6, 7
    return _rows(entries, places_by_id, ctx)


def in_area(places: list[dict], area_id: str) -> list[dict]:
    """Start-area FR-5: the first filter. Everything after it only sees the places of one area."""
    return [p for p in places if p.get("area_id") == area_id]


def _course_ctx(profile_in: dict, start: int, end: int, area_id: str, seed: int,
                stats: Optional[dict] = None, avoid: Optional[list[list[dict]]] = None) -> TripCtx:
    profile = {k: profile_in[k] for k in ONBOARDING_KEYS}
    profile["conditions"] = {"indoor_only": False, "low_walking": False}
    profile["start_time"], profile["end_time"] = to_hhmm(start), to_hhmm(end)  # server-owned, like conditions
    profile["area_id"] = area_id
    profile["_seed"] = seed                         # US-P14: never in a response (leading underscore)
    min_items, max_items = item_bounds(end - start)
    return TripCtx(profile=profile, start_min=start, end_min=end, min_items=min_items, max_items=max_items,
                   meals=meals_needed(start, end), rng=random.Random(seed),
                   stats=stats if stats is not None else {}, avoid=list(avoid or []))


def new_course(places: list[dict], profile_in: dict, start_time: str, end_time: str,
               area_id: str = config.DEFAULT_AREA_ID, seed: Optional[int] = None,
               stats: Optional[dict] = None, avoid: Optional[list[list[dict]]] = None) -> tuple[dict, list[dict]]:
    """`area_id` must already be checked (areas.check_area). The API always passes it. Without a seed a
    random one is made (the API never takes one). `stats` gets meal_repaired, hub_count and avoid_level
    (the eval and shuffle_course read them). `avoid`: see TripCtx.avoid (shuffle only).
    The course carries `meal_gaps` (P1 FR-11), stored in courses.meal_gaps."""
    start, end = check_time_window(start_time, end_time)
    seed = new_seed() if seed is None else seed
    ctx = _course_ctx(profile_in, start, end, area_id, seed, stats, avoid)
    rows, gaps = run_pipeline(in_area(places, area_id), ctx, min_candidates=2)
    course_id = str(uuid.uuid4())
    from .store import now_iso
    course = {"id": course_id, "user_profile": ctx.profile, "tier": "free", "created_at": now_iso(),
              "meal_gaps": gaps}
    items = [{"course_id": course_id, "order": n, **r, "status": "current" if n == 1 else "upcoming"}
             for n, r in enumerate(rows, start=1)]
    return course, items


def seen_hubs(profile: dict, items: list[dict], by_id: dict[int, dict]) -> tuple[list[int], Optional[int], list[dict], list[dict]]:
    """tasks/prd-travel-range.md FR-5 step 1 and FR-6: (seen hub ids, the last course's hub id, the seen
    hubs' points, the last hub's points). A course saved before `_seen_hubs`: a v0.2 course's `_hubs` (the
    first is the last hub), else the mean point of its stops, which has no id."""
    ids = [i for i in profile.get("_seen_hubs") or [] if i in by_id]
    prev = profile.get("_hub_id") if profile.get("_hub_id") in by_id else (ids[-1] if ids else None)
    if not ids:
        ids = [h["place_id"] for h in profile.get("_hubs") or [] if h.get("place_id") in by_id]
        prev = prev if prev is not None else (ids[0] if ids else None)
    if not ids and prev is not None:
        ids = [prev]
    if ids:
        return ids, prev, [by_id[i] for i in ids], [by_id[prev]]
    stops = [by_id[i["place_id"]] for i in items if i["place_id"] in by_id]
    if not stops:
        return [], None, [], []
    mid = {"lat": sum(p["lat"] for p in stops) / len(stops), "lng": sum(p["lng"] for p in stops) / len(stops)}
    return [], None, [mid], [mid]


def shuffle_course(places: list[dict], course: dict, items: list[dict]) -> tuple[dict, list[dict]]:
    """US-P15, tasks/prd-travel-range.md FR-5 (P1 FR-20 changed): a new course for the same onboarding,
    area and times in a hub not shown yet. The hub is picked away from every seen hub; when that leaves none
    (the area's hubs were all shown), away from the last course's hub only; when that leaves none either,
    from all hubs. Of SHUFFLE_TRIES new seeds, the one whose candidates share the fewest places with the old
    stops goes first. With the rule planner a course with exactly the old stops is made again with the next
    seed (all tries at most). The new course's `_seen_hubs` carries the seen hubs on (FR-5 step 5)."""
    profile = course["user_profile"]
    if not profile.get("start_time") or not profile.get("end_time"):
        raise ApiError(409, "CANNOT_SHUFFLE", "This plan is too old to shuffle.")
    start, end = check_time_window(profile["start_time"], profile["end_time"])
    area_id = profile.get("area_id") or config.DEFAULT_AREA_ID
    area_places = in_area(places, area_id)
    by_id = {p["id"]: p for p in places}
    old = {i["place_id"] for i in items}
    seen_ids, prev_id, seen_points, prev_points = seen_hubs(profile, items, by_id)
    avoid = [seen_points] + ([prev_points] if prev_points != seen_points else [])
    avoid = [a for a in avoid if a]
    seeds = []
    for n in range(config.SHUFFLE_TRIES):
        seed = new_seed()
        try:
            cands = prepare(area_places, _course_ctx(profile, start, end, area_id, seed, avoid=avoid), 2).cands
            overlap = sum(c["id"] in old for c in cands)
        except ApiError:
            overlap = len(old) + 1
        seeds.append((overlap, n, seed))
    seeds.sort()
    tries = seeds[:1] if config.USE_LLM else seeds
    for n, (_, _, seed) in enumerate(tries):
        stats: dict = {}
        new, new_items = new_course(places, profile, profile["start_time"], profile["end_time"], area_id, seed,
                                    stats=stats, avoid=avoid)
        if {i["place_id"] for i in new_items} != old:
            break
    hub = new["user_profile"].get("_hub_id")
    if stats.get("avoid_level", 0) == 0:
        chain = seen_ids + [hub]
    else:                                         # FR-5 step 3: every hub was shown, start again
        chain = ([prev_id] if prev_id is not None else []) + [hub]
    new["user_profile"]["_seen_hubs"] = list(dict.fromkeys(i for i in chain if i is not None))
    new["tier"] = course["tier"]                  # the purchase is a mock (US-P15)
    return new, new_items


@dataclass
class ReplanResult:
    user_profile: dict
    statuses: dict[int, str]
    delete_orders: list[int]
    new_items: list[dict]
    report_place_id: Optional[int]
    meal_gaps: list[dict] = field(default_factory=list)   # the whole new list for courses.meal_gaps


def _filled_meals(kept: list[dict], gaps: list[dict], by_id: dict[int, dict]) -> set[str]:
    """FR-12: meals a kept restaurant (arriving in the window) or a kept free meal time already fill."""
    done = {g["meal"] for g in gaps}
    for i in kept:
        p = by_id.get(i["place_id"])
        if p is not None and p["category"] == "food":
            m = meal_of_arrival(to_min(i["start_time"]), list(config.MEALS))
            if m:
                done.add(m)
    return done


def _hungry_gap_meal(now: int) -> str:
    """The meal a hungry traveler with no restaurant nearby is eating: the window (up to an hour early)
    holding `now`, else the closest window (the earlier one on a tie)."""
    m = meal_of_arrival(now, list(config.MEALS), early_min=60)
    if m:
        return m

    def dist(meal: str) -> int:
        a0, a1 = meal_window(meal)
        return max(a0 - 60 - now, now - a1, 0)
    return min(config.MEALS, key=lambda meal: (dist(meal), meal_window(meal)[0]))


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

    # US-P08: free meal times that started before the replan stay; later ones are made again
    past_gaps = [g for g in (course.get("meal_gaps") or []) if to_min(g["start_time"]) < start]
    filled = _filled_meals(kept, past_gaps, places_by_id)
    kept_place_ids = {i["place_id"] for i in kept}
    upcoming_ids = [i["place_id"] for i in items if i["order"] > current_order]

    has_fixed = reason in ("closed", "hungry")
    remaining = end_min - start
    new_gaps: list[dict] = []
    if remaining < 30 and not has_fixed:
        new_rows: list[dict] = []
    else:
        ctx = TripCtx(
            profile=profile, start_min=start, end_min=max(end_min, start + 60),
            min_items=1, max_items=max(1, (max(remaining, 60)) // 70),
            meals=[m for m in meals_needed(start, end_min) if m not in filled], origin=cur_place,
            exclude_ids=kept_place_ids | excluded, reason=reason, keep_ids=upcoming_ids,
            fixed_first_category=("food" if reason == "hungry" else cur_place["category"] if reason == "closed" else None),
            fixed_first_any=(reason == "closed"),
            rng=random.Random(int(profile.get("_seed") or 0) + current_order),        # US-P14
        )
        # start-area FR-7: only the course's area. A course saved before areas existed is in jeju-city.
        area_places = in_area(places, profile.get("area_id") or config.DEFAULT_AREA_ID)
        try:
            new_rows, new_gaps = run_pipeline(area_places, ctx, min_candidates=1)
        except NoFixedFirst:
            if reason != "hungry":
                raise
            # US-P08: no restaurant to go to now -> 45 free minutes from now, then the rest of the day
            meal = _hungry_gap_meal(start)
            gap_end = start + config.MEAL_GAP_MIN
            new_gaps = [{"meal": meal, "start_time": to_hhmm(start), "end_time": to_hhmm(gap_end),
                         "reason": "none_nearby", "message_en": GAP_MESSAGES["none_nearby"].format(
                             diet=profile["diet"], start=to_hhmm(start), end=to_hhmm(gap_end), meal=meal)}]
            new_rows = []
            if end_min - gap_end >= 30:
                rest = replace(ctx, start_min=gap_end, end_min=max(end_min, gap_end + 60), fixed_first_category=None,
                               meals=[m for m in meals_needed(gap_end, end_min) if m not in filled and m != meal],
                               fixed_first_id=None, anchor=None, _moves={}, stats={})
                try:
                    new_rows, more = run_pipeline(area_places, rest, min_candidates=1)
                    new_gaps += more
                except ApiError:
                    new_rows = []

    new_items = []
    for n, r in enumerate(new_rows):
        order = first_order + n
        status = "current" if (reason == "closed" and n == 0) else "upcoming"
        new_items.append({"course_id": course["id"], "order": order, **r, "status": status})
    # statuses only for rows we keep
    statuses = {o: s for o, s in statuses.items() if o not in delete_orders}
    return ReplanResult(profile, statuses, delete_orders, new_items, report_place_id,
                        meal_gaps=sorted(past_gaps + new_gaps, key=lambda g: g["start_time"]))
