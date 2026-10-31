"""Spectra/fest week booking engine.

Processes booking requests from the CIT dataset, resolving conflicts and
priorities according to the official rules:
  - Category is capped by role (role_category_cap)
  - Priority order determines which request wins a contested slot
  - Cancelled requests are always rejected
  - Approved bookings must fit inside a requested window
  - Only institute_events may displace regular sessions
  - Displaced sessions get session_overrides (moved, not dropped)
"""
from __future__ import annotations
from collections import defaultdict
from typing import Any


CAT_WEIGHT = {"institute_event": 5, "guest_lecture": 4, "department_event": 3, "club_event": 2}
MAX_PERIOD = 13
LAST_TEACHING = 9


def effective_category(data: dict, req: dict) -> str:
    order = data["priority_order"]
    cap = data["role_category_cap"].get(req["role"], "club_event")
    a = order.index(req["requested_category"]) if req["requested_category"] in order else len(order) - 1
    return order[max(a, order.index(cap))]


def outranks(data: dict, r1: dict, r2: dict) -> bool:
    order = data["priority_order"]
    c1 = order.index(effective_category(data, r1))
    c2 = order.index(effective_category(data, r2))
    if c1 != c2:
        return c1 < c2
    return r1["submitted_at"] < r2["submitted_at"]


def process_booking_requests(
    data: dict,
    timetable_assignments: dict[str, tuple[str, int, str]],  # sid -> (day, start, room_id)
) -> dict[str, Any]:
    """Process all booking requests and return fest_week structure.
    
    Args:
        data: The full CIT dataset
        timetable_assignments: Current timetable {session_id: (day, start_period, room_id)}
    
    Returns:
        {"bookings": [...], "session_overrides": [...]}
    """
    rooms = {r["id"]: r for r in data["rooms"]}
    sessions = {s["id"]: s for s in data["sessions"]}
    cancelled = {c["request_id"] for c in data.get("cancellations", [])}
    
    # Build room unavailability lookup
    room_unavail: dict[str, set[tuple[str, int]]] = defaultdict(set)
    for u in data.get("room_unavailability", []):
        for p in u["periods"]:
            room_unavail[u["room_id"]].add((u["day"], p))
    
    # Build group occupancy from timetable
    group_occ: dict[tuple[str, str, int], list[str]] = defaultdict(list)
    for sid, (day, start, rid) in timetable_assignments.items():
        s = sessions.get(sid)
        if s:
            for p in range(start, start + s["duration"]):
                for g in s["groups"]:
                    group_occ[(g, day, p)].append(sid)
    
    # Sort requests by priority (highest first)
    requests = data["booking_requests"]
    sorted_requests = sorted(requests, key=lambda r: (
        data["priority_order"].index(effective_category(data, r)),
        r["submitted_at"]
    ))
    
    # Track room bookings: (room_id, day, period) -> who
    room_busy: dict[tuple[str, str, int], list[str]] = defaultdict(list)
    
    # Fill in timetable occupancy
    for sid, (day, start, rid) in timetable_assignments.items():
        s = sessions.get(sid)
        if s:
            for p in range(start, start + s["duration"]):
                room_busy[(rid, day, p)].append(sid)
    
    bookings = []
    session_overrides = []
    
    for req in sorted_requests:
        req_id = req["id"]
        
        # Cancelled requests
        if req_id in cancelled:
            bookings.append({
                "request_id": req_id,
                "status": "rejected",
                "reason": "Request was cancelled by the requester."
            })
            continue
        
        eff_cat = effective_category(data, req)
        
        # Try to find a valid placement
        placement = _find_placement(req, rooms, room_busy, room_unavail, group_occ, data)
        
        if placement is None:
            bookings.append({
                "request_id": req_id,
                "status": "rejected",
                "reason": _rejection_reason(req, rooms, room_busy, room_unavail, data)
            })
            continue
        
        best_room_id, best_day, best_start, best_end, is_exact = placement
        
        # Check if we need to displace any sessions (only for institute_event)
        displaced_sessions = []
        if eff_cat == "institute_event" or data["priority_order"].index(eff_cat) <= data["priority_order"].index("institute_event"):
            for p in range(best_start, best_end + 1):
                for occ in room_busy.get((best_room_id, best_day, p), []):
                    if occ.startswith("BR-"):
                        continue  # Another booking, not a session
                    if occ not in [ds["session_id"] for ds in displaced_sessions]:
                        displaced_sessions.append({"session_id": occ, "displaced_by": req_id})
        
        # Don't displace if we're not institute_event level
        if displaced_sessions and data["priority_order"].index(eff_cat) > data["priority_order"].index("institute_event"):
            # Can't displace, try to find alternative without displacement
            displaced_sessions = []
            # Check if slot is actually free
            slot_free = True
            for p in range(best_start, best_end + 1):
                if room_busy.get((best_room_id, best_day, p), []):
                    slot_free = False
                    break
            if not slot_free:
                bookings.append({
                    "request_id": req_id,
                    "status": "rejected",
                    "reason": f"Room {best_room_id} is occupied and only institute events may displace regular sessions."
                })
                continue
        
        # Record booking
        status = "approved" if is_exact else "alternative_offered"
        booking_entry: dict[str, Any] = {
            "request_id": req_id,
            "status": status,
            "day": best_day,
            "start_period": best_start,
            "end_period": best_end,
            "room_id": best_room_id,
        }
        if not is_exact:
            booking_entry["reason"] = _alternative_reason(req, best_room_id, best_day, best_start, best_end, rooms)
        else:
            booking_entry["reason"] = f"{eff_cat.replace('_', ' ').title()}, room available"
        
        bookings.append(booking_entry)
        
        # Mark room as busy
        for p in range(best_start, best_end + 1):
            room_busy[(best_room_id, best_day, p)].append(req_id)
        
        # Handle displaced sessions
        for ds in displaced_sessions:
            sid = ds["session_id"]
            s = sessions.get(sid)
            if s:
                # Find alternative slot for displaced session
                alt = _find_session_alternative(sid, s, timetable_assignments, rooms, room_busy, room_unavail, data)
                if alt:
                    alt_day, alt_start, alt_room = alt
                    session_overrides.append({
                        "session_id": sid,
                        "day": alt_day,
                        "start_period": alt_start,
                        "room_id": alt_room,
                        "displaced_by": req_id,
                    })
                    # Update room_busy
                    for p in range(alt_start, alt_start + s["duration"]):
                        room_busy[(alt_room, alt_day, p)].append(sid)
    
    return {"bookings": bookings, "session_overrides": session_overrides}


