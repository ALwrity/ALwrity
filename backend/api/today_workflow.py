from fastapi import APIRouter, Depends, HTTPException
from typing import Any, Dict, Optional
from datetime import datetime, timedelta
import json
from enum import Enum
from loguru import logger
from pydantic import BaseModel, Field

from sqlalchemy.orm import Session
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from middleware.auth_middleware import get_current_user
from services.database import get_db
from services.agent_activity_service import AgentActivityService
from services.today_workflow_service import get_or_create_daily_workflow_plan, update_task_status, _today_date_str
from services.intelligence.agents.core_agent_framework import AgentAction
from services.intelligence.agents.agent_orchestrator import (
    execute_agent_action,
    record_agent_action_performance,
)
from services.outcome_reporting import summarize_workflow_outcomes
from services.feedback_optimization import build_optimization_signals
from services.real_outcome_adapters import (
    fetch_facebook_outcomes,
    fetch_conversion_outcomes,
    fetch_gsc_outcomes,
    fetch_linkedin_outcomes,
    fetch_published_asset_outcomes,
    unavailable_provider_outcome,
)
from services.recommendation_execution import execute_supported_recommendation
from services.task_outcome_integration import record_failed_execution_outcome
from services.intelligence.agents.quality_gates import (
    validate_action_content,
    validate_content_quality,
)
from models.daily_workflow_models import DailyWorkflowPlan, DailyWorkflowTask
from models.workflow_execution_models import WorkflowTaskExecution
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


def _execution_response(record: WorkflowTaskExecution) -> Dict[str, Any]:
    return {
        "execution_id": record.id,
        "action_id": record.action_id,
        "status": record.status,
        "result": record.result_json,
        "error": record.error_message,
        "started_at": record.started_at.isoformat() if record.started_at else None,
        "completed_at": record.completed_at.isoformat() if record.completed_at else None,
        "approval_request_id": record.approval_request_id,
    }


