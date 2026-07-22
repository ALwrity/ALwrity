"""
Scene Animation Routes

Handles scene animation endpoints using WaveSpeed Kling and InfiniteTalk.
"""

import mimetypes
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from loguru import logger
from sqlalchemy.orm import Session

from middleware.auth_middleware import get_current_user
from models.story_models import (
    AnimateSceneRequest,
    AnimateSceneResponse,
    AnimateSceneVoiceoverRequest,
    ResumeSceneAnimationRequest,
)
from services.database import get_db, get_session_for_user
from services.llm_providers.main_video_generation import track_video_usage
from services.story_writer.video_generation_service import StoryVideoGenerationService
from services.subscription import PricingService
from services.subscription.preflight_validator import validate_scene_animation_operation
from services.wavespeed.infinitetalk import animate_scene_with_voiceover
from services.wavespeed.kling_animation import animate_scene_image, resume_scene_animation
from utils.asset_tracker import save_asset_to_library
from utils.logger_utils import get_service_logger

from ..task_manager import task_manager
from ..utils.auth import require_authenticated_user
from ..utils.media_utils import get_story_media_write_dir, load_story_audio_bytes, load_story_image_bytes

router = APIRouter()
scene_logger = get_service_logger("api.story_writer.scene_animation")
AI_VIDEO_SUBDIR = Path("AI_Videos")


def _build_authenticated_media_url(request: Request, path: str) -> str:
    """Append the caller's auth token to a media URL so <video>/<img> tags can access it."""
    if not path:
        return path

    token: Optional[str] = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "").strip()
    elif "token" in request.query_params:
        token = request.query_params["token"]

    if token:
        separator = "&" if "?" in path else "?"
        path = f"{path}{separator}token={quote(token)}"

    return path


def _guess_mime_from_url(url: str, fallback: str) -> str:
    """Guess MIME type from URL."""
    if not url:
        return fallback
    mime, _ = mimetypes.guess_type(url)
    return mime or fallback


