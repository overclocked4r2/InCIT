"""Bridge to the official CrunchWeek validator logic.

Replicates the core validation functions from the starter pack's
validator.py, adapted for use as a Python module within the app.
"""
from __future__ import annotations
from collections import defaultdict
from typing import Any

MAX_PERIOD = 13
LAST_TEACHING = 9
CAT_WEIGHT = {"institute_event": 5, "guest_lecture": 4, "department_event": 3, "club_event": 2}


def effective_category(data: dict, req: dict) -> str:
    order = data["priority_order"]
    cap = data["role_category_cap"].get(req["role"], "club_event")
    a = order.index(req["requested_category"]) if req["requested_category"] in order else len(order) - 1
    return order[max(a, order.index(cap))]


class Ctx:
    def __init__(self, data):
        self.data = data
        self.days = data["calendar"]["days"]
        self.lab_starts = set(data["calendar"]["lab_start_periods"])
        self.lunch = data["calendar"]["lunch"]["after_period"]
        self.rooms = {r["id"]: r for r in data["rooms"]}
        self.fac = {f["id"]: f for f in data["faculty"]}
        self.groups = {g["id"]: g for g in data["student_groups"]}
        self.sessions = {s["id"]: s for s in data["sessions"]}
        self.req = {b["id"]: b for b in data["booking_requests"]}
        self.cancelled = {c["request_id"] for c in data.get("cancellations", [])}
        self.fac_un = defaultdict(set)
        for f in data["faculty"]:
            for u in f.get("unavailable", []):
                for p in u["periods"]:
                    self.fac_un[f["id"]].add((u["day"], p))
        self.room_un = defaultdict(set)
        for u in data.get("room_unavailability", []):
            for p in u["periods"]:
                self.room_un[u["room_id"]].add((u["day"], p))


def block(start, dur):
    return list(range(start, start + dur))


def _check_assignments(ctx, assign, label):
    V = []
    def v(rule, msg):
        V.append({"rule": rule, "where": label, "detail": msg})

    room_occ = defaultdict(list)
    fac_occ = defaultdict(list)
    grp_occ = defaultdict(set)
    fac_day = defaultdict(int)
    basket_time = defaultdict(set)

    for sid in ctx.sessions:
        if sid not in assign:
            v("H1", f"Session {sid} is not scheduled")
    for sid, (day, start, rid) in assign.items():
        s = ctx.sessions.get(sid)
        if s is None:
            v("H1", f"Unknown session id {sid}")
            continue
        if day not in ctx.days:
            v("H1", f"{sid}: invalid day {day}")
            continue
        if not isinstance(start, int) or start < 1 or start + s["duration"] - 1 > LAST_TEACHING:
            v("H9", f"{sid}: start period {start} with duration {s['duration']} runs outside P1-P9")
            continue
        r = ctx.rooms.get(rid)
        if r is None:
            v("H1", f"{sid}: unknown room {rid}")
            continue
        per = block(start, s["duration"])
        if per[0] <= ctx.lunch < per[-1]:
            v("H9", f"{sid}: crosses lunch ({day} P{per[0]}-P{per[-1]})")
        if s["kind"] == "lab" and start not in ctx.lab_starts:
            v("H9", f"{sid}: lab must start at P2 or P6, starts at P{start}")
        fx = s.get("fixed_slot")
        if fx and (fx["day"] != day or fx["start_period"] != start):
            v("H14", f"{sid}: fixed at {fx['day']} P{fx['start_period']}, placed at {day} P{start}")
        if r["capacity"] < s["size"]:
            v("H5", f"{sid}: size {s['size']} > {rid} capacity {r['capacity']}")
        if r["type"] not in s["room_types"]:
            v("H6", f"{sid}: needs {s['room_types']}, {rid} is {r['type']}")
        if s.get("needs_accessible") and not r["accessible"]:
            v("H10", f"{sid}: needs an accessible room, {rid} is not")
        f = s["faculty_id"]
        for p in per:
            room_occ[(rid, day, p)].append(sid)
            fac_occ[(f, day, p)].append(sid)
            key = s.get("basket_slot") or sid
            for g in s["groups"]:
                grp_occ[(g, day, p)].add(key)
            if (day, p) in ctx.fac_un[f]:
                v("H7", f"{sid}: {f} unavailable {day} P{p}")
            if (day, p) in ctx.room_un[rid]:
                v("H8", f"{sid}: {rid} unavailable {day} P{p}")
        fac_day[(f, day)] += s["duration"]
        if s.get("basket_slot"):
            basket_time[s["basket_slot"]].add((day, start))

    for (rid, day, p), sids in room_occ.items():
        if len(sids) > 1:
            v("H4", f"{rid} double-booked {day} P{p}: {', '.join(sorted(sids))}")
    for (f, day, p), sids in fac_occ.items():
        if len(sids) > 1:
            v("H2", f"{f} double-booked {day} P{p}: {', '.join(sorted(sids))}")
    for (g, day, p), keys in grp_occ.items():
        if len(keys) > 1:
            v("H3", f"Group {g} double-booked {day} P{p}: {', '.join(sorted(keys))}")
    for b, times in basket_time.items():
        if len(times) > 1:
            v("H11", f"Basket {b} sessions are not at the same time: {sorted(times)}")
    for (f, day), h in fac_day.items():
        mx = ctx.fac[f].get("max_hours_per_day", 4)
        if h > mx:
            v("H12", f"{f} teaches {h} hours on {day} (max {mx})")
    return V, grp_occ


