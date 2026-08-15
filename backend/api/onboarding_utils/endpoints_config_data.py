from typing import Dict, Any
from loguru import logger
from fastapi import HTTPException

from .endpoint_models import APIKeyRequest

# Import persona generation functions
from .step4_persona_routes import (
    generate_writing_personas,
    generate_writing_personas_async,
    get_persona_task_status,
    assess_persona_quality,
    regenerate_persona,
    get_persona_generation_options,
    get_persona_platforms,
    generate_platform_persona
)


async def get_api_keys():
    try:
        from api.onboarding_utils.api_key_management_service import APIKeyManagementService
        api_service = APIKeyManagementService()
        return await api_service.get_api_keys()
    except Exception as e:
        logger.error(f"Error getting API keys: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def get_api_keys_for_onboarding(current_user: dict = None):
    try:
        from api.onboarding_utils.api_key_management_service import APIKeyManagementService
        api_service = APIKeyManagementService()
        user_id = str(current_user.get('id')) if current_user and current_user.get('id') else None
        return await api_service.get_api_keys_for_onboarding(user_id)
    except Exception as e:
        logger.error(f"Error getting API keys for onboarding: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def save_api_key(request: APIKeyRequest, current_user: dict = None):
    try:
        from api.onboarding_utils.api_key_management_service import APIKeyManagementService
        api_service = APIKeyManagementService()
        return await api_service.save_api_key(request.provider, request.api_key, request.description, current_user)
    except Exception as e:
        logger.error(f"Error saving API key: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def validate_api_keys():
    try:
        from api.onboarding_utils.api_key_management_service import APIKeyManagementService
        api_service = APIKeyManagementService()
        return await api_service.validate_api_keys()
    except Exception as e:
        logger.error(f"Error validating API keys: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


def get_onboarding_config():
    try:
        from api.onboarding_utils.onboarding_config_service import OnboardingConfigService
        config_service = OnboardingConfigService()
        return config_service.get_onboarding_config()
    except Exception as e:
        logger.error(f"Error getting onboarding config: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def get_provider_setup_info(provider: str):
    try:
        from api.onboarding_utils.onboarding_config_service import OnboardingConfigService
        config_service = OnboardingConfigService()
        return await config_service.get_provider_setup_info(provider)
    except Exception as e:
        logger.error(f"Error getting provider setup info: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def get_all_providers_info():
    try:
        from api.onboarding_utils.onboarding_config_service import OnboardingConfigService
        config_service = OnboardingConfigService()
        return config_service.get_all_providers_info()
    except Exception as e:
        logger.error(f"Error getting all providers info: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def validate_provider_key(provider: str, request: APIKeyRequest):
    try:
        from api.onboarding_utils.onboarding_config_service import OnboardingConfigService
        config_service = OnboardingConfigService()
        return await config_service.validate_provider_key(provider, request.api_key)
    except Exception as e:
        logger.error(f"Error validating provider key: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def get_enhanced_validation_status():
    try:
        from api.onboarding_utils.onboarding_config_service import OnboardingConfigService
        config_service = OnboardingConfigService()
        return await config_service.get_enhanced_validation_status()
    except Exception as e:
        logger.error(f"Error getting enhanced validation status: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def get_onboarding_summary(current_user: Dict[str, Any]):
    try:
        from api.onboarding_utils.onboarding_summary_service import OnboardingSummaryService
        user_id = str(current_user.get('id'))
        summary_service = OnboardingSummaryService(user_id)
        logger.info(f"Getting onboarding summary for user {user_id}")
        return await summary_service.get_onboarding_summary()
    except Exception as e:
        logger.error(f"Error getting onboarding summary: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def get_website_analysis_data(current_user: Dict[str, Any]):
    try:
        from api.onboarding_utils.onboarding_summary_service import OnboardingSummaryService
        user_id = str(current_user.get('id'))
        summary_service = OnboardingSummaryService(user_id)
        logger.info(f"Getting website analysis data for user {user_id}")
        return await summary_service.get_website_analysis_data()
    except Exception as e:
        logger.error(f"Error getting website analysis data: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def get_research_preferences_data(current_user: Dict[str, Any]):
    try:
        from api.onboarding_utils.onboarding_summary_service import OnboardingSummaryService
        user_id = str(current_user.get('id'))
        summary_service = OnboardingSummaryService(user_id)
        logger.info(f"Getting research preferences data for user {user_id}")
        return await summary_service.get_research_preferences_data()
    except Exception as e:
        logger.error(f"Error getting research preferences data: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def check_persona_generation_readiness(user_id: int = 1):
    try:
        from api.onboarding_utils.persona_management_service import PersonaManagementService
        persona_service = PersonaManagementService()
        return await persona_service.check_persona_generation_readiness(user_id)
    except Exception as e:
        logger.error(f"Error checking persona readiness: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def generate_persona_preview(user_id: int = 1):
    try:
        from api.onboarding_utils.persona_management_service import PersonaManagementService
        persona_service = PersonaManagementService()
        return await persona_service.generate_persona_preview(user_id)
    except Exception as e:
        logger.error(f"Error generating persona preview: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def generate_writing_persona(user_id: str):
    try:
        from api.onboarding_utils.persona_management_service import PersonaManagementService
        persona_service = PersonaManagementService()
        return await persona_service.generate_writing_persona(user_id)
    except Exception as e:
        logger.error(f"Error generating writing persona: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def get_user_writing_personas(user_id: int = 1):
    try:
        from api.onboarding_utils.persona_management_service import PersonaManagementService
        persona_service = PersonaManagementService()
        return await persona_service.get_user_writing_personas(user_id)
    except Exception as e:
        logger.error(f"Error getting user personas: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def save_business_info(business_info: dict):
    try:
        from api.onboarding_utils.business_info_service import BusinessInfoService
        business_service = BusinessInfoService()
        return await business_service.save_business_info(business_info)
    except Exception as e:
        logger.error(f"❌ Error saving business info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save business info: {str(e)}")


async def get_business_info(business_info_id: int):
    try:
        from api.onboarding_utils.business_info_service import BusinessInfoService
        business_service = BusinessInfoService()
        return await business_service.get_business_info(business_info_id)
    except Exception as e:
        logger.error(f"❌ Error getting business info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get business info: {str(e)}")


async def get_business_info_by_user(user_id: str):
    try:
        from api.onboarding_utils.business_info_service import BusinessInfoService
        business_service = BusinessInfoService()
        return await business_service.get_business_info_by_user(user_id)
    except Exception as e:
        logger.error(f"❌ Error getting business info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get business info: {str(e)}")


async def update_business_info(business_info_id: int, business_info: dict):
    try:
        from api.onboarding_utils.business_info_service import BusinessInfoService
        business_service = BusinessInfoService()
        return await business_service.update_business_info(business_info_id, business_info)
    except Exception as e:
        logger.error(f"❌ Error updating business info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update business info: {str(e)}")


async def generate_website_preview(intake: Dict[str, Any], current_user: Dict[str, Any]):
    try:
        user_id = current_user.get("id")
        from services.onboarding.website_intake_service import website_intake_service
        from services.onboarding.website_style_service import website_style_service
        from api.onboarding_utils.website_automation_service import website_automation_service
        from services.user_website_service import user_website_service
        from models.user_website_request import UserWebsiteRequest, WebsiteStatus, TemplateType

        existing = user_website_service.get_user_website_by_user(user_id)
        if not existing:
            user_website_service.create_user_website(
                UserWebsiteRequest(
                    user_id=user_id,
                    template_type=TemplateType(intake.get("template_type", "blog")),
                    status=WebsiteStatus.PREVIEWING,
                    business_name=intake.get("business_name"),
                    business_description=intake.get("business_summary")
                )
            )

        site_brief = website_intake_service.generate_site_brief(intake, user_id=str(user_id))
        if existing and existing.netlify_site_url:
            site_brief.setdefault("site_brief", {})
            site_brief["site_brief"]["canonical_url"] = existing.netlify_site_url
        tokens = website_style_service.generate_theme_tokens(site_brief, user_id=str(user_id))
        css = website_style_service.render_css(tokens) if tokens and not tokens.get("error") else ""
        preview = await website_automation_service.generate_preview_site(user_id, site_brief, css)

        return {
            "site_brief": site_brief,
            "theme_tokens": tokens,
            "css": css,
            "preview_url": preview.get("preview_url"),
            "preview_root": preview.get("preview_root"),
            "preview_files": preview.get("preview_files"),
            "preview_html": preview.get("preview_html"),
        }
    except Exception as e:
        logger.error(f"Error generating website preview: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate website preview")


async def deploy_website(intake: Dict[str, Any], current_user: Dict[str, Any]):
    try:
        user_id = current_user.get("id")
        from api.onboarding_utils.website_automation_service import WebsiteAutomationService
        from services.user_website_service import user_website_service
        from services.onboarding.website_intake_service import website_intake_service
        from services.onboarding.website_style_service import website_style_service
        from models.user_website_request import WebsiteStatusUpdate

        template = intake.get("template_type", "blog")
        business_name = intake.get("business_name") or intake.get("business_summary") or f"ALwrity Site {user_id}"
        business_info = {"name": business_name}
        site_brief = website_intake_service.generate_site_brief(intake, user_id=str(user_id))
        tokens = website_style_service.generate_theme_tokens(site_brief, user_id=str(user_id))
        css = website_style_service.render_css(tokens) if tokens and not tokens.get("error") else ""

        service = WebsiteAutomationService()
        result = await service.generate_website(
            user_id,
            business_info,
            template,
            site_brief=site_brief,
            css=css
        )

        user_website_service.update_user_website_status(
            user_id=user_id,
            status_update=WebsiteStatusUpdate(
                status=WebsiteStatus.DEPLOYED,
                github_repo_url=result.get("repo_url"),
                netlify_site_url=result.get("live_url"),
                netlify_admin_url=result.get("admin_url")
            )
        )
        return {
            **result,
            "site_brief": site_brief,
            "theme_tokens": tokens,
            "css": css
        }
    except Exception as e:
        logger.error(f"Error deploying website: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to deploy website")


__all__ = [name for name in globals().keys() if not name.startswith('_')]


