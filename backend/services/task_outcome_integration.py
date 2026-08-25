"""Integration helpers for recording execution outcomes in task memory."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any, Dict


async def record_failed_execution_outcome(
    user_id: str,
    task: Any,
    db: Any,
    execution_result: Dict[str, Any],
) -> Dict[str, Any]:
    """Record failure history without changing the task's retryable status."""
    from services.task_memory_service import TaskMemoryService

    metadata = dict(task.metadata_json) if isinstance(task.metadata_json, dict) else {}
    metadata["execution_result"] = dict(execution_result)
    failed_task = SimpleNamespace(
        title=task.title,
        description=task.description,
        pillar_id=task.pillar_id,
        workflow_type=getattr(task, "workflow_type", "main"),
        created_at=getattr(task, "created_at", None),
        status="failed",
        metadata_json=metadata,
    )
    return await TaskMemoryService(user_id, db).record_task_outcome(
        failed_task,
        feedback_score=0,
        feedback_text=str(execution_result.get("error") or "Execution failed")[:4000],
    )
