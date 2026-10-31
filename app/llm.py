"""Small, optional Gemini wrapper for editable booking drafts.

The wrapper only turns text into a typed draft. It never makes a scheduling or
booking decision; the deterministic booking gate remains responsible for that.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pydantic import BaseModel, ConfigDict, Field, ValidationError


PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "booking_draft.md"
FACULTY_CHANGE_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "faculty_change.md"
EXPLANATION_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "explanation.md"
DAY_CODES = {"MON", "TUE", "WED", "THU", "FRI"}
ROOM_TYPES = {
    "auditorium", "seminar_hall", "lecture_hall", "classroom", "lab_cs",
    "lab_elec", "lab_phy", "lab_civil", "workshop", "outdoor",
}
NEEDS = {"projector", "pa_system", "stage", "whiteboard", "accessible", "computers"}
DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite"
logger = logging.getLogger(__name__)


class BookingWindow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    day: str
    from_period: int = Field(ge=1, le=13)
    to_period: int = Field(ge=1, le=13)

    def model_post_init(self, __context: Any) -> None:
        if self.day not in DAY_CODES:
            raise ValueError("day must be a teaching-day code")
        if self.to_period < self.from_period:
            raise ValueError("window ends before it starts")


class BookingDraft(BaseModel):
    """The only shape accepted from the LLM API."""
    model_config = ConfigDict(extra="forbid")
    attendance: int | None = Field(default=None, ge=1, le=5000)
    duration_periods: int | None = Field(default=None, ge=1, le=13)
    windows: list[BookingWindow] = Field(default_factory=list)
    room_types: list[str] = Field(default_factory=list)
    needs: list[str] = Field(default_factory=list)
    requested_room: str | None = Field(default=None, max_length=40)
    mandatory_for_groups: list[str] = Field(default_factory=list)
    title: str | None = Field(default=None, max_length=160)
    assumptions: list[str] = Field(default_factory=list, max_length=10)
    follow_up: str | None = Field(default=None, max_length=300)

    def model_post_init(self, __context: Any) -> None:
        if any(room_type not in ROOM_TYPES for room_type in self.room_types):
            raise ValueError("unknown room type")
        if any(need not in NEEDS for need in self.needs):
            raise ValueError("unknown booking need")


class FacultyChangeDraft(BaseModel):
    """The only shape accepted from the LLM for a faculty timetable request."""
    model_config = ConfigDict(extra="forbid")
    session_id: str | None = Field(default=None, max_length=80)
    day: str | None = None
    start_period: int | None = Field(default=None, ge=1, le=9)
    reason: str | None = Field(default=None, max_length=300)
    assumptions: list[str] = Field(default_factory=list, max_length=8)
    follow_up: str | None = Field(default=None, max_length=300)

    def model_post_init(self, __context: Any) -> None:
        if self.day is not None and self.day not in DAY_CODES:
            raise ValueError("day must be a teaching-day code")


def _parse_gemini_json(prompt_path: Path, text: str, model: type[BaseModel]) -> tuple[dict[str, Any] | None, str | None]:
    """Parse one narrowly scoped Gemini JSON response through a local schema."""
    if not os.getenv("GEMINI_API_KEY"):
        return None, "AI parsing is unavailable. Please use the manual form."
    try:
        prompt = prompt_path.read_text(encoding="utf-8")
        payload = {
            "contents": [{"parts": [{"text": f"{prompt}\n\nUser request:\n{text}"}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0},
        }
        body = _generate_content(payload)
        text_part = body["candidates"][0]["content"]["parts"][0]["text"]
        draft = model.model_validate_json(text_part)
        return draft.model_dump(), None
    except (URLError, TimeoutError, KeyError, IndexError, TypeError, json.JSONDecodeError, ValidationError, OSError, RuntimeError) as exc:
        return None, f"AI parsing is unavailable ({type(exc).__name__}). Please use the manual form."


def _http_error_detail(exc: HTTPError) -> str:
    """Extract Google’s safe error message without ever logging an API key."""
    try:
        body = json.loads(exc.read().decode("utf-8"))
        error = body.get("error", {})
        message = str(error.get("message", "")).replace("\n", " ").strip()
        status = str(error.get("status", "")).strip()
        if message:
            return f"HTTP {exc.code}{f' {status}' if status else ''}: {message[:500]}"
    except (json.JSONDecodeError, UnicodeDecodeError, OSError, AttributeError):
        pass
    return f"HTTP {exc.code}: {exc.reason}"


def _configured_models() -> list[str]:
    """Try the selected model, then a current new-project fallback if needed."""
    selected = os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)
    return [selected] if selected == DEFAULT_GEMINI_MODEL else [selected, DEFAULT_GEMINI_MODEL]


def _generate_content(payload: dict[str, Any]) -> dict[str, Any]:
    """Call Gemini with the key in a header, never in the request URL."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    last_error = "Gemini did not return a response"
    models = _configured_models()
    for index, model in enumerate(models):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        request = Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
            method="POST",
        )
        try:
            with urlopen(request, timeout=12) as response:  # nosec B310 -- fixed Google API URL
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            last_error = _http_error_detail(exc)
            logger.warning("Gemini request failed for model %s: %s", model, last_error)
            if exc.code in {400, 404} and index < len(models) - 1:
                logger.warning("Retrying Gemini with fallback model %s", models[index + 1])
                continue
            break
    raise RuntimeError(last_error)


