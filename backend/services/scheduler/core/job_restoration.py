"""
Job Restoration
Handles restoration of one-time jobs (e.g., persona generation) on scheduler startup.
Preserves original scheduled times from database to avoid rescheduling on server restarts.
"""

from typing import TYPE_CHECKING
from datetime import datetime, timezone, timedelta
from utils.logger_utils import get_service_logger
from services.database import get_db_session, get_all_user_ids, get_session_for_user
from models.scheduler_models import SchedulerEventLog

if TYPE_CHECKING:
    from .scheduler import TaskScheduler

logger = get_service_logger("job_restoration")


async def restore_persona_jobs(scheduler: 'TaskScheduler'):
    """
    Restore one-time persona generation jobs for users who completed onboarding
    but don't have personas yet. This ensures jobs persist across server restarts.
    
    IMPORTANT: Preserves original scheduled times from SchedulerEventLog to avoid
    rescheduling jobs with new times on server restarts.
    
    Args:
        scheduler: TaskScheduler instance
    """
    try:
        user_ids = get_all_user_ids()
        logger.info(f"[Restoration] Found {len(user_ids)} users to check for persona jobs")
        
        for user_id in user_ids:
            db = get_session_for_user(user_id)
            if not db:
                logger.warning(f"Could not get database session for user {user_id}")
                continue
            
            try:
                from models.onboarding import OnboardingSession
                from services.research.research_persona_scheduler import (
                    schedule_research_persona_generation,
                    generate_research_persona_task
                )
                from services.persona.facebook.facebook_persona_scheduler import (
                    schedule_facebook_persona_generation,
                    generate_facebook_persona_task
                )
                from services.research.research_persona_service import ResearchPersonaService
                from services.persona_data_service import PersonaDataService
                
                # Check if user completed onboarding
                session = db.query(OnboardingSession).filter(
                    OnboardingSession.user_id == user_id
                ).order_by(OnboardingSession.updated_at.desc()).first()
                
                if not session or session.progress < 100.0:
                    continue
                
                restored_count = 0
                skipped_count = 0
                now = datetime.utcnow().replace(tzinfo=timezone.utc)
                
                # Restore research persona job
                try:
                    research_service = ResearchPersonaService(db_session=db)
                    persona_data_record = research_service._get_persona_data_record(user_id)
                    research_persona_exists = False
                    
                    if persona_data_record:
                        research_persona_data = getattr(persona_data_record, 'research_persona', None)
                        research_persona_exists = bool(research_persona_data)
                    
                    if not research_persona_exists:
                        # Note: Clerk user_id already includes "user_" prefix if applicable, or we use the string as is
                        job_id = f"research_persona_{user_id}"
                        
                        # Check if job already exists in scheduler (just started, so unlikely)
                        existing_jobs = [j for j in scheduler.scheduler.get_jobs() 
                                        if j.id == job_id]
                        
                        if not existing_jobs:
                            try:
                                original_scheduled_event = db.query(SchedulerEventLog).filter(
                                    SchedulerEventLog.event_type == 'job_scheduled',
                                    SchedulerEventLog.job_id == job_id,
                                    SchedulerEventLog.user_id == user_id
                                ).order_by(SchedulerEventLog.event_date.desc()).first()
                                
                                completed_event = db.query(SchedulerEventLog).filter(
                                    SchedulerEventLog.event_type.in_(['job_completed', 'job_failed']),
                                    SchedulerEventLog.job_id == job_id,
                                    SchedulerEventLog.user_id == user_id
                                ).order_by(SchedulerEventLog.event_date.desc()).first()
                            except Exception:
                                original_scheduled_event = None
                                completed_event = None
                                logger.warning(f"SchedulerEventLog query failed for {job_id}, scheduling new job")
                            
                            if completed_event:
                                # Job was already completed/failed, skip
                                skipped_count += 1
                                logger.debug(f"Research persona job {job_id} already completed/failed, skipping restoration")
                            elif original_scheduled_event and original_scheduled_event.event_data:
                                # Restore with original scheduled time
                                scheduled_for_str = original_scheduled_event.event_data.get('scheduled_for')
                                if scheduled_for_str:
                                    try:
                                        original_time = datetime.fromisoformat(scheduled_for_str.replace('Z', '+00:00'))
                                        if original_time.tzinfo is None:
                                            original_time = original_time.replace(tzinfo=timezone.utc)
                                        
                                        # Check if original time is in the past (within grace period)
                                        time_since_scheduled = (now - original_time).total_seconds()
                                        if time_since_scheduled > 0 and time_since_scheduled <= 3600:  # Within 1 hour grace period
                                            # Execute immediately (missed job)
                                            logger.warning(f"Restoring research persona job {job_id} - original time was {original_time}, executing now (missed)")
                                            try:
                                                await generate_research_persona_task(user_id)
                                            except Exception as exec_error:
                                                logger.error(f"Error executing missed research persona job {job_id}: {exec_error}")
                                        elif original_time > now:
                                            # Restore with original future time
                                            time_until_run = (original_time - now).total_seconds() / 60  # minutes
                                            logger.warning(
                                                f"[Restoration] Restoring research persona job {job_id} with ORIGINAL scheduled time: "
                                                f"{original_time} (UTC) = {original_time.astimezone().strftime('%H:%M:%S %Z')} (local), "
                                                f"will run in {time_until_run:.1f} minutes"
                                            )
                                            scheduler.schedule_one_time_task(
                                                func=generate_research_persona_task,
                                                run_date=original_time,
                                                job_id=job_id,
                                                kwargs={'user_id': user_id},
                                                replace_existing=True
                                            )
                                            restored_count += 1
                                        else:
                                            # Too old (beyond grace period), skip
                                            skipped_count += 1
                                            logger.debug(f"Research persona job {job_id} scheduled time {original_time} is too old, skipping")
                                    except Exception as time_error:
                                        logger.warning(f"Error parsing original scheduled time for {job_id}: {time_error}, scheduling new job")
                                        # Fall through to schedule new job
                                        schedule_research_persona_generation(user_id, delay_minutes=20)
                                        restored_count += 1
                                else:
                                    # No original time in event data, schedule new job
                                    logger.warning(
                                        f"[Restoration] No original scheduled time found for research persona job {job_id}, "
                                        f"scheduling NEW job with current time + 20 minutes"
                                    )
                                    schedule_research_persona_generation(user_id, delay_minutes=20)
                                    restored_count += 1
                            else:
                                # No previous scheduled event, schedule new job
                                logger.warning(
                                    f"[Restoration] No previous scheduled event found for research persona job {job_id}, "
                                    f"scheduling NEW job with current time + 20 minutes"
                                )
                                schedule_research_persona_generation(user_id, delay_minutes=20)
                                restored_count += 1
                        else:
                            skipped_count += 1
                            logger.debug(f"Research persona job {job_id} already exists in scheduler, skipping restoration")
                except Exception as e:
                    logger.debug(f"Could not restore research persona for user {user_id}: {e}")
                
                # Restore Facebook persona job
                try:
                    persona_data_service = PersonaDataService(db_session=db)
                    persona_data = persona_data_service.get_user_persona_data(user_id)
                    platform_personas = persona_data.get('platform_personas', {}) if persona_data else {}
                    facebook_persona_exists = bool(platform_personas.get('facebook') if platform_personas else None)
                    has_core_persona = bool(persona_data.get('core_persona') if persona_data else False)
                    
                    if not facebook_persona_exists and has_core_persona:
                        # Note: Clerk user_id already includes "user_" prefix
                        job_id = f"facebook_persona_{user_id}"
                        
                        # Check if job already exists in scheduler
                        existing_jobs = [j for j in scheduler.scheduler.get_jobs() 
                                        if j.id == job_id]
                        
                        if not existing_jobs:
                            try:
                                original_scheduled_event = db.query(SchedulerEventLog).filter(
                                    SchedulerEventLog.event_type == 'job_scheduled',
                                    SchedulerEventLog.job_id == job_id,
                                    SchedulerEventLog.user_id == user_id
                                ).order_by(SchedulerEventLog.event_date.desc()).first()
                                
                                completed_event = db.query(SchedulerEventLog).filter(
                                    SchedulerEventLog.event_type.in_(['job_completed', 'job_failed']),
                                    SchedulerEventLog.job_id == job_id,
                                    SchedulerEventLog.user_id == user_id
                                ).order_by(SchedulerEventLog.event_date.desc()).first()
                            except Exception:
                                original_scheduled_event = None
                                completed_event = None
                                logger.warning(f"SchedulerEventLog query failed for {job_id}, scheduling new job")
                            
                            if completed_event:
                                skipped_count += 1
                                logger.debug(f"Facebook persona job {job_id} already completed/failed, skipping restoration")
                            elif original_scheduled_event and original_scheduled_event.event_data:
                                # Restore with original scheduled time
                                scheduled_for_str = original_scheduled_event.event_data.get('scheduled_for')
                                if scheduled_for_str:
                                    try:
                                        original_time = datetime.fromisoformat(scheduled_for_str.replace('Z', '+00:00'))
                                        if original_time.tzinfo is None:
                                            original_time = original_time.replace(tzinfo=timezone.utc)
                                        
                                        # Check if original time is in the past (within grace period)
                                        time_since_scheduled = (now - original_time).total_seconds()
                                        if time_since_scheduled > 0 and time_since_scheduled <= 3600:  # Within 1 hour grace period
                                            # Execute immediately (missed job)
                                            logger.warning(f"Restoring Facebook persona job {job_id} - original time was {original_time}, executing now (missed)")
                                            try:
                                                await generate_facebook_persona_task(user_id)
                                            except Exception as exec_error:
                                                logger.error(f"Error executing missed Facebook persona job {job_id}: {exec_error}")
                                        elif original_time > now:
                                            # Restore with original future time
                                            time_until_run = (original_time - now).total_seconds() / 60  # minutes
                                            logger.warning(
                                                f"[Restoration] Restoring Facebook persona job {job_id} with ORIGINAL scheduled time: "
                                                f"{original_time} (UTC) = {original_time.astimezone().strftime('%H:%M:%S %Z')} (local), "
                                                f"will run in {time_until_run:.1f} minutes"
                                            )
                                            scheduler.schedule_one_time_task(
                                                func=generate_facebook_persona_task,
                                                run_date=original_time,
                                                job_id=job_id,
                                                kwargs={'user_id': user_id},
                                                replace_existing=True
                                            )
                                            restored_count += 1
                                        else:
                                            skipped_count += 1
                                            logger.debug(f"Facebook persona job {job_id} scheduled time {original_time} is too old, skipping")
                                    except Exception as time_error:
                                        logger.warning(f"Error parsing original scheduled time for {job_id}: {time_error}, scheduling new job")
                                        schedule_facebook_persona_generation(user_id, delay_minutes=20)
                                        restored_count += 1
                                else:
                                    logger.warning(
                                        f"[Restoration] No original scheduled time found for Facebook persona job {job_id}, "
                                        f"scheduling NEW job with current time + 20 minutes"
                                    )
                                    schedule_facebook_persona_generation(user_id, delay_minutes=20)
                                    restored_count += 1
                            else:
                                # No previous scheduled event, schedule new job
                                logger.warning(
                                    f"[Restoration] No previous scheduled event found for Facebook persona job {job_id}, "
                                    f"scheduling NEW job with current time + 20 minutes"
                                )
                                schedule_facebook_persona_generation(user_id, delay_minutes=20)
                                restored_count += 1
                        else:
                            skipped_count += 1
                            logger.debug(f"Facebook persona job {job_id} already exists in scheduler, skipping restoration")
                except Exception as e:
                    logger.debug(f"Could not restore Facebook persona for user {user_id}: {e}")
            
                if restored_count > 0:
                    logger.warning(f"[Scheduler] ✅ Restored {restored_count} persona generation job(s) for user {user_id}")
                if skipped_count > 0:
                    logger.debug(f"[Scheduler] Skipped {skipped_count} persona job(s) for user {user_id}")
                    
            finally:
                db.close()
            
    except Exception as e:
        logger.warning(f"Error restoring persona jobs: {e}")

