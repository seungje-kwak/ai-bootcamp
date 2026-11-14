"""Offline checks for tasks/prd-start-area.md (US-A01 to US-A04): areas, area of a place, area API, courses in one area."""
from __future__ import annotations

import sys

import pytest

from app import areas, config, planner, store
from app.schemas import CreateCourseRequest, LLMCourse, LLMItem

from conftest import BACKEND

sys.path.insert(0, str(BACKEND / "scripts"))
import build_places  # noqa: E402

EASY = {"interests": ["nature", "culture"], "fitness_level": 3, "max_walk_min": 30, "avoid_slopes": False,
        "condition_today": "great", "diet": "none"}
AREA_IDS = ["jeju-city", "hallim", "aewol", "gujwa", "jocheon", "hangyeong", "chuja", "udo",
            "seogwipo-city", "daejeong", "namwon", "seongsan", "andeok", "pyoseon"]


def merged(items: list[dict], res: planner.ReplanResult) -> list[dict]:
    kept = [dict(i, status=res.statuses[i["order"]]) for i in items if i["order"] not in res.delete_orders]
    return sorted(kept + res.new_items, key=lambda i: i["order"])


def made_place(pid: int, area_id: str, category: str = "culture", lat: float = 33.46, lng: float = 126.33,
               solo_ok: bool = True, indoor: bool = True) -> dict:
    """A made-up place. `lat` moves it north: 0.001 is about 110 m."""
    food = None
    if category in ("food", "cafe"):
        food = {"solo_ok": solo_ok, "vegan": False, "vegetarian": False, "halal": False, "english_menu": False,
                "signature_menu_en": None, "allergens": None}
    return {
        "id": pid, "name_en": f"Place {pid}", "name_ko": f"장소 {pid}", "category": category,
        "description_en": "A test place.", "lat": lat, "lng": lng, "address_ko": "제주시", "area_id": area_id,
        "image_url": None, "image_source": None, "avg_stay_min": 30, "opening_hours": None,
        "open_time": None, "close_time": None, "closed_days": [], "price_level": None,
        "last_verified_at": None, "source_date": None,
        "accessibility": {"walking_level": 1, "terrain": "flat", "has_stairs": None, "wheelchair_ok": None,
                          "indoor": indoor, "has_seating": None, "restroom": None,
                          "nearest_public_restroom_m": None, "fatigue_score": 1},
        "food_options": food,
    }


def ready_area(area_id: str, first_id: int = 1) -> list[dict]:
    """Ten places that meet FR-4 exactly: 3 food (2 solo), 1 café, 6 others, all flat and indoor."""
    cats = ["food", "food", "food", "cafe"] + ["culture"] * 6
    return [made_place(first_id + n, area_id, c, lat=33.46 + n * 0.001, solo_ok=n != 2) for n, c in enumerate(cats)]


# ----------------------------------------------------------------------------- US-A01 areas and area of a place
def test_the_14_areas_are_stored_in_table_order():
    rows = areas.load_seed_areas()
    assert [a["id"] for a in rows] == AREA_IDS
    assert [a["sort_order"] for a in rows] == list(range(1, 15))
    assert [a["group"] for a in rows] == ["jeju"] * 8 + ["seogwipo"] * 6
    for a in rows:
        assert a["name_en"] and a["name_ko"] and 0 < len(a["description_en"]) <= 80
        assert build_places.in_bounds(a["center_lat"], a["center_lng"]), a["id"]


def test_schema_sql_has_the_same_areas():
    sql = (BACKEND / "sql" / "schema.sql").read_text(encoding="utf-8")
    for a in areas.load_seed_areas():
        assert f"('{a['id']}', '{a['group']}', '{a['name_en']}', '{a['name_ko']}'" in sql, a["id"]


