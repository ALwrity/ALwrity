"""
SIF Indexing Task Loader
Loads due SIF indexing tasks from the database.
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from models.website_analysis_monitoring_models import SIFIndexingTask
from utils.logger_utils import get_service_logger

logger = get_service_logger("sif_indexing_task_loader")


def load_due_sif_indexing_tasks(db: Session, user_id: Optional[str] = None) -> List[SIFIndexingTask]:
    """
    Load SIF indexing tasks that are due for execution.
    
    Args:
        db: Database session
        user_id: Optional user_id to filter by
        
    Returns:
        List of SIFIndexingTask objects
    """
    try:
        query = db.query(SIFIndexingTask).filter(
            or_(
                SIFIndexingTask.status == "pending",
                SIFIndexingTask.status == "active",
                SIFIndexingTask.status == "failed"  # Retry failed tasks
            ),
            SIFIndexingTask.next_execution <= datetime.utcnow()
        )
        
        if user_id:
            query = query.filter(SIFIndexingTask.user_id == user_id)
            
        tasks = query.all()
        return tasks
        
    except Exception as e:
        logger.error(f"Error loading SIF indexing tasks: {str(e)}")
        return []