def parse_booking_draft_with_llm(text: str, reference_date: datetime) -> tuple[dict[str, Any] | None, str | None]:
    """Return a schema-checked Gemini draft, or a safe fallback message."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None, "AI parsing is unavailable. Please use the manual booking form."

    try:
        prompt = PROMPT_PATH.read_text(encoding="utf-8")
        payload = {
            "contents": [{"parts": [{"text": (
                f"{prompt}\n\nReference date: {reference_date.date().isoformat()}\n"
                f"User request:\n{text}"
            )}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0},
        }
        body = _generate_content(payload)
        text_part = body["candidates"][0]["content"]["parts"][0]["text"]
        draft = BookingDraft.model_validate_json(text_part)
        return draft.model_dump(), None
    except (URLError, TimeoutError, KeyError, IndexError, TypeError, json.JSONDecodeError, ValidationError, OSError, RuntimeError) as exc:
        return None, f"AI parsing is unavailable ({type(exc).__name__}). Please use the manual booking form."


def parse_faculty_change_with_llm(text: str) -> tuple[dict[str, Any] | None, str | None]:
    """Turn a faculty request into a draft only; it never validates or approves it."""
    return _parse_gemini_json(FACULTY_CHANGE_PROMPT_PATH, text, FacultyChangeDraft)


def phrase_explanation_with_llm(facts: dict[str, Any]) -> tuple[str | None, str | None]:
    """Phrase code-derived facts. The model receives no authority to add reasons."""
    if not os.getenv("GEMINI_API_KEY"):
        return None, "GEMINI_API_KEY is not configured"
    try:
        prompt = EXPLANATION_PROMPT_PATH.read_text(encoding="utf-8")
        payload = {
            "contents": [{"parts": [{"text": f"{prompt}\n\nFacts:\n{json.dumps(facts, sort_keys=True)}"}]}],
            "generationConfig": {"temperature": 0, "maxOutputTokens": 180},
        }
        body = _generate_content(payload)
        reply = body["candidates"][0]["content"]["parts"][0]["text"].strip()
        if not reply:
            raise ValueError("empty Gemini reply")
        return reply, None
    except (URLError, TimeoutError, KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError, OSError, RuntimeError) as exc:
        logger.warning("Explanation phrasing unavailable: %s", exc)
        return None, f"Gemini explanation failed: {type(exc).__name__}"


def chat_with_llm(text: str, role: str) -> tuple[str | None, str | None]:
    """Return a friendly general-chat reply without making any booking decision."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        reason = "GEMINI_API_KEY is not configured"
        logger.warning("Using Basic mode: %s", reason)
        return None, reason

    system_prompt = (
        "You are InCIT's assistant for campus timetable and room booking. "
        "Be friendly and short. Never invent bookings. Do not say a room is available, "
        "approve a booking, change a timetable, or decide priority."
    )
    try:
        payload = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": f"The signed-in user has role: {role}.\nUser: {text}"}]}],
            "generationConfig": {"temperature": 0.4, "maxOutputTokens": 160},
        }
        body = _generate_content(payload)
        reply = body["candidates"][0]["content"]["parts"][0]["text"].strip()
        if not reply:
            raise ValueError("empty Gemini reply")
        return reply, None
    except (URLError, TimeoutError, KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError, OSError, RuntimeError) as exc:
        reason = f"Gemini chat failed: {exc}"
        logger.warning("Using Basic mode: %s", reason)
        return None, reason
