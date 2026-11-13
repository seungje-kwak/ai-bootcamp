"""Offline checks of the PRD acceptance criteria that live in the planner (US-02, US-09, US-10, US-11, US-16, US-17)."""
from __future__ import annotations

import json

import pytest

from app import config, llm, planner
from app.course_view import build_course
from app.errors import ApiError
from app.schemas import LLMCourse, LLMItem


def merged(items: list[dict], res: planner.ReplanResult) -> list[dict]:
    """The item list the store would hold after apply_replan."""
    kept = [dict(i, status=res.statuses[i["order"]]) for i in items if i["order"] not in res.delete_orders]
    return sorted(kept + res.new_items, key=lambda i: i["order"])


@pytest.fixture()
def course(places, emma):
    return planner.new_course(places, emma, None)


# ----------------------------------------------------------------------------- US-02
def test_validate_drops_ids_that_are_not_candidates(by_id):
    cands = {1: by_id[1], 6: by_id[6]}
    out = LLMCourse(items=[
        LLMItem(place_id=1, order=1, stay_min=30, reason_en="a"),
        LLMItem(place_id=99999, order=2, stay_min=30, reason_en="not in the DB"),
        LLMItem(place_id=2, order=3, stay_min=30, reason_en="in the DB but not a candidate"),
        LLMItem(place_id=6, order=4, stay_min=30, reason_en="b"),
    ])
    assert [i.place_id for i in planner.validate(out, cands, None)] == [1, 6]


def test_llm_ghost_id_never_reaches_the_course(places, by_id, emma, monkeypatch):
    def fake(llm_input):
        ids = [c["id"] for c in llm_input["candidates"]]
        return LLMCourse(items=[
            LLMItem(place_id=ids[0], order=1, stay_min=30, reason_en="ok"),
            LLMItem(place_id=99999, order=2, stay_min=30, reason_en="ghost"),
            LLMItem(place_id=ids[1], order=3, stay_min=30, reason_en="ok"),
        ])
    monkeypatch.setattr(config, "USE_LLM", True)
    monkeypatch.setattr(planner, "call_llm", fake)
    _, items = planner.new_course(places, emma, None)
    assert len(items) == 2 and all(i["place_id"] in by_id for i in items)


def test_vegan_course_only_has_vegan_food_places(course, by_id):
    _, items = course
    food = [by_id[i["place_id"]]["food_options"] for i in items if by_id[i["place_id"]]["food_options"]]
    assert food, "a full day should include a place to eat"
    assert all(f["vegan"] and f["solo_ok"] for f in food)


def test_times_and_moves_follow_10_6(course, by_id, emma):
    _, items = course
    first = items[0]
    assert (first["start_time"], first["move_method"], first["move_min"]) == (config.DEFAULT_START, None, None)
    t = planner.to_min(first["start_time"]) + first["stay_min"]
    for a, b in zip(items, items[1:]):
        method, mins = planner.move_between(by_id[a["place_id"]], by_id[b["place_id"]], emma["max_walk_min"])
        start = planner.round_up5(t + mins)
        assert (b["move_method"], b["move_min"], b["start_time"]) == (method, mins, planner.to_hhmm(start))
        assert method in ("walk", "taxi")
        t = start + b["stay_min"]
    assert [i["status"] for i in items] == ["current"] + ["upcoming"] * (len(items) - 1)
    assert [i["order"] for i in items] == list(range(1, len(items) + 1))


def _failing_llm(counter):
    def boom(_):
        counter.append(1)
        raise llm.LLMError("forced")
    return boom


def test_llm_failing_twice_gives_502_when_fallback_is_off(places, emma, monkeypatch):
    calls: list[int] = []
    monkeypatch.setattr(config, "USE_LLM", True)
    monkeypatch.setattr(config, "LLM_FALLBACK_RULES", False)
    monkeypatch.setattr(planner, "call_llm", _failing_llm(calls))
    with pytest.raises(ApiError) as e:
        planner.new_course(places, emma, None)
    assert (e.value.status_code, e.value.detail["code"]) == (502, "LLM_FAILED")
    assert len(calls) == 2  # one retry (10.8)


def test_llm_failing_twice_falls_back_to_rules_by_default(places, by_id, emma, monkeypatch):  # US-22
    calls: list[int] = []
    monkeypatch.setattr(config, "USE_LLM", True)
    monkeypatch.setattr(config, "LLM_FALLBACK_RULES", True)
    monkeypatch.setattr(planner, "call_llm", _failing_llm(calls))
    _, items = planner.new_course(places, emma, None)
    assert len(calls) == 2 and items and all(i["place_id"] in by_id for i in items)


