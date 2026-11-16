"""Recommendation eval (tasks/prd-recommendation-p0.md US-R01, US-R02, FR-1 to FR-4a;
tasks/prd-recommendation-p1.md US-P01, FR-1, FR-2; tasks/prd-travel-range.md US-T01, FR-8).

Builds the same courses every time with planner.new_course and prints quality metrics per area.
Scenario i gets the seed `--seed` x 10000 + i, so the same --seed gives the same courses.

Run (rule planner, all 1,200 scenarios, plus a second seed per scenario for seed_overlap and four shuffles
in a row per scenario for the hub metrics):
    backend/.venv/Scripts/python.exe backend/scripts/eval_planner.py --diversity --shuffle
Run (LLM planner, 30 scenarios, 10 calls a minute):
    backend/.venv/Scripts/python.exe backend/scripts/eval_planner.py --llm --limit 30 --rpm 10

Places come from backend/app/data/places.json and areas from areas.json. Supabase is never used.
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Callable, Optional

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app import areas, config, planner  # noqa: E402
from app.errors import ApiError  # noqa: E402
from app.llm import LLMError  # noqa: E402

# FR-1
INTERESTS = [["nature"], ["culture"], ["cafe", "food"], ["market", "photo"], ["nature", "culture", "cafe"]]
CONDITIONS = ["normal", "tired"]
DIETS = ["none", "vegan"]
# P1 FR-1: two of these have dinner, one has both meals
WINDOWS = [("09:00", "18:00"), ("10:00", "14:00"), ("13:00", "19:00"), ("14:00", "21:00"), ("11:00", "20:00")]
FIXED = {"fitness_level": 2, "max_walk_min": 20, "avoid_slopes": False}

LLM_MAX_LIMIT = 200          # FR-4a
LLM_DEFAULT_LIMIT = 30
MAX_CONSECUTIVE_FAILURES = 3
SHUFFLES = 4                 # travel-range FR-8: a course and four shuffles in a row

METRIC_KEYS = ["success_rate", "lunch_rate", "dinner_rate", "meal_gap_rate", "meal_miss_rate", "diet_meal_rate",
               "cafe_rate", "interest_rate", "same_cat_adj", "taxi_legs", "move_min", "max_leg_min", "spread_km",
               "idle_min", "stretched_min", "id_rank", "distinct_courses", "place_coverage", "seed_overlap",
               "centre_shift_km", "seed_place_coverage", "shuffle_new_hub_rate", "shuffle_hub_variety"]
RATE_KEYS = {"success_rate", "lunch_rate", "dinner_rate", "meal_gap_rate", "meal_miss_rate", "diet_meal_rate",
             "cafe_rate", "interest_rate", "same_cat_adj", "place_coverage", "meal_repaired", "seed_place_coverage",
             "shuffle_new_hub_rate", "shuffle_hub_variety"}


@dataclass
class Scenario:
    area_id: str
    profile: dict
    start_time: str
    end_time: str


@dataclass
class Run:
    scenario: Scenario
    items: Optional[list[dict]] = None     # course items from new_course, or None on error
    error: Optional[str] = None            # ApiError code
    meal_gaps: list[dict] = field(default_factory=list)   # course["meal_gaps"] (P1 FR-11)
    seed: Optional[int] = None
    alt_items: Optional[list[dict]] = None  # --diversity: the same scenario with seed + 1
    repaired: int = 0                      # --llm: meals ensure_meals had to fill (P1 FR-2 meal_repaired)
    hub_count: int = 0                     # hubs find_hubs found for the first course (travel-range FR-8)
    hub_chain: list[int] = field(default_factory=list)   # --shuffle: _hub_id of the course and each shuffle


def scenarios(area_ids: list[str]) -> list[Scenario]:
    """FR-1: area (sort_order) -> profile -> window."""
    out = []
    for area_id in area_ids:
        for interests in INTERESTS:
            for cond in CONDITIONS:
                for diet in DIETS:
                    profile = {"interests": list(interests), "condition_today": cond, "diet": diet, **FIXED}
                    for start, end in WINDOWS:
                        out.append(Scenario(area_id, profile, start, end))
    return out


def pick(items: list, limit: Optional[int]) -> list:
    """US-R02: N items, one every len/N, always the same ones."""
    if limit is None or limit >= len(items):
        return list(items)
    return [items[i * len(items) // limit] for i in range(limit)]


# --------------------------------------------------------------------------- metrics (FR-3)
def _mean(xs: list[float]) -> Optional[float]:
    return sum(xs) / len(xs) if xs else None


def _round(v):
    return round(v, 4) if isinstance(v, float) else v


def metrics(runs: list[Run], places_by_id: dict[int, dict], area_places: dict[str, list[dict]]) -> dict:
    """FR-3 over `runs`. `area_places` holds every place of the areas these runs are in (for id_rank and
    place_coverage). Averages over no runs are None."""
    rank: dict[int, float] = {}
    for ps in area_places.values():
        ids = sorted(p["id"] for p in ps)
        for n, pid in enumerate(ids):
            rank[pid] = n / (len(ids) - 1) if len(ids) > 1 else 0.5

    ok = [r for r in runs if r.items is not None]
    cafe_runs = [r for r in ok if "cafe" in r.scenario.profile["interests"] or r.scenario.profile["condition_today"] == "tired"]

    def cats(r: Run) -> list[str]:
        return [places_by_id[i["place_id"]]["category"] for i in r.items]

    def needed(r: Run) -> list[str]:
        return planner.meals_needed(planner.to_min(r.scenario.start_time), planner.to_min(r.scenario.end_time))

    def has_food(r: Run, meal: str) -> bool:
        """P1 FR-6: a food stop that arrives inside the meal's arrival window."""
        a0, a1 = planner.meal_window(meal)
        return any(places_by_id[i["place_id"]]["category"] == "food" and a0 <= planner.to_min(i["start_time"]) <= a1
                   for i in r.items)

    def has_gap(r: Run, meal: str) -> bool:
        return any(g["meal"] == meal for g in r.meal_gaps)

    def meal_rate(meal: str) -> Optional[float]:
        return _mean([float(has_food(r, meal)) for r in ok
                      if r.scenario.profile["diet"] == "none" and meal in needed(r)])

    meals = [(r, m) for r in ok for m in needed(r)]
    vegan_meals = [(r, m) for r, m in meals if r.scenario.profile["diet"] == "vegan"]

    interest, taxi, move, spread, idle, stretched, ranks = [], [], [], [], [], [], []
    same_pairs = all_pairs = 0
    max_leg = 0
    seen_courses, seen_places = set(), set()
    for r in ok:
        items = r.items
        stops = [places_by_id[i["place_id"]] for i in items]
        interest.append(sum(c in r.scenario.profile["interests"] for c in cats(r)) / len(items))
        taxi.append(sum(i["move_method"] == "taxi" for i in items))
        moves = [i["move_min"] or 0 for i in items]
        move.append(sum(moves))
        max_leg = max([max_leg] + moves)
        spread.append(max((planner.haversine_m(a["lat"], a["lng"], b["lat"], b["lng"]) / 1000
                           for n, a in enumerate(stops) for b in stops[n + 1:]), default=0.0))
        trip = planner.to_min(r.scenario.end_time) - planner.to_min(r.scenario.start_time)
        gaps = sum(planner.to_min(g["end_time"]) - planner.to_min(g["start_time"]) for g in r.meal_gaps)
        idle.append(trip - sum(i["stay_min"] for i in items) - sum(moves) - gaps)
        stretched.append(sum(i["stay_min"] for i in items) - sum(p["avg_stay_min"] for p in stops))
        c = cats(r)
        same_pairs += sum(a == b for a, b in zip(c, c[1:]))
        all_pairs += len(c) - 1
        ranks.extend(rank[p["id"]] for p in stops)
        seen_courses.add((r.scenario.area_id, tuple(i["place_id"] for i in items)))
        seen_places.update(p["id"] for p in stops)

    overlaps, shifts, seed_places = [], [], set()
    for r in ok:
        if r.alt_items is not None:
            a, b = {i["place_id"] for i in r.items}, {i["place_id"] for i in r.alt_items}
            overlaps.append(len(a & b) / len(a | b) if a | b else 1.0)
            shifts.append(centre_km(r.items, r.alt_items, places_by_id))
            seed_places |= a | b

    # travel-range FR-8: shuffles in a row. A move to a new hub = the hub centre is more than
    # HUB_SEPARATION_KM from the last one. Scenarios with one hub do not count for the first metric.
    new_hub, variety = [], []
    for r in ok:
        chain = [places_by_id[h] for h in r.hub_chain if h in places_by_id]
        if len(chain) < 2:
            continue
        if r.hub_count >= 2:
            new_hub += [float(planner.km_between(a, b) > config.HUB_SEPARATION_KM) for a, b in zip(chain, chain[1:])]
        variety.append(min(1.0, len({p["id"] for p in chain}) / min(len(chain), max(r.hub_count, 1))))

    total_places = sum(len(ps) for ps in area_places.values())
    out = {
        "runs": len(runs),
        "success_rate": len(ok) / len(runs) if runs else None,
        "lunch_rate": meal_rate("lunch"),
        "dinner_rate": meal_rate("dinner"),
        "meal_gap_rate": _mean([float(has_gap(r, m)) for r, m in meals]),
        "meal_gap_rate_none": _mean([float(has_gap(r, m)) for r, m in meals if r.scenario.profile["diet"] == "none"]),
        "meal_miss_rate": _mean([float(not has_food(r, m) and not has_gap(r, m)) for r, m in meals]),
        "diet_meal_rate": _mean([float(has_food(r, m)) for r, m in vegan_meals]),
        "cafe_rate": _mean([float("cafe" in cats(r)) for r in cafe_runs]),
        "interest_rate": _mean(interest),
        "same_cat_adj": same_pairs / all_pairs if all_pairs else None,
        "taxi_legs": _mean(taxi),
        "move_min": _mean(move),
        "max_leg_min": max_leg,
        "spread_km": _mean(spread),
        "idle_min": _mean(idle),
        "stretched_min": _mean(stretched),
        "id_rank": _mean(ranks),
        "distinct_courses": len(seen_courses),
        "place_coverage": len(seen_places) / total_places if total_places else None,
        "places_used": len(seen_places),
        "places_total": total_places,
        "seed_overlap": _mean(overlaps),
        "centre_shift_km": _mean(shifts),
        "seed_place_coverage": len(seed_places) / total_places if shifts and total_places else None,
        "shuffle_new_hub_rate": _mean(new_hub),
        "shuffle_hub_variety": _mean(variety),
    }
    return {k: _round(v) for k, v in out.items()}


