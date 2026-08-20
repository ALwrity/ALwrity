"""Attach scene-build transparency metadata (prompt + LLM call flags)."""

from __future__ import annotations

from typing import Any, Dict, Optional

from services.youtube.planner_generation import configured_text_provider
from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.scene_builder_generation_metadata")


def build_scene_generation_metadata(
    *,
    system_prompt: str,
    user_prompt: str,
    llm_called: bool,
    scenes_reused_from_plan: bool = False,
    custom_script_used: bool = False,
) -> Dict[str, Any]:
    """Return additive generation metadata for the scene-build API response."""
    provider = configured_text_provider()
    system_text = system_prompt or ""
    user_text = user_prompt or ""
    metadata = {
        "text_gateway": "llm_text_gen",
        "configured_provider": provider,
        "system_prompt": system_text,
        "user_prompt": user_text,
        "json_schema_applied": True,
        "llm_called": bool(llm_called),
        "scenes_reused_from_plan": bool(scenes_reused_from_plan),
        "custom_script_used": bool(custom_script_used),
    }
    logger.info(
        "[YouTubeSceneBuilder] Generation metadata built: provider=%s "
        "system_prompt_len=%s user_prompt_len=%s llm_called=%s "
        "scenes_reused_from_plan=%s custom_script_used=%s",
        provider,
        len(system_text),
        len(user_text),
        bool(llm_called),
        bool(scenes_reused_from_plan),
        bool(custom_script_used),
    )
    return metadata


def attach_scene_generation_metadata(
    result: Optional[Dict[str, Any]],
    *,
    system_prompt: str,
    user_prompt: str,
    llm_called: bool,
    scenes_reused_from_plan: bool = False,
    custom_script_used: bool = False,
) -> Dict[str, Any]:
    """Attach `generation` to a scene-build result dict. Never raises."""
    if not isinstance(result, dict):
        logger.error(
            "[YouTubeSceneBuilder] Cannot attach generation metadata: result type=%s",
            type(result).__name__,
        )
        return result if isinstance(result, dict) else {}

    try:
        result["generation"] = build_scene_generation_metadata(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            llm_called=llm_called,
            scenes_reused_from_plan=scenes_reused_from_plan,
            custom_script_used=custom_script_used,
        )
    except Exception as exc:
        logger.exception(
            "[YouTubeSceneBuilder] Failed to attach generation metadata; returning result without it: %s",
            exc,
        )
    return result
