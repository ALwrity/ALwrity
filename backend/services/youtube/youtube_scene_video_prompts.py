"""Prompt helpers for YouTube Creator scene video generation (WAN 2.5)."""

from __future__ import annotations

from typing import Any, Dict, Tuple

from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.scene_video_prompts")

WAN25_ENABLE_PROMPT_EXPANSION = True
WAN25_GATEWAY = "wavespeed_wan25"


def resolve_youtube_scene_video_prompt(scene: Dict[str, Any]) -> Tuple[str, str]:
    """Return the visual prompt WAN 2.5 receives and which scene field it came from."""
    enhanced = (scene.get("enhanced_visual_prompt") or "").strip()
    visual = (scene.get("visual_prompt") or "").strip()
    if enhanced:
        logger.debug(
            "[YouTubeSceneVideo] Using enhanced_visual_prompt len=%s",
            len(enhanced),
        )
        return enhanced, "enhanced_visual_prompt"
    logger.debug(
        "[YouTubeSceneVideo] Using visual_prompt len=%s",
        len(visual),
    )
    return visual, "visual_prompt"


def resolve_youtube_scene_video_duration(duration_estimate: Any) -> int:
    """Map scene duration estimate to WAN 2.5 clip length (5s or 10s)."""
    try:
        estimate = float(duration_estimate if duration_estimate is not None else 5)
    except (TypeError, ValueError):
        logger.warning(
            "[YouTubeSceneVideo] Invalid duration_estimate=%s; defaulting to 5s clip",
            duration_estimate,
        )
        estimate = 5.0
    return 5 if estimate <= 7 else 10


def safe_youtube_media_ref(url: Any) -> str:
    """Return a display-safe media path without query tokens or file bytes."""
    if not url:
        return ""
    try:
        return str(url).split("?", 1)[0].strip()
    except Exception as exc:
        logger.warning("[YouTubeSceneVideo] Failed to sanitize media ref: %s", exc)
        return ""


def build_youtube_scene_video_generation_metadata(
    *,
    visual_prompt: str,
    prompt_source: str,
    generation_mode: str,
    duration: int,
    resolution: str,
    enable_prompt_expansion: bool,
    provider: str,
    model: str,
    image_attached: bool,
    audio_attached: bool,
    image_url: str = "",
    audio_url: str = "",
    duration_estimate: Any = None,
) -> Dict[str, Any]:
    """Return additive metadata so the UI can show the full WAN request (not bytes)."""
    try:
        estimate_value = float(duration_estimate) if duration_estimate is not None else None
    except (TypeError, ValueError):
        estimate_value = None
    metadata = {
        "gateway": WAN25_GATEWAY,
        "provider": provider or "wavespeed",
        "model": model or "wan-2.5",
        "visual_prompt": visual_prompt or "",
        "prompt_source": prompt_source or "visual_prompt",
        "generation_mode": generation_mode or "t2v",
        "duration": duration,
        "duration_estimate": estimate_value,
        "resolution": resolution,
        "enable_prompt_expansion": bool(enable_prompt_expansion),
        "has_system_prompt": False,
        "image_attached": bool(image_attached),
        "audio_attached": bool(audio_attached),
        "image_url": safe_youtube_media_ref(image_url),
        "audio_url": safe_youtube_media_ref(audio_url),
        "audio_note": (
            f"WAN 2.5 clip length is {duration}s. If attached audio is longer, "
            "the API keeps only the first 5s or 10s."
        ),
        "negative_prompt_sent": False,
        "seed_sent": False,
    }
    logger.info(
        "[YouTubeSceneVideo] Generation metadata built mode=%s source=%s "
        "prompt_len=%s duration=%s expansion=%s image_attached=%s audio_attached=%s",
        metadata["generation_mode"],
        metadata["prompt_source"],
        len(metadata["visual_prompt"]),
        duration,
        metadata["enable_prompt_expansion"],
        metadata["image_attached"],
        metadata["audio_attached"],
    )
    return metadata
