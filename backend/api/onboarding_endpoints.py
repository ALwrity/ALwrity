"""Onboarding API endpoints for ALwrity (stable module).

This file contains the concrete endpoint functions. It replaces the former
`backend/api/onboarding.py` monolith to avoid accidental overwrites by
external tooling. Other modules should import endpoints from this module.
"""

from typing import Dict, Any, List, Optional
from fastapi import HTTPException

# Re-export moved endpoints from modular files
from .onboarding_utils.endpoints_core import (
    health_check,
    initialize_onboarding,
    get_onboarding_status,
    get_onboarding_progress_full,
    get_step_data,
)
from .onboarding_utils.endpoints_management import (
    complete_step as _complete_step_impl,
    skip_step as _skip_step_impl,
    validate_step_access as _validate_step_access_impl,
    start_onboarding as _start_onboarding_impl,
    complete_onboarding as _complete_onboarding_impl,
    reset_onboarding as _reset_onboarding_impl,
    get_resume_info as _get_resume_info_impl,
)
from .onboarding_utils.endpoints_config_data import (
    get_api_keys,
    get_api_keys_for_onboarding,
    save_api_key,
    validate_api_keys,
    get_onboarding_config,
    get_provider_setup_info,
    get_all_providers_info,
    validate_provider_key,
    get_enhanced_validation_status,
    get_onboarding_summary,
    get_website_analysis_data,
    get_research_preferences_data,
    check_persona_generation_readiness,
    generate_persona_preview,
    generate_writing_persona,
    get_user_writing_personas,
    save_business_info,
    get_business_info,
    get_business_info_by_user,
    update_business_info,
    # Persona generation endpoints
    generate_writing_personas,
    generate_writing_personas_async,
    get_persona_task_status,
    assess_persona_quality,
    regenerate_persona,
    get_persona_generation_options
)
from .onboarding_utils.step4_persona_routes import (
    get_latest_persona,
    save_persona_update
)
from .onboarding_utils.endpoint_models import StepCompletionRequest, APIKeyRequest


# Compatibility wrapper signatures kept identical to original
async def complete_step(step_number: int, request, current_user: Dict[str, Any]):
    return await _complete_step_impl(step_number, getattr(request, 'data', None), current_user)


async def skip_step(step_number: int, current_user: Dict[str, Any]):
    return await _skip_step_impl(step_number, current_user)


async def validate_step_access(step_number: int, current_user: Dict[str, Any]):
    return await _validate_step_access_impl(step_number, current_user)


async def start_onboarding(current_user: Dict[str, Any]):
    return await _start_onboarding_impl(current_user)


async def complete_onboarding(current_user: Dict[str, Any]):
    return await _complete_onboarding_impl(current_user)


async def reset_onboarding(current_user: Dict[str, Any], hard: bool = False):
    return await _reset_onboarding_impl(current_user, hard=hard)


async def get_resume_info():
    return await _get_resume_info_impl()


__all__ = [name for name in globals().keys() if not name.startswith('_')]