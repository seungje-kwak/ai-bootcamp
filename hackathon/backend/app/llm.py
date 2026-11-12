"""LLM step (10.3-10.5). Claude picks place ids, order, stay_min and reason_en; Python does the rest.

Only used when LLM_API_KEY is set. Structured output (output_config.format) guarantees JSON in the
LLMCourse shape; Pydantic still validates it (V-1).
Note: Claude Opus 5.5 does not accept `temperature`, so 10.8's "temperature 0.3" is replaced by
low effort + Python-side fixed first stops / keep_if_possible for stable results.
"""
from __future__ import annotations

import json
import logging

from . import config
from .schemas import LLMCourse

log = logging.getLogger("mypace.llm")

SYSTEM_PROMPT = """You are a day-trip planner for solo foreign travelers in Jeju City, South Korea.
You receive one JSON object with "traveler", "trip", "replan" and "candidates".
Plan the stops and return JSON only.

Hard rules
1. Use only places from "candidates". Copy each "id" exactly into "place_id". Never invent a place or an id.
2. Use each place at most once.
3. Choose between trip.min_items and trip.max_items places.
4. The total of stay_min plus rough travel time between stops must fit within trip.time_budget_min.
5. If trip.needs_lunch is true, include exactly one place whose category is "food", placed so that it starts between 11:30 and 13:30.
6. If replan.fixed_first_place_id is set, that place must be the first item.
7. If replan.keep_if_possible is not empty, keep those places in that order unless another hard rule forbids it.

Preferences
8. Prefer categories listed in traveler.interests.
9. Order the stops so the route does not zigzag. Use lat and lng. If trip.origin is given, start near it.
10. If traveler.fitness_level is 1, traveler.condition_today is "tired", or trip.low_walking is true: prefer lower walking_level and fatigue_score, choose fewer stops, and include a rest stop (a cafe or a place to sit) with "is_rest_stop": true.
11. Keep stay_min close to the candidate's avg_stay_min.

Writing reason_en
12. One or two short sentences, at most 200 characters, in plain English, addressed to the traveler as "you".
13. Use only facts that appear in the input. Do not mention opening hours, prices, history, transport, travel time, or anything else that is not in the candidate data.

Output
Return only one JSON object in exactly this shape. No markdown, no code fence, no extra text.
{"items":[{"place_id":7,"order":1,"stay_min":30,"reason_en":"...","is_rest_stop":false}]}"""

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "place_id": {"type": "integer"},
                    "order": {"type": "integer"},
                    "stay_min": {"type": "integer"},
                    "reason_en": {"type": "string"},
                    "is_rest_stop": {"type": "boolean"},
                },
                "required": ["place_id", "order", "stay_min", "reason_en", "is_rest_stop"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["items"],
    "additionalProperties": False,
}

_client = None


def _get_client():
    global _client
    if _client is None:
        import anthropic

        # Our own retry policy is 10.8 (one retry), so the SDK does not retry on its own.
        _client = anthropic.Anthropic(api_key=config.LLM_API_KEY, timeout=config.LLM_TIMEOUT_SEC, max_retries=0)
    return _client


class LLMError(Exception):
    pass


def call_llm(llm_input: dict) -> LLMCourse:
    """One attempt. Raises LLMError on timeout, API error, refusal, bad JSON or schema mismatch."""
    import anthropic

    try:
        resp = _get_client().beta.messages.create(
            model=config.LLM_MODEL,
            max_tokens=4000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": json.dumps(llm_input, ensure_ascii=False)}],
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": OUTPUT_SCHEMA}},
            # Server-side refusal fallback (routes to another model if a safety classifier declines).
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except anthropic.APITimeoutError as e:
        raise LLMError(f"timeout: {e}") from e
    except anthropic.APIStatusError as e:
        raise LLMError(f"api status {e.status_code}") from e
    except anthropic.APIConnectionError as e:
        raise LLMError(f"connection: {e}") from e

    if resp.stop_reason in ("refusal", "max_tokens"):
        raise LLMError(f"stop_reason={resp.stop_reason}")
    text = next((b.text for b in resp.content if b.type == "text"), None)
    if not text:
        raise LLMError("no text block")
    try:
        return LLMCourse.model_validate_json(text)
    except Exception as e:  # V-1
        raise LLMError(f"invalid output: {e}") from e