# ----------------------------------------------------------------------------- US-09 rain
@pytest.mark.parametrize("n", [1, 2, 3])
def test_rain_keeps_the_past_and_goes_indoors(places, by_id, course, n):
    c, items = course
    res = planner.replan(places, c, items, "rain", n)
    after = merged(items, res)
    assert [(i["order"], i["place_id"], i["start_time"]) for i in after[:n]] == \
           [(i["order"], i["place_id"], i["start_time"]) for i in items[:n]]
    assert res.new_items, "there should be indoor stops left for the afternoon"
    assert all(by_id[i["place_id"]]["accessibility"]["indoor"] for i in res.new_items)
    assert not {i["place_id"] for i in res.new_items} & {i["place_id"] for i in items[:n]}
    end_of_n = planner.to_min(items[n - 1]["start_time"]) + items[n - 1]["stay_min"]
    assert planner.to_min(res.new_items[0]["start_time"]) >= end_of_n
    assert [i["status"] for i in after] == ["done"] * (n - 1) + ["current"] + ["upcoming"] * (len(after) - n)
    assert res.user_profile["conditions"]["indoor_only"] is True
    assert res.report_place_id is None


# ----------------------------------------------------------------------------- US-10 closed
def test_closed_replaces_the_current_stop_and_reports_it(places, course):
    c, items = course
    n = 2
    closed = items[n - 1]["place_id"]
    res = planner.replan(places, c, items, "closed", n)
    after = merged(items, res)
    assert after[n - 1]["place_id"] != closed and after[n - 1]["status"] == "current"
    assert res.report_place_id == closed
    assert closed not in [i["place_id"] for i in after]
    assert [i["place_id"] for i in after[: n - 1]] == [i["place_id"] for i in items[: n - 1]]


def test_closed_place_stays_out_of_later_replans(places, course):
    c, items = course
    closed = items[1]["place_id"]
    r1 = planner.replan(places, c, items, "closed", 2)
    c2, items2 = dict(c, user_profile=r1.user_profile), merged(items, r1)
    r2 = planner.replan(places, c2, items2, "tired", 2)
    assert closed not in [i["place_id"] for i in merged(items2, r2)]


def test_closed_after_rain_gives_an_indoor_replacement(places, by_id, course):
    c, items = course
    r1 = planner.replan(places, c, items, "rain", 2)
    c2, items2 = dict(c, user_profile=r1.user_profile), merged(items, r1)
    r2 = planner.replan(places, c2, items2, "closed", 3)
    assert r2.new_items and all(by_id[i["place_id"]]["accessibility"]["indoor"] for i in r2.new_items)


def test_replan_on_a_stop_that_does_not_exist_is_404(places, course):
    c, items = course
    with pytest.raises(ApiError) as e:
        planner.replan(places, c, items, "rain", 99)
    assert (e.value.status_code, e.value.detail["code"]) == (404, "COURSE_ITEM_NOT_FOUND")


# ----------------------------------------------------------------------------- US-16 / US-17 (P1)
def test_hungry_puts_a_food_place_next(places, by_id, emma):
    c, items = planner.new_course(places, emma, "14:00")  # after lunch time: no food stop in the plan yet
    res = planner.replan(places, c, items, "hungry", 1)
    first = by_id[res.new_items[0]["place_id"]]
    assert first["category"] == "food" and first["food_options"]["vegan"]


def test_tired_keeps_only_the_easiest_walking_level(places, by_id, course):
    c, items = course
    res = planner.replan(places, c, items, "tired", 1)
    assert res.new_items and all(by_id[i["place_id"]]["accessibility"]["walking_level"] == 1 for i in res.new_items)
    assert res.user_profile["conditions"]["low_walking"] is True


# ----------------------------------------------------------------------------- US-11 / US-12 response shape
def test_free_course_shows_three_stops_and_leaks_nothing(places, by_id, course):
    c, items = course
    out = build_course(c, items, places, [])
    assert [i["order"] for i in out["items"]] == [1, 2, 3]
    assert (out["total_items"], out["locked_count"]) == (len(items), len(items) - 3)
    body = json.dumps(out, ensure_ascii=False)
    shown = {i["place_id"] for i in out["items"]}
    for it in items[3:]:
        if it["place_id"] not in shown:
            assert by_id[it["place_id"]]["name_en"] not in body
            assert it["reason_en"] not in body
    assert all(i["phrase_cards"] == [] for i in out["items"])
    assert not any(k.startswith("_") for k in out["user_profile"])


def test_premium_course_shows_everything(places, course):
    c, items = course
    cards = [{"place_id": items[0]["place_id"], "situation": "photo", "text_en": "x", "text_ko": "y"}]
    out = build_course(dict(c, tier="premium"), items, places, cards)
    assert len(out["items"]) == out["total_items"] == len(items) and out["locked_count"] == 0
    assert out["items"][0]["phrase_cards"] == [{"situation": "photo", "text_en": "x", "text_ko": "y"}]
