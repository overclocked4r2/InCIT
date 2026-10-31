from types import SimpleNamespace

from app import main
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
    monkeypatch.setattr(state, "_check_timetable", lambda _: None)
    monkeypatch.setattr(state, "_check_full_schedule", lambda **_: None)
    state.dataset = _data()
    state.assignments = {"S1": {"session_id": "S1", "day": "MON", "start_period": 1, "room_id": "R1"}}
    state.fest_week = None
    monkeypatch.setattr(main, "user_from_authorization", lambda *_: SimpleNamespace(username="admin", role="admin"))
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("LLM_API_KEY", raising=False)

    request = {
        "room_id": "R1", "day": "MON", "start_period": 1, "duration_periods": 1,
        "purpose": "Guest lecture", "attendance": 20, "needs": [],
    }
    try:
        rejected = main.create_manual_booking(request)
        assert rejected["status"] == "rejected"
        assert "session S1" in rejected["message"]

        request["start_period"] = 2
        approved = main.create_manual_booking(request)
        assert approved["status"] == "approved"
        assert approved["booking"]["end_period"] == 2
    finally:
        state.dataset = old_dataset
        state.assignments = old_assignments
        state.fest_week = old_fest_week
