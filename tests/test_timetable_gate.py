from copy import deepcopy

import pytest

from app.state import AppState
from app.validator_bridge import check_timetable, run_validation


def _session(session_id, faculty, groups, *, kind="lecture", duration=1, room_types=None, **extra):
    return {
        "id": session_id, "course_id": session_id, "kind": kind, "groups": groups,
        "faculty_id": faculty, "size": 20, "duration": duration,
        "room_types": room_types or ["classroom"], **extra,
    }


def sample_data():
    return {
        "dataset_id": "gate-test",
        "calendar": {"days": ["MON", "TUE", "WED", "THU", "FRI"], "lab_start_periods": [2, 6], "lunch": {"after_period": 5}},
        "rooms": [
            {"id": "R1", "capacity": 30, "type": "classroom", "accessible": True, "features": [], "allowed_uses": ["event", "exam"]},
            {"id": "R2", "capacity": 10, "type": "classroom", "accessible": False, "features": [], "allowed_uses": ["event", "exam"]},
            {"id": "R3", "capacity": 30, "type": "lab", "accessible": True, "features": [], "allowed_uses": ["event", "exam"]},
            {"id": "R4", "capacity": 30, "type": "classroom", "accessible": True, "features": [], "allowed_uses": ["event", "exam"]},
        ],
        "faculty": [{"id": "F1", "max_hours_per_day": 2, "unavailable": []}, {"id": "F2", "max_hours_per_day": 4, "unavailable": []}],
        "student_groups": [{"id": "G1"}, {"id": "G2"}],
        "sessions": [
            _session("A", "F1", ["G1"]), _session("B", "F2", ["G2"]),
            _session("LAB", "F2", ["G2"], kind="lab", duration=2, room_types=["lab"]),
            _session("E", "F1", ["G1"], basket_slot="BASKET"),
            _session("F", "F2", ["G1"], basket_slot="BASKET"),
            _session("D", "F1", ["G2"]),
            _session("FIX", "F2", ["G2"], fixed_slot={"day": "WED", "start_period": 1}),
            _session("ACCESS", "F2", ["G2"], needs_accessible=True),
        ],
        "room_unavailability": [], "booking_requests": [{
            "id": "BR1", "role": "club", "requested_category": "club_event", "duration_periods": 1,
            "room_types": ["classroom"], "attendance": 20, "needs": [], "mandatory_for_groups": [],
            "windows": [{"day": "FRI", "from_period": 1, "to_period": 1}],
        }],
        "cancellations": [], "priority_order": ["institute_event", "club_event"], "role_category_cap": {"club": "club_event"},
        "exams": [],
    }


def valid_schedule():
    return {"sessions": [
        {"session_id": "A", "day": "MON", "start_period": 1, "room_id": "R1"},
        {"session_id": "B", "day": "MON", "start_period": 2, "room_id": "R4"},
        {"session_id": "LAB", "day": "TUE", "start_period": 2, "room_id": "R3"},
        {"session_id": "E", "day": "MON", "start_period": 4, "room_id": "R1"},
        {"session_id": "F", "day": "MON", "start_period": 4, "room_id": "R4"},
        {"session_id": "D", "day": "TUE", "start_period": 1, "room_id": "R1"},
        {"session_id": "FIX", "day": "WED", "start_period": 1, "room_id": "R1"},
        {"session_id": "ACCESS", "day": "THU", "start_period": 1, "room_id": "R1"},
    ]}


def rules(data, schedule):
    return {violation["rule"] for violation in check_timetable(schedule, data)}


def entry(schedule, session_id):
    return next(item for item in schedule["sessions"] if item["session_id"] == session_id)


def test_valid_schedule_passes_the_gate():
    assert check_timetable(valid_schedule(), sample_data()) == []


@pytest.mark.parametrize(("rule", "change"), [
    ("H1", lambda d, s: s["sessions"].pop()),
    ("H2", lambda d, s: (d["sessions"][1].update(faculty_id="F1"), entry(s, "B").update(start_period=1))),
    ("H3", lambda d, s: (d["sessions"][1].update(groups=["G1"]), entry(s, "B").update(start_period=1))),
    ("H4", lambda d, s: entry(s, "B").update(start_period=1, room_id="R1")),
    ("H5", lambda d, s: entry(s, "A").update(room_id="R2")),
    ("H6", lambda d, s: entry(s, "LAB").update(room_id="R1")),
    ("H7", lambda d, s: d["faculty"][0].update(unavailable=[{"day": "MON", "periods": [1]}])),
    ("H8", lambda d, s: d.update(room_unavailability=[{"room_id": "R1", "day": "MON", "periods": [1]}])),
    ("H9", lambda d, s: entry(s, "LAB").update(start_period=5)),
    ("H10", lambda d, s: entry(s, "ACCESS").update(room_id="R2")),
    ("H11", lambda d, s: entry(s, "F").update(start_period=5)),
    ("H12", lambda d, s: entry(s, "D").update(day="MON", start_period=3)),
    ("H14", lambda d, s: entry(s, "FIX").update(day="MON")),
])
def test_every_timetable_hard_rule_is_rejected(rule, change):
    data, schedule = sample_data(), valid_schedule()
    change(data, schedule)
    assert rule in rules(data, schedule)


def test_booking_hard_rule_is_rejected():
    schedule = valid_schedule()
    schedule["fest_week"] = {"session_overrides": [], "bookings": [{
        "request_id": "BR1", "status": "approved", "room_id": "R2", "day": "FRI", "start_period": 1, "end_period": 1,
    }]}
    assert "H13" in {violation["rule"] for violation in run_validation(sample_data(), schedule)["hard_violations"]}


def test_state_rejects_an_invalid_manual_reschedule_without_changing_it():
    state = AppState()
    state.dataset = sample_data()
    state.set_assignments(valid_schedule()["sessions"], "feasible")

    with pytest.raises(ValueError, match="validity gate"):
        state.apply_reschedule("B", "MON", 1, "R1")

    assert state.assignments["B"] == {"session_id": "B", "day": "MON", "start_period": 2, "room_id": "R4"}


def test_state_rejects_an_invalid_booking_before_storing_it():
    state = AppState()
    state.dataset = sample_data()
    state.set_assignments(valid_schedule()["sessions"], "feasible")

    with pytest.raises(ValueError, match="validity gate"):
        state.fest_week = {"session_overrides": [], "bookings": [{
            "request_id": "BR1", "status": "approved", "room_id": "R2", "day": "FRI", "start_period": 1, "end_period": 1,
        }]}

    assert state.fest_week is None
