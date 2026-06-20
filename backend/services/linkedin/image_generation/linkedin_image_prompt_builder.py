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

LINKEDIN_FEED_CONSTRAINTS = [
    "Professional business photography for LinkedIn feed",
    "Clear focal point, mobile-optimized composition",
    "Neutral professional color palette",
    "No text, no logos, no watermarks",
    "Realistic photography style, sharp focus",
]

STYLE_HINTS = {
    "Realistic": "Photorealistic, professional photography",
    "Auto": "Clean professional visual",
    "Fiction": "Creative stylized illustration, still professional",
    "professional": "Photorealistic, professional photography",
    "creative": "Creative stylized illustration, still professional",
}


def _seed_snippet(user_prompt: str, content_context: Dict[str, Any]) -> str:
    raw = (user_prompt or content_context.get("content") or "").strip()
    return raw.replace("\n", " ")[:200]


def build_linkedin_selection_prompt(
    user_prompt: str,
    content_context: Dict[str, Any],
    aspect_ratio: str,
    style: str = "Realistic",
) -> str:
    """
    Build a comma-joined LinkedIn image prompt from user seed + visual extraction.

    Args:
        user_prompt: Short seed from frontend or user-edited prompt
        content_context: LinkedIn content context (topic, industry, content, style)
        aspect_ratio: Target aspect ratio string
        style: Modal style selection (Realistic, Auto, Fiction)

    Returns:
        Structured comma-separated prompt ready for WaveSpeed optimization
    """
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

    seed = _seed_snippet(user_prompt, content_context)
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
) -> str:
    """Run WaveSpeed prompt optimization; fall back to structured prompt on failure."""
    try:
        optimized = await enhance_image_prompt(structured, user_id=user_id)
        return optimized or structured
    except Exception as exc:
        logger.warning("[LinkedInImageGen] Prompt optimization failed: {}", exc)
        return structured
