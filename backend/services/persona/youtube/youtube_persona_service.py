"""
YouTube Persona Service
Encapsulates YouTube-specific persona generation logic.
"""

from typing import Dict, Any, Optional, List
from loguru import logger

from .youtube_persona_prompts import YouTubePersonaPrompts
from services.llm_providers.main_text_generation import llm_text_gen


class YouTubePersonaService:
    """YouTube-specific persona generation service."""

    # ----------------------------------------------------------------------
    # DESIGN NOTE — two-tier personalization (do not regress):
    #   Base persona = stable FORM: tone_and_pacing, visual_style,
    #   script_structure, target_audience, prompt_defaults. Same across every
    #   video. It fills DEFAULTS only — it never overrides an explicit input.
    #   Episode = transient CONTENT: user_idea + overrides (target_audience /
    #   video_goal / brand_style). Always wins over the base persona.
    #   prompt_defaults = machine-facing bridge for image/video models:
    #   [base fragment] + [scene/episode content] + [negative_prompt],
    #   APPEND-ONLY; an explicit user custom prompt always wins.
    #
    # DEFERRED (PHASE-3B): media handlers don't yet consume prompt_defaults.
    # Inject image_base_prompt / video_base_prompt / negative_prompt in:
    #   api/youtube/handlers/images.py (scene images),
    #   api/youtube/handlers/avatar_generation.py (avatar),
    # and flow the persona through /scenes -> scene_builder so medium/long
    # scene narration + visual_prompt stay on-brand (services/youtube/scene_builder.py,
    # api/youtube/handlers/plan.py).
    # ----------------------------------------------------------------------

    _instance = None
    _initialized = False

    def __new__(cls):
        """Implement singleton pattern to prevent multiple initializations."""
        if cls._instance is None:
            cls._instance = super(YouTubePersonaService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        """Initialize the YouTube persona service (only once)."""
        if not self._initialized:
            self.prompts = YouTubePersonaPrompts()
            logger.debug("YouTubePersonaService initialized")
            self._initialized = True

    def generate_youtube_persona(
        self,
        core_persona: Dict[str, Any],
        onboarding_data: Dict[str, Any],
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate a YouTube-specific persona adaptation.

        Args:
            core_persona: The core persona data.
            onboarding_data: User onboarding data.
            user_id: Optional explicit Clerk user ID. Used for subscription
                checks / usage tracking. Falls back to looking up
                ``onboarding_data["session_info"]["user_id"]``.

        Returns:
            YouTube-optimized persona data (or an error dict).
        """
        try:
            logger.info("Generating YouTube-specific persona")

            prompt = self.prompts.build_focused_youtube_prompt(onboarding_data)
            system_prompt = self.prompts.build_youtube_system_prompt(core_persona)
            schema = self._get_youtube_schema()

            # Resolve user_id for the LLM gateway's subscription check.
            if not user_id and isinstance(onboarding_data, dict):
                session_info = onboarding_data.get("session_info")
                if isinstance(session_info, dict):
                    user_id = session_info.get("user_id")

            response = llm_text_gen(
                prompt=prompt,
                json_struct=schema,
                temperature=0.2,
                max_tokens=4096,
                system_prompt=system_prompt,
                user_id=user_id,
                flow_type="youtube_persona_generation",
            )

            if not response or "error" in response:
                logger.error(f"Failed to generate YouTube persona: {response}")
                return {"error": f"Failed to generate YouTube persona: {response}"}

            logger.info("✅ YouTube persona generated successfully")
            return response

        except Exception as e:
            logger.error(f"Error generating YouTube persona: {str(e)}")
            return {"error": f"Failed to generate YouTube persona: {str(e)}"}

    @staticmethod
    def build_prompt_context(persona: Optional[Dict[str, Any]]) -> str:
        """Render a prompt-friendly persona block from a YouTube persona dict.

        This is the two-tier model's "base FORM" bridge: it turns the stable
        brand identity (tone/pacing, visual style, script structure, audience,
        prompt_defaults) into a text block that the planner injects as DEFAULTS.
        The episode's own inputs (topic, target_audience, brand_style) are applied
        separately and always override this block.

        Co-located with ``_get_youtube_schema`` so the renderer and the schema
        it consumes evolve together. Returns an empty string for empty/invalid
        input so callers can safely inject it into a planning prompt.
        """
        if not persona or not isinstance(persona, dict):
            return ""

        lines: List[str] = []

        identity = [
            persona.get("persona_name"),
            persona.get("archetype"),
            persona.get("core_belief"),
        ]
        identity = [str(x) for x in identity if x]
        if identity:
            lines.append("**Identity:** " + " — ".join(identity))

        tone = persona.get("tone_and_pacing") or {}
        tone_bits = [
            f"{label}: {tone[key]}"
            for key, label in (
                ("default_tone", "Tone"),
                ("pace", "Pace"),
                ("energy_level", "Energy"),
                ("delivery_style", "Delivery"),
            )
            if tone.get(key)
        ]
        if tone_bits:
            lines.append("**Tone & Pacing:** " + "; ".join(tone_bits))

        script = persona.get("script_structure") or {}
        script_bits = [
            f"{label}: {script[key]}"
            for key, label in (
                ("hook_style", "Hook"),
                ("intro_format", "Intro"),
                ("body_structure", "Body"),
                ("cta_style", "CTA"),
            )
            if script.get(key)
        ]
        if script_bits:
            lines.append("**Script Structure:** " + "; ".join(script_bits))

        visual = persona.get("visual_style") or {}
        visual_bits: List[str] = []
        palette = visual.get("color_palette") or []
        if palette:
            visual_bits.append("Colors: " + ", ".join(str(c) for c in palette))
        visual_bits.extend(
            f"{label}: {visual[key]}"
            for key, label in (
                ("thumbnail_style", "Thumbnails"),
                ("on_screen_text", "On-screen text"),
                ("b_roll", "B-roll"),
                ("camera_framing", "Camera"),
            )
            if visual.get(key)
        )
        if visual_bits:
            lines.append("**Visual Style:** " + "; ".join(visual_bits))

        title = persona.get("title_description") or {}
        title_bits = [
            f"{label}: {title[key]}"
            for key, label in (
                ("title_strategy", "Titles"),
                ("description_strategy", "Descriptions"),
            )
            if title.get(key)
        ]
        seo = title.get("seo_keywords") or []
        if seo:
            title_bits.append("SEO keywords: " + ", ".join(str(k) for k in seo))
        if title_bits:
            lines.append("**Titles & Descriptions:** " + "; ".join(title_bits))

        audience = persona.get("target_audience") or {}
        audience_bits: List[str] = []
        if audience.get("expertise_level"):
            audience_bits.append(f"Expertise: {audience['expertise_level']}")
        interests = audience.get("interests") or []
        if interests:
            audience_bits.append("Interests: " + ", ".join(str(i) for i in interests))
        pains = audience.get("pain_points") or []
        if pains:
            audience_bits.append("Pain points: " + ", ".join(str(p) for p in pains))
        if audience_bits:
            lines.append("**Target Audience:** " + "; ".join(audience_bits))

        engagement = persona.get("engagement") or {}
        engagement_bits: List[str] = []
        if engagement.get("call_to_action"):
            engagement_bits.append(f"CTA: {engagement['call_to_action']}")
        prompts = engagement.get("engagement_prompts") or []
        if prompts:
            engagement_bits.append("Engagement: " + ", ".join(str(p) for p in prompts))
        if engagement_bits:
            lines.append("**Engagement:** " + "; ".join(engagement_bits))

        prompt_defaults = persona.get("prompt_defaults") or {}
        pd_bits = [
            f"{label}: {prompt_defaults[key]}"
            for key, label in (
                ("image_base_prompt", "Image base prompt"),
                ("video_base_prompt", "Video base prompt"),
                ("negative_prompt", "Negative prompt"),
            )
            if prompt_defaults.get(key)
        ]
        if pd_bits:
            lines.append("**Prompt Defaults (image/video):** " + "; ".join(pd_bits))

        if not lines:
            return ""

        return "**Persona Context:**\n- " + "\n- ".join(lines)

    def _get_youtube_schema(self) -> Dict[str, Any]:
        """Get the YouTube persona schema (video-aware)."""
        return {
            "type": "object",
            "description": "YouTube-optimized brand persona (video-aware)",
            "properties": {
                "persona_name": {"type": "string", "description": "Name of the YouTube persona"},
                "archetype": {"type": "string", "description": "Persona archetype"},
                "core_belief": {"type": "string", "description": "Core belief driving the channel"},
                "tone_and_pacing": {
                    "type": "object",
                    "properties": {
                        "default_tone": {"type": "string", "description": "Default tone for videos"},
                        "pace": {"type": "string", "description": "Pacing (cut frequency, rhythm)"},
                        "energy_level": {"type": "string", "description": "high | medium | low"},
                        "delivery_style": {"type": "string", "description": "e.g. direct-to-camera, voiceover"},
                    },
                },
                "script_structure": {
                    "type": "object",
                    "properties": {
                        "hook_style": {"type": "string"},
                        "intro_format": {"type": "string"},
                        "body_structure": {"type": "string"},
                        "cta_style": {"type": "string"},
                    },
                },
                "visual_style": {
                    "type": "object",
                    "properties": {
                        "color_palette": {"type": "array", "items": {"type": "string"}},
                        "thumbnail_style": {"type": "string"},
                        "on_screen_text": {"type": "string"},
                        "b_roll": {"type": "string"},
                        "camera_framing": {"type": "string"},
                    },
                },
                "title_description": {
                    "type": "object",
                    "properties": {
                        "title_strategy": {"type": "string"},
                        "description_strategy": {"type": "string"},
                        "seo_keywords": {"type": "array", "items": {"type": "string"}},
                    },
                },
                "target_audience": {
                    "type": "object",
                    "properties": {
                        "expertise_level": {"type": "string"},
                        "interests": {"type": "array", "items": {"type": "string"}},
                        "pain_points": {"type": "array", "items": {"type": "string"}},
                    },
                },
                "engagement": {
                    "type": "object",
                    "properties": {
                        "call_to_action": {"type": "string"},
                        "engagement_prompts": {"type": "array", "items": {"type": "string"}},
                    },
                },
                "prompt_defaults": {
                    "type": "object",
                    "description": "Ready-to-inject fragments for image/video generation models",
                    "properties": {
                        "image_base_prompt": {"type": "string"},
                        "video_base_prompt": {"type": "string"},
                        "negative_prompt": {"type": "string"},
                    },
                },
                "confidence_score": {"type": "number", "minimum": 0, "maximum": 100},
            },
            "required": [
                "persona_name",
                "archetype",
                "tone_and_pacing",
                "script_structure",
                "visual_style",
                "prompt_defaults",
            ],
        }
