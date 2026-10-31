"""Exam scheduler for CIT dataset.

Assigns each exam to a day/session (AM/PM) and set of rooms,
respecting constraints:
  E1: All exams scheduled exactly once, valid slots
  E2: Rooms must allow exams
  H4: No room double-booking
  H3: No group double-booking in same slot
  H5: Total half-capacity of rooms >= exam size
  Soft: Minimize groups having 2+ exams in a day
"""
from __future__ import annotations
from collections import defaultdict
from typing import Any


def schedule_exams(data: dict) -> list[dict[str, Any]]:
    """Schedule all exams and return [{exam_id, day, session, rooms}]."""
    rooms = {r["id"]: r for r in data["rooms"]}
    exams = data.get("exams", [])
    calendar = data["calendar"]["exam_week"]
    days = calendar["days"]
    sessions = [s["id"] for s in calendar["sessions"]]
    
    # Find rooms that can host exams
    exam_rooms = {rid: r for rid, r in rooms.items() if "exam" in r.get("allowed_uses", [])}
    
    # Sort rooms by capacity descending for greedy assignment
    sorted_rooms = sorted(exam_rooms.keys(), key=lambda rid: exam_rooms[rid]["capacity"], reverse=True)
    
    # Sort exams by size descending (largest first for better packing)
    sorted_exams = sorted(exams, key=lambda e: e["size"], reverse=True)
    
    # Track usage: (day, session) -> set of room_ids used
    room_usage: dict[tuple[str, str], set[str]] = defaultdict(set)
    # Track group usage: (group, day, session) -> exam_id
    group_usage: dict[tuple[str, str, str], str] = {}
    # Track group-day: (group, day) -> count
    group_day_count: dict[tuple[str, str], int] = defaultdict(int)
    
    result = []
    
    for exam in sorted_exams:
        eid = exam["id"]
        size = exam["size"]
        groups = exam["groups"]
        
        best_slot = None
        best_rooms_list = None
        best_penalty = float("inf")
        
        for day in days:
            for sess in sessions:
                # Check group conflicts
                group_conflict = False
                for g in groups:
                    if (g, day, sess) in group_usage:
                        group_conflict = True
                        break
                if group_conflict:
                    continue
                
                # Find rooms with enough half-capacity
                used = room_usage[(day, sess)]
                available = [rid for rid in sorted_rooms if rid not in used]
                
                # Greedy room assignment
                assigned_rooms = []
                total_seats = 0
                for rid in available:
                    if total_seats >= size:
                        break
                    half_cap = exam_rooms[rid]["capacity"] // 2
                    assigned_rooms.append(rid)
                    total_seats += half_cap
                
                if total_seats < size:
                    continue
                
                # Calculate penalty (groups with 2+ exams same day)
                penalty = sum(1 for g in groups if group_day_count[(g, day)] >= 1)
                
                if penalty < best_penalty:
                    best_penalty = penalty
                    best_slot = (day, sess)
                    best_rooms_list = assigned_rooms
        
        if best_slot and best_rooms_list:
            day, sess = best_slot
            result.append({
                "exam_id": eid,
                "day": day,
                "session": sess,
                "rooms": best_rooms_list,
            })
            for rid in best_rooms_list:
                room_usage[(day, sess)].add(rid)
            for g in groups:
                group_usage[(g, day, sess)] = eid
                group_day_count[(g, day)] += 1
    
    return result
