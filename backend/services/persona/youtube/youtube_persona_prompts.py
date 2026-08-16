"""
YouTube Persona Prompts
Contains YouTube-specific persona prompt generation logic.
"""

from typing import Dict, Any
from loguru import logger


class YouTubePersonaPrompts:
    """YouTube-specific persona prompt generation."""

    @staticmethod
    def build_youtube_system_prompt(core_persona: Dict[str, Any]) -> str:
        """Build the system prompt with the core persona foundation."""
        import json

        return f"""You are an expert YouTube content strategist and video producer specializing in brand-consistent video creation.

CORE PERSONA FOUNDATION:
{json.dumps(core_persona, indent=2)}

TASK: Create a YouTube-optimized persona that maintains the brand's core identity while adding concrete, video-aware guidance (tone, pacing, script structure, visual style, titles/descriptions, and ready-to-inject image/video prompt fragments).

CRITICAL RULES:
- Every field must be grounded in the core persona + onboarding data. Do NOT invent generic values.
- The `prompt_defaults` fields must be self-contained, brand-specific prompt fragments a text-to-image/video model can use directly (including brand colors, framing, and negative instructions).
- Be specific — a third party should immediately recognize content made from this persona as belonging to this brand."""

    @staticmethod
    def build_focused_youtube_prompt(onboarding_data: Dict[str, Any]) -> str:
        """Build the focused user prompt (without core persona JSON, to save context)."""
        audience = YouTubePersonaPrompts._extract_audience_context(onboarding_data)

        return f"""YOUTUBE OPTIMIZATION TASK: Create a YouTube-specific persona adaptation from the core persona.

AUDIENCE CONTEXT:
- Target: {audience.get('target_audience', 'general')}
- Expertise: {audience.get('expertise_level', 'general')}
- Interests: {audience.get('interests', [])}
- Pain points: {audience.get('pain_points', [])}

YOUTUBE SPECS:
- Formats: Shorts (<=60s), Medium (1-4min), Long (4-10min)
- Hook-first: capture attention in the first 5 seconds
- Titles/thumbnails drive click-through; descriptions drive SEO
- Visual consistency across thumbnails, b-roll, and on-screen text

REQUIREMENTS (each field grounded in the data):
1. tone_and_pacing — default tone, pace, energy level, and delivery style for videos.
2. script_structure — hook, intro, body, and call-to-action patterns.
3. visual_style — color palette, thumbnail style, on-screen text, b-roll, camera framing.
4. title_description — title + description strategy and SEO keywords.
5. target_audience — expertise, interests, and pain points for this channel.
6. engagement — call-to-action and engagement prompts.
7. prompt_defaults — image_base_prompt, video_base_prompt, negative_prompt (self-contained fragments for image/video generation models).

Generate a comprehensive, brand-specific YouTube persona."""

    @staticmethod
    def _extract_audience_context(onboarding_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract audience context from onboarding data."""
        try:
            website_analysis = onboarding_data.get("website_analysis", {}) or {}
            enhanced = onboarding_data.get("enhanced_analysis", {}) or {}
            research_prefs = onboarding_data.get("research_preferences", {}) or {}

            audience_intel = enhanced.get("audience_intelligence", {}) or {}
            target_audience = website_analysis.get("target_audience", {}) or {}

            return {
                "target_audience": target_audience.get("primary_audience", "general"),
                "expertise_level": audience_intel.get("expertise_level", "general"),
                "interests": audience_intel.get("interests", []),
                "pain_points": audience_intel.get("pain_points", []),
                "content_goals": research_prefs.get("content_goals", "engagement"),
            }
        except Exception as e:
            logger.warning(f"Error extracting audience context: {str(e)}")
            return {
                "target_audience": "general",
                "expertise_level": "general",
                "interests": [],
                "pain_points": [],
                "content_goals": "engagement",
            }
