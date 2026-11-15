"""tasks/prd-recommendation-p0.md: three-value food options and F-3 (US-R03, US-R04), the anchor (US-R07),
candidates by distance (US-R08) and the first stop near the anchor (US-R09). Offline, made-up places."""
from __future__ import annotations

import json

import pytest

from app import config, llm, planner
from app.schemas import LLMCourse, LLMItem

from test_start_area import made_place

KM_LAT = 1 / 111.0          # about 1 km north
PROFILE = {"interests": ["nature"], "fitness_level": 3, "max_walk_min": 20, "avoid_slopes": False,
           "condition_today": "normal", "diet": "none", "conditions": {}}


def food(pid: int, solo_ok=None, vegan=None, category: str = "food", **kw) -> dict:
    p = made_place(pid, "aewol", category, **kw)
    p["food_options"].update(solo_ok=solo_ok, vegan=vegan, vegetarian=None, halal=None, english_menu=None)
    return p


def at(pid: int, category: str, km_north: float, km_east: float = 0.0) -> dict:
    return made_place(pid, "aewol", category, lat=33.40 + km_north * KM_LAT, lng=126.30 + km_east * KM_LAT * 1.2)


def ctx(interests=("nature",), needs_lunch=False, origin=None) -> planner.TripCtx:
    return planner.TripCtx(profile=dict(PROFILE, interests=list(interests)), start_min=600, end_min=1080,
                           min_items=2, max_items=6, meals=["lunch"] if needs_lunch else [], origin=origin)


# ----------------------------------------------------------------------------- US-R03 / US-R04 F-3
def test_seed_food_options_keep_null_for_not_known(places):
    rows = [p["food_options"] for p in places if p["food_options"]]
    solo = [f["solo_ok"] for f in rows]
    assert solo.count(True) == 6 and solo.count(None) == 345 and False not in solo
    assert all(f[k] in (True, False, None) for f in rows for k in ("vegan", "vegetarian", "halal", "english_menu"))


def test_schema_and_frontend_types_allow_null():
    from conftest import BACKEND
    sql = (BACKEND / "sql" / "schema.sql").read_text(encoding="utf-8")
    block = sql[sql.index("create table if not exists food_options"):].split(");")[0]
    assert "not null" not in block
    ts = (BACKEND.parent / "frontend" / "lib" / "types.ts").read_text(encoding="utf-8")
    for k in ("solo_ok", "vegan", "vegetarian", "halal", "english_menu"):
        assert f"{k}: boolean | null;" in ts


def test_unknown_solo_ok_passes_without_a_diet_and_false_is_dropped():
    assert planner._passes_diet(food(1, solo_ok=None), "none")
    assert planner._passes_diet(food(2, solo_ok=True), "none")
    assert not planner._passes_diet(food(3, solo_ok=False), "none")


def test_unknown_vegan_does_not_count_as_vegan():
    assert not planner._passes_diet(food(1, solo_ok=True, vegan=None), "vegan")
    assert not planner._passes_diet(food(2, solo_ok=None, vegan=False), "vegan")
    assert planner._passes_diet(food(3, solo_ok=None, vegan=True), "vegan")


def test_cafe_skips_f3_even_with_solo_and_vegan_false():
    assert planner._passes_diet(food(1, solo_ok=False, vegan=False, category="cafe"), "vegan")


def test_rule_reason_only_mentions_true_values():
    prof = dict(PROFILE, diet="vegan")
    unknown = planner._rule_reason(food(1), prof, ctx(), rest=False)
    assert "order for one" not in unknown and "vegan" not in unknown and "English" not in unknown
    known = planner._rule_reason(food(2, solo_ok=True, vegan=True), prof, ctx(), rest=False)
    assert "you can order for one" in known and "there are vegan options" in known


