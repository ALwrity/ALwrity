"""
Facebook Persona Scheduler
Handles scheduled generation of Facebook personas after onboarding.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any
from loguru import logger

from services.database import get_db_session
from services.persona_data_service import PersonaDataService
from services.persona.facebook.facebook_persona_service import FacebookPersonaService
from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService



async def generate_facebook_persona_task(user_id: str):
    """
    Async task function to generate Facebook persona for a user.
    
    This function is called by the scheduler 20 minutes after onboarding completion.
    
    Args:
        user_id: User ID (Clerk string)
    """
    db = None
    try:
        logger.info(f"Scheduled Facebook persona generation started for user {user_id}")
        
        # Use user-specific session
        db = get_db_session(user_id)
        if not db:
            logger.error(f"Failed to get database session for Facebook persona generation (user: {user_id})")
            return
        
        # Get persona data service
        persona_data_service = PersonaDataService(db_session=db)
        
        # Get core persona (required for Facebook persona)
        persona_data = persona_data_service.get_user_persona_data(user_id)
        if not persona_data or not persona_data.get('core_persona'):
            logger.warning(f"No core persona found for user {user_id}, cannot generate Facebook persona")
            return
        
        core_persona = persona_data.get('core_persona', {})
        
        # Get onboarding data for context using SSOT
        integration_service = OnboardingDataIntegrationService()
        integrated_data = integration_service.get_integrated_data_sync(user_id, db)
        
        website_analysis = integrated_data.get('website_analysis', {})
        research_prefs = integrated_data.get('research_preferences', {})
        
        onboarding_data = {
            "website_url": website_analysis.get('website_url', '') if website_analysis else '',
            "writing_style": website_analysis.get('writing_style', {}) if website_analysis else {},
            "content_characteristics": website_analysis.get('content_characteristics', {}) if website_analysis else {},
            "target_audience": website_analysis.get('target_audience', '') if website_analysis else '',
            "research_preferences": research_prefs or {}
        }
        
        # Check if persona already exists to avoid unnecessary API calls
        platform_personas = persona_data.get('platform_personas', {}) if persona_data else {}
        if platform_personas.get('facebook'):
            logger.info(f"Facebook persona already exists for user {user_id}, skipping generation")
            return
        
        start_time = datetime.utcnow()
        # Generate Facebook persona
        facebook_service = FacebookPersonaService()
        try:
            generated_persona = facebook_service.generate_facebook_persona(
                core_persona,
                onboarding_data,
                user_id=user_id,
            )
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            if generated_persona and "error" not in generated_persona:
                # Save to database
                success = persona_data_service.save_platform_persona(user_id, 'facebook', generated_persona)
                if success:
                    logger.info(f"Scheduled Facebook persona generation completed for user {user_id}")
                else:
                    error_msg = f"Failed to save Facebook persona for user {user_id}"
                    logger.warning(f"Failed to save Facebook persona for user {user_id}")
            else:
                error_msg = f"Scheduled Facebook persona generation failed for user {user_id}: {generated_persona}"
                logger.error(f"Scheduled Facebook persona generation failed for user {user_id}: {generated_persona}")
        except Exception as gen_error:
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            error_msg = f"Exception during scheduled Facebook persona generation for user {user_id}: {str(gen_error)}. Expensive API call may have been made."
            logger.error(f"Exception during scheduled Facebook persona generation for user {user_id}: {str(gen_error)}. Expensive API call may have been made.")
            
    except Exception as e:
        logger.error(f"Error in scheduled Facebook persona generation for user {user_id}: {e}")
    finally:
        if db:
            try:
                db.close()
            except Exception as e:
                logger.error(f"Error closing database session: {e}")


def schedule_facebook_persona_generation(user_id: str, delay_minutes: int = 20) -> str:
    """
    Schedule Facebook persona generation for a user after a delay.
    
    Args:
        user_id: User ID (Clerk string)
        delay_minutes: Delay in minutes before generating persona (default: 20)
        
    Returns:
        Job ID
    """
    try:
        from services.scheduler import get_scheduler
        
        scheduler = get_scheduler()
        
        # Calculate run date (current time + delay) - ensure UTC timezone-aware
        run_date = datetime.now(timezone.utc) + timedelta(minutes=delay_minutes)
        
        # Generate consistent job ID (without timestamp) for proper restoration
        # This allows restoration to find and restore the job with original scheduled time
        # Note: Clerk user_id already includes "user_" prefix, so we don't add it again
        job_id = f"facebook_persona_{user_id}"
        
        # Schedule the task
        scheduled_job_id = scheduler.schedule_one_time_task(
            func=generate_facebook_persona_task,
            run_date=run_date,
            job_id=job_id,
            kwargs={"user_id": user_id},
            replace_existing=True
        )
        
        logger.info(
            f"Scheduled Facebook persona generation for user {user_id} "
            f"at {run_date} (job_id: {scheduled_job_id})"
        )
        
        return scheduled_job_id
        
    except Exception as e:
        logger.error(f"Failed to schedule Facebook persona generation for user {user_id}: {e}")
        raise

