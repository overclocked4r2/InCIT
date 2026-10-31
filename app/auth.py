"""Small in-memory authentication and role checks for the demo application."""
from __future__ import annotations

import secrets
from dataclasses import dataclass

from pydantic import BaseModel, Field


@dataclass(frozen=True)
class DemoUser:
    username: str
    password: str
    name: str
    role: str


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


DEMO_USERS = {
    "admin@incit.demo": DemoUser("admin@incit.demo", "admin123", "Asha Admin", "admin"),
    "coordinator@incit.demo": DemoUser("coordinator@incit.demo", "coord123", "Dev Coordinator", "department_coordinator"),
    "faculty@incit.demo": DemoUser("faculty@incit.demo", "faculty123", "Farah Faculty", "faculty"),
    "club@incit.demo": DemoUser("club@incit.demo", "club123", "Chris Club", "club_representative"),
}

# Keep all permissions together so routes do not make their own role decisions.
ACTION_ROLES = {
    "manage_timetable": {"admin", "department_coordinator"},
    "manage_disruption": {"admin", "department_coordinator"},
    "request_reschedule": {"department_coordinator", "faculty"},
    "request_booking": {"admin", "department_coordinator", "faculty", "club_representative"},
    "approve_reschedule": {"admin"},
    "reset_demo": {"admin"},
}

_sessions: dict[str, DemoUser] = {}


def login(username: str, password: str) -> tuple[str, DemoUser] | None:
    user = DEMO_USERS.get(username.lower())
    if user is None or not secrets.compare_digest(user.password, password):
        return None
    token = secrets.token_urlsafe(32)
    _sessions[token] = user
    return token, user


def user_from_authorization(authorization: str | None) -> DemoUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise PermissionError("Please sign in first.")
    user = _sessions.get(authorization.removeprefix("Bearer ").strip())
    if user is None:
        raise PermissionError("Your session has expired. Please sign in again.")
    return user


def require_action(authorization: str | None, action: str) -> DemoUser:
    user = user_from_authorization(authorization)
    if user.role not in ACTION_ROLES[action]:
        allowed = ", ".join(sorted(ACTION_ROLES[action]))
        raise PermissionError(f"This action requires one of these roles: {allowed}.")
    return user


def public_user(user: DemoUser) -> dict[str, str]:
    return {"username": user.username, "name": user.name, "role": user.role}
