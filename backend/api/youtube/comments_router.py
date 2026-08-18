"""YouTube Comment Assistant API (HITL)."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from loguru import logger

from middleware.auth_middleware import get_current_user
from services.youtube.youtube_comments_service import YouTubeCommentsService
from services.youtube.youtube_oauth_service import YouTubeOAuthService
from .oauth_router import get_oauth_service

router = APIRouter(prefix="/comments", tags=["youtube-comments"])


class DraftReplyRequest(BaseModel):
    comment_text: str = Field(..., min_length=1)
    video_title: Optional[str] = None
    channel_niche: Optional[str] = None
    persona_notes: Optional[str] = None


class SendReplyRequest(BaseModel):
    parent_id: str = Field(..., description="Parent comment id")
    text: str = Field(..., min_length=1)
    token_id: Optional[int] = None


def get_comments_service(
    oauth_service: YouTubeOAuthService = Depends(get_oauth_service),
) -> YouTubeCommentsService:
    return YouTubeCommentsService(oauth_service)


@router.get("/inbox")
def get_comment_inbox(
    max_results: int = Query(20, ge=1, le=50),
    token_id: Optional[int] = Query(None),
    user: dict = Depends(get_current_user),
    service: YouTubeCommentsService = Depends(get_comments_service),
):
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        return service.list_inbox(user_id, token_id=token_id, max_results=max_results)
    except Exception as e:
        logger.error(f"YouTube comments inbox route error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/draft-reply")
def draft_comment_reply(
    body: DraftReplyRequest,
    user: dict = Depends(get_current_user),
    service: YouTubeCommentsService = Depends(get_comments_service),
):
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        return service.draft_reply(
            user_id=user_id,
            comment_text=body.comment_text,
            video_title=body.video_title,
            channel_niche=body.channel_niche,
            persona_notes=body.persona_notes,
        )
    except Exception as e:
        logger.error(f"YouTube draft reply route error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reply")
def send_comment_reply(
    body: SendReplyRequest,
    user: dict = Depends(get_current_user),
    service: YouTubeCommentsService = Depends(get_comments_service),
):
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        return service.send_reply(
            user_id=user_id,
            parent_id=body.parent_id,
            text=body.text,
            token_id=body.token_id,
        )
    except Exception as e:
        logger.error(f"YouTube send reply route error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
