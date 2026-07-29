"""
LinkedIn Profile Sync Task Loader
Loads due LinkedIn profile sync tasks from the database.
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from models.linkedin_monitoring_models import LinkedInProfileSyncTask
from utils.logger_utils import get_service_logger

logger = get_service_logger("linkedin_profile_sync_task_loader")


def load_due_linkedin_profile_sync_tasks(db: Session, user_id: Optional[str] = None) -> List[LinkedInProfileSyncTask]:
    """
    Load LinkedIn profile sync tasks that are due for execution.

    Args:
        db: Database session
        user_id: Optional user_id to filter by

    Returns:
        List of LinkedInProfileSyncTask objects
    """
    try:
        query = db.query(LinkedInProfileSyncTask).filter(
            or_(
                LinkedInProfileSyncTask.status == "pending",
                LinkedInProfileSyncTask.status == "active",
                LinkedInProfileSyncTask.status == "failed",
            ),
            LinkedInProfileSyncTask.next_execution <= datetime.utcnow()
        )

        if user_id:
            query = query.filter(LinkedInProfileSyncTask.user_id == user_id)

        tasks = query.all()
        return tasks

    except Exception as e:
        logger.error(f"Error loading LinkedIn profile sync tasks: {str(e)}")
        return []