def test_rule_planner_prefers_a_solo_ok_restaurant():
    places = [at(1, "nature", 0), food(2, solo_ok=None, lat=33.40 + 0.3 * KM_LAT, lng=126.30),
              food(3, solo_ok=True, lat=33.40 + 0.3 * KM_LAT, lng=126.30)]
    c = ctx(needs_lunch=True)
    c.start_min, c.end_min = 690, 900
    c.anchor = places[0]
    out = planner.rule_plan(places, c, None)
    assert 3 in [i.place_id for i in out.items] and 2 not in [i.place_id for i in out.items]


def test_llm_prompt_has_the_fr6_lines():
    assert "Prefer food places where food.solo_ok is true." in llm.SYSTEM_PROMPT
    assert 'In "food", null means not known. Mention an option only when it is true.' in llm.SYSTEM_PROMPT
    assert "If trip.origin is given, start near it. Otherwise start near trip.anchor." in llm.SYSTEM_PROMPT


def test_area_counts_restaurants_unless_solo_ok_is_false():
    from app import areas
    from test_start_area import ready_area
    assert config.AREA_MIN_SOLO_FOOD == 2
    ps = ready_area("aewol")
    for p in ps:
        if p["food_options"]:
            p["food_options"]["solo_ok"] = None          # not known: still counts
    row = next(a for a in areas.summaries(areas.load_seed_areas(), ps) if a["id"] == "aewol")
    assert row["selectable"] is True
    for p in ps[:2]:
        p["food_options"]["solo_ok"] = False             # 1 of 3 left
    row = next(a for a in areas.summaries(areas.load_seed_areas(), ps) if a["id"] == "aewol")
    assert row["selectable"] is False


def test_seed_areas_that_can_be_picked_do_not_shrink(places):
    from app import areas
    rows = areas.summaries(areas.load_seed_areas(), places)
    assert sum(a["selectable"] for a in rows) >= 12


def test_llm_error_carries_status_and_quota():
    e = llm.LLMError("x", status=429, quota=True)
    assert (e.status, e.quota) == (429, True)
    assert (llm.LLMError("y").status, llm.LLMError("y").quota) == (None, False)


# ----------------------------------------------------------------------------- US-R07 anchor
def test_anchor_is_the_densest_interest_place():
    # a cluster of 4 around km 0 (one nature), a pair around km 10 (one nature, smaller id)
    pool = [at(1, "nature", 10), at(2, "culture", 10.5),
            at(5, "nature", 0), at(6, "culture", 0.5), at(7, "culture", 1), at(8, "photo", -1)]
    assert planner.pick_anchor(pool, ctx())["id"] == 5


def test_anchor_tie_goes_to_more_food_when_lunch_is_needed_then_to_the_smaller_id():
    pool = [at(3, "nature", 0), at(4, "culture", 0.5),          # 2 nearby, no food
            at(2, "nature", 20), at(9, "food", 20.5)]           # 2 nearby, one food
    assert planner.pick_anchor(pool, ctx(needs_lunch=True))["id"] == 2
    assert planner.pick_anchor(pool, ctx(needs_lunch=False))["id"] == 2      # same density: smaller id
    pool[2]["id"] = 12
    assert planner.pick_anchor(pool, ctx(needs_lunch=False))["id"] == 3
    assert planner.pick_anchor(pool, ctx(needs_lunch=True))["id"] == 12


def test_anchor_comes_from_the_whole_pool_when_no_place_matches_interests():
    pool = [at(1, "culture", 30), at(2, "culture", 0), at(3, "photo", 0.5), at(4, "photo", 1)]
    assert planner.pick_anchor(pool, ctx(interests=("market",)))["id"] == 2


def test_replan_anchor_is_the_origin():
    origin = at(99, "food", 50)
    assert planner.pick_anchor([at(1, "nature", 0)], ctx(origin=origin)) is origin


