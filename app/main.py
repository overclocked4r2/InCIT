"""FastAPI application — InCIT institutional scheduling system."""
from __future__ import annotations
import copy
import json
import traceback
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import CORS_ORIGINS, TEAM_NAME, DATASET_PATH, PROJECT_ROOT
from .schemas import (
    SolverRequest, SolverResponse, TimetableAssignment,
    NLParseRequest, NLParseResponse,
    BookingDecision, FestWeekResult,
    ExamAssignment,
    DashboardStats,
    RescheduleRequest, RescheduleResponse,
    ApprovalRequest,
    AuditEventOut,
    ScheduleExport,
    DisruptionRequest,
    ValidationReport,
    RoomOut, FacultyOut, StudentGroupOut, SessionOut, CourseOut,
)
from .state import state
from .auth import LoginRequest, login, public_user, require_action, user_from_authorization

app = FastAPI(
    title="InCIT — Institutional Scheduling System",
    description="Automated timetable generation, natural-language booking, and resource management for CIT.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _require_action(authorization: str | None, action: str):
    """Translate the central demo-role check into a consistent API response."""
    try:
        return require_action(authorization, action)
    except PermissionError as exc:
        status = 401 if "sign in" in str(exc).lower() or "session" in str(exc).lower() else 403
        raise HTTPException(status, str(exc))


@app.post("/api/auth/login")
def login_demo(req: LoginRequest):
    result = login(req.username, req.password)
    if result is None:
        raise HTTPException(401, "Incorrect demo username or password.")
    token, user = result
    return {"token": token, "user": public_user(user)}


@app.get("/api/auth/me")
def current_user(authorization: str | None = Header(default=None)):
    try:
        return public_user(user_from_authorization(authorization))
    except PermissionError as exc:
        raise HTTPException(401, str(exc))

def _bootstrap_from_export() -> bool:
    """Load the committed baseline schedule so the UI is useful on a cold start."""
    if state.assignments:
        return False
    path = PROJECT_ROOT / "exports" / "schedule.json"
    if not path.exists():
        return False
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        sessions = payload.get("sessions") or []
        if not sessions:
            return False
        state.assignments = {
            s["session_id"]: {
                "session_id": s["session_id"],
                "day": s["day"],
                "start_period": s["start_period"],
                "room_id": s["room_id"],
            }
            for s in sessions
        }
        state.fest_week = payload.get("fest_week")
        state.exams = payload.get("exams") or []
        state.timetable_status = "published"
        state.solver_status = "optimal"
        state.version = 1
        stamp = datetime.fromtimestamp(path.stat().st_mtime).isoformat()
        state.generated_at = stamp
        state.published_at = stamp
        state.add_audit(
            "timetable_bootstrapped",
            "timetable",
            "v1",
            details={"source": "exports/schedule.json", "sessions": len(sessions)},
        )
        return True
    except Exception:
        return False


@app.on_event("startup")
def _startup():
    _bootstrap_from_export()


def _load_dataset(path: str | Path | None = None) -> dict:
    """Load (and cache) the CIT dataset."""
    if state.dataset is not None:
        return state.dataset
    p = path or DATASET_PATH
    if not Path(p).exists():
        raise HTTPException(404, f"Dataset not found at {p}. Copy cit_public.json to {p}")
    with open(p, encoding="utf-8") as f:
        state.dataset = json.load(f)
    return state.dataset


def _apply_disruption(data: dict, dis: dict) -> dict:
    """Apply disruption changes to a dataset copy."""
    d = copy.deepcopy(data)
    fac = {f["id"]: f for f in d["faculty"]}
    for ch in dis.get("changes", []):
        t = ch["type"]
        if t == "faculty_unavailable":
            for day in ch.get("days", []):
                fac[ch["faculty_id"]]["unavailable"].append(
                    {"day": day, "periods": ch.get("periods", []), "reason": ch.get("reason", "")})
        elif t == "room_unavailable":
            for day in ch.get("days", []):
                d["room_unavailability"].append(
                    {"room_id": ch["room_id"], "day": day, "periods": ch.get("periods", []), "reason": ch.get("reason", "")})
        elif t == "add_faculty":
            d["faculty"].append(ch["faculty"])
            fac[ch["faculty"]["id"]] = ch["faculty"]
        elif t == "add_session":
            d["sessions"].append(ch["session"])
        elif t == "remove_session":
            d["sessions"] = [s for s in d["sessions"] if s["id"] != ch["session_id"]]
    return d


# ============================================================
# Dataset endpoints
# ============================================================

@app.get("/api/dataset/status")
def dataset_status():
    """Check if dataset is loaded."""
    try:
        data = _load_dataset()
        return {
            "loaded": True,
            "dataset_id": data.get("dataset_id"),
            "rooms": len(data["rooms"]),
            "faculty": len(data["faculty"]),
            "groups": len(data["student_groups"]),
            "sessions": len(data["sessions"]),
            "booking_requests": len(data["booking_requests"]),
            "exams": len(data.get("exams", [])),
        }
    except HTTPException:
        return {"loaded": False, "error": "Dataset not found"}


@app.get("/api/rooms", response_model=list[RoomOut])
def list_rooms():
    data = _load_dataset()
    return data["rooms"]


@app.get("/api/faculty", response_model=list[FacultyOut])
def list_faculty():
    data = _load_dataset()
    return data["faculty"]


@app.get("/api/student-groups", response_model=list[StudentGroupOut])
def list_student_groups():
    data = _load_dataset()
    return data["student_groups"]


@app.get("/api/sessions", response_model=list[SessionOut])
def list_sessions():
    data = _load_dataset()
    return data["sessions"]


@app.get("/api/courses", response_model=list[CourseOut])
def list_courses():
    data = _load_dataset()
    return data["courses"]


@app.get("/api/booking-requests")
def list_booking_requests():
    data = _load_dataset()
    return {
        "requests": data["booking_requests"],
        "cancellations": data.get("cancellations", []),
        "priority_order": data["priority_order"],
        "role_category_cap": data["role_category_cap"],
    }


@app.get("/api/exams")
def list_exams():
    if not state.exams:
        from .exam_scheduler import schedule_exams
        state.exams = schedule_exams(_load_dataset())
    return state.exams


@app.get("/api/calendar")
def get_calendar():
    data = _load_dataset()
    return data["calendar"]


# ============================================================
# Solver / Timetable endpoints
# ============================================================

def _reschedule_diff(
    baseline: dict[str, dict[str, Any]],
    assignments: list[dict[str, Any]],
    data: dict[str, Any],
    disruption: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    """Describe every move in plain language without asking an LLM to infer it."""
    sessions = {session["id"]: session for session in data["sessions"]}
    changes = (disruption or {}).get("changes", [])
    diff = []
    for new in assignments:
        old = baseline.get(new["session_id"])
        if old is None or all(new[key] == old.get(key) for key in ("day", "start_period", "room_id")):
            continue
        session = sessions.get(new["session_id"], {})
        duration = session.get("duration", 1)
        old_periods = range(old["start_period"], old["start_period"] + duration)
        reasons = []
        for change in changes:
            if change.get("type") == "room_unavailable" and (
                change.get("room_id") == old["room_id"]
                and old["day"] in change.get("days", [])
                and set(old_periods) & set(change.get("periods", []))
            ):
                reasons.append(f"Original room {old['room_id']} is unavailable at this time.")
            if change.get("type") == "faculty_unavailable" and (
                change.get("faculty_id") == session.get("faculty_id")
                and old["day"] in change.get("days", [])
                and set(old_periods) & set(change.get("periods", []))
            ):
                reasons.append("Faculty is unavailable at the original time.")
        diff.append({
            "session_id": new["session_id"],
            "old": old,
            "new": new,
            "reason": " ".join(reasons) or "Moved to keep the timetable valid after the disruption.",
        })
    return diff

@app.post("/api/solver/generate", response_model=SolverResponse)
def generate_timetable(req: SolverRequest | None = None, authorization: str | None = Header(default=None)):
    """Run the OR-Tools solver to generate a timetable."""
    _require_action(authorization, "manage_timetable")
    if req is None:
        req = SolverRequest()
    
    data = _load_dataset()
    baseline = copy.deepcopy(state.assignments)
    
    # Apply disruption if one is active
    effective_data = data
    if state.disruption_applied and state.disruption_data:
        effective_data = _apply_disruption(data, state.disruption_data)
    
    state.timetable_status = "generating"
    
    try:
        from .solver import solve_timetable
        result = solve_timetable(
            effective_data,
            time_limit_seconds=req.time_limit_seconds,
            num_workers=req.num_workers,
            baseline_assignments=baseline or None,
        )
        
        if result.status in ("optimal", "feasible"):
            state.set_assignments(result.assignments, result.status)
            
            # Also process bookings and exams
            _process_bookings_and_exams(effective_data)
        else:
            state.solver_status = result.status
            state.timetable_status = "not_generated"
        
        return SolverResponse(
            status=result.status,
            assignments=[TimetableAssignment(**a) for a in result.assignments],
            stats=result.stats,
            violations=result.violations,
            changes=_reschedule_diff(baseline, result.assignments, effective_data, state.disruption_data),
        )
    except Exception as e:
        state.timetable_status = "not_generated"
        raise HTTPException(500, f"Solver error: {str(e)}\n{traceback.format_exc()}")


def _process_bookings_and_exams(data: dict):
    """Process fest week bookings and exam scheduling."""
    # Bookings
    try:
        from .booking_engine import process_booking_requests
        assignments_map = {sid: (a["day"], a["start_period"], a["room_id"]) 
                          for sid, a in state.assignments.items()}
        fest = process_booking_requests(data, assignments_map)
        state.fest_week = fest
        state.add_audit("bookings_processed", "fest_week", "all",
                       details={"approved": sum(1 for b in fest["bookings"] if b["status"] == "approved"),
                                "rejected": sum(1 for b in fest["bookings"] if b["status"] == "rejected")})
    except Exception as e:
        state.add_audit("bookings_error", "fest_week", "all", details={"error": str(e)})
    
    # Exams
    try:
        from .exam_scheduler import schedule_exams
        state.exams = schedule_exams(data)
        state.add_audit("exams_scheduled", "exams", "all",
                       details={"count": len(state.exams)})
    except Exception as e:
        state.add_audit("exams_error", "exams", "all", details={"error": str(e)})


@app.get("/api/timetable")
def get_timetable(
    day: str | None = None,
    room_id: str | None = None,
    faculty_id: str | None = None,
    group_id: str | None = None,
):
    """Get current timetable assignments with optional filters."""
    data = _load_dataset()
    sessions_map = {s["id"]: s for s in data["sessions"]}
    rooms_map = {r["id"]: r for r in data["rooms"]}
    
    assignments = list(state.assignments.values())
    
    # Enrich with session details
    enriched = []
    for a in assignments:
        sid = a["session_id"]
        s = sessions_map.get(sid, {})
        r = rooms_map.get(a["room_id"], {})
        
        # Apply filters
        if day and a["day"] != day:
            continue
        if room_id and a["room_id"] != room_id:
            continue
        if faculty_id and s.get("faculty_id") != faculty_id:
            continue
        if group_id and group_id not in s.get("groups", []):
            continue
        
        enriched.append({
            **a,
            "course_id": s.get("course_id"),
            "kind": s.get("kind"),
            "faculty_id": s.get("faculty_id"),
            "groups": s.get("groups", []),
            "size": s.get("size"),
            "duration": s.get("duration", 1),
            "room_name": r.get("name", a["room_id"]),
            "room_type": r.get("type"),
            "room_capacity": r.get("capacity"),
        })
    
    return {
        "status": state.timetable_status,
        "solver_status": state.solver_status,
        "version": state.version,
        "generated_at": state.generated_at,
        "published_at": state.published_at,
        "total_assignments": len(state.assignments),
        "assignments": enriched,
    }


@app.post("/api/timetable/publish")
def publish_timetable():
    """Publish the current draft timetable."""
    if state.timetable_status != "draft":
        raise HTTPException(400, f"Cannot publish: timetable is '{state.timetable_status}', expected 'draft'.")
    state.publish()
    return {"status": "published", "version": state.version}


@app.post("/api/timetable/archive")
def archive_timetable():
    """Archive the current timetable."""
    if state.timetable_status not in ("draft", "published"):
        raise HTTPException(400, f"Cannot archive: timetable is '{state.timetable_status}'.")
    state.archive()
    return {"status": "archived", "version": state.version}


@app.get("/api/timetable/versions")
def get_versions():
    """List all timetable versions."""
    current = {
        "version": state.version,
        "status": state.timetable_status,
        "generated_at": state.generated_at,
        "published_at": state.published_at,
        "sessions": len(state.assignments),
    }
    return {"current": current, "archived": state.versions}


# ============================================================
# Fest week / Bookings
# ============================================================

@app.get("/api/fest-week")
def get_fest_week():
    """Get Spectra/fest week booking decisions."""
    return {
        "fest_week": state.fest_week,
        "status": "processed" if state.fest_week else "not_processed",
    }


@app.post("/api/fest-week/reprocess")
def reprocess_bookings():
    """Reprocess booking requests against current timetable."""
    if not state.assignments:
        raise HTTPException(400, "No timetable available. Generate one first.")
    data = _load_dataset()
    effective_data = data
    if state.disruption_applied and state.disruption_data:
        effective_data = _apply_disruption(data, state.disruption_data)
    _process_bookings_and_exams(effective_data)
    return {"status": "reprocessed", "fest_week": state.fest_week}


@app.post("/api/manual-booking")
def create_manual_booking(req: dict[str, Any], authorization: str | None = Header(default=None)):
    """Check a structured booking form with the deterministic booking gate."""
    user = _require_action(authorization, "request_booking")
    if not state.assignments:
        raise HTTPException(400, "No timetable is available yet. Generate one first.")

    data = _load_dataset()
    from .booking_engine import validate_manual_booking

    assignments = {
        session_id: (assignment["day"], assignment["start_period"], assignment["room_id"])
        for session_id, assignment in state.assignments.items()
    }
    existing_bookings = (state.fest_week or {}).get("bookings", [])
    reason = validate_manual_booking(data, assignments, req, existing_bookings)
    if reason:
        state.add_audit(
            "manual_booking_rejected", "manual_booking", str(req.get("room_id", "unknown")),
            actor=user.username, details={"reason": reason},
        )
        return {"status": "rejected", "message": reason}

    room_id = str(req["room_id"])
    room = next(room for room in data["rooms"] if room["id"] == room_id)
    start = int(req["start_period"])
    duration = int(req["duration_periods"])
    state.add_audit(
        "manual_booking_checked", "manual_booking", room_id, actor=user.username,
        details={"day": str(req["day"]).upper(), "start": start, "duration": duration},
    )
    return {
        "status": "approved",
        "message": "Booking passes the timetable validity checks.",
        "booking": {
            "room_id": room_id,
            "room_name": room["name"],
            "day": str(req["day"]).upper(),
            "start_period": start,
            "end_period": start + duration - 1,
            "purpose": str(req["purpose"]),
        },
    }


# ============================================================
# NL Booking parser
# ============================================================

@app.post("/api/nl-parse", response_model=NLParseResponse)
def parse_natural_language(req: NLParseRequest):
    """Parse a natural-language booking request."""
    from .nl_parser import parse_booking_request
    result = parse_booking_request(req.text)
    return NLParseResponse(**result)


@app.post("/api/nl-book")
def nl_book(req: NLParseRequest, authorization: str | None = Header(default=None)):
    """Parse NL text and attempt to create a booking against current timetable."""
    user = _require_action(authorization, "request_booking")
    from .nl_parser import parse_booking_request
    parsed = parse_booking_request(req.text)
    
    if parsed["follow_up"]:
        return {
            "status": "needs_clarification",
            "parsed": parsed,
            "follow_up": parsed["follow_up"],
        }
    
    if not state.assignments:
        return {
            "status": "no_timetable",
            "parsed": parsed,
            "message": "No timetable is available yet. Generate one first.",
        }
    
    # Try to validate the booking
    data = _load_dataset()
    rooms = {r["id"]: r for r in data["rooms"]}
    
    # Find a matching room
    attendance = parsed.get("attendance", 50)
    room_types = parsed.get("room_types", ["classroom", "lecture_hall", "seminar_hall"])
    needs = set(parsed.get("needs", []))
    preferred = parsed.get("requested_room")
    
    from .booking_engine import _find_placement, _slot_available
    from collections import defaultdict
    
    room_unavail: dict[str, set[tuple[str, int]]] = defaultdict(set)
    for u in data.get("room_unavailability", []):
        for p in u["periods"]:
            room_unavail[u["room_id"]].add((u["day"], p))
    
    # Build room_busy from timetable
    sessions_map = {s["id"]: s for s in data["sessions"]}
    room_busy: dict[tuple[str, str, int], list[str]] = defaultdict(list)
    for sid, a in state.assignments.items():
        s = sessions_map.get(sid)
        if s:
            for p in range(a["start_period"], a["start_period"] + s["duration"]):
                room_busy[(a["room_id"], a["day"], p)].append(sid)
    
    # Also add fest_week bookings
    if state.fest_week:
        for b in state.fest_week.get("bookings", []):
            if b.get("status") in ("approved", "alternative_offered") and b.get("room_id"):
                for p in range(b["start_period"], b["end_period"] + 1):
                    room_busy[(b["room_id"], b["day"], p)].append(b["request_id"])
    
    group_occ: dict[tuple[str, str, int], list[str]] = defaultdict(list)
    
    # Create a mock request object
    mock_req = {
        "id": "NL-LIVE",
        "attendance": attendance,
        "duration_periods": parsed.get("duration_periods", 2),
        "windows": parsed.get("windows", []),
        "room_types": room_types,
        "needs": parsed.get("needs", []),
        "requested_room": preferred,
        "mandatory_for_groups": parsed.get("mandatory_for_groups", []),
    }
    
    placement = _find_placement(mock_req, rooms, room_busy, room_unavail, group_occ, data, set(sessions_map))
    
    if placement:
        room_id, day, start_p, end_p, is_exact = placement
        room = rooms[room_id]
        
        # Check accessibility conflict
        access_warning = None
        if preferred and preferred != room_id:
            pref_room = rooms.get(preferred)
            if pref_room and "accessible" in needs and not pref_room.get("accessible"):
                access_warning = f"{preferred} is not wheelchair accessible. {room_id} ({room.get('name')}) offered instead."
        
        state.add_audit("booking_created", "nl_booking", "NL-LIVE", actor=user.username,
                       details={"room": room_id, "day": day, "start": start_p, "end": end_p})
        
        return {
            "status": "approved" if is_exact else "alternative_offered",
            "parsed": parsed,
            "booking": {
                "room_id": room_id,
                "room_name": room.get("name", room_id),
                "room_type": room.get("type"),
                "room_capacity": room.get("capacity"),
                "day": day,
                "start_period": start_p,
                "end_period": end_p,
            },
            "accessibility_warning": access_warning,
        }
    else:
        state.add_audit("booking_rejected", "nl_booking", "NL-LIVE", actor=user.username,
                       details={"reason": "No suitable venue available"})
        return {
            "status": "rejected",
            "parsed": parsed,
            "message": "No suitable venue available for the requested time and requirements.",
        }


# ============================================================
# Rescheduling
# ============================================================

@app.post("/api/reschedule", response_model=RescheduleResponse)
def request_reschedule(req: RescheduleRequest, authorization: str | None = Header(default=None)):
    """Request a session reschedule."""
    user = _require_action(authorization, "request_reschedule")
    if not state.assignments:
        raise HTTPException(400, "No timetable available.")
    
    data = _load_dataset()
    sessions_map = {s["id"]: s for s in data["sessions"]}
    rooms_map = {r["id"]: r for r in data["rooms"]}
    
    if req.session_id not in state.assignments:
        raise HTTPException(404, f"Session {req.session_id} not found in current timetable.")
    
    session = sessions_map.get(req.session_id)
    if not session:
        raise HTTPException(404, f"Session {req.session_id} not found in dataset.")
    
    new_room = rooms_map.get(req.new_room_id)
    if not new_room:
        raise HTTPException(404, f"Room {req.new_room_id} not found.")
    
    old = state.assignments[req.session_id].copy()
    
    # Check conflicts
    conflicts = []
    
    # Room type
    if new_room["type"] not in session["room_types"]:
        conflicts.append(f"Room {req.new_room_id} type ({new_room['type']}) not compatible with session")
    
    # Capacity
    if new_room["capacity"] < session["size"]:
        conflicts.append(f"Room capacity ({new_room['capacity']}) < session size ({session['size']})")
    
    # Check room/time conflicts
    for sid, a in state.assignments.items():
        if sid == req.session_id:
            continue
        s = sessions_map.get(sid, {})
        if a["room_id"] == req.new_room_id and a["day"] == req.new_day:
            s_dur = s.get("duration", 1)
            # Check overlap
            a_start, a_end = a["start_period"], a["start_period"] + s_dur
            new_start, new_end = req.new_start_period, req.new_start_period + session["duration"]
            if new_start < a_end and a_start < new_end:
                conflicts.append(f"Room conflict with {sid} ({a['day']} P{a['start_period']}-P{a['start_period'] + s_dur - 1})")
        
        # Faculty conflict
        if s.get("faculty_id") == session["faculty_id"] and a["day"] == req.new_day:
            s_dur = s.get("duration", 1)
            a_start, a_end = a["start_period"], a["start_period"] + s_dur
            new_start, new_end = req.new_start_period, req.new_start_period + session["duration"]
            if new_start < a_end and a_start < new_end:
                conflicts.append(f"Faculty conflict with {sid}")
        
        # Group conflict
        common_groups = set(s.get("groups", [])) & set(session["groups"])
        if common_groups and a["day"] == req.new_day:
            s_dur = s.get("duration", 1)
            a_start, a_end = a["start_period"], a["start_period"] + s_dur
            new_start, new_end = req.new_start_period, req.new_start_period + session["duration"]
            if new_start < a_end and a_start < new_end:
                conflicts.append(f"Group conflict ({', '.join(common_groups)}) with {sid}")
    
    if conflicts:
        proposal = state.propose_reschedule(
            req.session_id, req.new_day, req.new_start_period, req.new_room_id, req.reason,
            requested_by=user.username,
        )
        proposal["conflicts"] = conflicts
        state.decide_reschedule(
            proposal["id"], "rejected", actor="system", comments="; ".join(conflicts),
        )
        return RescheduleResponse(
            success=False,
            message=f"Reschedule rejected: {'; '.join(conflicts)}",
            conflicts=conflicts,
            old_assignment=TimetableAssignment(**old),
            changes=proposal["changes"],
        )
    
    proposal = state.propose_reschedule(
        req.session_id, req.new_day, req.new_start_period, req.new_room_id, req.reason,
        requested_by=user.username,
    )
    
    return RescheduleResponse(
        success=True,
        message=f"Reschedule proposal for {req.session_id} is pending Admin approval.",
        old_assignment=TimetableAssignment(**old),
        new_assignment=TimetableAssignment(**proposal["new"]),
        changes=proposal["changes"],
    )


@app.get("/api/reschedule/history")
def reschedule_history():
    """Get reschedule request history."""
    return state.reschedule_requests


@app.post("/api/reschedule/{request_id}/decision")
def decide_reschedule(request_id: str, req: ApprovalRequest, authorization: str | None = Header(default=None)):
    """Approve or reject a pending proposal as the signed-in Admin."""
    user = _require_action(authorization, "approve_reschedule")
    try:
        proposal = state.decide_reschedule(
            request_id, req.decision, actor=user.username, comments=req.comments,
        )
    except KeyError as exc:
        raise HTTPException(404, str(exc))
    except (PermissionError, ValueError) as exc:
        raise HTTPException(400, str(exc))
    except Exception as exc:
        # The state setter has already kept the timetable unchanged if the
        # deterministic validity gate rejects the proposed move.
        raise HTTPException(400, f"Approval blocked by validity gate: {exc}")

    return {
        "status": proposal["status"],
        "message": f"Reschedule proposal {proposal['status']}.",
        "proposal": proposal,
    }


# ============================================================
# Disruptions
# ============================================================

@app.post("/api/disruption/apply")
def apply_disruption(req: DisruptionRequest, authorization: str | None = Header(default=None)):
    """Apply a disruption and regenerate the timetable."""
    _require_action(authorization, "manage_disruption")
    from datetime import datetime
    
    disruption_dict = {"changes": [c.model_dump() for c in req.changes]}
    state.disruption_data = disruption_dict
    state.disruption_applied = True
    state.add_audit("disruption_applied", "disruption", "live",
                   details={"changes": len(req.changes)})
    
    return {"status": "applied", "changes": len(req.changes),
            "message": "Disruption applied. Re-generate the timetable to see effects."}


@app.post("/api/disruption/upload")
def upload_disruption_file(path: str = Query(..., description="Path to disruption JSON file"), authorization: str | None = Header(default=None)):
    """Load disruption from a JSON file."""
    _require_action(authorization, "manage_disruption")
    try:
        with open(path, encoding="utf-8") as f:
            dis = json.load(f)
        state.disruption_data = dis
        state.disruption_applied = True
        state.add_audit("disruption_uploaded", "disruption", path,
                       details={"changes": len(dis.get("changes", []))})
        return {"status": "loaded", "changes": len(dis.get("changes", []))}
    except Exception as e:
        raise HTTPException(400, f"Failed to load disruption file: {e}")


@app.delete("/api/disruption")
def clear_disruption(authorization: str | None = Header(default=None)):
    """Clear any applied disruption."""
    _require_action(authorization, "manage_disruption")
    state.disruption_data = None
    state.disruption_applied = False
    state.add_audit("disruption_cleared", "disruption", "all")
    return {"status": "cleared"}


# ============================================================
# Validation
# ============================================================

@app.get("/api/validate", response_model=ValidationReport)
def validate_current():
    """Run the official validator against the current schedule."""
    if not state.assignments:
        raise HTTPException(400, "No timetable to validate.")
    
    data = _load_dataset()
    effective_data = data
    if state.disruption_applied and state.disruption_data:
        effective_data = _apply_disruption(data, state.disruption_data)
    
    # Use the official validator logic
    from collections import defaultdict
    
    schedule = state.export_schedule()
    
    # Import and run the starter pack validator logic inline
    try:
        import sys
        sys.path.insert(0, str(Path(__file__).parent.parent))
        
        # Replicate the validator's run() function
        from .validator_bridge import run_validation
        report = run_validation(effective_data, schedule)
        
        state.validation_report = report
        state.add_audit("validation_run", "timetable", f"v{state.version}",
                       details={"violations": report.get("hard_violation_count", 0)})
        
        return ValidationReport(
            hard_violations=report.get("hard_violations", []),
            hard_violation_count=report.get("hard_violation_count", 0),
            hard_by_rule=report.get("hard_by_rule", {}),
            soft_penalties=report.get("soft_penalties", {}),
            soft_total=report.get("soft_total", 0),
            warnings=report.get("warnings", []),
            bookings=report.get("bookings"),
        )
    except Exception as e:
        raise HTTPException(500, f"Validation error: {str(e)}\n{traceback.format_exc()}")


# ============================================================
# Export
# ============================================================

@app.get("/api/export/schedule")
def export_schedule():
    """Export current state as schedule.json."""
    if not state.assignments:
        raise HTTPException(400, "No timetable to export.")
    return state.export_schedule(TEAM_NAME)


@app.post("/api/export/save")
def save_schedule(filename: str = "schedule.json"):
    """Save schedule to exports/ directory."""
    if not state.assignments:
        raise HTTPException(400, "No timetable to export.")
    export_dir = Path(__file__).parent.parent / "exports"
    path = export_dir / filename
    state.save_export(path, TEAM_NAME)
    return {"status": "saved", "path": str(path)}


# ============================================================
# Dashboard
# ============================================================

@app.get("/api/dashboard", response_model=DashboardStats)
def get_dashboard():
    """Get dashboard overview statistics."""
    try:
        data = _load_dataset()
    except HTTPException:
        return DashboardStats()
    
    stats = DashboardStats(
        total_sessions=len(data["sessions"]),
        scheduled_sessions=len(state.assignments),
        total_rooms=len(data["rooms"]),
        total_faculty=len(data["faculty"]),
        total_groups=len(data["student_groups"]),
        total_booking_requests=len(data["booking_requests"]),
        total_exams=len(data.get("exams", [])),
        scheduled_exams=len(state.exams),
        timetable_status=state.timetable_status,
        solver_status=state.solver_status,
    )
    
    if state.fest_week:
        bookings = state.fest_week.get("bookings", [])
        stats.approved_bookings = sum(1 for b in bookings if b.get("status") == "approved")
        stats.rejected_bookings = sum(1 for b in bookings if b.get("status") == "rejected")
        stats.alternative_bookings = sum(1 for b in bookings if b.get("status") == "alternative_offered")
    
    if state.validation_report:
        stats.hard_violations = state.validation_report.get("hard_violation_count", 0)
        stats.soft_penalty = state.validation_report.get("soft_total", 0)
    
    return stats


# ============================================================
# Audit
# ============================================================

@app.get("/api/audit", response_model=list[AuditEventOut])
def get_audit_log(limit: int = 50, entity_type: str | None = None):
    """Get audit event history."""
    events = state.audit_log
    if entity_type:
        events = [e for e in events if e["entity_type"] == entity_type]
    return events[-limit:]


# ============================================================
# System
# ============================================================

@app.post("/api/reset")
def reset_state(authorization: str | None = Header(default=None)):
    """Reset all application state back to the committed baseline schedule."""
    user = _require_action(authorization, "reset_demo")
    state.reset()
    _bootstrap_from_export()
    state.add_audit("demo_reset", "system", "demo", actor=user.username)
    return {"status": "reset", "timetable_status": state.timetable_status, "sessions": len(state.assignments)}


@app.get("/api/health")
def health():
    return {"status": "ok", "timetable_status": state.timetable_status}


# ============================================================
# Built frontend (single-container / production mode)
# ============================================================

FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"

if FRONTEND_DIST.is_dir():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str):
        """Serve the Vite build, falling back to index.html for client-side routes."""
        if full_path.startswith("api/"):
            raise HTTPException(404, "Not found")

        if full_path:
            candidate = (FRONTEND_DIST / full_path).resolve()
            try:
                candidate.relative_to(FRONTEND_DIST.resolve())
            except ValueError:
                raise HTTPException(404, "Not found")
            if candidate.is_file():
                return FileResponse(candidate)

        return FileResponse(FRONTEND_DIST / "index.html")
