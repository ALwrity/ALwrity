"""
Advertools Task Restoration Utility
Handles creation and restoration of Advertools intelligence tasks for users.
"""

from datetime import datetime, timedelta
from typing import Any
from loguru import logger
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.onboarding import WebsiteAnalysis, OnboardingSession
from models.advertools_monitoring_models import AdvertoolsTask
from services.database import get_all_user_ids, get_session_for_user
from services.seo.advertools_task_upsert import upsert_advertools_task

_TASK_TYPES = [
    ("content_audit", 1),  # (type, start-in-days)
    ("site_health", 2),
]


async def restore_advertools_tasks(scheduler: Any) -> int:
    """
    Restore/create Advertools tasks for all users who have completed Step 2.

    Uses the canonical atomic upsert (keyed by user, site, type), so repeated
    calls never create duplicate rows even when a user has more than one
    WebsiteAnalysis or a concurrent restore races.

    Returns:
        Number of tasks created/restored
    """
    logger.debug("Restoring Advertools intelligence tasks...")
    total_created = 0
    total_existing = 0

    user_ids = get_all_user_ids()
    for user_id in user_ids:
        try:
            db = get_session_for_user(user_id)
            if not db:
                continue

            try:
                # Check if user has completed Step 2 (has WebsiteAnalysis)
                session = db.query(OnboardingSession).filter(OnboardingSession.user_id == user_id).first()
                if not session:
                    continue

                analysis = db.query(WebsiteAnalysis).filter(WebsiteAnalysis.session_id == session.id).first()
                if not analysis or not analysis.website_url:
                    continue

                for task_type, start_days in _TASK_TYPES:
                    existing = db.query(AdvertoolsTask).filter(
                        AdvertoolsTask.user_id == user_id,
                        func.json_extract(AdvertoolsTask.payload, '$.type') == task_type,
                    ).first()
                    if existing:
                        total_existing += 1
                        continue

                    upsert_advertools_task(
                        db,
                        user_id,
                        analysis.website_url,
                        task_type,
                        defaults={
                            "status": "active",
                            "next_execution": datetime.utcnow() + timedelta(days=start_days),
                            "frequency_days": 7,
                            "payload": {"website_url": analysis.website_url},
                        },
                    )
                    db.commit()
                    total_created += 1
                    logger.debug(f"Created weekly {task_type} task for user {user_id}")

            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error restoring Advertools tasks for user {user_id}: {e}")

    return total_existing + total_created