def soft_score(ctx, assign):
    pen = defaultdict(int)
    grp_day = defaultdict(set)
    grp_hours = defaultdict(int)
    grp_course = defaultdict(int)
    seen_basket = set()
    for sid, (day, start, rid) in assign.items():
        s = ctx.sessions.get(sid)
        r = ctx.rooms.get(rid)
        if s is None or r is None:
            continue
        per = block(start, s["duration"])
        for pref in ctx.fac.get(s["faculty_id"], {}).get("preferences", []):
            if pref.get("type") == "avoid" and day in pref.get("days", ctx.days):
                pen["S1"] += 2 * sum(1 for p in per if p in pref["periods"])
        if r["capacity"] and s["size"] / r["capacity"] < 0.4:
            pen["S5"] += 1
        if LAST_TEACHING in per:
            pen["S6"] += 1
        for g in s["groups"]:
            for p in per:
                grp_day[(g, day)].add(p)
            if s.get("basket_slot"):
                if (g, s["basket_slot"]) in seen_basket:
                    continue
                seen_basket.add((g, s["basket_slot"]))
            grp_hours[(g, day)] += s["duration"]
            if s["kind"] == "lecture" and not s.get("basket_slot"):
                grp_course[(g, day, s["course_id"])] += 1
    for (g, day), ps in grp_day.items():
        pen["S2"] += sum(1 for p in range(min(ps), max(ps) + 1) if p not in ps)
    for k, h in grp_hours.items():
        if h > 6:
            pen["S3"] += 3 * (h - 6)
    for k, c in grp_course.items():
        if c > 1:
            pen["S4"] += 3 * (c - 1)
    bc = defaultdict(int)
    for sid, (day, start, rid) in assign.items():
        s = ctx.sessions.get(sid)
        if s and s.get("basket_slot"):
            bc[(s["course_id"], day)] += 1
    for k, c in bc.items():
        if c > 1:
            pen["S4"] += 3 * (c - 1)
    for k in ("S1", "S2", "S3", "S4", "S5", "S6"):
        pen.setdefault(k, 0)
    return dict(sorted(pen.items())), sum(pen.values())


