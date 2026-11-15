"""tasks/prd-recommendation-p1.md: meals (US-P02 to US-P09), score and order (US-P10, US-P11), stay times
(US-P12, US-P13) and variety (US-P14, US-P15). Offline: the seed file or made-up places, no LLM, no Supabase."""
from __future__ import annotations

import copy
import random
import sys

import pytest

from app import config, course_view, llm, planner
from app.schemas import LLMCourse, LLMItem

from conftest import BACKEND
from test_start_area import made_place

sys.path.insert(0, str(BACKEND / "scripts"))
import build_places  # noqa: E402

KM_LAT = 1 / 111.0
NONE = {"interests": ["nature", "culture"], "fitness_level": 2, "max_walk_min": 20, "avoid_slopes": False,
        "condition_today": "normal", "diet": "none"}
VEGAN = dict(NONE, diet="vegan")


def at(pid: int, category: str, km_north: float, km_east: float = 0.0, area: str = "aewol", **kw) -> dict:
    p = made_place(pid, area, category, lat=33.40 + km_north * KM_LAT, lng=126.30 + km_east * KM_LAT * 1.2)
    p.update(kw)
    return p


def mins(hhmm: str) -> int:
    return planner.to_min(hhmm)


def meal_ok(items: list[dict], gaps: list[dict], by_id: dict, meal: str) -> int:
    """How many restaurants arriving in the meal's window plus free times for it (FR-6, FR-11)."""
    a0, a1 = planner.meal_window(meal)
    food = sum(by_id[i["place_id"]]["category"] == "food" and a0 <= mins(i["start_time"]) <= a1 for i in items)
    return food + sum(g["meal"] == meal for g in gaps)


def ctx_for(start: str, end: str, profile=NONE, **kw) -> planner.TripCtx:
    s, e = mins(start), mins(end)
    prof = dict(profile, conditions={"indoor_only": False, "low_walking": False})
    return planner.TripCtx(profile=prof, start_min=s, end_min=e, min_items=1, max_items=8,
                           meals=planner.meals_needed(s, e), **kw)


# ----------------------------------------------------------------------------- US-P02 meals needed
@pytest.mark.parametrize("start, end, meals", [
    ("09:00", "18:00", ["lunch"]), ("13:00", "19:00", ["dinner"]), ("11:00", "20:00", ["lunch", "dinner"]),
    ("12:30", "14:30", ["lunch"]), ("13:00", "17:00", []), ("16:00", "18:30", ["dinner"]), ("08:00", "12:00", []),
])
def test_meals_needed(start, end, meals):
    assert planner.meals_needed(mins(start), mins(end)) == meals


def test_lunch_window_helpers_are_gone():
    assert not hasattr(planner, "window_has_lunch") and not hasattr(config, "LUNCH_WINDOW")
    assert config.MEALS["dinner"] == {"core": ("18:00", "19:00"), "arrive": ("17:30", "19:30")}


# ----------------------------------------------------------------------------- US-P03 candidates per meal
def test_restaurant_opening_at_1600_is_a_dinner_candidate_only():
    anchor = at(1, "nature", 0)
    late = at(2, "food", 0.5, open_time="16:00", close_time="22:00")
    early = at(3, "food", 0.6, open_time="10:00", close_time="15:00")
    # 24 closer places fill every other seat, so a restaurant gets in only through its meal quota (FR-7)
    others = [at(10 + n, ("nature", "culture", "photo")[n % 3], 0.4 * n / 24) for n in range(24)]
    pool = [anchor, late, early] + others
    ids = lambda meals: {p["id"] for p in planner.limit_candidates(pool, ["nature"], meals, anchor, 2)
                         if p["category"] == "food"}
    assert ids(["lunch", "dinner"]) == {2, 3}
    assert ids(["lunch"]) == {3} and ids(["dinner"]) == {2}
    assert ids([]) == set()


def test_food_is_dropped_only_without_meals(places):
    _, items = planner.new_course(places, NONE, "13:00", "17:00", "jeju-city")
    by_id = {p["id"]: p for p in places}
    assert not any(by_id[i["place_id"]]["category"] == "food" for i in items)


