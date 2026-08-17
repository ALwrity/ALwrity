"""YouTube plan and scene-building API handlers."""

from typing import Any, Dict
from urllib.parse import urlparse

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

        article_url = (request.source_article_url or "").strip()
        article_host = urlparse(article_url).hostname if article_url else None
        has_source_article = bool(article_url or (request.source_article_summary or "").strip())
        logger.info(
            f"[YouTubeAPI] Creating plan: idea={request.user_idea[:50]}..., "
            f"duration={request.duration_type}, user={user_id}, "
            f"has_source_article={has_source_article}, article_host={article_host}"
        )

        target_audience = request.target_audience
        video_goal = request.video_goal
        brand_style = request.brand_style
        reference_image_description = request.reference_image_description
        channel_bible_context = ""
        has_channel_bible = False
        try:
            from services.database import get_session_for_user
            from services.youtube.channel_bible import (
                apply_to_plan_inputs,
                get_or_create,
                serialize_for_prompt,
            )

            bible_db = get_session_for_user(user_id)
            if bible_db is not None:
                try:
                    bible, _source = get_or_create(bible_db, user_id)
                    filled = apply_to_plan_inputs(
                        bible,
                        target_audience=target_audience,
                        video_goal=video_goal,
                        brand_style=brand_style,
                        reference_image_description=reference_image_description,
                    )
                    target_audience = filled["target_audience"]
                    video_goal = filled["video_goal"]
                    brand_style = filled["brand_style"]
                    reference_image_description = filled["reference_image_description"]
                    channel_bible_context = serialize_for_prompt(bible)
                    has_channel_bible = bool(channel_bible_context)
                finally:
                    bible_db.close()
        except Exception as bible_err:
            logger.warning(
                "[YouTubeAPI] Channel bible load failed; continuing without bible. err=%s",
                bible_err,
                exc_info=True,
            )

        logger.info(
            "[YouTubeAPI] Plan bible context has_channel_bible=%s",
            has_channel_bible,
        )

        planner = YouTubePlannerService()
        plan = await planner.generate_plan(
            user_idea=request.user_idea,
            duration_type=request.duration_type,
            video_type=request.video_type,
            target_audience=target_audience,
            video_goal=video_goal,
            brand_style=brand_style,
            reference_image_description=reference_image_description,
            user_id=user_id,
            avatar_url=request.avatar_url,
            enable_research=request.enable_research,
            source_article_url=request.source_article_url,
            source_article_title=request.source_article_title,
            source_article_summary=request.source_article_summary,
            channel_bible_context=channel_bible_context,
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