# ----------------------------------------------------------------------------- US-R08 candidates
def test_places_more_than_6km_from_the_anchor_are_not_candidates():
    anchor = at(1, "nature", 0)
    pool = [anchor] + [at(10 + n, "nature", 1 + n * 0.5) for n in range(5)] +            [at(20 + n, "culture", 1.2 + n * 0.5) for n in range(5)] + [at(50, "nature", 6.5), at(51, "culture", 9)]
    out = planner.limit_candidates(pool, ["nature"], [], anchor, min_candidates=2)
    assert {p["id"] for p in out} == {1} | {10 + n for n in range(5)} | {20 + n for n in range(5)}
    dists = [planner.haversine_m(anchor["lat"], anchor["lng"], p["lat"], p["lng"]) for p in out]
    assert dists == sorted(dists)                                             # closest first


def test_lunch_puts_the_four_closest_restaurants_in():
    anchor = at(1, "nature", 0)
    pool = ([anchor] + [at(10 + n, "nature", 0.1 * (n + 1)) for n in range(30)]
            + [at(200 + n, "culture", 0.5 + 0.05 * n) for n in range(10)]
            + [at(300 + n, "photo", 0.6 + 0.05 * n) for n in range(10)]
            + [at(100 + n, "food", 1 + 0.5 * n) for n in range(6)])
    # food is not an interest and closer culture / photo places fill the other seats first
    without = planner.limit_candidates(pool, ["nature"], [], anchor, min_candidates=2)
    assert len(without) == config.MAX_CANDIDATES and not any(p["category"] == "food" for p in without)
    out = planner.limit_candidates(pool, ["nature"], ["lunch"], anchor, min_candidates=2)
    assert sorted(p["id"] for p in out if p["category"] == "food") == [100, 101, 102, 103]


def test_no_more_than_8_of_one_category():
    anchor = at(1, "nature", 0)
    pool = [anchor] + [at(10 + n, "nature", 0.1 * (n + 1)) for n in range(20)] + \
           [at(100 + n, "culture", 3 + 0.1 * n) for n in range(20)]
    out = planner.limit_candidates(pool, ["nature", "culture"], [], anchor, min_candidates=2)
    counts = {c: sum(p["category"] == c for p in out) for c in ("nature", "culture")}
    assert counts == {"nature": 8, "culture": 8}


def test_without_enough_places_in_the_radius_the_closest_are_used():
    anchor = at(1, "nature", 0)
    pool = [anchor, at(2, "nature", 10), at(3, "culture", 12), at(4, "nature", 30)]
    out = planner.limit_candidates(pool, ["nature"], [], anchor, min_candidates=2)
    assert [p["id"] for p in out] == [1, 2, 3, 4]


def test_fixed_first_stays_even_when_it_is_far():
    anchor = at(1, "nature", 0)
    cats = ["nature", "culture", "photo", "market"]
    pool = [at(10 + n, cats[n % 4], 0.1 * (n + 1)) for n in range(25)] + [at(99, "food", 8)]
    far = pool[-1]
    out = planner.limit_candidates(pool, ["nature"], [], anchor, min_candidates=1, fixed_first=far)
    assert len(out) == config.MAX_CANDIDATES and far in out


# ----------------------------------------------------------------------------- US-R09 first stop
def test_first_stop_is_not_the_farthest_from_the_anchor():
    # anchor cluster around km 0, one equally good place 5 km away with a smaller id
    places = [at(1, "nature", 5), at(5, "nature", 0), at(6, "nature", 0.3), at(7, "nature", 0.6)]
    c = ctx()
    c.anchor = planner.pick_anchor(places, c)
    assert c.anchor["id"] == 5
    out = planner.rule_plan(places, c, None)
    assert out.items[0].place_id != 1


def test_llm_input_has_the_anchor_for_a_new_course_and_null_for_a_replan():
    p = at(1, "nature", 0)
    c = ctx()
    c.anchor = p
    assert planner.build_llm_input([p], c, None)["trip"]["anchor"] == {"lat": p["lat"], "lng": p["lng"]}
    r = ctx(origin=at(2, "culture", 1))
    r.anchor = r.origin
    assert planner.build_llm_input([p], r, None)["trip"]["anchor"] is None


