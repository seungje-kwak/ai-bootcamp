"""Pydantic models mirroring PRD 9.3 / 10.5. Field names are the contract."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

Category = Literal["nature", "market", "cafe", "food", "culture", "photo"]
Tier = Literal["free", "premium"]
MoveMethod = Literal["walk", "bus", "taxi"]
ItemStatus = Literal["done", "current", "upcoming"]
ReplanReason = Literal["rain", "closed", "hungry", "tired"]


class Conditions(BaseModel):
    indoor_only: bool = False
    low_walking: bool = False


class UserProfileIn(BaseModel):
    """What the onboarding sends (9.5). `conditions` is server-owned."""
    model_config = ConfigDict(extra="forbid")

    interests: list[Category] = Field(min_length=1)
    fitness_level: Literal[1, 2, 3]
    max_walk_min: Literal[10, 20, 30]
    avoid_slopes: bool
    condition_today: Literal["great", "normal", "tired"]
    diet: Literal["none", "vegan", "vegetarian", "halal"]


class UserProfile(UserProfileIn):
    """What is stored. The server adds `conditions`, `start_time`, `end_time` and `area_id`.
    Courses saved before the trip-time change have `duration` instead of the two times, and
    courses saved before areas existed have no `area_id`."""
    model_config = ConfigDict(extra="ignore")
    conditions: Conditions = Conditions()
    area_id: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None


class CreateCourseRequest(BaseModel):
    """Both times are required "HH:MM" strings. Their range is checked in planner.check_time_window,
    which answers 422 INVALID_TIME_WINDOW in the 9.2 error shape. `area_id` is checked in
    areas.check_area, which answers 422 INVALID_AREA."""
    user_profile: UserProfileIn
    area_id: str
    start_time: str
    end_time: str


class ReplanRequest(BaseModel):
    reason: ReplanReason
    current_order: int = Field(ge=1)


class ReportRequest(BaseModel):
    type: Literal["closed"] = "closed"


class PurchaseRequest(BaseModel):
    course_id: str


# --- LLM output (10.5) ---
class LLMItem(BaseModel):
    place_id: int
    order: int = Field(ge=1)
    stay_min: int = Field(gt=0)
    reason_en: str = Field(min_length=1, max_length=300)
    is_rest_stop: bool = False


class LLMCourse(BaseModel):
    items: list[LLMItem] = Field(min_length=1)
