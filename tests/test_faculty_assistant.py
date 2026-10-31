from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app import main
from app.schemas import NLParseRequest
from app.solver import SolverResult


def _data():
    return {
        "sessions": [{
            "id": "S1", "faculty_id": "F1", "groups": ["G1"], "duration": 1,
            "size": 20, "room_types": ["classroom"],
            "fixed_slot": {"day": "MON", "start_period": 1},
        }],
        "rooms": [{"id": "R1", "type": "classroom", "capacity": 40}],
    }


def test_invalid_llm_change_is_rejected_by_the_validity_gate(monkeypatch):
    old_assignments = main.state._assignments
    old_requests = main.state.reschedule_requests
    main.state._assignments = {"S1": {"session_id": "S1", "day": "MON", "start_period": 1, "room_id": "R1"}}
    main.state.reschedule_requests = []
    monkeypatch.setattr(main, "_load_dataset", _data)
    monkeypatch.setattr(main, "_require_action", lambda *_: SimpleNamespace(username="faculty", role="faculty"))
    monkeypatch.setattr("app.llm.parse_faculty_change_with_llm", lambda _text: ({
        "session_id": "S1", "day": "TUE", "start_period": 2, "reason": "Meeting", "assumptions": [], "follow_up": None,
    }, None))
    monkeypatch.setattr("app.solver.solve_timetable", lambda *_args, **_kwargs: SolverResult(
        status="feasible", assignments=[{"session_id": "S1", "day": "TUE", "start_period": 2, "room_id": "R1"}],
    ))
    monkeypatch.setattr("app.validator_bridge.check_timetable", lambda *_: [{"detail": "Room conflict with S2"}])
    try:
        with pytest.raises(HTTPException, match="validity gate"):
            main.faculty_change_from_text(NLParseRequest(text="Move S1 to Tuesday P2"), "Bearer demo")
        assert main.state.reschedule_requests == []
    finally:
        main.state._assignments = old_assignments
        main.state.reschedule_requests = old_requests


def test_why_class_at_8am_uses_fixed_slot_reason_code(monkeypatch):
    old_assignments = main.state._assignments
    main.state._assignments = {"S1": {"session_id": "S1", "day": "MON", "start_period": 1, "room_id": "R1"}}
    monkeypatch.setattr(main, "_load_dataset", _data)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    try:
        response = main.explain_class("S1")
    finally:
        main.state._assignments = old_assignments

    assert response["mode"] == "code"
    assert response["reason_codes"][0]["code"] == "FIXED_SLOT"
    assert "FIXED_SLOT" in response["message"]


def test_why_booking_rejected_uses_stored_booking_engine_reason(monkeypatch):
    old_fest_week = main.state._fest_week
    main.state._fest_week = {"bookings": [{
        "request_id": "B1", "status": "rejected", "reason": "No compatible room has enough seats.",
    }]}
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    try:
        response = main.explain_booking("B1")
    finally:
        main.state._fest_week = old_fest_week

    assert response["mode"] == "code"
    assert response["reason_codes"][0]["code"] == "BOOKING_REJECTED"
    assert "No compatible room has enough seats." in response["message"]
