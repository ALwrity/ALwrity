"""Persistence helpers for the explicit daily meeting lifecycle."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from models.daily_meeting_models import DailyMeeting


def start_daily_meeting(
    db: Any,
    user_id: str,
    meeting_date: str,
    source: str = "scheduled",
    tenant_timezone: Optional[str] = None,
) -> Optional[DailyMeeting]:
    if db is None:
        return None
    try:
        meeting = DailyMeeting(
            meeting_id=f"meeting-{uuid.uuid4().hex}",
            user_id=user_id,
            meeting_date=meeting_date,
            source=source,
            status="running",
            tenant_timezone=tenant_timezone,
            started_at=datetime.utcnow(),
        )
        db.add(meeting)
        db.commit()
        db.refresh(meeting)
        return meeting
    except Exception:
        db.rollback()
        return None


def finish_daily_meeting(
    db: Any,
    meeting: Optional[DailyMeeting],
    status: str,
    result: Optional[Dict[str, Any]] = None,
    error_message: Optional[str] = None,
) -> None:
    if db is None or meeting is None:
        return
    result = result or {}
    try:
        meeting.status = status
        meeting.completed_at = datetime.utcnow()
        meeting.preflight_json = result.get("meeting_preflight")
        meeting.schedule_json = result.get("schedule_decisions")
        meeting.evidence_json = result.get("agent_evidence")
        meeting.proposal_review_json = result.get("proposal_review")
        meeting.guardian_review_json = result.get("guardian_review")
        meeting.prioritization_json = result.get("prioritization")
        meeting.limitations_json = result.get("limitations")
        meeting.final_task_ids = result.get("final_task_ids")
        meeting.error_message = error_message
        db.add(meeting)
        db.commit()
    except Exception:
        db.rollback()


def attach_daily_meeting_tasks(db: Any, meeting_id: Optional[str], plan_id: int) -> None:
    """Attach persisted workflow task ids after the plan transaction completes."""
    if db is None or not meeting_id:
        return
    try:
        from models.daily_workflow_models import DailyWorkflowTask

        meeting = db.query(DailyMeeting).filter(DailyMeeting.meeting_id == meeting_id).first()
        if meeting is None:
            return
        task_ids = [row.id for row in db.query(DailyWorkflowTask.id).filter(DailyWorkflowTask.plan_id == plan_id).all()]
        meeting.final_task_ids = task_ids
        db.add(meeting)
        db.commit()
    except Exception:
        db.rollback()
