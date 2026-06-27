"""
Research Persona Scheduler
Handles scheduled generation of research personas after onboarding.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any
from loguru import logger

from services.database import get_db_session
from services.research.research_persona_service import ResearchPersonaService



async def generate_research_persona_task(user_id: str):
    """
    Async task function to generate research persona for a user.
    
    This function is called by the scheduler 20 minutes after onboarding completion.
    
    Args:
        user_id: User ID (Clerk string)
    """
    db = None
    try:
        logger.info(f"Scheduled research persona generation started for user {user_id}")
        
        # Get database session
        db = get_db_session(user_id)
        if not db:
            logger.error(f"Failed to get database session for research persona generation (user: {user_id})")
            return
        
        # Generate research persona
        persona_service = ResearchPersonaService(db_session=db)
        
        # Check if persona already exists to avoid unnecessary API calls
        persona_data = persona_service._get_persona_data_record(user_id)
        if persona_data and persona_data.research_persona:
            logger.info(f"Research persona already exists for user {user_id}, skipping generation")
            return
        
        start_time = datetime.utcnow()
        try:
            research_persona = persona_service.get_or_generate(user_id, force_refresh=False)
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            if research_persona:
                logger.info(f"Scheduled research persona generation completed for user {user_id}")
            else:
                error_msg = (
                    f"Scheduled research persona generation FAILED for user {user_id}. "
                    f"Expensive API call was made but generation failed. "
                    f"Will NOT automatically retry to prevent wasteful API calls."
                )
                logger.error(f"Scheduled research persona generation FAILED for user {user_id}")
                # DO NOT reschedule - this prevents infinite retry loops
                # User can manually trigger generation from frontend if needed
                
                # DO NOT reschedule - this prevents infinite retry loops
                # User can manually trigger generation from frontend if needed
        except Exception as gen_error:
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            error_msg = (
                f"Exception during scheduled research persona generation for user {user_id}: {str(gen_error)}. "
                f"Expensive API call may have been made. Will NOT automatically retry."
            )
            logger.error(f"Exception during scheduled research persona generation for user {user_id}: {str(gen_error)}")
            # DO NOT reschedule - prevent infinite retry loops
            
    except Exception as e:
        logger.error(f"Error in scheduled research persona generation for user {user_id}: {e}")
    finally:
        if db:
            try:
                db.close()
            except Exception as e:
                logger.error(f"Error closing database session: {e}")


def schedule_research_persona_generation(user_id: str, delay_minutes: int = 20) -> str:
    """
    Schedule research persona generation for a user after a delay.
    
    Args:
        user_id: User ID (Clerk string)
        delay_minutes: Delay in minutes before generating persona (default: 20)
        
    Returns:
        Job ID
    """
    try:
        from services.scheduler import get_scheduler
        
        scheduler = get_scheduler()
        if not scheduler.is_running:
            logger.warning(f"[SCHEDULER] Scheduler not running — research persona job for {user_id} will not execute until started")

        # Calculate run date (current time + delay) - ensure UTC timezone-aware
        run_date = datetime.now(timezone.utc) + timedelta(minutes=delay_minutes)
        
        # Generate consistent job ID (without timestamp) for proper restoration
        # This allows restoration to find and restore the job with original scheduled time
        # Note: Clerk user_id already includes "user_" prefix, so we don't add it again
        job_id = f"research_persona_{user_id}"
        
        # Schedule the task
        scheduled_job_id = scheduler.schedule_one_time_task(
            func=generate_research_persona_task,
            run_date=run_date,
            job_id=job_id,
            kwargs={"user_id": user_id},
            replace_existing=True
        )
        
        logger.info(
            f"Scheduled research persona generation for user {user_id} "
            f"at {run_date} (job_id: {scheduled_job_id})"
        )
        
        return scheduled_job_id
        
    except Exception as e:
        logger.error(f"Failed to schedule research persona generation for user {user_id}: {e}")
        raise

