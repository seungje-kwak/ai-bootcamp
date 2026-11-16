"""tasks/prd-travel-range.md v0.3 (hub variety): hubs (US-T02), a course's hub (US-T03), shuffles that skip
the hubs already shown (US-T04), v0.2 leftovers (US-T05) and the eval metrics (US-T01). Offline: the seed file
or made-up places, no LLM, no Supabase."""
from __future__ import annotations

import itertools
import json
import sys

import pytest

from app import config, course_view, planner
from app.schemas import UserProfileIn

from conftest import BACKEND
from test_recommendation_p1 import NONE, FakeStore, at, meal_ok, mins

sys.path.insert(0, str(BACKEND / "scripts"))
import eval_planner as ev  # noqa: E402

ALL6 = {"interests": ["nature", "market", "cafe", "food", "culture", "photo"], "fitness_level": 2,
        "max_walk_min": 20, "avoid_slopes": False, "condition_today": "normal", "diet": "none"}
SECTION1 = dict(NONE, interests=["nature", "culture", "cafe"])      # the profile of the PRD's 1장


def km(a: dict, b: dict) -> float:
    return planner.km_between(a, b)


def town(first_id: int, km_north: float, n: int = 12) -> list[dict]:
    """n made-up places within ~0.2 km (all walks), every category the tests need, 60-minute stays."""
    cats = ["nature", "culture", "food", "cafe", "photo", "nature"]
    return [at(first_id + i, cats[i % len(cats)], km_north + 0.05 * (i % 4), 0.05 * (i // 4), avg_stay_min=60)
            for i in range(n)]


def which_town(pid: int) -> int:
    return pid // 100


def ctx_for(start="09:00", end="18:00", profile=NONE, **kw) -> planner.TripCtx:
    s, e = mins(start), mins(end)
    prof = dict(profile, conditions={"indoor_only": False, "low_walking": False})
    lo, hi = planner.item_bounds(e - s)
    return planner.TripCtx(profile=prof, start_min=s, end_min=e, min_items=lo, max_items=hi,
                           meals=planner.meals_needed(s, e), **kw)


def centre(items: list[dict], by_id: dict) -> dict:
    ps = [by_id[i["place_id"]] for i in items]
    return {"lat": sum(p["lat"] for p in ps) / len(ps), "lng": sum(p["lng"] for p in ps) / len(ps)}


@pytest.fixture()
def wed(monkeypatch):
    monkeypatch.setattr(planner, "today_kst_dow", lambda: "wed")


@pytest.fixture()
def counting_seeds(monkeypatch):
    seeds = itertools.count(500)
    monkeypatch.setattr(planner, "new_seed", lambda: next(seeds))


def shuffle_chain(places, course, items, n) -> list[dict]:
    """The course and n shuffles in a row."""
    out = [course]
    for _ in range(n):
        course, items = planner.shuffle_course(places, course, items)
        out.append(course)
    return out


# ----------------------------------------------------------------------------- US-T02 hubs
def test_two_groups_10km_apart_give_two_hubs_one_in_each():
    pool = town(100, 0, 10) + town(200, 10, 10)
    hubs = planner.find_hubs(pool, ctx_for())
    assert len(hubs) == 2
    assert {which_town(h.place["id"]) for h in hubs} == {1, 2}
    assert all(h.density == 10 for h in hubs)
    assert planner.find_hubs(pool, ctx_for()) == hubs                     # no randomness
    assert config.HUB_MIN_PLACES == 8 and config.HUB_SEPARATION_KM == 3.0


def test_without_a_place_dense_enough_the_densest_one_is_the_only_hub():
    pool = town(100, 0, 5) + town(200, 10, 7)
    hubs = planner.find_hubs(pool, ctx_for())
    assert len(hubs) == 1 and which_town(hubs[0].place["id"]) == 2 and hubs[0].density == 7


def test_hub_knows_its_restaurants():
    hub = planner.find_hubs(town(100, 0), ctx_for())[0]
    assert {p["category"] for p in hub.food} == {"food"} and hub.fed(["lunch", "dinner"])


def test_jeju_city_has_eight_or_more_hubs(places):
    hubs = planner.find_hubs(planner.in_area(places, "jeju-city"), ctx_for(profile=ALL6))
    assert len(hubs) >= 8
    assert all(km(a.place, b.place) > 3.0 for a, b in itertools.combinations(hubs, 2))


# ----------------------------------------------------------------------------- US-T03 a course's hub
def test_hub_is_picked_by_density():
    pool = town(100, 0, 12) + town(200, 10, 8)
    c = ctx_for()
    hubs = planner.find_hubs(pool, c)
    assert planner.pick_hub(hubs, c) is hubs[0]                           # no rng: the densest
    picks = [planner.pick_hub(hubs, ctx_for(rng=planner.random.Random(s))).place["id"] for s in range(300)]
    share = sum(p == hubs[0].place["id"] for p in picks) / 300
    assert 0.5 < share < 0.7                                              # 12 / 20 = 60%


def test_hub_with_a_restaurant_for_every_meal_comes_first():
    no_food = [dict(p, category="photo") if p["category"] == "food" else p for p in town(200, 10, 20)]
    pool = town(100, 0, 9) + no_food                                      # the bigger hub has no restaurant
    for seed in range(20):
        c = ctx_for(rng=planner.random.Random(seed))
        assert which_town(planner.pick_hub(planner.find_hubs(pool, c), c).place["id"]) == 1


def test_avoided_hubs_are_left_out():
    pool = town(100, 0) + town(200, 10)
    c = ctx_for(rng=planner.random.Random(1))
    hubs = planner.find_hubs(pool, c)
    for avoid_town, other in ((1, 2), (2, 1)):
        avoid = [p for p in pool if which_town(p["id"]) == avoid_town][:1]
        assert which_town(planner.pick_hub(hubs, c, avoid).place["id"]) == other
    assert planner.pick_hub(hubs, c, [pool[0], pool[12]]) is None


def test_new_course_saves_its_hub_and_stays_in_one_town():
    ps = town(100, 0) + town(200, 7.5)
    stats: dict = {}
    course, items = planner.new_course(ps, NONE, "09:00", "18:00", "aewol", seed=3, stats=stats)
    prof = course["user_profile"]
    assert prof["_seen_hubs"] == [prof["_hub_id"]] and stats["hub_count"] == 2
    assert {which_town(i["place_id"]) for i in items} == {which_town(prof["_hub_id"])}
    assert all((i["move_min"] or 0) <= config.MAX_MOVE_MIN for i in items)
    public = course_view.build_course(dict(course, tier="premium"), items, ps, [])["user_profile"]
    assert "_hub_id" not in public and "_seen_hubs" not in public


def test_jeju_city_courses_spread_over_the_city(places, wed):
    by_id = {p["id"]: p for p in places}
    centres = []
    for seed in range(1, 21):
        course, items = planner.new_course(places, SECTION1, "09:00", "18:00", "jeju-city", seed=seed)
        assert meal_ok(items, course["meal_gaps"], by_id, "lunch") == 1
        assert all((i["move_min"] or 0) <= config.MAX_MOVE_MIN for i in items)
        centres.append(centre(items, by_id))
    dists = [km(a, b) for a, b in itertools.combinations(centres, 2)]
    assert sum(dists) / len(dists) >= 3.0


def test_replan_keeps_the_hub(places, wed):
    course, items = planner.new_course(places, SECTION1, "09:00", "18:00", "jeju-city", seed=4)
    res = planner.replan(places, course, items, "rain", 1)
    assert res.user_profile["_hub_id"] == course["user_profile"]["_hub_id"]
    assert res.user_profile["_seen_hubs"] == course["user_profile"]["_seen_hubs"]


# ----------------------------------------------------------------------------- US-T04 shuffles skip seen hubs
def test_ten_jeju_city_courses_in_a_row_are_all_in_different_hubs(places, wed, counting_seeds):
    stats: dict = {}
    course, items = planner.new_course(places, ALL6, "09:00", "18:00", "jeju-city", seed=1, stats=stats)
    assert stats["hub_count"] >= 8
    chain = shuffle_chain(places, course, items, 9)
    hubs = [c["user_profile"]["_hub_id"] for c in chain]
    assert len(set(hubs)) == min(10, stats["hub_count"])
    assert chain[-1]["user_profile"]["_seen_hubs"][-1] == hubs[-1]
    by_id = {p["id"]: p for p in places}
    assert all(km(by_id[a], by_id[b]) > 3.0 for a, b in zip(hubs, hubs[1:]))


def test_two_hubs_take_turns(counting_seeds):
    ps = town(100, 0) + town(200, 7.5)
    course, items = planner.new_course(ps, NONE, "09:00", "18:00", "aewol", seed=1)
    chain = shuffle_chain(ps, course, items, 4)
    towns = [which_town(c["user_profile"]["_hub_id"]) for c in chain]
    assert towns in ([1, 2, 1, 2, 1], [2, 1, 2, 1, 2])
    assert [len(c["user_profile"]["_seen_hubs"]) for c in chain] == [1, 2, 2, 2, 2]


def test_one_hub_shuffles_in_the_same_hub(counting_seeds):
    ps = town(100, 0, 20)
    course, items = planner.new_course(ps, NONE, "09:00", "18:00", "aewol", seed=1)
    new, new_items = planner.shuffle_course(ps, course, items)
    assert new["user_profile"]["_hub_id"] == course["user_profile"]["_hub_id"]
    assert new["user_profile"]["_seen_hubs"] == [course["user_profile"]["_hub_id"]]
    assert {i["place_id"] for i in new_items} != {i["place_id"] for i in items}


def test_old_course_without_hubs_moves_away_from_its_stops(counting_seeds):
    ps = town(100, 0) + town(200, 7.5)
    by_id = {p["id"]: p for p in ps}
    course, items = planner.new_course(ps, NONE, "09:00", "18:00", "aewol", seed=1)
    for key in ("_hub_id", "_seen_hubs"):
        del course["user_profile"][key]
    new, _ = planner.shuffle_course(ps, course, items)
    assert km(by_id[new["user_profile"]["_hub_id"]], centre(items, by_id)) > 3.0
    assert new["user_profile"]["_seen_hubs"] == [new["user_profile"]["_hub_id"]]


def test_v02_course_uses_its_hubs_as_seen(counting_seeds):
    ps = town(100, 0) + town(200, 7.5) + town(300, 15)
    course, items = planner.new_course(ps, NONE, "09:00", "18:00", "aewol", seed=1)
    prof = course["user_profile"]
    first = prof.pop("_hub_id")
    other = next(p["id"] for p in ps if which_town(p["id"]) != which_town(first) and p["category"] == "nature")
    prof.pop("_seen_hubs")
    prof["_hubs"] = [{"place_id": first, "from": "09:00"}, {"place_id": other, "from": "13:30"}]
    new, _ = planner.shuffle_course(ps, course, items)
    assert which_town(new["user_profile"]["_hub_id"]) not in {which_town(first), which_town(other)}


def test_seen_hubs_reads_every_kind_of_course():
    ps = town(100, 0) + town(200, 7.5)
    by_id = {p["id"]: p for p in ps}
    assert planner.seen_hubs({"_hub_id": 200, "_seen_hubs": [100, 200]}, [], by_id)[:2] == ([100, 200], 200)
    assert planner.seen_hubs({"_hubs": [{"place_id": 200}, {"place_id": 100}]}, [], by_id)[:2] == ([200, 100], 200)
    ids, prev, points, _ = planner.seen_hubs({}, [{"place_id": 100}, {"place_id": 101}], by_id)
    assert (ids, prev) == ([], None) and set(points[0]) == {"lat", "lng"}


# ----------------------------------------------------------------------------- US-T05 v0.2 leftovers
def test_travel_range_from_a_v02_app_is_ignored():
    p = UserProfileIn.model_validate(dict(NONE, travel_range="farther"))
    assert "travel_range" not in p.model_dump()
    UserProfileIn.model_validate(dict(NONE, travel_range="far"))           # no 422 either


def test_v02_range_code_is_gone():
    for name in ("RANGE_RULES", "TRAVEL_RANGES", "HUB_CANDIDATE_RADIUS_KM", "HUB_SWITCH_EARLY_MIN",
                 "ANCHOR_TOP_K", "ANCHOR_MIN_SHARE"):
        assert not hasattr(config, name), name
    for name in ("pick_hubs", "hub_starts", "sort_by_hub", "replan_hubs", "travel_range_of"):
        assert not hasattr(planner, name), name
    assert "travel_range" not in planner.ONBOARDING_KEYS
    assert not hasattr(planner.TripCtx(profile={}, start_min=0, end_min=1, min_items=1, max_items=1), "max_move")


@pytest.fixture()
def api(places, monkeypatch):
    from fastapi.testclient import TestClient

    from app import main, store
    fake = FakeStore(places)
    monkeypatch.setattr(store, "_store", fake)
    monkeypatch.setattr(main, "get_store", lambda: fake)
    return TestClient(main.app), fake


def test_api_takes_a_v02_request_and_shuffles_to_a_new_hub(api, counting_seeds):
    client, fake = api
    body = {"user_profile": dict(NONE, travel_range="explore"), "area_id": "aewol",
            "start_time": "09:00", "end_time": "18:00"}
    r = client.post("/courses", json=body)
    assert r.status_code == 201
    stored = fake.courses[r.json()["id"]]["user_profile"]
    assert "travel_range" not in stored and "travel_range" not in r.json()["user_profile"]
    new = client.post(f"/courses/{r.json()['id']}/shuffle")
    assert new.status_code == 201
    new_prof = fake.courses[new.json()["id"]]["user_profile"]
    assert new_prof["_hub_id"] != stored["_hub_id"] and new_prof["_seen_hubs"] == [stored["_hub_id"], new_prof["_hub_id"]]


# ----------------------------------------------------------------------------- US-T01 eval metrics
def eplace(pid: int, lat: float) -> dict:
    return {"id": pid, "category": "nature", "lat": lat, "lng": 126.5, "area_id": "a", "avg_stay_min": 60}


def eitem(pid: int) -> dict:
    return {"place_id": pid, "stay_min": 60, "move_method": None, "move_min": None, "start_time": "10:00"}


PROF = {"interests": ["nature"], "condition_today": "normal", "diet": "none"}


def test_diversity_metrics_of_hand_made_courses():
    ps = [eplace(n, 33.50 + n * 0.01) for n in range(1, 7)]        # 0.01 lat is 1.11 km
    by_id = {p["id"]: p for p in ps}
    runs = [
        ev.Run(ev.Scenario("a", PROF, "13:00", "17:00"), items=[eitem(1), eitem(2), eitem(4)],
               alt_items=[eitem(4), eitem(5), eitem(6)]),
        ev.Run(ev.Scenario("a", PROF, "13:00", "17:00"), items=[eitem(1), eitem(3), eitem(2)],
               alt_items=[eitem(1), eitem(3), eitem(2)]),
    ]
    m = ev.metrics(runs, by_id, {"a": ps})
    # run 1: centres at lat 33.52333 and 33.55 -> 0.02667 degrees, 2.965 km; run 2: the same course -> 0
    assert m["centre_shift_km"] == pytest.approx((2.9652 + 0) / 2, abs=1e-3)
    assert m["seed_place_coverage"] == 1.0                          # {1,2,4,5,6} | {1,2,3} = all 6
    assert m["shuffle_new_hub_rate"] is None and m["shuffle_hub_variety"] is None


def test_shuffle_metrics_of_hand_made_chains():
    ps = [eplace(1, 33.50), eplace(2, 33.55), eplace(3, 33.60), eplace(4, 33.501)]   # 4 is 0.1 km from 1
    by_id = {p["id"]: p for p in ps}
    sc = ev.Scenario("a", PROF, "13:00", "17:00")
    runs = [
        ev.Run(sc, items=[eitem(1)], hub_count=3, hub_chain=[1, 2, 3, 1, 2]),   # new 4 of 4; 3 ids of 3 hubs
        ev.Run(sc, items=[eitem(1)], hub_count=3, hub_chain=[1, 4, 1, 2, 1]),   # 1<->4 is 0.1 km: new 2 of 4
        ev.Run(sc, items=[eitem(1)], hub_count=3, hub_chain=[1, 2, 1, 2, 1]),   # new 4 of 4; 2 ids of 3 hubs
        ev.Run(sc, items=[eitem(1)], hub_count=1, hub_chain=[1, 1, 1, 1, 1]),   # one hub: not counted for rate
    ]
    m = ev.metrics(runs, by_id, {"a": ps})
    assert m["shuffle_new_hub_rate"] == pytest.approx(10 / 12, abs=1e-4)
    # variety: 3/3, {1, 4, 2} 3/3, 2/3, 1/1 (never over 1)
    assert m["shuffle_hub_variety"] == pytest.approx((1 + 1 + 2 / 3 + 1) / 4, abs=1e-4)


def test_eval_shuffle_runs_and_stays_the_same(tmp_path):
    a, b = tmp_path / "a.json", tmp_path / "b.json"
    assert ev.main(["--limit", "12", "--shuffle", "--diversity", "--out", str(a)]) == 0
    assert ev.main(["--limit", "12", "--shuffle", "--diversity", "--out", str(b)]) == 0
    data = json.loads(a.read_text(encoding="utf-8"))
    assert json.loads(b.read_text(encoding="utf-8"))["overall"] == data["overall"]
    assert data["shuffle"] is True and set(ev.METRIC_KEYS) <= set(data["overall"])
    assert data["overall"]["shuffle_new_hub_rate"] == 1.0
    assert planner.new_seed() == 1                                   # conftest's stub is back


def test_eval_shuffle_does_not_run_with_the_llm(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "LLM_API_KEY", "x")
    assert ev.main(["--llm", "--shuffle", "--out", str(tmp_path / "x.json")]) == 2