def test_pipeline_sends_the_anchor_to_the_llm(monkeypatch):
    places = [at(1, "nature", 0), at(2, "nature", 0.3), at(3, "culture", 0.6), at(4, "nature", 9)]
    seen = {}

    def fake(llm_input):
        seen.update(llm_input)
        ids = [c["id"] for c in llm_input["candidates"]]
        return LLMCourse(items=[LLMItem(place_id=i, order=n, stay_min=30, reason_en="ok")
                                for n, i in enumerate(ids[:2], start=1)])
    monkeypatch.setattr(config, "USE_LLM", True)
    monkeypatch.setattr(planner, "call_llm", fake)
    planner.new_course(places, PROFILE, "10:00", "14:00", area_id="aewol")
    assert seen["trip"]["anchor"] is not None
    assert 4 not in [c["id"] for c in seen["candidates"]]                    # 9 km from the anchor
    json.dumps(seen)                                                          # still plain JSON


# ----------------------------------------------------------------------------- US-R05 area from coordinates
def test_boundary_file_has_43_jeju_boundaries_in_the_14_areas():
    from app import areas
    from conftest import BACKEND
    from test_start_area import AREA_IDS
    path = BACKEND / "app" / "data" / "jeju_admin.geojson"
    assert path.stat().st_size <= 1_000_000
    data = json.loads(path.read_text(encoding="utf-8"))
    assert len(data["features"]) == 43
    assert all(f["properties"]["adm_nm"].startswith("제주특별자치도 ") for f in data["features"])
    got = [a for a, _, _ in areas.load_boundaries()]
    assert len(got) == 43 and set(got) == set(AREA_IDS)
    assert areas.load_boundaries() is areas.load_boundaries()                 # read once


@pytest.mark.parametrize("lat, lng, area_id", [
    (33.515056, 126.514264, "jeju-city"),        # Yongduam
    (33.543638, 126.658711, "jocheon"),          # 흑본오겹 함덕점 (address has no eup name)
    (33.458080, 126.941500, "seongsan"),         # Seongsan Ilchulbong
    (33.244169, 126.405574, "seogwipo-city"),    # Jungmun Saekdal Beach
    (33.500000, 126.955000, "udo"),              # inside Udo
    (33.00, 126.00, None),                       # open sea
])
def test_area_of_point(lat, lng, area_id):
    from app import areas
    assert areas.area_of_point(lat, lng) == area_id


def test_point_just_off_the_coast_gets_the_closest_area_and_far_out_gets_none(monkeypatch):
    from app import areas
    # a square "island" with a square lake (hole) in it
    outer = [(126.0, 33.0), (126.1, 33.0), (126.1, 33.1), (126.0, 33.1), (126.0, 33.0)]
    hole = [(126.04, 33.04), (126.06, 33.04), (126.06, 33.06), (126.04, 33.06), (126.04, 33.04)]
    monkeypatch.setattr(areas, "_BOUNDARIES", [("aewol", (126.0, 33.0, 126.1, 33.1), [[outer, hole]])])
    assert areas.area_of_point(33.02, 126.02) == "aewol"
    # in the lake: outside the polygon, 0.93 km from the shore -> within the 1 km tolerance
    assert areas.area_of_point(33.05, 126.05) == "aewol"
    monkeypatch.setattr(config, "AREA_EDGE_TOLERANCE_KM", 0.5)
    assert areas.area_of_point(33.05, 126.05) is None             # over 0.5 km from the shore
    assert areas.area_of_point(33.1036, 126.05) == "aewol"         # about 400 m north of the coast
    assert areas.area_of_point(33.12, 126.05) is None              # about 2 km out
