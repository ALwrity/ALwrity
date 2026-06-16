"""
OAuth Token Monitoring Task Loader
Functions to load due OAuth token monitoring tasks from database.
"""

from datetime import datetime, timedelta
from typing import List, Optional, Union
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from models.oauth_token_monitoring_models import OAuthTokenMonitoringTask


def load_due_oauth_token_monitoring_tasks(
    db: Session,
    user_id: Optional[Union[str, int]] = None
) -> List[OAuthTokenMonitoringTask]:
    """
    Load all OAuth token monitoring tasks that are due for execution.
    
    Criteria:
    - status == 'active' (only check active tasks)
    - next_check <= now (or is None for first execution)
    - Optional: user_id filter for specific user (for user isolation)
    
    User isolation is enforced through filtering by user_id when provided.
    If no user_id is provided, loads tasks for all users (for system-wide monitoring).
    
    Args:
        db: Database session
        user_id: Optional user ID (Clerk string) to filter tasks (if None, loads all users' tasks)
        
    Returns:
        List of due OAuthTokenMonitoringTask instances
    """
    now = datetime.utcnow()
    
    # Build query for due tasks
    query = db.query(OAuthTokenMonitoringTask).filter(
        and_(
            OAuthTokenMonitoringTask.status == 'active',
            or_(
                OAuthTokenMonitoringTask.next_check <= now,
                OAuthTokenMonitoringTask.next_check.is_(None)
            )
        )
    )
    
    # Apply user filter if provided (for user isolation)
    if user_id is not None:
        query = query.filter(OAuthTokenMonitoringTask.user_id == str(user_id))
    
    return query.all()


def load_near_expiry_oauth_token_tasks(
    db: Session,
    refresh_horizon_hours: int = 24,
    user_id: Optional[Union[str, int]] = None
) -> List[OAuthTokenMonitoringTask]:
    """
    Load OAuth tasks that should run token refresh logic soon.

    Includes:
    - tasks with a scheduled retry now due (next_retry_at <= now)
    - tasks whose routine check is inside the near-expiry horizon window
    """
    now = datetime.utcnow()
    horizon = now + timedelta(hours=max(refresh_horizon_hours, 1))

    query = db.query(OAuthTokenMonitoringTask).filter(
        and_(
            OAuthTokenMonitoringTask.status.in_(['active', 'failed', 'degraded']),
            or_(
                OAuthTokenMonitoringTask.next_retry_at <= now,
                OAuthTokenMonitoringTask.next_check <= horizon,
                OAuthTokenMonitoringTask.next_check.is_(None)
            )
        )
    )

    if user_id is not None:
        query = query.filter(OAuthTokenMonitoringTask.user_id == str(user_id))

    return query.all()
