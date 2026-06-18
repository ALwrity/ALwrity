"""
Website Analysis Task Restoration
Automatically creates missing website analysis tasks for users who completed onboarding
but don't have monitoring tasks created yet.
"""

from datetime import datetime, timedelta, timezone
from utils.logger_utils import get_service_logger

from services.database import get_all_user_ids, get_session_for_user
from models.website_analysis_monitoring_models import WebsiteAnalysisTask
from models.onboarding import OnboardingSession
from services.website_analysis_monitoring_service import generate_website_analysis_tasks_task

# Use service logger for consistent logging (WARNING level visible in production)
logger = get_service_logger("website_analysis_restoration")


async def restore_website_analysis_tasks(scheduler):
    """
    Restore/create missing website analysis tasks for all users.
    
    This checks all users who completed onboarding and ensures they have
    website analysis tasks created. Tasks are created for:
    - User's website (if analysis exists)
    - All competitors (from onboarding step 3)
    
    Args:
        scheduler: TaskScheduler instance
    """
    try:
        logger.warning("[Website Analysis Restoration] Starting website analysis task restoration...")
        
        user_ids = get_all_user_ids()
        total_created = 0
        users_processed = 0
        total_existing_tasks = 0
        
        for user_id in user_ids:
            try:
                db = get_session_for_user(user_id)
                if not db:
                    logger.warning(f"[Website Analysis Restoration] Could not get database session for user {user_id}")
                    continue
                
                try:
                    users_processed += 1
                    
                    # Check if table exists
                    try:
                        existing_user_tasks = db.query(WebsiteAnalysisTask).filter(
                            WebsiteAnalysisTask.user_id == user_id
                        ).all()
                        total_existing_tasks += len(existing_user_tasks)
                    except Exception as table_error:
                        logger.error(
                            f"[Website Analysis Restoration] ⚠️ WebsiteAnalysisTask table may not exist for user {user_id}: {table_error}"
                        )
                        continue
                    
                    if existing_user_tasks:
                        # User has tasks, we assume they are fine for now
                        continue
                        
                    # Check onboarding status
                    try:
                        from services.onboarding.progress_service import OnboardingProgressService
                        
                        # Use a local instance or static logic if service expects global DB (it shouldn't anymore)
                        # We can query OnboardingSession directly
                        session = db.query(OnboardingSession).filter(
                            OnboardingSession.user_id == user_id
                        ).order_by(OnboardingSession.updated_at.desc()).first()
                        
                        if not session:
                            continue
                            
                        # is_completed = (session.current_step >= 6) or (session.progress >= 100.0)
                        is_completed = (session.current_step >= 6) or (session.progress >= 100.0)
                        
                        if not is_completed:
                            continue
                            
                        logger.warning(
                            f"[Website Analysis Restoration] ⚠️ User {user_id} completed onboarding "
                            f"but has no website analysis tasks. Creating tasks..."
                        )
                        
                        job_id = f"website_analysis_tasks_{user_id}"
                        existing_jobs = [j for j in scheduler.scheduler.get_jobs() if j.id == job_id]
                        if existing_jobs:
                            continue

                        run_date = datetime.now(timezone.utc) + timedelta(minutes=5)
                        scheduler.schedule_one_time_task(
                            func=generate_website_analysis_tasks_task,
                            run_date=run_date,
                            job_id=job_id,
                            kwargs={"user_id": user_id},
                            replace_existing=True,
                        )
                        total_created += 1
                        logger.warning(
                            f"[Website Analysis Restoration] ✅ Scheduled website analysis task creation "
                            f"for user {user_id} at {run_date.isoformat()}"
                        )
                            
                    except Exception as e:
                        logger.warning(f"[Website Analysis Restoration] Could not check onboarding for user {user_id}: {e}")
                        
                finally:
                    db.close()
                    
            except Exception as e:
                logger.warning(f"[Website Analysis Restoration] Error processing user {user_id}: {e}")
        
        logger.warning(
            f"[Website Analysis Restoration] ✅ Completed. "
            f"Processed {users_processed} users. "
            f"Found {total_existing_tasks} existing tasks. "
            f"Created {total_created} new tasks."
        )
        
        return total_existing_tasks + total_created
            
    except Exception as e:
        logger.error(
            f"[Website Analysis Restoration] Error restoring website analysis tasks: {e}",
            exc_info=True
        )
        return 0

