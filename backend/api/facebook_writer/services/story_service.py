"""Facebook Story generation service."""

from typing import Dict, Any, List
from ..models.story_models import FacebookStoryRequest, FacebookStoryResponse
from .base_service import FacebookWriterBaseService
try:
    from ...services.llm_providers.main_image_generation import generate_image
    from base64 import b64encode
except Exception:
    generate_image = None  # type: ignore
    b64encode = None  # type: ignore


class FacebookStoryService(FacebookWriterBaseService):
    """Service for generating Facebook stories."""
    
    def generate_story(self, request: FacebookStoryRequest, user_id: str) -> FacebookStoryResponse:
        """
        Generate a Facebook story based on the request parameters.
        
        Args:
            request: FacebookStoryRequest containing all the parameters
            
        Returns:
            FacebookStoryResponse with the generated content
        """
        try:
            # Determine the actual story type and tone
            actual_story_type = request.custom_story_type if request.story_type.value == "Custom" else request.story_type.value
            actual_tone = request.custom_tone if request.story_tone.value == "Custom" else request.story_tone.value
            
            # Get persona data for enhanced content generation
            persona_data = self._get_persona_data(int(user_id))
            
            # Build the prompt
            base_prompt = self._build_story_prompt(request, actual_story_type, actual_tone)
            prompt = self._build_persona_enhanced_prompt(base_prompt, persona_data)
            
            # Generate the story content
            content = self._generate_text(prompt, temperature=0.7, max_tokens=1024)
            
            if not content:
                return FacebookStoryResponse(
                    success=False,
                    error="Failed to generate story content"
                )
            
            # Generate visual suggestions and engagement tips
            visual_suggestions = self._generate_visual_suggestions(actual_story_type, request.visual_options)
            engagement_tips = self._generate_engagement_tips("story")
            # Optional: generate one story image (9:16) using unified image generation
            images_base64: List[str] = []
            try:
                if generate_image is not None and b64encode is not None:
                    img_prompt = request.visual_options.background_image_prompt or (
                        f"Facebook story background for {request.business_type}. "
                        f"Style: {actual_tone}. Type: {actual_story_type}. Vertical mobile 9:16, high contrast, legible overlay space."
                    )
                    # Generate image using unified system (9:16 aspect ratio = 1080x1920)
                    result = generate_image(
                        prompt=img_prompt,
                        options={
                            "provider": "gemini",  # Facebook stories use Gemini
                            "width": 1080,
                            "height": 1920,
                        }
                    )
                    if result and result.image_bytes:
                        # Convert bytes to base64
                        image_b64 = b64encode(result.image_bytes).decode('utf-8')
                        images_base64 = [image_b64]
            except Exception as e:
                # Log error but continue without images
                images_base64 = []
            
            return FacebookStoryResponse(
                success=True,
                content=content,
                images_base64=images_base64[:1],
                visual_suggestions=visual_suggestions,
                engagement_tips=engagement_tips,
                metadata={
                    "business_type": request.business_type,
                    "target_audience": request.target_audience,
                    "story_type": actual_story_type,
                    "tone": actual_tone
                }
            )
            
        except Exception as e:
            return FacebookStoryResponse(
                **self._handle_error(e, "Facebook story generation")
            )
    
    def _build_story_prompt(self, request: FacebookStoryRequest, story_type: str, tone: str) -> str:
        """
        Build the prompt for Facebook story generation.
        
        Args:
            request: The story request
            story_type: The actual story type (resolved from custom if needed)
            tone: The actual tone (resolved from custom if needed)
            
        Returns:
            Formatted prompt string
        """
        base_prompt = self._build_base_prompt(
            request.business_type,
            request.target_audience,
            f"Create a {story_type} story"
        )
        
        # Advanced writing flags
        advanced_lines = []
        if getattr(request, "use_hook", True):
            advanced_lines.append("- Start with a compelling hook in the first line")
        if getattr(request, "use_story", True):
            advanced_lines.append("- Use a mini narrative with a clear flow")
        if getattr(request, "use_cta", True):
            cta_text = request.visual_options.call_to_action or "Add a clear call-to-action"
            advanced_lines.append(f"- Include a CTA: {cta_text}")
        if getattr(request, "use_question", True):
            advanced_lines.append("- Ask a question to prompt replies or taps")
        if getattr(request, "use_emoji", True):
            advanced_lines.append("- Use a few relevant emojis for tone and scannability")
        if getattr(request, "use_hashtags", True):
            advanced_lines.append("- Include 1-3 relevant hashtags if appropriate")

        advanced_str = "\n".join(advanced_lines)

        # Visual details
        v = request.visual_options
        interactive_types_str = ", ".join(v.interactive_types) if v.interactive_types else "None specified"
        newline = '\n'

        prompt = f"""
        {base_prompt}
        
        Generate a Facebook Story with the following specifications:
        
        Story Type: {story_type}
        Tone: {tone}
        
        Content Requirements:
        - Include: {request.include or 'N/A'}
        - Avoid: {request.avoid or 'N/A'}
        {newline + advanced_str if advanced_str else ''}
        
        Visual Options:
        - Background Type: {v.background_type}
        - Background Visual Prompt: {v.background_image_prompt or 'N/A'}
        - Gradient Style: {v.gradient_style or 'N/A'}
        - Text Overlay: {v.text_overlay}
        - Text Style: {v.text_style or 'N/A'}
        - Text Color: {v.text_color or 'N/A'}
        - Text Position: {v.text_position or 'N/A'}
        - Stickers/Emojis: {v.stickers}
        - Interactive Elements: {v.interactive_elements}
        - Interactive Types: {interactive_types_str}
        - Call To Action: {v.call_to_action or 'N/A'}
        
        Please create a Facebook Story that:
        1. Is optimized for mobile viewing (vertical format)
        2. Has concise, impactful text (stories are viewed quickly)
        3. Includes clear visual direction for designers
        4. Maintains {tone} tone throughout
        5. Encourages viewer interaction
        6. Fits the {story_type} format
        7. Appeals to: {request.target_audience}
        
        Format the response with:
        - Main story text/copy
        - Visual description
        - Text overlay suggestions
        - Interactive element suggestions (if enabled)
        
        Keep it engaging and story-appropriate for Facebook's ephemeral format.
        """
        
        return prompt
    
    def _generate_visual_suggestions(self, story_type: str, visual_options) -> List[str]:
        """Generate visual suggestions based on story type and options."""
        suggestions = []
        
        if story_type == "Product showcase":
            suggestions.extend([
                "Use high-quality product photos with clean backgrounds",
                "Include multiple angles or features in carousel format",
                "Add animated elements to highlight key features"
            ])
        elif story_type == "Behind the scenes":
            suggestions.extend([
                "Use candid, authentic photos/videos",
                "Show the process or journey",
                "Include team members or workspace shots"
            ])
        elif story_type == "Tutorial/How-to":
            suggestions.extend([
                "Break down steps with numbered overlays",
                "Use before/after comparisons",
                "Include clear, step-by-step visuals"
            ])
        
        # Add general suggestions based on visual options
        if getattr(visual_options, "text_overlay", True):
            suggestions.append("Use bold, readable fonts for text overlays")
            if getattr(visual_options, "text_style", None):
                suggestions.append(f"Match text style to tone: {visual_options.text_style}")
            if getattr(visual_options, "text_color", None):
                suggestions.append(f"Ensure sufficient contrast with text color: {visual_options.text_color}")
            if getattr(visual_options, "text_position", None):
                suggestions.append(f"Place text at {visual_options.text_position} to avoid occluding subject")

        if getattr(visual_options, "stickers", True):
            suggestions.append("Add relevant emojis and stickers to increase engagement")
        
        if getattr(visual_options, "interactive_elements", True):
            suggestions.append("Include polls, questions, or swipe-up actions")
            if getattr(visual_options, "interactive_types", None):
                suggestions.append(f"Try interactive types: {', '.join(visual_options.interactive_types)}")

        if getattr(visual_options, "background_type", None) in {"Image", "Video"} and getattr(visual_options, "background_image_prompt", None):
            suggestions.append("Source visuals based on background prompt for consistency")

        if getattr(visual_options, "call_to_action", None):
            suggestions.append(f"Overlay CTA copy near focal point: {visual_options.call_to_action}")
        
        return suggestions
    
    def _generate_engagement_tips(self, content_type: str) -> List[str]:
        """Generate engagement tips specific to stories."""
        return [
            "Post at peak audience activity times",
            "Use interactive stickers to encourage participation",
            "Keep text minimal and highly readable",
            "Include a clear call-to-action",
            "Use trending hashtags in story text",
            "Tag relevant accounts to increase reach",
            "Save important stories as Highlights"
        ]