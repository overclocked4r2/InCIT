import pytest

from app.auth import ACTION_ROLES, DEMO_USERS, login, require_action
from app.main import reset_state
from app.state import AppState


def authorization_for(username: str) -> str:
    user = DEMO_USERS[username]
    result = login(user.username, user.password)
    assert result is not None
    token, _ = result
    return f"Bearer {token}"


def test_each_demo_role_is_limited_to_its_central_permissions():
    role_to_username = {user.role: username for username, user in DEMO_USERS.items()}
    for action, allowed_roles in ACTION_ROLES.items():
        for role, username in role_to_username.items():
            header = authorization_for(username)
            if role in allowed_roles:
                assert require_action(header, action).role == role
            else:
                with pytest.raises(PermissionError, match="requires one of these roles"):
                    require_action(header, action)


def test_a_user_cannot_approve_their_own_reschedule_proposal():
    state = AppState()
    state.assignments = {"S1": {"session_id": "S1", "day": "MON", "start_period": 1, "room_id": "R1"}}
    proposal = state.propose_reschedule("S1", "TUE", 1, "R1", "Move class", requested_by="admin@incit.demo")

    with pytest.raises(PermissionError, match="cannot approve your own"):
        state.decide_reschedule(proposal["id"], "approved", actor="admin@incit.demo")

    assert proposal["status"] == "pending"
    assert state.assignments["S1"]["day"] == "MON"


def test_admin_reset_restores_the_committed_starting_timetable():
    from app.main import state

    state.assignments = {"TEMP": {"session_id": "TEMP", "day": "FRI", "start_period": 9, "room_id": "R99"}}
    response = reset_state(authorization_for("admin@incit.demo"))

    assert response["status"] == "reset"
    assert response["timetable_status"] == "published"
    assert response["sessions"] > 1
    assert "TEMP" not in state.assignments


def test_non_admin_cannot_reset_demo_data():
    with pytest.raises(Exception) as exc_info:
        reset_state(authorization_for("faculty@incit.demo"))
    assert "requires one of these roles" in str(exc_info.value)
