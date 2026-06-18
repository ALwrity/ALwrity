"""
Core Persona Service

Handles the core persona generation logic using the provider-agnostic llm_text_gen gateway.
"""

from typing import Dict, Any, List
from loguru import logger
from datetime import datetime

from services.llm_providers.main_text_generation import llm_text_gen
from .data_collector import OnboardingDataCollector
from .prompt_builder import PersonaPromptBuilder
from services.persona.linkedin.linkedin_persona_service import LinkedInPersonaService
from services.persona.facebook.facebook_persona_service import FacebookPersonaService


class CorePersonaService:
    """Core service for generating writing personas using the provider-agnostic LLM gateway."""
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        """Implement singleton pattern to prevent multiple initializations."""
        if cls._instance is None:
            cls._instance = super(CorePersonaService, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize the core persona service (only once)."""
        if not self._initialized:
            self.data_collector = OnboardingDataCollector()
            self.prompt_builder = PersonaPromptBuilder()
            self.linkedin_service = LinkedInPersonaService()
            self.facebook_service = FacebookPersonaService()
            logger.debug("CorePersonaService initialized")
            self._initialized = True
    
    def generate_core_persona(self, onboarding_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate core writing persona using the provider-agnostic LLM gateway."""
        
        # Build analysis prompt
        prompt = self.prompt_builder.build_persona_analysis_prompt(onboarding_data)
        
        # Get schema for structured response
        persona_schema = self.prompt_builder.get_persona_schema()
        
        # Extract user_id for tracking
        user_id = onboarding_data.get("session_info", {}).get("user_id")
        
        try:
            # Generate structured response using the provider-agnostic gateway
            # (handles GPT_PROVIDER routing, subscription/usage checks, fallbacks)
            response = llm_text_gen(
                prompt=prompt,
                json_struct=persona_schema,
                temperature=0.2,  # Low temperature for consistent analysis
                max_tokens=8192,
                system_prompt="You are an expert writing style analyst and persona developer. Analyze the provided data to create a precise, actionable writing persona.",
                user_id=user_id,
                flow_type="core_persona_generation"
            )
            
            if "error" in response:
                logger.error(f"LLM gateway error: {response['error']}")
                return {"error": f"AI analysis failed: {response['error']}"}
            
            logger.info("✅ Core persona generated successfully")
            return response
            
        except Exception as e:
            logger.error(f"Error generating core persona: {str(e)}")
            return {"error": f"Failed to generate core persona: {str(e)}"}
    
    def generate_platform_adaptations(self, core_persona: Dict[str, Any], onboarding_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate platform-specific persona adaptations."""
        
        platforms = ["twitter", "linkedin", "instagram", "facebook", "blog", "medium", "substack", "youtube"]
        platform_personas = {}
        
        for platform in platforms:
            try:
                platform_persona = self._generate_single_platform_persona(core_persona, platform, onboarding_data)
                if "error" not in platform_persona:
                    platform_personas[platform] = platform_persona
                else:
                    logger.warning(f"Failed to generate {platform} persona: {platform_persona['error']}")
            except Exception as e:
                logger.error(f"Error generating {platform} persona: {str(e)}")
        
        return platform_personas
    
    def _generate_single_platform_persona(self, core_persona: Dict[str, Any], platform: str, onboarding_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate persona adaptation for a specific platform."""
        
        # Use LinkedIn service for LinkedIn platform
        if platform.lower() == "linkedin":
            return self.linkedin_service.generate_linkedin_persona(core_persona, onboarding_data)
        
        # Use Facebook service for Facebook platform
        if platform.lower() == "facebook":
            return self.facebook_service.generate_facebook_persona(core_persona, onboarding_data)
        
        # Use generic platform adaptation for other platforms
        platform_constraints = self._get_platform_constraints(platform)
        prompt = self.prompt_builder.build_platform_adaptation_prompt(core_persona, platform, onboarding_data, platform_constraints)
        
        # Get platform-specific schema
        platform_schema = self.prompt_builder.get_platform_schema()
        
        # Extract user_id for tracking
        user_id = onboarding_data.get("session_info", {}).get("user_id")
        
        try:
            response = llm_text_gen(
                prompt=prompt,
                json_struct=platform_schema,
                temperature=0.2,
                max_tokens=4096,
                system_prompt=f"You are an expert in {platform} content strategy and platform-specific writing optimization.",
                user_id=user_id,
                flow_type=f"{platform}_persona_generation"
            )
            
            return response
            
        except Exception as e:
            logger.error(f"Error generating {platform} persona: {str(e)}")
            return {"error": f"Failed to generate {platform} persona: {str(e)}"}
    
    def _get_platform_constraints(self, platform: str) -> Dict[str, Any]:
        """Get platform-specific constraints and best practices."""
        
        constraints = {
            "twitter": {
                "character_limit": 280,
                "optimal_length": "120-150 characters",
                "hashtag_limit": 3,
                "image_support": True,
                "thread_support": True,
                "link_shortening": True
            },
            "linkedin": self.linkedin_service.get_linkedin_constraints(),
            "instagram": {
                "caption_limit": 2200,
                "optimal_length": "125-150 words",
                "hashtag_limit": 30,
                "visual_first": True,
                "story_support": True,
                "emoji_friendly": True
            },
            "facebook": {
                "character_limit": 63206,
                "optimal_length": "40-80 words",
                "algorithm_favors": "engagement",
                "link_preview": True,
                "event_support": True,
                "group_sharing": True
            },
            "blog": {
                "word_count": "800-2000 words",
                "seo_important": True,
                "header_structure": True,
                "internal_linking": True,
                "meta_descriptions": True,
                "readability_score": True
            },
            "medium": {
                "word_count": "1000-3000 words",
                "storytelling_focus": True,
                "subtitle_support": True,
                "publication_support": True,
                "clap_optimization": True,
                "follower_building": True
            },
            "substack": {
                "newsletter_format": True,
                "email_optimization": True,
                "subscription_focus": True,
                "long_form": True,
                "personal_connection": True,
                "monetization_support": True
            },
            "youtube": {
                "hook_optimization": True,
                "script_structure": "Hook-Intro-Body-CTA",
                "video_description_limit": 5000,
                "title_optimization": True,
                "engagement_prompts": True,
                "visual_cues": True
            }
        }
        
        return constraints.get(platform, {})
