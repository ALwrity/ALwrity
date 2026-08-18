"""Base service for Facebook Writer functionality."""

import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional
from loguru import logger

# Add the backend path to sys.path to import services
backend_path = Path(__file__).parent.parent.parent.parent
sys.path.append(str(backend_path))

from services.llm_providers.gemini_provider import gemini_text_response, gemini_structured_json_response
from services.persona_data_service import PersonaDataService
from typing import Dict, Any, Optional
import time


class FacebookWriterBaseService:
    """Base service class for Facebook Writer functionality."""
    
    def __init__(self):
        """Initialize the base service."""
        self.logger = logger
        self.persona_service = PersonaDataService()
        
        # Persona caching
        self._persona_cache: Dict[str, Dict[str, Any]] = {}
        self._cache_timestamps: Dict[str, float] = {}
        self._cache_duration = 300  # 5 minutes cache duration
        
    def _generate_text(self, prompt: str, temperature: float = 0.7, max_tokens: int = 2048) -> str:
        """
        Generate text using Gemini provider.
        
        Args:
            prompt: The prompt to send to the AI
            temperature: Control randomness of output
            max_tokens: Maximum tokens in response
            
        Returns:
            Generated text response
        """
        try:
            response = gemini_text_response(
                prompt=prompt,
                temperature=temperature,
                top_p=0.9,
                n=40,
                max_tokens=max_tokens,
                system_prompt=None
            )
            return response
        except Exception as e:
            self.logger.error(f"Error generating text: {e}")
            raise
    
    def _generate_structured_response(
        self, 
        prompt: str, 
        schema: Dict[str, Any], 
        temperature: float = 0.3, 
        max_tokens: int = 8192
    ) -> Dict[str, Any]:
        """
        Generate structured JSON response using Gemini provider.
        
        Args:
            prompt: The prompt to send to the AI
            schema: JSON schema for structured output
            temperature: Control randomness (lower for structured output)
            max_tokens: Maximum tokens in response
            
        Returns:
            Structured JSON response
        """
        try:
            response = gemini_structured_json_response(
                prompt=prompt,
                schema=schema,
                temperature=temperature,
                top_p=0.9,
                top_k=40,
                max_tokens=max_tokens,
                system_prompt=None
            )
            return response
        except Exception as e:
            self.logger.error(f"Error generating structured response: {e}")
            raise
    
    def _build_base_prompt(self, business_type: str, target_audience: str, purpose: str) -> str:
        """
        Build a base prompt for Facebook content generation.
        
        Args:
            business_type: Type of business
            target_audience: Target audience description
            purpose: Purpose or goal of the content
            
        Returns:
            Base prompt string
        """
        return f"""
        You are an expert Facebook content creator specializing in creating engaging, high-performing social media content.
        
        Business Context:
        - Business Type: {business_type}
        - Target Audience: {target_audience}
        - Content Purpose: {purpose}
        
        Create content that:
        1. Resonates with the target audience
        2. Aligns with Facebook's best practices
        3. Encourages engagement and interaction
        4. Maintains a professional yet approachable tone
        5. Includes relevant calls-to-action when appropriate
        """
    
    def _create_analytics_prediction(self) -> Dict[str, str]:
        """
        Create default analytics predictions.
        
        Returns:
            Dictionary with analytics predictions
        """
        return {
            "expected_reach": "2.5K - 5K",
            "expected_engagement": "5-8%",
            "best_time_to_post": "2 PM - 4 PM"
        }
    
    def _create_optimization_suggestions(self, content_type: str = "post") -> list:
        """
        Create default optimization suggestions.
        
        Args:
            content_type: Type of content being optimized
            
        Returns:
            List of optimization suggestions
        """
        base_suggestions = [
            "Consider adding a question to increase comments",
            "Use more emojis to increase visibility",
            "Keep paragraphs shorter for better readability"
        ]
        
        if content_type == "post":
            base_suggestions.append("Add a poll to increase engagement")
        elif content_type == "story":
            base_suggestions.append("Include interactive stickers")
        elif content_type == "reel":
            base_suggestions.append("Use trending music for better reach")
        
        return base_suggestions
    
    def _get_persona_data(self, user_id: int = 1) -> Optional[Dict[str, Any]]:
        """
        Get persona data for Facebook platform with caching.
        
        Args:
            user_id: User ID to get persona for
            
        Returns:
            Persona data or None if not available
        """
        cache_key = f"facebook_persona_{user_id}"
        current_time = time.time()
        
        # Check cache first
        if cache_key in self._persona_cache and cache_key in self._cache_timestamps:
            cache_age = current_time - self._cache_timestamps[cache_key]
            if cache_age < self._cache_duration:
                self.logger.debug(f"Using cached persona data for user {user_id} (age: {cache_age:.1f}s)")
                return self._persona_cache[cache_key]
            else:
                # Cache expired, remove it
                self.logger.debug(f"Cache expired for user {user_id}, refreshing...")
                del self._persona_cache[cache_key]
                del self._cache_timestamps[cache_key]
        
        # Fetch fresh data
        try:
            persona_data = self.persona_service.get_platform_persona(user_id, 'facebook')
            
            # Cache the result
            if persona_data:
                self._persona_cache[cache_key] = persona_data
                self._cache_timestamps[cache_key] = current_time
                self.logger.debug(f"Cached persona data for user {user_id}")
            
            return persona_data
            
        except Exception as e:
            self.logger.warning(f"Could not load persona data for Facebook content generation: {e}")
            return None
    
    def _clear_persona_cache(self, user_id: int = None):
        """
        Clear persona cache for a specific user or all users.
        
        Args:
            user_id: User ID to clear cache for, or None to clear all
        """
        if user_id is None:
            self._persona_cache.clear()
            self._cache_timestamps.clear()
            self.logger.info("Cleared all persona cache")
        else:
            cache_key = f"facebook_persona_{user_id}"
            if cache_key in self._persona_cache:
                del self._persona_cache[cache_key]
                del self._cache_timestamps[cache_key]
                self.logger.info(f"Cleared persona cache for user {user_id}")
    
    def _build_persona_enhanced_prompt(self, base_prompt: str, persona_data: Optional[Dict[str, Any]] = None) -> str:
        """
        Enhance prompt with persona data if available.
        
        Args:
            base_prompt: Base prompt to enhance
            persona_data: Persona data to incorporate
            
        Returns:
            Enhanced prompt with persona guidance
        """
        if not persona_data:
            return base_prompt
        
        try:
            core_persona = persona_data.get('core_persona', {})
            platform_persona = persona_data.get('platform_persona', {})
            
            if not core_persona:
                return base_prompt
            
            persona_guidance = f"""
PERSONA-AWARE WRITING GUIDANCE:
- PERSONA: {core_persona.get('identity', {}).get('persona_name', 'Unknown')} ({core_persona.get('identity', {}).get('archetype', 'Unknown')})
- CORE BELIEF: {core_persona.get('identity', {}).get('core_belief', 'Unknown')}
- CONFIDENCE SCORE: {core_persona.get('confidence', 0)}%

PLATFORM OPTIMIZATION (Facebook):
- CHARACTER LIMIT: {platform_persona.get('content_format_rules', {}).get('character_limit', '63206')} characters
- OPTIMAL LENGTH: {platform_persona.get('content_format_rules', {}).get('optimal_length', '40-80 characters')}
- ENGAGEMENT PATTERN: {platform_persona.get('engagement_patterns', {}).get('posting_frequency', '1-2 times per day')}
- HASHTAG STRATEGY: {platform_persona.get('lexical_features', {}).get('hashtag_strategy', '1-2 relevant hashtags')}

ALWAYS generate content that matches this persona's linguistic fingerprint and platform optimization rules.
"""
            
            return f"{base_prompt}\n\n{persona_guidance}"
            
        except Exception as e:
            self.logger.warning(f"Error enhancing prompt with persona data: {e}")
            return base_prompt

    def _handle_error(self, error: Exception, operation: str) -> Dict[str, Any]:
        """
        Handle errors and return standardized error response.
        
        Args:
            error: The exception that occurred
            operation: Description of the operation that failed
            
        Returns:
            Standardized error response
        """
        error_message = f"Error in {operation}: {str(error)}"
        self.logger.error(error_message)
        
        return {
            "success": False,
            "error": error_message,
            "content": None,
            "metadata": {
                "operation": operation,
                "error_type": type(error).__name__
            }
        }