# ----------------------------------------------------------------------------- US-P04 rule planner, two meals
def test_rule_planner_puts_lunch_and_dinner_in_their_windows(places, by_id):
    course, items = planner.new_course(places, NONE, "11:00", "20:00", "jeju-city", seed=7)
    food = [i for i in items if by_id[i["place_id"]]["category"] == "food"]
    assert course["meal_gaps"] == []
    assert len(food) == 2 and food[0]["place_id"] != food[1]["place_id"]
    assert mins("11:30") <= mins(food[0]["start_time"]) <= mins("13:30")
    assert mins("17:30") <= mins(food[1]["start_time"]) <= mins("19:30")


# ----------------------------------------------------------------------------- US-P05 ensure_meals
def test_llm_that_leaves_lunch_out_gets_a_restaurant(places, by_id, monkeypatch):
    def fake(llm_input):
        ids = [c["id"] for c in llm_input["candidates"] if c["category"] != "food" and c["open_time"] is None]
        return LLMCourse(items=[LLMItem(place_id=i, order=n, stay_min=45, reason_en="ok")
                                for n, i in enumerate(ids[:4], start=1)])
    monkeypatch.setattr(config, "USE_LLM", True)
    monkeypatch.setattr(planner, "call_llm", fake)
    stats: dict = {}
    course, items = planner.new_course(places, NONE, "10:00", "15:00", "jeju-city", stats=stats)
    assert meal_ok(items, course["meal_gaps"], by_id, "lunch") == 1
    assert any(by_id[i["place_id"]]["category"] == "food" for i in items)
    assert stats["meal_repaired"] == 1


def test_no_restaurant_at_all_gives_a_none_nearby_free_time():
    ps = [at(n, "culture", 0.2 * n) for n in range(1, 9)]
    course, items = planner.new_course(ps, NONE, "10:00", "15:00", "aewol")
    gaps = course["meal_gaps"]
    assert [(g["meal"], g["reason"]) for g in gaps] == [("lunch", "none_nearby")]
    assert mins("11:30") <= mins(gaps[0]["start_time"]) <= mins("13:30")
    assert mins(gaps[0]["end_time"]) - mins(gaps[0]["start_time"]) == 45
    assert gaps[0]["message_en"] == (f"No restaurant we know is open near your stops at this time, so we kept "
                                     f"{gaps[0]['start_time']}–{gaps[0]['end_time']} free for lunch.")
    # the stop after the free time is timed from the stop before it
    for i in items:
        assert not (mins(gaps[0]["start_time"]) <= mins(i["start_time"]) < mins(gaps[0]["end_time"]))


def test_vegan_without_a_vegan_restaurant_gives_no_diet_match():
    ps = [at(n, "culture", 0.2 * n) for n in range(1, 9)] + [at(20, "food", 0.3), at(21, "food", 0.5)]
    course, _ = planner.new_course(ps, VEGAN, "11:00", "20:00", "aewol")
    gaps = course["meal_gaps"]
    assert [(g["meal"], g["reason"]) for g in gaps] == [("lunch", "no_diet_match"), ("dinner", "no_diet_match")]
    assert gaps[0]["message_en"].startswith("We couldn't find a vegan-friendly restaurant in this area, so we kept ")
    assert gaps[1]["message_en"].endswith(" free for dinner.")


def test_every_eval_scenario_has_exactly_one_restaurant_or_free_time_per_meal(places, by_id, monkeypatch):
    import eval_planner as ev
    from app import areas
    monkeypatch.setattr(planner, "today_kst_dow", lambda: "wed")
    area_ids = [a["id"] for a in areas.summaries(areas.load_seed_areas(), places) if a["selectable"]]
    for n, sc in enumerate(ev.scenarios(area_ids)):
        course, items = planner.new_course(places, sc.profile, sc.start_time, sc.end_time, sc.area_id,
                                           seed=10000 + n)
        for meal in planner.meals_needed(mins(sc.start_time), mins(sc.end_time)):
            assert meal_ok(items, course["meal_gaps"], by_id, meal) == 1, (n, meal)
        assert all((i["move_min"] or 0) <= config.MAX_MOVE_MIN for i in items)


