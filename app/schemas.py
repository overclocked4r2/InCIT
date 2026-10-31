"""Pydantic schemas for API request/response validation."""
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Any


# ---- Dataset schemas ----
class RoomOut(BaseModel):
    id: str
    name: str
    building: str
    type: str
    capacity: int
    features: list[str] = []
    accessible: bool = False
    allowed_uses: list[str] = []


class FacultyOut(BaseModel):
    id: str
    name: str
    department: str
    max_hours_per_day: int = 4


class StudentGroupOut(BaseModel):
    id: str
    name: str
    year: int
    department: str
    size: int


class SessionOut(BaseModel):
    id: str
    course_id: str
    kind: str
    groups: list[str]
    faculty_id: str
    size: int
    duration: int
    room_types: list[str]
    basket_slot: str | None = None
    fixed_slot: dict | None = None


class CourseOut(BaseModel):
    id: str
    name: str
    department: str | None = None
    lecture_hours: int = 0
    tutorial_hours: int = 0
    lab_blocks: int = 0


# ---- Timetable schemas ----
class TimetableAssignment(BaseModel):
    session_id: str
    day: str
    start_period: int
    room_id: str


class SolverRequest(BaseModel):
    time_limit_seconds: int = Field(default=120, ge=10, le=600)
    num_workers: int = Field(default=8, ge=1, le=16)


class SolverResponse(BaseModel):
    status: str
    assignments: list[TimetableAssignment]
    stats: dict[str, Any] = {}
    violations: list[str] = []
    changes: list[dict[str, Any]] = []


class TimetableState(BaseModel):
    """Current timetable state including assignments and metadata."""
    id: str
    status: str  # draft, published, archived
    assignments: list[TimetableAssignment]
    created_at: str | None = None
    published_at: str | None = None


# ---- Booking schemas ----
class BookingRequestIn(BaseModel):
    """Input for creating a booking."""
    requester: str
    role: str = "club"
    title: str
    attendance: int = Field(ge=1)
    duration_periods: int = Field(ge=1, le=13)
    windows: list[dict[str, Any]]
    room_types: list[str] = []
    needs: list[str] = []
    requested_room: str | None = None
    mandatory_for_groups: list[str] = []
    raw_text: str = ""


class BookingDecision(BaseModel):
    request_id: str
    status: str  # approved, rejected, alternative_offered
    day: str | None = None
    start_period: int | None = None
    end_period: int | None = None
    room_id: str | None = None
    reason: str | None = None


class FestWeekResult(BaseModel):
    bookings: list[BookingDecision]
    session_overrides: list[dict[str, Any]] = []


# ---- NL Parser schemas ----
class NLParseRequest(BaseModel):
    text: str = Field(min_length=5)


class NLParseResponse(BaseModel):
    attendance: int | None = None
    duration_periods: int | None = None
    windows: list[dict[str, Any]] = []
    room_types: list[str] = []
    needs: list[str] = []
    requested_room: str | None = None
    mandatory_for_groups: list[str] = []
    title: str | None = None
    follow_up: str | None = None
    confidence: float = 0.0
    raw_text: str = ""


# ---- Exam schemas ----
class ExamAssignment(BaseModel):
    exam_id: str
    day: str
    session: str  # AM or PM
    rooms: list[str]


# ---- Schedule export ----
class ScheduleExport(BaseModel):
    team: str
    dataset_id: str
    sessions: list[TimetableAssignment]
    fest_week: FestWeekResult | None = None
    exams: list[ExamAssignment] = []


# ---- Disruption ----
class DisruptionChange(BaseModel):
    type: str
    faculty_id: str | None = None
    room_id: str | None = None
    days: list[str] | None = None
    periods: list[int] | None = None
    reason: str | None = None
    session_id: str | None = None
    faculty: dict | None = None
    session: dict | None = None


class DisruptionRequest(BaseModel):
    changes: list[DisruptionChange]


# ---- Dashboard ----
class DashboardStats(BaseModel):
    total_sessions: int = 0
    scheduled_sessions: int = 0
    total_rooms: int = 0
    total_faculty: int = 0
    total_groups: int = 0
    total_booking_requests: int = 0
    approved_bookings: int = 0
    rejected_bookings: int = 0
    alternative_bookings: int = 0
    total_exams: int = 0
    scheduled_exams: int = 0
    timetable_status: str = "not_generated"
    solver_status: str | None = None
    hard_violations: int = 0
    soft_penalty: int = 0


# ---- Approval / Rescheduling ----
class RescheduleRequest(BaseModel):
    session_id: str
    new_day: str
    new_start_period: int
    new_room_id: str
    reason: str


class RescheduleResponse(BaseModel):
    success: bool
    message: str
    conflicts: list[str] = []
    old_assignment: TimetableAssignment | None = None
    new_assignment: TimetableAssignment | None = None
    changes: list[dict[str, Any]] = []


class ApprovalRequest(BaseModel):
    request_id: str
    decision: str  # approved or rejected
    comments: str = ""


# ---- Audit ----
class AuditEventOut(BaseModel):
    id: str
    action: str
    entity_type: str
    entity_id: str
    actor: str | None = None
    timestamp: str
    details: dict[str, Any] = {}


# ---- Validation ----
class ValidationReport(BaseModel):
    hard_violations: list[dict[str, Any]] = []
    hard_violation_count: int = 0
    hard_by_rule: dict[str, int] = {}
    soft_penalties: dict[str, int] = {}
    soft_total: int = 0
    warnings: list[str] = []
    bookings: dict[str, Any] | None = None
