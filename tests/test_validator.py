from datetime import datetime
from app.validator import Activity, overlaps, validate_activity, validate_reschedule

def dt(h,m=0): return datetime(2026,11,2,h,m)

def test_adjacent_intervals_are_not_conflicts():
    assert not overlaps(dt(9),dt(10),dt(10),dt(11))

def test_room_overlap_rejected():
    candidate=Activity("new",dt(9),dt(10),room_id="R1")
    existing=[Activity("old",dt(9,30),dt(10,30),room_id="R1")]
    result=validate_activity(candidate,existing)
    assert not result.valid
    assert result.conflicts[0].code == "ROOM-001"

def test_faculty_and_group_conflicts():
    candidate=Activity("new",dt(9),dt(10),faculty_id="F1",student_group_id="G1")
    existing=[Activity("old",dt(9),dt(10),faculty_id="F1",student_group_id="G1")]
    codes={x.code for x in validate_activity(candidate,existing).conflicts}
    assert {"FAC-001","GRP-001"} <= codes

def test_capacity_room_type_availability_and_term():
    c=Activity("e",dt(9),dt(10),capacity=20,attendees=25,required_room_type="lab",room_type="classroom",faculty_available=False,term_id="T1",offering_term_id="T2")
    codes={x.code for x in validate_activity(c).conflicts}
    assert {"CAP-001","ROOM-002","AVAIL-001","TERM-001"} <= codes

def test_resource_shortage():
    c=Activity("e",dt(9),dt(10),resource_needs={"projector":2})
    assert "RES-001" in {x.code for x in validate_activity(c,available_resources={"projector":1}).conflicts}

def test_special_week_policy_and_override():
    c=Activity("b",dt(9),dt(10),room_id="R1",kind="booking",status="pending")
    r=validate_activity(c,special_week_policy="approval_required",special_week_dates=(dt(0).date(),dt(23).date()),override_blocks=[(dt(9),dt(10),"R1")])
    assert {"SPEC-001","SPEC-002"} <= {x.code for x in r.conflicts}

def test_invalid_interval_and_reschedule_identity():
    bad=Activity("x",dt(10),dt(9))
    assert "TIME-001" in {x.code for x in validate_activity(bad).conflicts}
    old=Activity("old",dt(9),dt(10))
    new=Activity("different",dt(10),dt(11))
    assert "CHANGE-001" in {x.code for x in validate_reschedule(old,new,[]).conflicts}

def test_valid_activity():
    c=Activity("ok",dt(9),dt(10),room_id="R1",faculty_id="F1",student_group_id="G1",capacity=30,attendees=20,room_type="lab",required_room_type="lab",faculty_available=True)
    assert validate_activity(c,[Activity("adjacent",dt(10),dt(11),room_id="R1")]).valid
