"""Small, optional Gemini wrapper for editable booking drafts.

The wrapper only turns text into a typed draft. It never makes a scheduling or
booking decision; the deterministic booking gate remains responsible for that.
"""
from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pydantic import BaseModel, ConfigDict, Field, ValidationError


PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "booking_draft.md"
DAY_CODES = {"MON", "TUE", "WED", "THU", "FRI"}
ROOM_TYPES = {
    "auditorium", "seminar_hall", "lecture_hall", "classroom", "lab_cs",
    "lab_elec", "lab_phy", "lab_civil", "workshop", "outdoor",
}
NEEDS = {"projector", "pa_system", "stage", "whiteboard", "accessible", "computers"}


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
        model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        request = Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=12) as response:  # nosec B310 -- fixed Google API URL
            body = json.loads(response.read().decode("utf-8"))
        text_part = body["candidates"][0]["content"]["parts"][0]["text"]
        draft = BookingDraft.model_validate_json(text_part)
        return draft.model_dump(), None
    except (HTTPError, URLError, TimeoutError, KeyError, IndexError, TypeError, json.JSONDecodeError, ValidationError, OSError) as exc:
        return None, f"AI parsing is unavailable ({type(exc).__name__}). Please use the manual booking form."
