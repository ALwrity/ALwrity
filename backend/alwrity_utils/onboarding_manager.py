"""
Onboarding Manager Module
Handles all onboarding-related endpoints and functionality.
"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Query
from fastapi.responses import FileResponse
from typing import Dict, Any, Optional
from loguru import logger

# Import onboarding functions
from api.onboarding_utils.endpoints_tasks import get_tasks_status
from api.onboarding import (
    health_check,
    initialize_onboarding,
    get_onboarding_status,
    get_onboarding_progress_full,
    get_step_data,
    complete_step,
    skip_step,
    validate_step_access,
    get_api_keys,
    get_api_keys_for_onboarding,
    save_api_key,
    validate_api_keys,
    start_onboarding,
    complete_onboarding,
    reset_onboarding,
    get_resume_info,
    get_onboarding_config,
    get_provider_setup_info,
    get_all_providers_info,
    validate_provider_key,
    get_enhanced_validation_status,
    get_onboarding_summary,
    get_website_analysis_data,
    get_research_preferences_data,
    save_business_info,
    get_business_info,
    get_business_info_by_user,
    update_business_info,
    generate_writing_personas,
    generate_writing_personas_async,
    get_persona_task_status,
    assess_persona_quality,
    regenerate_persona,
    get_persona_generation_options,
    get_latest_persona,
    save_persona_update,
    StepCompletionRequest,
    APIKeyRequest
)
from middleware.auth_middleware import get_current_user


class OnboardingManager:
    """Manages all onboarding-related endpoints and functionality."""
    
    def __init__(self, app: FastAPI):
        self.app = app
        self.setup_onboarding_endpoints()
    
    def setup_onboarding_endpoints(self):
        """Set up all onboarding-related endpoints."""
        
        # Onboarding initialization - BATCH ENDPOINT (reduces 4 API calls to 1)
        @self.app.get("/api/onboarding/init")
        async def onboarding_init(current_user: dict = Depends(get_current_user)):
            """
            Batch initialization endpoint - combines user info, status, and progress.
            This eliminates 3-4 separate API calls on initial load, reducing latency by 60-75%.
            """
            try:
                return await initialize_onboarding(current_user)
            except HTTPException as he:
                raise he
            except Exception as e:
                logger.error(f"Error in onboarding_init: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        # Onboarding status endpoints
        @self.app.get("/api/onboarding/status")
        async def onboarding_status(current_user: dict = Depends(get_current_user)):
            """Get the current onboarding status."""
            try:
                return await get_onboarding_status(current_user)
            except HTTPException as he:
                raise he
            except Exception as e:
                logger.error(f"Error in onboarding_status: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.get("/api/onboarding/progress")
        async def onboarding_progress(current_user: dict = Depends(get_current_user)):
            """Get the full onboarding progress data."""
            try:
                return await get_onboarding_progress_full(current_user)
            except HTTPException as he:
                raise he
            except Exception as e:
                logger.error(f"Error in onboarding_progress: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        # Step management endpoints
        @self.app.get("/api/onboarding/step/{step_number}")
        async def step_data(step_number: int, current_user: dict = Depends(get_current_user)):
            """Get data for a specific step."""
            try:
                return await get_step_data(step_number, current_user)
            except HTTPException as he:
                raise he
            except Exception as e:
                logger.error(f"Error in step_data: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.post("/api/onboarding/step/{step_number}/complete")
        async def step_complete(step_number: int, request: StepCompletionRequest, current_user: dict = Depends(get_current_user)):
            """Mark a step as completed."""
            try:
                return await complete_step(step_number, request, current_user)
            except HTTPException as he:
                raise he
            except Exception as e:
                logger.error(f"Error in step_complete: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.post("/api/onboarding/step/{step_number}/skip")
        async def step_skip(step_number: int, current_user: dict = Depends(get_current_user)):
            """Skip a step (for optional steps)."""
            try:
                return await skip_step(step_number, current_user)
            except HTTPException as he:
                raise he
            except Exception as e:
                logger.error(f"Error in step_skip: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.get("/api/onboarding/step/{step_number}/validate")
        async def step_validate(step_number: int, current_user: dict = Depends(get_current_user)):
            """Validate if user can access a specific step."""
            try:
                return await validate_step_access(step_number, current_user)
            except HTTPException as he:
                raise he
            except Exception as e:
                logger.error(f"Error in step_validate: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        # API key management endpoints
        @self.app.get("/api/onboarding/api-keys")
        async def api_keys():
            """Get all configured API keys (masked)."""
            try:
                return await get_api_keys()
            except Exception as e:
                logger.error(f"Error in api_keys: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.get("/api/onboarding/api-keys/onboarding")
        async def api_keys_for_onboarding(current_user: dict = Depends(get_current_user)):
            """Get all configured API keys for onboarding (unmasked)."""
            try:
                return await get_api_keys_for_onboarding(current_user)
            except Exception as e:
                logger.error(f"Error in api_keys_for_onboarding: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.post("/api/onboarding/api-keys")
        async def api_key_save(request: APIKeyRequest, current_user: dict = Depends(get_current_user)):
            """Save an API key for a provider."""
            try:
                return await save_api_key(request, current_user)
            except Exception as e:
                logger.error(f"Error in api_key_save: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.get("/api/onboarding/api-keys/validate")
        async def api_key_validate():
            """Get API key validation status and configuration."""
            try:
                import os
                from dotenv import load_dotenv
                
                # Load environment variables
                backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                env_path = os.path.join(backend_dir, ".env")
                load_dotenv(env_path, override=True)
                
                # Check for required API keys (backend only)
                api_keys = {}
                required_keys = {
                    'GEMINI_API_KEY': 'gemini',
                    'EXA_API_KEY': 'exa'
                    # Note: CopilotKit is frontend-only, validated separately
                }
                
                missing_keys = []
                configured_providers = []
                
                for env_var, provider in required_keys.items():
                    key_value = os.getenv(env_var)
                    if key_value and key_value.strip():
                        api_keys[provider] = key_value.strip()
                        configured_providers.append(provider)
                    else:
                        missing_keys.append(provider)
                
                # Determine if all required keys are present
                required_providers = ['gemini', 'exa']  # Backend keys only
                all_required_present = all(provider in configured_providers for provider in required_providers)
                
                result = {
                    "api_keys": api_keys,
                    "validation_results": {
                        "gemini": {"valid": 'gemini' in configured_providers, "status": "configured" if 'gemini' in configured_providers else "missing"},
                        "exa": {"valid": 'exa' in configured_providers, "status": "configured" if 'exa' in configured_providers else "missing"}
                    },
                    "all_valid": all_required_present,
                    "total_providers": len(configured_providers),
                    "configured_providers": configured_providers,
                    "missing_keys": missing_keys
                }
                
                logger.info(f"API Key Validation Result: {result}")
                return result
            except Exception as e:
                logger.error(f"Error in api_key_validate: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        # Onboarding control endpoints
        @self.app.post("/api/onboarding/start")
        async def onboarding_start(current_user: dict = Depends(get_current_user)):
            """Start a new onboarding session."""
            try:
                return await start_onboarding(current_user)
            except HTTPException as he:
                raise he
            except Exception as e:
                logger.error(f"Error in onboarding_start: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.post("/api/onboarding/complete")
        async def onboarding_complete(current_user: dict = Depends(get_current_user)):
            """Complete the onboarding process."""
            try:
                return await complete_onboarding(current_user)
            except HTTPException as he:
                raise he
            except Exception as e:
                logger.error(f"Error in onboarding_complete: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.post("/api/onboarding/reset")
        async def onboarding_reset(current_user: dict = Depends(get_current_user),
                                    hard: bool = Query(False, description="Hard reset — delete all records for a clean slate")):
            """Reset the onboarding progress."""
            try:
                return await reset_onboarding(current_user, hard=hard)
            except Exception as e:
                logger.error(f"Error in onboarding_reset: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        # Scheduled tasks status endpoint
        @self.app.get("/api/onboarding/tasks/status")
        async def onboarding_tasks_status(current_user: dict = Depends(get_current_user)):
            """Get status of all scheduled background tasks for the current user."""
            try:
                return await get_tasks_status(current_user)
            except Exception as e:
                logger.error(f"Error in onboarding_tasks_status: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        # Resume functionality
        @self.app.get("/api/onboarding/resume")
        async def onboarding_resume():
            """Get information for resuming onboarding."""
            try:
                return await get_resume_info()
            except Exception as e:
                logger.error(f"Error in onboarding_resume: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        # Configuration endpoints
        @self.app.get("/api/onboarding/config")
        async def onboarding_config():
            """Get onboarding configuration and requirements."""
            try:
                return get_onboarding_config()
            except Exception as e:
                logger.error(f"Error in onboarding_config: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        # Enhanced provider endpoints
        @self.app.get("/api/onboarding/providers/{provider}/setup")
        async def provider_setup_info(provider: str):
            """Get setup information for a specific provider."""
            try:
                return await get_provider_setup_info(provider)
            except Exception as e:
                logger.error(f"Error in provider_setup_info: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.get("/api/onboarding/providers")
        async def all_providers_info():
            """Get setup information for all providers."""
            try:
                return await get_all_providers_info()
            except Exception as e:
                logger.error(f"Error in all_providers_info: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.post("/api/onboarding/providers/{provider}/validate")
        async def validate_provider_key_endpoint(provider: str, request: APIKeyRequest):
            """Validate a specific provider's API key."""
            try:
                return await validate_provider_key(provider, request)
            except Exception as e:
                logger.error(f"Error in validate_provider_key: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.get("/api/onboarding/validation/enhanced")
        async def enhanced_validation_status():
            """Get enhanced validation status for all configured services."""
            try:
                return await get_enhanced_validation_status()
            except Exception as e:
                logger.error(f"Error in enhanced_validation_status: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        # New endpoints for FinalStep data loading
        @self.app.get("/api/onboarding/summary")
        async def onboarding_summary(current_user: dict = Depends(get_current_user)):
            """Get comprehensive onboarding summary for FinalStep."""
            try:
                return await get_onboarding_summary(current_user)
            except Exception as e:
                logger.error(f"Error in onboarding_summary: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.get("/api/onboarding/website-analysis")
        async def website_analysis_data(current_user: dict = Depends(get_current_user)):
            """Get website analysis data for FinalStep."""
            try:
                return await get_website_analysis_data(current_user)
            except Exception as e:
                logger.error(f"Error in website_analysis_data: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.get("/api/onboarding/research-preferences")
        async def research_preferences_data(current_user: dict = Depends(get_current_user)):
            """Get research preferences data for FinalStep."""
            try:
                return await get_research_preferences_data(current_user)
            except Exception as e:
                logger.error(f"Error in research_preferences_data: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        # Business Information endpoints
        @self.app.post("/api/onboarding/business-info")
        async def business_info_save(request: dict):
            """Save business information for users without websites."""
            try:
                from models.business_info_request import BusinessInfoRequest
                return await save_business_info(request)
            except Exception as e:
                logger.error(f"Error in business_info_save: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.get("/api/onboarding/business-info/{business_info_id}")
        async def business_info_get(business_info_id: int):
            """Get business information by ID."""
            try:
                return await get_business_info(business_info_id)
            except Exception as e:
                logger.error(f"Error in business_info_get: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.get("/api/onboarding/business-info/user/{user_id}")
        async def business_info_get_by_user(user_id: str):
            """Get business information by user ID."""
            try:
                return await get_business_info_by_user(user_id)
            except Exception as e:
                logger.error(f"Error in business_info_get_by_user: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.put("/api/onboarding/business-info/{business_info_id}")
        async def business_info_update(business_info_id: int, request: dict):
            """Update business information."""
            try:
                from models.business_info_request import BusinessInfoRequest
                return await update_business_info(business_info_id, request)
            except Exception as e:
                logger.error(f"Error in business_info_update: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        # Persona generation endpoints
        @self.app.post("/api/onboarding/step4/generate-personas")
        async def generate_personas(request: dict, current_user: dict = Depends(get_current_user)):
            """Generate AI writing personas for Step 4."""
            try:
                return await generate_writing_personas(request, current_user)
            except Exception as e:
                logger.error(f"Error in generate_personas: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.post("/api/onboarding/step4/generate-personas-async")
        async def generate_personas_async(request: dict, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
            """Start async persona generation task."""
            try:
                return await generate_writing_personas_async(request, current_user, background_tasks)
            except Exception as e:
                logger.error(f"Error in generate_personas_async: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.get("/api/onboarding/step4/persona-task/{task_id}")
        async def get_persona_task(task_id: str):
            """Get persona generation task status."""
            try:
                return await get_persona_task_status(task_id)
            except Exception as e:
                logger.error(f"Error in get_persona_task: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.get("/api/onboarding/step4/persona-latest")
        async def persona_latest(current_user: dict = Depends(get_current_user)):
            """Get latest cached persona for current user."""
            try:
                return await get_latest_persona(current_user)
            except HTTPException as he:
                raise he
            except Exception as e:
                logger.error(f"Error in persona_latest: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.post("/api/onboarding/step4/persona-save")
        async def persona_save(request: dict, current_user: dict = Depends(get_current_user)):
            """Save edited persona back to cache."""
            try:
                return await save_persona_update(request, current_user)
            except HTTPException as he:
                raise he
            except Exception as e:
                logger.error(f"Error in persona_save: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.post("/api/onboarding/step4/assess-persona-quality")
        async def assess_persona_quality_endpoint(request: dict, current_user: dict = Depends(get_current_user)):
            """Assess the quality of generated personas."""
            try:
                return await assess_persona_quality(request, current_user)
            except Exception as e:
                logger.error(f"Error in assess_persona_quality: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.post("/api/onboarding/step4/regenerate-persona")
        async def regenerate_persona_endpoint(request: dict, current_user: dict = Depends(get_current_user)):
            """Regenerate a specific persona with improvements."""
            try:
                return await regenerate_persona(request, current_user)
            except Exception as e:
                logger.error(f"Error in regenerate_persona: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.get("/api/onboarding/step4/persona-options")
        async def get_persona_options(current_user: dict = Depends(get_current_user)):
            """Get persona generation options and configurations."""
            try:
                return await get_persona_generation_options(current_user)
            except Exception as e:
                logger.error(f"Error in get_persona_options: {e}")
                raise HTTPException(status_code=500, detail=str(e))
    
    def get_onboarding_status(self) -> Dict[str, Any]:
        """Get the status of onboarding endpoints."""
        return {
            "onboarding_endpoints": [
                "/api/onboarding/init",
                "/api/onboarding/status", 
                "/api/onboarding/progress",
                "/api/onboarding/step/{step_number}",
                "/api/onboarding/step/{step_number}/complete",
                "/api/onboarding/step/{step_number}/skip",
                "/api/onboarding/step/{step_number}/validate",
                "/api/onboarding/api-keys",
                "/api/onboarding/api-keys/onboarding",
                "/api/onboarding/start",
                "/api/onboarding/complete",
                "/api/onboarding/reset",
                "/api/onboarding/resume",
                "/api/onboarding/config",
                "/api/onboarding/providers/{provider}/setup",
                "/api/onboarding/providers",
                "/api/onboarding/providers/{provider}/validate",
                "/api/onboarding/validation/enhanced",
                "/api/onboarding/summary",
                "/api/onboarding/website-analysis",
                "/api/onboarding/research-preferences",
                "/api/onboarding/business-info",
                "/api/onboarding/step4/generate-personas",
                "/api/onboarding/step4/generate-personas-async",
                "/api/onboarding/step4/persona-task/{task_id}",
                "/api/onboarding/step4/persona-latest",
                "/api/onboarding/step4/persona-save",
                "/api/onboarding/step4/assess-persona-quality",
                "/api/onboarding/step4/regenerate-persona",
                "/api/onboarding/step4/persona-options"
            ],
            "total_endpoints": 30,
            "status": "active"
        }
