"""
Onboarding Control Service
Handles onboarding session control and management.
"""

from typing import Dict, Any
from fastapi import HTTPException
from loguru import logger

class OnboardingControlService:
    """Service for handling onboarding control operations."""
    
    def __init__(self):
        pass
    
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
