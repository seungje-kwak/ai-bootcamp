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
# Meals (tasks/prd-recommendation-p1.md FR-3 to FR-5). `core`: when people eat. `arrive`: when the
# restaurant stop may start. A trip needs a meal when it overlaps `core` by MEAL_MIN_OVERLAP minutes and
# still has MEAL_GAP_MIN minutes left after the arrival window opens.
MEALS = {
    "lunch": {"core": ("12:00", "13:00"), "arrive": ("11:30", "13:30")},
    "dinner": {"core": ("18:00", "19:00"), "arrive": ("17:30", "19:30")},
}
MEAL_MIN_OVERLAP = 30
MEAL_GAP_MIN = 45
# A stop that takes longer than this to reach is left out of the course (start-area FR-9).
MAX_MOVE_MIN = 30

# --- areas (tasks/prd-start-area.md FR-4): an area can be picked only when it has all of these ---
AREA_MIN_PLACES = 10
AREA_MIN_FOOD = 3
# Food places where solo_ok is not false (true or not known; prd-recommendation-p0 US-R04).
AREA_MIN_SOLO_FOOD = 2
AREA_MIN_CAFE = 1
AREA_MIN_EASY = 4           # walking_level 1 on flat ground
AREA_MIN_INDOOR = 3         # needed for the rain replan
# Courses saved before areas existed have no area_id (FR-7).
DEFAULT_AREA_ID = "jeju-city"
# A point outside every boundary (coast, small rocks) gets the area of the closest boundary
# within this distance (prd-recommendation-p0 FR-8).
AREA_EDGE_TOLERANCE_KM = 1.0

# --- candidates (prd-recommendation-p0 FR-9, FR-10). Straight-line km, no DETOUR_FACTOR ---
# 2.5 km: the density circle around each anchor candidate. About 15 min by taxi, 49 min on foot.
# The PRD started at 3 km; 2.5 km brought taxi legs from 1.67 to 1.43 in the eval (2026-11-15).
ANCHOR_RADIUS_KM = 2.5
# 6 km x DETOUR_FACTOR 1.3 = 7.8 km, about 29 min by taxi: inside MAX_MOVE_MIN from the anchor.
CANDIDATE_MAX_RADIUS_KM = 6.0
QUOTA_FOOD = 4          # closest food places kept when lunch is needed
QUOTA_CAFE = 2          # closest cafés always kept
CATEGORY_CAP = 8        # at most this many candidates of one category
# Rule planner score for a food place where solo_ok is true (null gets nothing).
SOLO_OK_BONUS = 1.0

# --- stay time by place type (tasks/prd-recommendation-p1.md FR-17): type -> (default, low, high) minutes.
# Estimates from usual visit times, not checked place by place. A stay time written in the seed CSV wins.
STAY_BY_TYPE = {
    "oreum_hike": (75, 60, 90),
    "forest": (60, 45, 90),
    "waterfall": (40, 30, 60),
    "port": (30, 20, 45),
    "nature": (45, 30, 75),
    "beach": (60, 40, 90),
    "park": (60, 45, 90),
    "museum": (60, 45, 90),
    "history_culture": (45, 30, 60),
    "market_shopping": (60, 45, 75),
    "cafe": (40, 30, 60),
    "restaurant": (45, 40, 60),
}
MAX_STAY_MIN = 240      # V-5
STAY_STEP_MIN = 5       # fit_stays (FR-18) moves a stay by this much at a time

# --- rule planner score (tasks/prd-recommendation-p1.md FR-14) ---
SAME_CATEGORY_PENALTY = 1.5         # the stop before has the same category
SAME_CATEGORY_RUN_PENALTY = 4.0     # the two stops before have it: more than the +3 interest bonus
EVENING_BONUS = 2.0                 # an evening spot reached at EVENING_FROM or later
EVENING_FROM = "16:30"
EVENING_WORDS = ("sunset", "night view", "night market", "at night", "lit up", "illuminat")
REST_CAFE_BONUS = 2.5               # a café for a traveler who should not walk much

# --- variety (FR-19, FR-20; tasks/prd-travel-range.md v0.3) ---
# Hubs (prd-travel-range FR-1): a place with this many pool places within ANCHOR_RADIUS_KM, farther than
# HUB_SEPARATION_KM from every hub picked before it. A course stays in one hub; its anchor is the hub's
# centre. A shuffle skips hubs within HUB_SEPARATION_KM of a hub already shown (FR-5).
HUB_MIN_PLACES = 8
HUB_SEPARATION_KM = 3.0
PICK_TOP_K = 3                     # each rule planner step picks one of the 3 best options ...
PICK_MARGIN = 1.0                   # ... that score within this much of the best
SHUFFLE_TRIES = 5
MAX_2OPT_ROUNDS = 50                # FR-16

LLM_TIMEOUT_SEC = 20
MAX_CANDIDATES = 20
FREE_ITEM_LIMIT = 3
