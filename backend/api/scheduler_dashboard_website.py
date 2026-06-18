"""
Scheduler Dashboard — Website Analysis Endpoints
================================================

3 endpoints, all about website analysis tasks (user_website +
competitor). Extracted from the monolithic `scheduler_dashboard.py`.

Endpoints in this module:
    - GET  /website-analysis/status/{user_id}
            Lists user_website and competitor tasks for the user with
            aggregated active/failed counts.

    - GET  /website-analysis/logs/{user_id}
            Returns execution logs joined to tasks via the eager-loaded
            `log.task` relationship (H5 — N+1 fix).

    - POST /website-analysis/retry/{task_id}
            Resets a failed task's `status`/`failure_reason` and sets
            `next_check = utcnow()` to schedule immediate execution.
"""

from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger
from sqlalchemy import desc
from sqlalchemy.orm import Session

from api.scheduler_dashboard_models import (
    WebsiteAnalysisLogsResponse,
    WebsiteAnalysisRetryResponse,
    WebsiteAnalysisStatusResponse,
)
from middleware.auth_middleware import get_current_user
from models.website_analysis_monitoring_models import (
    WebsiteAnalysisExecutionLog,
    WebsiteAnalysisTask,
)
from services.database import get_db


# M5: the sub-router is exposed without a prefix; the parent
# `scheduler_dashboard.py` re-exports it under `/api/scheduler` so
# route URLs are unchanged.
router = APIRouter(tags=["scheduler-dashboard-website"])


# ──────────────────────────────────────────────────────────────────
# GET /website-analysis/status/{user_id}
# ──────────────────────────────────────────────────────────────────
@router.get("/website-analysis/status/{user_id}", response_model=WebsiteAnalysisStatusResponse)
async def get_website_analysis_status(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get website analysis task status for a user.

    Returns:
        - User website tasks
        - Competitor website tasks
        - Task details and execution logs
    """
    try:
        if str(current_user.get('id')) != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        logger.debug(f"[Website Analysis Status] Getting status for user: {user_id}")

        tasks = db.query(WebsiteAnalysisTask).filter(
            WebsiteAnalysisTask.user_id == user_id
        ).order_by(WebsiteAnalysisTask.task_type, WebsiteAnalysisTask.created_at).all()

        user_website_tasks = [t for t in tasks if t.task_type == 'user_website']
        competitor_tasks = [t for t in tasks if t.task_type == 'competitor']

        logger.debug(
            f"[Website Analysis Status] Found {len(tasks)} tasks for user {user_id}: "
            f"{len(user_website_tasks)} user website, {len(competitor_tasks)} competitors"
        )

        def format_task(task: WebsiteAnalysisTask) -> Dict[str, Any]:
            return {
                'id': task.id,
                'website_url': task.website_url,
                'task_type': task.task_type,
                'competitor_id': task.competitor_id,
                'status': task.status,
                'last_check': task.last_check.isoformat() if task.last_check else None,
                'last_success': task.last_success.isoformat() if task.last_success else None,
                'last_failure': task.last_failure.isoformat() if task.last_failure else None,
                'failure_reason': task.failure_reason,
                'next_check': task.next_check.isoformat() if task.next_check else None,
                'frequency_days': task.frequency_days,
                'created_at': task.created_at.isoformat() if task.created_at else None,
                'updated_at': task.updated_at.isoformat() if task.updated_at else None
            }

        active_tasks = len([t for t in tasks if t.status == 'active'])
        failed_tasks = len([t for t in tasks if t.status == 'failed'])

        return {
            'success': True,
            'data': {
                'user_id': user_id,
                'user_website_tasks': [format_task(t) for t in user_website_tasks],
                'competitor_tasks': [format_task(t) for t in competitor_tasks],
                'total_tasks': len(tasks),
                'active_tasks': active_tasks,
                'failed_tasks': failed_tasks
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting website analysis status for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get website analysis status: {str(e)}")


# ──────────────────────────────────────────────────────────────────
# GET /website-analysis/logs/{user_id}
# ──────────────────────────────────────────────────────────────────
@router.get("/website-analysis/logs/{user_id}", response_model=WebsiteAnalysisLogsResponse)
async def get_website_analysis_logs(
    user_id: str,
    task_id: Optional[int] = Query(None),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get execution logs for website analysis tasks.

    Args:
        user_id: User ID
        task_id: Optional task ID to filter logs
        limit: Maximum number of logs to return
        offset: Pagination offset

    Returns:
        List of execution logs
    """
    try:
        if str(current_user.get('id')) != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        query = db.query(WebsiteAnalysisExecutionLog).join(
            WebsiteAnalysisTask,
            WebsiteAnalysisExecutionLog.task_id == WebsiteAnalysisTask.id
        ).filter(
            WebsiteAnalysisTask.user_id == user_id
        )

        if task_id:
            query = query.filter(WebsiteAnalysisExecutionLog.task_id == task_id)

        total_count = query.count()

        logs = query.order_by(
            desc(WebsiteAnalysisExecutionLog.execution_date)
        ).offset(offset).limit(limit).all()

        formatted_logs = []
        for log in logs:
            # H5: reuse the JOINed task instance instead of issuing a
            # per-row query. The previous implementation ran 1 + N
            # queries; we now run 1.
            task = log.task
            formatted_logs.append({
                'id': log.id,
                'task_id': log.task_id,
                'website_url': task.website_url if task else None,
                'task_type': task.task_type if task else None,
                'execution_date': log.execution_date.isoformat() if log.execution_date else None,
                'status': log.status,
                'result_data': log.result_data,
                'error_message': log.error_message,
                'execution_time_ms': log.execution_time_ms,
                'created_at': log.created_at.isoformat() if log.created_at else None
            })

        return {
            'logs': formatted_logs,
            'total_count': total_count,
            'limit': limit,
            'offset': offset,
            'has_more': (offset + limit) < total_count
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting website analysis logs for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get website analysis logs: {str(e)}")


# ──────────────────────────────────────────────────────────────────
# POST /website-analysis/retry/{task_id}
# ──────────────────────────────────────────────────────────────────
@router.post("/website-analysis/retry/{task_id}", response_model=WebsiteAnalysisRetryResponse)
async def retry_website_analysis(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Manually retry a failed website analysis task.

    Args:
        task_id: Task ID to retry

    Returns:
        Success status and updated task details
    """
    try:
        task = db.query(WebsiteAnalysisTask).filter(WebsiteAnalysisTask.id == task_id).first()

        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        if str(current_user.get('id')) != task.user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Reset task status and schedule immediate execution
        task.status = 'active'
        task.failure_reason = None
        task.next_check = datetime.utcnow()  # Schedule immediately
        task.updated_at = datetime.utcnow()

        db.commit()

        logger.info(f"Manually retried website analysis task {task_id} for user {task.user_id}")

        return {
            'success': True,
            'message': f'Website analysis task {task_id} scheduled for immediate execution',
            'task': {
                'id': task.id,
                'website_url': task.website_url,
                'status': task.status,
                'next_check': task.next_check.isoformat() if task.next_check else None
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrying website analysis task {task_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to retry website analysis: {str(e)}")
