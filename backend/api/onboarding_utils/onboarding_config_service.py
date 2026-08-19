"""
Onboarding Configuration Service
Handles onboarding configuration and provider setup information.
"""

from typing import Dict, Any
from fastapi import HTTPException
from loguru import logger

from services.onboarding.api_key_manager import get_api_key_manager
from services.validation import check_all_api_keys

class OnboardingConfigService:
    """Service for handling onboarding configuration and provider setup."""
    
    def __init__(self):
        self.api_key_manager = get_api_key_manager()
    
    def get_onboarding_config(self) -> Dict[str, Any]:
        """Get onboarding configuration and requirements."""
        return {
            "total_steps": 6,
            "steps": [
                {
                    "number": 1,
                    "title": "AI LLM Providers",
                    "description": "Configure AI language model providers",
                    "required": True,
                    "providers": ["openai", "gemini", "anthropic", "orcarouter"]
                },
                {
                    "number": 2,
                    "title": "Website Analysis",
                    "description": "Set up website analysis and crawling",
                    "required": True
                },
                {
                    "number": 3,
                    "title": "AI Research",
                    "description": "Configure AI research capabilities",
                    "required": True
                },
                {
                    "number": 4,
                    "title": "Personalization",
                    "description": "Set up personalization features",
                    "required": False
                },
                {
                    "number": 5,
                    "title": "Integrations",
                    "description": "Configure ALwrity integrations",
                    "required": False
                },
                {
                    "number": 6,
                    "title": "Complete Setup",
                    "description": "Finalize and complete onboarding",
                    "required": True
                }
            ],
            "requirements": {
                "min_api_keys": 1,
                "required_providers": ["openai"],
                "optional_providers": ["gemini", "anthropic", "orcarouter"]
            }
        }
    
    async def get_provider_setup_info(self, provider: str) -> Dict[str, Any]:
        """Get setup information for a specific provider."""
        try:
            providers_info = self.get_all_providers_info()
            if provider in providers_info:
                return providers_info[provider]
            else:
                raise HTTPException(status_code=404, detail=f"Provider {provider} not found")
        except Exception as e:
            logger.error(f"Error getting provider setup info: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error")
    
    def get_all_providers_info(self) -> Dict[str, Any]:
        """Get setup information for all providers."""
        return {
            "openai": {
                "name": "OpenAI",
                "description": "GPT-4 and GPT-3.5 models for content generation",
                "setup_url": "https://platform.openai.com/api-keys",
                "required_fields": ["api_key"],
                "optional_fields": ["organization_id"]
            },
            "gemini": {
                "name": "Google Gemini",
                "description": "Google's advanced AI models for content creation",
                "setup_url": "https://makersuite.google.com/app/apikey",
                "required_fields": ["api_key"],
                "optional_fields": []
            },
            "anthropic": {
                "name": "Anthropic",
                "description": "Claude models for sophisticated content generation",
                "setup_url": "https://console.anthropic.com/",
                "required_fields": ["api_key"],
                "optional_fields": []
            },
            "orcarouter": {
                "name": "OrcaRouter",
                "description": "Unified gateway to 200+ models (OpenAI, Anthropic, Google, Meta and more) through one OpenAI-compatible endpoint",
                "setup_url": "https://www.orcarouter.ai",
                "required_fields": ["api_key"],
                "optional_fields": []
            }
        }
    
    async def validate_provider_key(self, provider: str, api_key: str) -> Dict[str, Any]:
        """Validate a specific provider's API key."""
        try:
            # This would need to be implemented based on the actual validation logic
            # For now, return a basic validation result
            return {
                "provider": provider,
                "valid": True,
                "message": f"API key for {provider} is valid"
            }
        except Exception as e:
            logger.error(f"Error validating provider key: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error")
    
    async def get_enhanced_validation_status(self) -> Dict[str, Any]:
        """Get enhanced validation status for all configured services."""
        try:
            return await check_all_api_keys(self.api_key_manager)
        except Exception as e:
            logger.error(f"Error getting enhanced validation status: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error")
