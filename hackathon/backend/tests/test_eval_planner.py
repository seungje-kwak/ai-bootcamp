"""tasks/prd-recommendation-p0.md US-R01 and US-R02: the eval script's metrics and its LLM guard.
Never calls a real LLM."""
from __future__ import annotations

import json
import sys

import pytest

from app import config, planner
from app.llm import LLMError
from app.schemas import LLMCourse, LLMItem

from conftest import BACKEND

sys.path.insert(0, str(BACKEND / "scripts"))
import eval_planner as ev  # noqa: E402


def place(pid: int, category: str, lat: float, lng: float = 126.5, area_id: str = "a", avg: int = 60) -> dict:
    return {"id": pid, "category": category, "lat": lat, "lng": lng, "area_id": area_id, "avg_stay_min": avg}


def item(pid: int, stay: int, method=None, mins=None, start: str = "10:00") -> dict:
    return {"place_id": pid, "stay_min": stay, "move_method": method, "move_min": mins, "start_time": start}


def gap(meal: str, start: str, end: str) -> dict:
    return {"meal": meal, "start_time": start, "end_time": end, "reason": "none_nearby", "message_en": "x"}


# ----------------------------------------------------------------------------- US-R01 / US-P01 metrics
def test_metrics_of_two_hand_made_courses():
    # 5 places in one area; ids 1..5 -> id ranks 0, .25, .5, .75, 1
    ps = [place(1, "food", 33.50), place(2, "nature", 33.51), place(3, "cafe", 33.52, avg=40),
          place(4, "culture", 33.53), place(5, "nature", 33.54)]
    by_id = {p["id"]: p for p in ps}
    nature_none = {"interests": ["nature"], "condition_today": "normal", "diet": "none"}
    cafe_tired = {"interests": ["cafe", "food"], "condition_today": "tired", "diet": "none"}
    runs = [
        # 09:00-18:00 (lunch): food 1 at 12:00 -> nature 2 (walk 10) -> nature 5 (taxi 20)
        ev.Run(ev.Scenario("a", nature_none, "09:00", "18:00"),
               items=[item(1, 60, start="12:00"), item(2, 60, "walk", 10, "13:10"),
                      item(5, 60, "taxi", 20, "14:30")]),
        # 13:00-19:00 (dinner, missed): cafe 3 -> culture 4 (taxi 15)
        ev.Run(ev.Scenario("a", cafe_tired, "13:00", "19:00"),
               items=[item(3, 30, start="13:00"), item(4, 60, "taxi", 15, "13:45")]),
        ev.Run(ev.Scenario("a", nature_none, "10:00", "14:00"), error="NO_CANDIDATES"),
    ]
    m = ev.metrics(runs, by_id, {"a": ps})
    assert m["runs"] == 3
    assert m["success_rate"] == pytest.approx(2 / 3, abs=1e-4)
    assert m["lunch_rate"] == 1.0                         # only run 1 needs lunch, food arrives 12:00
    assert m["dinner_rate"] == 0.0                        # run 2 needs dinner and has no food
    assert m["meal_miss_rate"] == 0.5 and m["meal_gap_rate"] == 0.0
    assert m["cafe_rate"] == 1.0                          # only run 2 counts (cafe interest, tired)
    assert m["interest_rate"] == pytest.approx((2 / 3 + 1 / 2) / 2, abs=1e-4)
    assert m["same_cat_adj"] == pytest.approx(1 / 3, abs=1e-4)   # nature-nature of 3 pairs
    assert m["taxi_legs"] == 1.0                          # (1 + 1) / 2
    assert m["move_min"] == 22.5                          # (30 + 15) / 2
    assert m["max_leg_min"] == 20
    d15 = planner.haversine_m(33.50, 126.5, 33.54, 126.5) / 1000
    d34 = planner.haversine_m(33.52, 126.5, 33.53, 126.5) / 1000
    assert m["spread_km"] == pytest.approx((d15 + d34) / 2, abs=1e-3)
    assert m["idle_min"] == pytest.approx(((540 - 180 - 30) + (360 - 90 - 15)) / 2)
    assert m["stretched_min"] == pytest.approx((0 + (90 - 100)) / 2)
    assert m["id_rank"] == pytest.approx((0 + .25 + 1 + .5 + .75) / 5)
    assert m["distinct_courses"] == 2
    assert m["place_coverage"] == 1.0
    assert m["seed_overlap"] is None                      # no --diversity


