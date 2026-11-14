"""MyPace Jeju API (9장). Run: uvicorn app.main:app --reload --port 8000"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import areas, config, planner
from .course_view import build_course
from .errors import ApiError
from .schemas import CreateCourseRequest, PurchaseRequest, ReplanRequest, ReportRequest
from .store import get_store

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("mypace")

app = FastAPI(title="MyPace Jeju API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    get_store()  # fail at startup, not on the first request, when Supabase is not configured
    log.info("store=supabase llm=%s provider=%s model=%s require_verified=%s",
             "on" if config.USE_LLM else "off (rule planner)", config.LLM_PROVIDER, config.LLM_MODEL,
             config.REQUIRE_VERIFIED)


def _course_response(course_id: str) -> dict:
    store = get_store()
    course = store.get_course(course_id)
    if course is None:
        raise ApiError(404, "COURSE_NOT_FOUND", "Course not found.")
    return build_course(course, store.get_items(course_id), store.list_places(), store.list_phrase_cards())


@app.get("/")
def health() -> dict:
    return {"ok": True, "store": "supabase",
            "llm": f"{config.LLM_PROVIDER}:{config.LLM_MODEL}" if config.USE_LLM else False}


@app.get("/areas")
def list_areas() -> dict:
    store = get_store()
    return {"areas": areas.summaries(store.list_areas(), store.list_places())}


@app.get("/places")
def list_places(area_id: Optional[str] = None) -> dict:
    places = get_store().list_places()
    if area_id is not None:
        places = [p for p in places if p["area_id"] == area_id]
    return {"places": places}


@app.post("/courses", status_code=201)
def create_course(req: CreateCourseRequest) -> dict:
    store = get_store()
    places = store.list_places()
    areas.check_area(req.area_id, store.list_areas(), places)
    course, items = planner.new_course(places, req.user_profile.model_dump(), req.start_time, req.end_time,
                                       req.area_id)
    store.create_course(course, items)
    return _course_response(course["id"])


@app.get("/courses/{course_id}")
def get_course(course_id: str) -> dict:
    return _course_response(course_id)


@app.post("/courses/{course_id}/replan")
def replan_course(course_id: str, req: ReplanRequest) -> dict:
    store = get_store()
    course = store.get_course(course_id)
    if course is None:
        raise ApiError(404, "COURSE_NOT_FOUND", "Course not found.")
    items = store.get_items(course_id)
    # Plan first; the DB changes only after the new items are ready (10.7 step 5).
    result = planner.replan(store.list_places(), course, items, req.reason, req.current_order)
    store.apply_replan(course_id, result.user_profile, result.statuses, result.delete_orders,
                       result.new_items, result.report_place_id)
    return _course_response(course_id)


@app.post("/places/{place_id}/report", status_code=201)
def report_place(place_id: int, req: ReportRequest) -> dict:
    store = get_store()
    if not any(p["id"] == place_id for p in store.list_places()):
        raise ApiError(404, "PLACE_NOT_FOUND", "Place not found.")
    return store.add_report(place_id, req.type)


@app.post("/purchase")
def purchase(req: PurchaseRequest) -> dict:
    """Mock payment: no payment data is accepted or stored (11.2)."""
    store = get_store()
    if store.get_course(req.course_id) is None:
        raise ApiError(404, "COURSE_NOT_FOUND", "Course not found.")
    store.set_tier(req.course_id, "premium")
    return _course_response(req.course_id)
