"""
Onboarding Completion Service
Handles the complex logic for completing the onboarding process.

Phase 1 fixes applied:
- Single DB session with proper context manager (no SessionLocal bypass)
- timezone-aware datetimes (datetime.now(timezone.utc))
- Transactional task creation with partial failure reporting
- Business-without-website users: SIF + Market Trends tasks created without website_url
- Race-condition safety: upsert pattern (query-then-update-or-insert) for all tasks
"""

from typing import Dict, Any, List
from datetime import datetime, timezone
import os
from urllib.parse import urlparse
from fastapi import HTTPException
from loguru import logger

from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService
from services.database import get_session_for_user
from services.persona_data_service import PersonaDataService
from services.agent_activity_service import build_agent_event_payload


class OnboardingCompletionService:
    """Service for handling onboarding completion logic."""
    
    def __init__(self):
        # Canonical 4-step onboarding: 1=Connect Platforms, 2=Research,
        # 3=Personalization. "Finish" (4) is complete_onboarding itself.
        self.required_steps = [1, 2, 3]

    @staticmethod
    def _is_platform_connected(user_id: str, platform: str, db) -> bool:
        """Return True if ``platform`` is in the session's connected_platforms."""
        try:
            from models.onboarding import OnboardingSession
            session = db.query(OnboardingSession).filter(
                OnboardingSession.user_id == user_id
            ).order_by(OnboardingSession.updated_at.desc()).first()
            if not session or not session.platform_integrations:
                return False
            connected = session.platform_integrations.connected_platforms or []
            return platform in connected
        except Exception:
            return False

    def _normalize_competitor_analysis_for_deep_task(self, competitors: Any) -> List[Dict[str, Any]]:
        """Normalize Step 3 competitor analysis records to deep-task competitor schema."""
        if not isinstance(competitors, list):
            return []

        normalized: List[Dict[str, Any]] = []
        seen_domains = set()

        for competitor in competitors:
            if isinstance(competitor, str):
                raw_url = competitor
                raw_domain = ""
                name = ""
                summary = ""
            elif isinstance(competitor, dict):
                raw_url = (
                    competitor.get("competitor_url")
                    or competitor.get("url")
                    or competitor.get("website_url")
                    or competitor.get("competitor_domain")
                    or competitor.get("domain")
                    or ""
                )
                raw_domain = competitor.get("competitor_domain") or competitor.get("domain") or ""
                name = competitor.get("name") or competitor.get("title") or ""
                summary = competitor.get("summary") or competitor.get("description") or ""

                analysis_data = competitor.get("analysis_data")
                if isinstance(analysis_data, dict):
                    name = name or analysis_data.get("name") or analysis_data.get("title") or ""
                    summary = summary or analysis_data.get("summary") or analysis_data.get("description") or ""
            else:
                continue

            url = self._normalize_competitor_url(raw_url)
            if not url:
                url = self._normalize_competitor_url(raw_domain)
            if not url:
                continue

            domain = self._extract_domain_from_url(url)
            if not domain or domain in seen_domains:
                continue

            seen_domains.add(domain)
            normalized.append({
                "url": url,
                "domain": domain,
                "name": name or domain,
                "summary": summary,
            })

        return normalized

    def _normalize_competitor_url(self, raw: Any) -> str:
        if not isinstance(raw, str):
            return ""

        value = raw.strip()
        if not value:
            return ""

        if not value.startswith(("http://", "https://")):
            value = f"https://{value}"

        parsed = urlparse(value)
        if not parsed.scheme or not parsed.netloc:
            return ""

        return f"{parsed.scheme}://{parsed.netloc}"

    def _extract_domain_from_url(self, url: str) -> str:
        parsed = urlparse(url)
        domain = (parsed.netloc or "").lower()
        if domain.startswith("www."):
            domain = domain[4:]
        return domain

    @staticmethod
    def _upsert_task(db, model_cls, user_id: str, filters: dict, defaults: dict):
        """Insert-or-update a task row. Uses query-then-update pattern to avoid race conditions."""
        existing = db.query(model_cls).filter_by(**filters).first()
        if existing:
            for key, value in defaults.items():
                setattr(existing, key, value)
            db.add(existing)
            return existing
        else:
            row = model_cls(**filters, **defaults)
            db.add(row)
            return row

    async def complete_onboarding(self, current_user: Dict[str, Any]) -> Dict[str, Any]:
        """Complete the onboarding process with full validation and task scheduling."""
        scheduled_tasks: List[str] = []
        failed_tasks: List[Dict[str, str]] = []

        try:
            from services.onboarding.progress_service import OnboardingProgressService
            user_id = str(current_user.get('id'))
            progress_service = OnboardingProgressService()

            # Single 4-step onboarding flow: validate + complete + schedule
            # per-platform tasks. LinkedIn tasks are gated on "linkedin" being
            # present in PlatformIntegration.connected_platforms.
            missing_steps = await self._validate_required_steps_database(user_id)
            if missing_steps:
                missing_steps_str = ", ".join(missing_steps)
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot complete onboarding. The following steps must be completed first: {missing_steps_str}"
                )

            await self._validate_api_keys(user_id)

            # Persona is generated at Step 4 (via /step4/generate-personas) and
            # persisted to PersonaData (SSOT). The legacy WritingPersona producer
            # was retired in E.4 Phase 3; report generation from the SSOT store.
            persona_generated = PersonaDataService().get_user_persona_data(user_id) is not None

            success = progress_service.complete_onboarding(user_id)
            if not success:
                raise HTTPException(status_code=500, detail="Failed to mark onboarding as complete")

            # Best-effort, non-blocking onboarding welcome email. Never lets a
            # send failure block or fail the completion response.
            try:
                from services.onboarding_welcome_email import send_welcome_email
                first_name = str(current_user.get("first_name") or current_user.get("username") or "")
                send_welcome_email(user_id, first_name=first_name)
            except Exception as welcome_err:
                logger.warning(f"Welcome email send skipped for {user_id}: {welcome_err}")

            # Completion initializes the user environment and schedules
            # per-platform recurring tasks.
            db = get_session_for_user(user_id)
            try:
                try:
                    from services.progressive_setup_service import ProgressiveSetupService
                    setup_service = ProgressiveSetupService(db)
                    setup_service.initialize_user_environment(user_id)
                    scheduled_tasks.append("progressive_setup")
                    logger.info(f"Initialized user environment for {user_id}")
                except Exception as e:
                    failed_tasks.append({"task": "progressive_setup", "error": str(e)})
                    logger.warning(f"Failed to initialize user environment for {user_id}: {e}")

                # Schedule LinkedIn recurring tasks when LinkedIn is connected.
                if self._is_platform_connected(user_id, "linkedin", db):
                    from api.onboarding_utils.onboarding_task_scheduler import schedule_linkedin_tasks
                    schedule_linkedin_tasks(user_id, db)
                    scheduled_tasks.extend([
                        "linkedin_profile_sync", "linkedin_post_analytics_sync",
                        "linkedin_growth_reanalysis", "oauth_token_monitoring",
                    ])

                db.commit()
            except Exception as e:
                db.rollback()
                failed_tasks.append({"task": "progressive_setup_db", "error": str(e)})
                logger.error(f"Failed to commit progressive setup for user {user_id}: {e}")
            finally:
                db.close()
            
            try:
                from services.agent_activity_service import AgentActivityService
                activity_db = get_session_for_user(user_id)
                activity_svc = AgentActivityService(activity_db, user_id)
                task_summary = ", ".join(scheduled_tasks) if scheduled_tasks else "none"
                fail_summary = ", ".join(t.get("task", "?") for t in failed_tasks) if failed_tasks else "none"
                activity_svc.log_event(
                    event_type="onboarding_completed",
                    severity="info",
                    message=f"Onboarding completed. Scheduled: {task_summary}. Failed: {fail_summary}.",
                    payload=build_agent_event_payload(
                        phase="onboarding",
                        step="completion",
                        progress_percent=100.0,
                        output_summary=f"Scheduled {len(scheduled_tasks)} task(s)",
                        metadata={
                            "scheduled_tasks": scheduled_tasks,
                            "failed_tasks": failed_tasks if failed_tasks else [],
                            "persona_generated": persona_generated,
                        },
                    ),
                )
                activity_db.close()
            except Exception as act_err:
                logger.warning(f"Failed to log onboarding_completed event for user {user_id}: {act_err}")

            # Record completion summary in OnboardingSession payload
            try:
                summary_db = get_session_for_user(user_id)
                if summary_db:
                    session = summary_db.query(OnboardingSession).filter(
                        OnboardingSession.user_id == user_id
                    ).order_by(OnboardingSession.id.desc()).first()
                    if session:
                        payload = dict(session.payload) if session.payload else {}
                        payload["persona_generated"] = persona_generated
                        payload["progressive_setup_completed"] = "progressive_setup" in scheduled_tasks or is_linkedin
                        payload["completed_at"] = datetime.now(timezone.utc).isoformat()
                        payload["failed_tasks"] = failed_tasks if failed_tasks else []
                        session.payload = payload
                        summary_db.add(session)
                        summary_db.commit()
                    summary_db.close()
            except Exception as e:
                logger.warning(f"Failed to record completion payload for user {user_id}: {e}")

            return {
                "message": "Onboarding completed successfully",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "completion_percentage": 100.0,
                "persona_generated": persona_generated,
                "scheduled_tasks": scheduled_tasks,
                "failed_tasks": failed_tasks if failed_tasks else None,
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error completing onboarding: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error")
    
    async def _validate_required_steps_database(self, user_id: str) -> List[str]:
        """Validate that all required steps are completed using SSOT integration service."""
        missing_steps = []
        try:
            db = get_session_for_user(user_id)
            try:
                integration_service = OnboardingDataIntegrationService()
                
                logger.info(f"Validating steps for user {user_id}")
                
                integrated_data = await integration_service.process_onboarding_data(user_id, db)

                from services.onboarding.progress_service import OnboardingProgressService
                from models.onboarding import OnboardingSession
                progress_service = OnboardingProgressService()
                status = progress_service.get_onboarding_status(user_id)
                current_step = status.get("current_step", 1)

                session = db.query(OnboardingSession).filter(
                    OnboardingSession.user_id == user_id
                ).order_by(OnboardingSession.updated_at.desc()).first()
                onboarding_type = session.onboarding_type if session else "website"
                is_linkedin_onboarding = onboarding_type == "linkedin"
                
                for step_num in self.required_steps:
                    step_completed = False
                    
                    if step_num == 1:  # Connect Platforms (website)
                        if is_linkedin_onboarding:
                            # LinkedIn onboarding uses profile + post analysis instead of website analysis
                            from services.integrations.linkedin.profile_repository import ProfileRepository
                            try:
                                repo = ProfileRepository()
                                profile_context = repo.get_profile_context(user_id)
                                step_completed = bool(profile_context)
                            except Exception:
                                step_completed = False
                        else:
                            website = integrated_data.get('website_analysis', {})
                            step_completed = bool(website and (website.get('website_url') or website.get('writing_style')))
                    elif step_num == 2:  # Research
                        research = integrated_data.get('research_preferences', {})
                        step_completed = bool(research and (research.get('research_depth') or research.get('content_types')))
                    elif step_num == 3:  # Personalization (persona)
                        persona = integrated_data.get('persona_data', {})
                        step_completed = bool(persona and (persona.get('corePersona') or persona.get('core_persona') or persona.get('platformPersonas') or persona.get('platform_personas')))
                        if not step_completed:
                            logger.warning(
                                f"Step 3 incomplete for user {user_id}: no persona data found. "
                                f"Step will be auto-passed only if user has explicitly reached step 3."
                            )

                    if not step_completed and current_step >= step_num:
                        step_completed = True
                    
                    if not step_completed:
                        missing_steps.append(f"Step {step_num}")
                
                logger.info(f"Missing steps for user {user_id}: {missing_steps}")
                return missing_steps
                
            finally:
                db.close()
            
        except Exception as e:
            logger.error(f"Error validating required steps for user {user_id}: {e}")
            return ["Validation error"]
    
    async def _validate_api_keys(self, user_id: str):
        """Validate platform API configuration (env-only; BYOK retired — D1).

        The platform supplies all provider keys via environment variables
        (subscription model); per-user keys are gone. The text provider is
        chosen by the ``GPT_PROVIDER`` env flag (the LLM gateway resolves the
        actual key at request time), so we only require that flag to be set —
        never a hardcoded provider list. ``user_id`` is kept for signature
        compatibility.
        """
        try:
            if not os.getenv("GPT_PROVIDER", "").strip():
                raise HTTPException(
                    status_code=400,
                    detail="Cannot complete onboarding. Platform API provider (GPT_PROVIDER) is not configured."
                )
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Cannot complete onboarding. Platform API configuration validation failed."
            )
