"""Settings and planner constants (10.6, 11.3). All tunable numbers live here."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")


def _bool(name: str, default: bool) -> bool:
    v = os.getenv(name)
    return default if v is None or v.strip() == "" else v.strip().lower() in ("1", "true", "yes")


# --- environment (11.3) ---
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
# LLM_PROVIDER: "gemini" (default) or "claude". The key goes in LLM_API_KEY (GEMINI_API_KEY also works).
LLM_PROVIDER = (os.getenv("LLM_PROVIDER", "").strip().lower() or "gemini")
LLM_API_KEY = (os.getenv("LLM_API_KEY", "").strip()
               or (os.getenv("GEMINI_API_KEY", "").strip() if LLM_PROVIDER == "gemini" else ""))
# gemini-3.1-flash-lite: answered the planner prompt in 1-2 s on 2026-11-12, while gemini-3.8-flash /
# 3.5-flash returned 503 "high demand" and gemini-2.5-flash is closed to new users. Override with LLM_MODEL.
_DEFAULT_MODEL = {"gemini": "gemini-3.1-flash-lite", "claude": "claude-opus-5-5"}
LLM_MODEL = os.getenv("LLM_MODEL", "").strip() or _DEFAULT_MODEL.get(LLM_PROVIDER, "gemini-3.1-flash-lite")
LLM_TEMPERATURE = 0.3  # 10.8 (Gemini only; Claude Opus 5.5 does not accept temperature)
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
REQUIRE_VERIFIED = _bool("REQUIRE_VERIFIED", False)
# P1 (US-22): when the LLM fails twice, fall back to the rule planner instead of 502.
LLM_FALLBACK_RULES = _bool("LLM_FALLBACK_RULES", True)

USE_SUPABASE = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)
USE_LLM = bool(LLM_API_KEY)

# Seed files built by scripts/build_places.py and uploaded by scripts/seed_supabase.py
SEED_DATA_DIR = BACKEND_DIR / "app" / "data"

# --- planner constants (10.6) ---
DETOUR_FACTOR = 1.3
WALK_M_PER_MIN = 67
TAXI_M_PER_MIN = 333
TAXI_EXTRA_MIN = 5
# Trip time window (tasks/prd-trip-time.md FR-3). The traveler picks start and end in the onboarding.
MIN_START = "08:00"
MAX_START = "16:00"
MAX_END = "22:00"
MIN_TRIP_MIN = 120
MAX_TRIP_MIN = 600
TIME_STEP_MIN = 30
# Only for replanning old courses whose user_profile has `duration` and no `end_time` (FR-11).
HALF_DAY_MIN = 240
FULL_DAY_MIN = 480
LUNCH_WINDOW = ("12:00", "13:00")
# A stop that takes longer than this to reach is left out of the course (start-area FR-9).
MAX_MOVE_MIN = 30

# --- areas (tasks/prd-start-area.md FR-4): an area can be picked only when it has all of these ---
AREA_MIN_PLACES = 10
AREA_MIN_FOOD = 3
# Food places where one person can order. The PRD (FR-4) says 2. Set to 0 on 2026-11-14 until
# solo_ok is filled in for the Jeju-wide restaurants (all empty, so read as false); without this
# only jeju-city can be picked. Courses in those areas get no lunch stop, because F-3 drops food
# places where solo_ok is false. Put it back to 2 once the data is there (US-A06).
AREA_MIN_SOLO_FOOD = 0
AREA_MIN_CAFE = 1
AREA_MIN_EASY = 4           # walking_level 1 on flat ground
AREA_MIN_INDOOR = 3         # needed for the rain replan
# Courses saved before areas existed have no area_id (FR-7).
DEFAULT_AREA_ID = "jeju-city"

LLM_TIMEOUT_SEC = 20
MAX_CANDIDATES = 20
FREE_ITEM_LIMIT = 3
