"""
Onboarding Control Service
Handles onboarding session control and management.
"""

from typing import Dict, Any
from fastapi import HTTPException
from loguru import logger

from services.onboarding.api_key_manager import get_onboarding_progress, get_onboarding_progress_for_user
from services.database import get_db
from services.user_workspace_manager import UserWorkspaceManager

class OnboardingControlService:
    """Service for handling onboarding control operations."""
    
    def __init__(self):
        pass
    
    async def start_onboarding(self, current_user: Dict[str, Any]) -> Dict[str, Any]:
        """Start a new onboarding session."""
        db_gen = get_db()
        db = next(db_gen)
        try:
            user_id = str(current_user.get('clerk_user_id') or current_user.get('id'))
            
            # Ensure user workspace exists when starting onboarding
            try:
                workspace_manager = UserWorkspaceManager(db)
                workspace_manager.create_user_workspace(user_id)
                logger.info(f"Verified/Created workspace for user {user_id} at start of onboarding")
            except Exception as e:
                logger.error(f"Failed to create workspace for user {user_id}: {e}")
                # Don't fail onboarding just because workspace creation failed, 
                # but log it. It might exist or be a permission issue.
            
            progress = get_onboarding_progress_for_user(user_id)
            progress.reset_progress()
            
            return {
                "message": "Onboarding started successfully",
                "current_step": progress.current_step,
                "started_at": progress.started_at
            }
        except Exception as e:
            logger.error(f"Error starting onboarding: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error")
        finally:
            if 'db' in locals():
                db.close()
    
    async def reset_onboarding(self, current_user: Dict[str, Any], hard: bool = False) -> Dict[str, Any]:
        """Reset the onboarding progress for a specific user and cancel scheduled tasks.

        Args:
            current_user: The authenticated user dict.
            hard: If True, delete all session & task records (clean slate).
                  If False, just reset step to 1 and pause tasks.
        """
        try:
            from services.onboarding.progress_service import OnboardingProgressService
            user_id = str(current_user.get('clerk_user_id') or current_user.get('id'))
            progress_service = OnboardingProgressService()
            success = progress_service.reset_onboarding(user_id, hard=hard)

            if not success:
                raise HTTPException(status_code=500, detail="Failed to reset onboarding progress")

            # Cancel APScheduler jobs for this user
            cancelled_jobs = []
            try:
                from services.scheduler import get_scheduler
                scheduler = get_scheduler()
                if not scheduler.is_running:
                    logger.warning(f"[SCHEDULER] Scheduler not running — job removal for {user_id} may not persist")
                # One-shot persona jobs
                for job_id_suffix in ["research_persona", "facebook_persona"]:
                    job_id = f"{job_id_suffix}_{user_id}"
                    try:
                        scheduler.scheduler.remove_job(job_id)
                        cancelled_jobs.append(job_id)
                    except Exception:
                        pass
                # Recurring schedule jobs (advertools, etc.) named with user_id prefix
                for job in scheduler.scheduler.get_jobs():
                    if job.id and user_id in job.id:
                        try:
                            scheduler.scheduler.remove_job(job.id)
                            cancelled_jobs.append(job.id)
                        except Exception:
                            pass
            except Exception as e:
                logger.warning(f"Could not cancel APScheduler jobs for user {user_id}: {e}")

            mode = "hard" if hard else "soft"
            return {
                "message": f"Onboarding {mode} reset successfully",
                "reset_mode": mode,
                "current_step": 1,
                "started_at": None,
                "user_id": user_id,
                "cancelled_jobs": cancelled_jobs if cancelled_jobs else None,
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error resetting onboarding: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error")
    
    async def get_resume_info(self) -> Dict[str, Any]:
        """Get information for resuming onboarding."""
        try:
            progress = get_onboarding_progress()
            
            if progress.is_completed:
                return {
                    "can_resume": False,
                    "message": "Onboarding is already completed",
                    "completion_percentage": 100.0
                }
            
            resume_step = progress.get_resume_step()
            
            return {
                "can_resume": True,
                "resume_step": resume_step,
                "current_step": progress.current_step,
                "completion_percentage": progress.get_completion_percentage(),
                "started_at": progress.started_at,
                "last_updated": progress.last_updated
            }
        except Exception as e:
            logger.error(f"Error getting resume info: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error")
