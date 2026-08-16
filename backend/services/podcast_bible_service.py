from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import time
from loguru import logger
from services.product_marketing.personalization_service import PersonalizationService
from models.podcast_bible_models import (
    PodcastBible, 
    HostPersona, 
    AudienceDNA, 
    BrandDNA, 
    VisualStyle, 
    AudioEnvironment, 
    ShowRules
)

_BIBLE_CACHE_TTL_SECONDS = 120


class PodcastBibleService:
    """Service for generating and managing the Podcast Bible."""

    _bible_cache: Dict[str, Dict[str, Any]] = {}

    def __init__(self):
        try:
            from services.product_marketing.personalization_service import PersonalizationService
            self.personalization_service = PersonalizationService()
        except Exception as e:
            logger.warning(f"Failed to initialize PersonalizationService: {e}")
            self.personalization_service = None

    @classmethod
    def clear_user_cache(cls, user_id: str) -> int:
        """Clear cached Bible data for a specific user. Returns number of entries cleared."""
        keys_to_remove = [key for key in cls._bible_cache if key.startswith(f"{user_id}:")]
        for key in keys_to_remove:
            del cls._bible_cache[key]
        if keys_to_remove:
            logger.info(f"[BibleCache] Cleared {len(keys_to_remove)} cache entries for user {user_id}")
        return len(keys_to_remove)

    def generate_bible(self, user_id: str, project_id: str) -> PodcastBible:
        """Generate a Podcast Bible from onboarding data."""
        bible_start = time.time()
        
        cache_key = f"{user_id}:{project_id}"
        cached = self._bible_cache.get(cache_key)
        if cached and cached.get('expires_at') and cached['expires_at'] > datetime.utcnow():
            elapsed_ms = (time.time() - bible_start) * 1000
            logger.warning(f"[BibleCache] HIT for {user_id} — saved 7 DB queries, overhead {elapsed_ms:.0f}ms")
            return cached['bible']
        
        logger.info(f"Generating Podcast Bible for user {user_id}")
        
        try:
            if not self.personalization_service:
                elapsed_ms = (time.time() - bible_start) * 1000
                logger.warning(f"[BibleCache] MISS (fallback) for {user_id} — PersonalizationService unavailable, {elapsed_ms:.0f}ms")
                return self._get_default_bible(project_id)
            
            try:
                preferences = self.personalization_service.get_user_preferences(user_id)
            except Exception as pref_err:
                elapsed_ms = (time.time() - bible_start) * 1000
                logger.warning(f"[BibleCache] MISS (fallback) for {user_id} — get_user_preferences failed ({pref_err}), {elapsed_ms:.0f}ms")
                return self._get_default_bible(project_id)
            
            if not preferences:
                logger.info(f"No preferences found for user {user_id}, using defaults")
                return self._get_default_bible(project_id)
            if not isinstance(preferences, dict):
                logger.warning(f"Podcast Bible preferences payload is non-dict for user {user_id}, using defaults")
                preferences = {}

            writing_style = preferences.get("writing_style", {})
            if not isinstance(writing_style, dict):
                writing_style = {}

            style_prefs = preferences.get("style_preferences", {})
            if not isinstance(style_prefs, dict):
                style_prefs = {}

            target_audience = preferences.get("target_audience", {})
            if not isinstance(target_audience, dict):
                target_audience = {}

            industry = preferences.get("industry", "General Business")
            if not isinstance(industry, str) or not industry.strip():
                industry = "General Business"
            
            # 1. Map Host Persona
            host = HostPersona(
                name="Your AI Host",
                background=f"Expert in {industry}",
                expertise_level=str(writing_style.get("complexity") or "Expert").capitalize(),
                personality_traits=[
                    str(writing_style.get("tone") or "Professional").capitalize(),
                    str(writing_style.get("engagement_level") or "Informative").capitalize()
                ],
                vocal_style=str(writing_style.get("voice") or "Authoritative").capitalize(),
                vocal_characteristics=["Clear", "Articulate", str(writing_style.get("voice") or "Steady")],
                look=f"A professional individual dressed in business-casual attire, fitting the {industry} industry aesthetic.",
                catchphrases=[]
            )
            
            # 2. Map Audience DNA
            audience = AudienceDNA(
                expertise_level=str(target_audience.get("expertise_level") or "Intermediate").capitalize(),
                interests=target_audience.get("interests", ["Industry Trends", "Innovation"]),
                pain_points=target_audience.get("pain_points", ["Staying ahead of competition", "Efficiency"]),
                demographics=None
            )
            
            # 3. Map Brand DNA
            brand = BrandDNA(
                industry=industry,
                tone=str(writing_style.get("tone") or "Professional").capitalize(),
                communication_style=str(writing_style.get("engagement_level") or "Informative").capitalize(),
                key_messages=preferences.get("brand_values", []),
                competitor_context=None
            )

            # 4. Map Visual Style
            visual = VisualStyle(
                style_preset=str(style_prefs.get("aesthetic") or "Professional Studio").capitalize(),
                environment=f"A modern {industry}-themed podcast studio with professional equipment.",
                lighting="Soft, warm studio lighting with subtle rim lights.",
                color_palette=preferences.get("brand_colors", ["#1e293b", "#3b82f6"]),
                camera_style="Dynamic mid-shots with occasional close-ups for emphasis."
            )

            # 5. Map Audio Environment
            audio_env = AudioEnvironment(
                soundscape="Pristine studio environment with deep, warm acoustics.",
                music_mood=f"{str(writing_style.get('tone') or 'Professional').capitalize()} & {str(writing_style.get('engagement_level') or 'Upbeat').capitalize()}",
                sfx_style="Modern, clean interface-inspired sounds."
            )

            # 6. Map Show Rules
            show_rules = ShowRules(
                intro_format=f"Start with a high-energy hook about the episode topic, followed by a warm welcome and an overview of the {industry} insights to be shared.",
                outro_format="Summarize the key takeaways, provide a clear call to action, and sign off with a professional closing.",
                interaction_tone=str(writing_style.get("engagement_level") or "Conversational").capitalize(),
                constraints=[
                    "Avoid overly technical jargon unless defined",
                    "Keep segments concise and factual",
                    f"Maintain a {str(writing_style.get('tone') or 'Professional')} tone at all times"
                ]
            )
            
            bible = PodcastBible(
                project_id=project_id,
                host=host,
                audience=audience,
                brand=brand,
                visual_style=visual,
                audio_environment=audio_env,
                show_rules=show_rules
            )
            
            logger.info(f"Podcast Bible generated successfully for project {project_id}")
            elapsed_ms = (time.time() - bible_start) * 1000
            logger.warning(f"[BibleCache] MISS — generated in {elapsed_ms:.0f}ms (7 DB queries), cached for {_BIBLE_CACHE_TTL_SECONDS}s")
            self._bible_cache[cache_key] = {
                'bible': bible,
                'expires_at': datetime.utcnow() + timedelta(seconds=_BIBLE_CACHE_TTL_SECONDS),
            }
            return bible
            
        except Exception as e:
            logger.error(f"Error generating Podcast Bible: {str(e)}", exc_info=True)
            # Return a default bible if something goes wrong to ensure project creation doesn't fail
            return self._get_default_bible(project_id)

    def get_or_build_bible(
        self,
        user_id: str,
        request_bible: Optional[Dict[str, Any]] = None,
        project_id: str = "temp",
    ) -> tuple[PodcastBible, str]:
        """Resolve a Podcast Bible and its serialized prompt context.

        Priority:
        1. Explicit ``request_bible`` (user/project-provided) — parsed and
           serialized as-is.
        2. Podcast platform persona (richer, brand-grounded) — mapped to a
           ``PodcastBible`` via ``PodcastPersonaService.to_podcast_bible``.
        3. Existing preferences-based ``generate_bible`` fallback.

        Returns a ``(bible, bible_context)`` tuple. The fallback paths use a
        user-scoped ``project_id`` so ``serialize_bible``'s process-global
        cache (keyed by ``project_id``) never leaks one user's persona into
        another user's session.

        This is the podcast side of the two-tier personalization model:
        - A user-configured ``request_bible`` (per project) is the episode-level
          OVERRIDE and always wins.
        - The podcast persona is the stable base FORM (host, visual/audio
          environment, show rules, brand) and only SEEDS the bible when the user
          hasn't provided one — it never replaces an explicit bible.
        - ``generate_bible`` (onboarding preferences) is the last-resort fallback
          for users with no persona and no manual bible.
        """
        if request_bible:
            try:
                bible = PodcastBible(**request_bible)
                return bible, self.serialize_bible(bible)
            except Exception as exc:
                logger.warning(f"Could not parse provided Podcast Bible: {exc}")

        scoped_project_id = f"{project_id}:{user_id}"

        # Seed the bible from the podcast persona (brand-grounded FORM). This is the
        # mechanism that keeps every episode on-brand without asking the user to
        # restate their show's voice/visuals each time.
        try:
            from services.persona_data_service import PersonaDataService
            from services.persona.podcast.podcast_persona_service import PodcastPersonaService

            platform = PersonaDataService().get_platform_persona(user_id, "podcast")
            if platform and platform.get("platform_persona"):
                bible = PodcastPersonaService.to_podcast_bible(
                    platform["platform_persona"],
                    project_id=scoped_project_id,
                    core_persona=platform.get("core_persona"),
                )
                if bible:
                    return bible, self.serialize_bible(bible)
        except Exception as exc:
            logger.warning(f"Could not build Podcast Bible from podcast persona: {exc}")

        bible = self.generate_bible(user_id, scoped_project_id)
        return bible, self.serialize_bible(bible)

    def _get_default_bible(self, project_id: str) -> PodcastBible:
        """Return a sensible default Bible."""
        return PodcastBible(
            project_id=project_id,
            host=HostPersona(
                name="AI Host",
                background="Industry Professional",
                expertise_level="Expert",
                personality_traits=["Professional", "Informative"],
                vocal_style="Authoritative",
                vocal_characteristics=["Deep", "Steady"],
                look="A professional individual dressed in business-casual attire."
            ),
            audience=AudienceDNA(
                expertise_level="Intermediate",
                interests=["Industry Trends", "Technology"],
                pain_points=["Staying Competitive", "Operational Efficiency"],
                demographics=None
            ),
            brand=BrandDNA(
                industry="General Business",
                tone="Professional",
                communication_style="Analytical",
                key_messages=[],
                competitor_context=None
            ),
            visual_style=VisualStyle(
                environment="Professional modern office studio",
                color_palette=["#000000", "#FFFFFF"]
            ),
            audio_environment=AudioEnvironment(),
            show_rules=ShowRules(
                intro_format="Standard welcome and topic introduction.",
                outro_format="Summary and sign-off."
            )
        )

    def serialize_bible(self, bible: PodcastBible) -> str:
        """Serialize the Bible into a prompt-friendly text block. Results are cached by project_id."""
        cache_key = f"serialized:{bible.project_id}"
        cached = self._bible_cache.get(cache_key)
        if cached and cached.get('expires_at') and cached['expires_at'] > datetime.utcnow() and isinstance(cached.get('serialized'), str):
            return cached['serialized']
        serialized = f"""
<podcast_bible>
HOST PERSONA:
- Name: {bible.host.name}
- Background: {bible.host.background}
- Expertise Level: {bible.host.expertise_level}
- Personality: {', '.join(bible.host.personality_traits)}
- Vocal Style: {bible.host.vocal_style}
- Vocal Characteristics: {', '.join(bible.host.vocal_characteristics)}
- Visual Look: {bible.host.look}

TARGET AUDIENCE:
- Expertise: {bible.audience.expertise_level}
- Interests: {', '.join(bible.audience.interests)}
- Pain Points: {', '.join(bible.audience.pain_points)}

BRAND & STYLE:
- Industry: {bible.brand.industry}
- Tone: {bible.brand.tone}
- Communication Style: {bible.brand.communication_style}
- Visual Style Preset: {bible.visual_style.style_preset}
- Environment: {bible.visual_style.environment}
- Lighting: {bible.visual_style.lighting}

AUDIO ENVIRONMENT:
- Soundscape: {bible.audio_environment.soundscape}
- Music Mood: {bible.audio_environment.music_mood}

SHOW RULES & STRUCTURE:
- Intro Format: {bible.show_rules.intro_format}
- Outro Format: {bible.show_rules.outro_format}
- Interaction Tone: {bible.show_rules.interaction_tone}
- Constraints: {', '.join(bible.show_rules.constraints)}
</podcast_bible>
"""
        self._bible_cache[cache_key] = {
            'serialized': serialized,
            'expires_at': datetime.utcnow() + timedelta(seconds=_BIBLE_CACHE_TTL_SECONDS),
        }
        return serialized
