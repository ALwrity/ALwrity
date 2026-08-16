"""
Podcast Persona Prompts
Contains podcast-specific persona prompt generation logic.
"""

from typing import Dict, Any
from loguru import logger


class PodcastPersonaPrompts:
    """Podcast-specific persona prompt generation."""

    @staticmethod
    def build_podcast_system_prompt(core_persona: Dict[str, Any]) -> str:
        """Build the system prompt with the core persona foundation."""
        import json

        return f"""You are an expert podcast producer and audio/video content strategist specializing in brand-consistent show creation.

CORE PERSONA FOUNDATION:
{json.dumps(core_persona, indent=2)}

TASK: Create a podcast-optimized persona that maintains the brand's core identity while adding concrete, audio/video-aware guidance (host voice, visual style, audio environment, show rules, audience, and ready-to-inject prompt fragments).

CRITICAL RULES:
- Every field must be grounded in the core persona + onboarding data. Do NOT invent generic values.
- The `prompt_defaults` fields must be self-contained, brand-specific prompt fragments a text-to-image/video model can use directly (including brand colors, setting, framing, and negative instructions).
- For `host.look`, avoid guessing ethnicity or sensitive traits — describe market-fit and style only."""

    @staticmethod
    def build_focused_podcast_prompt(onboarding_data: Dict[str, Any]) -> str:
        """Build the focused user prompt (without core persona JSON, to save context)."""
        audience = PodcastPersonaPrompts._extract_audience_context(onboarding_data)

        return f"""PODCAST OPTIMIZATION TASK: Create a podcast-specific persona adaptation from the core persona.

AUDIENCE CONTEXT:
- Target: {audience.get('target_audience', 'general')}
- Expertise: {audience.get('expertise_level', 'general')}
- Interests: {audience.get('interests', [])}
- Pain points: {audience.get('pain_points', [])}

PODCAST SPECS:
- Formats: short clips, full episodes, video podcasts
- Consistent intro/outro and host delivery across episodes
- Visual consistency across avatars, studio, and thumbnails
- Audio consistency across music and sound design

REQUIREMENTS (each field grounded in the data):
1. host — name, background, expertise, vocal style, personality traits, catchphrases, and visual look.
2. visual_style — style preset, environment, lighting, color palette, camera style.
3. audio_environment — soundscape, music mood, and sound-effect style.
4. show_rules — intro/outro format, interaction tone, and constraints.
5. audience — expertise, interests, and pain points.
6. brand — tone, communication style, and key messages.
7. prompt_defaults — host_image_prompt, studio_prompt, negative_prompt (self-contained fragments for image/video generation models).

Generate a comprehensive, brand-specific podcast persona."""

    @staticmethod
    def _extract_audience_context(onboarding_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract audience context from onboarding data."""
        try:
            website_analysis = onboarding_data.get("website_analysis", {}) or {}
            enhanced = onboarding_data.get("enhanced_analysis", {}) or {}

            audience_intel = enhanced.get("audience_intelligence", {}) or {}
            target_audience = website_analysis.get("target_audience", {}) or {}

            return {
                "target_audience": target_audience.get("primary_audience", "general"),
                "expertise_level": audience_intel.get("expertise_level", "general"),
                "interests": audience_intel.get("interests", []),
                "pain_points": audience_intel.get("pain_points", []),
            }
        except Exception as e:
            logger.warning(f"Error extracting audience context: {str(e)}")
            return {
                "target_audience": "general",
                "expertise_level": "general",
                "interests": [],
                "pain_points": [],
            }
