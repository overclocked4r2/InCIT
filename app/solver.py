"""OR-Tools CP-SAT timetable solver for the CIT dataset.

Generates a valid weekly timetable assigning each session a day, start_period, and room.
Respects all hard constraints from the official validator:
  H1: All sessions scheduled exactly once
  H2: Faculty not double-booked
  H3: Student groups not double-booked (basket slots share a key)
  H4: Rooms not double-booked
  H5: Room capacity >= session size
  H6: Room type matches session requirements
  H7: Faculty availability (hard unavailability)
  H8: Room unavailability
  H9: Period bounds, lunch gap, lab start periods
  H10: Accessibility
  H11: Basket slot sessions at the same day/period
  H12: Faculty max hours per day
  H14: Fixed slots
"""
from __future__ import annotations
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any
from ortools.sat.python import cp_model


@dataclass
class SolverResult:
    status: str  # optimal, feasible, infeasible, unknown
    assignments: list[dict[str, Any]]  # [{session_id, day, start_period, room_id}]
    stats: dict[str, Any] = field(default_factory=dict)
    violations: list[str] = field(default_factory=list)
    soft_penalty: int = 0


DAYS = ["MON", "TUE", "WED", "THU", "FRI"]
DAY_IDX = {d: i for i, d in enumerate(DAYS)}
LAST_TEACHING = 9
LUNCH_AFTER = 5  # lunch is after period 5, before period 6
LAB_STARTS = {2, 6}


