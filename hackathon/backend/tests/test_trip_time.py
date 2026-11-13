"""Offline checks for tasks/prd-trip-time.md (US-T01 to US-T04): time window, stop counts, opening hours, replan."""
from __future__ import annotations

import copy
import sys

import pytest

from app import config, planner
from app.errors import ApiError
from app.schemas import CreateCourseRequest, LLMCourse, LLMItem

from conftest import BACKEND

sys.path.insert(0, str(BACKEND / "scripts"))
import build_places  # noqa: E402

EASY = {"interests": ["nature", "culture"], "fitness_level": 3, "max_walk_min": 30, "avoid_slopes": False,
        "condition_today": "great", "diet": "none"}


def merged(items: list[dict], res: planner.ReplanResult) -> list[dict]:
    kept = [dict(i, status=res.statuses[i["order"]]) for i in items if i["order"] not in res.delete_orders]
    return sorted(kept + res.new_items, key=lambda i: i["order"])


def span(item: dict) -> tuple[int, int]:
    start = planner.to_min(item["start_time"])
    return start, start + item["stay_min"]


def assert_inside_hours(items: list[dict], by_id: dict[int, dict]) -> None:
    for it in items:
        p, (start, end) = by_id[it["place_id"]], span(it)
        assert planner.fits_hours(p, start, it["stay_min"]), \
            f"{p['name_en']} {it['start_time']}+{it['stay_min']} outside {p['open_time']}-{p['close_time']}"


def tiny_place(pid: int, lat: float, open_time, close_time, stay: int = 60, category: str = "culture") -> dict:
    """A made-up place next to Jeju City Hall, a short walk from the others."""
    return {
        "id": pid, "name_en": f"Place {pid}", "name_ko": f"장소 {pid}", "category": category,
        "description_en": "A test place.", "lat": lat, "lng": 126.5312, "address_ko": "제주시",
        "image_url": None, "image_source": None, "avg_stay_min": stay, "opening_hours": None,
        "open_time": open_time, "close_time": close_time, "closed_days": [], "price_level": None,
        "last_verified_at": None, "source_date": None,
        "accessibility": {"walking_level": 1, "terrain": "flat", "has_stairs": None, "wheelchair_ok": None,
                          "indoor": True, "has_seating": None, "restroom": None,
                          "nearest_public_restroom_m": None, "fatigue_score": 1},
        "food_options": None,
    }


# ----------------------------------------------------------------------------- US-T01 data
def test_every_place_has_both_times_or_none(places):
    assert len(places) > 19
    for p in places:
        assert "open_time" in p and "close_time" in p
        assert (p["open_time"] is None) == (p["close_time"] is None), p["id"]
        if p["open_time"] is not None:
            assert build_places.parse_open_close(p["id"], p["open_time"], p["close_time"]) == \
                   (p["open_time"], p["close_time"])


def test_yongduam_is_always_open_and_mokgwana_skips_the_night_opening(by_id):
    assert (by_id[1]["open_time"], by_id[1]["close_time"]) == (None, None)
    assert (by_id[2]["open_time"], by_id[2]["close_time"]) == ("09:00", "18:00")


@pytest.mark.parametrize("open_time, close_time", [
    ("9:00", "18:00"),      # not HH:MM
    ("09:00", "18:0"),
    ("18:00", "09:00"),     # opens after it closes
    ("09:00", "09:00"),
    ("09:00", ""),          # only one of the two
    ("", "18:00"),
    ("09:00", "25:00"),
])
def test_build_places_stops_on_a_bad_time(open_time, close_time):
    with pytest.raises(ValueError):
        build_places.parse_open_close(7, open_time, close_time)


def test_build_places_accepts_empty_and_midnight():
    assert build_places.parse_open_close(7, "", "") == (None, None)
    assert build_places.parse_open_close(7, "17:00", "24:00") == ("17:00", "24:00")


