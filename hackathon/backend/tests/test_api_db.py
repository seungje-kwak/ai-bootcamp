"""End-to-end API checks against the real Supabase project (US-02, US-09 to US-12).

Skipped unless MYPACE_DB_TESTS=1, because it writes to the shared database:
    MYPACE_DB_TESTS=1 backend/.venv/Scripts/python.exe -m pytest backend/tests/test_api_db.py
It deletes the course and the place_reports rows it created when it finishes. The Emma course is never touched.
"""
from __future__ import annotations

import os

import pytest

pytestmark = pytest.mark.skipif(os.getenv("MYPACE_DB_TESTS") != "1", reason="set MYPACE_DB_TESTS=1 to write to Supabase")

COURSE_KEYS = {"id", "tier", "created_at", "user_profile", "total_items", "locked_count", "items"}


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def sb():
    from app.store import get_store

    return get_store()._sb


def db_items(sb, course_id: str) -> list[dict]:
    rows = sb.table("course_items").select("*").eq("course_id", course_id).execute().data
    return sorted(rows, key=lambda i: i["order"])


def test_full_flow(client, sb, emma):
    by_id = {p["id"]: p for p in client.get("/places").json()["places"]}
    last_report = sb.table("place_reports").select("id").order("id", desc=True).limit(1).execute().data
    report_floor = last_report[0]["id"] if last_report else 0
    course_id = None
    try:
        # US-02: create, saved rows, same content on GET
        r = client.post("/courses", json={"user_profile": emma})
        assert r.status_code == 201 and COURSE_KEYS <= set(r.json())
        course = r.json()
        course_id = course["id"]
        rows = db_items(sb, course_id)
        assert len(rows) == course["total_items"] and all(i["place_id"] in by_id for i in rows)
        assert client.get(f"/courses/{course_id}").json() == course
        # US-11: free preview
        assert [i["order"] for i in course["items"]] == [1, 2, 3]
        assert course["locked_count"] == course["total_items"] - 3

        # US-09: rain
        r = client.post(f"/courses/{course_id}/replan", json={"reason": "rain", "current_order": 2})
        assert r.status_code == 200 and len(r.json()["items"]) <= 3
        rained = db_items(sb, course_id)
        assert [i["place_id"] for i in rained[:2]] == [i["place_id"] for i in rows[:2]]
        assert len(rained) > 2 and all(by_id[i["place_id"]]["accessibility"]["indoor"] for i in rained[2:])
        assert r.json()["user_profile"]["conditions"]["indoor_only"] is True

        # US-10: closed (after rain) + report row
        closed = rained[2]["place_id"]
        r = client.post(f"/courses/{course_id}/replan", json={"reason": "closed", "current_order": 3})
        assert r.status_code == 200
        after = db_items(sb, course_id)
        assert after[2]["place_id"] != closed and after[2]["status"] == "current"
        assert closed not in [i["place_id"] for i in after]
        assert by_id[after[2]["place_id"]]["accessibility"]["indoor"]
        new_reports = sb.table("place_reports").select("*").gt("id", report_floor).execute().data
        assert [(x["place_id"], x["type"]) for x in new_reports] == [(closed, "closed")]

        r = client.post(f"/places/{closed}/report", json={"type": "closed"})
        assert r.status_code == 201 and {"place_id", "type", "created_at"} <= set(r.json())
        assert client.post("/places/99999/report", json={"type": "closed"}).json()["detail"]["code"] == "PLACE_NOT_FOUND"

        # US-12: mock purchase
        r = client.post("/purchase", json={"course_id": course_id})
        assert r.status_code == 200 and r.json()["tier"] == "premium" and r.json()["locked_count"] == 0
        again = client.get(f"/courses/{course_id}").json()
        assert len(again["items"]) == again["total_items"] == len(after)
        assert client.post("/purchase", json={"course_id": course_id}).status_code == 200
    finally:
        if course_id:
            sb.table("course_items").delete().eq("course_id", course_id).execute()
            sb.table("courses").delete().eq("id", course_id).execute()
        sb.table("place_reports").delete().gt("id", report_floor).execute()


def test_unknown_course_is_404(client):
    for cid in ("00000000-0000-4000-8000-000000000000", "not-a-uuid"):
        r = client.get(f"/courses/{cid}")
        assert r.status_code == 404 and r.json()["detail"]["code"] == "COURSE_NOT_FOUND"


def test_bad_profile_is_422(client, emma):
    assert client.post("/courses", json={"user_profile": dict(emma, interests=[])}).status_code == 422
