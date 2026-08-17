"""
Platform Registry — single source of truth for persona platforms.

Defines the canonical list of platforms ALwrity generates personas for,
plus their generation constraints. Everything else (persona generation, the
persona-options / persona-platforms endpoints, and the frontend tab list)
should derive from here rather than hardcoding platform lists.

Flags:
- ``enabled``: whether the platform is active in onboarding.
- ``scheduled``: whether its persona is generated in the background after
  onboarding completes (vs inline during the persona step).
"""

from typing import Any, Dict, List


def _platform(id: str, name: str, description: str, enabled: bool, scheduled: bool) -> Dict[str, Any]:
    return {
        "id": id,
        "name": name,
        "description": description,
        "enabled": enabled,
        "scheduled": scheduled,
    }


PERSONA_PLATFORMS: List[Dict[str, Any]] = [
    # id, name, description, enabled, scheduled
    _platform("linkedin", "LinkedIn", "Professional networking and thought leadership", True, False),
    _platform("blog", "Blog", "Long-form content and SEO optimization", True, False),
    _platform("facebook", "Facebook", "Social media and community building", True, True),
    _platform("twitter", "Twitter", "Micro-blogging and real-time updates", True, True),
    _platform("instagram", "Instagram", "Visual storytelling and engagement", True, True),
    _platform("youtube", "YouTube", "Video scripts, titles and descriptions", True, True),
    _platform("podcast", "Podcast", "Audio/video show format, tone and structure", True, True),
    _platform("medium", "Medium", "Publishing platform and audience building", False, False),
    _platform("substack", "Substack", "Newsletter and subscription content", False, False),
]


# Static constraints for platforms without a dedicated service. LinkedIn and
# Facebook are delegated to their services (see ``get_platform_constraints``),
# which already own richer constraint maps.
PLATFORM_CONSTRAINTS: Dict[str, Dict[str, Any]] = {
    "twitter": {
        "character_limit": 280,
        "optimal_length": "120-150 characters",
        "hashtag_limit": 3,
        "image_support": True,
        "thread_support": True,
        "link_shortening": True,
    },
    "instagram": {
        "caption_limit": 2200,
        "optimal_length": "125-150 words",
        "hashtag_limit": 30,
        "visual_first": True,
        "story_support": True,
        "emoji_friendly": True,
    },
    "blog": {
        "word_count": "800-2000 words",
        "seo_important": True,
        "header_structure": True,
        "internal_linking": True,
        "meta_descriptions": True,
        "readability_score": True,
    },
    "youtube": {
        "hook_optimization": True,
        "script_structure": "Hook-Intro-Body-CTA",
        "video_description_limit": 5000,
        "title_optimization": True,
        "engagement_prompts": True,
        "visual_cues": True,
    },
    "podcast": {
        "episode_structure": ["hook", "intro", "main segments", "outro", "CTA"],
        "optimal_duration": "20-40 minutes",
        "host_tone": "conversational, authoritative",
        "pacing": "varied with emphasis pauses",
        "audio_optimization": True,
        "video_optimization": True,
        "thumbnail_rules": True,
        "title_description_rules": True,
        "call_to_action": True,
    },
    "medium": {
        "word_count": "1000-3000 words",
        "storytelling_focus": True,
        "subtitle_support": True,
        "publication_support": True,
        "clap_optimization": True,
        "follower_building": True,
    },
    "substack": {
        "newsletter_format": True,
        "email_optimization": True,
        "subscription_focus": True,
        "long_form": True,
        "personal_connection": True,
        "monetization_support": True,
    },
}


def get_platform_constraints(platform: str) -> Dict[str, Any]:
    """Return the generation constraints for a platform.

    LinkedIn and Facebook have dedicated services that already own richer
    constraint maps, so delegate to them. Everything else uses the static
    ``PLATFORM_CONSTRAINTS`` table above.
    """
    if platform == "linkedin":
        from .linkedin.linkedin_persona_service import LinkedInPersonaService
        return LinkedInPersonaService().get_linkedin_constraints()
    if platform == "facebook":
        from .facebook.facebook_persona_service import FacebookPersonaService
        return FacebookPersonaService().get_facebook_constraints()
    return PLATFORM_CONSTRAINTS.get(platform, {})


def get_enabled_platforms() -> List[Dict[str, Any]]:
    """Return the active platforms (``enabled`` is true)."""
    return [p for p in PERSONA_PLATFORMS if p["enabled"]]


def get_scheduled_platforms() -> List[Dict[str, Any]]:
    """Return the enabled platforms generated in the background after onboarding."""
    return [p for p in PERSONA_PLATFORMS if p["enabled"] and p["scheduled"]]


def get_platforms_payload() -> List[Dict[str, Any]]:
    """Return the full list as a serializable API payload."""
    return [
        {
            "id": p["id"],
            "name": p["name"],
            "description": p["description"],
            "enabled": p["enabled"],
            "scheduled": p["scheduled"],
        }
        for p in PERSONA_PLATFORMS
    ]
