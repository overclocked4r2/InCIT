from app.solver import solve_timetable
from app.validator_bridge import run_validation


def soft_score_data():
    sessions = []
    for index in range(7):
        sessions.append({
            "id": f"S{index}", "course_id": "REPEAT" if index < 2 else f"C{index}", "kind": "lecture",
            "groups": ["G1"], "faculty_id": f"F{index}", "size": 20, "duration": 1,
            "room_types": ["classroom"],
        })
    return {
        "dataset_id": "soft-score-test",
        "calendar": {"days": ["MON", "TUE", "WED", "THU", "FRI"], "lab_start_periods": [2, 6], "lunch": {"after_period": 5}},
        "rooms": [{"id": "R1", "capacity": 30, "type": "classroom", "accessible": True, "allowed_uses": ["lecture"]}],
        "faculty": [{"id": f"F{index}", "max_hours_per_day": 4, "unavailable": [], "preferences": []} for index in range(7)],
        "student_groups": [{"id": "G1"}], "sessions": sessions,
        "room_unavailability": [], "booking_requests": [], "cancellations": [], "priority_order": [], "role_category_cap": {}, "exams": [],
    }


def test_solver_avoids_group_gaps_long_days_and_repeated_course_days():
    data = soft_score_data()
    result = solve_timetable(data, time_limit_seconds=5, num_workers=1)
    report = run_validation(data, {"sessions": result.assignments})

    assert result.status == "optimal"
    assert report["hard_violation_count"] == 0
    assert report["soft_penalties"]["S2"] == 0
    assert report["soft_penalties"]["S3"] == 0
    assert report["soft_penalties"]["S4"] == 0
    assert result.stats["time_limit_seconds"] == 5


def test_solver_caps_the_requested_time_limit_for_small_servers():
    result = solve_timetable(soft_score_data(), time_limit_seconds=999, num_workers=1)
    assert result.stats["time_limit_seconds"] == 60