@router.post("/animate-scene-preview", response_model=AnimateSceneResponse)
async def animate_scene_preview(
    request_obj: Request,
    request: AnimateSceneRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> AnimateSceneResponse:
    """
    Animate a single scene image using WaveSpeed Kling v2.5 Turbo Std.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = str(current_user.get("id", ""))
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user ID in authentication token")

    duration = request.duration or 5
    if duration not in (5, 10):
        raise HTTPException(status_code=400, detail="Duration must be 5 or 10 seconds.")

    scene_logger.info(
        "[AnimateScene] User=%s scene=%s duration=%s image_url=%s",
        user_id,
        request.scene_number,
        duration,
        request.image_url,
    )

    image_bytes = load_story_image_bytes(request.image_url, user_id=user_id)
    if not image_bytes:
        scene_logger.warning("[AnimateScene] Missing image bytes for user=%s scene=%s", user_id, request.scene_number)
        raise HTTPException(status_code=404, detail="Scene image not found. Generate images first.")

    db = get_session_for_user(user_id)
    if db is None:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable")
    try:
        pricing_service = PricingService(db)
        validate_scene_animation_operation(pricing_service=pricing_service, user_id=user_id)
    finally:
        db.close()

    animation_result = animate_scene_image(
        image_bytes=image_bytes,
        scene_data=request.scene_data,
        story_context=request.story_context,
        user_id=user_id,
        duration=duration,
    )

    ai_video_dir = get_story_media_write_dir("video", user_id=user_id)
    (ai_video_dir / AI_VIDEO_SUBDIR).mkdir(parents=True, exist_ok=True)

    # Save video asset to library
    db = get_session_for_user(user_id)
    if db is None:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable")
    try:
        video_service = StoryVideoGenerationService(output_dir=str(ai_video_dir / AI_VIDEO_SUBDIR))

        save_result = video_service.save_scene_video(
            video_bytes=animation_result["video_bytes"],
            scene_number=request.scene_number,
            user_id=user_id,
            db=db
        )
        video_filename = save_result["video_filename"]
        video_url = _build_authenticated_media_url(
            request_obj, f"/api/story/videos/ai/{video_filename}"
        )
    
        usage_info = track_video_usage(
            user_id=user_id,
            provider=animation_result["provider"],
            model_name=animation_result["model_name"],
            prompt=animation_result["prompt"],
            video_bytes=animation_result["video_bytes"],
            cost_override=animation_result["cost"],
        )
    except Exception as e:
        logger.error(f"Failed to track usage for generated video: {e}")
        # Don't fail the request if tracking fails, just log it
        pass
    
    if usage_info:
        scene_logger.warning(
            "[AnimateScene] Video usage tracked user=%s: %s → %s / %s (cost +$%.2f, total=$%.2f)",
            user_id,
            usage_info.get("previous_calls"),
            usage_info.get("current_calls"),
            usage_info.get("video_limit_display"),
            usage_info.get("cost_per_video", 0.0),
            usage_info.get("total_video_cost", 0.0),
        )

    scene_logger.info(
        "[AnimateScene] ✅ Completed user=%s scene=%s duration=%s cost=$%.2f video=%s",
        user_id,
        request.scene_number,
        animation_result["duration"],
        animation_result["cost"],
        video_url,
    )

    # Save video asset to library
    db = get_session_for_user(user_id)
    if db is None:
        logger.warning(f"[StoryWriter] Could not open database session to save video asset for {user_id}")
    else:
        try:
            save_asset_to_library(
                db=db,
                user_id=user_id,
                asset_type="video",
                source_module="story_writer",
                filename=video_filename,
                file_url=video_url,
                file_path=str(ai_video_dir / AI_VIDEO_SUBDIR / video_filename),
                file_size=len(animation_result["video_bytes"]),
                mime_type="video/mp4",
                title=f"Scene {request.scene_number} Animation",
                description=f"Animated scene {request.scene_number} from story",
                prompt=animation_result["prompt"],
                tags=["story_writer", "video", "animation", f"scene_{request.scene_number}"],
                provider=animation_result["provider"],
                model=animation_result.get("model_name"),
                cost=animation_result["cost"],
                asset_metadata={"scene_number": request.scene_number, "duration": animation_result["duration"], "status": "completed"}
            )
        except Exception as e:
            logger.warning(f"[StoryWriter] Failed to save video asset to library: {e}")
        finally:
            db.close()

    return AnimateSceneResponse(
        success=True,
        scene_number=request.scene_number,
        video_filename=video_filename,
        video_url=video_url,
        duration=animation_result["duration"],
        cost=animation_result["cost"],
        prompt_used=animation_result["prompt"],
        provider=animation_result["provider"],
        prediction_id=animation_result.get("prediction_id"),
    )


@router.post("/animate-scene-resume", response_model=AnimateSceneResponse)
async def resume_scene_animation_endpoint(
    request_obj: Request,
    request: ResumeSceneAnimationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> AnimateSceneResponse:
    """Resume downloading a WaveSpeed animation when the initial call timed out."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = str(current_user.get("id", ""))
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user ID in authentication token")

    scene_logger.info(
        "[AnimateScene] Resume requested user=%s scene=%s prediction=%s",
        user_id,
        request.scene_number,
        request.prediction_id,
    )

    animation_result = resume_scene_animation(
        prediction_id=request.prediction_id,
        duration=request.duration or 5,
        user_id=user_id,
    )

    ai_video_dir = get_story_media_write_dir("video", user_id=user_id)
    (ai_video_dir / AI_VIDEO_SUBDIR).mkdir(parents=True, exist_ok=True)
    video_service = StoryVideoGenerationService(output_dir=str(ai_video_dir / AI_VIDEO_SUBDIR))

    save_result = video_service.save_scene_video(
        video_bytes=animation_result["video_bytes"],
        scene_number=request.scene_number,
        user_id=user_id,
    )
    video_filename = save_result["video_filename"]
    video_url = _build_authenticated_media_url(
        request_obj, f"/api/story/videos/ai/{video_filename}"
    )

    usage_info = track_video_usage(
        user_id=user_id,
        provider=animation_result["provider"],
        model_name=animation_result["model_name"],
        prompt=animation_result["prompt"],
        video_bytes=animation_result["video_bytes"],
        cost_override=animation_result["cost"],
    )
    if usage_info:
        scene_logger.warning(
            "[AnimateScene] (Resume) Video usage tracked user=%s: %s → %s / %s (cost +$%.2f, total=$%.2f)",
            user_id,
            usage_info.get("previous_calls"),
            usage_info.get("current_calls"),
            usage_info.get("video_limit_display"),
            usage_info.get("cost_per_video", 0.0),
            usage_info.get("total_video_cost", 0.0),
        )

    scene_logger.info(
        "[AnimateScene] ✅ Resume completed user=%s scene=%s prediction=%s video=%s",
        user_id,
        request.scene_number,
        request.prediction_id,
        video_url,
    )

    return AnimateSceneResponse(
        success=True,
        scene_number=request.scene_number,
        video_filename=video_filename,
        video_url=video_url,
        duration=animation_result["duration"],
        cost=animation_result["cost"],
        prompt_used=animation_result["prompt"],
        provider=animation_result["provider"],
        prediction_id=animation_result.get("prediction_id"),
    )


@router.post("/animate-scene-voiceover", response_model=Dict[str, Any])
async def animate_scene_voiceover_endpoint(
    request_obj: Request,
    request: AnimateSceneVoiceoverRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Animate a scene using WaveSpeed InfiniteTalk (image + audio) asynchronously.
    Returns task_id for polling since InfiniteTalk can take up to 10 minutes.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = str(current_user.get("id", ""))
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user ID in authentication token")

    scene_logger.info(
        "[AnimateSceneVoiceover] User=%s scene=%s resolution=%s (async)",
        user_id,
        request.scene_number,
        request.resolution or "720p",
    )

    image_bytes = load_story_image_bytes(request.image_url)
    if not image_bytes:
        raise HTTPException(status_code=404, detail="Scene image not found. Generate images first.")

    audio_bytes = load_story_audio_bytes(request.audio_url)
    if not audio_bytes:
        raise HTTPException(status_code=404, detail="Scene audio not found. Generate audio first.")

    db = get_session_for_user(user_id)
    if db is None:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable")
    try:
        pricing_service = PricingService(db)
        validate_scene_animation_operation(pricing_service=pricing_service, user_id=user_id)
    finally:
        db.close()

    # Extract token for authenticated URL building (if needed)
    auth_token = None
    auth_header = request_obj.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        auth_token = auth_header.replace("Bearer ", "").strip()

    # Create async task
    task_id = task_manager.create_task("scene_voiceover_animation")
    background_tasks.add_task(
        _execute_voiceover_animation_task,
        task_id=task_id,
        request=request,
        user_id=user_id,
        image_bytes=image_bytes,
        audio_bytes=audio_bytes,
        auth_token=auth_token,
    )

    return {
        "task_id": task_id,
        "status": "pending",
        "message": "InfiniteTalk animation started. This may take up to 10 minutes.",
    }


def _execute_voiceover_animation_task(
    task_id: str,
    request: AnimateSceneVoiceoverRequest,
    user_id: str,
    image_bytes: bytes,
    audio_bytes: bytes,
    auth_token: Optional[str] = None,
):
    """Background task to generate InfiniteTalk video with progress updates."""
    try:
        task_manager.update_task_status(
            task_id, "processing", progress=5.0, message="Submitting to WaveSpeed InfiniteTalk..."
        )

        animation_result = animate_scene_with_voiceover(
            image_bytes=image_bytes,
            audio_bytes=audio_bytes,
            scene_data=request.scene_data,
            story_context=request.story_context,
            user_id=user_id,
            resolution=request.resolution or "720p",
            prompt_override=request.prompt,
            image_mime=_guess_mime_from_url(request.image_url, "image/png"),
            audio_mime=_guess_mime_from_url(request.audio_url, "audio/mpeg"),
        )

        task_manager.update_task_status(
            task_id, "processing", progress=80.0, message="Saving video file..."
        )

        ai_video_dir = get_story_media_write_dir("video", user_id=user_id)
        (ai_video_dir / AI_VIDEO_SUBDIR).mkdir(parents=True, exist_ok=True)
        video_service = StoryVideoGenerationService(output_dir=str(ai_video_dir / AI_VIDEO_SUBDIR))

        save_result = video_service.save_scene_video(
            video_bytes=animation_result["video_bytes"],
            scene_number=request.scene_number,
            user_id=user_id,
        )
        video_filename = save_result["video_filename"]
        # Build authenticated URL if token provided, otherwise return plain URL
        video_url = f"/api/story/videos/ai/{video_filename}"
        if auth_token:
            video_url = f"{video_url}?token={quote(auth_token)}"

        usage_info = track_video_usage(
            user_id=user_id,
            provider=animation_result["provider"],
            model_name=animation_result["model_name"],
            prompt=animation_result["prompt"],
            video_bytes=animation_result["video_bytes"],
            cost_override=animation_result["cost"],
        )
        if usage_info:
            scene_logger.warning(
                "[AnimateSceneVoiceover] Video usage tracked user=%s: %s → %s / %s (cost +$%.2f, total=$%.2f)",
                user_id,
                usage_info.get("previous_calls"),
                usage_info.get("current_calls"),
                usage_info.get("video_limit_display"),
                usage_info.get("cost_per_video", 0.0),
                usage_info.get("total_video_cost", 0.0),
            )

        scene_logger.info(
            "[AnimateSceneVoiceover] ✅ Completed user=%s scene=%s cost=$%.2f video=%s",
            user_id,
            request.scene_number,
            animation_result["cost"],
            video_url,
        )

        # Save video asset to library
        db = get_session_for_user(user_id)
        if db is None:
            logger.warning(f"[StoryWriter] Could not open database session to save voiceover asset for {user_id}")
        else:
            try:
                save_asset_to_library(
                    db=db,
                    user_id=user_id,
                    asset_type="video",
                    source_module="story_writer",
                    filename=video_filename,
                    file_url=video_url,
                    file_path=str(ai_video_dir / AI_VIDEO_SUBDIR / video_filename),
                    file_size=len(animation_result["video_bytes"]),
                    mime_type="video/mp4",
                    title=f"Scene {request.scene_number} Animation (Voiceover)",
                    description=f"Animated scene {request.scene_number} with voiceover from story",
                    prompt=animation_result["prompt"],
                    tags=["story_writer", "video", "animation", "voiceover", f"scene_{request.scene_number}"],
                    provider=animation_result["provider"],
                    model=animation_result.get("model_name"),
                    cost=animation_result["cost"],
                    asset_metadata={"scene_number": request.scene_number, "duration": animation_result["duration"], "status": "completed"}
                )
            except Exception as e:
                logger.warning(f"[StoryWriter] Failed to save video asset to library: {e}")
            finally:
                db.close()

        result = AnimateSceneResponse(
            success=True,
            scene_number=request.scene_number,
            video_filename=video_filename,
            video_url=video_url,
            duration=animation_result["duration"],
            cost=animation_result["cost"],
            prompt_used=animation_result["prompt"],
            provider=animation_result["provider"],
            prediction_id=animation_result.get("prediction_id"),
        )

        task_manager.update_task_status(
            task_id,
            "completed",
            progress=100.0,
            message="InfiniteTalk animation complete!",
            result=result.dict(),
        )
    except HTTPException as exc:
        error_msg = str(exc.detail) if isinstance(exc.detail, str) else exc.detail.get("error", "Animation failed") if isinstance(exc.detail, dict) else "Animation failed"
        scene_logger.error(f"[AnimateSceneVoiceover] Failed: {error_msg}")
        task_manager.update_task_status(
            task_id,
            "failed",
            error=error_msg,
            message=f"InfiniteTalk animation failed: {error_msg}",
        )
    except Exception as exc:
        error_msg = str(exc)
        scene_logger.error(f"[AnimateSceneVoiceover] Error: {error_msg}", exc_info=True)
        task_manager.update_task_status(
            task_id,
            "failed",
            error=error_msg,
            message=f"InfiniteTalk animation error: {error_msg}",
        )

