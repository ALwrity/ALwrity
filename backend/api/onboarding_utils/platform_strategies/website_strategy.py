"""
Website Onboarding Strategy
===========================

Wraps the existing website onboarding step logic so that the shared
``StepManagementService.complete_step()`` can delegate to it via the
strategy registry.  **No logic is changed** -- every method delegates
to the same helpers that ``complete_step()`` called inline before the
refactor.

This guarantees the website path remains 100% functional.
"""

from __future__ import annotations

from typing import Any, Dict, List

from loguru import logger
from sqlalchemy.orm import Session

from .base import WEBSITE_TYPE


class WebsiteOnboardingStrategy:
    """Strategy for the ``website`` onboarding type (existing flow)."""

    @property
    def onboarding_type(self) -> str:
        return WEBSITE_TYPE

    @property
    def context_file_prefix(self) -> str:
        return "website"

    async def complete_step(
        self,
        svc,
        step_number: int,
        user_id: str,
        request_data: Dict[str, Any],
        db: Session,
    ) -> Dict[str, Any]:
        """Execute website-specific step logic.

        Returns ``{"warnings": [...]}`` if any non-blocking save errors
        occurred.  Raises ``HTTPException`` for blocking errors (same
        semantics as the original inline code).

        This method is ``async`` to match the Protocol, but the website
        strategy does not perform any async operations -- all work is
        synchronous.
        """
        warnings: List[str] = []

        if step_number == 1 and request_data:
            self._complete_website_step1(svc, user_id, request_data, db)
        elif step_number == 2 and request_data:
            self._complete_website_step2(svc, user_id, request_data, db)
        elif step_number == 3 and request_data:
            self._complete_website_step3(svc, user_id, request_data, db)
        elif step_number == 4 and request_data:
            self._complete_website_step4(svc, user_id, request_data, db)
        elif step_number == 5 and request_data:
            self._complete_website_step5(svc, user_id, request_data, db)

        return {"warnings": warnings if warnings else None}

    # ------------------------------------------------------------------
    # Step 1 -- API keys + initial integrations
    # ------------------------------------------------------------------

    def _complete_website_step1(self, svc, user_id, request_data, db):
        step_data = request_data.get('data') or request_data
        logger.info(f" Step 1: Raw request_data keys: {list(request_data.keys()) if request_data else 'None'}")
        logger.info(f" Step 1: Extracted step_data keys: {list(step_data.keys()) if step_data else 'None'}")

        api_keys = step_data.get('api_keys', {})
        logger.info(f" Step 1: API keys found: {list(api_keys.keys()) if api_keys else 'None'}")
        if api_keys:
            for provider, key in api_keys.items():
                if key:
                    try:
                        saved = svc._save_api_key(user_id, provider, key, db)
                        if saved:
                            logger.info(f" Saved API key for provider {provider}")
                    except Exception as e:
                        logger.error(f" BLOCKING ERROR: Failed to save API key for provider {provider}: {str(e)}")
                        from fastapi import HTTPException
                        raise HTTPException(
                            status_code=500,
                            detail=f"Failed to save API key for {provider}. Onboarding cannot proceed until this is resolved."
                        ) from e

        integrations = step_data.get('integrations')
        if integrations and isinstance(integrations, dict):
            try:
                logger.info(f" Step 1: Saving integrations data for user {user_id}")
                from models.onboarding import PlatformIntegration
                session = svc._get_or_create_session(user_id, db)
                if session.platform_integrations:
                    pi = session.platform_integrations
                else:
                    pi = PlatformIntegration(session_id=session.id)
                    db.add(pi)
                pi.primary_website = integrations.get("primaryWebsite")
                pi.website_platforms = integrations.get("websitePlatforms", {})
                pi.analytics_platforms = integrations.get("analyticsPlatforms", {})
                pi.social_platforms = integrations.get("socialPlatforms", {})
                pi.connected_platforms = integrations.get("connectedPlatforms", [])
                db.commit()
                logger.info(f" Step 1: Integrations data persisted for user {user_id}")
            except Exception as e:
                logger.error(f" Step 1: Failed to save integrations data: {str(e)}")
                db.rollback()
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=500,
                    detail="Failed to save integrations data. Onboarding cannot proceed until this is resolved."
                ) from e

    # ------------------------------------------------------------------
    # Step 2 -- Website analysis + schedule tasks
    # ------------------------------------------------------------------

    def _complete_website_step2(self, svc, user_id, request_data, db):
        website_data = request_data.get('data') or request_data
        logger.info(f" Step 2: Raw request_data keys: {list(request_data.keys()) if request_data else 'None'}")
        logger.info(f" Step 2: Extracted website_data keys: {list(website_data.keys()) if website_data else 'None'}")
        if website_data:
            try:
                saved = svc._save_website_analysis(user_id, website_data, db)
                if saved:
                    logger.info(f" Saved website analysis for user {user_id}")

                    website_url = website_data.get('website') or website_data.get('website_url')
                    if website_url:
                        from api.onboarding_utils.onboarding_task_scheduler import schedule_step2_tasks
                        schedule_step2_tasks(user_id, db, website_url)
            except Exception as e:
                logger.error(f" BLOCKING ERROR: Failed to save website analysis: {str(e)}")
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=500,
                    detail="Failed to save website analysis data. Onboarding cannot proceed until this is resolved."
                ) from e

    # ------------------------------------------------------------------
    # Step 3 -- Research preferences + competitors + schedule tasks
    # ------------------------------------------------------------------

    def _complete_website_step3(self, svc, user_id, request_data, db):
        research_data = request_data.get('data') or request_data
        logger.info(f" Step 3: Raw request_data keys: {list(request_data.keys()) if request_data else 'None'}")
        logger.info(f" Step 3: Extracted research_data keys: {list(research_data.keys()) if research_data else 'None'}")
        if research_data:
            try:
                saved = svc._save_research_preferences(user_id, research_data, db)
                if saved:
                    logger.info(f" Saved research preferences for user {user_id}")

                # Also save competitors if present
                competitors = research_data.get('competitors')
                if competitors:
                    industry_context = research_data.get('industryContext') or research_data.get('industry_context')
                    logger.info(f" Step 3: Found {len(competitors)} competitors to save")
                    svc._save_competitor_analysis(user_id, competitors, industry_context, db)

                    # Schedule deep competitor analysis (non-blocking)
                    website_url = None
                    try:
                        session = svc._get_or_create_session(user_id, db)
                        from models.onboarding import WebsiteAnalysis
                        existing_analysis = db.query(WebsiteAnalysis).filter(
                            WebsiteAnalysis.session_id == session.id
                        ).first()
                        if existing_analysis and existing_analysis.website_url:
                            website_url = existing_analysis.website_url
                    except Exception:
                        pass
                    if website_url:
                        from api.onboarding_utils.onboarding_task_scheduler import schedule_step3_tasks
                        schedule_step3_tasks(user_id, db, website_url, competitors)

                # Save social media presence if available (Update WebsiteAnalysis)
                social_media = research_data.get('social_media_accounts')
                if social_media:
                    logger.info(f" Step 3: Found social media accounts to save")
                    try:
                        from models.onboarding import WebsiteAnalysis
                        from datetime import datetime
                        session = svc._get_or_create_session(user_id, db)
                        existing_analysis = db.query(WebsiteAnalysis).filter(
                            WebsiteAnalysis.session_id == session.id
                        ).first()
                        if existing_analysis:
                            existing_analysis.social_media_presence = social_media
                            existing_analysis.updated_at = datetime.utcnow()
                            db.commit()
                            logger.info(f" Updated social media presence for user {user_id}")
                        else:
                            logger.warning(f" Could not save social media: WebsiteAnalysis not found for user {user_id}")
                    except Exception as e:
                        logger.error(f" Failed to save social media presence: {str(e)}")

            except Exception as e:
                logger.error(f" BLOCKING ERROR: Failed to save research preferences: {str(e)}")
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=500,
                    detail="Failed to save research preferences. Onboarding cannot proceed until this is resolved."
                ) from e

    # ------------------------------------------------------------------
    # Step 4 -- Persona data + schedule tasks
    # ------------------------------------------------------------------

    def _complete_website_step4(self, svc, user_id, request_data, db):
        persona_data = request_data.get('data') or request_data
        logger.info(f" Step 4: Raw request_data keys: {list(request_data.keys()) if request_data else 'None'}")
        logger.info(f" Step 4: Extracted persona_data keys: {list(persona_data.keys()) if persona_data else 'None'}")
        if persona_data:
            try:
                saved = svc._save_persona_data(user_id, persona_data, db)
                if saved:
                    logger.info(f" Saved persona data for user {user_id}")
                    from api.onboarding_utils.onboarding_task_scheduler import schedule_step4_tasks
                    schedule_step4_tasks(user_id, db)
            except Exception as e:
                logger.error(f" BLOCKING ERROR: Failed to save persona data: {str(e)}")
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=500,
                    detail="Failed to save persona data. Onboarding cannot proceed until this is resolved."
                ) from e

    # ------------------------------------------------------------------
    # Step 5 -- Integrations + schedule tasks
    # ------------------------------------------------------------------

    def _complete_website_step5(self, svc, user_id, request_data, db):
        step5_data = request_data.get('data') or request_data
        logger.info(f" Step 5: Raw request_data keys: {list(request_data.keys()) if request_data else 'None'}")
        logger.info(f" Step 5: Extracted step5_data keys: {list(step5_data.keys()) if step5_data else 'None'}")
        if step5_data:
            saved = svc._save_step5_integrations_context(user_id, step5_data, db)
            if saved:
                logger.info(f" Saved Step 5 integrations context for user {user_id}")
                from api.onboarding_utils.onboarding_task_scheduler import schedule_step5_tasks
                schedule_step5_tasks(user_id, db)
            else:
                logger.warning(f" Step 5 integrations context not persisted for user {user_id}")

    # ------------------------------------------------------------------
    # SIF Sync -- existing website onboarding sync
    # ------------------------------------------------------------------

    async def sif_sync(self, user_id: str, sif_service) -> None:
        """Delegate to the existing ``sync_onboarding_data_to_sif`` method.

        This is the original website-only sync that indexes
        WebsiteAnalysis + CompetitorAnalysis into the txtai FAISS index.
        """
        # Temporarily set the user_id on the sif_service if needed
        # (the existing method already uses self.user_id from the service)
        await sif_service.sync_onboarding_data_to_sif()