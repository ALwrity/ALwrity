from datetime import datetime
from typing import List, Optional

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from models.website_analysis_monitoring_models import DeepCompetitorAnalysisTask
from utils.logger_utils import get_service_logger

logger = get_service_logger("deep_competitor_analysis_task_loader")


def load_due_deep_competitor_analysis_tasks(
    db: Session,
    user_id: Optional[str] = None
) -> List[DeepCompetitorAnalysisTask]:
    try:
        now = datetime.utcnow()

        query = db.query(DeepCompetitorAnalysisTask).filter(
            and_(
                DeepCompetitorAnalysisTask.status == 'active',
                or_(
                    DeepCompetitorAnalysisTask.next_execution <= now,
                    DeepCompetitorAnalysisTask.next_execution.is_(None)
                )
            )
        )

        if user_id is not None:
            query = query.filter(DeepCompetitorAnalysisTask.user_id == user_id)

        return query.all()
    except Exception as e:
        logger.error(f"Error loading deep competitor analysis tasks: {e}")
        return []