# ----------------------------------------------------------------------------- US-T02 request and window
def test_request_needs_both_times_and_rejects_duration(emma):
    ok = CreateCourseRequest.model_validate({"user_profile": emma, "start_time": "10:00", "end_time": "14:00"})
    assert (ok.start_time, ok.end_time) == ("10:00", "14:00")
    for body in ({"user_profile": emma, "start_time": "10:00"},
                 {"user_profile": emma, "end_time": "14:00"},
                 {"user_profile": dict(emma, duration="half_day"), "start_time": "10:00", "end_time": "14:00"}):
        with pytest.raises(ValueError):
            CreateCourseRequest.model_validate(body)


def invalid_window(places, emma, start, end):
    with pytest.raises(ApiError) as e:
        planner.new_course(places, emma, start, end)
    assert (e.value.status_code, e.value.detail["code"]) == (422, "INVALID_TIME_WINDOW")


def test_start_before_0800_is_invalid(places, emma):
    invalid_window(places, emma, "07:30", "12:00")


def test_start_after_1600_is_invalid(places, emma):
    invalid_window(places, emma, "16:30", "19:00")


def test_start_minutes_must_be_00_or_30(places, emma):
    invalid_window(places, emma, "10:15", "14:00")


def test_end_minutes_must_be_00_or_30(places, emma):
    invalid_window(places, emma, "10:00", "14:10")


def test_shorter_than_120_minutes_is_invalid(places, emma):
    invalid_window(places, emma, "10:00", "11:30")
    invalid_window(places, emma, "14:00", "13:00")   # ends before it starts


def test_longer_than_600_minutes_is_invalid(places, emma):
    invalid_window(places, emma, "08:00", "18:30")


def test_end_after_2200_is_invalid(places, emma):
    invalid_window(places, emma, "16:00", "22:30")


def test_times_that_are_not_hhmm_are_invalid(places, emma):
    invalid_window(places, emma, "10am", "14:00")
    invalid_window(places, emma, "10:00", "24:00")


@pytest.mark.parametrize("start, end", [("08:00", "10:00"), ("08:00", "18:00"), ("16:00", "18:00"), ("12:00", "22:00")])
def test_edges_of_the_window_are_valid(start, end):
    assert planner.check_time_window(start, end) == (planner.to_min(start), planner.to_min(end))


def test_times_are_saved_in_the_user_profile(places, emma):
    course, items = planner.new_course(places, emma, "14:00", "17:00")
    assert (course["user_profile"]["start_time"], course["user_profile"]["end_time"]) == ("14:00", "17:00")
    assert "duration" not in course["user_profile"]
    assert items[0]["start_time"] == "14:00"
    assert span(items[-1])[1] <= planner.to_min("17:00")


@pytest.mark.parametrize("minutes, expected", [
    (120, (2, 2)), (240, (3, 4)), (270, (3, 4)), (480, (5, 7)), (600, (7, 9)),
])
def test_stop_counts_follow_fr6(minutes, expected):
    assert planner.item_bounds(minutes) == expected


# ----------------------------------------------------------------------------- US-T03 opening hours
def test_place_that_closes_before_the_stay_ends_is_left_out():
    """16:00-18:00 trip, a 90-minute place that closes at 17:00."""
    closes_early = tiny_place(1, 33.4996, "09:00", "17:00", stay=90)
    others = [tiny_place(2, 33.5000, "09:00", "20:00"), tiny_place(3, 33.5004, None, None)]
    assert closes_early not in planner.hours_filter([closes_early] + others, 16 * 60, 18 * 60)
    _, items = planner.new_course([closes_early] + others, EASY, "16:00", "18:00")
    assert items and 1 not in [i["place_id"] for i in items]


def test_overlap_shorter_than_the_stay_is_filtered():
    late = tiny_place(1, 33.4996, "17:30", "22:00", stay=60)     # 30 minutes of an 16:00-18:00 trip
    fits = tiny_place(2, 33.5000, "17:00", "22:00", stay=60)     # exactly 60 minutes
    always = tiny_place(3, 33.5004, None, None, stay=600)        # null always passes
    assert planner.hours_filter([late, fits, always], 16 * 60, 18 * 60) == [fits, always]