# ----------------------------------------------------------------------------- US-P06 store and API
class FakeStore:
    """In memory, same methods as SupabaseStore."""

    def __init__(self, places: list[dict]):
        from app import areas
        self.places, self.areas_rows = places, areas.load_seed_areas()
        self.courses: dict[str, dict] = {}
        self.items: dict[str, list[dict]] = {}

    def list_places(self): return copy.deepcopy(self.places)
    def list_areas(self): return copy.deepcopy(self.areas_rows)
    def list_phrase_cards(self): return []
    def get_course(self, cid): return copy.deepcopy(self.courses.get(cid))
    def get_items(self, cid): return sorted(copy.deepcopy(self.items.get(cid, [])), key=lambda i: i["order"])

    def create_course(self, course, items):
        self.courses[course["id"]] = copy.deepcopy(course)
        self.items[course["id"]] = copy.deepcopy(items)

    def apply_replan(self, cid, user_profile, statuses, delete_orders, new_items, report_place_id, meal_gaps=None):
        kept = [dict(i, status=statuses.get(i["order"], i["status"])) for i in self.items[cid]
                if i["order"] not in delete_orders]
        self.items[cid] = kept + copy.deepcopy(new_items)
        self.courses[cid]["user_profile"] = user_profile
        if meal_gaps is not None:
            self.courses[cid]["meal_gaps"] = meal_gaps

    def set_tier(self, cid, tier): self.courses[cid]["tier"] = tier


@pytest.fixture()
def api(places, monkeypatch):
    from fastapi.testclient import TestClient

    from app import main, store
    fake = FakeStore(places)
    monkeypatch.setattr(store, "_store", fake)
    monkeypatch.setattr(main, "get_store", lambda: fake)
    return TestClient(main.app), fake


def body(profile, area="pyoseon", start="11:00", end="20:00") -> dict:
    return {"user_profile": profile, "area_id": area, "start_time": start, "end_time": end}


def test_vegan_course_meal_gaps_come_back_the_same(api):
    client, fake = api
    r = client.post("/courses", json=body(VEGAN))
    assert r.status_code == 201
    course = r.json()
    last = course["items"][-1]
    assert course["locked_count"] > 0                       # free: only gaps before the 3rd stop ends
    assert all(mins(g["start_time"]) < mins(last["start_time"]) + last["stay_min"] for g in course["meal_gaps"])
    client.post("/purchase", json={"course_id": course["id"]})
    again = client.get(f"/courses/{course['id']}").json()
    assert [g["meal"] for g in again["meal_gaps"]] == ["lunch", "dinner"]
    assert again["meal_gaps"] == fake.courses[course["id"]]["meal_gaps"]
    assert set(again["meal_gaps"][0]) == {"meal", "start_time", "end_time", "reason", "message_en"}
    assert "_seed" not in again["user_profile"]


def test_free_course_hides_free_times_after_the_last_visible_stop():
    items = [{"order": n, "place_id": n, "start_time": t, "stay_min": 60, "move_method": None, "move_min": None,
              "reason_en": "x", "is_rest_stop": False, "status": "upcoming"}
             for n, t in enumerate(["10:00", "11:00", "12:45", "15:00"], start=1)]
    places = [made_place(n, "aewol") for n in range(1, 5)]
    gaps = [{"meal": "lunch", "start_time": "12:00", "end_time": "12:45"},
            {"meal": "dinner", "start_time": "18:00", "end_time": "18:45"}]
    course = {"id": "c", "tier": "free", "created_at": "x", "user_profile": NONE, "meal_gaps": gaps}
    assert [g["meal"] for g in course_view.build_course(course, items, places, [])["meal_gaps"]] == ["lunch"]
    course["tier"] = "premium"
    assert len(course_view.build_course(course, items, places, [])["meal_gaps"]) == 2
    old = {"id": "c", "tier": "free", "created_at": "x", "user_profile": NONE}       # saved before P1
    assert course_view.build_course(old, items, places, [])["meal_gaps"] == []


def test_schema_and_types_have_meal_gaps_and_place_type():
    sql = (BACKEND / "sql" / "schema.sql").read_text(encoding="utf-8")
    assert "alter table courses add column if not exists meal_gaps jsonb not null default '[]'::jsonb;" in sql
    assert "alter table places add column if not exists place_type text;" in sql
    ts = (BACKEND.parent / "frontend" / "lib" / "types.ts").read_text(encoding="utf-8")
    assert "export type MealGap" in ts and "meal_gaps: MealGap[];" in ts and "place_type: string | null;" in ts


