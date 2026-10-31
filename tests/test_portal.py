"""Integration tests for the student & campus portal API."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
import app.portal as portal


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    # Keep tests away from the real demo store.
    portal.PORTAL_STATE_PATH = tmp_path_factory.mktemp("portal") / "portal_state.json"
    with TestClient(app) as test_client:
        test_client.post("/api/reset")
        yield test_client


def test_students_are_mapped_to_real_groups(client):
    response = client.get("/api/portal/students")
    assert response.status_code == 200
    students = response.json()
    assert len(students) == 6
    student = next(s for s in students if s["id"] == "STU-001")
    assert student["group_id"] == "CSE-2"
    assert student["group_name"] == "CSE Year 2"
    assert student["course_count"] == 7


def test_home_reports_published_schedule_and_student_metrics(client):
    response = client.get("/api/portal/home?student_id=STU-001")
    assert response.status_code == 200
    home = response.json()
    assert home["timetable"]["status"] == "published"
    assert home["timetable"]["validated"] is True
    assert home["timetable"]["hard_violations"] == 0
    assert len(home["attendance"]["courses"]) == 7
    assert len(home["marks"]["courses"]) == 7
    assert home["today"]["next_class"] is not None
    assert home["marks"]["cgpa"] > 0


def test_attendance_logging_updates_summary_and_log(client):
    before = client.get("/api/portal/attendance?student_id=STU-001").json()
    course = before["courses"][1]
    response = client.post(
        "/api/portal/attendance/log",
        json={"student_id": "STU-001", "course_id": course["course_id"], "present": True},
    )
    assert response.status_code == 200
    logged = response.json()
    assert logged["course"]["attended"] == course["attended"] + 1
    assert logged["course"]["held"] == course["held"] + 1
    assert logged["entry"]["present"] is True

    after = client.get("/api/portal/attendance?student_id=STU-001").json()
    assert after["log"][0]["id"] == logged["entry"]["id"]
    assert after["attended"] == before["attended"] + 1

    reset = client.delete("/api/portal/attendance?student_id=STU-001")
    assert reset.status_code == 200
    assert client.get("/api/portal/attendance?student_id=STU-001").json()["log"] == []


def test_notes_crud(client):
    created = client.post(
        "/api/portal/notes",
        json={
            "student_id": "STU-001",
            "title": "Deadlock recap",
            "body": "Banker's algorithm safety check.",
            "course_id": "CS201",
            "pinned": True,
        },
    )
    assert created.status_code == 200
    note = created.json()
    assert note["pinned"] is True

    listed = client.get("/api/portal/notes?student_id=STU-001").json()
    assert any(n["id"] == note["id"] for n in listed)

    updated = client.put(
        f"/api/portal/notes/{note['id']}",
        json={"student_id": "STU-001", "pinned": False, "title": "Deadlock recap v2"},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Deadlock recap v2"
    assert updated.json()["pinned"] is False

    deleted = client.delete(f"/api/portal/notes/{note['id']}?student_id=STU-001")
    assert deleted.status_code == 200
    assert all(n["id"] != note["id"] for n in client.get("/api/portal/notes?student_id=STU-001").json())


def test_planner_free_blocks_never_overlap_classes_or_events(client):
    planner = client.get("/api/portal/planner?student_id=STU-001").json()
    assert len(planner["days"]) == 5
    assert planner["workload"]["weekly_classes"] == sum(d["class_count"] for d in planner["days"])
    for day in planner["days"]:
        busy = set()
        for row in day["classes"]:
            busy.update(range(row["start_period"], row["end_period"] + 1))
        for event in day["events"]:
            busy.update(range(event["start_period"], event["end_period"] + 1))
        for block in day["free_blocks"]:
            assert not busy.intersection(range(block["start_period"], block["end_period"] + 1))


def test_exam_plan_only_returns_student_papers(client):
    exams = client.get("/api/portal/exams?student_id=STU-001").json()
    assert exams["my_count"] > 0
    assert len(exams["exams"]) == exams["my_count"]
    for exam in exams["exams"]:
        assert exam["is_mine"] is True
        assert "CSE-2" in exam["groups"]
        assert exam["seats"] >= exam["size"]
        assert exam["start"] and exam["end"]


def test_search_finds_courses_and_events(client):
    results = client.get("/api/portal/search?q=operating&student_id=STU-001").json()
    assert any(c["id"] == "CS301" for c in results["courses"])
    assert client.get("/api/portal/search?q=spectra&student_id=STU-001").json()["events"]


def test_unknown_student_returns_404(client):
    assert client.get("/api/portal/home?student_id=NOPE").status_code == 404
