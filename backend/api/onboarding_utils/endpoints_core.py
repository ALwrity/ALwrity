from typing import Dict, Any
from datetime import datetime
from loguru import logger
from fastapi import HTTPException, Depends

from middleware.auth_middleware import get_current_user

from services.onboarding.progress_service import OnboardingProgressService


def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


async def initialize_onboarding(current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        if not current_user or not current_user.get('id'):
            logger.error("initialize_onboarding called without a valid current_user")
            raise HTTPException(status_code=401, detail="User not authenticated")

        user_id = str(current_user.get('clerk_user_id') or current_user.get('id'))
        progress_service = OnboardingProgressService()
        status = progress_service.get_onboarding_status(user_id)

        completion_data = progress_service.get_completion_data(user_id) or {}
        
        # Build steps data based on database state
        steps_data = []
        for step_num in range(1, 6):  # Steps 1-5
            step_completed = False
            step_data = None
            
            # Check if step is completed based on database data
            if step_num == 1:  # Connect Platforms
                website = completion_data.get('website_analysis') or {}
                step_completed = bool(website.get('website_url') or website.get('writing_style'))
                if step_completed:
                    step_data = website
                    # Include LinkedIn profile analysis if available
                    try:
                        from services.integrations.linkedin.profile_repository import ProfileRepository
                        from api.linkedin_oauth_connection_routes import _oauth_service
                        import json
                        repo = ProfileRepository(oauth=_oauth_service)
                        row = repo.get_analysis_row(user_id)
                        if row:
                            profile = json.loads(row.get("normalized_profile_json", "{}")) if row.get("normalized_profile_json") else {}
                            step_data["linkedin_profile"] = {
                                "headline": profile.get("headline") or "",
                                "industry": profile.get("industry") or "",
                                "skills": (profile.get("skills") or [])[:5],
                            }
                    except Exception:
                        pass
            elif step_num == 2:  # Research
                research = completion_data.get('research_preferences') or {}
                step_completed = bool(research.get('research_depth') or research.get('content_types'))
                if step_completed:
                    step_data = dict(research)
                    # Merge crawl social media into social_media_accounts
                    website = completion_data.get('website_analysis') or {}
                    social_media = dict(website.get('social_media_presence') or website.get('social_media_accounts', {}) or {})
                    crawl_result = website.get('crawl_result', {}) or {}
                    crawl_social_media = {}
                    if isinstance(crawl_result, dict):
                        crawl_content = crawl_result.get('content', {}) or {}
                        crawl_social_media = crawl_content.get('social_media', {}) or {}
                        if not isinstance(crawl_social_media, dict):
                            crawl_social_media = {}
                        def _norm_url(u: str) -> str:
                            if not isinstance(u, str):
                                return ''
                            u = u.strip()
                            if not u:
                                return ''
                            if u.startswith('//'):
                                return 'https:' + u
                            if not u.startswith('http://') and not u.startswith('https://'):
                                return 'https://' + u if '.' in u else ''
                            return u
                        for platform, url in list(crawl_social_media.items()):
                            existing = social_media.get(platform)
                            if not existing or str(existing).strip().lower() in ('', '1', 'true', 'none'):
                                social_media[platform] = _norm_url(url)
                    step_data['social_media_accounts'] = social_media
                    step_data['crawl_social_media'] = crawl_social_media
            elif step_num == 3:  # Personalization
                persona = completion_data.get('persona_data') or {}
                step_completed = bool(
                    persona.get('corePersona') or persona.get('core_persona') or
                    persona.get('platformPersonas') or persona.get('platform_personas')
                )
                if step_completed:
                    step_data = persona
            elif step_num == 4:  # Finish
                step_completed = status['is_completed']
            elif step_num == 5:  # Complete
                step_completed = status['is_completed']
            
            steps_data.append({
                "step_number": step_num,
                "title": f"Step {step_num}",
                "description": f"Step {step_num} description",
                "status": "completed" if step_completed else "pending",
                "completed_at": datetime.now().isoformat() if step_completed else None,
                "has_data": step_data is not None,
                "data": step_data
            })

        # Reconciliation: if not completed but all artifacts exist, mark complete once
        try:
            if not status['is_completed']:
                all_have = (
                    any(v for v in (completion_data.get('api_keys') or {}).values() if v) and
                    bool((completion_data.get('website_analysis') or {}).get('website_url') or (completion_data.get('website_analysis') or {}).get('writing_style')) and
                    bool((completion_data.get('research_preferences') or {}).get('research_depth') or (completion_data.get('research_preferences') or {}).get('content_types')) and
                    bool((completion_data.get('persona_data') or {}).get('corePersona') or (completion_data.get('persona_data') or {}).get('core_persona') or (completion_data.get('persona_data') or {}).get('platformPersonas') or (completion_data.get('persona_data') or {}).get('platform_personas'))
                )
                if all_have:
                    svc = progress_service
                    svc.complete_onboarding(user_id)
                    # refresh status after reconciliation
                    status = svc.get_onboarding_status(user_id)
        except Exception:
            pass

        # Determine next step robustly
        next_step = 6 if status['is_completed'] else None
        if not status['is_completed']:
            for step in steps_data:
                if step['status'] != 'completed':
                    next_step = step['step_number']
                    break


        response_data = {
            "user": {
                "id": user_id,
                "email": current_user.get('email'),
                "first_name": current_user.get('first_name'),
                "last_name": current_user.get('last_name'),
                "clerk_user_id": str(current_user.get('clerk_user_id') or user_id),
            },
            "onboarding": {
                "is_completed": status['is_completed'],
                "current_step": 5 if status['is_completed'] else status['current_step'],
                "completion_percentage": status['completion_percentage'],
                "next_step": next_step,
                "started_at": status['started_at'],
                "last_updated": status['last_updated'],
                "completed_at": status['completed_at'],
                "can_proceed_to_final": True if status['is_completed'] else status['current_step'] >= 4,
                "onboarding_type": status.get("onboarding_type", "website"),
                "steps": steps_data,
            },
            "session": {
                "session_id": user_id,
                "initialized_at": status['started_at'],
                "last_activity": status['last_updated'],
            },
        }

        logger.info(
            f"Batch init successful for user {user_id}: step {status['current_step']}/6"
        )
        return response_data
    except Exception as e:
        logger.error(f"Error in initialize_onboarding: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to initialize onboarding: {str(e)}")


async def get_onboarding_status(current_user: Dict[str, Any]):
    try:
        from api.onboarding_utils.step_management_service import StepManagementService
        step_service = StepManagementService()
        return await step_service.get_onboarding_status(current_user)
    except Exception as e:
        from fastapi import HTTPException
        from loguru import logger
        logger.error(f"Error getting onboarding status: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def get_onboarding_progress_full(current_user: Dict[str, Any]):
    try:
        from api.onboarding_utils.step_management_service import StepManagementService
        step_service = StepManagementService()
        return await step_service.get_onboarding_progress_full(current_user)
    except Exception as e:
        from fastapi import HTTPException
        from loguru import logger
        logger.error(f"Error getting onboarding progress: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def get_step_data(step_number: int, current_user: Dict[str, Any]):
    try:
        from api.onboarding_utils.step_management_service import StepManagementService
        step_service = StepManagementService()
        return await step_service.get_step_data(step_number, current_user)
    except Exception as e:
        from fastapi import HTTPException
        from loguru import logger
        logger.error(f"Error getting step data: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def get_competitor_analysis(current_user: Dict[str, Any]):
    """Return the most recent competitor analysis data for the current user."""
    try:
        from services.database.sessions import get_session_for_user
        from models.onboarding import CompetitorAnalysis, OnboardingSession
        from sqlalchemy import select, desc

        user_id = str(current_user.get('clerk_user_id') or current_user.get('id'))
        if not user_id:
            raise HTTPException(status_code=401, detail="User not authenticated")

        session = get_session_for_user(user_id)
        if not session:
            return {"competitors": [], "count": 0}

        try:
            # Get the user's onboarding session
            onboarding_session = session.execute(
                select(OnboardingSession)
                .where(OnboardingSession.user_id == user_id)
                .order_by(desc(OnboardingSession.updated_at))
                .limit(1)
            ).scalar_one_or_none()

            if not onboarding_session:
                return {"competitors": [], "count": 0}

            # Get competitor analyses for this session
            competitors = session.execute(
                select(CompetitorAnalysis)
                .where(CompetitorAnalysis.session_id == onboarding_session.id)
                .order_by(desc(CompetitorAnalysis.analysis_date))
            ).scalars().all()

            competitor_data = [
                {
                    "url": c.competitor_url,
                    "domain": c.competitor_domain,
                    "analysis_date": c.analysis_date.isoformat() if c.analysis_date else None,
                    "analysis_data": c.analysis_data,
                    "status": c.status,
                }
                for c in competitors
            ]

            return {
                "competitors": competitor_data,
                "count": len(competitor_data),
                "session_id": onboarding_session.id,
            }
        finally:
            session.close()
    except HTTPException:
        raise
    except Exception as e:
        from loguru import logger
        logger.error(f"Error getting competitor analysis: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def get_onboarding_state(current_user: Dict[str, Any]):
    """Unified endpoint returning current step + all step data."""
    try:
        from services.database.sessions import get_session_for_user
        from models.onboarding import (
            OnboardingSession, APIKey, WebsiteAnalysis,
            ResearchPreferences, PersonaData, CompetitorAnalysis
        )
        from sqlalchemy import select, desc

        user_id = str(current_user.get('clerk_user_id') or current_user.get('id'))
        if not user_id:
            raise HTTPException(status_code=401, detail="User not authenticated")

        from services.onboarding.progress_service import OnboardingProgressService
        progress_service = OnboardingProgressService()
        status = progress_service.get_onboarding_status(user_id)

        session = get_session_for_user(user_id)
        if not session:
            return {"current_step": status.get("current_step", 0), "steps": {}}

        try:
            onboarding_session = session.execute(
                select(OnboardingSession)
                .where(OnboardingSession.user_id == user_id)
                .order_by(desc(OnboardingSession.updated_at))
                .limit(1)
            ).scalar_one_or_none()

            if not onboarding_session:
                return {"current_step": status.get("current_step", 0), "steps": {}}

            sid = onboarding_session.id
            step_data = {}

            # API Keys
            api_keys = session.execute(select(APIKey).where(APIKey.session_id == sid)).scalars().all()
            if api_keys:
                step_data["api_keys"] = {k.provider: k.key for k in api_keys if k.key}

            # Website
            website = session.execute(
                select(WebsiteAnalysis).where(WebsiteAnalysis.session_id == sid)
                .order_by(desc(WebsiteAnalysis.updated_at)).limit(1)
            ).scalar_one_or_none()
            if website and website.website_url:
                step_data["website"] = {"url": website.website_url, "writing_style": website.writing_style}

            # Research
            research = session.execute(
                select(ResearchPreferences).where(ResearchPreferences.session_id == sid)
                .order_by(desc(ResearchPreferences.updated_at)).limit(1)
            ).scalar_one_or_none()
            if research:
                step_data["research"] = {"research_depth": research.research_depth, "content_types": research.content_types}

            # Persona
            persona = session.execute(
                select(PersonaData).where(PersonaData.session_id == sid)
                .order_by(desc(PersonaData.updated_at)).limit(1)
            ).scalar_one_or_none()
            if persona:
                step_data["persona"] = {"core_persona": persona.core_persona, "platform_personas": persona.platform_personas}

            # Competitors
            competitors = session.execute(
                select(CompetitorAnalysis).where(CompetitorAnalysis.session_id == sid)
                .order_by(desc(CompetitorAnalysis.analysis_date))
            ).scalars().all()
            if competitors:
                step_data["competitors"] = [
                    {"url": c.competitor_url, "domain": c.competitor_domain}
                    for c in competitors
                ]

            return {
                "current_step": status.get("current_step", 0),
                "is_completed": status.get("is_completed", False),
                "steps": step_data,
            }
        finally:
            session.close()
    except HTTPException:
        raise
    except Exception as e:
        from loguru import logger
        logger.error(f"Error getting onboarding state: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def retrigger_sif_indexing(current_user: Dict[str, Any]):
    """Retrigger SIF indexing immediately for the current user."""
    try:
        from services.database.sessions import get_session_for_user
        from models.website_analysis_monitoring_models import SIFIndexingTask
        from datetime import datetime, timezone

        user_id = str(current_user.get('clerk_user_id') or current_user.get('id'))
        if not user_id:
            raise HTTPException(status_code=401, detail="User not authenticated")

        session = get_session_for_user(user_id)
        if not session:
            raise HTTPException(status_code=500, detail="Database connection failed")

        try:
            task = session.query(SIFIndexingTask).filter(
                SIFIndexingTask.user_id == user_id
            ).order_by(SIFIndexingTask.updated_at.desc()).first()

            if not task:
                return {"status": "not_found", "message": "No SIF indexing task found."}

            task.next_execution = datetime.now(timezone.utc)
            task.consecutive_failures = 0
            task.failure_reason = None
            task.status = "active"
            session.commit()

            website_url = (task.payload or {}).get('website_url', '')
            try:
                import asyncio
                from api.onboarding_utils.onboarding_task_scheduler import _run_sif_now
                asyncio.ensure_future(_run_sif_now(user_id, website_url))
            except Exception:
                pass

            return {
                "status": "retriggered",
                "website_url": website_url,
            }
        finally:
            session.close()
    except HTTPException:
        raise
    except Exception as e:
        from loguru import logger
        logger.error(f"Error retriggering SIF: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def search_sif_index(query: str = "", limit: int = 5, current_user: Dict[str, Any] = None):
    """Search the SIF index for test queries (white-box debugging)."""
    try:
        user_id = str(current_user.get("id"))
        from services.intelligence.sif_integration import SIFIntegrationService
        svc = SIFIntegrationService(user_id)
        await svc._ensure_initialized()
        results = svc.intelligence_service.search(query, limit=limit)
        hits = [{"text": r.get("text", ""), "score": r.get("score", 0)} for r in (results or [])]
        return {"hits": hits, "query": query}
    except Exception as e:
        from loguru import logger
        logger.warning(f"Error searching SIF: {str(e)}")
        return {"hits": [], "query": query, "error": str(e)}


__all__ = [name for name in globals().keys() if not name.startswith('_')]


