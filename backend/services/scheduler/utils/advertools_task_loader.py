"""
Advertools Task Loader Utility
Utility functions for loading due Advertools tasks from the database.
"""

from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_
from models.advertools_monitoring_models import AdvertoolsTask
from utils.logger_utils import get_service_logger

logger = get_service_logger("advertools_task_loader")

def load_due_advertools_tasks(db: Session, user_id: Optional[str] = None) -> List[AdvertoolsTask]:
    """
    Load Advertools tasks that are due for execution.
    
    Args:
        db: Database session
        user_id: Optional user ID to filter tasks (for multi-tenant support)
        
    Returns:
        List of due AdvertoolsTask objects
    """
    try:
        now = datetime.utcnow()
        
        query = db.query(AdvertoolsTask).filter(
            AdvertoolsTask.status == 'active',
            or_(
                AdvertoolsTask.next_execution <= now,
                AdvertoolsTask.next_execution.is_(None)
            )
        )
        
        if user_id:
            query = query.filter(AdvertoolsTask.user_id == user_id)
            
        return query.all()
    except Exception as e:
        logger.error(f"Error loading Advertools tasks: {e}")
        return []
