"""
Scheduler Dashboard — Task Management Endpoints
===============================================

3 endpoints, all about task lifecycle management. Extracted from the
monolithic `scheduler_dashboard.py`.

Endpoints in this module:
    - GET  /tasks-needing-intervention/{user_id}
            Lists tasks whose failure pattern indicates a permanent
            (non-transient) problem the user must address manually.

    - POST /tasks/{task_type}/{task_id}/manual-trigger
            Bypasses the cool-off check and runs the task immediately.
            C4: the cool-off reset is committed BEFORE invoking
            `execute_task_async` so the reset is durable independent
            of the execution outcome.

    - GET  /onboarding-tasks/{user_id}
            Lists every task created during onboarding for the user,
            with label/description from `TASK_DISPLAY_INFO`. Supports
            `offset`/`limit`/`task_type` for pagination and filtering
            (H4).
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger
from sqlalchemy.orm import Session

from api.scheduler_dashboard_constants import get_task_display_info
from api.scheduler_dashboard_models import (
    ManualTriggerResponse,
    OnboardingTasksResponse,
    TasksNeedingInterventionResponse,
)
from middleware.auth_middleware import get_current_user
from models.advertools_monitoring_models import AdvertoolsTask
from models.oauth_token_monitoring_models import OAuthTokenMonitoringTask
from models.platform_insights_monitoring_models import PlatformInsightsTask
from models.website_analysis_monitoring_models import (
    DeepCompetitorAnalysisTask,
    DeepWebsiteCrawlTask,
    MarketTrendsTask,
    OnboardingFullWebsiteAnalysisTask,
    SIFIndexingTask,
    WebsiteAnalysisTask,
)
from services.database import get_db
from services.scheduler import get_scheduler


# M5: the sub-router is exposed without a prefix; the parent
# `scheduler_dashboard.py` re-exports it under `/api/scheduler` so
# route URLs are unchanged.
router = APIRouter(tags=["scheduler-dashboard-tasks"])


# ──────────────────────────────────────────────────────────────────
# GET /tasks-needing-intervention/{user_id}
# ──────────────────────────────────────────────────────────────────
@router.get("/tasks-needing-intervention/{user_id}", response_model=TasksNeedingInterventionResponse)
async def get_tasks_needing_intervention(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get all tasks that need human intervention.

    Args:
        user_id: User ID

    Returns:
        List of tasks needing intervention with failure pattern details
    """
    try:
        if str(current_user.get('id')) != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        from services.scheduler.core.failure_detection_service import FailureDetectionService
        detection_service = FailureDetectionService(db)

        tasks = detection_service.get_tasks_needing_intervention(user_id=user_id)

        return {
            "success": True,
            "tasks": tasks,
            "count": len(tasks)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting tasks needing intervention: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get tasks needing intervention: {str(e)}")


# ──────────────────────────────────────────────────────────────────
# POST /tasks/{task_type}/{task_id}/manual-trigger
# ──────────────────────────────────────────────────────────────────
@router.post("/tasks/{task_type}/{task_id}/manual-trigger", response_model=ManualTriggerResponse)
async def manual_trigger_task(
    task_type: str,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Manually trigger a task that is in cool-off or needs intervention.
    This bypasses the cool-off check and executes the task immediately.

    Args:
        task_type: Task type (oauth_token_monitoring, website_analysis, gsc_insights, bing_insights,
                    onboarding_full_website_analysis, deep_competitor_analysis, sif_indexing,
                    market_trends, advertools, deep_website_crawl)
        task_id: Task ID

    Returns:
        Success status and execution result
    """
    try:
        from services.scheduler.core.task_execution_handler import execute_task_async
        scheduler = get_scheduler()

        task = None
        if task_type == "oauth_token_monitoring":
            task = db.query(OAuthTokenMonitoringTask).filter(
                OAuthTokenMonitoringTask.id == task_id
            ).first()
        elif task_type == "website_analysis":
            task = db.query(WebsiteAnalysisTask).filter(
                WebsiteAnalysisTask.id == task_id
            ).first()
        elif task_type in ["gsc_insights", "bing_insights"]:
            task = db.query(PlatformInsightsTask).filter(
                PlatformInsightsTask.id == task_id
            ).first()
        elif task_type == "onboarding_full_website_analysis":
            task = db.query(OnboardingFullWebsiteAnalysisTask).filter(
                OnboardingFullWebsiteAnalysisTask.id == task_id
            ).first()
        elif task_type == "deep_competitor_analysis":
            task = db.query(DeepCompetitorAnalysisTask).filter(
                DeepCompetitorAnalysisTask.id == task_id
            ).first()
        elif task_type == "sif_indexing":
            task = db.query(SIFIndexingTask).filter(
                SIFIndexingTask.id == task_id
            ).first()
        elif task_type == "market_trends":
            task = db.query(MarketTrendsTask).filter(
                MarketTrendsTask.id == task_id
            ).first()
        elif task_type == "advertools":
            task = db.query(AdvertoolsTask).filter(
                AdvertoolsTask.id == task_id
            ).first()
        elif task_type == "deep_website_crawl":
            task = db.query(DeepWebsiteCrawlTask).filter(
                DeepWebsiteCrawlTask.id == task_id
            ).first()
        else:
            raise HTTPException(status_code=400, detail=f"Unknown task type: {task_type}")

        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        if str(current_user.get('id')) != task.user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Clear cool-off status and reset failure count.
        # C4: commit BEFORE calling execute_task_async. The executor can take
        # a long time, may raise, and may itself modify the task. If we
        # committed after the call, a crash would leave the cool-off
        # silently cleared (since the in-memory mutation happened) without
        # any actual execution, and the next check cycle would re-pick up
        # the task. By committing first we ensure the cool-off reset is
        # durable independent of the execution outcome.
        task.status = "active"
        task.consecutive_failures = 0
        task.failure_pattern = None
        db.commit()
        # Refresh to detach from the prior session state so the executor
        # sees a clean row when it loads the task.
        db.refresh(task)

        # Execute task manually (bypasses cool-off check)
        try:
            await execute_task_async(scheduler, task_type, task, execution_source="manual")
        except Exception as exec_err:
            # Cool-off is already reset and durable; surface the execution
            # error to the caller. The user can retry manually without
            # having to re-clear cool-off.
            logger.error(
                "Manual trigger execution failed for task_id={} task_type={} user_id={}: {}",
                task_id, task_type, task.user_id, exec_err,
            )
            raise HTTPException(
                status_code=500,
                detail=f"Task triggered but execution failed: {exec_err}",
            ) from exec_err

        logger.info(f"Manually triggered task {task_id} ({task_type}) for user {task.user_id}")

        return {
            "success": True,
            "message": "Task triggered successfully",
            "task": {
                "id": task.id,
                "status": task.status,
                "last_check": task.last_check.isoformat() if task.last_check else None
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error manually triggering task {task_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to trigger task: {str(e)}")


# ──────────────────────────────────────────────────────────────────
# GET /onboarding-tasks/{user_id}
# ──────────────────────────────────────────────────────────────────
@router.get("/onboarding-tasks/{user_id}", response_model=OnboardingTasksResponse)
async def get_onboarding_tasks(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(
        100, ge=1, le=500,
        description="Max number of tasks to return (1-500, default 100)",
    ),
    task_type: Optional[str] = Query(
        None,
        description=(
            "Optional filter: only return tasks of this type. "
            "Valid values: onboarding_full_website_analysis, deep_competitor_analysis, "
            "sif_indexing, market_trends, advertools, website_analysis, "
            "oauth_token_monitoring, gsc_insights, bing_insights."
        ),
    ),
):
    """
    Get all tasks created during onboarding for a user, with status and
    human-readable descriptions.

    H4: previously this endpoint ran 8 sequential queries and returned
    every task for the user with no pagination. For power users with
    many tasks this could be a large response. We now accept
    `offset`, `limit`, and an optional `task_type` filter. Pagination
    is applied AFTER aggregation so the limit caps the total response,
    not per-category. The default limit of 100 is safe for typical
    onboarding; the frontend that does not pass these parameters
    continues to work unchanged.
    """
    try:
        if str(current_user.get('id')) != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        VALID_TASK_TYPES = {
            "onboarding_full_website_analysis",
            "deep_competitor_analysis",
            "sif_indexing",
            "market_trends",
            "advertools",
            "website_analysis",
            "oauth_token_monitoring",
            "gsc_insights",
            "bing_insights",
        }
        if task_type is not None and task_type not in VALID_TASK_TYPES:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Invalid task_type: {task_type!r}. "
                    f"Valid values: {sorted(VALID_TASK_TYPES)}"
                ),
            )

        # Convenience: when a specific task_type is requested, skip the
        # queries for other categories. Maps task_type -> list of model
        # classes that hold that kind of task.
        TASK_TYPE_TO_MODELS = {
            "onboarding_full_website_analysis": [OnboardingFullWebsiteAnalysisTask],
            "deep_competitor_analysis": [DeepCompetitorAnalysisTask],
            "sif_indexing": [SIFIndexingTask],
            "market_trends": [MarketTrendsTask],
            "advertools": [AdvertoolsTask],
            "website_analysis": [WebsiteAnalysisTask],
            "oauth_token_monitoring": [OAuthTokenMonitoringTask],
            "gsc_insights": [PlatformInsightsTask],
            "bing_insights": [PlatformInsightsTask],
        }

        categories_to_query = (
            {task_type: TASK_TYPE_TO_MODELS[task_type]}
            if task_type is not None
            else TASK_TYPE_TO_MODELS
        )

        tasks = []

        def _fmt_status(s):
            return s.replace('_', ' ').title() if s else 'Unknown'

        def _fmt_dt(dt):
            return dt.isoformat() if dt else None

        if "onboarding_full_website_analysis" in categories_to_query:
            for t in db.query(OnboardingFullWebsiteAnalysisTask).filter(
                OnboardingFullWebsiteAnalysisTask.user_id == user_id
            ).all():
                info = get_task_display_info("onboarding_full_website_analysis")
                tasks.append({
                    "task_type": "onboarding_full_website_analysis",
                    "label": info.get("label", "Full-Site SEO Audit"),
                    "description": info.get("description", ""),
                    "frequency": info.get("frequency", "One-time"),
                    "task_id": t.id,
                    "website_url": t.website_url,
                    "status": t.status,
                    "status_label": _fmt_status(t.status),
                    "last_success": _fmt_dt(t.last_success),
                    "last_failure": _fmt_dt(t.last_failure),
                    "next_execution": _fmt_dt(t.next_execution),
                    "failure_reason": t.failure_reason,
                    "consecutive_failures": t.consecutive_failures,
                })

        if "deep_competitor_analysis" in categories_to_query:
            for t in db.query(DeepCompetitorAnalysisTask).filter(
                DeepCompetitorAnalysisTask.user_id == user_id
            ).all():
                info = get_task_display_info("deep_competitor_analysis")
                payload = t.payload or {}
                freq_label = info.get("frequency", "One-time")
                if payload.get("mode") == "strategic_insights":
                    freq_label = "Weekly"
                tasks.append({
                    "task_type": "deep_competitor_analysis",
                    "label": info.get("label", "Deep Competitor Analysis"),
                    "description": info.get("description", ""),
                    "frequency": freq_label,
                    "task_id": t.id,
                    "website_url": t.website_url,
                    "status": t.status,
                    "status_label": _fmt_status(t.status),
                    "last_success": _fmt_dt(t.last_success),
                    "last_failure": _fmt_dt(t.last_failure),
                    "next_execution": _fmt_dt(t.next_execution),
                    "failure_reason": t.failure_reason,
                    "consecutive_failures": t.consecutive_failures,
                })

        if "sif_indexing" in categories_to_query:
            for t in db.query(SIFIndexingTask).filter(
                SIFIndexingTask.user_id == user_id
            ).all():
                info = get_task_display_info("sif_indexing")
                tasks.append({
                    "task_type": "sif_indexing",
                    "label": info.get("label", "SIF Content Indexing"),
                    "description": info.get("description", ""),
                    "frequency": f"Every {t.frequency_hours or 48}h",
                    "task_id": t.id,
                    "website_url": t.website_url,
                    "status": t.status,
                    "status_label": _fmt_status(t.status),
                    "last_success": _fmt_dt(t.last_success),
                    "last_failure": _fmt_dt(t.last_failure),
                    "next_execution": _fmt_dt(t.next_execution),
                    "failure_reason": t.failure_reason,
                    "consecutive_failures": t.consecutive_failures,
                })

        if "market_trends" in categories_to_query:
            for t in db.query(MarketTrendsTask).filter(
                MarketTrendsTask.user_id == user_id
            ).all():
                info = get_task_display_info("market_trends")
                tasks.append({
                    "task_type": "market_trends",
                    "label": info.get("label", "Market Trends"),
                    "description": info.get("description", ""),
                    "frequency": f"Every {t.frequency_hours or 72}h",
                    "task_id": t.id,
                    "website_url": t.website_url,
                    "status": t.status,
                    "status_label": _fmt_status(t.status),
                    "last_success": _fmt_dt(t.last_success),
                    "last_failure": _fmt_dt(t.last_failure),
                    "next_execution": _fmt_dt(t.next_execution),
                    "failure_reason": t.failure_reason,
                    "consecutive_failures": t.consecutive_failures,
                })

        if "advertools" in categories_to_query:
            for t in db.query(AdvertoolsTask).filter(
                AdvertoolsTask.user_id == user_id
            ).all():
                info = get_task_display_info("advertools")
                tasks.append({
                    "task_type": "advertools",
                    "label": info.get("label", "Advertools Analysis"),
                    "description": info.get("description", ""),
                    "frequency": f"Every {t.frequency_days or 7}d",
                    "task_id": t.id,
                    "website_url": t.website_url,
                    "status": t.status,
                    "status_label": _fmt_status(t.status),
                    "last_success": _fmt_dt(t.last_success),
                    "last_failure": _fmt_dt(t.last_failure),
                    "next_execution": _fmt_dt(t.next_execution),
                    "failure_reason": t.failure_reason,
                    "consecutive_failures": t.consecutive_failures,
                })

        if "website_analysis" in categories_to_query:
            for t in db.query(WebsiteAnalysisTask).filter(
                WebsiteAnalysisTask.user_id == user_id
            ).all():
                info = get_task_display_info("website_analysis")
                tasks.append({
                    "task_type": "website_analysis",
                    "label": info.get("label", "Website Analysis") + (f" ({t.task_type})" if t.task_type == 'competitor' else ""),
                    "description": info.get("description", ""),
                    "frequency": f"Every {t.frequency_days or 10}d",
                    "task_id": t.id,
                    "website_url": t.website_url,
                    "status": t.status,
                    "status_label": _fmt_status(t.status),
                    "last_success": _fmt_dt(t.last_success),
                    "last_failure": _fmt_dt(t.last_failure),
                    "next_execution": _fmt_dt(t.next_check),
                    "failure_reason": t.failure_reason,
                    "consecutive_failures": t.consecutive_failures,
                })

        if "oauth_token_monitoring" in categories_to_query:
            for t in db.query(OAuthTokenMonitoringTask).filter(
                OAuthTokenMonitoringTask.user_id == user_id
            ).all():
                info = get_task_display_info("oauth_token_monitoring")
                tasks.append({
                    "task_type": "oauth_token_monitoring",
                    "label": info.get("label", "OAuth Token Health") + f" ({t.platform})",
                    "description": info.get("description", ""),
                    "frequency": info.get("frequency", "Weekly"),
                    "task_id": t.id,
                    "website_url": None,
                    "status": t.status,
                    "status_label": _fmt_status(t.status),
                    "last_success": _fmt_dt(t.last_success),
                    "last_failure": _fmt_dt(t.last_failure),
                    "next_execution": _fmt_dt(t.next_check),
                    "failure_reason": t.failure_reason,
                    "consecutive_failures": t.consecutive_failures,
                })

        if "gsc_insights" in categories_to_query or "bing_insights" in categories_to_query:
            wanted_platforms = set()
            if "gsc_insights" in categories_to_query:
                wanted_platforms.add("gsc")
            if "bing_insights" in categories_to_query:
                wanted_platforms.add("bing")
            for t in db.query(PlatformInsightsTask).filter(
                PlatformInsightsTask.user_id == user_id
            ).all():
                if t.platform not in wanted_platforms:
                    continue
                task_key = f"{t.platform}_insights"
                info = get_task_display_info(task_key)
                tasks.append({
                    "task_type": task_key,
                    "label": info.get("label", "Platform Insights") + f" ({t.platform})",
                    "description": info.get("description", ""),
                    "frequency": info.get("frequency", "Weekly"),
                    "task_id": t.id,
                    "website_url": t.site_url,
                    "status": t.status,
                    "status_label": _fmt_status(t.status),
                    "last_success": _fmt_dt(t.last_success),
                    "last_failure": _fmt_dt(t.last_failure),
                    "next_execution": _fmt_dt(t.next_check),
                    "failure_reason": t.failure_reason,
                    "consecutive_failures": t.consecutive_failures,
                })

        # H4: apply pagination AFTER aggregation so the limit caps the
        # total response, not per-category. `has_more` is computed before
        # the slice.
        total = len(tasks)
        paginated = tasks[offset:offset + limit]

        return {
            "success": True,
            "tasks": paginated,
            "count": len(paginated),
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": (offset + limit) < total,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting onboarding tasks for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get onboarding tasks: {str(e)}")
