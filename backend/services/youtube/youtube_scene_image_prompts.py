"""Prompt builders for YouTube Creator scene image generation."""

from __future__ import annotations

from typing import Any, Dict, Optional

from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.scene_image_prompts")


def build_youtube_scene_image_prompt(
    *,
    scene_title: Optional[str] = None,
    scene_content: Optional[str] = None,
    idea: Optional[str] = None,
    custom_prompt: Optional[str] = None,
    has_base_avatar: bool = False,
) -> Dict[str, Any]:
    """Build the image prompt payload used for YouTube scene image generation.

    Returns the template prompt plus the exact prompt that would be sent to the
    image provider (custom prompt overrides the template when no avatar is used).
    """
    if has_base_avatar:
        prompt_parts = []
        if scene_title:
            prompt_parts.append(f"Scene: {scene_title}")
        if scene_content:
            content_preview = scene_content[:200].replace("\n", " ").strip()
            prompt_parts.append(f"Context: {content_preview}")
        if idea:
            prompt_parts.append(f"Video idea: {idea[:80].strip()}")
        prompt_parts.append("YouTube creator on camera, engaging and dynamic framing")
        prompt_parts.append("Clean background, good lighting, thumbnail-friendly composition")
        template_prompt = ", ".join(prompt_parts)
        image_prompt = template_prompt
        generation_type = "character"
        custom_prompt_used = False
    else:
        prompt_parts = [
            "YouTube creator scene",
            "clean, modern background",
            "good lighting, high contrast for thumbnail clarity",
        ]
        if scene_title:
            prompt_parts.append(f"Scene theme: {scene_title}")
        if scene_content:
            prompt_parts.append(f"Context: {scene_content[:120].replace(chr(10), ' ')}")
        if idea:
            prompt_parts.append(f"Topic: {idea[:80]}")
        prompt_parts.append("video-optimized composition, 16:9 aspect ratio")
        template_prompt = ", ".join(prompt_parts)
        custom_prompt_used = bool((custom_prompt or "").strip())
        image_prompt = (custom_prompt or "").strip() or template_prompt
        generation_type = "scene"

    logger.debug(
        "[YouTubeSceneImage] Built image prompt scene_title=%s has_avatar=%s "
        "custom_prompt_used=%s prompt_len=%s",
        (scene_title or "")[:40],
        has_base_avatar,
        custom_prompt_used,
        len(image_prompt),
    )
    return {
        "image_prompt": image_prompt,
        "template_prompt": template_prompt,
        "generation_type": generation_type,
        "custom_prompt_used": custom_prompt_used,
    }