def test_meal_filled_by_food_by_a_free_time_and_missed():
    ps = [place(1, "food", 33.50), place(2, "food", 33.51), place(3, "nature", 33.52)]
    by_id = {p["id"]: p for p in ps}
    none = {"interests": ["nature"], "condition_today": "normal", "diet": "none"}
    vegan = dict(none, diet="vegan")
    runs = [
        # 11:00-20:00 needs lunch and dinner: lunch food at 12:00, dinner food at 18:00
        ev.Run(ev.Scenario("a", none, "11:00", "20:00"),
               items=[item(1, 60, start="12:00"), item(3, 60, "walk", 5, "14:00"), item(2, 60, "walk", 5, "18:00")]),
        # vegan 11:00-20:00: lunch is a free time, dinner is missed (food at 16:00 is outside 17:30-19:30)
        ev.Run(ev.Scenario("a", vegan, "11:00", "20:00"),
               items=[item(3, 60, start="11:00"), item(2, 60, "walk", 5, "16:00")],
               meal_gaps=[gap("lunch", "12:05", "12:50")]),
    ]
    m = ev.metrics(runs, by_id, {"a": ps})
    assert m["lunch_rate"] == 1.0 and m["dinner_rate"] == 1.0          # diet=none run only
    assert m["meal_gap_rate"] == pytest.approx(1 / 4)                  # 4 meals needed, 1 free time
    assert m["meal_miss_rate"] == pytest.approx(1 / 4)                 # the vegan dinner
    assert m["diet_meal_rate"] == 0.0                                  # vegan: no meal filled by food
    # the free time counts as busy time
    assert m["idle_min"] == pytest.approx(((540 - 180 - 10) + (540 - 120 - 5 - 45)) / 2)


def test_seed_overlap_is_the_mean_jaccard_of_the_two_seeds():
    ps = [place(n, "nature", 33.5 + n / 100) for n in range(1, 6)]
    prof = {"interests": ["nature"], "condition_today": "normal", "diet": "none"}
    runs = [ev.Run(ev.Scenario("a", prof, "13:00", "17:00"), items=[item(1, 60), item(2, 60)],
                   alt_items=[item(2, 60), item(3, 60)]),                          # 1/3
            ev.Run(ev.Scenario("a", prof, "13:00", "17:00"), items=[item(4, 60)], alt_items=[item(4, 60)])]  # 1
    m = ev.metrics(runs, {p["id"]: p for p in ps}, {"a": ps})
    assert m["seed_overlap"] == pytest.approx((1 / 3 + 1) / 2, abs=1e-4)


def test_one_stop_course_has_zero_spread_and_rates_skip_runs_that_do_not_count():
    ps = [place(1, "nature", 33.5), place(2, "nature", 33.6)]
    vegan = {"interests": ["nature"], "condition_today": "normal", "diet": "vegan"}
    runs = [ev.Run(ev.Scenario("a", vegan, "09:00", "18:00"), items=[item(1, 60)])]
    m = ev.metrics(runs, {p["id"]: p for p in ps}, {"a": ps})
    assert m["spread_km"] == 0.0 and m["lunch_rate"] is None and m["cafe_rate"] is None
    assert m["same_cat_adj"] is None
    assert m["place_coverage"] == 0.5


def test_scenarios_are_1200_in_area_profile_window_order():
    area_ids = [f"area{n}" for n in range(12)]
    sc = ev.scenarios(area_ids)
    assert len(sc) == 1200
    assert [s.area_id for s in sc[:100]] == ["area0"] * 100
    assert [(s.start_time, s.end_time) for s in sc[:5]] == [
        ("09:00", "18:00"), ("10:00", "14:00"), ("13:00", "19:00"), ("14:00", "21:00"), ("11:00", "20:00")]
    assert sc[0].profile == {"interests": ["nature"], "condition_today": "normal", "diet": "none",
                             "fitness_level": 2, "max_walk_min": 20, "avoid_slopes": False}


def test_limit_picks_one_every_len_over_n():
    assert ev.pick(list(range(720)), 30) == list(range(0, 720, 24))
    assert ev.pick(list(range(10)), None) == list(range(10))


def test_rule_eval_writes_the_same_json_twice(tmp_path):
    a, b = tmp_path / "a.json", tmp_path / "b.json"
    assert ev.main(["--limit", "24", "--out", str(a)]) == 0
    assert ev.main(["--limit", "24", "--out", str(b)]) == 0
    assert a.read_bytes() == b.read_bytes()
    data = json.loads(a.read_text(encoding="utf-8"))
    assert (data["planner"], data["weekday"], data["label"], data["scenarios"]) == ("rules", "wed", "rules", 24)
    assert (data["seed"], data["diversity"]) == (1, False)
    assert set(ev.METRIC_KEYS) <= set(data["overall"])
    assert config.USE_LLM is False and planner.today_kst_dow() == "none"   # restored afterwards


# ----------------------------------------------------------------------------- US-R02 LLM guard
class FakeClock:
    def __init__(self):
        self.t = 0.0
        self.sleeps: list[float] = []

    def now(self) -> float:
        return self.t

    def sleep(self, s: float) -> None:
        self.sleeps.append(s)
        self.t += s


