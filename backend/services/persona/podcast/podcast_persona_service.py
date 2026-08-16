"""
Podcast Persona Service
Encapsulates podcast-specific persona generation logic.
"""

from typing import Dict, Any, Optional
from loguru import logger

from .podcast_persona_prompts import PodcastPersonaPrompts
from services.llm_providers.main_text_generation import llm_text_gen
from models.podcast_bible_models import (
    PodcastBible,
    HostPersona,
    AudienceDNA,
    BrandDNA,
    VisualStyle,
    AudioEnvironment,
    ShowRules,
)


class PodcastPersonaService:
    """Podcast-specific persona generation service."""

    # ----------------------------------------------------------------------
    # DESIGN NOTE — two-tier personalization (do not regress):
    #   Base persona = stable FORM: host, visual_style, audio_environment,
    #   show_rules, audience, brand, prompt_defaults. Same across every
    #   episode. It seeds the PodcastBible (DEFAULTS only).
    #   Episode = transient CONTENT: topic + per-project PodcastBible edits.
    #   A user-configured PodcastBible always WINS; the persona only seeds
    #   when no bible is provided (PodcastBibleService.get_or_build_bible).
    #   prompt_defaults = machine-facing bridge for image/video models:
    #   [base fragment] + [scene/episode content] + [negative_prompt],
    #   APPEND-ONLY; an explicit user custom prompt always wins.
    #
    # DEFERRED (PHASE-4B): media handlers don't yet consume prompt_defaults.
    # Inject host_image_prompt (avatar) in api/podcast/handlers/analysis.py and
    # studio_prompt + negative_prompt (scene images) in
    # api/podcast/handlers/images.py.
    # ----------------------------------------------------------------------

    _instance = None
    _initialized = False

    def __new__(cls):
        """Implement singleton pattern to prevent multiple initializations."""
        if cls._instance is None:
            cls._instance = super(PodcastPersonaService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        """Initialize the podcast persona service (only once)."""
        if not self._initialized:
            self.prompts = PodcastPersonaPrompts()
            logger.debug("PodcastPersonaService initialized")
            self._initialized = True

    def generate_podcast_persona(
        self,
        core_persona: Dict[str, Any],
        onboarding_data: Dict[str, Any],
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate a podcast-specific persona adaptation.

        Args:
            core_persona: The core persona data.
            onboarding_data: User onboarding data.
            user_id: Optional explicit Clerk user ID. Used for subscription
                checks / usage tracking. Falls back to looking up
                ``onboarding_data["session_info"]["user_id"]``.

        Returns:
            Podcast-optimized persona data (or an error dict).
        """
        try:
            logger.info("Generating podcast-specific persona")

            prompt = self.prompts.build_focused_podcast_prompt(onboarding_data)
            system_prompt = self.prompts.build_podcast_system_prompt(core_persona)
            schema = self._get_podcast_schema()

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
                flow_type="podcast_persona_generation",
            )

            if not response or "error" in response:
                logger.error(f"Failed to generate podcast persona: {response}")
                return {"error": f"Failed to generate podcast persona: {response}"}

            logger.info("✅ Podcast persona generated successfully")
            return response

        except Exception as e:
            logger.error(f"Error generating podcast persona: {str(e)}")
            return {"error": f"Failed to generate podcast persona: {str(e)}"}

    @staticmethod
    def to_podcast_bible(
        platform_persona: Optional[Dict[str, Any]],
        project_id: Optional[str] = None,
        core_persona: Optional[Dict[str, Any]] = None,
    ) -> Optional[PodcastBible]:
        """Map a podcast platform persona into a ``PodcastBible``.

        Co-located with ``_get_podcast_schema`` so the mapping and the schema it
        consumes evolve together. Returns ``None`` when there is no usable
        persona. Missing/absent fields fall back to sensible defaults so the
        resulting bible is always valid for ``serialize_bible``.

        Two deliberate schema-gap decisions (the persona schema intentionally
        omits these ``PodcastBible`` fields, so we derive them):
        1. ``vocal_characteristics`` -> empty list. The persona has a single
           ``host.vocal_style`` string (no discrete trait list), so we leave the
           trait list empty rather than duplicating the style string.
        2. ``brand.industry`` -> ``_derive_industry(core_persona)``. The persona's
           ``brand`` has tone/communication_style/key_messages but no industry, so
           we best-effort extract it from the core persona identity and fall back
           to ``"General Business"``.
        """
        if not platform_persona or not isinstance(platform_persona, dict):
            return None

        host = platform_persona.get("host") or {}
        visual = platform_persona.get("visual_style") or {}
        audio = platform_persona.get("audio_environment") or {}
        rules = platform_persona.get("show_rules") or {}
        audience = platform_persona.get("audience") or {}
        brand = platform_persona.get("brand") or {}

        host_persona = HostPersona(
            name=host.get("name") or "AI Host",
            background=host.get("background") or "Industry professional",
            expertise_level=host.get("expertise_level") or "Expert",
            personality_traits=host.get("personality_traits") or [],
            vocal_style=host.get("vocal_style") or "Authoritative",
            vocal_characteristics=[],
            look=host.get("look"),
            catchphrases=host.get("catchphrases") or [],
        )

        audience_dna = AudienceDNA(
            expertise_level=audience.get("expertise_level") or "Intermediate",
            interests=audience.get("interests") or [],
            pain_points=audience.get("pain_points") or [],
            demographics=None,
        )

        brand_dna = BrandDNA(
            industry=PodcastPersonaService._derive_industry(core_persona),
            tone=brand.get("tone") or "Professional",
            communication_style=brand.get("communication_style") or "Conversational",
            key_messages=brand.get("key_messages") or [],
            competitor_context=None,
        )

        visual_style = VisualStyle(
            style_preset=visual.get("style_preset") or "Professional Studio",
            environment=visual.get("environment") or "Modern podcast studio",
            lighting=visual.get("lighting") or "Soft studio lighting",
            color_palette=visual.get("color_palette") or [],
            camera_style=visual.get("camera_style") or "Static mid-shot",
        )

        audio_environment = AudioEnvironment(
            soundscape=audio.get("soundscape") or "Quiet studio",
            music_mood=audio.get("music_mood") or "Professional & subtle",
            sfx_style=audio.get("sfx_style") or "Minimalist",
        )

        show_rules = ShowRules(
            intro_format=rules.get("intro_format") or "Standard welcome and topic introduction",
            outro_format=rules.get("outro_format") or "Summary and sign-off",
            interaction_tone=rules.get("interaction_tone") or "Conversational",
            constraints=rules.get("constraints") or [],
        )

        return PodcastBible(
            project_id=project_id,
            host=host_persona,
            audience=audience_dna,
            brand=brand_dna,
            visual_style=visual_style,
            audio_environment=audio_environment,
            show_rules=show_rules,
        )

    @staticmethod
    def _derive_industry(core_persona: Optional[Dict[str, Any]]) -> str:
        """Best-effort industry extraction from the core persona identity."""
        if not core_persona or not isinstance(core_persona, dict):
            return "General Business"
        identity = core_persona.get("identity") or {}
        if not isinstance(identity, dict):
            return "General Business"
        for key in ("industry", "business_type", "industry_focus", "niche"):
            value = identity.get(key)
            if value:
                return str(value)
        return "General Business"

    def _get_podcast_schema(self) -> Dict[str, Any]:
        """Get the podcast persona schema (audio/video-aware, mirrors PodcastBible)."""
        return {
            "type": "object",
            "description": "Podcast-optimized brand persona (audio/video-aware)",
            "properties": {
                "persona_name": {"type": "string", "description": "Name of the podcast persona"},
                "archetype": {"type": "string", "description": "Persona archetype"},
                "core_belief": {"type": "string", "description": "Core belief driving the show"},
                "host": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Host name"},
                        "background": {"type": "string", "description": "Professional background and expertise"},
                        "expertise_level": {"type": "string", "description": "Expert | Practitioner | Enthusiast"},
                        "vocal_style": {"type": "string", "description": "Vocal style and delivery"},
                        "personality_traits": {"type": "array", "items": {"type": "string"}},
                        "catchphrases": {"type": "array", "items": {"type": "string"}},
                        "look": {"type": "string", "description": "Visual description (for avatar generation); no sensitive traits"},
                    },
                },
                "visual_style": {
                    "type": "object",
                    "properties": {
                        "style_preset": {"type": "string"},
                        "environment": {"type": "string"},
                        "lighting": {"type": "string"},
                        "color_palette": {"type": "array", "items": {"type": "string"}},
                        "camera_style": {"type": "string"},
                    },
                },
                "audio_environment": {
                    "type": "object",
                    "properties": {
                        "soundscape": {"type": "string"},
                        "music_mood": {"type": "string"},
                        "sfx_style": {"type": "string"},
                    },
                },
                "show_rules": {
                    "type": "object",
                    "properties": {
                        "intro_format": {"type": "string"},
                        "outro_format": {"type": "string"},
                        "interaction_tone": {"type": "string"},
                        "constraints": {"type": "array", "items": {"type": "string"}},
                    },
                },
                "audience": {
                    "type": "object",
                    "properties": {
                        "expertise_level": {"type": "string"},
                        "interests": {"type": "array", "items": {"type": "string"}},
                        "pain_points": {"type": "array", "items": {"type": "string"}},
                    },
                },
                "brand": {
                    "type": "object",
                    "properties": {
                        "tone": {"type": "string"},
                        "communication_style": {"type": "string"},
                        "key_messages": {"type": "array", "items": {"type": "string"}},
                    },
                },
                "prompt_defaults": {
                    "type": "object",
                    "description": "Ready-to-inject fragments for image/video generation models",
                    "properties": {
                        "host_image_prompt": {"type": "string"},
                        "studio_prompt": {"type": "string"},
                        "negative_prompt": {"type": "string"},
                    },
                },
                "confidence_score": {"type": "number", "minimum": 0, "maximum": 100},
            },
            "required": [
                "persona_name",
                "archetype",
                "host",
                "visual_style",
                "audio_environment",
                "show_rules",
                "prompt_defaults",
            ],
        }
