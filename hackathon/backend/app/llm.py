"""LLM step (10.3-10.5). The LLM picks place ids, order, stay_min and reason_en; Python does the rest.

Only used when LLM_API_KEY is set. LLM_PROVIDER picks the backend:
- gemini (default): google-genai, JSON output constrained by response_json_schema, temperature 0.3 (10.8)
- claude: Anthropic SDK structured output. Claude Opus 5.5 does not accept `temperature`, so it uses
  low effort instead.
Either way Pydantic validates the result (V-1) and planner.validate() drops unknown ids (V-2).
"""
from __future__ import annotations

import json
import logging
from typing import Optional

from . import config
from .schemas import LLMCourse

log = logging.getLogger("mypace.llm")

SYSTEM_PROMPT = """You are a day-trip planner for solo foreign travelers in Jeju, South Korea.
You receive one JSON object with "traveler", "trip", "replan" and "candidates".
Plan the stops and return JSON only.

Hard rules
1. Use only places from "candidates". Copy each "id" exactly into "place_id". Never invent a place or an id.
2. Use each place at most once.
3. Choose between trip.min_items and trip.max_items places.
4. The total of stay_min plus rough travel time between stops must fit within trip.time_budget_min.
   The whole stay at a place must be inside its opening hours: between the candidate's open_time and close_time (both null means always open).
5. For each item in trip.meals, include exactly one place whose category is "food", arriving between its arrive_from and arrive_by. Use a different food place for each meal. Do not add food places at other times.
6. If replan.fixed_first_place_id is set, that place must be the first item.
7. If replan.keep_if_possible is not empty, keep those places in that order unless another hard rule forbids it.

Preferences
8. Prefer categories listed in traveler.interests. Prefer food places where food.solo_ok is true.
   Avoid two stops of the same category in a row when there is another choice.
   Visit places with "evening_spot": true at 16:30 or later when the trip allows it.
9. Order the stops so the route does not zigzag. Use lat and lng. If trip.origin is given, start near it. Otherwise start near trip.anchor.
10. If traveler.fitness_level is 1, traveler.condition_today is "tired", or trip.low_walking is true: prefer lower walking_level and fatigue_score, choose fewer stops, and include a rest stop (a cafe or a place to sit) with "is_rest_stop": true.
11. Choose stay_min between the candidate's min_stay_min and max_stay_min. Use avg_stay_min unless the trip has spare time or is short.

Writing reason_en
12. One or two short sentences, at most 200 characters, in plain English, addressed to the traveler as "you".
13. Use only facts that appear in the input. Do not mention opening hours, prices, history, transport, travel time, or anything else that is not in the candidate data.
14. In "food", null means not known. Mention an option only when it is true.

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

class LLMError(Exception):
    """`status`: HTTP status code when the API answered with an error. `quota`: the account is out of
    quota or credit (Gemini RESOURCE_EXHAUSTED, Anthropic billing_error). The eval script reads these
    two fields instead of the message (tasks/prd-recommendation-p0.md US-R02)."""

    def __init__(self, message: str, status: Optional[int] = None, quota: bool = False):
        super().__init__(message)
        self.status = status
        self.quota = quota


def call_llm(llm_input: dict) -> LLMCourse:
    """One attempt. Raises LLMError on timeout, API error, refusal, bad JSON or schema mismatch.
    The caller (planner.run_pipeline) retries once, as 10.8 says."""
    if config.LLM_PROVIDER == "claude":
        return _call_claude(llm_input)
    return _call_gemini(llm_input)


# --------------------------------------------------------------------------- Gemini
# Gemini's JSON schema subset: keep it plain (no additionalProperties); Pydantic checks the rest.
GEMINI_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {k: v for k, v in OUTPUT_SCHEMA["properties"]["items"]["items"]["properties"].items()},
                "required": ["place_id", "order", "stay_min", "reason_en", "is_rest_stop"],
            },
        }
    },
    "required": ["items"],
}

_gemini_client = None


def _get_gemini():
    global _gemini_client
    if _gemini_client is None:
        from google import genai
        from google.genai import types

        _gemini_client = genai.Client(
            api_key=config.LLM_API_KEY,
            http_options=types.HttpOptions(timeout=config.LLM_TIMEOUT_SEC * 1000),  # milliseconds
        )
    return _gemini_client


def _call_gemini(llm_input: dict) -> LLMCourse:
    import httpx
    from google.genai import errors, types

    try:
        resp = _get_gemini().models.generate_content(
            model=config.LLM_MODEL,
            contents=json.dumps(llm_input, ensure_ascii=False),
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=config.LLM_TEMPERATURE,
                response_mime_type="application/json",
                response_json_schema=GEMINI_SCHEMA,
            ),
        )
    except errors.ClientError as e:  # 4xx: bad key, unknown model, quota
        raise LLMError(f"gemini client error {e.code}: {e.message}", status=e.code,
                       quota=e.status == "RESOURCE_EXHAUSTED") from e
    except errors.ServerError as e:  # 5xx
        raise LLMError(f"gemini server error {e.code}", status=e.code) from e
    except errors.APIError as e:
        raise LLMError(f"gemini api error {e.code}", status=e.code,
                       quota=e.status == "RESOURCE_EXHAUSTED") from e
    except httpx.TimeoutException as e:
        raise LLMError("gemini timeout") from e
    except httpx.HTTPError as e:
        raise LLMError(f"gemini connection: {e}") from e

    text = resp.text  # None when blocked or cut off
    if not text:
        reason = resp.candidates[0].finish_reason if resp.candidates else "no candidates"
        raise LLMError(f"gemini returned no text ({reason})")
    try:
        return LLMCourse.model_validate_json(text)
    except Exception as e:  # V-1
        raise LLMError(f"invalid output: {e}") from e


# --------------------------------------------------------------------------- Claude
_claude_client = None


def _get_claude():
    global _claude_client
    if _claude_client is None:
        import anthropic

        # Our own retry policy is 10.8 (one retry), so the SDK does not retry on its own.
        _claude_client = anthropic.Anthropic(api_key=config.LLM_API_KEY, timeout=config.LLM_TIMEOUT_SEC, max_retries=0)
    return _claude_client


def _call_claude(llm_input: dict) -> LLMCourse:
    import anthropic

    try:
        resp = _get_claude().beta.messages.create(
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
        body = e.body if isinstance(e.body, dict) else {}
        kind = (body.get("error") or {}).get("type") if isinstance(body.get("error"), dict) else None
        raise LLMError(f"api status {e.status_code}", status=e.status_code,
                       quota=e.status_code == 402 or kind == "billing_error") from e
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
