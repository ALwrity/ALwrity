"""Monitoring health + schedule API (Phase 3b).

New module — kept out of ``monitoring_routes.py`` (781 lines) on purpose.

Endpoints (mounted under ``/api/content-planning`` via ``api/router.py``):
    GET   /strategy/{strategy_id}/monitoring-health
    PATCH /strategy/{strategy_id}/tasks/{task_id}

Contracts (fail-fast, no mocks):
    - Health is derived ONLY from ``TaskExecutionLog`` rows. No synthetic
      values, no default-healthy fallbacks.
    - ``404`` when the strategy / task / logs do not exist. The frontend
      maps ``404/no-logs`` to an info state ("scheduled, awaiting first
      run") — not an error banner.
    - Schedule edits accept ONLY ``frequency`` (Daily/Weekly/Monthly/
      Quarterly allow-list) and ``status`` (active/paused). Anything else
      is ``400``. Metric/tool edits are rejected to protect the
      deterministic ``TOOL_REGISTRY`` mapping from hallucinations.

Non-blocking / robustness:
    - Read-only aggregate queries with ``limit`` caps; no scheduler calls
      from request handlers. The scheduler picks up ``next_execution``
      changes on its next check cycle on its own thread.
    - Pause sets ``status='paused'`` which ``load_due_monitoring_tasks``
      already excludes (it selects ``status == 'active'`` only), so no
      loader change is needed. Resume flips back to ``active`` and
      recalculates ``next_execution`` from now.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from models.enhanced_strategy_models import EnhancedContentStrategy
from models.monitoring_models import MonitoringTask, TaskExecutionLog
from services.database import get_db
from services.monitoring_metrics import ALLOWED_FREQUENCIES
from services.scheduler.utils.frequency_calculator import (
    calculate_next_execution,
)
from utils.logger_utils import get_service_logger

logger = get_service_logger("monitoring_health")

router = APIRouter(prefix="/strategy", tags=["strategy-monitoring-health"])

# Task-level statuses the schedule editor may set. 'paused' is excluded by
# load_due_monitoring_tasks (active-only filter); 'active' re-arms the task.
EDITABLE_STATUSES = {"active", "paused"}

# Overall health thresholds over per-task latest results.
# down: half or more of executed tasks last failed. degraded: any failure
# or any overdue task. healthy: zero failures, nothing overdue.
_DOWN_RATIO = 0.5


def derive_overall_status(latest_statuses: List[str],
                          overdue_count: int) -> str:
    """Derive overall health from per-task latest execution statuses.

    Args:
        latest_statuses: Latest ``TaskExecutionLog.status`` per executed
            task (values: success/failed/skipped/running).
        overdue_count: Tasks with ``next_execution`` in the past.

    Returns:
        One of ``healthy`` / ``degraded`` / ``down``.
    """
    if not latest_statuses:
        return "degraded"
    failed = sum(1 for s in latest_statuses if s == "failed")
    if failed / len(latest_statuses) >= _DOWN_RATIO:
        return "down"
    if failed > 0 or overdue_count > 0:
        return "degraded"
    return "healthy"


def validate_schedule_patch(
    payload: Dict[str, Any],
) -> Dict[str, Optional[str]]:
    """Validate a schedule-edit body. Fail fast on anything unexpected.

    Args:
        payload: Raw JSON body, e.g. ``{"frequency": "Daily"}``.

    Returns:
        Dict with ``frequency`` / ``status`` (None when not provided).

    Raises:
        HTTPException 400: unknown keys, unlisted frequency, or a status
            outside ``EDITABLE_STATUSES``.
    """
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Body must be a JSON object")
    unknown = set(payload) - {"frequency", "status"}
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Only 'frequency' and 'status' are editable, got: {sorted(unknown)}",
        )
    frequency = payload.get("frequency")
    status = payload.get("status")
    if frequency is not None and frequency not in ALLOWED_FREQUENCIES:
        raise HTTPException(
            status_code=400,
            detail=f"frequency must be one of {sorted(ALLOWED_FREQUENCIES)}",
        )
    if status is not None and status not in EDITABLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"status must be one of {sorted(EDITABLE_STATUSES)}",
        )
    if frequency is None and status is None:
        raise HTTPException(
            status_code=400, detail="Provide at least one of 'frequency', 'status'"
        )
    return {"frequency": frequency, "status": status}


def build_health_response(strategy_id: int, tasks: List[MonitoringTask],
                          latest_by_task: Dict[int, TaskExecutionLog],
                          now: datetime) -> Dict[str, Any]:
    """Aggregate per-task rows + latest logs into the health payload.

    Pure function (no DB) so it is unit-testable. All timestamps are
    ISO strings or None — never fabricated.
    """
    task_entries = []
    latest_statuses: List[str] = []
    overdue = 0
    last_executed: Optional[str] = None

    for task in tasks:
        log = latest_by_task.get(task.id)
        if log is not None:
            latest_statuses.append(log.status)
            executed_at = log.execution_date.isoformat() if log.execution_date else None
            if executed_at and (last_executed is None or executed_at > last_executed):
                last_executed = executed_at
        next_iso = task.next_execution.isoformat() if task.next_execution else None
        if task.next_execution is not None and task.next_execution < now:
            overdue += 1
        task_entries.append({
            "id": task.id,
            "title": task.task_title,
            "metric": task.metric,
            "frequency": task.frequency,
            "assignee": task.assignee,
            "status": task.status,
            "lastExecuted": log.execution_date.isoformat() if log and log.execution_date else None,
            "lastResult": log.status if log else None,
            "lastError": log.error_message if log else None,
            "nextExecution": next_iso,
        })

    by_status: Dict[str, int] = {}
    for entry in task_entries:
        key = entry["lastResult"] or "never_run"
        by_status[key] = by_status.get(key, 0) + 1

    executed = len(latest_statuses)
    succeeded = sum(1 for s in latest_statuses if s == "success")
    return {
        "strategy_id": strategy_id,
        "status": derive_overall_status(latest_statuses, overdue),
        "totalTasks": len(tasks),
        "executedTasks": executed,
        "successRate": round(succeeded / executed, 3) if executed else None,
        "overdueCount": overdue,
        "byResult": by_status,
        "lastExecuted": last_executed,
        "tasks": task_entries,
        "generatedAt": now.isoformat(),
    }


def _get_strategy_or_404(strategy_id: int, db: Session) -> EnhancedContentStrategy:
    strategy = db.query(EnhancedContentStrategy).filter(
        EnhancedContentStrategy.id == strategy_id
    ).first()
    if not strategy:
        logger.warning(f"[Health] strategy_id={strategy_id} not found")
        raise HTTPException(status_code=404, detail="Strategy not found")
    return strategy


@router.get("/{strategy_id}/monitoring-health")
async def get_monitoring_health(strategy_id: int,
                                db: Session = Depends(get_db)):
    """Aggregate monitoring health for a strategy from real execution logs.

    404 contract: strategy missing, no monitoring tasks, or no execution
    logs yet (frontend shows "scheduled, awaiting first run" info state).
    """
    _get_strategy_or_404(strategy_id, db)

    tasks = db.query(MonitoringTask).filter(
        MonitoringTask.strategy_id == strategy_id
    ).all()
    if not tasks:
        logger.warning(f"[Health] strategy_id={strategy_id} has no monitoring tasks")
        raise HTTPException(status_code=404, detail="No monitoring tasks for strategy")

    task_ids = [t.id for t in tasks]
    logs = (
        db.query(TaskExecutionLog)
        .filter(TaskExecutionLog.task_id.in_(task_ids))
        .order_by(desc(TaskExecutionLog.execution_date))
        .limit(500)
        .all()
    )
    if not logs:
        # Truthful 404 — never a fake healthy payload. Frontend maps this
        # to the "awaiting first run" info state.
        logger.info(f"[Health] strategy_id={strategy_id} tasks={len(tasks)} logs=0 (awaiting first run)")
        raise HTTPException(
            status_code=404,
            detail="No execution logs yet — tasks scheduled, awaiting first run",
        )

    latest_by_task: Dict[int, TaskExecutionLog] = {}
    for log in logs:
        if log.task_id not in latest_by_task:
            latest_by_task[log.task_id] = log

    now = datetime.utcnow()
    data = build_health_response(strategy_id, tasks, latest_by_task, now)
    logger.info(
        f"[Health] strategy_id={strategy_id} status={data['status']} "
        f"tasks={data['totalTasks']} executed={data['executedTasks']} "
        f"successRate={data['successRate']} overdue={data['overdueCount']}"
    )
    return {"success": True, "data": data}


@router.patch("/{strategy_id}/tasks/{task_id}")
async def update_monitoring_task_schedule(
    strategy_id: int,
    task_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    """Edit a monitoring task schedule: frequency and/or active/paused.

    Recalculates ``next_execution`` from now on frequency change or
    resume so the scheduler picks the task up on its next check cycle.
    Metric/tool edits are rejected (400) to protect TOOL_REGISTRY.
    """
    _get_strategy_or_404(strategy_id, db)
    changes = validate_schedule_patch(payload)

    task = db.query(MonitoringTask).filter(MonitoringTask.id == task_id).first()
    if not task or task.strategy_id != strategy_id:
        logger.warning(
            f"[Health] task_id={task_id} not found for strategy_id={strategy_id}"
        )
        raise HTTPException(status_code=404, detail="Monitoring task not found")

    now = datetime.utcnow()
    if changes["frequency"] is not None:
        task.frequency = changes["frequency"]
        task.next_execution = calculate_next_execution(task.frequency, now)
    if changes["status"] is not None:
        task.status = changes["status"]
        if changes["status"] == "active":
            # Re-arm from now so a resumed task runs on schedule, not late.
            task.next_execution = calculate_next_execution(task.frequency, now)
    try:
        db.commit()
        db.refresh(task)
    except Exception as exc:
        db.rollback()
        logger.error(
            f"[Health] save failed task_id={task_id} strategy_id={strategy_id}: {exc}"
        )
        raise HTTPException(status_code=500, detail="Failed to save schedule") from exc

    logger.info(
        f"[Health] schedule updated task_id={task_id} strategy_id={strategy_id} "
        f"frequency={task.frequency} status={task.status} "
        f"next={task.next_execution.isoformat() if task.next_execution else None}"
    )
    return {
        "success": True,
        "data": {
            "id": task.id,
            "frequency": task.frequency,
            "status": task.status,
            "nextExecution": task.next_execution.isoformat() if task.next_execution else None,
        },
    }
