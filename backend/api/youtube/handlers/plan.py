"""YouTube plan and scene-building API handlers."""

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from middleware.auth_middleware import get_current_user
from services.youtube.planner import YouTubePlannerService
from services.youtube.scene_builder import YouTubeSceneBuilderService
from utils.logger_utils import get_service_logger
from ..deps import require_authenticated_user
from ..schemas import (
    SceneBuildRequest,
    SceneBuildResponse,
    SceneUpdateRequest,
    SceneUpdateResponse,
    VideoPlanRequest,
    VideoPlanResponse,
)

router = APIRouter(tags=["youtube"])
logger = get_service_logger("api.youtube.plan")


@router.post("/plan", response_model=VideoPlanResponse)
async def create_video_plan(
    request: VideoPlanRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> VideoPlanResponse:
    """Create a video planning from user input."""
    try:
        user_id = require_authenticated_user(current_user)

        logger.info(
            f"[YouTubeAPI] Creating plan: idea={request.user_idea[:50]}..., "
            f"duration={request.duration_type}, user={user_id}"
        )

        planner = YouTubePlannerService()
        plan = await planner.generate_plan(
            user_idea=request.user_idea,
            duration_type=request.duration_type,
            video_type=request.video_type,
            target_audience=request.target_audience,
            video_goal=request.video_goal,
            brand_style=request.brand_style,
            reference_image_description=request.reference_image_description,
            user_id=user_id,
            avatar_url=request.avatar_url,
            enable_research=request.enable_research,
        )

        return VideoPlanResponse(
            success=True,
            plan=plan,
            message="Video plan generated successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[YouTubeAPI] Error creating plan: {e}", exc_info=True)
        return VideoPlanResponse(
            success=False,
            message=f"Failed to create video plan: {str(e)}"
        )


@router.post("/scenes", response_model=SceneBuildResponse)
async def build_scenes(
    request: SceneBuildRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> SceneBuildResponse:
    """
    Build structured scenes from a video plan.

    Converts the video plan into detailed scenes with:
    - Narration text for each scene
    - Visual descriptions and prompts
    - Timing estimates
    - Visual cues and emphasis tags
    """
    try:
        user_id = require_authenticated_user(current_user)

        duration_type = request.video_plan.get('duration_type', 'medium')
        has_existing_scenes = bool(request.video_plan.get("scenes")) and request.video_plan.get("_scenes_included")

        logger.info(
            f"[YouTubeAPI] Building scenes: duration={duration_type}, "
            f"custom_script={bool(request.custom_script)}, "
            f"has_existing_scenes={has_existing_scenes}, "
            f"user={user_id}"
        )

        # Build scenes (optimized to reuse existing scenes if available)
        scene_builder = YouTubeSceneBuilderService()
        scenes = scene_builder.build_scenes_from_plan(
            video_plan=request.video_plan,
            user_id=user_id,
            custom_script=request.custom_script,
        )

        return SceneBuildResponse(
            success=True,
            scenes=scenes,
            message=f"Built {len(scenes)} scenes successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[YouTubeAPI] Error building scenes: {e}", exc_info=True)
        return SceneBuildResponse(
            success=False,
            message=f"Failed to build scenes: {str(e)}"
        )


@router.post("/scenes/{scene_id}/update", response_model=SceneUpdateResponse)
async def update_scene(
    scene_id: int,
    request: SceneUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> SceneUpdateResponse:
    """
    Update a single scene's narration, visual description, or duration.

    This allows users to fine-tune individual scenes before rendering.
    """
    try:
        require_authenticated_user(current_user)

        logger.info(f"[YouTubeAPI] Updating scene {scene_id}")

        # In a full implementation, this would update a stored scene
        # For now, return the updated scene data
        updated_scene = {
            "scene_number": scene_id,
            "narration": request.narration,
            "visual_description": request.visual_description,
            "duration_estimate": request.duration_estimate,
            "enabled": request.enabled if request.enabled is not None else True,
        }

        return SceneUpdateResponse(
            success=True,
            scene=updated_scene,
            message="Scene updated successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[YouTubeAPI] Error updating scene: {e}", exc_info=True)
        return SceneUpdateResponse(
            success=False,
            message=f"Failed to update scene: {str(e)}"
        )