def check_bookings(ctx, base, fest):
    V, W = [], []
    data = ctx.data
    overrides = fest.get("session_overrides", [])
    decisions = fest.get("bookings", [])
    dec_by = {}
    for d in decisions:
        if d.get("request_id") in dec_by:
            V.append({"rule": "B1", "where": "fest_week", "detail": f"Two decisions for {d['request_id']}"})
        dec_by[d.get("request_id")] = d

    week = dict(base)
    for o in overrides:
        sid = o.get("session_id")
        if sid not in ctx.sessions:
            V.append({"rule": "B2", "where": "fest_week", "detail": f"Override for unknown session {sid}"})
            continue
        disp = dec_by.get(o.get("displaced_by"))
        req = ctx.req.get(o.get("displaced_by"))
        if not req or not disp or disp.get("status") != "approved":
            V.append({"rule": "B2", "where": "fest_week", "detail": f"Override of {sid} names {o.get('displaced_by')}, which is not an approved booking"})
        elif data["priority_order"].index(effective_category(data, req)) > data["priority_order"].index("institute_event"):
            V.append({"rule": "B2", "where": "fest_week", "detail": f"{o['displaced_by']} ({effective_category(data, req)}) is not allowed to displace a regular session"})
        week[sid] = (o["day"], o["start_period"], o["room_id"])
    wv, wgrp = _check_assignments(ctx, week, "fest_week")
    V += wv

    room_busy = defaultdict(list)
    for sid, (day, start, rid) in week.items():
        s = ctx.sessions.get(sid)
        if s:
            for p in block(start, s["duration"]):
                room_busy[(rid, day, p)].append(sid)

    score, max_score = 0.0, 0
    placed = {}
    for rid_, req in ctx.req.items():
        if rid_ not in ctx.cancelled:
            max_score += CAT_WEIGHT[effective_category(data, req)]
    for req_id, req in ctx.req.items():
        d = dec_by.get(req_id)
        if d is None:
            W.append(f"No decision for {req_id}")
            continue
        st = d.get("status")
        if req_id in ctx.cancelled:
            if st in ("approved", "alternative_offered"):
                V.append({"rule": "B3", "where": "fest_week", "detail": f"{req_id} was cancelled but is {st}"})
            continue
        if st not in ("approved", "rejected", "alternative_offered"):
            V.append({"rule": "B1", "where": "fest_week", "detail": f"{req_id}: unknown status {st}"})
            continue
        if st in ("rejected", "alternative_offered") and not str(d.get("reason", "")).strip():
            W.append(f"{req_id}: {st} without a reason")
        if st == "rejected":
            continue
        ok = True
        def bad(msg):
            nonlocal ok
            ok = False
            V.append({"rule": "H13", "where": "fest_week", "detail": f"{req_id}: {msg}"})
        room = ctx.rooms.get(d.get("room_id"))
        day, a, b = d.get("day"), d.get("start_period"), d.get("end_period")
        if room is None:
            bad(f"unknown room {d.get('room_id')}"); continue
        if day not in ctx.days or not isinstance(a, int) or not isinstance(b, int) or a < 1 or b > MAX_PERIOD or b < a:
            bad(f"invalid time {day} P{a}-P{b}"); continue
        if b - a + 1 != req["duration_periods"]:
            bad(f"booked {b-a+1} periods, request needs {req['duration_periods']}")
        if "event" not in room["allowed_uses"]:
            bad(f"{room['id']} cannot host events")
        if room["type"] not in req["room_types"]:
            bad(f"{room['id']} ({room['type']}) is not one of {req['room_types']}")
        if room["capacity"] < req["attendance"]:
            bad(f"{room['id']} seats {room['capacity']}, request needs {req['attendance']}")
        feats = set(room["features"]) | ({"accessible"} if room["accessible"] else set())
        miss = set(req["needs"]) - feats
        if miss:
            bad(f"{room['id']} lacks {sorted(miss)}")
        if st == "approved":
            inside = any(w["day"] == day and w["from_period"] <= a and b <= w["to_period"] for w in req["windows"])
            if not inside:
                bad(f"approved at {day} P{a}-P{b}, outside the requested windows (use alternative_offered)")
        for p in range(a, b + 1):
            if (day, p) in ctx.room_un[room["id"]]:
                bad(f"{room['id']} unavailable {day} P{p}")
            if room_busy[(room["id"], day, p)]:
                bad(f"{room['id']} {day} P{p} already used by {', '.join(room_busy[(room['id'], day, p)])}")
            for g in req["mandatory_for_groups"]:
                if wgrp.get((g, day, p)):
                    bad(f"mandatory for {g}, who have class {day} P{p}")
        if ok:
            for p in range(a, b + 1):
                room_busy[(room["id"], day, p)].append(req_id)
            placed[req_id] = (room["id"], day, a, b)
            score += CAT_WEIGHT[effective_category(data, req)] * (1 if st == "approved" else 0.5)

    return V, W, {"booking_score": score, "booking_score_max_if_all_approved": max_score,
                  "approved": sum(1 for x in decisions if x.get("status") == "approved"),
                  "alternatives": sum(1 for x in decisions if x.get("status") == "alternative_offered"),
                  "rejected": sum(1 for x in decisions if x.get("status") == "rejected"),
                  "session_overrides": len(overrides)}


