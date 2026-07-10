"""
LinkedIn Growth Reanalysis Task Loader
Loads due LinkedIn growth reanalysis tasks from the database.
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from models.linkedin_monitoring_models import LinkedInGrowthReanalysisTask
from utils.logger_utils import get_service_logger

logger = get_service_logger("linkedin_growth_reanalysis_task_loader")


def load_due_linkedin_growth_reanalysis_tasks(db: Session, user_id: Optional[str] = None) -> List[LinkedInGrowthReanalysisTask]:
    """
    Load LinkedIn growth reanalysis tasks that are due for execution.

    Args:
        db: Database session
        user_id: Optional user_id to filter by

    Returns:
        List of LinkedInGrowthReanalysisTask objects
    """
    try:
        query = db.query(LinkedInGrowthReanalysisTask).filter(
            or_(
                LinkedInGrowthReanalysisTask.status == "pending",
                LinkedInGrowthReanalysisTask.status == "active",
                LinkedInGrowthReanalysisTask.status == "failed",
            ),
            LinkedInGrowthReanalysisTask.next_execution <= datetime.utcnow()
        )

        if user_id:
            query = query.filter(LinkedInGrowthReanalysisTask.user_id == user_id)

        tasks = query.all()
        return tasks

    except Exception as e:
        logger.error(f"Error loading LinkedIn growth reanalysis tasks: {str(e)}")
        return []
