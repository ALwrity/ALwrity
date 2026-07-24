"""Comment Assistant Draft with ALwrity route (Issue #188)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger

from middleware.auth_middleware import get_current_user
from models.linkedin_comment_assistant_draft_models import (
    CommentAssistantDraftReplyRequest,
    CommentAssistantDraftReplyResponse,
)
from models.linkedin_posts_models import PostsErrorResponse
from services.linkedin_comment_assistant_cache_service import mask_user_id
from services.linkedin_comment_assistant_draft_service import (
    CommentAssistantDraftError,
    draft_comment_reply,
)

router = APIRouter(prefix="/api/linkedin", tags=["LinkedIn Comment Assistant"])


def _user_id(current_user: dict) -> str:
    uid = current_user.get("id") if current_user else None
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return str(uid)


@router.post(
    "/comment-assistant/draft-reply",
    response_model=CommentAssistantDraftReplyResponse,
    responses={
        401: {"model": PostsErrorResponse},
        400: {"model": PostsErrorResponse},
        429: {"model": PostsErrorResponse},
        502: {"model": PostsErrorResponse},
        503: {"model": PostsErrorResponse},
    },
    summary="Draft a reply to a LinkedIn comment with ALwrity",
    description=(
        "Reads the original post and the received comment and drafts a reply "
        "in the user's voice. No research/grounding is performed for this fast reply flow."
    ),
)
async def post_comment_draft_reply(
    body: CommentAssistantDraftReplyRequest,
    current_user: dict = Depends(get_current_user),
) -> CommentAssistantDraftReplyResponse:
    """Draft a LinkedIn comment reply using ALwrity (Issue #188)."""
    user_id = _user_id(current_user)
    logger.info(
        "[CommentAssistant] POST draft-reply user={} social_id_suffix={} comment_id_suffix={}",
        mask_user_id(user_id),
        body.social_id[-20:] if body.social_id else "(none)",
        body.comment_id[-20:] if body.comment_id else "(none)",
    )
    try:
        result = await draft_comment_reply(body, user_id)
        if result.success:
            logger.info(
                "[CommentAssistant] POST draft-reply ok user={} reply_len={}",
                mask_user_id(user_id),
                len(result.reply or ""),
            )
        else:
            logger.warning(
                "[CommentAssistant] POST draft-reply business error user={} error={}",
                mask_user_id(user_id),
                result.generation_metadata.get("error_code")
                if result.generation_metadata
                else None,
            )
        return result
    except CommentAssistantDraftError as exc:
        logger.warning(
            "[CommentAssistant] POST draft-reply error user={} code={}: {}",
            mask_user_id(user_id),
            exc.error_code,
            str(exc)[:200],
        )
        status_code = (
            status.HTTP_400_BAD_REQUEST
            if exc.error_code == "validation_error"
            else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(
            status_code=status_code,
            detail={
                "error_code": exc.error_code.upper(),
                "message": str(exc),
            },
        ) from exc
    except Exception as exc:
        logger.exception(
            "[CommentAssistant] POST draft-reply unexpected error user={}",
            mask_user_id(user_id),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred while drafting the reply.",
            },
        ) from exc
