"""
LinkedIn selection video prompt builder.

Uses exported visual_data_extractor + WaveSpeed video-mode prompt optimizer.
No podcast code dependencies.
"""

import asyncio
from typing import Any, Dict, Optional

from loguru import logger

from services.image_generation import (
    extract_visual_data,
    build_visual_summary,
    get_model_recommendation,
)

LINKEDIN_VIDEO_CONSTRAINTS = [
    "Professional business video for LinkedIn feed",
    "Cinematic quality, mobile-optimized framing",
    "Natural camera movement",
    "No text overlays, logos, or watermarks",
]

MOTION_HINTS = {
    "subtle": "Gentle camera movement, executive professional tone",
    "medium": "Balanced cinematic motion for social feed",
    "dynamic": "Energetic camera movement, attention-grabbing",
}


def _seed_snippet(user_prompt: str, content_context: Dict[str, Any]) -> str:
    raw = (user_prompt or content_context.get("content") or "").strip()
    return raw.replace("\n", " ")[:200]


def build_linkedin_selection_video_prompt(
    user_prompt: str,
    content_context: Dict[str, Any],
    aspect_ratio: str,
    motion_preset: str = "medium",
) -> str:
    """Build a comma-joined LinkedIn video prompt from user seed + visual extraction."""
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
            "[LinkedInVideoGen] Model recommendation hint: {}",
            model_hint[:120].replace("\n", " "),
        )

    motion_key = (motion_preset or "medium").lower()
    prompt_parts: list[str] = []

    seed = _seed_snippet(user_prompt, content_context)
    if seed:
        prompt_parts.append(seed)

    prompt_parts.append(f"Topic: {topic}")
    prompt_parts.append(f"Industry: {industry}")

    if visual_summary:
        prompt_parts.append(visual_summary.replace("\n", ", "))

    prompt_parts.append(MOTION_HINTS.get(motion_key, MOTION_HINTS["medium"]))
    prompt_parts.extend(LINKEDIN_VIDEO_CONSTRAINTS)
    prompt_parts.append(f"Aspect ratio: {aspect_ratio}")

    return ", ".join(part for part in prompt_parts if part)


async def optimize_linkedin_video_prompt(
    structured: str,
    user_id: Optional[str] = None,
) -> str:
    """Run WaveSpeed prompt optimization in video mode; fall back on failure."""
    try:
        from services.wavespeed.client import WaveSpeedClient

        client = WaveSpeedClient()
        optimized = await asyncio.to_thread(
            client.optimize_prompt,
            structured,
            "video",
            "realistic",
            None,
            True,
            30,
        )
        return optimized or structured
    except Exception as exc:
        logger.warning("[LinkedInVideoGen] Prompt optimization failed: {}", exc)
        return structured
