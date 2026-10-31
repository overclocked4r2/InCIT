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


MAX_PERIOD = 13
LAST_TEACHING = 9


def effective_category(data: dict, req: dict) -> str:
    """Return the category assigned by the requester's role, never their text."""
    return data["role_category_cap"].get(req["role"], "club_event")


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
        placement = _find_placement(
            req,
            rooms,
            room_busy,
            room_unavail,
            group_occ,
            data,
            set(sessions),
            allow_session_displacement=(eff_cat == "institute_event"),
        )
        
        if placement is None:
            bookings.append({
                "request_id": req_id,
                "status": "rejected",
                "reason": _rejection_reason(req, rooms, room_busy, room_unavail, data)
            })
            continue
        
        best_room_id, best_day, best_start, best_end, is_exact = placement
        
        # An exact, approved institute event may replace teaching in its room,
        # but every affected session must first have a safe new slot.
        displaced_ids = {
            occ
            for p in range(best_start, best_end + 1)
            for occ in room_busy.get((best_room_id, best_day, p), [])
            if occ in sessions
        }
        planned_overrides: list[dict[str, Any]] = []
        if displaced_ids:
            planned = _plan_session_moves(
                displaced_ids,
                req_id,
                timetable_assignments,
                sessions,
                rooms,
                room_busy,
                room_unavail,
                group_occ,
                data,
                best_room_id,
                best_day,
                best_start,
                best_end,
            )
            if planned is None:
                bookings.append({
                    "request_id": req_id,
                    "status": "rejected",
                    "reason": "The requested room is occupied and the affected class cannot be moved safely."
                })
                continue
            planned_overrides, room_busy, group_occ = planned
        
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
        
        # _plan_session_moves has already reserved the event and new class
        # slots. Ordinary bookings only need to reserve their room now.
        if not displaced_ids:
            for p in range(best_start, best_end + 1):
                room_busy[(best_room_id, best_day, p)].append(req_id)
        session_overrides.extend(planned_overrides)
    
    return {"bookings": bookings, "session_overrides": session_overrides}


def _find_placement(
    req: dict, rooms: dict, room_busy: dict, room_unavail: dict, group_occ: dict,
    data: dict, session_ids: set[str], allow_session_displacement: bool = False,
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
                if _slot_available(
                    rid, day, start_p, end_p, room_busy, room_unavail,
                    mandatory_groups, group_occ, session_ids, allow_session_displacement,
                ):
                    return (rid, day, start_p, end_p, True)
    
    # Try alternative placements (outside exact windows)
    days = data["calendar"]["days"]
    for day in days:
        for start_p in range(1, MAX_PERIOD - duration + 2):
            end_p = start_p + duration - 1
            if end_p > MAX_PERIOD:
                continue
            for rid in compat_rooms:
                if _slot_available(
                    rid, day, start_p, end_p, room_busy, room_unavail,
                    mandatory_groups, group_occ, session_ids, False,
                ):
                    return (rid, day, start_p, end_p, False)
    
    return None


def _slot_available(
    room_id: str, day: str, start_p: int, end_p: int,
    room_busy: dict, room_unavail: dict, mandatory_groups: list, group_occ: dict,
    session_ids: set[str], allow_session_displacement: bool,
) -> bool:
    for p in range(start_p, end_p + 1):
        occupied_by = room_busy.get((room_id, day, p), [])
        if occupied_by and (not allow_session_displacement or any(occ not in session_ids for occ in occupied_by)):
            return False
        if (day, p) in room_unavail.get(room_id, set()):
            return False
        for g in mandatory_groups:
            if group_occ.get((g, day, p), []):
                return False
    return True


def _plan_session_moves(
    displaced_ids: set[str], request_id: str, assignments: dict[str, tuple[str, int, str]],
    sessions: dict[str, dict], rooms: dict, room_busy: dict, room_unavail: dict,
    group_occ: dict, data: dict, event_room: str, event_day: str,
    event_start: int, event_end: int,
) -> tuple[list[dict[str, Any]], dict, dict] | None:
    """Reserve an event and relocate every session it displaces, or reject it."""
    planned_busy = defaultdict(list, {key: list(value) for key, value in room_busy.items()})
    planned_groups = defaultdict(list, {key: list(value) for key, value in group_occ.items()})

    for sid in displaced_ids:
        old_day, old_start, old_room = assignments[sid]
        _remove_session_occupancy(sid, sessions[sid], old_day, old_start, old_room, planned_busy, planned_groups)
    for period in range(event_start, event_end + 1):
        planned_busy[(event_room, event_day, period)].append(request_id)

    overrides = []
    for sid in sorted(displaced_ids):
        session = sessions[sid]
        alternative = _find_session_alternative(
            sid, session, assignments, rooms, planned_busy, room_unavail, planned_groups, data
        )
        if alternative is None:
            return None
        day, start, room_id = alternative
        overrides.append({
            "session_id": sid,
            "day": day,
            "start_period": start,
            "room_id": room_id,
            "displaced_by": request_id,
        })
        _add_session_occupancy(sid, session, day, start, room_id, planned_busy, planned_groups)
    return overrides, planned_busy, planned_groups


def _remove_session_occupancy(
    sid: str, session: dict, day: str, start: int, room_id: str, room_busy: dict, group_occ: dict
) -> None:
    for period in range(start, start + session["duration"]):
        room_busy[(room_id, day, period)].remove(sid)
        for group in session["groups"]:
            group_occ[(group, day, period)].remove(sid)


def _add_session_occupancy(
    sid: str, session: dict, day: str, start: int, room_id: str, room_busy: dict, group_occ: dict
) -> None:
    for period in range(start, start + session["duration"]):
        room_busy[(room_id, day, period)].append(sid)
        for group in session["groups"]:
            group_occ[(group, day, period)].append(sid)


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
    rooms: dict, room_busy: dict, room_unavail: dict, group_occ: dict, data: dict
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
                # Do not create a group clash while moving the class.
                if any(group_occ.get((group, day, p), []) for group in session["groups"] for p in periods):
                    continue
                return (day, start_p, rid)
    
    return None
