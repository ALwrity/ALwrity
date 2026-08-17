"""GET/PUT handlers for the per-user YouTube Channel Bible."""

from typing import Any, Dict

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy.orm import Session

from middleware.auth_middleware import get_current_user
from services.database import get_db
from services.youtube.channel_bible import YouTubeChannelBible, get_or_create, save
from utils.logger_utils import get_service_logger
from ..deps import require_authenticated_user

router = APIRouter(tags=["youtube"])
logger = get_service_logger("api.youtube.channel_bible")


@router.get("/channel-bible")
async def get_channel_bible(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return the saved bible, or an onboarding-seeded profile if none exists."""
    try:
        user_id = require_authenticated_user(current_user)
        logger.info("[YouTubeAPI] GET channel-bible user=%s", user_id)
        bible, source = get_or_create(db, user_id)
        return {
            "success": True,
            "bible": bible.model_dump(),
            "source": source,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[YouTubeAPI] GET channel-bible failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to load channel bible. Please try again.",
        ) from exc


@router.put("/channel-bible")
async def save_channel_bible(
    body: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Upsert the user's channel bible. Empty fields are allowed."""
    try:
        user_id = require_authenticated_user(current_user)
        if not isinstance(body, dict):
            raise HTTPException(status_code=400, detail="Channel bible body must be an object")

        logger.info("[YouTubeAPI] PUT channel-bible user=%s", user_id)
        try:
            profile = YouTubeChannelBible.model_validate(body)
        except ValidationError as exc:
            logger.warning("[YouTubeAPI] PUT channel-bible invalid body: %s", exc)
            raise HTTPException(status_code=400, detail="Channel bible body is invalid") from exc

        saved = save(db, user_id, profile)
        return {"success": True, "bible": saved.model_dump()}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[YouTubeAPI] PUT channel-bible failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to save channel bible. Please try again.",
        ) from exc