# ----------------------------------------------------------------------------- US-P08 replan
def test_rain_after_lunch_keeps_lunch_and_adds_dinner(places, by_id):
    course, items = planner.new_course(places, NONE, "11:00", "20:00", "jeju-city", seed=3)
    lunch = next(i for i in items if by_id[i["place_id"]]["category"] == "food")
    res = planner.replan(places, course, items, "rain", lunch["order"])
    new_food = [i for i in res.new_items if by_id[i["place_id"]]["category"] == "food"]
    assert not any(mins(i["start_time"]) <= mins("13:30") for i in new_food)
    assert meal_ok(res.new_items, res.meal_gaps, by_id, "dinner") == 1


def test_hungry_at_1630_counts_as_dinner(places, by_id):
    here = next(p for p in places if p["area_id"] == "jeju-city" and p["category"] == "culture"
                and p["open_time"] is None and p["accessibility"]["indoor"])
    profile = dict(NONE, conditions={"indoor_only": False, "low_walking": False}, start_time="11:00",
                   end_time="20:00", area_id="jeju-city", _seed=5)
    course = {"id": "c", "user_profile": profile, "tier": "premium", "created_at": "x", "meal_gaps": []}
    items = [{"course_id": "c", "order": 1, "place_id": here["id"], "start_time": "15:45", "stay_min": 45,
              "move_method": None, "move_min": None, "reason_en": "x", "is_rest_stop": False, "status": "current"}]
    res = planner.replan(places, course, items, "hungry", 1)
    first = res.new_items[0]
    assert by_id[first["place_id"]]["category"] == "food" and mins(first["start_time"]) < mins("17:30")
    assert not any(by_id[i["place_id"]]["category"] == "food" for i in res.new_items[1:])
    assert res.meal_gaps == []


def test_replan_keeps_past_free_times_and_remakes_later_ones():
    ps = [at(n, "culture", 0.2 * n) for n in range(1, 12)]
    course, items = planner.new_course(ps, NONE, "11:00", "20:00", "aewol")
    assert [g["meal"] for g in course["meal_gaps"]] == ["lunch", "dinner"]
    after_lunch = next(i for i in items if mins(i["start_time"]) > mins(course["meal_gaps"][0]["end_time"]))
    res = planner.replan(ps, course, items, "tired", after_lunch["order"])
    assert res.meal_gaps[0] == course["meal_gaps"][0]
    assert [g["meal"] for g in res.meal_gaps] == ["lunch", "dinner"]


# ----------------------------------------------------------------------------- US-P09 LLM input
def test_llm_input_has_meals_evening_spot_and_stay_range():
    c = ctx_for("11:00", "20:00")
    p = at(1, "nature", 0, description_en="Best at sunset.", place_type="oreum_hike", avg_stay_min=75)
    c.anchor = p
    inp = planner.build_llm_input([p], c, None)
    assert inp["trip"]["meals"] == [{"meal": "lunch", "arrive_from": "11:30", "arrive_by": "13:30"},
                                    {"meal": "dinner", "arrive_from": "17:30", "arrive_by": "19:30"}]
    assert "needs_lunch" not in inp["trip"]
    cand = inp["candidates"][0]
    assert (cand["evening_spot"], cand["min_stay_min"], cand["max_stay_min"]) == (True, 60, 90)


def test_prompt_has_the_p1_rules():
    assert ('5. For each item in trip.meals, include exactly one place whose category is "food", arriving between '
            'its arrive_from and arrive_by. Use a different food place for each meal. Do not add food places at '
            'other times.') in llm.SYSTEM_PROMPT
    assert "Avoid two stops of the same category in a row when there is another choice." in llm.SYSTEM_PROMPT
    assert 'Visit places with "evening_spot": true at 16:30 or later when the trip allows it.' in llm.SYSTEM_PROMPT
    assert ("11. Choose stay_min between the candidate's min_stay_min and max_stay_min. Use avg_stay_min unless "
            "the trip has spare time or is short.") in llm.SYSTEM_PROMPT


