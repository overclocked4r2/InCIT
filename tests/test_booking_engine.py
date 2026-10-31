from app.booking_engine import effective_category, outranks, process_booking_requests


def _data(requests, sessions=None, cancellations=None):
    return {
        "priority_order": ["exam", "regular_session", "institute_event", "guest_lecture", "department_event", "club_event"],
        "role_category_cap": {
            "admin": "institute_event",
            "faculty": "guest_lecture",
            "department_coordinator": "department_event",
            "club": "club_event",
        },
        "calendar": {"days": ["MON"], "lunch": {"after_period": 99}, "lab_start_periods": [2, 6]},
        "rooms": [{
            "id": "R1", "type": "classroom", "capacity": 100, "features": [], "accessible": True,
            "allowed_uses": ["event", "lecture"],
        }],
        "sessions": sessions or [],
        "faculty": [{"id": "F1", "unavailable": []}],
        "booking_requests": requests,
        "cancellations": cancellations or [],
        "room_unavailability": [],
    }


def _request(request_id, role, submitted_at, **changes):
    request = {
        "id": request_id,
        "role": role,
        "requested_category": "institute_event",
        "submitted_at": submitted_at,
        "attendance": 20,
        "duration_periods": 1,
        "room_types": ["classroom"],
        "needs": [],
        "windows": [{"day": "MON", "from_period": 1, "to_period": 1}],
    }
    request.update(changes)
    return request


def test_role_category_and_earlier_request_break_ties():
    data = _data([])
    club = _request("club", "club", "2027-01-01T10:00:00+05:30")
    early_faculty = _request("early", "faculty", "2027-01-01T09:00:00+05:30")
    late_faculty = _request("late", "faculty", "2027-01-01T10:00:00+05:30")

    assert effective_category(data, club) == "club_event"
    assert outranks(data, early_faculty, late_faculty)
    assert outranks(data, early_faculty, club)


def test_cancelled_and_non_exact_booking_decisions_have_reasons():
    faculty = _request("faculty", "faculty", "2027-01-01T09:00:00+05:30")
    cancelled = _request("cancelled", "club", "2027-01-01T10:00:00+05:30")
    result = process_booking_requests(
        _data([faculty, cancelled], cancellations=[{"request_id": "cancelled"}]), {}
    )

    decisions = {booking["request_id"]: booking for booking in result["bookings"]}
    assert decisions["cancelled"]["status"] == "rejected"
    assert "cancelled" in decisions["cancelled"]["reason"].lower()
    assert all(booking.get("reason") for booking in result["bookings"])


def test_institute_event_never_displaces_an_existing_booking():
    first = _request("first", "admin", "2027-01-01T09:00:00+05:30")
    second = _request("second", "admin", "2027-01-01T10:00:00+05:30")
    result = process_booking_requests(_data([first, second]), {})

    decisions = {booking["request_id"]: booking for booking in result["bookings"]}
    assert decisions["first"]["status"] == "approved"
    assert decisions["second"]["status"] == "alternative_offered"


def test_only_approved_institute_event_can_displace_and_move_a_session():
    session = {
        "id": "S1", "duration": 1, "groups": ["G1"], "faculty_id": "F1", "kind": "lecture",
        "room_types": ["classroom"], "size": 20,
    }
    request = _request("event", "admin", "2027-01-01T09:00:00+05:30")
    result = process_booking_requests(_data([request], [session]), {"S1": ("MON", 1, "R1")})

    assert result["bookings"][0]["status"] == "approved"
    assert result["session_overrides"] == [{
        "session_id": "S1", "day": "MON", "start_period": 2, "room_id": "R1", "displaced_by": "event",
    }]

    faculty_request = _request("faculty", "faculty", "2027-01-01T09:00:00+05:30")
    no_displacement = process_booking_requests(
        _data([faculty_request], [session]), {"S1": ("MON", 1, "R1")}
    )
    assert no_displacement["session_overrides"] == []
    assert no_displacement["bookings"][0]["status"] == "alternative_offered"
