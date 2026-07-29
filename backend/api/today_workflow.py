from fastapi import APIRouter, Depends, HTTPException
from typing import Any, Dict, Optional
from datetime import datetime
import json
from enum import Enum
from loguru import logger
from pydantic import BaseModel, Field

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from middleware.auth_middleware import get_current_user
from services.database import get_db
from services.today_workflow_service import get_or_create_daily_workflow_plan, update_task_status, _today_date_str
from models.daily_workflow_models import DailyWorkflowPlan, DailyWorkflowTask
import asyncio


router = APIRouter(prefix="/api/today-workflow", tags=["Today Workflow"])


def _normalize_dependencies(dependencies: Any) -> list:
    if dependencies is None:
        return []
    if isinstance(dependencies, list):
        return dependencies
    if isinstance(dependencies, str):
        try:
            parsed = json.loads(dependencies)
            return parsed if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            return []
    return []


class TaskStatusEnum(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    skipped = "skipped"
    dismissed = "dismissed"


class TaskStatusUpdateRequest(BaseModel):
    status: TaskStatusEnum = Field(..., description="New task status")
    completion_notes: Optional[str] = Field(
        None,
        max_length=4000,
        description="Optional notes about task completion or outcome",
    )

async def _index_tasks_to_sif(user_id: str, date: str, tasks: list[dict], label: str):
    """Index tasks to SIF in background without blocking the main API response."""
    try:
        from services.intelligence.txtai_service import TxtaiIntelligenceService
        svc = TxtaiIntelligenceService(user_id)
        items = []
        for t in tasks:
            task_id = t.get("id")
            pillar_id = t.get("pillarId")
            status = t.get("status")
            title = t.get("title")
            description = t.get("description")
            text = f"[{pillar_id}] {title}\n{description}\nstatus={status}"
            metadata = {
                "type": "daily_workflow_task",
                "date": date,
                "label": label,
                "pillar_id": pillar_id,
                "status": status,
                "implemented": status == "completed",
                "dismissed": status == "skipped",
                "task_id": task_id,
            }
            items.append((f"{label}_task:{user_id}:{date}:{task_id}", text, metadata))
        
        # Index content without blocking - service will initialize in background if needed
        await svc.index_content(items)
    except Exception as e:
        # Log but don't raise - indexing failures shouldn't crash the API
        logger.debug(f"Background indexing failed for user {user_id}: {e}")


def _build_workflow_payload(user_id: str, plan: DailyWorkflowPlan, tasks: list[DailyWorkflowTask]) -> Dict[str, Any]:
    response_tasks = []
    for t in tasks:
        response_tasks.append(
            {
                "id": str(t.id),
                "pillarId": t.pillar_id,
                "title": t.title,
                "description": t.description,
                "status": "skipped" if t.status == "dismissed" else t.status,
                "priority": t.priority,
                "estimatedTime": t.estimated_time,
                "dependencies": _normalize_dependencies(t.dependencies),
                "actionUrl": t.action_url,
                "actionType": t.action_type,
                "metadata": t.metadata_json or {},
                "enabled": bool(t.enabled),
            }
        )

    total = len(response_tasks)
    completed = len([t for t in response_tasks if t["status"] in ("completed", "skipped")])
    current_index = 0
    for i, task in enumerate(response_tasks):
        if task["status"] not in ("completed", "skipped"):
            current_index = i
            break
        current_index = i

    workflow_status = "not_started"
    if completed > 0 and completed < total:
        workflow_status = "in_progress"
    elif total > 0 and completed == total:
        workflow_status = "completed"

    total_estimated = int(sum(int(t.get("estimatedTime") or 0) for t in response_tasks))
    plan_json = plan.plan_json or {}

    prefix = "linkedin" if plan.workflow_type == "linkedin" else "daily"
    return {
        "workflow": {
            "id": f"{prefix}-{user_id}-{plan.date}",
            "date": plan.date,
            "userId": user_id,
            "tasks": response_tasks,
            "currentTaskIndex": current_index,
            "completedTasks": completed,
            "totalTasks": total,
            "workflowStatus": workflow_status,
            "totalEstimatedTime": total_estimated,
            "actualTimeSpent": 0,
        },
        "plan": {
            "id": plan.id,
            "date": plan.date,
            "source": plan.source,
            "generation_mode": plan.generation_mode,
            "committee_agent_count": plan.committee_agent_count,
            "fallback_used": bool(plan.fallback_used),
            "quality_status": plan_json.get("quality_status", "contextual"),
            "contextuality_validation": plan_json.get("contextuality_validation"),
            "provenance_summary": {
                "generationMode": plan.generation_mode,
                "committeeAgentCount": plan.committee_agent_count,
                "fallbackUsed": bool(plan.fallback_used),
                "taskSourceBreakdown": {},
            },
            "created_at": plan.created_at.isoformat() if plan.created_at else None,
            "updated_at": plan.updated_at.isoformat() if plan.updated_at else None,
        },
        "schedule_status": {
            "date": plan.date,
            "generated": True,
            "scheduled_run_completed": plan.source == "scheduled",
            "source": plan.source,
            "created_at": plan.created_at.isoformat() if plan.created_at else None,
        },
    }


@router.get("")
async def get_today_workflow(
    date: Optional[str] = None,
    workflow_type: str = "main",
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Get existing daily workflow for the specified date.
    Returns 404 if no workflow exists for the date.
    Workflow should only be created via explicit user action or scheduled job.
    """
    from starlette.concurrency import run_in_threadpool
    user_id = str(current_user.get("id"))
    date_str = date or _today_date_str()
    
    def _get_existing():
        return (
            db.query(DailyWorkflowPlan)
            .filter(
                DailyWorkflowPlan.user_id == user_id,
                DailyWorkflowPlan.date == date_str,
                DailyWorkflowPlan.workflow_type == workflow_type,
            )
            .first()
        )
    
    plan = await run_in_threadpool(_get_existing)
    
    if not plan:
        raise HTTPException(
            status_code=404,
            detail=f"No workflow found for date {date_str}. Workflow should be generated via explicit user action or scheduled job."
        )

    def _fetch_tasks():
        return (
            db.query(DailyWorkflowTask)
            .filter(DailyWorkflowTask.plan_id == plan.id, DailyWorkflowTask.user_id == user_id)
            .order_by(DailyWorkflowTask.created_at.asc())
            .all()
        )

    tasks = await run_in_threadpool(_fetch_tasks)

    return {
        "success": True,
        "data": _build_workflow_payload(user_id, plan, tasks),
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": user_id,
    }


@router.get("/status")
async def get_today_workflow_status(
    date: Optional[str] = None,
    workflow_type: str = "main",
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    from starlette.concurrency import run_in_threadpool

    user_id = str(current_user.get("id"))
    date_str = date or _today_date_str()

    def _get_existing():
        return (
            db.query(DailyWorkflowPlan)
            .filter(
                DailyWorkflowPlan.user_id == user_id,
                DailyWorkflowPlan.date == date_str,
                DailyWorkflowPlan.workflow_type == workflow_type,
            )
            .first()
        )

    plan = await run_in_threadpool(_get_existing)

    return {
        "success": True,
        "data": {
            "date": date_str,
            "generated": plan is not None,
            "scheduled_run_completed": bool(plan and plan.source == "scheduled"),
            "source": plan.source if plan else None,
            "created_at": plan.created_at.isoformat() if plan and plan.created_at else None,
        },
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": user_id,
    }


@router.get("/progress")
async def get_generation_progress_endpoint(
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    from services.linkedin_today_workflow_data import get_generation_progress
    user_id = str(current_user.get("id"))
    date_str = date or _today_date_str()
    progress = get_generation_progress(user_id, date_str)
    return {
        "success": True,
        "progress": progress,
    }


@router.post("/generate")
async def generate_workflow(
    date: Optional[str] = None,
    workflow_type: str = "main",
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Explicitly generate a new daily workflow for the specified date.
    This should only be called when the user explicitly requests workflow generation
    or via a scheduled job at night.
    """
    from starlette.concurrency import run_in_threadpool
    from services.linkedin_today_workflow_data import clear_generation_progress
    user_id = str(current_user.get("id"))
    date_str = date or _today_date_str()

    try:
        if workflow_type == "linkedin":
            from services.linkedin_today_workflow_service import LinkedInTodayWorkflowService
            svc = LinkedInTodayWorkflowService(user_id)
            plan, created = await svc.get_or_create_plan(date=date, source="manual")
        else:
            plan, created = await get_or_create_daily_workflow_plan(db, user_id, date=date, creation_source="manual")
    finally:
        clear_generation_progress(user_id, date_str)

    # H5: threadpool helpers must not share the request's `db` Session.
    # Open a fresh Session per worker and close it deterministically.
    def _fetch_tasks():
        from services.database import get_session_for_user
        thread_db = get_session_for_user(user_id)
        if thread_db is None:
            return []
        try:
            return (
                thread_db.query(DailyWorkflowTask)
                .filter(DailyWorkflowTask.plan_id == plan.id, DailyWorkflowTask.user_id == user_id)
                .order_by(DailyWorkflowTask.created_at.asc())
                .all()
            )
        finally:
            thread_db.close()

    tasks = await run_in_threadpool(_fetch_tasks)

    if created:
        response_tasks = _build_workflow_payload(user_id, plan, tasks)["workflow"]["tasks"]
        asyncio.create_task(_index_tasks_to_sif(user_id, plan.date, response_tasks, label="today"))
        from datetime import date as date_type, timedelta

        try:
            parsed_plan_date = date_type.fromisoformat(plan.date)
        except ValueError:
            logger.warning(
                "Invalid plan.date format; skipping yesterday indexing plan_id={} user_id={} plan_date={} reason={}",
                plan.id,
                user_id,
                plan.date,
                "plan.date is not in ISO format YYYY-MM-DD",
            )
        else:
            y_str = (parsed_plan_date - timedelta(days=1)).isoformat()

            def _fetch_yesterday():
                from services.database import get_session_for_user
                thread_db = get_session_for_user(user_id)
                if thread_db is None:
                    return []
                try:
                    y_plan = (
                        thread_db.query(DailyWorkflowPlan)
                        .filter(DailyWorkflowPlan.user_id == user_id, DailyWorkflowPlan.date == y_str)
                        .first()
                    )
                    if y_plan:
                        y_tasks = (
                            thread_db.query(DailyWorkflowTask)
                            .filter(DailyWorkflowTask.plan_id == y_plan.id, DailyWorkflowTask.user_id == user_id)
                            .order_by(DailyWorkflowTask.created_at.asc())
                            .all()
                        )
                        return y_tasks
                    return []
                finally:
                    thread_db.close()

            try:
                y_tasks = await run_in_threadpool(_fetch_yesterday)
            except SQLAlchemyError as db_error:
                logger.warning(
                    "Failed to fetch yesterday tasks; skipping yesterday indexing plan_id={} user_id={} plan_date={} yesterday_date={} error_class={} error_message={}",
                    plan.id,
                    user_id,
                    plan.date,
                    y_str,
                    type(db_error).__name__,
                    str(db_error),
                )
            else:
                if y_tasks:
                    y_response = []
                    for t in y_tasks:
                        y_response.append(
                            {
                                "id": str(t.id),
                                "pillarId": t.pillar_id,
                                "title": t.title,
                                "description": t.description,
                                "status": "skipped" if t.status == "dismissed" else t.status,
                                "dependencies": _normalize_dependencies(t.dependencies),
                            }
                        )
                    asyncio.create_task(_index_tasks_to_sif(user_id, y_str, y_response, label="yesterday"))

    return {
        "success": True,
        "data": _build_workflow_payload(user_id, plan, tasks),
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": user_id,
    }


from services.task_memory_service import TaskMemoryService

@router.post("/tasks/{task_id}/status")
async def set_task_status(
    task_id: int,
    body: TaskStatusUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    user_id = str(current_user.get("id"))
    status = body.status.value
    completion_notes = body.completion_notes

    task = update_task_status(db, user_id, task_id, status=status, completion_notes=completion_notes)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Record outcome in memory for self-learning
    try:
        memory = TaskMemoryService(user_id, db)
        normalized_status = (task.status or "").lower()
        if normalized_status == "completed":
            feedback_score = 1
        elif normalized_status in {"skipped", "dismissed", "rejected"}:
            feedback_score = -1
        else:
            feedback_score = 0

        await memory.record_task_outcome(
            task,
            feedback_score=feedback_score,
            feedback_text=completion_notes,
        )
    except Exception as e:
        logger.warning(
            "Task memory outcome recording failed for user_id={} task_id={} error_class={} error_message={}",
            user_id,
            task_id,
            type(e).__name__,
            str(e),
        )

    plan_for_date = db.query(DailyWorkflowPlan).filter(DailyWorkflowPlan.id == task.plan_id).first()
    plan_date = plan_for_date.date if plan_for_date and plan_for_date.date else ""
    task_payload = {
        "id": str(task.id),
        "pillarId": task.pillar_id,
        "title": task.title,
        "description": task.description,
        "status": "skipped" if task.status == "dismissed" else task.status,
    }
    asyncio.create_task(_index_tasks_to_sif(user_id, plan_date, [task_payload], label="today"))

    return {
        "success": True,
        "data": {
            "task": {
                "id": str(task.id),
                "pillarId": task.pillar_id,
                "status": "skipped" if task.status == "dismissed" else task.status,
                "decided_at": task.decided_at.isoformat() if task.decided_at else None,
            }
        },
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": user_id,
    }
