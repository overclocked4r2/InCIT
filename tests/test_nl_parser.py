"""Regression tests for the bilingual natural-language booking parser.

These mirror the quick-test prompts exposed in the NL Booking dashboard so a
demo prompt cannot silently regress into a bad parse.
"""
from app.nl_parser import parse_booking_request


def test_english_period_range_extracts_window_and_duration():
    result = parse_booking_request(
        "Book a seminar hall for 80 students on Wednesday, periods 3-4, need projector"
    )
    assert result["attendance"] == 80
    assert result["duration_periods"] == 2
    assert result["windows"] == [{"day": "WED", "from_period": 3, "to_period": 4}]
    assert result["room_types"] == ["seminar_hall"]
    assert result["needs"] == ["projector"]
    assert result["follow_up"] is None


def test_devanagari_request_extracts_day_room_and_periods():
    result = parse_booking_request(
        "मुझे बुधवार को 60 छात्रों के लिए एक क्लासरूम चाहिए, पीरियड 5-6"
    )
    assert result["attendance"] == 60
    assert result["duration_periods"] == 2
    assert result["windows"] == [{"day": "WED", "from_period": 5, "to_period": 6}]
    assert result["room_types"] == ["classroom"]
    assert result["follow_up"] is None


def test_generic_lab_request_matches_every_lab_type():
    result = parse_booking_request(
        "I need a lab with 40 seats for Thursday morning, accessible room please"
    )
    assert result["attendance"] == 40
    assert result["windows"] == [{"day": "THU", "from_period": 1, "to_period": 5}]
    assert {"lab_cs", "lab_elec", "lab_phy", "lab_civil"} <= set(result["room_types"])
    assert result["needs"] == ["accessible"]
    # Duration is genuinely absent, so the assistant should ask for it.
    assert "duration" in (result["follow_up"] or "")


def test_single_period_implies_one_period_duration():
    result = parse_booking_request("Small room for 20 people, Friday period 1, tutorial session")
    assert result["duration_periods"] == 1
    assert result["windows"] == [{"day": "FRI", "from_period": 1, "to_period": 1}]
    assert result["follow_up"] is None


def test_any_day_request_expands_to_teaching_week():
    result = parse_booking_request(
        "Reserve lecture hall for 120 students, any day afternoon, needs projector and mic"
    )
    assert [w["day"] for w in result["windows"]] == ["MON", "TUE", "WED", "THU", "FRI"]
    assert all(w["from_period"] == 6 for w in result["windows"])
    assert result["needs"] == ["projector", "pa_system"]


def test_romanised_hinglish_tomorrow_evening_request():
    from datetime import datetime

    result = parse_booking_request(
        "Kal shaam ko seminar hall chahiye, 200 log, 2 ghante",
        reference_date=datetime(2026, 11, 2),  # Monday; kal is Tuesday.
    )

    assert result["attendance"] == 200
    assert result["duration_periods"] == 2
    assert result["windows"] == [{"day": "TUE", "from_period": 10, "to_period": 11}]
    assert result["room_types"] == ["seminar_hall"]
    assert result["follow_up"] is None
    assert any("tomorrow" in item for item in result["assumptions"])


def test_romanised_hinglish_time_range_and_day_alias():
    result = parse_booking_request(
        "Budhvaar shaam 6 se 8 baje auditorium chahiye, 80 log"
    )

    assert result["attendance"] == 80
    assert result["duration_periods"] == 2
    assert result["windows"] == [{"day": "WED", "from_period": 10, "to_period": 11}]
    assert result["room_types"] == ["auditorium"]