def centre_km(a: list[dict], b: list[dict], places_by_id: dict[int, dict]) -> float:
    """travel-range FR-8 centre_shift_km of one scenario: straight-line km between the mean points of two
    courses."""
    def centre(items: list[dict]) -> dict:
        stops = [places_by_id[i["place_id"]] for i in items]
        return {"lat": sum(p["lat"] for p in stops) / len(stops), "lng": sum(p["lng"] for p in stops) / len(stops)}
    return planner.km_between(centre(a), centre(b))


def summarize(runs: list[Run], places: list[dict], area_ids: list[str]) -> dict:
    by_id = {p["id"]: p for p in places}
    area_places = {a: [p for p in places if p.get("area_id") == a] for a in area_ids}
    by_area = {}
    for a in area_ids:
        mine = [r for r in runs if r.scenario.area_id == a]
        if mine:
            by_area[a] = metrics(mine, by_id, {a: area_places[a]})
    return {"by_area": by_area, "overall": metrics(runs, by_id, area_places)}


# --------------------------------------------------------------------------- LLM guard (US-R02, FR-4a)
class EvalAborted(Exception):
    """Stops the eval at once. Not an LLMError, so run_pipeline does not retry it."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


@dataclass
class LLMGuard:
    """Wraps planner.call_llm: keeps call starts at least 60/rpm seconds apart, counts calls and time,
    and turns 429 / quota errors / 3 failures in a row into EvalAborted."""
    call: Callable
    rpm: int
    clock: Callable[[], float] = time.monotonic
    sleep: Callable[[float], None] = time.sleep
    calls: int = 0
    latencies: list[float] = field(default_factory=list)
    failures_in_a_row: int = 0
    _last_start: Optional[float] = None

    def __call__(self, llm_input: dict):
        gap = 60.0 / self.rpm
        if self._last_start is not None:
            wait = self._last_start + gap - self.clock()
            if wait > 0:
                self.sleep(wait)
        start = self.clock()
        self._last_start = start
        self.calls += 1
        try:
            out = self.call(llm_input)
        except LLMError as e:
            self.latencies.append(self.clock() - start)
            if getattr(e, "quota", False):
                raise EvalAborted("quota") from e
            if getattr(e, "status", None) == 429:
                raise EvalAborted("rate_limit") from e
            self.failures_in_a_row += 1
            if self.failures_in_a_row >= MAX_CONSECUTIVE_FAILURES:
                raise EvalAborted("consecutive_failures") from e
            raise
        self.latencies.append(self.clock() - start)
        self.failures_in_a_row = 0
        return out


# --------------------------------------------------------------------------- main
def git_commit() -> Optional[str]:
    try:
        return subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=BACKEND, capture_output=True,
                              text=True, check=True).stdout.strip() or None
    except (OSError, subprocess.CalledProcessError):
        return None


def _fmt(key: str, v) -> str:
    if v is None:
        return "-"
    if key in RATE_KEYS:
        return f"{v * 100:.0f}%"
    if isinstance(v, float):
        return f"{v:.2f}"
    return str(v)


def markdown(result: dict) -> str:
    head = "| area | runs | " + " | ".join(METRIC_KEYS) + " |"
    lines = [head, "|" + "---|" * (len(METRIC_KEYS) + 2)]
    rows = list(result["by_area"].items()) + [("**overall**", result["overall"])]
    for name, m in rows:
        lines.append(f"| {name} | {m['runs']} | " + " | ".join(_fmt(k, m[k]) for k in METRIC_KEYS) + " |")
    return "\n".join(lines)


def parse_args(argv: Optional[list[str]]) -> argparse.Namespace:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--weekday", default="wed", choices=planner.WEEKDAYS)
    ap.add_argument("--llm", action="store_true", help="use the LLM planner (no rule fallback)")
    ap.add_argument("--limit", type=int, default=None, help="run N of the scenarios (LLM: default 30, at most 200)")
    ap.add_argument("--rpm", type=int, default=10, help="LLM calls a minute (default 10)")
    ap.add_argument("--label", default=None, help="default: rules, or llm-<model> with --llm")
    ap.add_argument("--out", default=None, help="default: backend/eval/<label>.json")
    ap.add_argument("--seed", type=int, default=1, help="scenario i gets the seed SEED x 10000 + i (default 1)")
    ap.add_argument("--diversity", action="store_true",
                    help="also build every scenario with seed + 1 and report seed_overlap (twice the runs)")
    ap.add_argument("--shuffle", action="store_true",
                    help=f"also shuffle every course {SHUFFLES} times in a row and report the hub metrics (rules only)")
    return ap.parse_args(argv)


def main(argv: Optional[list[str]] = None, *, clock: Callable[[], float] = time.monotonic,
         sleep: Callable[[float], None] = time.sleep) -> int:
    args = parse_args(argv)
    limit = args.limit
    if args.llm:
        limit = LLM_DEFAULT_LIMIT if limit is None else limit
        if limit > LLM_MAX_LIMIT:
            print(f"ERROR: --limit {limit} is more than {LLM_MAX_LIMIT} for --llm. No LLM call was made.")
            return 2
        if not config.LLM_API_KEY:
            print("ERROR: --llm needs LLM_API_KEY (or GEMINI_API_KEY) in backend/.env")
            return 2
        if args.rpm <= 0:
            print("ERROR: --rpm must be 1 or more")
            return 2
    if limit is not None and limit <= 0:
        print("ERROR: --limit must be 1 or more")
        return 2
    if args.llm and args.shuffle:
        print("ERROR: --shuffle runs the rule planner only. No LLM call was made.")
        return 2

    label = args.label or (f"llm-{config.LLM_MODEL}" if args.llm else "rules")
    out_path = Path(args.out) if args.out else BACKEND / "eval" / f"{label}.json"

    places = json.loads((config.SEED_DATA_DIR / "places.json").read_text(encoding="utf-8"))
    area_ids = [a["id"] for a in areas.summaries(areas.load_seed_areas(), places) if a["selectable"]]
    all_scenarios = scenarios(area_ids)
    todo = pick(list(range(len(all_scenarios))), limit)     # scenario indexes: the seed follows the index

    saved = (config.USE_LLM, config.LLM_FALLBACK_RULES, planner.today_kst_dow, planner.call_llm, planner.new_seed)
    guard = None
    config.USE_LLM = args.llm
    planner.today_kst_dow = lambda: args.weekday
    if args.llm:
        config.LLM_FALLBACK_RULES = False
        guard = LLMGuard(call=saved[3], rpm=args.rpm, clock=clock, sleep=sleep)
        planner.call_llm = guard
        print(f"LLM calls: up to {limit * 2} ({limit} scenarios, 1 retry each), {args.rpm} per minute")

    def build(sc: Scenario, seed: int, stats: Optional[dict] = None) -> tuple[dict, list[dict]]:
        return planner.new_course(places, sc.profile, sc.start_time, sc.end_time, area_id=sc.area_id,
                                  seed=seed, stats=stats)

    def hub_chain(course: dict, items: list[dict], seed: int) -> list[int]:
        """travel-range FR-8: the course's _hub_id, then the _hub_id of each of SHUFFLES shuffles in a row.
        new_seed gives seed x 100 + 1, 2, ... so the same --seed gives the same shuffles."""
        counter = iter(range(seed * 100 + 1, seed * 100 + 100))
        planner.new_seed = lambda: next(counter)
        chain = [course["user_profile"].get("_hub_id")]
        for _ in range(SHUFFLES):
            try:
                course, items = planner.shuffle_course(places, course, items)
            except ApiError:
                break
            chain.append(course["user_profile"].get("_hub_id"))
        return chain

    runs: list[Run] = []
    abort_reason = None
    try:
        for i in todo:
            sc, seed = all_scenarios[i], args.seed * 10000 + i
            stats: dict = {}
            try:
                course, items = build(sc, seed, stats)
                run = Run(sc, items=items, meal_gaps=course.get("meal_gaps") or [], seed=seed,
                          repaired=stats.get("meal_repaired", 0), hub_count=stats.get("hub_count", 0))
            except ApiError as e:
                run = Run(sc, error=e.detail["code"], seed=seed)
            if args.diversity and run.items is not None:
                try:
                    run.alt_items = build(sc, seed + 1)[1]
                except ApiError:
                    pass
            if args.shuffle and run.items is not None:
                run.hub_chain = hub_chain(course, items, seed)
            runs.append(run)
    except EvalAborted as e:
        abort_reason = e.reason
    finally:
        (config.USE_LLM, config.LLM_FALLBACK_RULES, planner.today_kst_dow, planner.call_llm,
         planner.new_seed) = saved

    summary = summarize(runs, places, area_ids)
    result = {
        "date": date.today().isoformat(),
        "commit": git_commit(),
        "label": label,
        "weekday": args.weekday,
        "planner": "llm" if args.llm else "rules",
        "model": config.LLM_MODEL if args.llm else None,
        "scenarios": len(todo),
        "seed": args.seed,
        "diversity": args.diversity,
        "shuffle": args.shuffle,
        "areas": area_ids,
        **summary,
    }
    if args.llm:
        needed = sum(len(planner.meals_needed(planner.to_min(r.scenario.start_time), planner.to_min(r.scenario.end_time)))
                     for r in runs if r.items is not None)
        result["overall"]["meal_repaired"] = _round(sum(r.repaired for r in runs) / needed) if needed else None
        result.update({
            "limit": limit,
            "rpm": args.rpm,
            "llm_calls": guard.calls,
            "llm_failed": _round(sum(r.error == "LLM_FAILED" for r in runs) / len(runs)) if runs else None,
            "latency_sec": _round(_mean(guard.latencies)),
            "scenarios_done": len(runs),
            "aborted": abort_reason is not None,
            "abort_reason": abort_reason,
        })

    print(markdown(result))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nsaved {out_path}")
    if abort_reason:
        print(f"ABORTED after {len(runs)} scenarios: {abort_reason}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