@pytest.mark.parametrize("address, area_id", [
    ("제주특별자치도 제주시 애월읍 애월해안로 100", "aewol"),
    ("제주특별자치도 제주시 용두암길 15 (용담이동)", "jeju-city"),
    ("제주특별자치도 서귀포시 성산읍 일출로 284-12", "seongsan"),
    ("제주특별자치도 서귀포시 중문동 2624-1", "seogwipo-city"),
    ("제주특별자치도 제주시 우도면 우도해안길 1", "udo"),
    ("제주특별자치도 서귀포시 안덕면 사계리", "andeok"),
    ("", None),
    ("부산광역시 해운대구", None),
])
def test_area_comes_from_the_address(address, area_id):
    assert areas.area_of_address(address) == area_id


def test_every_seed_place_has_the_area_of_its_address(places, by_id):
    for p in places:
        assert p["area_id"] in AREA_IDS and p["area_id"] == areas.area_of_address(p["address_ko"]), p["id"]
    # the places the app had before areas: inside the old Jeju City map range
    old_town = [p for p in places if p["id"] <= 74 and 33.46 <= p["lat"] <= 33.53 and 126.44 <= p["lng"] <= 126.56]
    assert len(old_town) >= 19 and all(p["area_id"] == "jeju-city" for p in old_town)


def test_build_stops_at_a_place_with_no_area_in_its_address(tmp_path, monkeypatch):
    seed = BACKEND.parent / "data" / "seed"
    for name in ("place_accessibility.csv", "food_options.csv", "phrase_cards.csv"):
        (tmp_path / name).write_bytes((seed / name).read_bytes())
    lines = (seed / "places.csv").read_text(encoding="utf-8-sig").splitlines()
    assert "제주특별자치도 제주시 용두암길 15 (용담이동)" in lines[1]
    lines[1] = lines[1].replace("제주특별자치도 제주시 용두암길 15 (용담이동)", "용두암길 15")
    (tmp_path / "places.csv").write_text("\n".join(lines[:2]) + "\n", encoding="utf-8")
    monkeypatch.setattr(build_places, "SEED", tmp_path)
    monkeypatch.setattr(build_places, "OUT", tmp_path / "out")
    with pytest.raises(ValueError, match="cannot tell the area"):
        build_places.main()
    assert not (tmp_path / "out").exists()


# ----------------------------------------------------------------------------- US-A02 bounds
def test_seed_bounds_cover_all_of_jeju():
    assert build_places.BOUNDS == {"lngMin": 126.10, "lngMax": 127.00, "latMin": 33.10, "latMax": 34.00}
    map_ts = (BACKEND.parent / "frontend" / "config" / "map.ts").read_text(encoding="utf-8")
    assert "bounds: { lngMin: 126.1, lngMax: 127.0, latMin: 33.1, latMax: 34.0 }" in map_ts   # FR-10: same values


# ----------------------------------------------------------------------------- US-A03 GET /areas
def test_summaries_list_all_areas_and_mark_the_ready_ones():
    rows = areas.summaries(areas.load_seed_areas(), ready_area("aewol") + ready_area("udo", 100)[:9])
    assert [a["id"] for a in rows] == AREA_IDS
    assert set(rows[0]) == {"id", "group", "name_en", "name_ko", "description_en", "center_lat", "center_lng",
                            "place_count", "selectable"}
    got = {a["id"]: (a["place_count"], a["selectable"]) for a in rows}
    assert got["aewol"] == (10, True)
    assert got["udo"] == (9, False)                # nine places: one short of FR-4
    assert got["chuja"] == (0, False)


