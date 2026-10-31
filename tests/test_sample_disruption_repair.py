import json
from pathlib import Path

from app.main import _apply_disruption, _unaffected_baseline_session_ids
from app.solver import solve_timetable
from app.validator_bridge import run_validation


ROOT = Path(__file__).parent.parent


def test_sample_disruption_keeps_unaffected_sessions_fixed_and_stays_valid():
    data = json.loads((ROOT / "data" / "cit_public.json").read_text(encoding="utf-8"))
    baseline_export = json.loads((ROOT / "exports" / "schedule.json").read_text(encoding="utf-8"))
    baseline = {assignment["session_id"]: assignment for assignment in baseline_export["sessions"]}
    disruption = {
        "changes": [
            {"type": "faculty_unavailable", "faculty_id": "F07", "days": ["MON"], "periods": list(range(1, 10))},
            {"type": "room_unavailable", "room_id": "CR-102", "days": ["MON", "TUE", "WED", "THU", "FRI"], "periods": list(range(1, 10))},
            {"type": "add_session", "session": {
                "id": "CS202-T2", "course_id": "CS202", "kind": "tutorial", "groups": ["CSE-2"],
                "faculty_id": "F06", "size": 80, "duration": 1,
                "room_types": ["classroom", "lecture_hall", "auditorium"],
                "needs_accessible": False, "basket_slot": None, "fixed_slot": None,
            }},
        ]
    }
    changed = _apply_disruption(data, disruption)
    locked = _unaffected_baseline_session_ids(data, baseline, disruption)

    result = solve_timetable(
        changed, baseline_assignments=baseline, locked_session_ids=locked,
        time_limit_seconds=30, num_workers=8,
    )

    assert result.status in {"optimal", "feasible"}
    assert result.stats["locked_sessions"] == len(locked)
    assignments = {assignment["session_id"]: assignment for assignment in result.assignments}
    assert all(assignments[session_id] == baseline[session_id] for session_id in locked)
    assert run_validation(changed, {"sessions": result.assignments})["hard_violation_count"] == 0


def test_added_disruption_session_is_checked_against_the_effective_dataset(monkeypatch):
    """The state gate must not reject a valid session that a disruption adds."""
    from app import main
    from app.solver import SolverResult

    base = {"sessions": [], "rooms": [], "faculty": [], "student_groups": []}
    effective = {"sessions": [{"id": "NEW"}], "rooms": [], "faculty": [], "student_groups": []}
    old_dataset = main.state.dataset
    old_assignments = main.state._assignments
    old_status = main.state.timetable_status
    old_disruption = main.state.disruption_data
    old_applied = main.state.disruption_applied
    main.state.dataset = base
    main.state._assignments = {}
    main.state.disruption_data = {"changes": [{"type": "add_session", "session": {"id": "NEW"}}]}
    main.state.disruption_applied = True
    monkeypatch.setattr(main, "_require_action", lambda *_: None)
    monkeypatch.setattr(main, "_load_dataset", lambda: base)
    monkeypatch.setattr(main, "_apply_disruption", lambda *_: effective)
    monkeypatch.setattr("app.solver.solve_timetable", lambda *_args, **_kwargs: SolverResult(
        status="feasible", assignments=[{"session_id": "NEW", "day": "MON", "start_period": 1, "room_id": "R1"}],
    ))
    monkeypatch.setattr(main, "_process_bookings_and_exams", lambda *_: None)
    monkeypatch.setattr("app.validator_bridge.check_timetable", lambda assignments, data: [] if data is effective else [{"detail": "Unknown session id NEW"}])
    try:
        result = main.generate_timetable(type("Request", (), {"time_limit_seconds": 10, "num_workers": 1})(), None)
    finally:
        main.state.dataset = old_dataset
        main.state._assignments = old_assignments
        main.state.timetable_status = old_status
        main.state.disruption_data = old_disruption
        main.state.disruption_applied = old_applied

    assert result.status == "feasible"
