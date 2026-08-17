"""Shared curated persona-block resolver for blog content generation.

Single source of truth for injecting the brand-voice block into content
generators' SYSTEM prompts (the style layer), so every content generator uses
identical logic and the brand voice stays consistent across the blog writer.

Style vs topic separation: the persona constrains HOW the brand writes (tone,
phrases, sentence style) and is injected only into the system prompt. The topic,
sections, keywords, and research stay in the user prompt and remain user-driven.
"""

from loguru import logger


def resolve_curated_persona(user_id: str, platform: str = "blog") -> str:
    """Return the curated brand-voice block for a content generator, or "".

    Resolves the onboarding persona (PersonaData) via the persona resolver.
    Returns "" when there is no curated persona (or any lookup fails) so callers
    can safely append the result to a system prompt with no behavior change for
    no-persona users. Never raises.
    """
    if not user_id:
        return ""
    try:
        from services.persona.persona_resolver import resolve_persona_context

        curated = resolve_persona_context(user_id, platform)
        return curated or ""
    except Exception as e:
        logger.warning(f"Curated persona resolve failed (falling back to empty): {e}")
        return ""
