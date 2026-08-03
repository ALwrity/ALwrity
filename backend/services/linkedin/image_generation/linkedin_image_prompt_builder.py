"""
LinkedIn selection image prompt builder.

Uses exported shared image services (visual_data_extractor + enhance_image_prompt)
with LinkedIn-only template constants. No podcast code dependencies.
"""

from typing import Any, Dict, Optional

from loguru import logger

from services.image_generation import (
    extract_visual_data,
    build_visual_summary,
    get_model_recommendation,
)
from services.llm_providers.main_image_generation import enhance_image_prompt

# Photo-safe constraints for FLUX / Ideogram / Qwen (unchanged behavior)
LINKEDIN_FEED_CONSTRAINTS = [
    "Professional business photography for LinkedIn feed",
    "Clear focal point, mobile-optimized composition",
    "Neutral professional color palette",
    "No text, no logos, no watermarks",
    "Realistic photography style, sharp focus",
]

# Gemini is strong at readable on-image text and conceptual covers
GEMINI_COVER_CONSTRAINTS = [
    "Professional LinkedIn post cover image for the feed",
    "Concept-driven visual that communicates the post message at a glance",
    "Clear visual hierarchy and mobile-optimized composition",
    "Prefer problem-vs-solution or before-vs-after layout when the post implies contrast",
    "Readable on-image headline and short supporting labels are allowed when they reinforce the post",
    "High contrast, sharp detail, LinkedIn-ready professional design",
    "No watermarks",
]

STYLE_HINTS = {
    "Realistic": "Photorealistic, professional photography",
    "Auto": "Clean professional visual",
    "Fiction": "Creative stylized illustration, still professional",
    "professional": "Photorealistic, professional photography",
    "creative": "Creative stylized illustration, still professional",
}

GEMINI_STYLE_HINTS = {
    "Realistic": (
        "Photorealistic LinkedIn cover with strong narrative composition; "
        "optional short on-image headline tied to the post"
    ),
    "Auto": (
        "Concept-driven LinkedIn cover or professional infographic "
        "(not generic stock photography)"
    ),
    "Fiction": (
        "Creative stylized LinkedIn cover illustration with clear message hierarchy"
    ),
    "professional": (
        "Photorealistic LinkedIn cover with strong narrative composition; "
        "optional short on-image headline tied to the post"
    ),
    "creative": (
        "Creative stylized LinkedIn cover illustration with clear message hierarchy"
    ),
}

_PHOTO_MODELS_SEED_MAX = 200
_GEMINI_POST_BODY_MAX = 1500
_GEMINI_MODEL_ID = "gemini-3-pro-image"


def _seed_snippet(user_prompt: str, content_context: Dict[str, Any], max_chars: int = 200) -> str:
    raw = (user_prompt or content_context.get("content") or "").strip()
    return raw.replace("\n", " ")[:max_chars]


def _post_body_for_cover(user_prompt: str, content_context: Dict[str, Any]) -> str:
    """Prefer full post body from content_context; fall back to user prompt."""
    content = (content_context.get("content") or "").strip()
    prompt = (user_prompt or "").strip()
    # If the user edited the modal prompt to include a full cover brief, prefer it
    if len(prompt) >= len(content) and len(prompt) > 80:
        body = prompt
    else:
        body = content or prompt
    return body[:_GEMINI_POST_BODY_MAX]


def _build_gemini_cover_prompt(
    user_prompt: str,
    content_context: Dict[str, Any],
    aspect_ratio: str,
    style: str,
) -> str:
    """Build a WaveSpeed-style LinkedIn cover brief for Gemini 3 Pro Image."""
    topic = content_context.get("topic", "LinkedIn post")
    industry = content_context.get("industry", "Business")
    post_body = _post_body_for_cover(user_prompt, content_context)
    style_hint = GEMINI_STYLE_HINTS.get(style, GEMINI_STYLE_HINTS["Auto"])

    parts = [
        "Create LinkedIn post cover image for below LinkedIn post -",
        post_body,
        f"Topic: {topic}",
        f"Industry: {industry}",
        style_hint,
        *GEMINI_COVER_CONSTRAINTS,
        f"Aspect ratio: {aspect_ratio}",
    ]
    prompt = "\n\n".join(part for part in parts if part)
    logger.info(
        "[LinkedInImageGen] Built Gemini cover prompt chars={} style={} industry={}",
        len(prompt),
        style,
        industry,
    )
    return prompt


def build_linkedin_selection_prompt(
    user_prompt: str,
    content_context: Dict[str, Any],
    aspect_ratio: str,
    style: str = "Realistic",
    model: Optional[str] = None,
) -> str:
    """
    Build a LinkedIn image prompt from user seed + visual extraction.

    For gemini-3-pro-image, builds a cover/infographic-oriented brief (allows on-image text).
    For other models, keeps the existing photography / no-text constraints.

    Args:
        user_prompt: Seed from frontend or user-edited prompt
        content_context: LinkedIn content context (topic, industry, content, style)
        aspect_ratio: Target aspect ratio string
        style: Modal style selection (Realistic, Auto, Fiction)
        model: Optional image model id (e.g. gemini-3-pro-image)

    Returns:
        Structured prompt ready for generation (and optional WaveSpeed optimization)
    """
    if (model or "").lower() == _GEMINI_MODEL_ID:
        return _build_gemini_cover_prompt(user_prompt, content_context, aspect_ratio, style)

    topic = content_context.get("topic", "LinkedIn post")
    industry = content_context.get("industry", "Business")
    content = content_context.get("content") or user_prompt

    section = {
        "heading": topic,
        "key_points": [content] if content else [],
        "keywords": [industry] if industry else [],
    }
    research = {"domain": industry, "industry": industry}

    visual_data = extract_visual_data(section, research)
    visual_summary = build_visual_summary(visual_data)
    model_hint = get_model_recommendation(visual_data)
    if model_hint:
        logger.info(
            "[LinkedInImageGen] Model recommendation hint: {}",
            model_hint[:120].replace("\n", " "),
        )

    prompt_parts: list[str] = []

    seed = _seed_snippet(user_prompt, content_context, max_chars=_PHOTO_MODELS_SEED_MAX)
    if seed:
        prompt_parts.append(seed)

    prompt_parts.append(f"Topic: {topic}")
    prompt_parts.append(f"Industry: {industry}")

    if visual_summary:
        prompt_parts.append(visual_summary.replace("\n", ", "))

    style_hint = STYLE_HINTS.get(style, STYLE_HINTS["Realistic"])
    prompt_parts.append(style_hint)
    prompt_parts.extend(LINKEDIN_FEED_CONSTRAINTS)
    prompt_parts.append(f"Aspect ratio: {aspect_ratio}")

    return ", ".join(part for part in prompt_parts if part)


async def optimize_linkedin_prompt(
    structured: str,
    user_id: Optional[str] = None,
    model: Optional[str] = None,
) -> str:
    """
    Run WaveSpeed prompt optimization; fall back to structured prompt on failure.

    Skips the photographic optimizer for gemini-3-pro-image so cover/infographic
    briefs are not rewritten into generic stock-photo prompts.
    """
    if (model or "").lower() == _GEMINI_MODEL_ID:
        logger.info(
            "[LinkedInImageGen] Skipping photographic prompt optimizer for model={}",
            model,
        )
        return structured

    try:
        optimized = await enhance_image_prompt(structured, user_id=user_id)
        return optimized or structured
    except Exception as exc:
        logger.warning("[LinkedInImageGen] Prompt optimization failed: {}", exc)
        return structured
