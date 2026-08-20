"""
YouTube scene video render orchestration.

Resolves scene audio/image inputs, selects I2V vs T2V, persists output, and tracks usage.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

import requests
from fastapi import HTTPException
from sqlalchemy.orm import Session

from services.llm_providers.main_video_generation import track_video_usage
from services.wavespeed.client import WaveSpeedClient
from services.youtube.scene_audio import resolve_scene_audio_base64
from services.youtube.scene_image import resolve_scene_image_base64
from services.youtube.scene_video_generate import generate_youtube_scene_video
from services.youtube.video_storage import save_youtube_scene_video
from services.youtube.youtube_scene_video_prompts import (
    WAN25_ENABLE_PROMPT_EXPANSION,
    build_youtube_scene_video_generation_metadata,
    resolve_youtube_scene_video_duration,
    resolve_youtube_scene_video_prompt,
)
from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.scene_render")


def execute_scene_video_render(
    *,
    scene: Dict[str, Any],
    user_id: str,
    resolution: str,
    generate_audio_enabled: bool,
    voice_id: str,
    db: Optional[Session],
    wavespeed_client: WaveSpeedClient,
) -> Dict[str, Any]:
    """
    Render one YouTube scene to video.

    Raises HTTPException for validation, provider, or persistence failures.
    """
    scene_number = scene.get("scene_number", 1)
    generation_mode = "t2v"

    narration = scene.get("narration", "").strip()
    visual_prompt, prompt_source = resolve_youtube_scene_video_prompt(scene)
    duration_estimate = scene.get("duration_estimate", 5)

    logger.debug(
        f"[YouTubeSceneRender] execute_scene_video_render entry "
        f"(scene={scene_number}, user_id={user_id}, resolution={resolution}, "
        f"generate_audio_enabled={generate_audio_enabled}, db={'set' if db else 'none'})"
    )

    if not visual_prompt:
        raise HTTPException(
            status_code=400,
            detail={
                "error": f"Scene {scene_number} has no visual prompt",
                "scene_number": scene_number,
                "message": "Visual prompt is required for video generation",
                "user_action": "Please add a visual description for this scene before rendering.",
            },
        )

    if len(visual_prompt) < 10:
        logger.warning(
            f"[YouTubeSceneRender] Scene {scene_number} has very short visual prompt "
            f"({len(visual_prompt)} chars), may result in poor quality"
        )

    duration = resolve_youtube_scene_video_duration(duration_estimate)
    has_existing_image = bool(scene.get("imageUrl"))
    has_existing_audio = bool(scene.get("audioUrl"))

    logger.info(
        f"[YouTubeSceneRender] Rendering scene {scene_number}: "
        f"resolution={resolution}, duration={duration}s, prompt_length={len(visual_prompt)}, "
        f"has_existing_image={has_existing_image}, has_existing_audio={has_existing_audio}"
    )

    audio_base64 = resolve_scene_audio_base64(
        scene_number=scene_number,
        scene_audio_url=scene.get("audioUrl"),
        narration=narration,
        generate_audio_enabled=generate_audio_enabled,
        voice_id=voice_id,
        user_id=user_id,
        db=db,
    )

    if has_existing_audio and not audio_base64 and not generate_audio_enabled:
        logger.error(
            f"[YouTubeSceneRender] Scene {scene_number} audioUrl present but audio load failed "
            "and new audio generation is disabled. Skipping video generation to avoid mute credits."
        )
        raise HTTPException(
            status_code=400,
            detail={
                "error": f"Scene {scene_number} audio could not be loaded",
                "scene_number": scene_number,
                "message": (
                    "The pre-generated scene audio could not be found. "
                    "Video generation was stopped so credits are not spent on a silent scene."
                ),
                "user_action": (
                    "Re-generate scene audio, or enable audio generation, then retry render."
                ),
            },
        )

    if len(visual_prompt.strip()) < 5:
        raise HTTPException(
            status_code=400,
            detail={
                "error": f"Scene {scene_number} has invalid visual prompt",
                "scene_number": scene_number,
                "message": "Visual prompt must be at least 5 characters",
                "user_action": "Please provide a valid visual description for this scene.",
            },
        )

    scene_image_url = scene.get("imageUrl")
    image_base64: Optional[str] = None

    if has_existing_image and scene_image_url:
        safe_image_url = str(scene_image_url).split("?")[0]
        logger.debug(
            f"[YouTubeSceneRender] Scene {scene_number} resolving image for I2V: {safe_image_url}"
        )
        try:
            image_base64 = resolve_scene_image_base64(
                scene_image_url=scene_image_url,
                user_id=user_id,
                db=db,
            )
        except Exception as exc:
            logger.error(
                f"[YouTubeSceneRender] Scene {scene_number} unexpected image resolution error "
                f"for {safe_image_url}: {exc}",
                exc_info=True,
            )
            image_base64 = None

        if image_base64:
            generation_mode = "i2v"
        else:
            logger.warning(
                f"[YouTubeSceneRender] Scene {scene_number} has imageUrl but image load failed; "
                f"falling back to text-to-video. "
                f"image_url={safe_image_url}, audio_attached={bool(audio_base64)}"
            )

    logger.info(
        f"[YouTubeSceneRender] Scene {scene_number} generation path={generation_mode}, "
        f"has_audio={bool(audio_base64)}, has_image={bool(image_base64)}, "
        f"had_image_url={has_existing_image}"
    )

    try:
        video_result = generate_youtube_scene_video(
            visual_prompt=visual_prompt,
            resolution=resolution,
            duration=duration,
            audio_base64=audio_base64,
            image_base64=image_base64,
            wavespeed_client=wavespeed_client,
            enable_prompt_expansion=WAN25_ENABLE_PROMPT_EXPANSION,
            timeout=600,
        )
    except HTTPException as e:
        error_detail = e.detail
        error_msg = (
            error_detail.get("error", str(error_detail))
            if isinstance(error_detail, dict)
            else str(error_detail)
        )
        prediction_id = error_detail.get("prediction_id") if isinstance(error_detail, dict) else None
        logger.warning(
            f"[YouTubeSceneRender] Scene {scene_number} {generation_mode} generation rejected: "
            f"{error_msg} prediction_id={prediction_id}",
            exc_info=True,
        )
        raise
    except requests.exceptions.Timeout as e:
        logger.error(
            f"[YouTubeSceneRender] Scene {scene_number} {generation_mode} timed out: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=504,
            detail={
                "error": "WaveSpeed request timed out",
                "scene_number": scene_number,
                "generation_mode": generation_mode,
                "message": "The video generation request timed out.",
                "user_action": "Please retry. If it persists, try fewer scenes, lower resolution, or shorter durations.",
            },
        ) from e
    except requests.exceptions.RequestException as e:
        logger.error(
            f"[YouTubeSceneRender] Scene {scene_number} {generation_mode} request failed: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=502,
            detail={
                "error": "WaveSpeed request failed",
                "scene_number": scene_number,
                "generation_mode": generation_mode,
                "message": str(e),
                "user_action": "Please retry. If it persists, check network connectivity or try again later.",
            },
        ) from e

    video_bytes = video_result.get("video_bytes") or b""
    if not video_bytes:
        logger.error(
            f"[YouTubeSceneRender] Scene {scene_number} {generation_mode} returned empty video bytes "
            f"(model={video_result.get('model_name')})"
        )
        raise HTTPException(
            status_code=502,
            detail={
                "error": "Video generation returned empty output",
                "scene_number": scene_number,
                "generation_mode": generation_mode,
                "message": "The video provider completed without returning video data.",
                "user_action": "Please retry rendering this scene.",
            },
        )

    try:
        save_result = save_youtube_scene_video(
            video_bytes=video_bytes,
            scene_number=scene_number,
            user_id=user_id,
            db=db,
        )
    except Exception as exc:
        logger.error(
            f"[YouTubeSceneRender] Scene {scene_number} failed to save rendered video: {exc}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Failed to save rendered scene video",
                "scene_number": scene_number,
                "generation_mode": generation_mode,
                "message": str(exc),
                "user_action": "Please retry. If the issue persists, check workspace storage permissions.",
            },
        ) from exc

    usage_info = track_video_usage(
        user_id=user_id,
        provider=video_result["provider"],
        model_name=video_result["model_name"],
        prompt=visual_prompt,
        video_bytes=video_bytes,
        cost_override=video_result["cost"],
    )

    logger.info(
        f"[YouTubeSceneRender] Scene {scene_number} rendered via {generation_mode}: "
        f"cost=${video_result['cost']:.2f}, size={len(video_bytes)} bytes, "
        f"model={video_result.get('model_name')}, audio_attached={bool(audio_base64)}, "
        f"image_attached={bool(image_base64)}"
    )

    return {
        "scene_number": scene_number,
        "video_filename": save_result["video_filename"],
        "video_url": save_result["video_url"],
        "video_path": save_result["video_path"],
        "duration": video_result["duration"],
        "cost": video_result["cost"],
        "resolution": resolution,
        "width": video_result["width"],
        "height": video_result["height"],
        "file_size": save_result["file_size"],
        "prediction_id": video_result.get("prediction_id"),
        "usage_info": usage_info,
        "generation_mode": generation_mode,
        "generation": build_youtube_scene_video_generation_metadata(
            visual_prompt=visual_prompt,
            prompt_source=prompt_source,
            generation_mode=generation_mode,
            duration=duration,
            resolution=resolution,
            enable_prompt_expansion=WAN25_ENABLE_PROMPT_EXPANSION,
            provider=video_result.get("provider", "wavespeed"),
            model=video_result.get("model_name", "wan-2.5"),
            image_attached=bool(image_base64),
            audio_attached=bool(audio_base64),
            image_url=str(scene_image_url or ""),
            audio_url=str(scene.get("audioUrl") or ""),
            duration_estimate=duration_estimate,
        ),
    }