@pytest.mark.parametrize("change", ["one_solo_food", "no_cafe", "two_indoor", "three_easy"])
def test_area_is_not_ready_when_one_fr4_count_is_short(change, monkeypatch):
    monkeypatch.setattr(config, "AREA_MIN_SOLO_FOOD", 2)          # the FR-4 value, whatever config.py has now
    ps = ready_area("aewol") + [made_place(50, "aewol")]          # 11 places, so the total is never the reason
    if change == "one_solo_food":
        ps[1]["food_options"]["solo_ok"] = False
    elif change == "no_cafe":
        ps[3]["category"] = "culture"
    elif change == "two_indoor":
        for p in ps[2:]:
            p["accessibility"]["indoor"] = False
    else:
        for p in ps[3:]:
            p["accessibility"]["terrain"] = "slope"
    row = next(a for a in areas.summaries(areas.load_seed_areas(), ps) if a["id"] == "aewol")
    assert row == dict(row, place_count=11, selectable=False)


def test_check_area_rejects_unknown_and_unready_areas():
    rows, ps = areas.load_seed_areas(), ready_area("aewol")
    areas.check_area("aewol", rows, ps)
    for bad in ("udo", "tapdong", ""):
        with pytest.raises(planner.ApiError) as e:
            areas.check_area(bad, rows, ps)
        assert (e.value.status_code, e.value.detail["code"]) == (422, "INVALID_AREA")


class FakeStore:
    def __init__(self, places: list[dict]) -> None:
        self.places, self.courses, self.items = places, {}, {}

    def list_places(self):
        return [dict(p) for p in self.places]

    def list_areas(self):
        return areas.load_seed_areas()

    def list_phrase_cards(self):
        return []

    def get_course(self, course_id):
        return self.courses.get(course_id)

    def get_items(self, course_id):
        return self.items.get(course_id, [])

    def create_course(self, course, items):
        self.courses[course["id"]], self.items[course["id"]] = course, items