class TaskStatusEnum(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    awaiting_approval = "awaiting_approval"
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
    outcome_metrics: Optional[Dict[str, float]] = Field(
        None,
        description="Explicitly measured SEO/social outcome metrics for this task",
    )


class RetryAgentRequest(BaseModel):
    """Body for re-running a single failed committee agent."""

    agent_key: str = Field(..., description="Committee agent key to retry, e.g. content_strategist")


class TaskExecutionRequest(BaseModel):
    """Optional execution details for an executable workflow task."""

    action_type: Optional[str] = Field(None, max_length=40)
    target_resource: Optional[str] = Field(None, max_length=500)
    parameters: Dict[str, Any] = Field(default_factory=dict)
    expected_outcome: Optional[str] = Field(None, max_length=1000)
    risk_level: float = Field(0.5, ge=0.0, le=1.0)
    requires_approval: bool = False
    idempotency_key: Optional[str] = Field(None, max_length=255)


class TaskFeedbackRequest(BaseModel):
    score: int = Field(..., ge=-1, le=1, description="-1 negative, 0 neutral, 1 positive")
    feedback_text: Optional[str] = Field(None, max_length=4000)


class ConversionEventRequest(BaseModel):
    event_name: str = Field(..., min_length=1, max_length=100)
    value: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = Field(None, min_length=3, max_length=10)
    source: str = Field("first_party", min_length=1, max_length=50)
    external_event_id: Optional[str] = Field(None, max_length=255)
    task_id: Optional[int] = Field(None, ge=1)
    artifact_id: Optional[int] = Field(None, ge=1)
    published_asset_id: Optional[int] = Field(None, ge=1)
    campaign_id: Optional[str] = Field(None, max_length=255)
    platform: Optional[str] = Field(None, max_length=50)
    agent_type: Optional[str] = Field(None, max_length=100)
    recommendation_id: Optional[str] = Field(None, max_length=255)
    occurred_at: Optional[datetime] = None
    metadata: Dict[str, Any] = Field(default_factory=dict, max_length=50)

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
            "meeting_id": plan_json.get("meeting_id"),
            "date": plan.date,
            "source": plan.source,
            "generation_mode": plan.generation_mode,
            "committee_agent_count": plan.committee_agent_count,
            "fallback_used": bool(plan.fallback_used),
            "quality_status": plan_json.get("quality_status", "contextual"),
            "contextuality_validation": plan_json.get("contextuality_validation"),
            "agent_schedule": plan_json.get("schedule_decisions", []),
            "meeting_preflight": plan_json.get("meeting_preflight", {}),
            "meeting_timestamp": (plan_json.get("meeting_preflight", {}) or {}).get("checked_at"),
            "agent_evidence": plan_json.get("agent_evidence", []),
            "proposal_review": plan_json.get("proposal_review", {}),
            "guardian_review": plan_json.get("guardian_review", {}),
            "limitations": plan_json.get("limitations", []),
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
            "meeting_id": plan_json.get("meeting_id"),
            "meeting_status": plan_json.get("meeting_status"),
            "generated": True,
            "scheduled_run_completed": plan.source == "scheduled",
            "source": plan.source,
            "created_at": plan.created_at.isoformat() if plan.created_at else None,
            "agent_schedule": plan_json.get("schedule_decisions", []),
            "meeting_preflight": plan_json.get("meeting_preflight", {}),
            "meeting_timestamp": (plan_json.get("meeting_preflight", {}) or {}).get("checked_at"),
            "agent_evidence": plan_json.get("agent_evidence", []),
            "proposal_review": plan_json.get("proposal_review", {}),
            "guardian_review": plan_json.get("guardian_review", {}),
            "limitations": plan_json.get("limitations", []),
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

    # Determine why a plan may not have been generated
    skip_reason = None
    if not plan:
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        oauth = LinkedInOAuthService()
        conn_status = oauth.get_connection_status(user_id)
        if not conn_status.get("connected"):
            skip_reason = "LinkedIn not connected — connect your profile to receive daily workflows"
        else:
            skip_reason = (
                "Not yet generated — workflows run daily at 3:00 UTC "
                "for active users. Come back later or click Regenerate."
            )

    return {
        "success": True,
        "data": {
            "date": date_str,
            "generated": plan is not None,
            "scheduled_run_completed": bool(plan and plan.source == "scheduled"),
            "source": plan.source if plan else None,
            "created_at": plan.created_at.isoformat() if plan and plan.created_at else None,
            "skip_reason": skip_reason,
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


def _derive_agent_states(agent_evidence: list) -> list:
    """Classify each committee agent's outcome for transparency/retry.

    Returns one dict per evidence entry with a ``state`` of:
      - ``error``     : the agent raised an exception (retryable).
      - ``declined``  : the agent honestly reported nothing to contribute
                        (informational, not retryable).
      - ``ok``        : the agent produced proposals (or was not eligible).
    """
    states = []
    for ev in agent_evidence if isinstance(agent_evidence, list) else []:
        if not isinstance(ev, dict):
            continue
        agent = str(ev.get("agent") or "unknown").strip()
        state = "ok"
        detail = None
        if ev.get("error"):
            state = "error"
            detail = ev.get("error")
        elif ev.get("declined"):
            state = "declined"
            detail = ev.get("message") or "I have nothing to contribute"
        states.append({"agent": agent, "state": state, "detail": detail})
    return states


@router.post("/preview")
async def preview_workflow(
    date: Optional[str] = None,
    force: bool = False,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Generate today's plan and persist it to the user's workspace.

    Runs the agent committee (bypassing the onboarding-completion gate so it
    works in the onboarding final step) and persists a DailyWorkflowPlan so the
    result is durable and feeds the dashboard's today-workflow directly.

    ``force=true`` re-runs the committee even when a plan already exists for
    the date: the existing plan row is kept (same id, digest and meeting
    linkage) but its tasks and ``plan_json`` are replaced with fresh output.
    Without it the call is idempotent — an existing plan is returned as-is.
    """
    from starlette.concurrency import run_in_threadpool
    # Import lazily (matching the retry endpoint below) so the call always
    # resolves the current services.today_workflow_service module object —
    # env-override tests re-import that module mid-suite, and a top-level
    # binding would keep calling a stale copy whose monkeypatches never land.
    from services.today_workflow_service import get_or_create_daily_workflow_plan

    user_id = str(current_user.get("id"))
    date_str = date or _today_date_str()

    plan, created = await get_or_create_daily_workflow_plan(
        db, user_id, date=date_str, creation_source="preview", allow_preview=True,
        force_rerun=force,
    )

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
    response_tasks = _build_workflow_payload(user_id, plan, tasks)["workflow"]["tasks"]

    proposals_by_agent: Dict[str, list] = {}
    for task in response_tasks:
        agent = ((task.get("metadata") or {}).get("source_agent")) or "unknown"
        proposals_by_agent.setdefault(agent, []).append(task)

    from services.today_workflow_pillar import count_template_fallback_tasks

    # Surface the reason a template task was substituted, instead of hiding
    # the degraded backfill. Collected from task metadata written by
    # _controlled_pillar_fallback / the pillar-coverage guardrail.
    backfill_errors = []
    for task in response_tasks:
        meta = task.get("metadata") if isinstance(task.get("metadata"), dict) else {}
        if meta.get("synthesis_mode") == "template_fallback":
            backfill_errors.append({
                "pillar": task.get("pillarId"),
                "title": task.get("title"),
                "error": meta.get("generation_error"),
                "reason": meta.get("reasoning"),
            })

    # Persisted digest outcome recorded at meeting completion (why an email
    # did or didn't fire). Absent on plans created before the digest-surfacing
    # change; the frontend treats a missing value as "no status recorded".
    plan_json = plan.plan_json if isinstance(plan.plan_json, dict) else {}
    digest = plan_json.get("digest")

    agent_states = _derive_agent_states(plan_json.get("agent_evidence", []))
    failed_agents = [s for s in agent_states if s["state"] == "error"]
    declined_agents = [s for s in agent_states if s["state"] == "declined"]

    return {
        "success": True,
        "data": {
            "date": date_str,
            "plan_id": plan.id,
            "persisted": True,
            "tasks": response_tasks,
            "committee_agent_count": plan.committee_agent_count,
            "fallback_used": bool(plan.fallback_used),
            "proposals_by_agent": proposals_by_agent,
            # Transparency: how many suggestions are static templates
            # because agent analysis was unavailable.
            "template_fallback_count": count_template_fallback_tasks(response_tasks),
            "backfill_errors": backfill_errors,
            "digest": digest,
            "agent_states": agent_states,
            "failed_agents": failed_agents,
            "declined_agents": declined_agents,
        },
    }


@router.post("/retry-agent")
async def retry_agent(
    body: RetryAgentRequest,
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Re-run a single failed committee agent and merge its fresh proposals.

    Only agents in the plan's ``failed_agents`` set are retryable; declined
    agents (which honestly reported nothing to contribute) are informational
    and rejected here. The retry replaces just that agent's tasks and leaves
    the meeting/digest lifecycle untouched.
    """
    from starlette.concurrency import run_in_threadpool
    from services.today_workflow_service import retry_agent_proposals

    user_id = str(current_user.get("id"))
    date_str = date or _today_date_str()
    agent_key = (body.agent_key or "").strip()

    plan = (
        db.query(DailyWorkflowPlan)
        .filter(DailyWorkflowPlan.user_id == user_id, DailyWorkflowPlan.date == date_str)
        .first()
    )
    if plan is None:
        raise HTTPException(status_code=404, detail="No daily workflow plan exists to retry")

    plan_json = plan.plan_json if isinstance(plan.plan_json, dict) else {}
    agent_states = _derive_agent_states(plan_json.get("agent_evidence", []))
    failed_keys = {s["agent"] for s in agent_states if s["state"] == "error"}
    declined_keys = {s["agent"] for s in agent_states if s["state"] == "declined"}

    if agent_key in declined_keys:
        raise HTTPException(
            status_code=400,
            detail=f"Agent {agent_key} declined with nothing to contribute; not retryable",
        )
    if agent_key not in failed_keys:
        raise HTTPException(
            status_code=400,
            detail=f"Agent {agent_key} is not currently in a failed state",
        )

    result = await retry_agent_proposals(db, user_id, agent_key, date=date_str)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Retry failed"))

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
    refreshed = _build_workflow_payload(user_id, plan, tasks)["workflow"]["tasks"]

    proposals_by_agent: Dict[str, list] = {}
    for task in refreshed:
        agent = ((task.get("metadata") or {}).get("source_agent")) or "unknown"
        proposals_by_agent.setdefault(agent, []).append(task)

    from services.today_workflow_pillar import count_template_fallback_tasks

    backfill_errors = []
    for task in refreshed:
        meta = task.get("metadata") if isinstance(task.get("metadata"), dict) else {}
        if meta.get("synthesis_mode") == "template_fallback":
            backfill_errors.append({
                "pillar": task.get("pillarId"),
                "title": task.get("title"),
                "error": meta.get("generation_error"),
                "reason": meta.get("reasoning"),
            })

    db.refresh(plan)
    plan_json = plan.plan_json if isinstance(plan.plan_json, dict) else {}
    agent_states = _derive_agent_states(plan_json.get("agent_evidence", []))

    return {
        "success": True,
        "data": {
            "agent": agent_key,
            "date": date_str,
            "plan_id": plan.id,
            "tasks": refreshed,
            "proposals_by_agent": proposals_by_agent,
            "template_fallback_count": count_template_fallback_tasks(refreshed),
            "backfill_errors": backfill_errors,
            "digest": plan_json.get("digest"),
            "agent_states": agent_states,
            "failed_agents": [s for s in agent_states if s["state"] == "error"],
            "declined_agents": [s for s in agent_states if s["state"] == "declined"],
        },
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

    if body.outcome_metrics:
        metadata = task.metadata_json if isinstance(task.metadata_json, dict) else {}
        metadata["outcome_metrics"] = dict(body.outcome_metrics)
        task.metadata_json = metadata
        db.add(task)
        db.commit()

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


@router.post("/tasks/{task_id}/execute")
async def execute_workflow_task(
    task_id: int,
    body: Optional[TaskExecutionRequest] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Execute a persisted recommendation through its owning agent.

    ``navigate`` remains a UI action and is returned without side effects.
    Other action types require an explicit agent dispatch and continue through
    the normal agent safety, approval, rollback, and activity lifecycle.
    """
    user_id = str(current_user.get("id"))
    task = (
        db.query(DailyWorkflowTask)
        .filter(DailyWorkflowTask.id == task_id, DailyWorkflowTask.user_id == user_id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    body = body or TaskExecutionRequest()

    action_type = str(body.action_type or task.action_type or "navigate").strip().lower()
    idempotency_key = str(
        body.idempotency_key or f"today-task:{task.id}:{action_type}"
    ).strip()
    existing_execution = (
        db.query(WorkflowTaskExecution)
        .filter(
            WorkflowTaskExecution.task_id == task_id,
            WorkflowTaskExecution.user_id == user_id,
            WorkflowTaskExecution.idempotency_key == idempotency_key,
        )
        .first()
    )
    if isinstance(existing_execution, WorkflowTaskExecution):
        return {
            "success": existing_execution.status in {"running", "awaiting_approval", "succeeded"},
            "data": {
                "task_id": str(task.id),
                "status": task.status,
                "execution": _execution_response(existing_execution),
                "idempotent_replay": True,
            },
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
        }

    if task.status in {"completed", "dismissed", "skipped"}:
        raise HTTPException(status_code=409, detail=f"Task is already {task.status}")
    if task.status == "in_progress":
        active_execution = (
            db.query(WorkflowTaskExecution)
            .filter(
                WorkflowTaskExecution.task_id == task_id,
                WorkflowTaskExecution.user_id == user_id,
                WorkflowTaskExecution.status.in_(["running", "awaiting_approval"]),
            )
            .order_by(WorkflowTaskExecution.started_at.desc())
            .first()
        )
        stale_cutoff = datetime.utcnow() - timedelta(minutes=30)
        if (
            isinstance(active_execution, WorkflowTaskExecution)
            and active_execution.status == "running"
            and active_execution.started_at
            and active_execution.started_at < stale_cutoff
        ):
            active_execution.status = "failed"
            active_execution.error_message = "Execution timed out and was released for retry"
            active_execution.completed_at = datetime.utcnow()
            task.status = "pending"
            task.completion_notes = active_execution.error_message
            task.updated_at = datetime.utcnow()
            db.add(active_execution)
            db.add(task)
            db.commit()
        elif not isinstance(active_execution, WorkflowTaskExecution) and task.updated_at and task.updated_at < stale_cutoff:
            task.status = "pending"
            task.completion_notes = "Stale execution was released for retry"
            task.updated_at = datetime.utcnow()
            db.add(task)
            db.commit()
        else:
            raise HTTPException(status_code=409, detail="Task execution is already in progress")
    if task.status == "awaiting_approval":
        raise HTTPException(status_code=409, detail="Task execution is awaiting approval")

    if action_type == "navigate":
        return {
            "success": True,
            "data": {
                "task_id": str(task.id),
                "executed": False,
                "requires_navigation": True,
                "action_url": task.action_url,
            },
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
        }

    metadata = task.metadata_json if isinstance(task.metadata_json, dict) else {}
    source_agent = str(
        metadata.get("source_agent")
        or metadata.get("agent_type")
        or "content_strategist"
    )
    parameters = dict(body.parameters or {})
    action_parameters = metadata.get("action_parameters")
    if isinstance(action_parameters, dict):
        for key, value in action_parameters.items():
            parameters.setdefault(key, value)
    context_data = metadata.get("context_data")
    if isinstance(context_data, dict):
        for key, value in context_data.items():
            parameters.setdefault(key, value)
    parameters.setdefault("task_id", task.id)

    quality_context: Dict[str, Any] = {}
    try:
        from api.content_planning.services.content_strategy.onboarding.data_integration import (
            OnboardingDataIntegrationService,
        )
        from services.intelligence.agents.prompt_context import build_prompt_context

        integrated = OnboardingDataIntegrationService().get_integrated_data_sync(user_id, db) or {}
        quality_context = build_prompt_context(integrated)
    except Exception as quality_context_error:
        logger.debug("Could not load quality context for task {}: {}", task.id, quality_context_error)

    parameters.setdefault("onboarding_context", quality_context)
    parameters.setdefault("source_agent", source_agent)
    parameters.setdefault("recommendation_id", metadata.get("recommendation_id") or f"task-{task.id}")
    parameters.setdefault("idempotency_key", idempotency_key)
    input_quality = validate_action_content(parameters, quality_context)
    if not input_quality["is_compliant"]:
        return {
            "success": False,
            "data": {
                "task_id": str(task.id),
                "status": task.status,
                "execution": {
                    "success": False,
                    "error": "Task content failed quality validation",
                    "quality_gate": input_quality,
                },
            },
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
        }
    parameters.setdefault("quality_gate_passed", input_quality["is_compliant"])

    requires_approval = (
        body.requires_approval
        or body.risk_level >= 0.8
        or action_type in {"publish", "send", "delete", "schedule", "post"}
    )

    started_at = datetime.utcnow()
    try:
        if hasattr(db, "execute"):
            claim = db.execute(
                update(DailyWorkflowTask)
                .where(
                    DailyWorkflowTask.id == task_id,
                    DailyWorkflowTask.user_id == user_id,
                    DailyWorkflowTask.status == "pending",
                )
                .values(status="in_progress", updated_at=started_at)
            )
            if getattr(claim, "rowcount", 0) != 1:
                db.rollback()
                raise HTTPException(status_code=409, detail="Task execution is already in progress")
            task.status = "in_progress"
            task.updated_at = started_at
        else:
            task.status = "in_progress"
            task.updated_at = started_at
            db.add(task)

        execution_record = WorkflowTaskExecution(
            task_id=task.id,
            user_id=user_id,
            idempotency_key=idempotency_key,
            action_id=f"task_{task.id}",
            agent_type=source_agent,
            action_type=action_type,
            status="running",
            started_at=started_at,
        )
        db.add(execution_record)
        db.commit()
        db.refresh(execution_record)
    except HTTPException:
        raise
    except IntegrityError:
        db.rollback()
        existing_execution = (
            db.query(WorkflowTaskExecution)
            .filter(
                WorkflowTaskExecution.task_id == task_id,
                WorkflowTaskExecution.user_id == user_id,
                WorkflowTaskExecution.idempotency_key == idempotency_key,
            )
            .first()
        )
        if isinstance(existing_execution, WorkflowTaskExecution):
            return {
                "success": existing_execution.status in {"running", "awaiting_approval", "succeeded"},
                "data": {
                    "task_id": str(task.id),
                    "status": task.status,
                    "execution": _execution_response(existing_execution),
                    "idempotent_replay": True,
                },
                "timestamp": datetime.utcnow().isoformat(),
                "user_id": user_id,
            }
        raise HTTPException(status_code=409, detail="Task execution could not be claimed")
    except Exception:
        db.rollback()
        task.status = "pending"
        task.updated_at = datetime.utcnow()
        db.add(task)
        db.commit()
        raise

    parameters["execution_id"] = execution_record.id

    action = AgentAction(
        action_id=f"task_{task.id}",
        agent_type=source_agent,
        action_type=action_type,
        target_resource=str(body.target_resource or task.title),
        parameters=parameters,
        expected_outcome=str(body.expected_outcome or task.description),
        risk_level=body.risk_level,
        requires_approval=requires_approval,
    )
    adapter_run = None
    direct_action_types = {
        "create_content",
        "seo_analyze",
        "social_draft",
        "facebook_draft",
        "linkedin_draft",
        "calendar_insert",
        "create_seo_task",
    }
    if action_type in direct_action_types:
        try:
            activity = AgentActivityService(db, user_id)
            adapter_run = activity.start_run(
                agent_type=source_agent,
                prompt=f"{action_type} -> {action.target_resource}",
            )
            activity.log_event(
                event_type="execution_started",
                message=f"Started recommendation action: {action_type}",
                payload={
                    "task_id": task.id,
                    "action_id": action.action_id,
                    "action_type": action_type,
                },
                run_id=adapter_run.id,
                agent_type=source_agent,
            )
        except Exception as activity_error:
            logger.warning("Could not start direct adapter activity for task {}: {}", task.id, activity_error)

    try:
        result = await execute_supported_recommendation(
            action_type,
            parameters,
            user_id,
            db,
        )
        if result is None:
            result = await execute_agent_action(user_id, source_agent, action)
    except Exception as execution_error:
        logger.exception("Recommendation execution failed for task {}", task.id)
        result = {
            "success": False,
            "error": str(execution_error)[:4000],
        }

    generated_contents = []
    if isinstance(result, dict) and isinstance(result.get("content"), str) and result["content"].strip():
        generated_contents.append(result["content"])
    artifacts = result.get("artifacts", []) if isinstance(result, dict) else []
    for artifact in artifacts if isinstance(artifacts, list) else []:
        if isinstance(artifact, dict) and isinstance(artifact.get("content"), str) and artifact["content"].strip():
            generated_contents.append(artifact["content"])

    quality_results = [
        validate_content_quality(content, quality_context)
        for content in generated_contents
    ]
    if quality_results:
        output_quality = {
            "is_compliant": all(item["is_compliant"] for item in quality_results),
            "violations": [v for item in quality_results for v in item.get("violations", [])],
            "warnings": [w for item in quality_results for w in item.get("warnings", [])],
            "corrections": [c for item in quality_results for c in item.get("corrections", [])],
            "checked": True,
        }
        result["quality_gate"] = output_quality
        if not output_quality["is_compliant"]:
            result["success"] = False
            result["error"] = "Generated content failed quality validation"

        asset_ids = []
        if result.get("asset_id") is not None:
            asset_ids.append(result.get("asset_id"))
        for artifact in artifacts if isinstance(artifacts, list) else []:
            if isinstance(artifact, dict) and artifact.get("asset_id") is not None:
                asset_ids.append(artifact.get("asset_id"))
        if asset_ids:
            try:
                from services.content_asset_service import ContentAssetService

                decision = "passed" if output_quality["is_compliant"] else "blocked"
                for asset_id in asset_ids:
                    ContentAssetService(db).update_asset(
                        int(asset_id),
                        user_id,
                        asset_metadata={"quality_decision": decision},
                    )
            except Exception as quality_persist_error:
                logger.warning("Could not persist artifact quality decision for task {}: {}", task.id, quality_persist_error)

    if adapter_run:
        await record_agent_action_performance(
            user_id,
            source_agent,
            bool(result.get("success")),
            max(0.0, (datetime.utcnow() - started_at).total_seconds()),
        )

    execution_status = (
        "succeeded" if result.get("success") else
        "awaiting_approval" if result.get("requires_approval") else
        "failed"
    )
    completed_at = None if execution_status == "awaiting_approval" else datetime.utcnow()
    execution_record.status = execution_status
    execution_record.approval_request_id = result.get("approval_request_id")
    execution_record.result_json = result
    execution_record.error_message = None if result.get("success") else str(result.get("error") or "")[:4000]
    execution_record.completed_at = completed_at
    db.add(execution_record)

    metadata["execution"] = {
        "execution_id": execution_record.id,
        "action_id": action.action_id,
        "success": bool(result.get("success")),
        "requires_approval": bool(result.get("requires_approval")),
        "approval_request_id": result.get("approval_request_id"),
        "attempts": int((metadata.get("execution") or {}).get("attempts") or 0) + 1,
        "started_at": started_at.isoformat(),
        "completed_at": completed_at.isoformat() if completed_at else None,
        "error": execution_record.error_message,
    }
    if result.get("artifact_type"):
        metadata["artifact"] = {
            "type": result.get("artifact_type"),
            "asset_id": result.get("asset_id"),
            "content": str(result.get("content") or "")[:12000],
            "result": result.get("result"),
        }
    task.metadata_json = metadata

    if adapter_run:
        try:
            activity = AgentActivityService(db, user_id)
            activity.log_event(
                event_type="execution_completed" if result.get("success") else "execution_failed",
                severity="info" if result.get("success") else "error",
                message="Recommendation adapter finished",
                payload={
                    "task_id": task.id,
                    "action_id": action.action_id,
                    "artifact_type": result.get("artifact_type"),
                    "success": bool(result.get("success")),
                },
                run_id=adapter_run.id,
                agent_type=source_agent,
            )
            activity.finish_run(
                adapter_run.id,
                success=bool(result.get("success")),
                result_summary=str(result.get("artifact_type") or result.get("result") or "")[:4000],
                error_message=None if result.get("success") else str(result.get("error") or "")[:4000],
            )
        except Exception as activity_error:
            logger.warning("Could not finish direct adapter activity for task {}: {}", task.id, activity_error)

    if result.get("success"):
        task.status = "completed"
        task.completion_notes = "Executed by the assigned marketing agent."
    elif result.get("requires_approval"):
        task.status = "awaiting_approval"
        task.completion_notes = "Execution is awaiting user approval."
    else:
        task.status = "pending"
        task.completion_notes = str(result.get("error") or "Execution failed")[:4000]
    task.updated_at = datetime.utcnow()
    db.add(task)
    db.commit()

    if execution_status == "failed":
        try:
            await record_failed_execution_outcome(
                user_id,
                task,
                db,
                {
                    "execution_id": execution_record.id,
                    "action_type": action_type,
                    "status": execution_status,
                    "error": execution_record.error_message,
                    "result": result,
                },
            )
        except Exception as memory_error:
            logger.warning("Could not record failed task outcome for task {}: {}", task.id, memory_error)
        # TaskMemory records the failed attempt separately; the workflow task
        # remains pending so the user can retry with changed parameters.
        task.status = "pending"
        db.add(task)
        db.commit()

    return {
        "success": bool(result.get("success") or result.get("requires_approval")),
        "data": {
            "task_id": str(task.id),
            "status": task.status,
            "execution": result,
        },
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": user_id,
    }


@router.get("/outcomes")
async def get_workflow_outcomes(
    days: int = 30,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return measured workflow and marketing outcomes for the current user."""
    if days < 1 or days > 90:
        raise HTTPException(status_code=400, detail="days must be between 1 and 90")

    user_id = str(current_user.get("id"))
    since = datetime.utcnow() - timedelta(days=days)
    tasks = (
        db.query(DailyWorkflowTask)
        .filter(
            DailyWorkflowTask.user_id == user_id,
            DailyWorkflowTask.created_at >= since,
        )
        .all()
    )
    site_url = ""
    try:
        from api.content_planning.services.content_strategy.onboarding.data_integration import (
            OnboardingDataIntegrationService,
        )
        from services.intelligence.agents.prompt_context import build_prompt_context

        integrated = OnboardingDataIntegrationService().get_integrated_data_sync(user_id, db) or {}
        site_url = str(build_prompt_context(integrated).get("website_url") or "")
    except Exception as exc:
        logger.debug("Could not resolve outcome site URL for {}: {}", user_id, exc)

    gsc, linkedin, facebook = await asyncio.gather(
        fetch_gsc_outcomes(user_id, db, site_url),
        fetch_linkedin_outcomes(user_id, db, days=min(days, 28)),
        fetch_facebook_outcomes(user_id, days=min(days, 28)),
    )
    real_outcomes = {
        "gsc": gsc,
        "published_pages": fetch_published_asset_outcomes(user_id, db),
        "linkedin": linkedin,
        "facebook": facebook,
        "conversions": fetch_conversion_outcomes(user_id, db, days=days),
    }
    fetched_at = datetime.utcnow().isoformat()
    for provider in real_outcomes.values():
        provider.setdefault("fetched_at", fetched_at)
        if provider.get("status") == "available":
            provider.setdefault("freshness_status", "fresh")
        else:
            reason_code = provider.get("reason_code")
            provider.setdefault(
                "freshness_status",
                "coming_soon" if reason_code == "coming_soon" else "unknown",
            )

    return {
        "success": True,
        "data": {
            "window_days": days,
            "since": since.isoformat(),
            "outcomes": summarize_workflow_outcomes(tasks),
            "real_outcomes": real_outcomes,
        },
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": user_id,
    }


@router.post("/tasks/{task_id}/feedback")
async def record_workflow_task_feedback(
    task_id: int,
    body: TaskFeedbackRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Record explicit user feedback without changing the task outcome."""
    user_id = str(current_user.get("id"))
    task = (
        db.query(DailyWorkflowTask)
        .filter(DailyWorkflowTask.id == task_id, DailyWorkflowTask.user_id == user_id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    metadata = task.metadata_json if isinstance(task.metadata_json, dict) else {}
    metadata["feedback"] = {
        "score": body.score,
        "feedback_text": body.feedback_text,
        "recorded_at": datetime.utcnow().isoformat(),
    }
    task.metadata_json = metadata
    task.updated_at = datetime.utcnow()
    db.add(task)
    db.commit()

    return {
        "success": True,
        "data": {
            "task_id": str(task.id),
            "feedback": metadata["feedback"],
        },
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": user_id,
    }


@router.get("/optimization-signals")
async def get_workflow_optimization_signals(
    days: int = 30,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return reviewable feedback signals; never mutate prompts automatically."""
    if days < 1 or days > 90:
        raise HTTPException(status_code=400, detail="days must be between 1 and 90")

    user_id = str(current_user.get("id"))
    since = datetime.utcnow() - timedelta(days=days)
    tasks = (
        db.query(DailyWorkflowTask)
        .filter(
            DailyWorkflowTask.user_id == user_id,
            DailyWorkflowTask.created_at >= since,
        )
        .all()
    )
    return {
        "success": True,
        "data": {
            "window_days": days,
            "since": since.isoformat(),
            "optimization": build_optimization_signals(tasks),
        },
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": user_id,
    }


@router.post("/outcomes/conversions")
async def record_conversion_event(
    body: ConversionEventRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Record a user-owned conversion event for outcome attribution."""
    from models.conversion_event_models import ConversionEvent

    user_id = str(current_user.get("id"))
    if body.external_event_id:
        duplicate = (
            db.query(ConversionEvent)
            .filter(
                ConversionEvent.user_id == user_id,
                ConversionEvent.external_event_id == body.external_event_id,
            )
            .first()
        )
        if duplicate:
            return {
                "success": True,
                "data": {"event_id": duplicate.id, "duplicate": True},
                "timestamp": datetime.utcnow().isoformat(),
                "user_id": user_id,
            }

    occurred_at = body.occurred_at or datetime.utcnow()
    if occurred_at.tzinfo is not None:
        occurred_at = occurred_at.replace(tzinfo=None)
    if occurred_at > datetime.utcnow() + timedelta(minutes=5):
        raise HTTPException(status_code=400, detail="occurred_at cannot be in the future")

    task = None
    task_metadata: Dict[str, Any] = {}
    if body.task_id is not None:
        task = (
            db.query(DailyWorkflowTask)
            .filter(
                DailyWorkflowTask.id == body.task_id,
                DailyWorkflowTask.user_id == user_id,
            )
            .first()
        )
        if not task:
            raise HTTPException(status_code=400, detail="task_id does not belong to the current user")
        task_metadata = task.metadata_json if isinstance(task.metadata_json, dict) else {}

    if body.artifact_id is not None or body.published_asset_id is not None:
        from services.content_asset_service import ContentAssetService

        asset_service = ContentAssetService(db)
        for asset_id, label in (
            (body.artifact_id, "artifact_id"),
            (body.published_asset_id, "published_asset_id"),
        ):
            if asset_id is None:
                continue
            asset = asset_service.get_asset_by_id(asset_id, user_id)
            if not asset:
                raise HTTPException(status_code=400, detail=f"{label} does not belong to the current user")
            if label == "published_asset_id":
                tags = asset.tags if isinstance(asset.tags, list) else []
                asset_metadata = asset.asset_metadata if isinstance(asset.asset_metadata, dict) else {}
                if "published" not in tags and asset_metadata.get("status") != "published":
                    raise HTTPException(status_code=400, detail="published_asset_id is not marked as published")

    metadata = dict(body.metadata)
    lineage = {
        "task_id": body.task_id,
        "artifact_id": body.artifact_id,
        "published_asset_id": body.published_asset_id,
        "campaign_id": body.campaign_id,
        "platform": body.platform,
        "agent_type": body.agent_type or task_metadata.get("source_agent"),
        "recommendation_id": body.recommendation_id or task_metadata.get("recommendation_id"),
    }
    if len(json.dumps(metadata, ensure_ascii=False)) > 10000:
        raise HTTPException(status_code=400, detail="metadata is too large")
    metadata["lineage"] = {key: value for key, value in lineage.items() if value is not None}
    event = ConversionEvent(
        user_id=user_id,
        event_name=body.event_name.strip(),
        value=body.value,
        currency=body.currency.upper() if body.currency else None,
        source=body.source.strip(),
        external_event_id=body.external_event_id,
        agent_type=lineage["agent_type"],
        recommendation_id=lineage["recommendation_id"],
        task_id=body.task_id,
        artifact_id=body.artifact_id,
        published_asset_id=body.published_asset_id,
        campaign_id=body.campaign_id,
        platform=body.platform.lower().strip() if body.platform else None,
        occurred_at=occurred_at,
        metadata_json=metadata,
    )
    try:
        db.add(event)
        db.commit()
        db.refresh(event)
    except IntegrityError:
        db.rollback()
        if body.external_event_id:
            duplicate = (
                db.query(ConversionEvent)
                .filter(
                    ConversionEvent.user_id == user_id,
                    ConversionEvent.external_event_id == body.external_event_id,
                )
                .first()
            )
            if duplicate:
                return {
                    "success": True,
                    "data": {"event_id": duplicate.id, "duplicate": True},
                    "timestamp": datetime.utcnow().isoformat(),
                    "user_id": user_id,
                }
        raise HTTPException(status_code=409, detail="Conversion event could not be recorded")
    return {
        "success": True,
        "data": {"event_id": event.id, "duplicate": False},
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": user_id,
    }