def _find_placement(
    req: dict, rooms: dict, room_busy: dict, room_unavail: dict, group_occ: dict, data: dict
) -> tuple[str, str, int, int, bool] | None:
    """Find best valid placement for a booking request.
    
    Returns: (room_id, day, start_period, end_period, is_exact_match) or None
    """
    duration = req["duration_periods"]
    attendance = req["attendance"]
    room_types = req["room_types"]
    needs = set(req.get("needs", []))
    preferred_room = req.get("requested_room")
    mandatory_groups = req.get("mandatory_for_groups", [])
    
    # Find compatible rooms
    compat_rooms = []
    for rid, r in rooms.items():
        if r["type"] not in room_types:
            continue
        if r["capacity"] < attendance:
            continue
        if "event" not in r.get("allowed_uses", []):
            continue
        feats = set(r.get("features", [])) | ({"accessible"} if r.get("accessible") else set())
        if needs - feats:
            continue
        compat_rooms.append(rid)
    
    if not compat_rooms:
        return None
    
    # Sort rooms: preferred first, then by capacity (smallest sufficient first)
    compat_rooms.sort(key=lambda rid: (0 if rid == preferred_room else 1, rooms[rid]["capacity"]))
    
    # Try exact windows first
    for window in req.get("windows", []):
        day = window["day"]
        from_p = window["from_period"]
        to_p = window["to_period"]
        
        for start_p in range(from_p, to_p - duration + 2):
            end_p = start_p + duration - 1
            if end_p > to_p or end_p > MAX_PERIOD:
                continue
            
            for rid in compat_rooms:
                if _slot_available(rid, day, start_p, end_p, room_busy, room_unavail, mandatory_groups, group_occ):
                    return (rid, day, start_p, end_p, True)
    
    # Try alternative placements (outside exact windows)
    days = data["calendar"]["days"]
    for day in days:
        for start_p in range(1, MAX_PERIOD - duration + 2):
            end_p = start_p + duration - 1
            if end_p > MAX_PERIOD:
                continue
            for rid in compat_rooms:
                if _slot_available(rid, day, start_p, end_p, room_busy, room_unavail, mandatory_groups, group_occ):
                    return (rid, day, start_p, end_p, False)
    
    return None


