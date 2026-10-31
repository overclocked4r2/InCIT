from types import SimpleNamespace

from app import main
from app.booking_engine import validate_manual_booking
from app.schemas import NLBookingSubmissionIn
from app.state import state


def _data():
    return {
        "calendar": {"days": ["MON"]},
        "rooms": [{
            "id": "R1", "name": "Room One", "capacity": 40, "features": [], "accessible": True,
            "allowed_uses": ["event", "lecture"],
        }],
        "sessions": [{"id": "S1", "duration": 1}],
        "room_unavailability": [],
    }


def test_manual_booking_blocks_named_timetable_clash_without_llm(monkeypatch):
    old_dataset = state.dataset
    old_assignments = state.assignments
    old_fest_week = state.fest_week
    old_live_bookings = state.live_bookings
    monkeypatch.setattr(state, "_check_timetable", lambda _: None)
    monkeypatch.setattr(state, "_check_full_schedule", lambda **_: None)
    state.dataset = _data()
    state.assignments = {"S1": {"session_id": "S1", "day": "MON", "start_period": 1, "room_id": "R1"}}
    state.fest_week = None
    monkeypatch.setattr(main, "_require_action", lambda *_: SimpleNamespace(username="admin", role="admin"))
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("LLM_API_KEY", raising=False)

    request = {
        "room_id": "R1", "day": "MON", "start_period": 1, "duration_periods": 1,
        "purpose": "Guest lecture", "attendance": 20, "needs": [],
    }
    try:
        rejected = main.create_manual_booking(NLBookingSubmissionIn(**request))
        assert rejected["status"] == "rejected"
        assert "session S1" in rejected["message"]

        request["start_period"] = 2
        approved = main.create_manual_booking(NLBookingSubmissionIn(**request))
        assert approved["status"] == "approved"
        assert approved["booking"]["end_period"] == 2
        assert len(state.live_bookings) == 1
    finally:
        state.dataset = old_dataset
        state.assignments = old_assignments
        state.fest_week = old_fest_week
        state.live_bookings = old_live_bookings


def test_booking_gate_blocks_lunch_spans_and_required_group_clashes():
    data = _data()
    data["sessions"][0]["groups"] = ["Y1-A"]
    request = {
        "room_id": "R1", "day": "MON", "start_period": 5, "duration_periods": 2,
        "purpose": "Event", "attendance": 20, "needs": [],
    }
    assert "lunch break" in validate_manual_booking(data, {}, request)

    data["sessions"][0]["duration"] = 1
    request.update(start_period=2, duration_periods=1, mandatory_for_groups=["Y1-A"])
    reason = validate_manual_booking(data, {"S1": ("MON", 2, "OTHER")}, request)
    assert "Mandatory group Y1-A" in reason

    request.update(start_period=4, mandatory_for_groups=["Y1-A"])
    reason = validate_manual_booking(data, {}, request, [{
        "request_id": "LIVE-1", "status": "approved", "room_id": "OTHER", "day": "MON",
        "start_period": 4, "end_period": 4, "mandatory_for_groups": ["Y1-A"],
    }])
    assert "Mandatory group Y1-A" in reason
