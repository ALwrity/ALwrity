"""POST /youtube/plan/idea/enhance — three topic choices for Plan Your Video."""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException

from middleware.auth_middleware import get_current_user
from services.youtube.planner_idea_enhance import IdeaEnhanceError, enhance_youtube_plan_idea
from utils.logger_utils import get_service_logger
from ..deps import require_authenticated_user
from ..schemas import PlanIdeaEnhanceRequest, PlanIdeaEnhanceResponse

router = APIRouter(tags=["youtube"])
logger = get_service_logger("api.youtube.plan_idea_enhance")


def _load_channel_bible_context(user_id: str) -> str:
    """Best-effort Channel Bible prompt block. Never fail the enhance call."""
    try:
        from services.database import get_session_for_user
        from services.youtube.channel_bible import get_or_create, serialize_for_prompt

        bible_db = get_session_for_user(user_id)
        if bible_db is None:
            return ""
        try:
            bible, _source = get_or_create(bible_db, user_id)
            return serialize_for_prompt(bible) or ""
        finally:
            bible_db.close()
    except Exception as bible_err:
        logger.warning(
            "[YouTubePlanIdeaEnhance] Channel bible load failed; continuing. err={}",
            bible_err,
            exc_info=True,
        )
        return ""


@router.post("/plan/idea/enhance", response_model=PlanIdeaEnhanceResponse)
async def enhance_plan_idea(
    request: PlanIdeaEnhanceRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> PlanIdeaEnhanceResponse:
    """Return exactly three enhanced Plan topics for the creator to choose."""
    user_id = require_authenticated_user(current_user)
    idea = (request.user_idea or "").strip()
    if not idea:
        logger.warning("[YouTubePlanIdeaEnhance] Rejected empty idea user={}", user_id)
        raise HTTPException(status_code=400, detail="Please enter your video idea.")

    language = (request.language or "").strip() or None
    duration_type: Optional[str] = request.duration_type
    logger.info(
        "[YouTubePlanIdeaEnhance] Request idea_len={} duration={} language={} user={}",
        len(idea),
        duration_type or "medium",
        language or "en",
        user_id,
    )
    bible_context = _load_channel_bible_context(user_id)
    try:
        result = enhance_youtube_plan_idea(
            user_idea=idea,
            duration_type=duration_type,
            language=language,
            channel_bible_context=bible_context,
            user_id=user_id,
        )
    except IdeaEnhanceError as exc:
        logger.warning("[YouTubePlanIdeaEnhance] Enhance rejected: {}", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("[YouTubePlanIdeaEnhance] Unexpected enhance failure")
        raise HTTPException(
            status_code=502,
            detail="Could not enhance this topic. Please try again.",
        ) from exc

    logger.info("[YouTubePlanIdeaEnhance] Success idea_count=3 user={}", user_id)
    return PlanIdeaEnhanceResponse(
        success=True,
        enhanced_ideas=result["enhanced_ideas"],
        rationales=result["rationales"],
        message="Topic options ready.",
    )
