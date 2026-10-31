"""Dataset loader — reads the CIT public JSON and provides typed access."""
import json
from pathlib import Path
from typing import Any
from functools import lru_cache


@lru_cache(maxsize=1)
def load_dataset(path: str | Path | None = None) -> dict[str, Any]:
    """Load and cache the CIT dataset. Uses config default if no path given."""
    if path is None:
        from .config import DATASET_PATH
        path = DATASET_PATH
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def get_dataset() -> dict[str, Any]:
    """Get the cached dataset."""
    return load_dataset()


# Helper accessors
def get_rooms(data: dict | None = None) -> dict[str, dict]:
    d = data or get_dataset()
    return {r["id"]: r for r in d["rooms"]}


def get_faculty(data: dict | None = None) -> dict[str, dict]:
    d = data or get_dataset()
    return {f["id"]: f for f in d["faculty"]}


def get_student_groups(data: dict | None = None) -> dict[str, dict]:
    d = data or get_dataset()
    return {g["id"]: g for g in d["student_groups"]}


def get_sessions(data: dict | None = None) -> dict[str, dict]:
    d = data or get_dataset()
    return {s["id"]: s for s in d["sessions"]}


def get_courses(data: dict | None = None) -> dict[str, dict]:
    d = data or get_dataset()
    return {c["id"]: c for c in d["courses"]}


def get_booking_requests(data: dict | None = None) -> dict[str, dict]:
    d = data or get_dataset()
    return {b["id"]: b for b in d["booking_requests"]}


def get_cancellations(data: dict | None = None) -> set[str]:
    d = data or get_dataset()
    return {c["request_id"] for c in d.get("cancellations", [])}


def get_calendar(data: dict | None = None) -> dict:
    d = data or get_dataset()
    return d["calendar"]


def get_room_unavailability(data: dict | None = None) -> list[dict]:
    d = data or get_dataset()
    return d.get("room_unavailability", [])


def get_exams(data: dict | None = None) -> list[dict]:
    d = data or get_dataset()
    return d.get("exams", [])
