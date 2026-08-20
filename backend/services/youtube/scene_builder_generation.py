"""LLM scene generation for YouTube scene builder."""

from typing import Dict, Any, List, Tuple
import json

from fastapi import HTTPException

from services.llm_providers.main_text_generation import llm_text_gen
from services.youtube.scene_builder_prompts import build_scene_generation_prompts
from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.scene_builder_generation")


def _parse_scenes_response(response: Any) -> List[Any]:
    """Normalize llm_text_gen output into a list of scene payloads."""
    if isinstance(response, list):
        return response
    if isinstance(response, dict) and isinstance(response.get("scenes"), list):
        return response["scenes"]
    if isinstance(response, str):
        parsed = json.loads(response)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict) and isinstance(parsed.get("scenes"), list):
            return parsed["scenes"]
        raise ValueError("LLM string response did not contain a scenes array")
    raise ValueError(f"Unexpected LLM response type: {type(response).__name__}")


def generate_scenes_from_plan(
    video_plan: Dict[str, Any],
    duration_metadata: Dict[str, Any],
    user_id: str,
) -> List[Dict[str, Any]]:
    """Generate scenes from video plan using AI."""
    duration_type = video_plan.get("duration_type", "medium")
    content_outline = video_plan.get("content_outline", [])

    if not content_outline:
        logger.error(
            "[YouTubeSceneBuilder] Refusing scene generation with empty outline "
            "duration=%s user=%s",
            duration_type,
            user_id,
        )
        raise HTTPException(
            status_code=400,
            detail="Video plan has no content outline. Regenerate the plan before building scenes.",
        )

    scene_duration_range = duration_metadata.get("scene_duration_range", (5, 15))
    system_prompt, scene_generation_prompt = build_scene_generation_prompts(
        video_plan, duration_metadata
    )
    logger.info(
        "[YouTubeSceneBuilder] Generating scenes via llm_text_gen "
        "duration=%s outline_sections=%s user=%s system_prompt_len=%s user_prompt_len=%s",
        duration_type,
        len(content_outline),
        user_id,
        len(system_prompt),
        len(scene_generation_prompt),
    )

    try:
        response = llm_text_gen(
            prompt=scene_generation_prompt,
            system_prompt=system_prompt,
            user_id=user_id,
            json_struct={
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "scene_number": {"type": "number"},
                        "title": {"type": "string"},
                        "narration": {"type": "string"},
                        "visual_description": {"type": "string"},
                        "duration_estimate": {"type": "number"},
                        "emphasis": {"type": "string"},
                        "visual_cues": {
                            "type": "array",
                            "items": {"type": "string"}
                        }
                    },
                    "required": [
                        "scene_number", "title", "narration", "visual_description",
                        "duration_estimate", "emphasis"
                    ]
                }
            }
        )
    except Exception as exc:
        logger.error(
            "[YouTubeSceneBuilder] llm_text_gen failed during scene generation "
            "duration=%s outline_sections=%s user=%s error=%s",
            duration_type,
            len(content_outline),
            user_id,
            str(exc),
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate scenes: {str(exc)}",
        ) from exc

    try:
        scenes = _parse_scenes_response(response)
    except Exception as exc:
        logger.error(
            "[YouTubeSceneBuilder] Failed to parse scene LLM response "
            "duration=%s user=%s response_type=%s error=%s",
            duration_type,
            user_id,
            type(response).__name__,
            str(exc),
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail="Scene generation returned an invalid response. Please try again.",
        ) from exc

    if not scenes:
        logger.error(
            "[YouTubeSceneBuilder] LLM returned zero scenes duration=%s user=%s",
            duration_type,
            user_id,
        )
        raise HTTPException(
            status_code=500,
            detail="Scene generation returned no scenes. Please try again.",
        )

    normalized_scenes = _normalize_scenes(scenes, scene_duration_range)

    logger.info(
        "[YouTubeSceneBuilder] Scene LLM generation complete "
        "duration=%s scene_count=%s user=%s",
        duration_type,
        len(normalized_scenes),
        user_id,
    )
    return normalized_scenes


def _normalize_scenes(
    scenes: List[Any],
    scene_duration_range: Tuple[int, int],
) -> List[Dict[str, Any]]:
    """Normalize raw LLM scene payloads into scene dicts."""
    normalized_scenes = []
    for idx, scene in enumerate(scenes, 1):
        if isinstance(scene, dict):
            scene_data = scene
        else:
            scene_data = {
                "scene_number": idx,
                "title": f"Scene {idx}",
                "narration": str(scene),
                "visual_description": "",
                "duration_estimate": scene_duration_range[0],
                "emphasis": "main_content",
                "visual_cues": [],
            }
        normalized_scenes.append(
            {
                "scene_number": scene_data.get("scene_number", idx),
                "title": scene_data.get("title", f"Scene {idx}"),
                "narration": scene_data.get("narration", ""),
                "visual_description": scene_data.get("visual_description", ""),
                "duration_estimate": scene_data.get(
                    "duration_estimate", scene_duration_range[0]
                ),
                "emphasis": scene_data.get("emphasis", "main_content"),
                "visual_cues": scene_data.get("visual_cues", []),
                "visual_prompt": scene_data.get("visual_description", ""),
            }
        )
    return normalized_scenes
