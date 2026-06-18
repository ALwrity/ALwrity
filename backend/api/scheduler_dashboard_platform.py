"""
Scheduler Dashboard — Platform Insights Endpoints
==================================================

3 endpoints, all about platform insights tasks (GSC + Bing). Extracted
from the monolithic `scheduler_dashboard.py`.

Endpoints in this module:
    - GET  /platform-insights/status/{user_id}
            C2: strictly read-only — never auto-creates tasks. Returns
            `missing_platforms` so the caller can decide whether to POST.

    - POST /platform-insights/{user_id}/ensure-tasks
            C2: explicit task-creation endpoint. Replaces the auto-create
            side effect that used to live in the GET status handler.
            Idempotent — existing tasks are not duplicated.

    - GET  /platform-insights/logs/{user_id}
            Returns execution logs for the user's platform-insights tasks.
            Optional `task_id` filter. Cap of 100 rows.
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger
from sqlalchemy import desc
from sqlalchemy.orm import Session

from api.scheduler_dashboard_models import (
    PlatformInsightsLogsResponse,
    PlatformInsightsStatusResponse,
)
from middleware.auth_middleware import get_current_user
from models.platform_insights_monitoring_models import (
    PlatformInsightsExecutionLog,
    PlatformInsightsTask,
)
from services.database import get_db


# M5: the sub-router is exposed without a prefix; the parent
# `scheduler_dashboard.py` re-exports it under `/api/scheduler` so
# route URLs are unchanged.
router = APIRouter(tags=["scheduler-dashboard-platform"])


# ──────────────────────────────────────────────────────────────────
# GET /platform-insights/status/{user_id}
# ──────────────────────────────────────────────────────────────────
@router.get("/platform-insights/status/{user_id}", response_model=PlatformInsightsStatusResponse)
async def get_platform_insights_status(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get platform insights task status for a user.

    C2: this endpoint is now strictly read-only. Previously it auto-created
    missing tasks for connected platforms, which violated REST semantics
    (GET must be idempotent and read-only) and made the dashboard hang
    on slow external APIs. Use POST /platform-insights/{user_id}/ensure-tasks
    to explicitly create missing tasks. The response includes a
    `missing_platforms` field so the frontend can decide whether to POST.

    Returns:
        - GSC insights tasks
        - Bing insights tasks
        - missing_platforms: list of platforms connected but not yet tracked
        - Task details and execution logs
    """
    try:
        if str(current_user.get('id')) != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        logger.debug(f"[Platform Insights Status] Getting status for user: {user_id}")

        tasks = db.query(PlatformInsightsTask).filter(
            PlatformInsightsTask.user_id == user_id
        ).order_by(PlatformInsightsTask.platform, PlatformInsightsTask.created_at).all()

        # Compute missing platforms without auto-creating. The actual
        # creation lives in the POST endpoint below.
        from services.oauth_token_monitoring_service import get_connected_platforms
        from services.platform_insights_monitoring_service import create_platform_insights_task  # noqa: F401  (still re-exported for backwards import paths)

        connected_platforms = get_connected_platforms(user_id)
        insights_platforms = ['gsc', 'bing']
        connected_insights = [p for p in connected_platforms if p in insights_platforms]
        existing_platforms = {task.platform for task in tasks}
        missing_platforms = [p for p in connected_insights if p not in existing_platforms]

        gsc_tasks = [t for t in tasks if t.platform == 'gsc']
        bing_tasks = [t for t in tasks if t.platform == 'bing']

        logger.debug(
            f"[Platform Insights Status] Found {len(tasks)} total tasks: "
            f"{len(gsc_tasks)} GSC, {len(bing_tasks)} Bing; missing={missing_platforms}"
        )

        def format_task(task: PlatformInsightsTask) -> Dict[str, Any]:
            return {
                'id': task.id,
                'platform': task.platform,
                'site_url': task.site_url,
                'status': task.status,
                'last_check': task.last_check.isoformat() if task.last_check else None,
                'last_success': task.last_success.isoformat() if task.last_success else None,
                'last_failure': task.last_failure.isoformat() if task.last_failure else None,
                'failure_reason': task.failure_reason,
                'next_check': task.next_check.isoformat() if task.next_check else None,
                'created_at': task.created_at.isoformat() if task.created_at else None,
                'updated_at': task.updated_at.isoformat() if task.updated_at else None
            }

        return {
            'success': True,
            'user_id': user_id,
            'gsc_tasks': [format_task(t) for t in gsc_tasks],
            'bing_tasks': [format_task(t) for t in bing_tasks],
            'total_tasks': len(tasks),
            'missing_platforms': missing_platforms,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting platform insights status for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get platform insights status: {str(e)}")


# ──────────────────────────────────────────────────────────────────
# POST /platform-insights/{user_id}/ensure-tasks
# ──────────────────────────────────────────────────────────────────
@router.post("/platform-insights/{user_id}/ensure-tasks", response_model=PlatformInsightsStatusResponse)
async def ensure_platform_insights_tasks(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    C2: explicit task-creation endpoint. Replaces the auto-create side
    effect that used to live in the GET status handler. Idempotent:
    existing tasks are not duplicated.

    Returns the same shape as GET /platform-insights/status/{user_id},
    after the creation pass.
    """
    if str(current_user.get('id')) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        from services.oauth_token_monitoring_service import get_connected_platforms
        from services.platform_insights_monitoring_service import create_platform_insights_task

        def format_task(task):
            return {
                'id': task.id,
                'platform': task.platform,
                'site_url': task.site_url,
                'status': task.status,
                'last_check': task.last_check.isoformat() if task.last_check else None,
                'last_success': task.last_success.isoformat() if task.last_success else None,
                'last_failure': task.last_failure.isoformat() if task.last_failure else None,
                'failure_reason': task.failure_reason,
                'next_check': task.next_check.isoformat() if task.next_check else None,
                'created_at': task.created_at.isoformat() if task.created_at else None,
                'updated_at': task.updated_at.isoformat() if task.updated_at else None
            }

        connected_platforms = get_connected_platforms(user_id)
        insights_platforms = ['gsc', 'bing']
        connected_insights = [p for p in connected_platforms if p in insights_platforms]

        existing = db.query(PlatformInsightsTask).filter(
            PlatformInsightsTask.user_id == user_id
        ).all()
        existing_platforms = {task.platform for task in existing}
        missing_platforms = [p for p in connected_insights if p not in existing_platforms]

        created = []
        failed = []
        for platform in missing_platforms:
            try:
                result = create_platform_insights_task(
                    user_id=user_id,
                    platform=platform,
                    site_url=None,  # Executor will fetch site_url when it runs
                    db=db,
                )
                if result.get('success'):
                    created.append(platform)
                    logger.info(
                        f"[ensure-tasks] Created {platform.upper()} insights task for user {user_id}"
                    )
                else:
                    failed.append({"platform": platform, "error": result.get('error')})
                    logger.warning(
                        f"[ensure-tasks] Failed to create {platform} task: {result.get('error')}"
                    )
            except Exception as e:
                failed.append({"platform": platform, "error": str(e)})
                logger.warning(
                    f"[ensure-tasks] Error creating {platform} task: {e}", exc_info=True
                )

        tasks = db.query(PlatformInsightsTask).filter(
            PlatformInsightsTask.user_id == user_id
        ).order_by(PlatformInsightsTask.platform, PlatformInsightsTask.created_at).all()
        gsc_tasks = [t for t in tasks if t.platform == 'gsc']
        bing_tasks = [t for t in tasks if t.platform == 'bing']

        return {
            'success': True,
            'user_id': user_id,
            'gsc_tasks': [format_task(t) for t in gsc_tasks],
            'bing_tasks': [format_task(t) for t in bing_tasks],
            'total_tasks': len(tasks),
            'missing_platforms': [],
            'created_platforms': created,
            'failed_platforms': failed,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error ensuring platform insights tasks for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to ensure platform insights tasks: {str(e)}")


# ──────────────────────────────────────────────────────────────────
# GET /platform-insights/logs/{user_id}
# ──────────────────────────────────────────────────────────────────
@router.get("/platform-insights/logs/{user_id}", response_model=PlatformInsightsLogsResponse)
async def get_platform_insights_logs(
    user_id: str,
    task_id: Optional[int] = Query(None),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get execution logs for platform insights tasks.

    Args:
        user_id: User ID
        task_id: Optional task ID to filter logs
        limit: Maximum number of logs to return

    Returns:
        List of execution logs
    """
    try:
        if str(current_user.get('id')) != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        query = db.query(PlatformInsightsExecutionLog).join(
            PlatformInsightsTask,
            PlatformInsightsExecutionLog.task_id == PlatformInsightsTask.id
        ).filter(
            PlatformInsightsTask.user_id == user_id
        )

        if task_id:
            query = query.filter(PlatformInsightsExecutionLog.task_id == task_id)

        logs = query.order_by(
            desc(PlatformInsightsExecutionLog.execution_date)
        ).limit(limit).all()

        def format_log(log: PlatformInsightsExecutionLog) -> Dict[str, Any]:
            return {
                'id': log.id,
                'task_id': log.task_id,
                'execution_date': log.execution_date.isoformat() if log.execution_date else None,
                'status': log.status,
                'result_data': log.result_data,
                'error_message': log.error_message,
                'execution_time_ms': log.execution_time_ms,
                'data_source': log.data_source,
                'created_at': log.created_at.isoformat() if log.created_at else None
            }

        return {
            'success': True,
            'logs': [format_log(log) for log in logs],
            'total_count': len(logs)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting platform insights logs for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get platform insights logs: {str(e)}")
