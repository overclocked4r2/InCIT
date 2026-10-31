"""Deterministic, OR-Tools-independent validation of timetable and booking candidates."""
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Iterable, Mapping, Any

@dataclass(frozen=True)
class Activity:
    id: str
    start: datetime
    end: datetime
    room_id: str | None = None
    faculty_id: str | None = None
    student_group_id: str | None = None
    kind: str = "class"  # class | booking
    status: str = "scheduled"
    capacity: int | None = None
    attendees: int | None = None
    required_room_type: str | None = None
    room_type: str | None = None
    faculty_available: bool | None = None
    term_id: str | None = None
    offering_term_id: str | None = None
    resource_needs: Mapping[str, int] = field(default_factory=dict)

@dataclass(frozen=True)
class ValidationIssue:
    code: str
    type: str
    severity: str
    message: str
    entity_type: str
    entity_id: str
    conflicting_entry_id: str | None = None
    suggestion: str | None = None

@dataclass
class ValidationResult:
    valid: bool
    conflicts: list[ValidationIssue] = field(default_factory=list)
    warnings: list[ValidationIssue] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

def overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    """Half-open intervals: adjacent activities do not conflict."""
    return a_start < b_end and b_start < a_end

def validate_activity(candidate: Activity, existing: Iterable[Activity] = (), *,
                      available_resources: Mapping[str, int] | None = None,
                      special_week_policy: str = "normal",
                      special_week_dates: tuple[date, date] | None = None,
                      override_blocks: Iterable[tuple[datetime, datetime, str | None]] = ()) -> ValidationResult:
    issues: list[ValidationIssue] = []
    def add(code, typ, msg, entity="activity", conflict=None, suggestion=None):
        issues.append(ValidationIssue(code,typ,"error",msg,entity,candidate.id,conflict,suggestion))

    if candidate.start >= candidate.end:
        add("TIME-001","invalid_interval","Activity start must be earlier than its end.",suggestion="Choose a positive-duration interval.")
        return ValidationResult(False,issues,metadata={"checked_constraints":1})

    if candidate.term_id and candidate.offering_term_id and candidate.term_id != candidate.offering_term_id:
        add("TERM-001","term_mismatch","Course offering does not belong to this schedule's academic term.","course_offering")

    if candidate.capacity is not None and candidate.attendees is not None and candidate.attendees > candidate.capacity:
        add("CAP-001","capacity_exceeded","Room capacity is below the expected attendance.","room",suggestion="Select a room with sufficient capacity.")
    if candidate.required_room_type and candidate.room_type and candidate.required_room_type != candidate.room_type:
        add("ROOM-002","room_type_mismatch","Room does not satisfy the required room type.","room",suggestion="Select a compatible room.")
    if candidate.faculty_available is False:
        add("AVAIL-001","faculty_unavailable","Faculty member is unavailable during this interval.","faculty",suggestion="Choose an available time.")

    # Special-week precedence: matching active override first; then week policy; then normal timetable.
    in_special_week = bool(special_week_dates and special_week_dates[0] <= candidate.start.date() <= special_week_dates[1])
    if in_special_week:
        if special_week_policy == "blocked":
            add("SPEC-001","special_week_blocked","Activities are blocked by the special-week policy.","special_week")
        elif special_week_policy == "approval_required" and candidate.kind == "booking" and candidate.status != "approved":
            add("SPEC-001","special_week_approval_required","Booking requires approval during this special week.","booking",suggestion="Submit for authorized approval.")
        elif special_week_policy == "restricted" and candidate.kind == "booking" and candidate.status not in ("approved", "pending"):
            add("SPEC-001","special_week_restricted","Booking status is not permitted by the special-week policy.","booking")
    for start,end,room_id in override_blocks:
        if overlaps(candidate.start,candidate.end,start,end) and (room_id is None or room_id == candidate.room_id):
            add("SPEC-002","special_week_override_conflict","Activity overlaps a higher-precedence special-week room/resource block.","special_week_override",suggestion="Choose a time or room outside the override.")

    existing = list(existing)
    for other in existing:
        if other.id == candidate.id or other.status in ("cancelled", "rejected"):
            continue
        if not overlaps(candidate.start,candidate.end,other.start,other.end):
            continue
        if candidate.room_id and candidate.room_id == other.room_id:
            code = "BOOK-002" if candidate.kind == "booking" and other.kind == "booking" else "BOOK-001" if "booking" in (candidate.kind,other.kind) else "ROOM-001"
            add(code,"room_conflict","Room is already occupied during this interval.","room",other.id,"Choose another room or time.")
        if candidate.faculty_id and candidate.faculty_id == other.faculty_id and candidate.kind == other.kind == "class":
            add("FAC-001","faculty_conflict","Faculty member is already scheduled during this interval.","faculty",other.id,"Choose another time slot.")
        if candidate.student_group_id and candidate.student_group_id == other.student_group_id and candidate.kind == other.kind == "class":
            add("GRP-001","student_group_conflict","Student group is already scheduled during this interval.","student_group",other.id,"Choose another time slot.")

    for resource_id, qty in candidate.resource_needs.items():
        available = (available_resources or {}).get(resource_id, 0)
        if qty > available:
            add("RES-001","resource_shortage",f"Required quantity ({qty}) exceeds available quantity ({available}) for resource {resource_id}.","resource",suggestion="Reduce quantity or select another time/resource.")
    return ValidationResult(not issues,issues,metadata={"checked_constraints":8})

def validate_reschedule(original: Activity, proposed: Activity, existing: Iterable[Activity], **kwargs) -> ValidationResult:
    """Validate a proposed change without mutating/deleting the original entry."""
    if original.id != proposed.id:
        return ValidationResult(False,[ValidationIssue("CHANGE-001","entry_identity_changed","A reschedule must retain the original timetable entry identity.","error","timetable_entry",proposed.id)],metadata={"checked_constraints":1})
    return validate_activity(proposed,(e for e in existing if e.id != original.id),**kwargs)
