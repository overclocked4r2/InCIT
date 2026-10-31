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
        self._assignments: dict[str, dict] = {}
        self._fest_week: dict | None = None
        self._exams: list[dict] = []
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

    @property
    def assignments(self) -> dict[str, dict]:
        return self._assignments

    @assignments.setter
    def assignments(self, assignments: dict[str, dict]):
        self._check_timetable(list(assignments.values()))
        self._assignments = assignments

    @property
    def fest_week(self) -> dict | None:
        return self._fest_week

    @fest_week.setter
    def fest_week(self, fest_week: dict | None):
        self._check_full_schedule(fest_week=fest_week)
        self._fest_week = fest_week

    @property
    def exams(self) -> list[dict]:
        return self._exams

    @exams.setter
    def exams(self, exams: list[dict]):
        self._check_full_schedule(exams=exams)
        self._exams = exams

    def _check_timetable(self, assignments: list[dict]):
        """Reject an invalid schedule before it enters mutable application state."""
        if not assignments or self.dataset is None:
            return
        from .validator_bridge import check_timetable

        violations = check_timetable(assignments, self.dataset)
        if violations:
            self.validation_report = {
                "hard_violations": violations,
                "hard_violation_count": len(violations),
                "hard_by_rule": {},
            }
            raise ValueError(f"Timetable rejected by validity gate: {violations[0]['detail']}")

    def _check_full_schedule(self, *, fest_week: dict | None = None, exams: list[dict] | None = None):
        """Reject invalid booking or exam changes once a dataset and timetable exist."""
        if self.dataset is None or not self._assignments:
            return
        from .validator_bridge import run_validation

        schedule = self.export_schedule()
        if fest_week is not None:
            schedule["fest_week"] = fest_week
        if exams is not None:
            schedule["exams"] = exams
        report = run_validation(self.dataset, schedule)
        if report["hard_violation_count"]:
            self.validation_report = report
            raise ValueError(f"Schedule change rejected by validity gate: {report['hard_violations'][0]['detail']}")
    
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
        candidate = dict(self.assignments)
        candidate[session_id] = {
            "session_id": session_id,
            "day": new_day,
            "start_period": new_start,
            "room_id": new_room,
        }
        self.assignments = candidate
        self.add_audit("session_rescheduled", "session", session_id,
                       details={"old": old, "new": self.assignments[session_id]})

    def propose_reschedule(self, session_id: str, new_day: str, new_start: int,
                           new_room: str, reason: str) -> dict:
        """Store a proposed move without changing the published timetable."""
        old = self.assignments[session_id].copy()
        proposal = {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "status": "pending",
            "reason": reason,
            "old": old,
            "new": {
                "session_id": session_id,
                "day": new_day,
                "start_period": new_start,
                "room_id": new_room,
            },
            "changes": [{
                "session_id": session_id,
                "old": old,
                "new": {
                    "session_id": session_id,
                    "day": new_day,
                    "start_period": new_start,
                    "room_id": new_room,
                },
                "reason": reason,
            }],
            "timestamp": datetime.now().isoformat(),
        }
        self.reschedule_requests.append(proposal)
        self.add_audit("reschedule_proposed", "session", session_id,
                       details={"request_id": proposal["id"], "old": old, "new": proposal["new"], "reason": reason})
        return proposal

    def decide_reschedule(self, request_id: str, decision: str, *, actor: str,
                          comments: str = "") -> dict:
        """Approve or reject one pending proposal; approval passes the validity gate first."""
        proposal = next((item for item in self.reschedule_requests if item["id"] == request_id), None)
        if proposal is None:
            raise KeyError("Reschedule proposal not found.")
        if proposal["status"] != "pending":
            raise ValueError(f"Reschedule proposal is already {proposal['status']}.")
        if decision not in {"approved", "rejected"}:
            raise ValueError("Decision must be 'approved' or 'rejected'.")

        if decision == "approved":
            # The assignments setter runs the deterministic validity gate before
            # this proposal is marked approved or any timetable data is changed.
            candidate = dict(self.assignments)
            candidate[proposal["session_id"]] = proposal["new"]
            self.assignments = candidate

        proposal["status"] = decision
        proposal["decided_at"] = datetime.now().isoformat()
        proposal["decided_by"] = actor
        if decision == "approved":
            proposal["approved_by"] = actor
        proposal["comments"] = comments
        self.add_audit(
            f"reschedule_{decision}", "session", proposal["session_id"], actor=actor,
            details={"request_id": request_id, "old": proposal["old"], "new": proposal["new"], "comments": comments},
        )
        return proposal
    
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
