"""
Onboarding Full Website Analysis Task Loader
Functions to load due onboarding full-site SEO audit tasks from database.
"""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from models.website_analysis_monitoring_models import OnboardingFullWebsiteAnalysisTask
from utils.logger_utils import get_service_logger

logger = get_service_logger("onboarding_full_website_analysis_task_loader")


def load_due_onboarding_full_website_analysis_tasks(
    db: Session,
    user_id: Optional[str] = None
) -> List[OnboardingFullWebsiteAnalysisTask]:
    try:
        now = datetime.utcnow()

        query = db.query(OnboardingFullWebsiteAnalysisTask).filter(
            and_(
                OnboardingFullWebsiteAnalysisTask.status == 'active',
                or_(
                    OnboardingFullWebsiteAnalysisTask.next_execution <= now,
                    OnboardingFullWebsiteAnalysisTask.next_execution.is_(None)
                )
            )
        )

        if user_id is not None:
            query = query.filter(OnboardingFullWebsiteAnalysisTask.user_id == user_id)

        return query.all()
    except Exception as e:
        logger.error(f"Error loading onboarding full website analysis tasks: {e}")
        return []

