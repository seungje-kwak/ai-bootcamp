"""Upload app/data/places.json + phrase_cards.json to Supabase (upsert, safe to re-run).

Prereq: run sql/schema.sql in the Supabase SQL editor and put SUPABASE_URL / SUPABASE_SERVICE_KEY in backend/.env.
    backend/.venv/Scripts/python.exe backend/scripts/build_places.py
    backend/.venv/Scripts/python.exe backend/scripts/seed_supabase.py
    backend/.venv/Scripts/python.exe backend/scripts/reset_emma.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app import config  # noqa: E402


def main() -> int:
    if not config.USE_SUPABASE:
        print("SUPABASE_URL / SUPABASE_SERVICE_KEY are not set in backend/.env")
        return 1
    from supabase import create_client

    sb = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
    places = json.loads((config.SEED_DATA_DIR / "places.json").read_text(encoding="utf-8"))
    cards = json.loads((config.SEED_DATA_DIR / "phrase_cards.json").read_text(encoding="utf-8"))

    place_rows, acc_rows, food_rows = [], [], []
    for p in places:
        p = dict(p)
        acc = p.pop("accessibility")
        food = p.pop("food_options")
        place_rows.append(p)
        acc_rows.append({"place_id": p["id"], **acc})
        if food:
            food_rows.append({"place_id": p["id"], **food})

    sb.table("places").upsert(place_rows).execute()
    sb.table("place_accessibility").upsert(acc_rows).execute()
    if food_rows:
        sb.table("food_options").upsert(food_rows).execute()
    sb.table("phrase_cards").upsert(cards).execute()
    print(f"upserted places={len(place_rows)} accessibility={len(acc_rows)} food_options={len(food_rows)} "
          f"phrase_cards={len(cards)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
