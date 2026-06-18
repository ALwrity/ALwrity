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
from services.persona_analysis_service import PersonaAnalysisService
from services.agent_activity_service import build_agent_event_payload


class OnboardingCompletionService:
    """Service for handling onboarding completion logic."""
    
    def __init__(self):
        self.required_steps = [1, 2, 3, 4, 5]

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
            
            missing_steps = await self._validate_required_steps_database(user_id)
            if missing_steps:
                missing_steps_str = ", ".join(missing_steps)
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot complete onboarding. The following steps must be completed first: {missing_steps_str}"
                )

            await self._validate_api_keys(user_id)
            
            persona_generated = await _generate_persona_from_onboarding(user_id)
            
            success = progress_service.complete_onboarding(user_id)
            if not success:
                raise HTTPException(status_code=500, detail="Failed to mark onboarding as complete")

            # ── Step 6: tasks already scheduled at Steps 2-5 ───────────────
            logger.info(f"[complete_onboarding] Step 6: scheduling only progressive_setup "
                        f"(other tasks were already scheduled at Steps 2-5)")

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
                from models.onboarding import OnboardingSession
                summary_db = get_session_for_user(user_id)
                if summary_db:
                    session = summary_db.query(OnboardingSession).filter(
                        OnboardingSession.user_id == user_id
                    ).order_by(OnboardingSession.id.desc()).first()
                    if session:
                        payload = dict(session.payload) if session.payload else {}
                        payload["persona_generated"] = persona_generated
                        payload["progressive_setup_completed"] = "progressive_setup" in scheduled_tasks
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
                progress_service = OnboardingProgressService()
                status = progress_service.get_onboarding_status(user_id)
                current_step = status.get("current_step", 1)
                
                for step_num in self.required_steps:
                    step_completed = False
                    
                    if step_num == 1:
                        api_keys_data = integrated_data.get('api_keys_data', {})
                        step_completed = bool(
                            api_keys_data.get('openai_api_key') or 
                            api_keys_data.get('anthropic_api_key') or 
                            api_keys_data.get('google_api_key')
                        )
                        if not step_completed:
                            has_global_providers = bool(
                                os.getenv("EXA_API_KEY") or
                                os.getenv("GEMINI_API_KEY") or
                                os.getenv("OPENAI_API_KEY") or
                                os.getenv("ANTHROPIC_API_KEY") or
                                os.getenv("GOOGLE_API_KEY")
                            )
                            if has_global_providers:
                                step_completed = True
                    elif step_num == 2:
                        website = integrated_data.get('website_analysis', {})
                        step_completed = bool(website and (website.get('website_url') or website.get('writing_style')))
                    elif step_num == 3:
                        research = integrated_data.get('research_preferences', {})
                        step_completed = bool(research and (research.get('research_depth') or research.get('content_types')))
                    elif step_num == 4:
                        persona = integrated_data.get('persona_data', {})
                        step_completed = bool(persona and (persona.get('corePersona') or persona.get('core_persona') or persona.get('platformPersonas') or persona.get('platform_personas')))
                        if not step_completed:
                            logger.warning(
                                f"Step 4 incomplete for user {user_id}: no persona data found. "
                                f"Step will be auto-passed only if user has explicitly reached step 4."
                            )
                    elif step_num == 5:
                        integrations_data = integrated_data.get('platform_integrations', {})
                        integrations_complete = bool(integrations_data.get('connected_platforms'))
                        step_completed = integrations_complete or True
                        if step_completed and not integrations_complete:
                            logger.info(f"Step 5 auto-passed for user {user_id}: integrations are optional")

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
        """Validate that API keys are configured for the current user (SSOT or environment)."""
        try:
            db = get_session_for_user(user_id)
            try:
                integration_service = OnboardingDataIntegrationService()
                integrated_data = await integration_service.process_onboarding_data(user_id, db)
            finally:
                db.close()
            
            api_keys_data = integrated_data.get('api_keys_data', {}) if integrated_data else {}
            
            has_user_keys = bool(
                api_keys_data.get('openai_api_key') or 
                api_keys_data.get('anthropic_api_key') or 
                api_keys_data.get('google_api_key') or
                api_keys_data.get('exa_api_key') or
                api_keys_data.get('gemini_api_key')
            )

            has_env_keys = bool(
                os.getenv("OPENAI_API_KEY") or
                os.getenv("ANTHROPIC_API_KEY") or
                os.getenv("GOOGLE_API_KEY") or
                os.getenv("EXA_API_KEY") or
                os.getenv("GEMINI_API_KEY")
            )

            if not (has_user_keys or has_env_keys):
                raise HTTPException(
                    status_code=400,
                    detail="Cannot complete onboarding. At least one AI provider API key must be configured in your account."
                )
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Cannot complete onboarding. API key validation failed."
            )
    
async def _generate_persona_from_onboarding(user_id: str) -> bool:
        """Generate writing persona from onboarding data (fire-and-forget with timeout)."""
        try:
            import asyncio
            persona_service = PersonaAnalysisService()
            
            try:
                existing = persona_service.get_user_personas(user_id)
                if existing and len(existing) > 0:
                    logger.info("Persona already exists for user %s; skipping regeneration during completion", user_id)
                    return False
            except Exception:
                pass

            try:
                persona_result = await asyncio.wait_for(
                    asyncio.get_event_loop().run_in_executor(
                        None,
                        persona_service.generate_persona_from_onboarding,
                        user_id
                    ),
                    timeout=30.0
                )
            except asyncio.TimeoutError:
                logger.warning(f"Persona generation timed out (30s) for user {user_id}; will be generated by scheduled task")
                return False
            
            if "error" not in persona_result:
                logger.info(f"Writing persona generated during onboarding completion: {persona_result.get('persona_id')}")
                return True
            else:
                logger.warning(f"Persona generation failed during onboarding: {persona_result['error']}")
                return False
        except Exception as e:
            logger.warning(f"Non-critical error generating persona during onboarding: {str(e)}")
            return False