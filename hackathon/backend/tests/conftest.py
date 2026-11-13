"""Shared fixtures.

test_planner.py is offline: it uses the seed file app/data/places.json and never calls the LLM or Supabase.
test_api_db.py talks to the real Supabase project and is skipped unless MYPACE_DB_TESTS=1.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app import config, planner  # noqa: E402

EMMA = {
    "interests": ["photo", "market", "cafe"], "fitness_level": 2, "max_walk_min": 20, "avoid_slopes": False,
    "condition_today": "normal", "diet": "vegan", "duration": "full_day",
}


@pytest.fixture(scope="session")
def places() -> list[dict]:
    return json.loads((config.SEED_DATA_DIR / "places.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def by_id(places) -> dict[int, dict]:
    return {p["id"]: p for p in places}


@pytest.fixture()
def emma() -> dict:
    return dict(EMMA)


@pytest.fixture(autouse=True)
def _deterministic(monkeypatch):
    """Rule planner, no weekday closures, no photo requirement: results do not depend on the day or the LLM."""
    monkeypatch.setattr(config, "USE_LLM", False)
    monkeypatch.setattr(config, "REQUIRE_VERIFIED", False)
    monkeypatch.setattr(planner, "today_kst_dow", lambda: "none")
