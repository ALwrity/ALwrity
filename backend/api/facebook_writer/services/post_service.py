"""Facebook Post generation service."""

from typing import Dict, Any
from ..models.post_models import FacebookPostRequest, FacebookPostResponse, FacebookPostAnalytics, FacebookPostOptimization
from .base_service import FacebookWriterBaseService


class FacebookPostService(FacebookWriterBaseService):
    """Service for generating Facebook posts."""
    
    def generate_post(self, request: FacebookPostRequest, user_id: str) -> FacebookPostResponse:
        """
        Generate a Facebook post based on the request parameters.
        
        Args:
            request: FacebookPostRequest containing all the parameters
            
        Returns:
            FacebookPostResponse with the generated content
        """
        try:
            # Determine the actual goal and tone
            actual_goal = request.custom_goal if request.post_goal.value == "Custom" else request.post_goal.value
            actual_tone = request.custom_tone if request.post_tone.value == "Custom" else request.post_tone.value
            
            # Get persona data for enhanced content generation
            persona_data = self._get_persona_data(int(user_id))
            
            # Build the prompt
            base_prompt = self._build_post_prompt(request, actual_goal, actual_tone)
            prompt = self._build_persona_enhanced_prompt(base_prompt, persona_data)
            
            # Generate the post content
            content = self._generate_text(prompt, temperature=0.7, max_tokens=1024)
            
            if not content:
                return FacebookPostResponse(
                    success=False,
                    error="Failed to generate post content"
                )
            
            # Create analytics and optimization suggestions
            analytics = FacebookPostAnalytics(
                expected_reach="2.5K - 5K",
                expected_engagement="5-8%",
                best_time_to_post="2 PM - 4 PM"
            )
            
            optimization = FacebookPostOptimization(
                suggestions=self._create_optimization_suggestions("post")
            )
            
            return FacebookPostResponse(
                success=True,
                content=content,
                analytics=analytics,
                optimization=optimization,
                metadata={
                    "business_type": request.business_type,
                    "target_audience": request.target_audience,
                    "goal": actual_goal,
                    "tone": actual_tone
                }
            )
            
        except Exception as e:
            return FacebookPostResponse(
                **self._handle_error(e, "Facebook post generation")
            )
    
    def _build_post_prompt(self, request: FacebookPostRequest, goal: str, tone: str) -> str:
        """
        Build the prompt for Facebook post generation.
        
        Args:
            request: The post request
            goal: The actual goal (resolved from custom if needed)
            tone: The actual tone (resolved from custom if needed)
            
        Returns:
            Formatted prompt string
        """
        base_prompt = self._build_base_prompt(
            request.business_type,
            request.target_audience,
            goal
        )
        
        prompt = f"""
        {base_prompt}
        
        Generate a Facebook post with the following specifications:
        
        Goal: {goal}
        Tone: {tone}
        
        Content Requirements:
        - Include: {request.include or 'N/A'}
        - Avoid: {request.avoid or 'N/A'}
        
        Advanced Options:
        - Use attention-grabbing hook: {request.advanced_options.use_hook}
        - Include storytelling elements: {request.advanced_options.use_story}
        - Add clear call-to-action: {request.advanced_options.use_cta}
        - Include engagement question: {request.advanced_options.use_question}
        - Use relevant emojis: {request.advanced_options.use_emoji}
        - Add relevant hashtags: {request.advanced_options.use_hashtags}
        
        Media Type: {request.media_type.value}
        
        Please write a well-structured Facebook post that:
        1. Grabs attention in the first line (hook)
        2. Maintains consistent {tone} tone throughout
        3. Includes engaging content that aligns with the goal: {goal}
        4. Ends with a clear call-to-action (if enabled)
        5. Uses appropriate formatting and emojis (if enabled)
        6. Includes relevant hashtags (if enabled)
        7. Considers the target audience: {request.target_audience}
        
        The post should be engaging, platform-appropriate, and optimized for Facebook's algorithm.
        """
        
        return prompt