"""
Monitoring Bridge — ORM to deterministic executor adapter (Phase 3a).

Purpose:
    Connect the scheduler's ORM-based ``MonitoringTaskExecutor`` to the
    deterministic ``MonitoringExecutor`` (``services/monitoring_executor.py``)
    so scheduled runs execute REAL tools instead of simulated values.

Design principles:
    - Non-blocking: scheduler already dispatches each task as its own
      ``asyncio.Task`` (see ``scheduler._process_task_type``); this bridge
      never blocks the event loop with sync I/O — sync service calls are
      offloaded via ``asyncio.to_thread``.
    - Fail-fast: no mocks, no fallbacks, no ``{"stub": True}`` swallowing.
      Any tool error, missing registry entry, or ``error`` key in the
      result raises ``MonitoringBridgeError`` so failures surface in
      ``TaskExecutionLog`` and the dashboard instead of fake green data.
    - Structured logging: every log line carries user_id / task_id /
      metric / tool / execution_time_ms via ``get_service_logger``.

Modularity:
    New file — does not bloat ``monitoring_task_executor.py`` (374 lines).
    The old executor delegates its ``_execute_alwrity_task`` here and keeps
    only human-alert handling locally.
"""

import asyncio
import time
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from services.monitoring_metrics import ALLOWED_METRICS, TOOL_REGISTRY
from utils.logger_utils import get_service_logger

logger = get_service_logger("monitoring_bridge")


class MonitoringBridgeError(Exception):
    """Raised when a real tool execution fails. Never swallowed."""

    def __init__(self, message: str, *, task_id: Any = None,
                 metric: Optional[str] = None, tool: Optional[str] = None):
        super().__init__(message)
        self.task_id = task_id
        self.metric = metric
        self.tool = tool


class MonitoringBridgeNotExecutable(MonitoringBridgeError):
    """Raised when a task must not run on real tools (Human / unknown metric)."""


def orm_to_task_dict(task: Any) -> Dict[str, Any]:
    """Convert a ``MonitoringTask`` ORM row to the dict shape expected by
    ``MonitoringExecutor.execute_task``.

    Args:
        task: ORM instance with ``task_title``, ``metric``,
            ``measurement_method``, ``assignee``, etc.

    Returns:
        Dict with keys ``title``, ``metric``, ``tool``,
        ``measurementMethod``, ``assignee``, ``frequency``,
        ``component``, ``description``, ``successCriteria``,
        ``alertThreshold``.
    """
    tool_path = getattr(task, "measurement_method", None)
    return {
        "title": getattr(task, "task_title", "unknown"),
        "description": getattr(task, "task_description", ""),
        "assignee": getattr(task, "assignee", ""),
        "frequency": getattr(task, "frequency", "Weekly"),
        "metric": getattr(task, "metric", ""),
        "measurementMethod": tool_path,
        "tool": tool_path,
        "component": getattr(task, "component_name", "General"),
        "successCriteria": getattr(task, "success_criteria", ""),
        "alertThreshold": getattr(task, "alert_threshold", ""),
    }


def load_strategy_data(task: Any, db: Session) -> Dict[str, Any]:
    """Build the ``strategy_data`` dict for tool dispatch from the task's
    strategy relationship (or a fresh DB lookup if detached).

    Only reads columns the deterministic tools need: website URL,
    content pillars, competitive analysis, business goals, strategy id.

    Raises:
        MonitoringBridgeError: if no strategy row can be resolved.
    """
    strategy = getattr(task, "strategy", None)
    strategy_id = getattr(task, "strategy_id", None)

    if strategy is None and strategy_id is not None and db is not None:
        try:
            from models.enhanced_strategy_models import EnhancedContentStrategy
            strategy = db.query(EnhancedContentStrategy).filter(
                EnhancedContentStrategy.id == strategy_id
            ).first()
        except Exception as exc:
            raise MonitoringBridgeError(
                f"Failed to load strategy {strategy_id}: {exc}",
                task_id=getattr(task, "id", None),
            ) from exc

    if strategy is None:
        raise MonitoringBridgeError(
            f"No strategy found for task {getattr(task, 'id', None)} "
            f"(strategy_id={strategy_id})",
            task_id=getattr(task, "id", None),
        )

    def _pick(*names: str, default: Any = None) -> Any:
        for name in names:
            value = getattr(strategy, name, None)
            if value:
                return value
        return default

    competitive = (
        _pick("competitive_analysis", default={}) or {}
    )
    if not isinstance(competitive, dict):
        competitive = {}

    return {
        "id": getattr(strategy, "id", strategy_id),
        "website_url": _pick("website_url", "website", "site_url",
                             default=""),
        "content_pillars": _pick("content_pillars", "pillars", default=[]) or [],
        "business_goals": _pick("business_goals", default=[]) or [],
        "competitive_analysis": competitive,
    }


def _fail_if_stub_result(result_data: Any, *, task_id: Any,
                         metric: Optional[str], tool: Optional[str]) -> None:
    """Fail fast on stub/error payloads.

    The legacy ``MonitoringExecutor._exec_*`` helpers return
    ``{"error": ..., "stub": True}`` when the underlying service raises.
    That pattern hides outages behind fake data — Phase 3 forbids it.
    Any ``error`` key or ``stub`` flag raises immediately.
    """
    if not isinstance(result_data, dict):
        return
    if result_data.get("stub") is True or "error" in result_data:
        raise MonitoringBridgeError(
            f"Tool {tool} failed for metric {metric}: "
            f"{result_data.get('error', 'stub result rejected')}",
            task_id=task_id, metric=metric, tool=tool,
        )