def solve_timetable(
    data: dict,
    *,
    time_limit_seconds: int = 60,
    num_workers: int = 8,
    baseline_assignments: dict[str, dict[str, Any]] | list[dict[str, Any]] | None = None,
    locked_session_ids: set[str] | None = None,
) -> SolverResult:
    """Run the CP-SAT solver, preserving an optional existing timetable when possible.

    ``locked_session_ids`` makes selected baseline assignments hard constraints.
    It is useful for a small disruption: unaffected classes no longer enlarge the
    search, while affected classes remain free for the solver to repair.
    """
    t0 = time.time()
    time_limit_seconds = max(1, min(time_limit_seconds, 60))
    
    rooms = {r["id"]: r for r in data["rooms"]}
    faculty = {f["id"]: f for f in data["faculty"]}
    groups = {g["id"]: g for g in data["student_groups"]}
    sessions = data["sessions"]
    
    # Pre-compute unavailability sets
    fac_unavail: dict[str, set[tuple[int, int]]] = defaultdict(set)  # fac_id -> {(day_idx, period)}
    for f in data["faculty"]:
        for u in f.get("unavailable", []):
            d_idx = DAY_IDX.get(u["day"])
            if d_idx is not None:
                for p in u["periods"]:
                    fac_unavail[f["id"]].add((d_idx, p))
    
    room_unavail: dict[str, set[tuple[int, int]]] = defaultdict(set)  # room_id -> {(day_idx, period)}
    for u in data.get("room_unavailability", []):
        d_idx = DAY_IDX.get(u["day"])
        if d_idx is not None:
            for p in u["periods"]:
                room_unavail[u["room_id"]].add((d_idx, p))
    
    # For each session, pre-compute compatible rooms
    compatible_rooms: dict[str, list[str]] = {}
    for s in sessions:
        compat = []
        for rid, r in rooms.items():
            # Room type must match
            if r["type"] not in s["room_types"]:
                continue
            # Capacity must be sufficient
            if r["capacity"] < s["size"]:
                continue
            # Accessibility
            if s.get("needs_accessible") and not r.get("accessible", False):
                continue
            # Room must allow the kind of use
            kind_map = {"lecture": "lecture", "tutorial": "lecture", "lab": "lab"}
            use_kind = kind_map.get(s["kind"], "lecture")
            if use_kind not in r.get("allowed_uses", []):
                continue
            compat.append(rid)
        compatible_rooms[s["id"]] = compat
    
    # Pre-compute valid start periods for each session
    valid_starts: dict[str, list[int]] = {}
    for s in sessions:
        dur = s["duration"]
        starts = []
        for p in range(1, LAST_TEACHING - dur + 2):
            periods = list(range(p, p + dur))
            # Must not cross lunch (periods before and after lunch boundary)
            if periods[0] <= LUNCH_AFTER < periods[-1]:
                continue
            # Labs must start at P2 or P6
            if s["kind"] == "lab" and p not in LAB_STARTS:
                continue
            starts.append(p)
        
        # Fixed slot overrides
        fx = s.get("fixed_slot")
        if fx:
            fixed_p = fx["start_period"]
            if fixed_p in starts:
                starts = [fixed_p]
            else:
                starts = [fixed_p]  # Still include it; constraint will catch issues
        
        valid_starts[s["id"]] = starts
    
    baseline_by_session: dict[str, dict[str, Any]] = {}
    if isinstance(baseline_assignments, dict):
        baseline_by_session = baseline_assignments
    elif baseline_assignments:
        baseline_by_session = {a["session_id"]: a for a in baseline_assignments}

    # Build the model
    model = cp_model.CpModel()
    
    # Decision variables
    # For each session: day (0-4), start_period, room_index
    session_day: dict[str, Any] = {}
    session_start: dict[str, Any] = {}
    session_room_idx: dict[str, Any] = {}
    
    # Assignment booleans: x[sid, day, start, room_idx] = 1 if assigned
    x: dict[tuple[str, int, int, int], Any] = {}
    
    impossible_sessions: list[str] = []
    for s in sessions:
        sid = s["id"]
        compat = compatible_rooms[sid]
        starts = valid_starts[sid]
        
        if not compat:
            impossible_sessions.append(f"{sid}: no compatible room meets its type, capacity, and accessibility needs")
            continue
        if not starts:
            impossible_sessions.append(f"{sid}: no valid start period fits its duration and lab/lunch rules")
            continue
        
        fx = s.get("fixed_slot")
        if fx:
            fixed_day = DAY_IDX.get(fx["day"])
            days_range = [fixed_day] if fixed_day is not None else list(range(5))
        else:
            days_range = list(range(5))
        
        # Create boolean variables for valid combinations
        session_vars = []
        for d in days_range:
            for p in starts:
                periods = list(range(p, p + s["duration"]))
                # Check faculty unavailability
                fid = s["faculty_id"]
                if any((d, pp) in fac_unavail.get(fid, set()) for pp in periods):
                    continue
                for ri, rid in enumerate(compat):
                    # Check room unavailability
                    if any((d, pp) in room_unavail.get(rid, set()) for pp in periods):
                        continue
                    var = model.new_bool_var(f"x_{sid}_{d}_{p}_{ri}")
                    x[(sid, d, p, ri)] = var
                    session_vars.append(var)
        
        if not session_vars:
            impossible_sessions.append(f"{sid}: all compatible room and time options are unavailable")
            continue
        
        # Exactly one assignment per session
        model.add_exactly_one(session_vars)
        
        # Create helper variables for day/start/room
        session_day[sid] = model.new_int_var(0, 4, f"day_{sid}")
        session_start[sid] = model.new_int_var(1, LAST_TEACHING, f"start_{sid}")
        session_room_idx[sid] = model.new_int_var(0, len(compat) - 1, f"room_{sid}")
        
        for (s_id, d, p, ri), var in x.items():
            if s_id != sid:
                continue
            model.add(session_day[sid] == d).only_enforce_if(var)
            model.add(session_start[sid] == p).only_enforce_if(var)
            model.add(session_room_idx[sid] == ri).only_enforce_if(var)

    if impossible_sessions:
        return SolverResult(
            status="infeasible",
            assignments=[],
            violations=[f"No valid fix: {reason}" for reason in impossible_sessions],
            stats={
                "elapsed_seconds": round(time.time() - t0, 2),
                "total_sessions": len(sessions),
                "assigned_sessions": 0,
                "movement_optimised": bool(baseline_by_session),
            },
        )

    # A disruption normally invalidates only a few existing assignments.  Lock
    # every known-safe baseline assignment so CP-SAT searches for repairs rather
    # than repeatedly rediscovering a whole 189-session timetable.
    locked_session_ids = locked_session_ids or set()
    locked_sessions = 0
    for sid in locked_session_ids:
        old = baseline_by_session.get(sid)
        if old is None or sid not in compatible_rooms:
            continue
        try:
            old_day = DAY_IDX[old["day"]]
            old_start = old["start_period"]
            old_room_index = compatible_rooms[sid].index(old["room_id"])
        except (KeyError, ValueError):
            continue
        old_var = x.get((sid, old_day, old_start, old_room_index))
        if old_var is not None:
            model.add(old_var == 1)
            locked_sessions += 1
    
    # No-overlap constraints
    # Group sessions by potential conflicts
    
    # H4: Room conflicts — no two sessions in the same room at the same time
    for d in range(5):
        for p in range(1, LAST_TEACHING + 1):
            # Collect all x-vars where this (day, period) is occupied for each room
            room_period_vars: dict[str, list] = defaultdict(list)
            for s in sessions:
                sid = s["id"]
                dur = s["duration"]
                compat = compatible_rooms[sid]
                for start_p in valid_starts[sid]:
                    periods = list(range(start_p, start_p + dur))
                    if p not in periods:
                        continue
                    for ri, rid in enumerate(compat):
                        key = (sid, d, start_p, ri)
                        if key in x:
                            room_period_vars[rid].append(x[key])
            
            for rid, vars_list in room_period_vars.items():
                if len(vars_list) > 1:
                    model.add(sum(vars_list) <= 1)
    
    # H2: Faculty conflicts — no two sessions with same faculty at same time
    fac_sessions: dict[str, list[dict]] = defaultdict(list)
    for s in sessions:
        fac_sessions[s["faculty_id"]].append(s)
    
    for d in range(5):
        for p in range(1, LAST_TEACHING + 1):
            for fid, f_sessions in fac_sessions.items():
                if len(f_sessions) <= 1:
                    continue
                vars_at_period = []
                for s in f_sessions:
                    sid = s["id"]
                    compat = compatible_rooms[sid]
                    dur = s["duration"]
                    for start_p in valid_starts[sid]:
                        periods = list(range(start_p, start_p + dur))
                        if p not in periods:
                            continue
                        for ri in range(len(compat)):
                            key = (sid, d, start_p, ri)
                            if key in x:
                                vars_at_period.append(x[key])
                if len(vars_at_period) > 1:
                    model.add(sum(vars_at_period) <= 1)
    
    # H3: Student group conflicts
    # Sessions sharing a group must not overlap (unless same basket_slot)
    group_sessions: dict[str, list[dict]] = defaultdict(list)
    for s in sessions:
        for g in s["groups"]:
            group_sessions[g].append(s)
    
    for d in range(5):
        for p in range(1, LAST_TEACHING + 1):
            for gid, g_sessions in group_sessions.items():
                if len(g_sessions) <= 1:
                    continue
                # Group by basket_slot or session_id
                basket_vars: dict[str, list] = defaultdict(list)
                for s in g_sessions:
                    sid = s["id"]
                    key_id = s.get("basket_slot") or sid
                    compat = compatible_rooms[sid]
                    dur = s["duration"]
                    for start_p in valid_starts[sid]:
                        periods = list(range(start_p, start_p + dur))
                        if p not in periods:
                            continue
                        for ri in range(len(compat)):
                            xkey = (sid, d, start_p, ri)
                            if xkey in x:
                                basket_vars[key_id].append(x[xkey])
                
                # At most one basket key active at any (group, day, period)
                active_baskets = []
                for bkey, vars_list in basket_vars.items():
                    if vars_list:
                        b = model.new_bool_var(f"basket_{gid}_{d}_{p}_{bkey}")
                        model.add(sum(vars_list) >= 1).only_enforce_if(b)
                        model.add(sum(vars_list) == 0).only_enforce_if(b.negated())
                        active_baskets.append(b)
                if len(active_baskets) > 1:
                    model.add(sum(active_baskets) <= 1)
    
    # H11: Basket slot sessions must be at the same day and period
    basket_sessions: dict[str, list[dict]] = defaultdict(list)
    for s in sessions:
        if s.get("basket_slot"):
            basket_sessions[s["basket_slot"]].append(s)
    
    for bslot, b_sessions in basket_sessions.items():
        if len(b_sessions) <= 1:
            continue
        first = b_sessions[0]
        first_sid = first["id"]
        if first_sid not in session_day:
            continue
        for s in b_sessions[1:]:
            sid = s["id"]
            if sid not in session_day:
                continue
            model.add(session_day[sid] == session_day[first_sid])
            model.add(session_start[sid] == session_start[first_sid])
    
    # H12: Faculty max hours per day
    for fid, f_sessions in fac_sessions.items():
        max_hours = faculty[fid].get("max_hours_per_day", 4)
        for d in range(5):
            hours_vars = []
            for s in f_sessions:
                sid = s["id"]
                compat = compatible_rooms[sid]
                dur = s["duration"]
                for start_p in valid_starts[sid]:
                    for ri in range(len(compat)):
                        key = (sid, d, start_p, ri)
                        if key in x:
                            hours_vars.append(x[key] * dur)
            if hours_vars:
                model.add(sum(hours_vars) <= max_hours)
    
    # Soft objectives
    soft_penalties = []

    # A group is occupied in a period if any of its sessions is assigned there.
    # This also handles elective baskets correctly: simultaneous basket sessions
    # still count as one occupied period for the group.
    group_occupied: dict[tuple[str, int, int], Any] = {}
    for gid, g_sessions in group_sessions.items():
        for d in range(5):
            for p in range(1, LAST_TEACHING + 1):
                occupied_by = []
                for s in g_sessions:
                    sid = s["id"]
                    for start_p in valid_starts[sid]:
                        if p not in range(start_p, start_p + s["duration"]):
                            continue
                        for ri in range(len(compatible_rooms[sid])):
                            var = x.get((sid, d, start_p, ri))
                            if var is not None:
                                occupied_by.append(var)
                occupied = model.new_bool_var(f"group_occupied_{gid}_{d}_{p}")
                if occupied_by:
                    model.add_max_equality(occupied, occupied_by)
                else:
                    model.add(occupied == 0)
                group_occupied[(gid, d, p)] = occupied

    # S2: a free teaching period between two classes for the same group costs 1.
    for gid in group_sessions:
        for d in range(5):
            for p in range(2, LAST_TEACHING):
                before = model.new_bool_var(f"group_before_{gid}_{d}_{p}")
                after = model.new_bool_var(f"group_after_{gid}_{d}_{p}")
                model.add_max_equality(before, [group_occupied[(gid, d, q)] for q in range(1, p)])
                model.add_max_equality(after, [group_occupied[(gid, d, q)] for q in range(p + 1, LAST_TEACHING + 1)])
                gap = model.new_bool_var(f"group_gap_{gid}_{d}_{p}")
                model.add_bool_and([before, after, group_occupied[(gid, d, p)].negated()]).only_enforce_if(gap)
                model.add_bool_or([before.negated(), after.negated(), group_occupied[(gid, d, p)], gap])
                soft_penalties.append(gap)

    # S3: more than six occupied class hours in a group-day costs 3 per hour.
    for gid in group_sessions:
        for d in range(5):
            hours = sum(group_occupied[(gid, d, p)] for p in range(1, LAST_TEACHING + 1))
            excess = model.new_int_var(0, LAST_TEACHING - 6, f"group_excess_{gid}_{d}")
            model.add(excess >= hours - 6)
            soft_penalties.append(excess * 3)

    # S4: repeated non-basket lectures of a course for a group-day cost 3 each.
    group_course_sessions: dict[tuple[str, str], list[dict]] = defaultdict(list)
    basket_course_sessions: dict[str, list[dict]] = defaultdict(list)
    for s in sessions:
        if s.get("basket_slot"):
            basket_course_sessions[s["course_id"]].append(s)
        elif s["kind"] == "lecture":
            for gid in s["groups"]:
                group_course_sessions[(gid, s["course_id"])].append(s)

    def assigned_on_day(session: dict, day: int) -> list[Any]:
        return [
            var for (sid, d, _start, _room), var in x.items()
            if sid == session["id"] and d == day
        ]

    for (_gid, _course), course_sessions in group_course_sessions.items():
        if len(course_sessions) < 2:
            continue
        for d in range(5):
            repeats = model.new_int_var(0, len(course_sessions) - 1, f"course_repeat_{_gid}_{_course}_{d}")
            model.add(repeats >= sum(var for s in course_sessions for var in assigned_on_day(s, d)) - 1)
            soft_penalties.append(repeats * 3)

    # The official validator applies the same repeated-course penalty to basket
    # lectures by course and day, without counting a group twice.
    for course, course_sessions in basket_course_sessions.items():
        if len(course_sessions) < 2:
            continue
        for d in range(5):
            repeats = model.new_int_var(0, len(course_sessions) - 1, f"basket_repeat_{course}_{d}")
            model.add(repeats >= sum(var for s in course_sessions for var in assigned_on_day(s, d)) - 1)
            soft_penalties.append(repeats * 3)
    
    # S1: Faculty preference violations (avoid certain periods)
    for s in sessions:
        sid = s["id"]
        fid = s["faculty_id"]
        fac = faculty.get(fid, {})
        for pref in fac.get("preferences", []):
            if pref.get("type") == "avoid":
                avoid_days = [DAY_IDX[dd] for dd in pref.get("days", DAYS) if dd in DAY_IDX]
                avoid_periods = set(pref["periods"])
                for d in avoid_days:
                    for start_p in valid_starts[sid]:
                        periods = list(range(start_p, start_p + s["duration"]))
                        penalty_count = sum(1 for pp in periods if pp in avoid_periods)
                        if penalty_count == 0:
                            continue
                        compat = compatible_rooms[sid]
                        for ri in range(len(compat)):
                            key = (sid, d, start_p, ri)
                            if key in x:
                                soft_penalties.append(x[key] * 2 * penalty_count)
    
    # S5: Room utilization < 40%
    for s in sessions:
        sid = s["id"]
        compat = compatible_rooms[sid]
        for d in range(5):
            for start_p in valid_starts[sid]:
                for ri, rid in enumerate(compat):
                    r = rooms[rid]
                    if r["capacity"] > 0 and s["size"] / r["capacity"] < 0.4:
                        key = (sid, d, start_p, ri)
                        if key in x:
                            soft_penalties.append(x[key])
    
    # S6: Last period (P9) usage
    for s in sessions:
        sid = s["id"]
        dur = s["duration"]
        for d in range(5):
            for start_p in valid_starts[sid]:
                periods = list(range(start_p, start_p + dur))
                if LAST_TEACHING in periods:
                    compat = compatible_rooms[sid]
                    for ri in range(len(compat)):
                        key = (sid, d, start_p, ri)
                        if key in x:
                            soft_penalties.append(x[key])
    
    # When a baseline is supplied, changing an existing session is much more
    # expensive than any soft preference.  This gives the solver freedom to
    # repair a disruption while keeping unaffected sessions stable.
    movement_penalties = []
    for sid, old in baseline_by_session.items():
        if sid not in session_day or sid not in compatible_rooms:
            continue
        try:
            old_day = DAY_IDX[old["day"]]
            old_start = old["start_period"]
            old_room_index = compatible_rooms[sid].index(old["room_id"])
        except (KeyError, ValueError):
            continue
        old_var = x.get((sid, old_day, old_start, old_room_index))
        if old_var is not None:
            # 10,000 exceeds the total possible preference cost in this data,
            # so this is a lexicographic "move as few as possible" objective.
            movement_penalties.append((1 - old_var) * 10_000)

    objective_terms = movement_penalties + soft_penalties
    if objective_terms:
        model.minimize(sum(objective_terms))
    
    # Solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_seconds
    solver.parameters.num_workers = num_workers
    solver.parameters.log_search_progress = False
    
    status = solver.solve(model)
    
    elapsed = time.time() - t0
    
    status_map = {
        cp_model.OPTIMAL: "optimal",
        cp_model.FEASIBLE: "feasible",
        cp_model.INFEASIBLE: "infeasible",
        cp_model.MODEL_INVALID: "invalid",
        cp_model.UNKNOWN: "unknown",
    }
    result_status = status_map.get(status, "unknown")

    if result_status == "infeasible":
        return SolverResult(
            status=result_status,
            assignments=[],
            violations=[
                "No valid fix: the remaining room, faculty, group, and fixed-slot constraints cannot all be met together."
            ],
            stats={
                "elapsed_seconds": round(elapsed, 2),
                "total_sessions": len(sessions),
                "assigned_sessions": 0,
                "solver_status_raw": str(status),
                "time_limit_seconds": time_limit_seconds,
                "movement_optimised": bool(baseline_by_session),
                "locked_sessions": locked_sessions,
            },
        )
    
    assignments = []
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for s in sessions:
            sid = s["id"]
            compat = compatible_rooms[sid]
            assigned = False
            for (s_id, d, p, ri), var in x.items():
                if s_id == sid and solver.value(var) == 1:
                    assignments.append({
                        "session_id": sid,
                        "day": DAYS[d],
                        "start_period": p,
                        "room_id": compat[ri],
                    })
                    assigned = True
                    break
            if not assigned:
                # Session was not assigned (solver couldn't find a slot)
                pass
    
    moved_sessions = 0
    if baseline_by_session:
        for assignment in assignments:
            old = baseline_by_session.get(assignment["session_id"])
            if old and any(assignment[key] != old.get(key) for key in ("day", "start_period", "room_id")):
                moved_sessions += 1

    return SolverResult(
        status=result_status,
        assignments=assignments,
        stats={
            "elapsed_seconds": round(elapsed, 2),
            "total_sessions": len(sessions),
            "assigned_sessions": len(assignments),
            "solver_status_raw": str(status),
            "objective_value": solver.objective_value if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else None,
            "time_limit_seconds": time_limit_seconds,
            "movement_optimised": bool(baseline_by_session),
            "locked_sessions": locked_sessions,
            "moved_sessions": moved_sessions,
            "unchanged_sessions": len(baseline_by_session) - moved_sessions if baseline_by_session else 0,
        },
    )
