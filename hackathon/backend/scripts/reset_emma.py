"""Reset the Emma demo course to its starting state (13.5, US-15).

Run before every rehearsal and right before the presentation:
    backend/.venv/Scripts/python.exe backend/scripts/reset_emma.py
Writes to Supabase. SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in backend/.env.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app import planner  # noqa: E402
from app.schemas import LLMItem  # noqa: E402
from app.store import get_store, now_iso  # noqa: E402

DEMO = BACKEND.parent / "data" / "demo" / "emma_course.json"


def main() -> int:
    demo = json.loads(DEMO.read_text(encoding="utf-8"))
    store = get_store()
    places = {p["id"]: p for p in store.list_places()}
    missing = [i["place_id"] for i in demo["items"] if i["place_id"] not in places]
    if missing:
        print(f"ERROR: places not in DB: {missing}")
        return 1

    profile = demo["user_profile"]
    start, end = planner.check_time_window(profile["start_time"], profile["end_time"])
    ctx = planner.TripCtx(profile=profile, start_min=start, end_min=end,
                          min_items=1, max_items=len(demo["items"]), needs_lunch=False)
    entries = [LLMItem(place_id=i["place_id"], order=n, stay_min=places[i["place_id"]]["avg_stay_min"],
                       reason_en=i["reason_en"]) for n, i in enumerate(demo["items"], start=1)]
    rows = planner.schedule(entries, places, ctx)
    if len(rows) != len(entries):  # schedule() drops stops outside the trip time or their opening hours
        kept = {r["place_id"] for r in rows}
        print(f"ERROR: stops outside the trip time or opening hours: "
              f"{[e.place_id for e in entries if e.place_id not in kept]}")
        return 1

    course = {"id": demo["id"], "user_profile": demo["user_profile"], "tier": demo["tier"], "created_at": now_iso()}
    items = [{"course_id": demo["id"], "order": n, **r, "status": "current" if n == 1 else "upcoming"}
             for n, r in enumerate(rows, start=1)]
    store.replace_course(course, items)

    print(f"Emma course reset: /course/{demo['id']}")
    for it in items:
        p = places[it["place_id"]]
        move = f"{it['move_min']} min {it['move_method']}" if it["move_method"] else "start"
        print(f"  {it['order']} {it['start_time']}  {p['name_en'][:34]:34} ({move}, stay {it['stay_min']})"
              f"{'  [indoor]' if p['accessibility']['indoor'] else ''}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
