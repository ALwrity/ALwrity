"""
Platform Insights Task Loader
Functions to load due platform insights tasks from database.
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from models.platform_insights_monitoring_models import PlatformInsightsTask
from utils.logger_utils import get_service_logger

logger = get_service_logger("platform_insights_task_loader")


def load_due_platform_insights_tasks(
    db: Session,
    user_id: Optional[str] = None,
    platform: Optional[str] = None
) -> List[PlatformInsightsTask]:
    """
    Load all platform insights tasks that are due for execution.
    
    Criteria:
    - status == 'active' (only check active tasks)
    - next_check <= now (or is None for first execution)
    - Optional: user_id filter for specific user
    - Optional: platform filter ('gsc' or 'bing')
    
    Args:
        db: Database session
        user_id: Optional user ID (Clerk string) to filter tasks
        platform: Optional platform filter ('gsc' or 'bing')
        
    Returns:
        List of due PlatformInsightsTask instances
    """
    try:
        now = datetime.utcnow()
        
        # Build query for due tasks
        query = db.query(PlatformInsightsTask).filter(
            and_(
                PlatformInsightsTask.status == 'active',
                or_(
                    PlatformInsightsTask.next_check <= now,
                    PlatformInsightsTask.next_check.is_(None)
                )
            )
        )
        
        # Apply user filter if provided
        if user_id is not None:
            query = query.filter(PlatformInsightsTask.user_id == user_id)
        
        # Apply platform filter if provided
        if platform is not None:
            query = query.filter(PlatformInsightsTask.platform == platform)
        
        tasks = query.all()
        
        return tasks
    except Exception as e:
        logger.error(f"Error loading platform insights tasks: {e}")
        return []

