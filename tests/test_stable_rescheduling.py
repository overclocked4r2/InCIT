from copy import deepcopy

from app.main import _apply_disruption, _reschedule_diff
from app.solver import solve_timetable
from app.validator_bridge import run_validation


def stable_data():
    return {
        "dataset_id": "stable-test",
        "calendar": {"days": ["MON", "TUE", "WED", "THU", "FRI"], "lab_start_periods": [2, 6], "lunch": {"after_period": 5}},
        "rooms": [{"id": "R1", "capacity": 30, "type": "classroom", "accessible": True, "allowed_uses": ["lecture"]}],
        "faculty": [
            {"id": "F1", "max_hours_per_day": 4, "unavailable": [], "preferences": []},
            {"id": "F2", "max_hours_per_day": 4, "unavailable": [], "preferences": []},
        ],
        "student_groups": [{"id": "G1"}, {"id": "G2"}],
        "sessions": [
            {"id": "S1", "course_id": "C1", "kind": "lecture", "groups": ["G1"], "faculty_id": "F1", "size": 20, "duration": 1, "room_types": ["classroom"]},
            {"id": "S2", "course_id": "C2", "kind": "lecture", "groups": ["G2"], "faculty_id": "F2", "size": 20, "duration": 1, "room_types": ["classroom"]},
        ],
        "room_unavailability": [], "booking_requests": [], "cancellations": [], "priority_order": [], "role_category_cap": {}, "exams": [],
    }


BASELINE = {
    "S1": {"session_id": "S1", "day": "MON", "start_period": 1, "room_id": "R1"},
    "S2": {"session_id": "S2", "day": "TUE", "start_period": 1, "room_id": "R1"},
}


def test_sample_room_disruption_moves_only_the_affected_session_and_returns_diff():
    data = stable_data()
    disruption = {"changes": [{"type": "room_unavailable", "room_id": "R1", "days": ["MON"], "periods": [1], "reason": "maintenance"}]}
    changed = _apply_disruption(data, disruption)

    result = solve_timetable(changed, baseline_assignments=BASELINE, time_limit_seconds=5, num_workers=1)
    assert result.status == "optimal"
    assert result.stats["moved_sessions"] == 1
    assert next(item for item in result.assignments if item["session_id"] == "S2") == BASELINE["S2"]
    assert run_validation(changed, {"sessions": result.assignments})["hard_violation_count"] == 0

    diff = _reschedule_diff(BASELINE, result.assignments, changed, disruption)
    assert diff == [{
        "session_id": "S1", "old": BASELINE["S1"],
        "new": next(item for item in result.assignments if item["session_id"] == "S1"),
        "reason": "Original room R1 is unavailable at this time.",
    }]


def test_different_room_closure_keeps_every_session_when_the_baseline_is_unaffected():
    data = stable_data()
    data["rooms"].append({"id": "R2", "capacity": 30, "type": "classroom", "accessible": True, "allowed_uses": ["lecture"]})
    data["room_unavailability"] = [{"room_id": "R2", "day": "WED", "periods": [3]}]
    result = solve_timetable(data, baseline_assignments=BASELINE, time_limit_seconds=5, num_workers=1)

    assert result.status == "optimal"
    assert result.stats["moved_sessions"] == 0


def test_faculty_leave_moves_only_that_facultys_affected_session():
    data = stable_data()
    data["faculty"][0]["unavailable"] = [{"day": "MON", "periods": [1]}]
    result = solve_timetable(data, baseline_assignments=BASELINE, time_limit_seconds=5, num_workers=1)

    assert result.status == "optimal"
    assert result.stats["moved_sessions"] == 1
    assert next(item for item in result.assignments if item["session_id"] == "S2") == BASELINE["S2"]


def test_new_session_with_no_free_slot_returns_a_readable_no_fix_reason():
    data = stable_data()
    data["sessions"][0]["fixed_slot"] = {"day": "MON", "start_period": 1}
    data["sessions"].append({
        "id": "NEW", "course_id": "NEW", "kind": "lecture", "groups": ["G1"], "faculty_id": "F1",
        "size": 20, "duration": 1, "room_types": ["classroom"],
        "fixed_slot": {"day": "MON", "start_period": 1},
    })
    result = solve_timetable(data, baseline_assignments=deepcopy(BASELINE), time_limit_seconds=5, num_workers=1)

    assert result.status == "infeasible"
    assert result.violations == [
        "No valid fix: the remaining room, faculty, group, and fixed-slot constraints cannot all be met together."
    ]
