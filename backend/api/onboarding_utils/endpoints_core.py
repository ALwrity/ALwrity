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
        for step_num in range(1, 7):  # Steps 1-6
            step_completed = False
            step_data = None
            
            # Check if step is completed based on database data
            if step_num == 1:  # API Keys
                api_keys = completion_data.get('api_keys') or {}
                step_completed = any(v for v in api_keys.values() if v)
            elif step_num == 2:  # Website Analysis
                website = completion_data.get('website_analysis') or {}
                step_completed = bool(website.get('website_url') or website.get('writing_style'))
                if step_completed:
                    step_data = website
            elif step_num == 3:  # Research Preferences
                research = completion_data.get('research_preferences') or {}
                step_completed = bool(research.get('research_depth') or research.get('content_types'))
                if step_completed:
                    step_data = dict(research)
                    # Merge crawl social media into social_media_accounts (same logic as get_step_data(3))
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
            elif step_num == 4:  # Persona Generation
                persona = completion_data.get('persona_data') or {}
                step_completed = bool(
                    persona.get('corePersona') or persona.get('core_persona') or
                    persona.get('platformPersonas') or persona.get('platform_personas')
                )
                if step_completed:
                    step_data = persona
            elif step_num == 5:  # Integrations (always completed if we reach this point)
                step_completed = status['current_step'] >= 5
            elif step_num == 6:  # Final Step
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
                "current_step": 6 if status['is_completed'] else status['current_step'],
                "completion_percentage": status['completion_percentage'],
                "next_step": next_step,
                "started_at": status['started_at'],
                "last_updated": status['last_updated'],
                "completed_at": status['completed_at'],
                "can_proceed_to_final": True if status['is_completed'] else status['current_step'] >= 5,
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


__all__ = [name for name in globals().keys() if not name.startswith('_')]


