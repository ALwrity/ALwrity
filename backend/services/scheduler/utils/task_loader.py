"""
Task Loader Utilities
Functions to load due tasks from database.
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_

from models.monitoring_models import MonitoringTask
from models.enhanced_strategy_models import EnhancedContentStrategy
from utils.logger_utils import get_service_logger

logger = get_service_logger("monitoring_task_loader")


def load_due_monitoring_tasks(
    db: Session,
    user_id: Optional[str] = None
) -> List[MonitoringTask]:
    """
    Load all monitoring tasks that are due for execution.
    
    Criteria:
    - status == 'active'
    - next_execution <= now (or is None for first execution)
    - Optional: user_id filter for specific user (for user isolation)
    
    Note: Strategy relationship is eagerly loaded to ensure user_id is accessible
    during task execution for user isolation.
    
    User isolation is enforced through filtering by user_id when provided.
    If no user_id is provided, loads tasks for all users (for system-wide monitoring).
    
    Args:
        db: Database session
        user_id: Optional user ID (Clerk string or int) to filter tasks (if None, loads all users' tasks)
        
    Returns:
        List of due MonitoringTask instances with strategy relationship loaded
    """
    try:
        now = datetime.utcnow()
        
        # Join with strategy to ensure relationship is loaded and support user filtering
        query = db.query(MonitoringTask).join(
            EnhancedContentStrategy,
            MonitoringTask.strategy_id == EnhancedContentStrategy.id
        ).options(
            joinedload(MonitoringTask.strategy)  # Eagerly load strategy relationship
        ).filter(
            and_(
                MonitoringTask.status == 'active',
                or_(
                    MonitoringTask.next_execution <= now,
                    MonitoringTask.next_execution.is_(None)
                )
            )
        )
        
        # Apply user filter if provided
        if user_id is not None:
            query = query.filter(EnhancedContentStrategy.user_id == user_id)
        
        return query.all()
    except Exception as e:
        logger.error(f"Error loading monitoring tasks: {e}")
        return []

