"""YouTube pitch and expand API handlers (Issue #434 Phase 3).

Thin routes: validation, personalization, then planner_pitch services.
Does not change generate_plan / Build Scenes.
"""

from typing import Any, Dict, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException

from middleware.auth_middleware import get_current_user
from services.persona_data_service import PersonaDataService
from services.youtube.planner import YouTubePlannerService
from services.youtube.planner_pitch import expand_pitch_to_script, generate_youtube_pitch
from services.youtube.planner_pitch_validate import PitchValidationError
from utils.logger_utils import get_service_logger
from ..deps import require_authenticated_user
from ..schemas import ExpandRequest, ExpandResponse, PitchRequest, PitchResponse

router = APIRouter(tags=["youtube"])
logger = get_service_logger("api.youtube.plan_pitch")


def _load_plan_personalization(
    user_id: str,
    *,
    target_audience: Optional[str],
    video_goal: Optional[str],
    brand_style: Optional[str],
    reference_image_description: Optional[str],
) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str], str, Optional[Dict[str, Any]]]:
    """Load Channel Bible defaults + YouTube persona. Same pattern as /plan."""
    filled_audience = target_audience
    filled_goal = video_goal
    filled_style = brand_style
    filled_reference = reference_image_description
    channel_bible_context = ""
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
                filled_audience = filled["target_audience"]
                filled_goal = filled["video_goal"]
                filled_style = filled["brand_style"]
                filled_reference = filled["reference_image_description"]
                channel_bible_context = serialize_for_prompt(bible)
            finally:
                bible_db.close()
    except Exception as bible_err:
        logger.warning(
            "[YouTubeAPI] Channel bible load failed; continuing without bible. err={}",
            bible_err,
            exc_info=True,
        )

    persona_data = None
    try:
        platform_persona = PersonaDataService().get_platform_persona(user_id, "youtube")
        if platform_persona and platform_persona.get("platform_persona"):
            persona_data = platform_persona["platform_persona"]
    except Exception as exc:
        logger.warning("[YouTubeAPI] Could not load YouTube persona for {}: {}", user_id, exc)

    logger.info(
        "[YouTubeAPI] Pitch personalization has_channel_bible={} has_persona={}",
        bool(channel_bible_context),
        bool(persona_data),
    )
    return (
        filled_audience,
        filled_goal,
        filled_style,
        filled_reference,
        channel_bible_context,
        persona_data,
    )


@router.post("/plan/pitch", response_model=PitchResponse)
async def create_video_pitch(
    request: PitchRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> PitchResponse:
    """Generate one lightweight pitch from idea + creative angle."""
    try:
        user_id = require_authenticated_user(current_user)
        angle = (request.creative_angle or "").strip()
        logger.info(
            "[YouTubeAPI] Creating pitch: idea_len={} duration={} angle_len={} "
            "enable_research={} user={}",
            len(request.user_idea or ""),
            request.duration_type,
            len(angle),
            request.enable_research,
            user_id,
        )

        (
            target_audience,
            video_goal,
            brand_style,
            _reference,
            channel_bible_context,
            persona_data,
        ) = _load_plan_personalization(
            user_id,
            target_audience=request.target_audience,
            video_goal=request.video_goal,
            brand_style=request.brand_style,
            reference_image_description=request.reference_image_description,
        )

        planner = YouTubePlannerService()
        pitch = await generate_youtube_pitch(
            planner,
            user_idea=request.user_idea,
            duration_type=request.duration_type,
            creative_angle=angle,
            video_type=request.video_type,
            target_audience=target_audience,
            video_goal=video_goal,
            brand_style=brand_style,
            persona_data=persona_data,
            user_id=user_id,
            enable_research=bool(request.enable_research),
            source_article_title=request.source_article_title,
            source_article_summary=request.source_article_summary,
            channel_bible_context=channel_bible_context,
        )
        logger.info("[YouTubeAPI] Pitch generated successfully")
        return PitchResponse(success=True, pitch=pitch, message="Pitch generated successfully")
    except HTTPException:
        raise
    except PitchValidationError as exc:
        logger.warning("[YouTubeAPI] Pitch generation rejected: {}", exc)
        return PitchResponse(success=False, message=str(exc))
    except Exception as exc:
        logger.error("[YouTubeAPI] Error creating pitch: {}", exc, exc_info=True)
        return PitchResponse(success=False, message="Failed to generate pitch. Please try again.")


@router.post("/plan/expand", response_model=ExpandResponse)
async def expand_video_pitch(
    request: ExpandRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ExpandResponse:
    """Expand an approved pitch into a full production script."""
    try:
        user_id = require_authenticated_user(current_user)
        title = str((request.approved_pitch or {}).get("selected_title") or "")
        logger.info(
            "[YouTubeAPI] Expanding pitch: idea_len={} duration={} title_len={} "
            "enable_research={} user={}",
            len(request.user_idea or ""),
            request.duration_type,
            len(title),
            request.enable_research,
            user_id,
        )

        (
            target_audience,
            video_goal,
            brand_style,
            _reference,
            channel_bible_context,
            persona_data,
        ) = _load_plan_personalization(
            user_id,
            target_audience=request.target_audience,
            video_goal=request.video_goal,
            brand_style=request.brand_style,
            reference_image_description=request.reference_image_description,
        )

        planner = YouTubePlannerService()
        expansion = await expand_pitch_to_script(
            planner,
            user_idea=request.user_idea,
            duration_type=request.duration_type,
            approved_pitch=request.approved_pitch,
            video_type=request.video_type,
            target_audience=target_audience,
            video_goal=video_goal,
            brand_style=brand_style,
            persona_data=persona_data,
            user_id=user_id,
            enable_research=bool(request.enable_research),
            channel_bible_context=channel_bible_context,
        )
        full_script = expansion.get("full_script") if isinstance(expansion, dict) else None
        logger.info("[YouTubeAPI] Pitch expanded successfully")
        return ExpandResponse(
            success=True,
            expansion=expansion,
            full_script=full_script if isinstance(full_script, str) else None,
            message="Pitch expanded to full script successfully",
        )
    except HTTPException:
        raise
    except PitchValidationError as exc:
        logger.warning("[YouTubeAPI] Pitch expansion rejected: {}", exc)
        return ExpandResponse(success=False, message=str(exc))
    except Exception as exc:
        logger.error("[YouTubeAPI] Error expanding pitch: {}", exc, exc_info=True)
        return ExpandResponse(success=False, message="Failed to expand pitch. Please try again.")
