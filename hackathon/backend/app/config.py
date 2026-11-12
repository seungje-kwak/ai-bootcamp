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
LLM_API_KEY = os.getenv("LLM_API_KEY", "").strip()
LLM_MODEL = os.getenv("LLM_MODEL", "").strip() or "claude-opus-5-5"
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
REQUIRE_VERIFIED = _bool("REQUIRE_VERIFIED", False)
# P1 (US-22): when the LLM fails twice, fall back to the rule planner instead of 502.
LLM_FALLBACK_RULES = _bool("LLM_FALLBACK_RULES", True)

USE_SUPABASE = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)
USE_LLM = bool(LLM_API_KEY)

# Local store (used when Supabase is not configured)
LOCAL_DATA_DIR = BACKEND_DIR / "app" / "data"
LOCAL_DB_FILE = BACKEND_DIR / "local_db.json"

# --- planner constants (10.6) ---
DETOUR_FACTOR = 1.3
WALK_M_PER_MIN = 67
TAXI_M_PER_MIN = 333
TAXI_EXTRA_MIN = 5
HALF_DAY_MIN = 240
FULL_DAY_MIN = 480
DEFAULT_START = "10:00"
LUNCH_WINDOW = ("12:00", "13:00")

LLM_TIMEOUT_SEC = 20
MAX_CANDIDATES = 20
FREE_ITEM_LIMIT = 3
