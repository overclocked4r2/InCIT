"""Student & campus portal API for InCIT.

This is the "Campus Web" layer of the product: a student-facing view built
entirely on top of the scheduling engine. Timetables, exams and fest-week
events come from the solver/export state; attendance and marks are clearly
marked demo records generated deterministically per student and course so
the dashboard is useful before a real student-information system is wired in.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel, Field

from .config import PROJECT_ROOT
from .dataset import get_dataset
from .state import state

router = APIRouter(prefix="/api/portal", tags=["student portal"])

PORTAL_STATE_PATH = PROJECT_ROOT / "data" / "portal_state.json"

DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
TEACHING_DAYS = DAY_ORDER[:5]
ATTENDANCE_TARGET = 75.0

# ---------------------------------------------------------------------------
# Demo roster (synthetic students mapped to the dataset's real groups)
# ---------------------------------------------------------------------------

DEMO_STUDENTS: list[dict[str, Any]] = [
    {
        "id": "STU-001",
        "name": "Arunangshu Roy Bhadra",
        "roll": "22CSE1042",
        "group_id": "CSE-2",
        "department": "CSE",
        "year": 2,
        "semester": 3,
        "email": "arunangshu.r@cit.edu.in",
        "hostel": "Ganga Hostel",
        "accessibility": False,
    },
    {
        "id": "STU-002",
        "name": "Meera Iyer",
        "roll": "21CSE3071",
        "group_id": "CSE-3",
        "department": "CSE",
        "year": 3,
        "semester": 5,
        "email": "meera.i@cit.edu.in",
        "hostel": "Yamuna Hostel",
        "accessibility": False,
    },
    {
        "id": "STU-003",
        "name": "Rahul Verma",
        "roll": "22ECE2018",
        "group_id": "ECE-2",
        "department": "ECE",
        "year": 2,
        "semester": 3,
        "email": "rahul.v@cit.edu.in",
        "hostel": "Krishna Hostel",
        "accessibility": False,
    },
    {
        "id": "STU-004",
        "name": "Sana Khan",
        "roll": "22ME2044",
        "group_id": "ME-2",
        "department": "ME",
        "year": 2,
        "semester": 3,
        "email": "sana.k@cit.edu.in",
        "hostel": "Saraswati Hostel",
        "accessibility": True,
    },
    {
        "id": "STU-005",
        "name": "Dev Patel",
        "roll": "25Y1A0113",
        "group_id": "Y1-A",
        "department": "COMMON",
        "year": 1,
        "semester": 1,
        "email": "dev.p@cit.edu.in",
        "hostel": "Ganga Hostel",
        "accessibility": False,
    },
    {
        "id": "STU-006",
        "name": "Ananya Rao",
        "roll": "21CE3055",
        "group_id": "CE-3",
        "department": "CE",
        "year": 3,
        "semester": 5,
        "email": "ananya.r@cit.edu.in",
        "hostel": "Yamuna Hostel",
        "accessibility": False,
    },
]

# ---------------------------------------------------------------------------
# Mess menu — illustrative sample data, clearly labelled in the UI
# ---------------------------------------------------------------------------

MESS_MENU: dict[str, dict[str, str]] = {
    "MON": {
        "breakfast": "Poha, boiled eggs, banana, tea/coffee",
        "lunch": "Rajma chawal, jeera aloo, salad, curd",
        "snacks": "Samosa, green chutney, lemon tea",
        "dinner": "Paneer butter masala, roti, rice, gulab jamun",
    },
    "TUE": {
        "breakfast": "Idli, sambar, coconut chutney, fruit",
        "lunch": "Chole, bhature, onion salad, buttermilk",
        "snacks": "Veg sandwich, iced tea",
        "dinner": "Egg curry, dal tadka, rice, roti",
    },
    "WED": {
        "breakfast": "Aloo paratha, curd, pickle, tea",
        "lunch": "Mixed dal, bhindi masala, rice, roti, papad",
        "snacks": "Vada pav, masala chai",
        "dinner": "Chicken biryani / veg biryani, raita, salad",
    },
    "THU": {
        "breakfast": "Upma, chutney, boiled eggs, fruit",
        "lunch": "Kadhi pakora, aloo gobi, rice, roti",
        "snacks": "Bhel puri, buttermilk",
        "dinner": "Dal makhani, jeera rice, roti, salad",
    },
    "FRI": {
        "breakfast": "Puri bhaji, banana, tea/coffee",
        "lunch": "Veg pulao, paneer do pyaza, raita",
        "snacks": "Pav bhaji, lemonade",
        "dinner": "Fish curry / soya chunk curry, rice, roti",
    },
    "SAT": {
        "breakfast": "Chole bhature, lassi",
        "lunch": "Veg thali, salad, papad, ice cream",
        "snacks": "Maggi, tea/coffee",
        "dinner": "Dal fry, aloo matar, rice, roti",
    },
    "SUN": {
        "breakfast": "Masala dosa, sambar, chutney, fruit",
        "lunch": "Special veg thali, chicken curry (optional), kheer",
        "snacks": "Sandwich, iced tea",
        "dinner": "Veg fried rice, manchurian, soup",
    },
}


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class AttendanceLogIn(BaseModel):
    student_id: str
    course_id: str
    present: bool = True


class NoteIn(BaseModel):
    student_id: str
    title: str = Field(default="", max_length=160)
    body: str = Field(default="", max_length=20000)
    course_id: str | None = None
    pinned: bool = False


class NoteUpdate(BaseModel):
    student_id: str
    title: str | None = Field(default=None, max_length=160)
    body: str | None = Field(default=None, max_length=20000)
    course_id: str | None = None
    pinned: bool | None = None


# ---------------------------------------------------------------------------
# Persistence for attendance + notes
# ---------------------------------------------------------------------------

def _empty_portal() -> dict[str, Any]:
    return {"attendance": {}, "attendance_log": [], "notes": []}


def load_portal_state() -> None:
    """Merge the persisted portal store into global state (best effort)."""
    try:
        if PORTAL_STATE_PATH.exists():
            payload = json.loads(PORTAL_STATE_PATH.read_text(encoding="utf-8"))
            state.portal = {
                "attendance": payload.get("attendance", {}) or {},
                "attendance_log": payload.get("attendance_log", []) or [],
                "notes": payload.get("notes", []) or [],
            }
    except Exception:
        state.portal = _empty_portal()


def _save_portal_state() -> None:
    try:
        PORTAL_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = PORTAL_STATE_PATH.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(state.portal, indent=2, default=str), encoding="utf-8")
        tmp.replace(PORTAL_STATE_PATH)
    except Exception:
        # Persistence is a convenience; the API must keep working without it.
        pass


def reset_portal_state() -> None:
    state.portal = _empty_portal()
    _save_portal_state()


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------

def _courses_map() -> dict[str, dict]:
    return {c["id"]: c for c in get_dataset()["courses"]}


def _faculty_map() -> dict[str, dict]:
    return {f["id"]: f for f in get_dataset()["faculty"]}


def _rooms_map() -> dict[str, dict]:
    return {r["id"]: r for r in get_dataset()["rooms"]}


def _sessions_map() -> dict[str, dict]:
    return {s["id"]: s for s in get_dataset()["sessions"]}


def _get_student(student_id: str) -> dict[str, Any]:
    for student in DEMO_STUDENTS:
        if student["id"] == student_id:
            return student
    raise HTTPException(404, f"Student {student_id} not found")


def _initials(name: str) -> str:
    parts = [p for p in name.replace(".", " ").split() if p]
    return "".join(p[0] for p in parts[:3]).upper() or "?"


def _hours(value: float) -> str:
    return f"{value:g}"


def _period_info(period: int) -> dict[str, str]:
    periods = get_dataset()["calendar"]["periods"]
    for p in periods:
        if p["id"] == period:
            return {"start": p["start"], "end": p["end"]}
    return {"start": "", "end": ""}


def _period_span(start: int, duration: int = 1) -> tuple[str, str]:
    first = _period_info(start)
    last = _period_info(start + max(1, duration) - 1)
    return first["start"], last["end"]


def _span(start_period: int, end_period: int) -> tuple[str, str]:
    return _period_info(start_period)["start"], _period_info(end_period)["end"]


def _public_student(student: dict[str, Any]) -> dict[str, Any]:
    group = next(
        (g for g in get_dataset()["student_groups"] if g["id"] == student["group_id"]),
        {"id": student["group_id"], "name": student["group_id"], "size": 0},
    )
    courses = _student_courses(student)
    return {
        **student,
        "group_name": group["name"],
        "group_size": group.get("size", 0),
        "initials": _initials(student["name"]),
        "program": f"B.Tech {student['department']}",
        "semester_label": f"Semester {student['semester']}",
        "course_count": len(courses),
        "credits": round(sum(c["credits"] for c in courses), 1),
    }


def _credits(course: dict) -> float:
    return max(
        1.0,
        float(course.get("lecture_hours", 0))
        + float(course.get("tutorial_hours", 0))
        + float(course.get("lab_blocks", 0)) * 2,
    )


def _student_courses(student: dict[str, Any]) -> list[dict[str, Any]]:
    data = get_dataset()
    courses = _courses_map()
    faculty = _faculty_map()
    grouped: dict[str, dict[str, Any]] = {}

    for session in data["sessions"]:
        if student["group_id"] not in session.get("groups", []):
            continue
        cid = session["course_id"]
        entry = grouped.setdefault(
            cid,
            {
                "course_id": cid,
                "title": courses.get(cid, {}).get("title", cid),
                "credits": _credits(courses.get(cid, {})),
                "department": courses.get(cid, {}).get("department"),
                "weekly_periods": 0,
                "kinds": set(),
                "faculty_ids": set(),
                "session_ids": [],
            },
        )
        entry["weekly_periods"] += int(session.get("duration", 1))
        entry["kinds"].add(session.get("kind", "lecture"))
        entry["faculty_ids"].add(session.get("faculty_id"))
        entry["session_ids"].append(session["id"])

    rows: list[dict[str, Any]] = []
    for entry in sorted(grouped.values(), key=lambda e: e["course_id"]):
        row = {
            **entry,
            "kinds": sorted(entry["kinds"]),
            "faculty": [
                faculty.get(fid, {}).get("name", fid)
                for fid in sorted(entry["faculty_ids"])
            ],
        }
        row.pop("faculty_ids", None)
        rows.append(row)
    return rows


def _seed_int(student_id: str, key: str, bits: int = 32) -> int:
    digest = hashlib.sha256(f"{student_id}|{key}".encode("utf-8")).hexdigest()
    return int(digest[:16], 16) % (2**bits)


def _seed_float(student_id: str, key: str) -> float:
    return _seed_int(student_id, key, 40) / float(2**40)


# ---------------------------------------------------------------------------
# Attendance
# ---------------------------------------------------------------------------

_ATTENDANCE_TIERS = [
    (0.86, 0.94),
    (0.63, 0.70),
    (0.74, 0.84),
    (0.80, 0.90),
    (0.67, 0.74),
    (0.82, 0.92),
    (0.71, 0.79),
]


def _default_attendance(student_id: str, course_id: str, index: int) -> dict[str, int]:
    low, high = _ATTENDANCE_TIERS[index % len(_ATTENDANCE_TIERS)]
    pct = low + _seed_float(student_id, f"attendance|{course_id}") * (high - low)
    held = 26 + _seed_int(student_id, f"held|{course_id}", 8) % 30
    attended = min(held, max(0, round(held * pct)))
    return {"attended": attended, "held": held}


def _attendance_record(student_id: str, course_id: str, index: int) -> dict[str, int]:
    records = state.portal.setdefault("attendance", {}).setdefault(student_id, {})
    record = records.get(course_id)
    if not record:
        record = _default_attendance(student_id, course_id, index)
        records[course_id] = record
    return record


def _attendance_summary(student: dict[str, Any]) -> dict[str, Any]:
    courses = _student_courses(student)
    rows: list[dict[str, Any]] = []
    total_attended = total_held = 0

    for index, course in enumerate(courses):
        record = _attendance_record(student["id"], course["course_id"], index)
        attended, held = int(record["attended"]), int(record["held"])
        total_attended += attended
        total_held += held
        percent = round(attended / held * 100, 1) if held else 0.0
        if percent < 65:
            status = "critical"
        elif percent < ATTENDANCE_TARGET:
            status = "watch"
        elif percent < 85:
            status = "safe"
        else:
            status = "comfortable"

        to_reach = 0
        can_miss = 0
        if percent < ATTENDANCE_TARGET and held:
            to_reach = max(0, math.ceil((ATTENDANCE_TARGET / 100 * held - attended) / (1 - ATTENDANCE_TARGET / 100)))
        elif held:
            can_miss = max(0, math.floor((attended - ATTENDANCE_TARGET / 100 * held) / (ATTENDANCE_TARGET / 100) + 1e-9))

        rows.append(
            {
                **course,
                "attended": attended,
                "held": held,
                "percent": percent,
                "status": status,
                "to_reach": to_reach,
                "can_miss": can_miss,
            }
        )

    overall = round(total_attended / total_held * 100, 1) if total_held else 0.0
    below = [r for r in rows if r["percent"] < ATTENDANCE_TARGET]
    return {
        "overall_percent": overall,
        "target": ATTENDANCE_TARGET,
        "attended": total_attended,
        "held": total_held,
        "course_count": len(rows),
        "below_target": len(below),
        "critical": sum(1 for r in rows if r["status"] == "critical"),
        "courses": rows,
        "watchlist": sorted(below, key=lambda r: r["percent"])[:3],
    }


@router.get("/students")
def list_students():
    return [_public_student(s) for s in DEMO_STUDENTS]


@router.get("/students/{student_id}")
def get_student(student_id: str):
    return _public_student(_get_student(student_id))


@router.get("/attendance")
def get_attendance(student_id: str = Query(...)):
    student = _get_student(student_id)
    summary = _attendance_summary(student)
    log = [
        entry
        for entry in reversed(state.portal.get("attendance_log", []))
        if entry.get("student_id") == student_id
    ][:20]
    return {**summary, "student": _public_student(student), "log": log}


@router.post("/attendance/log")
def log_attendance(req: AttendanceLogIn):
    student = _get_student(req.student_id)
    courses = _student_courses(student)
    index = next((i for i, c in enumerate(courses) if c["course_id"] == req.course_id), None)
    if index is None:
        raise HTTPException(404, f"Course {req.course_id} is not on this student's timetable")

    record = _attendance_record(student["id"], req.course_id, index)
    record["held"] = int(record["held"]) + 1
    if req.present:
        record["attended"] = int(record["attended"]) + 1

    entry = {
        "id": str(uuid.uuid4()),
        "student_id": student["id"],
        "course_id": req.course_id,
        "present": req.present,
        "timestamp": datetime.now().isoformat(),
        "source": "manual",
    }
    state.portal.setdefault("attendance_log", []).append(entry)
    _save_portal_state()

    course = next(c for c in courses if c["course_id"] == req.course_id)
    percent = round(record["attended"] / record["held"] * 100, 1) if record["held"] else 0
    return {
        "status": "logged",
        "entry": entry,
        "course": {
            **course,
            "attended": record["attended"],
            "held": record["held"],
            "percent": percent,
        },
        "summary": _attendance_summary(student),
    }


@router.delete("/attendance")
def reset_attendance(student_id: str = Query(...)):
    student = _get_student(student_id)
    state.portal.setdefault("attendance", {}).pop(student_id, None)
    state.portal["attendance_log"] = [
        e for e in state.portal.get("attendance_log", []) if e.get("student_id") != student_id
    ]
    _save_portal_state()
    return {"status": "reset", "summary": _attendance_summary(student)}


@router.get("/attendance/export")
def export_attendance(student_id: str = Query(...)):
    student = _get_student(student_id)
    summary = _attendance_summary(student)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Course", "Title", "Attended", "Held", "Percent", "Target", "Must attend to reach 75%", "Can miss"])
    for row in summary["courses"]:
        writer.writerow([
            row["course_id"],
            row["title"],
            row["attended"],
            row["held"],
            row["percent"],
            ATTENDANCE_TARGET,
            row["to_reach"],
            row["can_miss"],
        ])
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="attendance-{student["roll"]}.csv"'},
    )


# ---------------------------------------------------------------------------
# Marks / CGPA
# ---------------------------------------------------------------------------

_MARK_COMPONENTS = [("Quiz 1", 10), ("Quiz 2", 10), ("Assignment", 15), ("Mid-term", 30)]


def _grade(percent: float) -> tuple[str, int]:
    if percent >= 90:
        return "O", 10
    if percent >= 80:
        return "A+", 9
    if percent >= 70:
        return "A", 8
    if percent >= 60:
        return "B+", 7
    if percent >= 50:
        return "B", 6
    if percent >= 40:
        return "C", 5
    return "F", 0


def _marks_course(student_id: str, course: dict[str, Any], index: int) -> dict[str, Any]:
    components = []
    scored = 0.0
    maximum = 0.0
    for j, (name, max_marks) in enumerate(_MARK_COMPONENTS):
        seed = _seed_float(student_id, f"marks|{course['course_id']}|{name}")
        pct = 0.58 + seed * 0.40 + (0.04 if index % 3 == 0 else 0)
        pct = min(0.99, pct)
        score = round(max_marks * pct * 2) / 2
        components.append({"name": name, "score": score, "max": max_marks, "percent": round(score / max_marks * 100, 1)})
        scored += score
        maximum += max_marks
    percent = round(scored / maximum * 100, 1) if maximum else 0.0
    grade, points = _grade(percent)
    return {
        **course,
        "components": components,
        "scored": round(scored, 1),
        "max": maximum,
        "percent": percent,
        "grade": grade,
        "grade_points": points,
    }


def _marks_summary(student: dict[str, Any]) -> dict[str, Any]:
    courses = _student_courses(student)
    rows = [_marks_course(student["id"], course, i) for i, course in enumerate(courses)]
    credits = sum(r["credits"] for r in rows) or 1
    sgpa = round(sum(r["credits"] * r["grade_points"] for r in rows) / credits, 2)

    history = []
    prior_credits = 0.0
    prior_points = 0.0
    for semester in range(1, student["semester"]):
        sem_credits = 20 + _seed_int(student["id"], f"credits|{semester}", 6) % 4
        sem_sgpa = round(7.2 + _seed_float(student["id"], f"sgpa|{semester}") * 1.8, 2)
        history.append({"semester": semester, "sgpa": sem_sgpa, "credits": sem_credits, "current": False})
        prior_credits += sem_credits
        prior_points += sem_sgpa * sem_credits
    history.append({"semester": student["semester"], "sgpa": sgpa, "credits": round(credits, 1), "current": True})
    cgpa = round((prior_points + sgpa * credits) / (prior_credits + credits), 2)

    return {
        "courses": rows,
        "sgpa": sgpa,
        "cgpa": cgpa,
        "credits": round(credits, 1),
        "semester": student["semester"],
        "history": history,
        "published_marks": sum(r["max"] for r in rows),
        "scored_marks": round(sum(r["scored"] for r in rows), 1),
        "best_course": max(rows, key=lambda r: r["percent"])["course_id"] if rows else None,
        "weakest_course": min(rows, key=lambda r: r["percent"])["course_id"] if rows else None,
    }


@router.get("/marks")
def get_marks(student_id: str = Query(...)):
    student = _get_student(student_id)
    return {"student": _public_student(student), **_marks_summary(student)}


# ---------------------------------------------------------------------------
# Timetable, exams and planner
# ---------------------------------------------------------------------------

def _classes_for_day(student: dict[str, Any], day: str) -> list[dict[str, Any]]:
    data = get_dataset()
    sessions = _sessions_map()
    courses = _courses_map()
    faculty = _faculty_map()
    rooms = _rooms_map()
    rows = []
    for assignment in state.assignments.values():
        if assignment["day"] != day:
            continue
        session = sessions.get(assignment["session_id"])
        if not session or student["group_id"] not in session.get("groups", []):
            continue
        start, end = _period_span(assignment["start_period"], int(session.get("duration", 1)))
        rows.append({
            "session_id": assignment["session_id"],
            "course_id": session["course_id"],
            "title": courses.get(session["course_id"], {}).get("title", session["course_id"]),
            "kind": session.get("kind", "lecture"),
            "faculty": faculty.get(session.get("faculty_id"), {}).get("name", session.get("faculty_id")),
            "faculty_id": session.get("faculty_id"),
            "room_id": assignment["room_id"],
            "room": rooms.get(assignment["room_id"], {}).get("name", assignment["room_id"]),
            "start_period": assignment["start_period"],
            "end_period": assignment["start_period"] + int(session.get("duration", 1)) - 1,
            "duration": int(session.get("duration", 1)),
            "start": start,
            "end": end,
        })
    rows.sort(key=lambda r: (r["start_period"], r["course_id"]))
    return rows


def _all_exams(student: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    data = get_dataset()
    exams = {e["id"]: e for e in data.get("exams", [])}
    courses = _courses_map()
    rooms = _rooms_map()
    exam_sessions = {s["id"]: s for s in data["calendar"]["exam_week"]["sessions"]}
    rows = []
    for scheduled in state.exams:
        exam = exams.get(scheduled.get("exam_id"))
        if not exam:
            continue
        session = exam_sessions.get(scheduled.get("session"), {})
        room_ids = scheduled.get("rooms", [])
        seats = sum(rooms.get(rid, {}).get("capacity", 0) // 2 for rid in room_ids)
        rows.append({
            "exam_id": exam["id"],
            "course_ids": exam["course_ids"],
            "titles": [courses.get(cid, {}).get("title", cid) for cid in exam["course_ids"]],
            "groups": exam["groups"],
            "size": exam["size"],
            "duration_hours": exam.get("duration_hours", 2),
            "day": scheduled.get("day"),
            "session": scheduled.get("session"),
            "start": session.get("start"),
            "end": session.get("end"),
            "rooms": [{"id": rid, "name": rooms.get(rid, {}).get("name", rid), "capacity": rooms.get(rid, {}).get("capacity", 0)} for rid in room_ids],
            "seats": seats,
            "is_mine": bool(student and student["group_id"] in exam["groups"]),
        })
    rows.sort(key=lambda r: (DAY_ORDER.index(r["day"]) if r["day"] in DAY_ORDER else 9, 0 if r["session"] == "AM" else 1, r["exam_id"]))
    return rows


@router.get("/exams")
def get_exams(student_id: str | None = None):
    student = _get_student(student_id) if student_id else None
    all_rows = _all_exams(student)
    mine = [r for r in all_rows if r["is_mine"]] if student else []
    return {
        "exams": mine if student else all_rows,
        "all_exams": all_rows,
        "my_count": len(mine),
        "total_count": len(all_rows),
        "policy": "Exams use 50% of room capacity and are checked for room, group and invigilation clashes.",
    }


def _events(student: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    data = get_dataset()
    requests = {b["id"]: b for b in data["booking_requests"]}
    decisions = (state.fest_week or {}).get("bookings", [])
    rooms = _rooms_map()
    rows = []
    for decision in decisions:
        if decision.get("status") not in ("approved", "alternative_offered"):
            continue
        request = requests.get(decision.get("request_id"))
        if not request:
            continue
        start = decision.get("start_period")
        end = decision.get("end_period")
        if start is None or end is None:
            continue
        start_time, end_time = _span(start, end)
        mandatory = request.get("mandatory_for_groups", []) or []
        rows.append({
            "request_id": request["id"],
            "title": request["title"],
            "requester": request["requester"],
            "role": request["role"],
            "category": request.get("requested_category"),
            "attendance": request.get("attendance"),
            "status": decision.get("status"),
            "day": decision.get("day"),
            "start_period": start,
            "end_period": end,
            "start": start_time,
            "end": end_time,
            "room_id": decision.get("room_id"),
            "room": rooms.get(decision.get("room_id"), {}).get("name", decision.get("room_id")),
            "needs": request.get("needs", []),
            "mandatory_for_groups": mandatory,
            "required_for_you": bool(student and student["group_id"] in mandatory),
            "raw_text": request.get("raw_text", ""),
        })
    rows.sort(key=lambda r: (DAY_ORDER.index(r["day"]) if r["day"] in DAY_ORDER else 9, r["start_period"]))
    return rows


@router.get("/events")
def get_events(student_id: str | None = None):
    student = _get_student(student_id) if student_id else None
    rows = _events(student)
    return {
        "events": rows,
        "for_you": [r for r in rows if r["required_for_you"]],
        "count": len(rows),
        "fest_week": get_dataset()["calendar"].get("fest_week"),
    }


@router.get("/clubs")
def get_clubs():
    data = get_dataset()
    events = _events()
    clubs: dict[str, dict[str, Any]] = {}
    for request in data["booking_requests"]:
        if request.get("role") != "club":
            continue
        club = clubs.setdefault(
            request["requester"],
            {"name": request["requester"], "events": [], "approved": 0, "total": 0},
        )
        club["total"] += 1
        for event in events:
            if event["request_id"] == request["id"]:
                club["events"].append(event)
                club["approved"] += 1
    return {"clubs": sorted(clubs.values(), key=lambda c: (-c["approved"], c["name"])), "count": len(clubs)}


@router.get("/mess")
def get_mess():
    today = datetime.now().strftime("%a").upper()[:3]
    if today not in MESS_MENU:
        today = "MON"
    days = [{"day": d, "menu": MESS_MENU[d], "is_today": d == today} for d in DAY_ORDER]
    return {"today": today, "menu": MESS_MENU[today], "days": days, "sample": True}


def _week(student: dict[str, Any]) -> dict[str, Any]:
    events = _events(student)
    days = []
    total_periods = 0
    busiest = {"day": None, "classes": -1}
    earliest = None
    latest = None

    for day in TEACHING_DAYS:
        classes = _classes_for_day(student, day)
        day_events = [e for e in events if e["day"] == day]
        busy: set[int] = set()
        for row in classes:
            busy.update(range(row["start_period"], row["end_period"] + 1))
        for event in day_events:
            busy.update(range(event["start_period"], event["end_period"] + 1))
        free_blocks = []
        period = 1
        while period <= 9:
            if period in busy:
                period += 1
                continue
            start = period
            while period <= 9 and period not in busy:
                period += 1
            end = period - 1
            free_blocks.append({
                "start_period": start,
                "end_period": end,
                "start": _period_info(start)["start"],
                "end": _period_info(end)["end"],
                "periods": end - start + 1,
            })
        total_periods += sum(c["duration"] for c in classes)
        if len(classes) > busiest["classes"]:
            busiest = {"day": day, "classes": len(classes)}
        for c in classes:
            if earliest is None or c["start"] < earliest["start"]:
                earliest = c
            if latest is None or c["end"] > latest["end"]:
                latest = c
        days.append({
            "day": day,
            "classes": classes,
            "events": day_events,
            "free_blocks": free_blocks,
            "class_count": len(classes),
            "busy_periods": sorted(busy),
        })

    return {
        "days": days,
        "workload": {
            "weekly_classes": sum(d["class_count"] for d in days),
            "weekly_periods": total_periods,
            "busiest_day": busiest["day"],
            "earliest": earliest,
            "latest": latest,
        },
        "exam_week": get_dataset()["calendar"].get("exam_week"),
    }


@router.get("/planner")
def get_planner(student_id: str = Query(...)):
    student = _get_student(student_id)
    return {"student": _public_student(student), **_week(student), "exams": [e for e in _all_exams(student) if e["is_mine"]]}


# ---------------------------------------------------------------------------
# Home dashboard
# ---------------------------------------------------------------------------

def _ensure_validation() -> None:
    if state.validation_report is not None or not state.assignments:
        return
    try:
        from .validator_bridge import run_validation
        state.validation_report = run_validation(get_dataset(), state.export_schedule())
    except Exception:
        state.validation_report = None


def _today_context(student: dict[str, Any]) -> dict[str, Any]:
    now = datetime.now()
    today_code = DAY_ORDER[now.weekday()]
    is_class_day = today_code in TEACHING_DAYS
    classes = _classes_for_day(student, today_code) if is_class_day else []
    next_class = None
    next_day = today_code

    if is_class_day:
        for row in classes:
            if row["end"] > now.strftime("%H:%M"):
                next_class = {**row, "when": "Today"}
                break
    if not next_class:
        for offset in range(1, 8):
            day = DAY_ORDER[(now.weekday() + offset) % 7]
            if day not in TEACHING_DAYS:
                continue
            upcoming = _classes_for_day(student, day)
            if upcoming:
                next_class = {**upcoming[0], "when": day.capitalize()}
                next_day = day
                break

    return {
        "date": now.date().isoformat(),
        "weekday": today_code,
        "is_class_day": is_class_day,
        "classes": classes,
        "next_classes": classes if is_class_day else _classes_for_day(student, next_day),
        "next_class": next_class,
        "next_day": next_day,
        "label": "Today" if is_class_day else "Weekend",
    }


def _notifications(student: dict[str, Any], attendance: dict, marks: dict, exams: list, events: list) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    if attendance["below_target"]:
        items.append({
            "id": "attendance",
            "tone": "warning",
            "title": f"{attendance['below_target']} subject{'s' if attendance['below_target'] != 1 else ''} below 75%",
            "detail": "Open attendance to see how many classes you need to attend.",
            "href": "/attendance",
        })
    if exams:
        first = exams[0]
        items.append({
            "id": "exam",
            "tone": "info",
            "title": f"{first['titles'][0]} exam on {first['day']} · {first['session']}",
            "detail": f"{first['start']}–{first['end']} · {', '.join(r['name'] for r in first['rooms'])}",
            "href": "/exams",
        })
    required = [e for e in events if e["required_for_you"]]
    if required:
        items.append({
            "id": "event",
            "tone": "accent",
            "title": f"{len(required)} event{'s' if len(required) != 1 else ''} marked for your group",
            "detail": required[0]["title"],
            "href": "/campus-life",
        })
    if state.timetable_status == "published":
        items.append({
            "id": "timetable",
            "tone": "success",
            "title": f"Timetable v{state.version} is published",
            "detail": "Your classes and exams are in sync with the latest schedule.",
            "href": "/my-timetable",
        })
    return items[:5]


@router.get("/home")
def get_home(student_id: str = Query(...)):
    student = _get_student(student_id)
    _ensure_validation()
    attendance = _attendance_summary(student)
    marks = _marks_summary(student)
    exams = [e for e in _all_exams(student) if e["is_mine"]]
    events = _events(student)
    week = _week(student)
    today = _today_context(student)
    mess = get_mess()
    hard = (state.validation_report or {}).get("hard_violation_count")
    return {
        "student": _public_student(student),
        "timetable": {
            "status": state.timetable_status,
            "version": state.version,
            "published_at": state.published_at,
            "solver_status": state.solver_status,
            "validated": state.validation_report is not None,
            "hard_violations": hard,
            "soft_penalty": (state.validation_report or {}).get("soft_total"),
        },
        "today": today,
        "attendance": attendance,
        "marks": marks,
        "exams": exams[:3],
        "events": events[:4],
        "mess": {"day": mess["today"], "menu": mess["menu"], "sample": True},
        "notifications": _notifications(student, attendance, marks, exams, events),
        "workload": week["workload"],
        "notes_count": sum(1 for n in state.portal.get("notes", []) if n.get("student_id") == student_id),
    }


# ---------------------------------------------------------------------------
# Notes
# ---------------------------------------------------------------------------

def _notes_for(student_id: str) -> list[dict[str, Any]]:
    notes = [n for n in state.portal.get("notes", []) if n.get("student_id") == student_id]
    notes.sort(key=lambda n: n.get("updated_at", ""), reverse=True)
    notes.sort(key=lambda n: 0 if n.get("pinned") else 1)
    return notes


@router.get("/notes")
def list_notes(student_id: str = Query(...)):
    _get_student(student_id)
    return _notes_for(student_id)


@router.post("/notes")
def create_note(req: NoteIn):
    _get_student(req.student_id)
    title = req.title.strip() or (req.body.strip().splitlines()[0][:80] if req.body.strip() else "Untitled note")
    note = {
        "id": str(uuid.uuid4()),
        "student_id": req.student_id,
        "title": title,
        "body": req.body.strip(),
        "course_id": req.course_id or None,
        "pinned": bool(req.pinned),
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }
    state.portal.setdefault("notes", []).append(note)
    _save_portal_state()
    return note


@router.put("/notes/{note_id}")
def update_note(note_id: str, req: NoteUpdate):
    note = next((n for n in state.portal.get("notes", []) if n["id"] == note_id and n["student_id"] == req.student_id), None)
    if not note:
        raise HTTPException(404, "Note not found")
    if req.title is not None:
        note["title"] = req.title.strip() or note["title"]
    if req.body is not None:
        note["body"] = req.body.strip()
    if req.course_id is not None:
        note["course_id"] = req.course_id or None
    if req.pinned is not None:
        note["pinned"] = req.pinned
    note["updated_at"] = datetime.now().isoformat()
    _save_portal_state()
    return note


@router.delete("/notes/{note_id}")
def delete_note(note_id: str, student_id: str = Query(...)):
    before = len(state.portal.get("notes", []))
    state.portal["notes"] = [
        n for n in state.portal.get("notes", [])
        if not (n["id"] == note_id and n["student_id"] == student_id)
    ]
    if len(state.portal["notes"]) == before:
        raise HTTPException(404, "Note not found")
    _save_portal_state()
    return {"status": "deleted", "id": note_id}


# ---------------------------------------------------------------------------
# Global search
# ---------------------------------------------------------------------------

@router.get("/search")
def search(q: str = Query(..., min_length=1), student_id: str | None = None):
    data = get_dataset()
    needle = q.lower().strip()
    student = _get_student(student_id) if student_id else None

    courses = [
        {"id": c["id"], "title": c["title"], "department": c.get("department")}
        for c in data["courses"]
        if needle in c["id"].lower() or needle in c["title"].lower()
    ][:6]
    faculty = [
        {"id": f["id"], "name": f["name"], "department": f["department"]}
        for f in data["faculty"]
        if needle in f["name"].lower() or needle in f["department"].lower()
    ][:6]
    rooms = [
        {"id": r["id"], "name": r["name"], "building": r["building"], "type": r["type"]}
        for r in data["rooms"]
        if needle in r["id"].lower() or needle in r["name"].lower() or needle in r["building"].lower()
    ][:6]
    events = [
        {"request_id": e["request_id"], "title": e["title"], "day": e["day"], "start": e["start"], "room": e["room"]}
        for e in _events(student)
        if needle in e["title"].lower() or needle in e["requester"].lower()
    ][:6]
    return {"query": q, "courses": courses, "faculty": faculty, "rooms": rooms, "events": events}


if not hasattr(state, "portal"):
    state.portal = _empty_portal()