def test_rule_planner_waits_for_no_one_and_never_arrives_early():
    opens_late = tiny_place(1, 33.4996, "11:00", "20:00")   # the trip starts at 10:00
    open_now = tiny_place(2, 33.5000, "09:00", "20:00")
    by_id = {1: opens_late, 2: open_now}
    _, items = planner.new_course([opens_late, open_now], EASY, "10:00", "12:00")
    assert items[0]["place_id"] == 2
    assert_inside_hours(items, by_id)


def test_schedule_drops_closed_stops_and_times_the_rest_again():
    a = tiny_place(1, 33.4996, "09:00", "20:00")
    closed = tiny_place(2, 33.5000, "09:00", "11:30")       # would run 11:05-12:05
    c = tiny_place(3, 33.5004, None, None)
    by_id = {1: a, 2: closed, 3: c}
    ctx = planner.TripCtx(profile=EASY, start_min=600, end_min=900, min_items=1, max_items=3, needs_lunch=False)
    entries = [LLMItem(place_id=n, order=n, stay_min=60, reason_en="x") for n in (1, 2, 3)]
    rows = planner.schedule(entries, by_id, ctx)
    assert [r["place_id"] for r in rows] == [1, 3]
    move = planner.move_between(a, c, 30)
    assert (rows[1]["move_method"], rows[1]["move_min"]) == move
    assert rows[1]["start_time"] == planner.to_hhmm(planner.round_up5(660 + move[1]))   # timed from stop 1, not stop 2
    assert not any(k.startswith("_") for r in rows for k in r)


def test_no_open_stop_at_all_is_409():
    by_id = {1: tiny_place(1, 33.4996, "18:00", "22:00")}
    ctx = planner.TripCtx(profile=EASY, start_min=600, end_min=900, min_items=1, max_items=1, needs_lunch=False)
    with pytest.raises(ApiError) as e:
        planner.schedule([LLMItem(place_id=1, order=1, stay_min=60, reason_en="x")], by_id, ctx)
    assert (e.value.status_code, e.value.detail["code"]) == (409, "NO_CANDIDATES")


def test_llm_gets_the_hours_and_its_closed_picks_are_removed(monkeypatch):
    a = tiny_place(1, 33.4996, "09:00", "20:00")
    closed = tiny_place(2, 33.5000, "09:00", "11:30")
    c = tiny_place(3, 33.5004, None, None)
    seen = {}

    def fake(llm_input):
        seen.update(llm_input)
        return LLMCourse(items=[LLMItem(place_id=n, order=n, stay_min=60, reason_en="x") for n in (1, 2, 3)])

    monkeypatch.setattr(config, "USE_LLM", True)
    monkeypatch.setattr(planner, "call_llm", fake)
    _, items = planner.new_course([a, closed, c], EASY, "10:00", "15:00")
    assert [i["place_id"] for i in items] == [1, 3]
    assert {(x["id"], x["open_time"], x["close_time"]) for x in seen["candidates"]} == \
           {(1, "09:00", "20:00"), (2, "09:00", "11:30"), (3, None, None)}
    assert (seen["trip"]["start_time"], seen["trip"]["end_time"], seen["trip"]["time_budget_min"]) == \
           ("10:00", "15:00", 300)


def all_windows():
    lo, hi, last = (planner.to_min(t) for t in (config.MIN_START, config.MAX_START, config.MAX_END))
    for start in range(lo, hi + 1, config.TIME_STEP_MIN):
        for end in range(start + config.MIN_TRIP_MIN, min(start + config.MAX_TRIP_MIN, last) + 1, config.TIME_STEP_MIN):
            yield planner.to_hhmm(start), planner.to_hhmm(end)


