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

async def restore_advertools_tasks(scheduler: Any) -> int:
    """
    Restore/create Advertools tasks for all users who have completed Step 2.
    
    Returns:
        Number of tasks created/restored
    """
    logger.info("Restoring Advertools intelligence tasks...")
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
                
                # Check for existing Advertools tasks
                existing_audit = db.query(AdvertoolsTask).filter(
                    AdvertoolsTask.user_id == user_id,
                    func.json_extract(AdvertoolsTask.payload, '$.type') == 'content_audit'
                ).first()
                if existing_audit:
                    total_existing += 1
                
                if not existing_audit:
                    # Create weekly content audit task
                    new_audit = AdvertoolsTask(
                        user_id=user_id,
                        website_url=analysis.website_url,
                        status='active',
                        next_execution=datetime.utcnow() + timedelta(days=1), # Start tomorrow
                        frequency_days=7,
                        payload={
                            "type": "content_audit",
                            "website_url": analysis.website_url
                        }
                    )
                    db.add(new_audit)
                    db.commit()
                    total_created += 1
                    logger.info(f"Created weekly content audit task for user {user_id}")
                
                existing_health = db.query(AdvertoolsTask).filter(
                    AdvertoolsTask.user_id == user_id,
                    func.json_extract(AdvertoolsTask.payload, '$.type') == 'site_health'
                ).first()
                if existing_health:
                    total_existing += 1
                
                if not existing_health:
                    # Create weekly site health task
                    new_health = AdvertoolsTask(
                        user_id=user_id,
                        website_url=analysis.website_url,
                        status='active',
                        next_execution=datetime.utcnow() + timedelta(days=2), # Start in 2 days
                        frequency_days=7,
                        payload={
                            "type": "site_health",
                            "website_url": analysis.website_url
                        }
                    )
                    db.add(new_health)
                    db.commit()
                    total_created += 1
                    logger.info(f"Created weekly site health task for user {user_id}")
                
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error restoring Advertools tasks for user {user_id}: {e}")
            
    return total_existing + total_created