@pytest.fixture()
def api(monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import app

    fake = FakeStore(ready_area("aewol") + ready_area("udo", 100)[:9])
    monkeypatch.setattr(store, "_store", fake)
    with TestClient(app) as client:
        yield client, fake


def test_areas_and_places_endpoints(api):
    client, _ = api
    rows = client.get("/areas").json()["areas"]
    assert [a["id"] for a in rows] == AREA_IDS
    assert [a["id"] for a in rows if a["selectable"]] == ["aewol"]
    assert len(client.get("/places").json()["places"]) == 19
    assert {p["area_id"] for p in client.get("/places", params={"area_id": "udo"}).json()["places"]} == {"udo"}
    assert client.get("/places", params={"area_id": "chuja"}).json()["places"] == []


# ----------------------------------------------------------------------------- US-A04 courses stay in one area
def test_request_needs_area_id(emma):
    body = {"user_profile": emma, "start_time": "10:00", "end_time": "14:00"}
    assert CreateCourseRequest.model_validate(dict(body, area_id="aewol")).area_id == "aewol"
    with pytest.raises(ValueError):
        CreateCourseRequest.model_validate(body)


def test_api_rejects_bad_areas_and_saves_the_area(api):
    client, fake = api
    body = {"user_profile": EASY, "start_time": "10:00", "end_time": "14:00"}
    for bad in ("udo", "nowhere"):
        r = client.post("/courses", json=dict(body, area_id=bad))
        assert (r.status_code, r.json()["detail"]["code"]) == (422, "INVALID_AREA")
    assert client.post("/courses", json=body).status_code == 422          # area_id is required
    assert fake.courses == {}

    r = client.post("/courses", json=dict(body, area_id="aewol"))
    assert r.status_code == 201
    course = r.json()
    assert course["user_profile"]["area_id"] == "aewol"
    assert fake.courses[course["id"]]["user_profile"]["area_id"] == "aewol"
    assert course["items"] and all(i["place"]["area_id"] == "aewol" for i in course["items"])


def test_aewol_course_and_its_replans_stay_in_aewol(places, by_id):
    course, items = planner.new_course(places, EASY, "10:00", "18:00", "aewol")
    assert course["user_profile"]["area_id"] == "aewol"
    assert len(items) >= 3 and all(by_id[i["place_id"]]["area_id"] == "aewol" for i in items)
    for reason in ("closed", "tired"):
        after = merged(items, planner.replan(places, course, items, reason, 2))
        assert len(after) > 2 and all(by_id[i["place_id"]]["area_id"] == "aewol" for i in after), reason


@pytest.mark.parametrize("reason", ["rain", "closed", "hungry", "tired"])
def test_replan_ignores_closer_places_of_another_area(reason):
    """Aewol has ten places; a Hallim place sits right next to each of them."""
    aewol = ready_area("aewol")
    hallim = [dict(p, id=p["id"] + 100, area_id="hallim", lat=p["lat"] + 0.0001) for p in ready_area("aewol")]
    course, items = planner.new_course(aewol + hallim, EASY, "14:00", "18:00", "aewol")
    after = merged(items, planner.replan(aewol + hallim, course, items, reason, 1))
    assert len(after) > 1 and all(i["place_id"] < 100 for i in after)


def test_no_candidates_instead_of_places_from_another_area(places):
    with pytest.raises(planner.ApiError) as e:
        planner.new_course(places, EASY, "10:00", "18:00", "chuja")       # no places there yet (FR-5)
    assert (e.value.status_code, e.value.detail["code"]) == (409, "NO_CANDIDATES")


def test_old_course_without_area_is_replanned_in_jeju_city(places, by_id, emma):
    course, items = planner.new_course(places, emma, "10:00", "18:00", "jeju-city")
    old = dict(course, user_profile={k: v for k, v in course["user_profile"].items() if k != "area_id"})
    after = merged(items, planner.replan(places, old, items, "rain", 1))
    assert len(after) > 1 and all(by_id[i["place_id"]]["area_id"] == "jeju-city" for i in after)


# ----------------------------------------------------------------------------- FR-9 long moves
def far_and_near() -> list[dict]:
    """Places 1-3 are a short walk apart. Place 4 is about 22 km north: more than 30 minutes by taxi."""
    ps = [made_place(n, "aewol", lat=33.46 + n * 0.001) for n in (1, 2, 3)] + [made_place(4, "aewol", lat=33.66)]
    assert planner.move_between(ps[0], ps[3], 30)[1] > config.MAX_MOVE_MIN
    return ps


def test_rule_planner_never_picks_a_stop_more_than_30_minutes_away():
    _, items = planner.new_course(far_and_near(), EASY, "10:00", "14:00", "aewol")
    assert sorted(i["place_id"] for i in items) == [1, 2, 3]
    assert all((i["move_min"] or 0) <= config.MAX_MOVE_MIN for i in items)


def test_llm_stop_that_is_too_far_is_removed_and_times_are_computed_again(monkeypatch):
    def fake(llm_input):
        return LLMCourse(items=[LLMItem(place_id=pid, order=n, stay_min=30, reason_en="ok")
                                for n, pid in enumerate([1, 4, 2, 3], start=1)])
    monkeypatch.setattr(config, "USE_LLM", True)
    monkeypatch.setattr(planner, "call_llm", fake)
    _, items = planner.new_course(far_and_near(), EASY, "10:00", "14:00", "aewol")
    assert [i["place_id"] for i in items] == [1, 2, 3]
    assert [i["start_time"] for i in items] == ["10:00", "10:35", "11:10"]
    assert [i["order"] for i in items] == [1, 2, 3]


def test_hungry_replan_does_not_send_the_traveler_to_a_far_restaurant():
    here, other = made_place(1, "aewol", lat=33.461), made_place(2, "aewol", lat=33.462)
    far_food = made_place(3, "aewol", "food", lat=33.66)
    course, items = planner.new_course([here, other], EASY, "14:00", "18:00", "aewol")
    with pytest.raises(planner.ApiError) as e:
        planner.replan([here, other, far_food], course, items, "hungry", 1)
    assert e.value.detail["code"] == "NO_CANDIDATES"
