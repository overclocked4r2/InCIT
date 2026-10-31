"""In-memory state manager for the timetable application.

Since this is a hackathon demo app, we keep the generated timetable,
booking decisions, and audit trail in memory for simplicity. The state
can be exported to schedule.json at any time.
"""
from __future__ import annotations
import copy
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any


class AppState:
    """Singleton-ish application state."""
    
    def __init__(self):
        self.reset()
    
    def reset(self):
        """Reset all state."""
        self.timetable_status: str = "not_generated"  # not_generated, generating, draft, published
        self.solver_status: str | None = None
        self.assignments: dict[str, dict] = {}  # session_id -> {session_id, day, start_period, room_id}
        self.fest_week: dict | None = None
        self.exams: list[dict] = []
        self.audit_log: list[dict] = []
        self.reschedule_requests: list[dict] = []
        self.validation_report: dict | None = None
        self.dataset: dict | None = None
        self.disruption_applied: bool = False
        self.disruption_data: dict | None = None
        self.generated_at: str | None = None
        self.published_at: str | None = None
        self.version: int = 0
        self.versions: list[dict] = []  # archived versions
    
    def add_audit(self, action: str, entity_type: str, entity_id: str,
                  actor: str = "system", details: dict | None = None):
        """Append an audit event."""
        self.audit_log.append({
            "id": str(uuid.uuid4()),
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "actor": actor,
            "timestamp": datetime.now().isoformat(),
            "details": details or {},
        })
    
    def set_assignments(self, assignments: list[dict], solver_status: str):
        """Store solver results."""
        self.assignments = {a["session_id"]: a for a in assignments}
        self.solver_status = solver_status
        self.timetable_status = "draft"
        self.version += 1
        self.validation_report = None
        self.generated_at = datetime.now().isoformat()
        self.add_audit("timetable_generated", "timetable", f"v{self.version}",
                       details={"solver_status": solver_status, "sessions": len(assignments)})
    
    def publish(self):
        """Publish the current draft."""
        if self.timetable_status == "draft":
            self.timetable_status = "published"
            self.published_at = datetime.now().isoformat()
            self.add_audit("timetable_published", "timetable", f"v{self.version}")
    
    def archive(self):
        """Archive current version and prepare for new one."""
        if self.timetable_status in ("draft", "published"):
            self.versions.append({
                "version": self.version,
                "status": self.timetable_status,
                "assignments": copy.deepcopy(self.assignments),
                "fest_week": copy.deepcopy(self.fest_week),
                "exams": copy.deepcopy(self.exams),
                "generated_at": self.generated_at,
                "published_at": self.published_at,
            })
            self.timetable_status = "archived"
            self.add_audit("timetable_archived", "timetable", f"v{self.version}")
    
    def apply_reschedule(self, session_id: str, new_day: str, new_start: int, new_room: str):
        """Apply a reschedule to the current assignments."""
        old = self.assignments.get(session_id)
        self.assignments[session_id] = {
            "session_id": session_id,
            "day": new_day,
            "start_period": new_start,
            "room_id": new_room,
        }
        self.add_audit("session_rescheduled", "session", session_id,
                       details={"old": old, "new": self.assignments[session_id]})
    
    def export_schedule(self, team: str = "InCIT", dataset_id: str = "cit-public-v1") -> dict:
        """Export current state as schedule.json format."""
        result: dict[str, Any] = {
            "team": team,
            "dataset_id": dataset_id,
            "sessions": list(self.assignments.values()),
        }
        if self.fest_week:
            result["fest_week"] = self.fest_week
        if self.exams:
            result["exams"] = self.exams
        return result
    
    def save_export(self, path: str | Path, team: str = "InCIT"):
        """Save schedule export to file."""
        data = self.export_schedule(team)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        self.add_audit("schedule_exported", "export", str(path))


# Global singleton
state = AppState()