def good_answer(llm_input: dict) -> LLMCourse:
    ids = [c["id"] for c in llm_input["candidates"]][:2]
    return LLMCourse(items=[LLMItem(place_id=i, order=n, stay_min=30, reason_en="ok")
                            for n, i in enumerate(ids, start=1)])


@pytest.fixture()
def llm_eval(monkeypatch, tmp_path):
    """Runs the eval with --llm and a fake call_llm. Returns (run, starts) where starts are call times."""
    monkeypatch.setattr(config, "LLM_API_KEY", "fake-key")
    clock = FakeClock()
    starts: list[float] = []

    def run(answer, *extra):
        def fake(llm_input):
            starts.append(clock.now())
            clock.t += 1.5                     # the call itself takes 1.5 s
            return answer(llm_input, len(starts))
        monkeypatch.setattr(planner, "call_llm", fake)
        out = tmp_path / "llm.json"
        code = ev.main(["--llm", "--out", str(out), *extra], clock=clock.now, sleep=clock.sleep)
        data = json.loads(out.read_text(encoding="utf-8")) if out.exists() else None
        return code, data

    return run, starts


def test_429_stops_at_that_scenario(llm_eval):
    run, starts = llm_eval

    def answer(inp, n):
        if n == 3:
            raise LLMError("too many", status=429)
        return good_answer(inp)
    code, data = run(answer, "--limit", "5")
    assert code == 1
    assert data["aborted"] is True and data["abort_reason"] == "rate_limit"
    assert data["scenarios_done"] == 2 and data["llm_calls"] == len(starts) == 3   # no retry after 429


def test_quota_error_stops_with_quota(llm_eval):
    run, _ = llm_eval

    def answer(inp, n):
        raise LLMError("out of quota", status=429, quota=True)
    code, data = run(answer, "--limit", "3")
    assert code == 1 and data["abort_reason"] == "quota" and data["scenarios_done"] == 0


def test_three_failures_in_a_row_stop_the_eval(llm_eval):
    run, starts = llm_eval

    def answer(inp, n):
        raise LLMError("bad json")
    code, data = run(answer, "--limit", "5")
    # scenario 1: two failures -> LLM_FAILED. scenario 2: the third failure stops the eval
    assert code == 1 and data["abort_reason"] == "consecutive_failures"
    assert data["scenarios_done"] == 1 and data["llm_failed"] == 1.0
    assert data["llm_calls"] == len(starts) == 3


def test_two_failures_then_a_success_keep_going(llm_eval):
    run, starts = llm_eval

    def answer(inp, n):
        if n in (1, 2, 4, 5):
            raise LLMError("bad json")
        return good_answer(inp)
    code, data = run(answer, "--limit", "4")
    assert code == 0 and data["aborted"] is False and data["abort_reason"] is None
    assert data["scenarios_done"] == 4
    assert data["llm_calls"] == len(starts)


def test_rpm_10_keeps_call_starts_6_seconds_apart(llm_eval):
    run, starts = llm_eval
    code, data = run(lambda inp, n: good_answer(inp), "--limit", "4", "--rpm", "10")
    assert code == 0 and len(starts) == 4
    assert all(b - a >= 6.0 for a, b in zip(starts, starts[1:]))
    assert data["latency_sec"] == 1.5                       # the waiting time is not in it
    assert data["llm_calls"] == 4 and data["limit"] == 4 and data["rpm"] == 10
    assert data["label"] == f"llm-{config.LLM_MODEL}" and data["model"] == config.LLM_MODEL


def test_limit_over_200_never_calls_the_llm(llm_eval):
    run, starts = llm_eval
    code, data = run(lambda inp, n: good_answer(inp), "--limit", "201")
    assert code != 0 and starts == [] and data is None


def test_llm_default_limit_is_30(llm_eval, capsys):
    run, starts = llm_eval
    code, data = run(lambda inp, n: good_answer(inp), "--rpm", "600")
    assert code == 0 and data["scenarios"] == 30 and data["llm_calls"] == len(starts) == 30
    assert "LLM calls: up to 60 (30 scenarios, 1 retry each), 600 per minute" in capsys.readouterr().out


def test_llm_without_a_key_stops_before_any_call(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "LLM_API_KEY", "")
    called = []
    monkeypatch.setattr(planner, "call_llm", lambda inp: called.append(1))
    assert ev.main(["--llm", "--out", str(tmp_path / "x.json")]) != 0 and called == []


def test_diversity_runs_a_second_seed_and_records_it(tmp_path):
    out = tmp_path / "d.json"
    assert ev.main(["--limit", "12", "--seed", "3", "--diversity", "--out", str(out)]) == 0
    data = json.loads(out.read_text(encoding="utf-8"))
    assert (data["seed"], data["diversity"]) == (3, True)
    assert 0.0 <= data["overall"]["seed_overlap"] <= 1.0
    assert data["overall"]["meal_miss_rate"] == 0.0