# ----------------------------------------------------------------------------- US-P10 score
def test_nature_does_not_come_three_times_in_a_row():
    # a ring 0.5 km around the anchor: nature and culture at the same distance, taken in turn
    ring = [at(10 + n, "nature" if n % 2 else "culture", 0.5 * (n % 3 - 1), 0.5 * (n // 3 - 1)) for n in range(9)]
    anchor = at(1, "nature", 0)
    c = ctx_for("09:00", "11:00", dict(NONE, interests=["nature"]))
    c.max_items, c.meals, c.anchor = 6, [], anchor
    c.end_min = mins("18:00")
    out = planner.rule_plan([anchor] + ring, c, None)
    cats = [next(p for p in [anchor] + ring if p["id"] == i.place_id)["category"] for i in out.items]
    assert len(cats) >= 4
    assert not any(a == b == d == "nature" for a, b, d in zip(cats, cats[1:], cats[2:])), cats


@pytest.mark.parametrize("text, yes", [("Watch the sunset here", True), ("NIGHT VIEW of the port", True),
                                       ("The bridge is lit up", True), ("Illuminated at dusk", True),
                                       ("Famous for the sunrise", False), ("A nice evening stroll", False)])
def test_evening_words(text, yes):
    assert planner.is_evening_spot(at(abs(hash(text)) % 10000 + 100, "photo", 0, description_en=text)) is yes


def test_evening_spot_goes_in_after_1630():
    # six close photo stops north of the start, the sunset spot 0.3 km south: farther, so it waits for its bonus
    others = [at(10 + n, "photo", 0.05 * n) for n in range(6)]
    sunset = at(99, "photo", -0.3, description_en="The best sunset on the coast.")
    c = ctx_for("14:00", "19:00", dict(NONE, interests=["photo"]))
    c.meals, c.anchor = [], others[0]
    out = planner.rule_plan(others + [sunset], c, None)
    entries = planner.to_entries(planner.validate(out, {p["id"]: p for p in others + [sunset]}, None),
                                 {p["id"]: p for p in others + [sunset]})
    slots = planner.timeline(entries, {p["id"]: p for p in others + [sunset]}, c)
    at_sunset = [s.start for e, s in zip(entries, slots) if e.place_id == 99]
    assert at_sunset and at_sunset[0] >= mins("16:30")


def test_tired_traveler_gets_a_rest_cafe(places, by_id):
    tired = dict(NONE, condition_today="tired", interests=["culture"])
    for seed in range(5):
        _, items = planner.new_course(places, tired, "09:00", "18:00", "jeju-city", seed=seed)
        assert any(by_id[i["place_id"]]["category"] == "cafe" and i["is_rest_stop"] for i in items)


# ----------------------------------------------------------------------------- US-P11 2-opt
def test_zigzag_is_untangled():
    e1, w1, e2, w2 = at(1, "culture", 0, 2.0), at(2, "culture", 0, -2.0), at(3, "culture", 0, 2.4), at(4, "culture", 0, -2.4)
    by_id = {p["id"]: p for p in (e1, w1, e2, w2)}
    c = ctx_for("13:00", "18:00")
    c.anchor = e1
    entries = [planner.Entry(p["id"], 30) for p in (e1, w1, e2, w2)]
    out = planner.improve_order(entries, by_id, c)
    assert planner._travel(out, by_id, c) < planner._travel(entries, by_id, c)
    assert [e.place_id for e in out] in ([1, 3, 2, 4], [1, 3, 4, 2])


def test_order_that_makes_lunch_late_is_not_used():
    a, f, b = at(1, "culture", 0), at(2, "food", 3.0), at(3, "culture", 0.5)
    by_id = {p["id"]: p for p in (a, f, b)}
    c = ctx_for("11:30", "20:00")
    c.anchor = a
    lunch = planner.Entry(2, 30, meal="lunch", not_before=mins("11:30"), arrive_by=mins("13:30"))
    entries = [planner.Entry(1, 60), lunch, planner.Entry(3, 60)]
    assert [e.place_id for e in planner.improve_order(entries, by_id, c)] == [1, 2, 3]
    free = [planner.Entry(1, 60), planner.Entry(2, 30), planner.Entry(3, 60)]       # no meal to keep
    assert [e.place_id for e in planner.improve_order(free, by_id, c)] == [1, 3, 2]


# ----------------------------------------------------------------------------- US-P12 stay by place type
def test_stay_defaults_and_ranges(places):
    def first(t):
        return next(p for p in places if p["place_type"] == t and p["id"] > 40)
    for t, avg, rng in [("oreum_hike", 75, (60, 90)), ("port", 30, (20, 45)), ("cafe", 40, (30, 60))]:
        p = first(t)
        assert (p["avg_stay_min"], planner.stay_range(p)) == (avg, rng), t
    p17 = next(p for p in places if p["id"] == 17)
    assert (p17["place_type"], p17["avg_stay_min"], planner.stay_range(p17)) == ("history_culture", 150, (30, 150))


def test_place_type_from_the_english_name():
    assert build_places.place_type_of(1, "nature", "Hwasun Gotjawal") == "forest"
    assert build_places.place_type_of(2, "nature", "Jeongbang Falls") == "waterfall"
    assert build_places.place_type_of(3, "nature", "Hallim Port") == "port"
    assert build_places.place_type_of(4, "nature", "Leports Land") == "nature"          # \bport\b
    assert build_places.place_type_of(5, "museum", "Port Museum") == "museum"           # only nature splits
    with pytest.raises(ValueError):
        build_places.place_type_of(6, "zoo", "Zoo")


def test_place_types_in_the_seed_file(places):
    from collections import Counter
    n = Counter(p["place_type"] for p in places)
    assert set(n) == set(config.STAY_BY_TYPE)
    assert (n["port"], n["forest"], n["waterfall"], n["oreum_hike"]) == (33, 14, 5, 87)


def test_stay_range_of_a_place_without_a_type():
    assert planner.stay_range({"avg_stay_min": 30}) == (25, 60)
    assert planner.stay_range({"avg_stay_min": 120}) == (90, 180)


# ----------------------------------------------------------------------------- US-P13 fit_stays
def test_full_day_leaves_less_than_15_idle_minutes():
    # always open, wide stay ranges: nothing but the time itself stops a stay from growing
    ps = [at(n, ("nature", "culture")[n % 2], 0.3 * (n % 4), 0.3 * (n // 4), avg_stay_min=60) for n in range(1, 13)]
    ps += [at(20 + n, "food", 0.2 + 0.3 * n) for n in range(3)]
    for seed in range(5):
        course, items = planner.new_course(ps, NONE, "09:00", "18:00", "aewol", seed=seed)
        last = items[-1]
        assert mins("18:00") - (mins(last["start_time"]) + last["stay_min"]) < 15, seed
        busy = sum(i["stay_min"] + (i["move_min"] or 0) for i in items)
        assert 540 - busy < 15, seed


def test_stretching_stops_at_closing_time():
    p = at(1, "culture", 0, open_time="09:00", close_time="17:15", avg_stay_min=60)
    c = ctx_for("16:00", "19:00")
    c.meals = []
    out = planner.fit_stays([planner.Entry(1, 60)], {1: p}, c)
    assert out[0].stay_min == 75                                  # 16:00 + 75 = 17:15, range 45-120


def test_stretching_the_stop_before_lunch_keeps_lunch_by_1330():
    a, f = at(1, "culture", 0, avg_stay_min=120), at(2, "food", 0.2)
    by_id = {1: a, 2: f}
    c = ctx_for("11:00", "15:00")
    entries = [planner.Entry(1, 30), planner.Entry(2, 30, meal="lunch", not_before=mins("11:30"), arrive_by=mins("13:30"))]
    out = planner.fit_stays(entries, by_id, c)
    slots = planner.timeline(out, by_id, c)
    assert out[0].stay_min > 30 and slots[1].start <= mins("13:30")
    assert all(s.end <= c.end_min for s in slots)


def test_llm_stay_is_cut_to_the_range():
    p = at(1, "nature", 0, place_type="oreum_hike", avg_stay_min=75)
    e = planner.to_entries([LLMItem(place_id=1, order=1, stay_min=200, reason_en="x")], {1: p})
    assert e[0].stay_min == 90


# ----------------------------------------------------------------------------- US-P14 seed
def strip(course_items):
    course, items = course_items
    return [{k: v for k, v in i.items() if k != "course_id"} for i in items], course["meal_gaps"]


def test_same_seed_same_course(places):
    a = planner.new_course(places, NONE, "09:00", "18:00", "jeju-city", seed=42)
    b = planner.new_course(places, NONE, "09:00", "18:00", "jeju-city", seed=42)
    assert strip(a) == strip(b)
    assert a[0]["user_profile"]["_seed"] == 42


def test_ten_seeds_give_at_least_three_courses(places, by_id):
    seen = set()
    for seed in range(10):
        course, items = planner.new_course(places, NONE, "09:00", "18:00", "jeju-city", seed=seed)
        seen.add(frozenset(i["place_id"] for i in items))
        assert meal_ok(items, course["meal_gaps"], by_id, "lunch") == 1
        assert all((i["move_min"] or 0) <= config.MAX_MOVE_MIN for i in items)
    assert len(seen) >= 3


def test_pipeline_uses_only_its_own_random(places, monkeypatch):
    def boom(*a, **k):
        raise AssertionError("module random used")
    monkeypatch.setattr(random, "choice", boom)
    monkeypatch.setattr(random, "random", boom)
    planner.new_course(places, NONE, "09:00", "18:00", "jeju-city", seed=1)


# ----------------------------------------------------------------------------- US-P15 shuffle
def test_shuffle_makes_another_course_and_leaves_the_old_one(api, monkeypatch):
    client, fake = api
    seeds = iter(range(100, 200))
    monkeypatch.setattr(planner, "new_seed", lambda: next(seeds))
    old = client.post("/courses", json=body(NONE, "jeju-city", "09:00", "18:00")).json()
    before = copy.deepcopy(fake.items[old["id"]])
    r = client.post(f"/courses/{old['id']}/shuffle")
    assert r.status_code == 201
    new = r.json()
    assert new["id"] != old["id"] and new["tier"] == old["tier"]
    assert {k: new["user_profile"][k] for k in ("area_id", "start_time", "end_time", "interests")} == \
        {k: old["user_profile"][k] for k in ("area_id", "start_time", "end_time", "interests")}
    assert {i["place_id"] for i in fake.items[new["id"]]} != {i["place_id"] for i in before}
    assert fake.items[old["id"]] == before
    by_id = {p["id"]: p for p in fake.places}
    assert meal_ok(fake.items[new["id"]], fake.courses[new["id"]]["meal_gaps"], by_id, "lunch") == 1


def test_shuffle_resets_conditions_and_keeps_premium(api, places):
    client, fake = api
    old = client.post("/courses", json=body(NONE, "jeju-city", "10:00", "16:00")).json()
    client.post(f"/courses/{old['id']}/replan", json={"reason": "rain", "current_order": 1})
    client.post("/purchase", json={"course_id": old["id"]})
    new = client.post(f"/courses/{old['id']}/shuffle").json()
    assert new["tier"] == "premium"
    assert new["user_profile"]["conditions"] == {"indoor_only": False, "low_walking": False}
    assert "_excluded_place_ids" not in fake.courses[new["id"]]["user_profile"]


def test_shuffle_errors(api):
    client, fake = api
    r = client.post("/courses/00000000-0000-4000-8000-000000000000/shuffle")
    assert r.status_code == 404 and r.json()["detail"]["code"] == "COURSE_NOT_FOUND"
    old_profile = dict(NONE, duration="full_day", conditions={"indoor_only": False, "low_walking": False})
    fake.create_course({"id": "old", "user_profile": old_profile, "tier": "free", "created_at": "x"}, [])
    r = client.post("/courses/old/shuffle")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "CANNOT_SHUFFLE"


def test_anchor_with_a_dinner_place_nearby_wins_over_a_denser_one():
    dense = [at(1, "nature", 0)] + [at(10 + n, "nature", 0.1 * n) for n in range(6)]          # 7 places, no food
    fed = [at(2, "nature", 20), at(30, "nature", 20.2), at(31, "food", 20.4)]                 # 3 places + dinner
    c = ctx_for("13:00", "19:00", dict(NONE, interests=["nature"]))
    assert c.meals == ["dinner"]
    assert planner.pick_anchor(dense + fed, c)["id"] == 2
    c.meals = []
    assert planner.pick_anchor(dense + fed, c)["id"] in {1} | {10 + n for n in range(6)}
