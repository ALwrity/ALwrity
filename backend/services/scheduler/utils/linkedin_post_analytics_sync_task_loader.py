"""
LinkedIn Post Analytics Sync Task Loader
Loads due LinkedIn post analytics sync tasks from the database.
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from models.linkedin_monitoring_models import LinkedInPostAnalyticsSyncTask
from utils.logger_utils import get_service_logger

logger = get_service_logger("linkedin_post_analytics_sync_task_loader")


def load_due_linkedin_post_analytics_sync_tasks(db: Session, user_id: Optional[str] = None) -> List[LinkedInPostAnalyticsSyncTask]:
    """
    Load LinkedIn post analytics sync tasks that are due for execution.

    Args:
        db: Database session
        user_id: Optional user_id to filter by

    Returns:
        List of LinkedInPostAnalyticsSyncTask objects
    """
    try:
        query = db.query(LinkedInPostAnalyticsSyncTask).filter(
            or_(
                LinkedInPostAnalyticsSyncTask.status == "pending",
                LinkedInPostAnalyticsSyncTask.status == "active",
                LinkedInPostAnalyticsSyncTask.status == "failed",
            ),
            LinkedInPostAnalyticsSyncTask.next_execution <= datetime.utcnow()
        )

        if user_id:
            query = query.filter(LinkedInPostAnalyticsSyncTask.user_id == user_id)

        tasks = query.all()
        return tasks

    except Exception as e:
        logger.error(f"Error loading LinkedIn post analytics sync tasks: {str(e)}")
        return []