@pytest.mark.parametrize("profile", [EASY, dict(EASY, interests=["food", "cafe", "market"], diet="vegan"),
                                     dict(EASY, fitness_level=1, condition_today="tired", avoid_slopes=True)])
def test_every_allowed_window_stays_inside_trip_time_and_opening_hours(places, by_id, profile):
    """PRD 8: no stop outside the trip time or the opening hours, for any start/end pair."""
    built = 0
    for start, end in all_windows():
        try:
            _, items = planner.new_course(places, profile, start, end)
        except ApiError as e:
            assert e.detail["code"] == "NO_CANDIDATES"
            continue
        built += 1
        assert items[0]["start_time"] == start
        assert all(planner.to_min(start) <= span(i)[0] and span(i)[1] <= planner.to_min(end) for i in items), (start, end)
        assert_inside_hours(items, by_id)
        assert len(items) <= planner.item_bounds(planner.to_min(end) - planner.to_min(start))[1]
    assert built > 100


def test_a_course_can_start_after_1400(places, by_id, emma):
    _, items = planner.new_course(places, emma, "15:30", "19:00")
    assert items[0]["start_time"] == "15:30" and span(items[-1])[1] <= planner.to_min("19:00")
    assert_inside_hours(items, by_id)


# ----------------------------------------------------------------------------- US-T04 replan
@pytest.mark.parametrize("reason", ["rain", "tired", "closed", "hungry"])
def test_replan_of_a_new_course_uses_the_saved_end_time(places, by_id, emma, reason):
    course, items = planner.new_course(places, emma, "09:00", "15:00")
    res = planner.replan(places, course, items, reason, 2)
    after = merged(items, res)
    assert res.user_profile["end_time"] == "15:00"
    assert res.new_items
    assert_inside_hours(res.new_items, by_id)
    if reason in ("rain", "tired"):        # closed / hungry always get their fixed first stop (10.7)
        assert all(span(i)[1] <= planner.to_min("15:00") for i in after)


def test_replan_of_an_old_course_still_uses_duration(places, by_id, emma):
    """A course saved before this change: `duration`, no start_time / end_time."""
    course, items = planner.new_course(places, emma, "10:00", "18:00")
    old = copy.deepcopy(course)
    for key in ("start_time", "end_time"):
        old["user_profile"].pop(key)
    old["user_profile"]["duration"] = "half_day"          # 10:00 + 240 min = 14:00
    res = planner.replan(places, old, items, "rain", 1)
    after = merged(items, res)
    assert res.new_items and "end_time" not in res.user_profile
    assert all(span(i)[1] <= planner.to_min("14:00") for i in after)
    assert_inside_hours(res.new_items, by_id)

    old["user_profile"]["duration"] = "full_day"          # 10:00 + 480 min = 18:00
    full = merged(items, planner.replan(places, old, items, "rain", 1))
    assert all(span(i)[1] <= planner.to_min("18:00") for i in full)
    assert max(span(i)[1] for i in full) > planner.to_min("14:00")


def test_replan_does_not_send_the_traveler_to_a_closed_place():
    """Closed at 17:00: the nearest same-category place shuts at 17:30, the farther one is open."""
    here = tiny_place(1, 33.4996, "09:00", "20:00")
    near_but_closing = tiny_place(2, 33.4998, "09:00", "17:30")
    open_late = tiny_place(3, 33.5010, "09:00", "21:00")
    places = [here, near_but_closing, open_late]
    course = {"id": "c", "user_profile": dict(EASY, conditions={"indoor_only": False, "low_walking": False},
                                              start_time="16:00", end_time="19:00")}
    items = [{"course_id": "c", "order": 1, "place_id": 1, "start_time": "17:00", "stay_min": 60,
              "move_method": None, "move_min": None, "reason_en": "x", "is_rest_stop": False, "status": "current"}]
    res = planner.replan(places, course, items, "closed", 1)
    assert [i["place_id"] for i in res.new_items][0] == 3
