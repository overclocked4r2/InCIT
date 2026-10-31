"""Quick script to test solver, validate, and export."""
import urllib.request
import json
import sys

BASE = "http://localhost:8000/api"

def api(endpoint, method="GET", body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        f"{BASE}{endpoint}",
        data=data,
        headers={"Content-Type": "application/json"} if data else {},
        method=method,
    )
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.loads(r.read())

# 1. Health check
print("=== Health Check ===")
h = api("/health")
print(h)

# 2. Dashboard stats (before)
print("\n=== Dashboard (before solver) ===")
d = api("/dashboard")
print(f"  Sessions: {d['total_sessions']}, Rooms: {d['total_rooms']}, Faculty: {d['total_faculty']}")
print(f"  Timetable status: {d['timetable_status']}")

# 3. Run solver
print("\n=== Running Solver (120s limit, 8 workers) ===")
sol = api("/solver/generate", "POST", {"time_limit_seconds": 120, "num_workers": 8})
print(f"  Status: {sol['status']}")
print(f"  Assignments: {len(sol['assignments'])}")
print(f"  Violations: {sol['violations']}")
stats = sol.get("stats", {})
for k, v in stats.items():
    print(f"  {k}: {v}")

# 4. Dashboard stats (after)
print("\n=== Dashboard (after solver) ===")
d2 = api("/dashboard")
print(f"  Scheduled: {d2['scheduled_sessions']}/{d2['total_sessions']}")
print(f"  Hard violations: {d2['hard_violations']}, Soft penalty: {d2['soft_penalty']}")

# 5. Run validation
print("\n=== Validation ===")
val = api("/validate")
print(f"  Hard violation count: {val['hard_violation_count']}")
print(f"  Soft total: {val['soft_total']}")
if val['hard_by_rule']:
    for rule, count in val['hard_by_rule'].items():
        print(f"    {rule}: {count}")
if val['warnings']:
    for w in val['warnings'][:5]:
        print(f"    WARNING: {w}")

# 6. Export schedule.json
print("\n=== Export schedule.json ===")
exp = api("/export/save?filename=schedule.json", "POST")
print(f"  {exp}")

# 7. Process fest-week bookings
print("\n=== Fest Week / Spectra ===")
fw = api("/fest-week")
if fw.get("fest_week") and fw["fest_week"].get("bookings"):
    bookings = fw["fest_week"]["bookings"]
    approved = sum(1 for b in bookings if b["status"] == "approved")
    rejected = sum(1 for b in bookings if b["status"] == "rejected")
    alt = sum(1 for b in bookings if b["status"] == "alternative_offered")
    print(f"  Total: {len(bookings)}, Approved: {approved}, Rejected: {rejected}, Alternatives: {alt}")
else:
    print(f"  Status: {fw.get('status', 'unknown')}")

# 8. Apply sample disruption  
print("\n=== Apply Disruption (room maintenance) ===")
try:
    dis = api("/disruption/apply", "POST", {"changes": [
        {"type": "room_unavailable", "room_id": "R01", "days": ["MON"], "periods": [1,2,3], "reason": "Maintenance"}
    ]})
    print(f"  {dis}")
except Exception as e:
    print(f"  Error: {e}")

# 9. Re-solve after disruption
print("\n=== Re-solve after disruption ===")
sol2 = api("/solver/generate", "POST", {"time_limit_seconds": 120, "num_workers": 8})
print(f"  Status: {sol2['status']}, Assignments: {len(sol2['assignments'])}")

# 10. Export schedule_after.json
print("\n=== Export schedule_after.json ===")
exp2 = api("/export/save?filename=schedule_after.json", "POST")
print(f"  {exp2}")

# 11. Final validation
print("\n=== Final Validation ===")
val2 = api("/validate")
print(f"  Hard violations: {val2['hard_violation_count']}, Soft: {val2['soft_total']}")

# 12. Audit trail
print("\n=== Audit Trail (last 10) ===")
audit = api("/audit?limit=10")
for entry in audit[:10]:
    print(f"  [{entry['timestamp']}] {entry['action']} - {entry['entity_type']}/{entry['entity_id']}")

print("\n=== ALL DONE ===")