async def execute_alwrity_orm(task: Any, db: Session,
                              user_id: Any) -> Dict[str, Any]:
    """Execute an ALwrity ORM monitoring task on REAL tools.

    Steps:
        1. Convert ORM row to task dict (``orm_to_task_dict``).
        2. Reject Human tasks and unregistered metrics (fail fast).
        3. Load strategy context (``load_strategy_data``).
        4. Dispatch via ``MonitoringExecutor`` — the executor's internal
           sync service calls run inside ``asyncio.to_thread`` so the
           scheduler event loop is never blocked.
        5. Reject stub/error payloads; return raw tool result on success.

    Args:
        task: ``MonitoringTask`` ORM instance.
        db: Per-task SQLAlchemy session (owned by caller).
        user_id: Clerk user id string for user-scoped tools (GSC, etc.).

    Returns:
        Raw tool result dict (never wrapped in stub/error envelope).

    Raises:
        MonitoringBridgeNotExecutable: Human assignee or metric outside
            ``ALLOWED_METRICS`` / ``TOOL_REGISTRY``.
        MonitoringBridgeError: any tool failure, stub payload, or
            non-success executor status.
    """
    task_id = getattr(task, "id", None)
    task_dict = orm_to_task_dict(task)
    metric = task_dict.get("metric", "")
    tool_path = task_dict.get("tool") or task_dict.get("measurementMethod")

    start = time.time()
    logger.info(
        f"[Bridge] ▶ start task_id={task_id} user_id={user_id} "
        f"metric={metric} tool={tool_path}"
    )

    # Human tasks never run tools — caller routes them to alert handling.
    if task_dict.get("assignee") != "ALwrity":
        raise MonitoringBridgeNotExecutable(
            f"Task {task_id} assignee={task_dict.get('assignee')} "
            f"is not ALwrity — skipping real execution",
            task_id=task_id, metric=metric, tool=tool_path,
        )

    # Deterministic allow-list: unknown metrics are a code bug, not a skip.
    if metric not in ALLOWED_METRICS:
        raise MonitoringBridgeNotExecutable(
            f"Task {task_id} metric={metric!r} not in ALLOWED_METRICS",
            task_id=task_id, metric=metric, tool=tool_path,
        )
    resolved_tool = TOOL_REGISTRY.get(metric) or tool_path
    if not resolved_tool or resolved_tool == "manual.human_review":
        raise MonitoringBridgeNotExecutable(
            f"Task {task_id} metric={metric!r} has no registered real tool",
            task_id=task_id, metric=metric, tool=tool_path,
        )
    if metric not in TOOL_REGISTRY:
        raise MonitoringBridgeNotExecutable(
            f"Task {task_id} metric={metric!r} missing from TOOL_REGISTRY "
            f"(add a real tool mapping — no stub allowed)",
            task_id=task_id, metric=metric, tool=tool_path,
        )

    strategy_data = load_strategy_data(task, db)
    if not strategy_data.get("website_url"):
        logger.warning(
            f"[Bridge] task_id={task_id} user_id={user_id} metric={metric} "
            f"has no website_url — tools may fail fast"
        )

    from services.monitoring_executor import MonitoringExecutor
    executor = MonitoringExecutor()

    # Non-blocking: run the executor coroutine in a worker thread via
    # to_thread + a dedicated runner so sync SDK calls inside _exec_*
    # (GSCService, Exa, advertools) never stall the scheduler loop.
    def _run_in_thread() -> Dict[str, Any]:
        return asyncio.run(
            executor.execute_task(task_dict, strategy_data,
                                  str(user_id) if user_id else None)
        )

    try:
        outcome: Dict[str, Any] = await asyncio.to_thread(_run_in_thread)
    except Exception as exc:
        elapsed = int((time.time() - start) * 1000)
        logger.error(
            f"[Bridge] ✖ dispatch crashed task_id={task_id} user_id={user_id} "
            f"metric={metric} tool={resolved_tool} ms={elapsed} err={exc}"
        )
        raise MonitoringBridgeError(
            f"Dispatch crashed for task {task_id} metric={metric}: {exc}",
            task_id=task_id, metric=metric, tool=resolved_tool,
        ) from exc

    elapsed = int((time.time() - start) * 1000)
    status = outcome.get("status")

    if status == "skipped":
        raise MonitoringBridgeNotExecutable(
            f"Executor skipped task {task_id} metric={metric}: "
            f"{outcome.get('reason', 'not executable')}",
            task_id=task_id, metric=metric, tool=resolved_tool,
        )
    if status != "success":
        raise MonitoringBridgeError(
            f"Tool {resolved_tool} failed for task {task_id} "
            f"metric={metric}: {outcome.get('error_message', status)}",
            task_id=task_id, metric=metric, tool=resolved_tool,
        )

    result_data = outcome.get("result_data", {})
    _fail_if_stub_result(result_data, task_id=task_id,
                         metric=metric, tool=resolved_tool)

    logger.info(
        f"[Bridge] ✔ done task_id={task_id} user_id={user_id} "
        f"metric={metric} tool={resolved_tool} ms={elapsed} "
        f"at={datetime.utcnow().isoformat()}"
    )
    return result_data
