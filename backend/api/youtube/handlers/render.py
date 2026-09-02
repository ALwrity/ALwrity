"""YouTube render, combine, and cost-estimate API handlers."""

from typing import Any, Dict, Optional
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from middleware.auth_middleware import get_current_user
from services.database import get_db
from services.subscription import PricingService
from services.subscription.preflight_validator import validate_scene_animation_operation
from services.youtube.renderer import YouTubeVideoRendererService
from services.youtube.video_storage import (
    find_youtube_video_file,
    get_youtube_video_dir,
)
from utils.logger_utils import get_service_logger
from ..combine_tasks import _execute_combine_video_task
from ..deps import require_authenticated_user
from ..render_tasks import (
    _execute_scene_video_render_task,
    _execute_video_render_task,
)
from ..schemas import (
    CombineVideosRequest,
    CombineVideosResponse,
    CostEstimateRequest,
    CostEstimateResponse,
    SceneVideoRenderRequest,
    SceneVideoRenderResponse,
    VideoRenderRequest,
    VideoRenderResponse,
)
from ..task_manager import task_manager

router = APIRouter(tags=["youtube"])
logger = get_service_logger("api.youtube.render")


@router.post("/render", response_model=VideoRenderResponse)
async def start_video_render(
    request: VideoRenderRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VideoRenderResponse:
    """
    Start rendering a video from scenes asynchronously.

    This endpoint creates a background task that:
    1. Generates narration audio for each scene
    2. Renders each scene using WAN 2.5 text-to-video
    3. Combines scenes into final video (if requested)
    4. Saves to asset library

    Returns task_id for polling progress.
    """
    try:
        user_id = require_authenticated_user(current_user)

        # Filter enabled scenes FIRST so we can validate credits for the actual count
        enabled_scenes = [s for s in request.scenes if s.get("enabled", True)]
        if not enabled_scenes:
            return VideoRenderResponse(
                success=False,
                message="No enabled scenes to render"
            )

        # Validate subscription limits for ALL scenes in the batch
        pricing_service = PricingService(db)
        validate_scene_animation_operation(
            pricing_service=pricing_service,
            user_id=user_id,
            scene_count=len(enabled_scenes),
        )

        # VALIDATION: Pre-validate scenes before creating task to prevent wasted API calls
        validation_errors = []
        for scene in enabled_scenes:
            scene_num = scene.get("scene_number", 0)
            visual_prompt = (scene.get("enhanced_visual_prompt") or scene.get("visual_prompt", "")).strip()

            if not visual_prompt:
                validation_errors.append(f"Scene {scene_num}: Missing visual prompt")
            elif len(visual_prompt) < 5:
                validation_errors.append(f"Scene {scene_num}: Visual prompt too short ({len(visual_prompt)} chars, minimum 5)")

            # Validate duration
            duration = scene.get("duration_estimate", 5)
            if duration < 1 or duration > 10:
                validation_errors.append(f"Scene {scene_num}: Invalid duration ({duration}s, must be 1-10 seconds)")

            # VALIDATION: Check for required assets (image and audio)
            if not scene.get("imageUrl"):
                validation_errors.append(f"Scene {scene_num}: Missing image. Please generate an image for this scene first.")
            if not scene.get("audioUrl"):
                validation_errors.append(f"Scene {scene_num}: Missing audio. Please generate audio narration for this scene first.")

        if validation_errors:
            error_msg = "Validation failed: " + "; ".join(validation_errors)
            logger.warning(f"[YouTubeAPI] {error_msg}")
            return VideoRenderResponse(
                success=False,
                message=error_msg + ". Please fix these issues before rendering."
            )

        logger.info(
            f"[YouTubeAPI] Starting render: {len(enabled_scenes)} scenes, "
            f"resolution={request.resolution}, user={user_id}"
        )

        # Create async task
        task_id = task_manager.create_task("youtube_video_render")
        logger.info(
            f"[YouTubeAPI] Created task {task_id} for user {user_id}, "
            f"scenes={len(enabled_scenes)}, resolution={request.resolution}"
        )

        # Verify task was created
        initial_status = task_manager.get_task_status(task_id)
        if not initial_status:
            logger.error(f"[YouTubeAPI] Failed to create task {task_id} - task not found immediately after creation")
            return VideoRenderResponse(
                success=False,
                message="Failed to create render task. Please try again."
            )

        # Add background task
        try:
            background_tasks.add_task(
                _execute_video_render_task,
                task_id=task_id,
                scenes=enabled_scenes,
                video_plan=request.video_plan,
                user_id=user_id,
                resolution=request.resolution,
                combine_scenes=request.combine_scenes,
                voice_id=request.voice_id,
            )
            logger.info(f"[YouTubeAPI] Background task added for task {task_id}")
        except Exception as bg_error:
            logger.error(f"[YouTubeAPI] Failed to add background task for {task_id}: {bg_error}", exc_info=True)
            # Mark task as failed
            task_manager.update_task_status(
                task_id,
                "failed",
                error=str(bg_error),
                message="Failed to start background render task"
            )
            return VideoRenderResponse(
                success=False,
                message=f"Failed to start render task: {str(bg_error)}"
            )

        return VideoRenderResponse(
            success=True,
            task_id=task_id,
            message=f"Video rendering started. Processing {len(enabled_scenes)} scenes..."
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[YouTubeAPI] Error starting render: {e}", exc_info=True)
        return VideoRenderResponse(
            success=False,
            message=f"Failed to start render: {str(e)}"
        )


@router.post("/render/scene", response_model=SceneVideoRenderResponse)
async def render_single_scene_video(
    request: SceneVideoRenderRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SceneVideoRenderResponse:
    """
    Render a single scene video (scene-wise generation).
    Returns a task_id for polling.
    """
    try:
        user_id = require_authenticated_user(current_user)

        # Subscription validation (same as full render)
        pricing_service = PricingService(db)
        validate_scene_animation_operation(
            pricing_service=pricing_service,
            user_id=user_id
        )

        scene = request.scene
        scene_num = scene.get("scene_number", 0)

        # Pre-validation to avoid wasted calls
        validation_errors = []
        visual_prompt = (scene.get("enhanced_visual_prompt") or scene.get("visual_prompt", "")).strip()
        duration = scene.get("duration_estimate", 5)
        if not visual_prompt:
            validation_errors.append(f"Scene {scene_num}: Missing visual prompt")
        elif len(visual_prompt) < 5:
            validation_errors.append(f"Scene {scene_num}: Visual prompt too short ({len(visual_prompt)} chars, minimum 5)")
        if duration < 1 or duration > 10:
            validation_errors.append(f"Scene {scene_num}: Invalid duration ({duration}s, must be 1-10 seconds)")
        if not scene.get("imageUrl"):
            validation_errors.append(f"Scene {scene_num}: Missing image. Please generate an image first.")
        if not scene.get("audioUrl") and not request.generate_audio_enabled:
            validation_errors.append(f"Scene {scene_num}: Missing audio. Please generate audio first or enable generate_audio_enabled.")

        if validation_errors:
            error_msg = "Validation failed: " + "; ".join(validation_errors)
            logger.warning(f"[YouTubeAPI] {error_msg}")
            return SceneVideoRenderResponse(
                success=False,
                task_id=None,
                message=error_msg,
                scene_number=scene_num
            )

        # Create task
        task_id = task_manager.create_task("youtube_scene_video_render")
        logger.info(
            f"[YouTubeAPI] Created single-scene render task {task_id} for user {user_id}, scene={scene_num}, resolution={request.resolution}"
        )

        initial_status = task_manager.get_task_status(task_id)
        if not initial_status:
            logger.error(f"[YouTubeAPI] Failed to create task {task_id} - task not found immediately after creation")
            return SceneVideoRenderResponse(
                success=False,
                task_id=None,
                message="Failed to create render task. Please try again.",
                scene_number=scene_num
            )

        # Add background task
        try:
            background_tasks.add_task(
                _execute_scene_video_render_task,
                task_id=task_id,
                scene=scene,
                video_plan=request.video_plan,
                user_id=user_id,
                resolution=request.resolution,
                generate_audio_enabled=request.generate_audio_enabled,
                voice_id=request.voice_id,
            )
            logger.info(f"[YouTubeAPI] Background task added for single scene {task_id}")
        except Exception as bg_error:
            logger.error(f"[YouTubeAPI] Failed to add background task for {task_id}: {bg_error}", exc_info=True)
            task_manager.update_task_status(
                task_id,
                "failed",
                error=str(bg_error),
                message="Failed to start background render task"
            )
            return SceneVideoRenderResponse(
                success=False,
                task_id=None,
                message=f"Failed to start render task: {str(bg_error)}",
                scene_number=scene_num
            )

        return SceneVideoRenderResponse(
            success=True,
            task_id=task_id,
            message=f"Scene {scene_num} rendering started.",
            scene_number=scene_num
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[YouTubeAPI] Error starting single-scene render: {e}", exc_info=True)
        return SceneVideoRenderResponse(
            success=False,
            task_id=None,
            message=f"Failed to start scene render: {str(e)}",
            scene_number=request.scene.get("scene_number") if request and request.scene else None
        )


@router.get("/render/{task_id}")
async def get_render_status(
    task_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Optional[Dict[str, Any]]:
    """
    Get the status of a video rendering task.

    Returns current progress, status, and result when complete.
    Returns None if task not found (matches podcast pattern for graceful handling).
    """
    try:
        require_authenticated_user(current_user)

        logger.debug(f"[YouTubeAPI] Getting render status for task: {task_id}")
        task_status = task_manager.get_task_status(task_id)
        if not task_status:
            # Log at DEBUG level - null is expected when tasks expire or server restarts
            # This prevents log spam from frontend polling for expired/completed tasks
            # Return None instead of raising 404 to match podcast pattern for graceful frontend handling
            logger.debug(
                f"[YouTubeAPI] Task {task_id} not found (may have expired or been cleaned up). "
                f"Available tasks: {len(task_manager.task_storage)}"
            )
            return None

        return task_status

    except Exception as e:
        logger.error(f"[YouTubeAPI] Error getting render status: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get render status: {str(e)}"
        )


@router.post("/render/combine", response_model=CombineVideosResponse)
async def combine_scene_videos(
    request: CombineVideosRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CombineVideosResponse:
    """
    Combine multiple scene videos into a final video.
    Returns task_id for polling.
    """
    try:
        user_id = require_authenticated_user(current_user)

        if not request.scene_video_urls or len(request.scene_video_urls) < 2:
            return CombineVideosResponse(
                success=False,
                task_id=None,
                message="At least two scene videos are required to combine."
            )

        youtube_video_dir = get_youtube_video_dir(user_id=user_id, db=db)
        missing_files = []
        for url in request.scene_video_urls:
            filename = Path(url).name
            # prevent directory traversal
            if ".." in filename or "/" in filename or "\\" in filename:
                return CombineVideosResponse(
                    success=False,
                    task_id=None,
                    message=f"Invalid video filename: {filename}"
                )
            video_path = find_youtube_video_file(filename, user_id=user_id, db=db)
            if not video_path:
                missing_files.append(filename)
        if missing_files:
            logger.error(
                f"[YouTubeAPI] Combine preflight missing files for user {user_id}: {missing_files} "
                f"(canonical_dir={youtube_video_dir})"
            )
            return CombineVideosResponse(
                success=False,
                task_id=None,
                message=f"Video files not found for combine: {', '.join(missing_files)}"
            )

        # Create task
        task_id = task_manager.create_task("youtube_video_combine")
        logger.info(
            f"[YouTubeAPI] Created combine task {task_id} for user {user_id}, videos={len(request.scene_video_urls)}, resolution={request.resolution}"
        )

        initial_status = task_manager.get_task_status(task_id)
        if not initial_status:
            logger.error(f"[YouTubeAPI] Failed to create combine task {task_id} - task not found immediately after creation")
            return CombineVideosResponse(
                success=False,
                task_id=None,
                message="Failed to create combine task. Please try again."
            )

        # Background combine task
        try:
            background_tasks.add_task(
                _execute_combine_video_task,
                task_id=task_id,
                scene_video_urls=request.scene_video_urls,
                user_id=user_id,
                resolution=request.resolution,
                title=request.title,
            )
            logger.info(f"[YouTubeAPI] Background combine task added for task {task_id}")
        except Exception as bg_error:
            logger.error(f"[YouTubeAPI] Failed to add combine task {task_id}: {bg_error}", exc_info=True)
            task_manager.update_task_status(
                task_id,
                "failed",
                error=str(bg_error),
                message="Failed to start video combination task"
            )
            return CombineVideosResponse(
                success=False,
                task_id=None,
                message=f"Failed to start combination task: {str(bg_error)}"
            )

        return CombineVideosResponse(
            success=True,
            task_id=task_id,
            message=f"Combining {len(request.scene_video_urls)} videos...",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[YouTubeAPI] Error combining videos: {e}", exc_info=True)
        return CombineVideosResponse(
            success=False,
            task_id=None,
            message=f"Failed to start video combination: {str(e)}"
        )


@router.post("/estimate-cost", response_model=CostEstimateResponse)
async def estimate_render_cost(
    request: CostEstimateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> CostEstimateResponse:
    """
    Estimate the cost of rendering a video before actually rendering it.

    This endpoint calculates the expected cost based on:
    - Number of enabled scenes
    - Duration of each scene
    - Selected resolution

    Returns a detailed cost breakdown.
    """
    try:
        require_authenticated_user(current_user)

        logger.info(
            f"[YouTubeAPI] Estimating cost: {len(request.scenes)} scenes, "
            f"resolution={request.resolution}"
        )

        renderer = YouTubeVideoRendererService()
        estimate = renderer.estimate_render_cost(
            scenes=request.scenes,
            resolution=request.resolution,
            image_model=request.image_model,
        )

        return CostEstimateResponse(
            success=True,
            estimate=estimate,
            message="Cost estimate calculated successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[YouTubeAPI] Error estimating cost: {e}", exc_info=True)
        return CostEstimateResponse(
            success=False,
            message=f"Failed to estimate cost: {str(e)}"
        )
