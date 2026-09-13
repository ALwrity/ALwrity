"""Strategy-monitoring evidence for agent meetings (Phase 1).

Builds a truthful, DB-derived envelope of the user's ACTIVE content-strategy
monitoring health so the daily committee can ground proposals in real
signals (failed tasks, overdue runs, human reviews) instead of filler.

Design contract:
  - One active strategy per user (``StrategyActivationStatus.status ==
    'active'``, latest activation wins). No active strategy -> ``inactive``
    envelope, never fabricated data.
  - Per-task latest ``TaskExecutionLog`` (MAX execution_date) drives all
    signals. A task may have zero logs -> contributes to ``overdue``/``byResult
    never_run`` counts, never a fake value.
  - Fail-fast on DB errors: return ``{status: 'error'}` with a limitation and
    structured logging — never raise into the meeting flow.
  - Reads are user-scoped, bounded, and run on the caller's existing session
    (no new scheduler/network dependency; meeting stays non-blocking).

Envelope shape:
    {
      "status": "inactive" | "error" | "available",
      "strategy_id": int | None,
      "overall": "healthy" | "degraded" | "down" | None,
      "success_rate": float | None,
      "byResult": {status: count, ...},
      "failed_tasks": [ {id, title, metric, error_message, last_executed} ... ],
      "overdue_tasks": [ {id, title, metric, frequency, next_execution} ... ],
      "human_pending": [ {id, title, metric, frequency} ... ],
      "last_executed": str | None,
      "generated_at": str,
      "kpi_last_values": {metric: float, ...},  # real measured values from success tool results
      "limitations": [str, ...],
      "tasks": [ {id, title, metric, assignee, status, lastResult, lastExecuted} ... ],
    }
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import desc
from sqlalchemy.orm import Session

from models.monitoring_models import (
    MonitoringTask,
    TaskExecutionLog,
)
from services.strategy_common import resolve_active_strategy
from utils.logger_utils import get_service_logger

logger = get_service_logger("monitoring_evidence")

# Same failure-ratio rule as the monitoring-health API: >= 50% failed
# latest runs marks the strategy "down".
_DOWN_RATIO = 0.5


def _iso(dt: Any) -> Optional[str]:
    return dt.isoformat() if dt is not None else None


def _empty_envelope(status: str, limitation: Optional[str] = None) -> Dict[str, Any]:
    envelope: Dict[str, Any] = {
        "status": status,
        "strategy_id": None,
        "overall": None,
        "success_rate": None,
        "byResult": {},
        "failed_tasks": [],
        "overdue_tasks": [],
        "human_pending": [],
        "last_executed": None,
        "generated_at": datetime.utcnow().isoformat(),
        "kpi_last_values": {},
        "tasks": [],
    }
    if limitation:
        envelope["limitations"] = [limitation]
    else:
        envelope["limitations"] = []
    return envelope


def _latest_logs_by_task(
    db: Session, task_ids: List[int], user_id: str
) -> Dict[int, TaskExecutionLog]:
    """Fetch the single most recent TaskExecutionLog per task id."""
    if not task_ids:
        return {}
    rows = (
        db.query(TaskExecutionLog)
        .filter(TaskExecutionLog.task_id.in_(task_ids))
        .order_by(desc(TaskExecutionLog.execution_date))
        .all()
    )
    latest: Dict[int, TaskExecutionLog] = {}
    for log in rows:
        if log.task_id not in latest:
            latest[log.task_id] = log
    return latest


def _build_available_envelope(
    strategy_id: int, tasks: List[MonitoringTask],
    latest_logs: Dict[int, TaskExecutionLog], now: datetime,
) -> Dict[str, Any]:
    """Enrich the envelope from real task + log rows (pure, testable)."""
    from services.kpi_value_extractor import extract_metric_value

    failed_tasks: List[Dict[str, Any]] = []
    overdue_tasks: List[Dict[str, Any]] = []
    human_pending: List[Dict[str, Any]] = []
    by_result: Dict[str, int] = {}
    latest_statuses: List[str] = []
    last_executed: Optional[str] = None
    task_summaries: List[Dict[str, Any]] = []
    kpi_last_values: Dict[str, float] = {}

    for task in tasks:
        log = latest_logs.get(task.id)
        last_result = log.status if log else None
        last_exec = None
        if log:
            last_exec = _iso(log.execution_date)
            latest_statuses.append(log.status)
            by_result[log.status] = by_result.get(log.status, 0) + 1
            if last_exec and (last_executed is None or last_exec > last_executed):
                last_executed = last_exec
            if log.status == "failed":
                failed_tasks.append({
                    "id": task.id,
                    "title": task.task_title,
                    "metric": task.metric,
                    "error_message": log.error_message,
                    "last_executed": last_exec,
                })
            # Real measured KPI value from a SUCCESS run's tool result only.
            if log.status == "success" and task.metric:
                result_data = log.result_data if isinstance(log.result_data, dict) else {}
                value = extract_metric_value(result_data.get("tool_result"), task.metric)
                if value is not None:
                    kpi_last_values[str(task.metric).lower()] = value
        else:
            by_result["never_run"] = by_result.get("never_run", 0) + 1

        if (
            task.next_execution is not None
            and task.next_execution < now
        ):
            overdue_tasks.append({
                "id": task.id,
                "title": task.task_title,
                "metric": task.metric,
                "frequency": task.frequency,
                "next_execution": _iso(task.next_execution),
            })

        if (
            task.assignee == "Human"
            and task.status in ("active", "pending")
        ):
            human_pending.append({
                "id": task.id,
                "title": task.task_title,
                "metric": task.metric,
                "frequency": task.frequency,
                "status": task.status,
            })

        task_summaries.append({
            "id": task.id,
            "title": task.task_title,
            "metric": task.metric,
            "assignee": task.assignee,
            "status": task.status,
            "lastResult": last_result,
            "lastExecuted": last_exec,
        })

    # overall: no latest runs -> degraded; >=50% failed -> down;
    # any failure or overdue -> degraded; else healthy.
    if not latest_statuses:
        overall = "degraded"
    elif latest_statuses.count("failed") / len(latest_statuses) >= _DOWN_RATIO:
        overall = "down"
    elif "failed" in latest_statuses or overdue_tasks:
        overall = "degraded"
    else:
        overall = "healthy"

    succeeded = latest_statuses.count("success")
    return {
        "status": "available",
        "strategy_id": strategy_id,
        "overall": overall,
        "success_rate": round(succeeded / len(latest_statuses), 3)
        if latest_statuses else None,
        "byResult": by_result,
        "failed_tasks": failed_tasks,
        "overdue_tasks": overdue_tasks,
        "human_pending": human_pending,
        "last_executed": last_executed,
        "generated_at": now.isoformat(),
        "kpi_last_values": kpi_last_values,
        "limitations": [],
        "tasks": task_summaries,
    }


def build_strategy_monitoring_evidence(
    db: Any, user_id: str
) -> Dict[str, Any]:
    """Build the strategy-monitoring evidence envelope for a user.

    Args:
        db: SQLAlchemy session (the meeting's own session — bounded reads).
        user_id: Scoped user id (Clerk string).

    Returns:
        Envelope dict. Never raises: DB errors degrade to ``{status: 'error'}`
        with a structured log + limitation.
    """
    now = datetime.utcnow()
    try:
        strategy_id = resolve_active_strategy(db, user_id)
        if strategy_id is None:
            logger.info(
                f"[monitoring_evidence] user_id={user_id} strategy=inactive "
                f"(no active strategy)"
            )
            return _empty_envelope("inactive")

        tasks = (
            db.query(MonitoringTask)
            .filter(MonitoringTask.strategy_id == strategy_id)
            .all()
        )
        if not tasks:
            logger.info(
                f"[monitoring_evidence] user_id={user_id} strategy_id={strategy_id} "
                f"tasks=0 (no monitoring tasks)"
            )
            env = _empty_envelope("available")
            env["strategy_id"] = strategy_id
            return env

        task_ids = [t.id for t in tasks]
        latest_logs = _latest_logs_by_task(db, task_ids, user_id)
        envelope = _build_available_envelope(
            strategy_id, tasks, latest_logs, now
        )
        logger.info(
            f"[monitoring_evidence] user_id={user_id} strategy_id={strategy_id} "
            f"tasks={len(tasks)} overall={envelope['overall']} "
            f"success_rate={envelope['success_rate']} "
            f"failed={len(envelope['failed_tasks'])} "
            f"overdue={len(envelope['overdue_tasks'])} "
            f"human_pending={len(envelope['human_pending'])}"
        )
        return envelope
    except Exception as exc:
        logger.error(
            f"[monitoring_evidence] user_id={user_id} db_error={exc!r}",
            exc_info=True,
        )
        return _empty_envelope("error", f"Monitoring evidence could not be loaded: {exc}")