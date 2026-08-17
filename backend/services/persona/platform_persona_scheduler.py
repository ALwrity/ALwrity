"""
Generic Platform Persona Scheduler

Generates a single platform persona in the background after onboarding
completes. Used by ``schedule_step4_tasks`` to schedule one job per
scheduled platform (facebook, twitter, instagram, youtube, podcast) so all
personas are ready shortly after onboarding without blocking the user.

The generation path mirrors the on-demand endpoint: build onboarding context
from SSOT, then call ``CorePersonaService._generate_single_platform_persona``
(which short-circuits linkedin/facebook to their dedicated services and uses
the generic prompt for everything else), then persist via
``PersonaDataService.save_platform_persona``.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Dict, Any
from loguru import logger

from services.database import get_db_session
from services.persona_data_service import PersonaDataService
from services.persona.core_persona.core_persona_service import CorePersonaService
from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService


async def generate_platform_persona_task(user_id: str, platform: str) -> None:
    """Generate a single platform persona in the background (scheduler task)."""
    db = None
    try:
        logger.info(f"Scheduled {platform} persona generation started for user {user_id}")

        db = get_db_session(user_id)
        if not db:
            logger.error(f"Failed to get database session for {platform} persona generation (user: {user_id})")
            return

        persona_data_service = PersonaDataService(db_session=db)
        persona_data = persona_data_service.get_user_persona_data(user_id)
        if not persona_data or not persona_data.get('core_persona'):
            logger.warning(f"No core persona found for user {user_id}, cannot generate {platform} persona")
            return

        core_persona = persona_data.get('core_persona', {})

        # Skip if already generated.
        platform_personas = persona_data.get('platform_personas', {}) if persona_data else {}
        if platform_personas.get(platform):
            logger.info(f"{platform} persona already exists for user {user_id}, skipping generation")
            return

        # Build onboarding context from SSOT.
        integration_service = OnboardingDataIntegrationService()
        integrated_data = integration_service.get_integrated_data_sync(user_id, db)
        website_analysis = integrated_data.get('website_analysis', {}) if isinstance(integrated_data, dict) else {}
        research_prefs = integrated_data.get('research_preferences', {}) if isinstance(integrated_data, dict) else {}

        onboarding_data = {
            "session_info": {"user_id": user_id},
            "website_url": website_analysis.get('website_url', '') if website_analysis else '',
            "writing_style": website_analysis.get('writing_style', {}) if website_analysis else {},
            "content_characteristics": website_analysis.get('content_characteristics', {}) if website_analysis else {},
            "target_audience": website_analysis.get('target_audience', '') if website_analysis else '',
            "research_preferences": research_prefs or {},
        }

        start_time = datetime.utcnow()
        try:
            core_service = CorePersonaService()
            generated = await asyncio.get_event_loop().run_in_executor(
                None,
                core_service._generate_single_platform_persona,
                core_persona,
                platform,
                onboarding_data,
            )
            execution_time = (datetime.utcnow() - start_time).total_seconds()

            if generated and "error" not in generated:
                success = persona_data_service.save_platform_persona(user_id, platform, generated)
                if success:
                    logger.info(
                        f"Scheduled {platform} persona generation completed for user {user_id} "
                        f"({execution_time:.1f}s)"
                    )
                    # Index the freshly generated platform persona into SIF so
                    # agents can retrieve it as soon as it is ready (incremental,
                    # idempotent upsert — never blocks this task on failure).
                    try:
                        from api.onboarding_utils.onboarding_task_scheduler import _sync_persona_to_sif
                        await _sync_persona_to_sif(user_id)
                    except Exception as sif_err:
                        logger.warning(f"Persona SIF sync failed for {platform} (user {user_id}): {sif_err}")

                    # Rebuild the Brand Brain (canonical_profile) so it picks up the
                    # new platform persona. Awaited within this background task;
                    # a failure is tolerated and never blocks the task.
                    try:
                        await integration_service.refresh_integrated_data(user_id, db)
                    except Exception as refresh_err:
                        logger.warning(f"Brand Brain refresh failed for {platform} (user {user_id}): {refresh_err}")
                else:
                    logger.warning(f"Failed to save {platform} persona for user {user_id}")
            else:
                logger.error(f"Scheduled {platform} persona generation failed for user {user_id}: {generated}")
        except Exception as gen_error:
            logger.error(
                f"Exception during scheduled {platform} persona generation for user {user_id}: {str(gen_error)}. "
                "Expensive API call may have been made."
            )
    except Exception as e:
        logger.error(f"Error in scheduled {platform} persona generation for user {user_id}: {e}")
    finally:
        if db:
            try:
                db.close()
            except Exception as e:
                logger.error(f"Error closing database session: {e}")


def schedule_platform_persona_generation(user_id: str, platform: str, delay_minutes: int = 20) -> str:
    """Schedule a single platform persona generation after a delay."""
    try:
        from services.scheduler import get_scheduler

        scheduler = get_scheduler()
        run_date = datetime.now(timezone.utc) + timedelta(minutes=delay_minutes)
        # Consistent job id so restoration can find + restore it after a restart.
        job_id = f"persona_{platform}_{user_id}"

        scheduled_job_id = scheduler.schedule_one_time_task(
            func=generate_platform_persona_task,
            run_date=run_date,
            job_id=job_id,
            kwargs={"user_id": user_id, "platform": platform},
            replace_existing=True,
        )

        logger.info(
            f"Scheduled {platform} persona generation for user {user_id} "
            f"at {run_date} (job_id: {scheduled_job_id})"
        )
        return scheduled_job_id
    except Exception as e:
        logger.error(f"Failed to schedule {platform} persona generation for user {user_id}: {e}")
        raise
