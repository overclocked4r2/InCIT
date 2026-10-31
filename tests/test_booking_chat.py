from types import SimpleNamespace
import logging

from app import main
from app.auth import login, require_action
from app.schemas import NLParseRequest


def test_short_greeting_is_a_friendly_chat_reply_for_admin(monkeypatch):
    monkeypatch.setattr(main, "user_from_authorization", lambda _: SimpleNamespace(username="admin", role="admin"))
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    response = main.nl_book(NLParseRequest(text="helloo"), "Bearer demo")

    assert response["status"] == "assistant"
    assert "AI chat is unavailable" in response["message"]
    assert response["mode"] == "basic"


def test_general_questions_use_the_llm_instead_of_canned_phrase_replies(monkeypatch):
    monkeypatch.setattr(main, "user_from_authorization", lambda _: SimpleNamespace(username="faculty", role="faculty"))
    monkeypatch.setattr("app.llm.chat_with_llm", lambda text, role: (f"AI reply to {text} for {role}", None))

    response = main.nl_book(NLParseRequest(text="who are you?"), "Bearer demo")

    assert response["status"] == "assistant"
    assert response["message"] == "AI reply to who are you? for faculty"
    assert response["mode"] == "ai"


def test_friendly_chat_uses_ai_mode_when_gemini_reply_is_available(monkeypatch):
    monkeypatch.setattr(main, "user_from_authorization", lambda _: SimpleNamespace(username="admin", role="admin"))
    monkeypatch.setattr("app.llm.chat_with_llm", lambda *_: ("Hello! I can help with campus rooms.", None))

    response = main.nl_book(NLParseRequest(text="what can you do?"), "Bearer demo")

    assert response == {
        "status": "assistant",
        "message": "Hello! I can help with campus rooms.",
        "mode": "ai",
    }


def test_only_admin_and_club_roles_can_create_bookings():
    admin_token, _ = login("admin@incit.demo", "admin123")
    club_token, _ = login("club@incit.demo", "club123")
    faculty_token, _ = login("faculty@incit.demo", "faculty123")

    assert require_action(f"Bearer {admin_token}", "request_booking").role == "admin"
    assert require_action(f"Bearer {club_token}", "request_booking").role == "club_representative"
    try:
        require_action(f"Bearer {faculty_token}", "request_booking")
    except PermissionError as exc:
        assert "admin, club_representative" in str(exc)
    else:
        raise AssertionError("Faculty must not create the final booking.")


def test_manual_booking_explains_the_role_limit_without_an_error(monkeypatch):
    monkeypatch.setattr(main, "user_from_authorization", lambda _: SimpleNamespace(username="faculty", role="faculty"))

    response = main.create_manual_booking({}, "Bearer demo")

    assert response["status"] == "not_allowed"
    assert "Club representative or Admin" in response["message"]


def test_basic_mode_is_an_honest_single_safety_fallback(monkeypatch):
    monkeypatch.setattr(main, "user_from_authorization", lambda _: SimpleNamespace(username="admin", role="admin"))
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    response = main.nl_book(NLParseRequest(text="how many modes are there?"), "Bearer demo")

    assert response["mode"] == "basic"
    assert "can’t answer general questions reliably" in response["message"]


def test_missing_key_is_logged_and_uses_basic_mode(monkeypatch, caplog):
    monkeypatch.setattr(main, "user_from_authorization", lambda _: SimpleNamespace(username="admin", role="admin"))
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    with caplog.at_level(logging.WARNING, logger="app.llm"):
        response = main.nl_book(NLParseRequest(text="who are you?"), "Bearer demo")

    assert response["mode"] == "basic"
    assert "GEMINI_API_KEY is not configured" in caplog.text


def test_follow_up_duration_merges_into_the_previous_booking_draft():
    previous = {
        "attendance": 500,
        "duration_periods": None,
        "windows": [{"day": "TUE", "from_period": 7, "to_period": 7}],
        "room_types": ["classroom", "lecture_hall", "seminar_hall"],
        "needs": [], "mandatory_for_groups": [], "requested_room": None,
        "title": None, "assumptions": [], "raw_text": "I need a hall for 500 students on Tuesday 15:00",
        "confidence": 0.75, "llm_used": False, "manual_form_message": None,
    }
    update = {
        "attendance": None, "duration_periods": 2, "windows": [], "needs": [],
        "mandatory_for_groups": [], "requested_room": None, "title": None,
        "assumptions": [], "raw_text": "2 hours", "confidence": 0.25,
        "llm_used": False, "manual_form_message": None,
    }

    merged = main._merge_booking_draft(previous, update, lambda draft: None)

    assert merged["attendance"] == 500
    assert merged["duration_periods"] == 2
    assert merged["windows"][0]["day"] == "TUE"


def test_available_follow_up_explains_that_auditorium_needs_an_explicit_draft(monkeypatch):
    monkeypatch.setattr(main, "_load_dataset", lambda: {
        "rooms": [
            {"id": "AUD", "type": "auditorium", "capacity": 500, "features": [], "accessible": True, "allowed_uses": ["event"]},
            {"id": "LH-1", "type": "lecture_hall", "capacity": 200, "features": [], "accessible": True, "allowed_uses": ["event"]},
        ]
    })
    main._booking_chat_context["admin"] = {
        "last_status": "rejected",
        "last_reason": "No suitable venue available for the requested time and requirements.",
        "draft": {"attendance": 500, "needs": [], "room_types": ["lecture_hall"]},
    }
    try:
        reply = main._booking_contextual_reply("what's available?", "admin")
    finally:
        main._booking_chat_context.pop("admin", None)

    assert "AUD (500 seats)" in reply
    assert "did not claim they were free" in reply


def test_timetable_includes_live_chat_bookings_and_reports_filter_hiding(monkeypatch):
    data = {
        "sessions": [{"id": "S1", "course_id": "C1", "kind": "lecture", "faculty_id": "F1", "groups": ["G1"], "size": 20, "duration": 1}],
        "rooms": [{"id": "R1", "name": "Room One", "type": "classroom", "capacity": 60}],
    }
    old_assignments = main.state._assignments
    old_live_bookings = main.state.live_bookings
    monkeypatch.setattr(main, "_load_dataset", lambda: data)
    main.state._assignments = {"S1": {"session_id": "S1", "day": "MON", "start_period": 1, "room_id": "R1"}}
    main.state.live_bookings = [{
        "id": "LIVE-test", "title": "Guest talk", "room_id": "R1", "day": "TUE", "start_period": 7, "end_period": 8,
    }]
    try:
        full = main.get_timetable()
        filtered = main.get_timetable(faculty_id="F1")
    finally:
        main.state._assignments = old_assignments
        main.state.live_bookings = old_live_bookings

    assert any(item["session_id"] == "LIVE-test" and item["kind"] == "booking" for item in full["assignments"])
    assert full["live_booking_count"] == 1
    assert filtered["visible_live_booking_count"] == 0