def check_exams(ctx, exams_out):
    data = ctx.data
    V, pen = [], 0
    ex = {e["id"]: e for e in data.get("exams", [])}
    cal = data["calendar"]["exam_week"]
    sess_ids = {s["id"] for s in cal["sessions"]}
    room_use, grp_use, grp_day = defaultdict(list), defaultdict(list), defaultdict(set)
    seen = set()
    for e in exams_out:
        eid = e.get("exam_id")
        if eid not in ex:
            V.append({"rule": "E1", "where": "exams", "detail": f"Unknown exam {eid}"}); continue
        if eid in seen:
            V.append({"rule": "E1", "where": "exams", "detail": f"{eid} scheduled twice"})
        seen.add(eid)
        if e.get("day") not in cal["days"] or e.get("session") not in sess_ids:
            V.append({"rule": "E1", "where": "exams", "detail": f"{eid}: invalid slot"}); continue
        seats = 0
        for rid in e.get("rooms", []):
            r = ctx.rooms.get(rid)
            if r is None or "exam" not in r["allowed_uses"]:
                V.append({"rule": "E2", "where": "exams", "detail": f"{eid}: {rid} cannot host exams"}); continue
            seats += r["capacity"] // 2
            room_use[(rid, e["day"], e["session"])].append(eid)
        if seats < ex[eid]["size"]:
            V.append({"rule": "H5", "where": "exams", "detail": f"{eid}: {seats} seats at half capacity for {ex[eid]['size']} students"})
        for g in ex[eid]["groups"]:
            grp_use[(g, e["day"], e["session"])].append(eid)
            grp_day[(g, e["day"])].add(eid)
    for eid in ex:
        if eid not in seen:
            V.append({"rule": "E1", "where": "exams", "detail": f"{eid} not scheduled"})
    for k, v in room_use.items():
        if len(v) > 1:
            V.append({"rule": "H4", "where": "exams", "detail": f"{k[0]} has {v} in {k[1]} {k[2]}"})
    for k, v in grp_use.items():
        if len(v) > 1:
            V.append({"rule": "H3", "where": "exams", "detail": f"Group {k[0]} has {v} in {k[1]} {k[2]}"})
    for k, v in grp_day.items():
        if len(v) > 1:
            pen += 5 * (len(v) - 1)
    return V, pen


def _to_assignments(schedule: dict) -> tuple[dict, list[str]]:
    """Convert export-shaped sessions into the validator's assignment map."""
    assignments: dict[str, tuple] = {}
    duplicates: list[str] = []
    for entry in schedule.get("sessions", []):
        session_id = entry.get("session_id")
        if session_id in assignments:
            duplicates.append(session_id)
        assignments[session_id] = (entry.get("day"), entry.get("start_period"), entry.get("room_id"))
    return assignments, duplicates


def check_timetable(timetable: dict | list[dict], data: dict) -> list[dict]:
    """Return all hard timetable violations for an export-shaped timetable.

    This is the one deterministic gate for schedule creation and edits. It only
    checks timetable sessions; booking and exam checks remain in `run_validation`.
    """
    schedule = {"sessions": timetable} if isinstance(timetable, list) else timetable
    if not isinstance(schedule, dict):
        raise TypeError("timetable must be a schedule dictionary or a list of sessions")

    assignments, duplicates = _to_assignments(schedule)
    violations, _ = _check_assignments(Ctx(data), assignments, "timetable")
    for session_id in duplicates:
        violations.append({"rule": "H1", "where": "timetable", "detail": f"Session {session_id} appears more than once"})

    seen: set[tuple[str, str]] = set()
    return [violation for violation in violations if not ((key := (violation["rule"], violation["detail"])) in seen or seen.add(key))]


def run_validation(data: dict, schedule: dict) -> dict:
    """Run full validation on a schedule against the dataset."""
    ctx = Ctx(data)
    
    assign, _ = _to_assignments(schedule)
    V = check_timetable(schedule, data)
    
    soft, total = soft_score(ctx, assign)
    
    report: dict[str, Any] = {
        "soft_penalties": soft,
        "soft_total": total,
    }
    
    W: list[str] = []
    if "fest_week" in schedule and schedule["fest_week"]:
        bv, bw, bstats = check_bookings(ctx, assign, schedule["fest_week"])
        V += bv
        W += bw
        report["bookings"] = bstats
    
    if data.get("exams") and schedule.get("exams"):
        ev, epen = check_exams(ctx, schedule.get("exams", []))
        V += ev
        report["exam_soft_penalty"] = epen
    
    # Deduplicate violations
    seen = set()
    uniq = []
    for x in V:
        k = (x["rule"], x["detail"])
        if k not in seen:
            seen.add(k)
            uniq.append(x)
    V = uniq
    
    report["hard_violations"] = V
    report["hard_violation_count"] = len(V)
    report["hard_by_rule"] = {}
    for x in V:
        report["hard_by_rule"][x["rule"]] = report["hard_by_rule"].get(x["rule"], 0) + 1
    report["warnings"] = W
    
    return report