def _slot_available(
    room_id: str, day: str, start_p: int, end_p: int,
    room_busy: dict, room_unavail: dict, mandatory_groups: list, group_occ: dict
) -> bool:
    for p in range(start_p, end_p + 1):
        if room_busy.get((room_id, day, p), []):
            return False
        if (day, p) in room_unavail.get(room_id, set()):
            return False
        for g in mandatory_groups:
            if group_occ.get((g, day, p), []):
                return False
    return True


def _rejection_reason(req: dict, rooms: dict, room_busy: dict, room_unavail: dict, data: dict) -> str:
    attendance = req["attendance"]
    room_types = req["room_types"]
    needs = set(req.get("needs", []))
    
    # Check if any room type matches
    matching_rooms = [r for r in rooms.values() if r["type"] in room_types and "event" in r.get("allowed_uses", [])]
    if not matching_rooms:
        return f"No {'/'.join(room_types)} rooms available for events on campus."
    
    # Check capacity
    max_cap = max(r["capacity"] for r in matching_rooms)
    if max_cap < attendance:
        return f"No venue on campus seats {attendance} (largest suitable venue has capacity {max_cap})."
    
    # Check features
    for r in matching_rooms:
        feats = set(r.get("features", [])) | ({"accessible"} if r.get("accessible") else set())
        missing = needs - feats
        if missing:
            continue
        if r["capacity"] >= attendance:
            return f"All suitable venues ({r['id']}) are occupied during the requested time windows."
    
    return "No suitable venue available for the requested time windows."


def _alternative_reason(req: dict, room_id: str, day: str, start: int, end: int, rooms: dict) -> str:
    preferred = req.get("requested_room")
    reasons = []
    if preferred and preferred != room_id:
        reasons.append(f"{preferred} was unavailable; {room_id} offered instead")
    
    # Check if outside requested windows
    in_window = False
    for w in req.get("windows", []):
        if w["day"] == day and w["from_period"] <= start and end <= w["to_period"]:
            in_window = True
            break
    
    if not in_window:
        reasons.append(f"original windows were not available; placed at {day} P{start}-P{end}")
    
    return "; ".join(reasons) if reasons else f"Placed at {room_id} {day} P{start}-P{end}"


def _find_session_alternative(
    sid: str, session: dict, assignments: dict,
    rooms: dict, room_busy: dict, room_unavail: dict, data: dict
) -> tuple[str, int, str] | None:
    """Find an alternative slot for a displaced session."""
    duration = session["duration"]
    room_types = session["room_types"]
    size = session["size"]
    days = data["calendar"]["days"]
    
    # Faculty unavailability
    fac_unavail: set[tuple[str, int]] = set()
    for f in data["faculty"]:
        if f["id"] == session["faculty_id"]:
            for u in f.get("unavailable", []):
                for p in u["periods"]:
                    fac_unavail.add((u["day"], p))
    
    # Find compatible rooms
    compat = [rid for rid, r in rooms.items()
              if r["type"] in room_types and r["capacity"] >= size
              and (not session.get("needs_accessible") or r.get("accessible"))
              and any(k in r.get("allowed_uses", []) for k in ["lecture", "lab", "tutorial"])]
    
    lab_starts = set(data["calendar"].get("lab_start_periods", [2, 6]))
    lunch_after = data["calendar"]["lunch"]["after_period"]
    
    for day in days:
        for start_p in range(1, LAST_TEACHING - duration + 2):
            periods = list(range(start_p, start_p + duration))
            # Lunch check
            if periods[0] <= lunch_after < periods[-1]:
                continue
            # Lab start check
            if session["kind"] == "lab" and start_p not in lab_starts:
                continue
            # Faculty availability
            if any((day, p) in fac_unavail for p in periods):
                continue
            
            for rid in compat:
                # Room availability
                if any((day, p) in room_unavail.get(rid, set()) for p in periods):
                    continue
                # Room not busy
                if any(room_busy.get((rid, day, p), []) for p in periods):
                    continue
                return (day, start_p, rid)
    
    return None
