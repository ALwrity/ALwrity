"""
OAuth Token Monitoring Task Loader
Functions to load due OAuth token monitoring tasks from database.
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from models.oauth_token_monitoring_models import OAuthTokenMonitoringTask
from utils.logger_utils import get_service_logger

logger = get_service_logger("oauth_token_task_loader")


def load_due_oauth_token_monitoring_tasks(
    db: Session,
    user_id: Optional[str] = None
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
    try:
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
            query = query.filter(OAuthTokenMonitoringTask.user_id == user_id)
        
        return query.all()
    except Exception as e:
        logger.error(f"Error loading OAuth token monitoring tasks: {e}")
        return []

