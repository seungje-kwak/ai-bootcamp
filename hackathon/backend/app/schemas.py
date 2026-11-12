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
    duration: Literal["half_day", "full_day"]


class UserProfile(UserProfileIn):
    model_config = ConfigDict(extra="ignore")
    conditions: Conditions = Conditions()


class CreateCourseRequest(BaseModel):
    user_profile: UserProfileIn
    start_time: Optional[str] = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")


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
