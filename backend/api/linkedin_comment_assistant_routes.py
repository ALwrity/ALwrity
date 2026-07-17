"""
Comment Assistant inbox API — thin routes for Issue #73.

Delegates aggregation and Unipile reactions to linkedin_comment_assistant_service.
Reply / load-more remain on existing post-comments routes.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger
from sqlalchemy.orm import Session

from middleware.auth_middleware import get_current_user
from models.linkedin_comment_assistant_models import (
    CommentAssistantInboxResponse,
    CommentAssistantLikeRequest,
    CommentAssistantLikeResponse,
)
from models.linkedin_posts_models import PostsErrorResponse
from services.database import get_db
from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.integrations.linkedin.unipile_client import UnipileAPIError
from services.linkedin_comment_assistant_service import (
    get_comment_assistant_inbox,
    like_comment,
)
from services.linkedin_post_comments_service import (
    LinkedInPostCommentsNotAvailableError,
    LinkedInPostCommentsValidationError,
)


router = APIRouter(prefix="/api/linkedin", tags=["LinkedIn Comment Assistant"])

PriorityQuery = Literal["needs_reply", "active", "older", "all"]


def _user_id(current_user: dict) -> str:
    uid = current_user.get("id") if current_user else None
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return str(uid)


def _raise_inbox_http_error(exc: Exception, *, user_id: str, operation: str) -> None:
    """Map Comment Assistant failures to structured HTTP responses (no mocks)."""
    if isinstance(exc, LinkedInPostCommentsNotAvailableError):
        logger.warning(
            "[CommentAssistant] {} unavailable user_id={}: {}",
            operation,
            user_id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error_code": "PROVIDER_NOT_AVAILABLE",
                "message": str(exc),
            },
        ) from exc

    if isinstance(exc, LinkedInNotConnectedError):
        logger.warning(
            "[CommentAssistant] {} not connected user_id={}: {}",
            operation,
            user_id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error_code": "NOT_CONNECTED",
                "message": "Connect LinkedIn to load Comment Assistant.",
            },
        ) from exc

    if isinstance(exc, LinkedInPostCommentsValidationError):
        logger.warning(
            "[CommentAssistant] {} validation user_id={}: {}",
            operation,
            user_id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "VALIDATION_ERROR", "message": str(exc)},
        ) from exc

    if isinstance(exc, UnipileAPIError):
        message = str(exc).lower()
        http_status = exc.status_code
        if http_status == 429:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error_code": "RATE_LIMITED",
                    "message": "LinkedIn rate limit reached. Please try again shortly.",
                },
            ) from exc
        if http_status == 401 or "disconnected" in message or "reconnect" in message:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error_code": "RECONNECT_REQUIRED",
                    "message": "LinkedIn session expired. Reconnect your account and try again.",
                },
            ) from exc
        if http_status == 403:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "UNIPILE_FORBIDDEN",
                    "message": str(exc),
                },
            ) from exc
        if http_status == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error_code": "NOT_FOUND",
                    "message": "Comment or post not found. Verify identifiers and try again.",
                },
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error_code": "UNIPILE_ERROR", "message": str(exc)},
        ) from exc

    logger.exception(
        "[CommentAssistant] {} unexpected error user_id={}: {}",
        operation,
        user_id,
        exc,
    )
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail={
            "error_code": "INTERNAL_ERROR",
            "message": "An unexpected error occurred in Comment Assistant.",
        },
    ) from exc


@router.get(
    "/comment-assistant/inbox",
    response_model=CommentAssistantInboxResponse,
    responses={
        401: {"model": PostsErrorResponse},
        403: {"model": PostsErrorResponse},
        429: {"model": PostsErrorResponse},
        502: {"model": PostsErrorResponse},
        503: {"model": PostsErrorResponse},
    },
    summary="Comment Assistant inbox (comments on your posts)",
    description=(
        "Aggregates comments across recent posts with comments>0 from post analytics. "
        "Classifies Needs reply / Active / Older. Soft-fails per post. "
        "Requires LINKEDIN_PROVIDER=unipile and a connected LinkedIn account."
    ),
)
async def get_inbox(
    priority: PriorityQuery = Query(
        "needs_reply",
        description="needs_reply | active | older | all",
    ),
    refresh: bool = Query(
        False,
        description="Reserved for cache bust (Phase 4); Phase 2 always loads comments live",
    ),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommentAssistantInboxResponse:
    """Return post-grouped inbox comments for the connected user."""
    user_id = _user_id(current_user)
    logger.info(
        "[CommentAssistant] GET inbox user_id={} priority={} refresh={}",
        user_id,
        priority,
        refresh,
    )
    try:
        return await get_comment_assistant_inbox(
            user_id,
            db,
            priority=priority,
            refresh=refresh,
        )
    except (
        LinkedInPostCommentsNotAvailableError,
        LinkedInNotConnectedError,
        LinkedInPostCommentsValidationError,
        UnipileAPIError,
    ) as exc:
        _raise_inbox_http_error(exc, user_id=user_id, operation="inbox")
    except Exception as exc:
        _raise_inbox_http_error(exc, user_id=user_id, operation="inbox")


@router.post(
    "/comment-assistant/comments/{comment_id}/like",
    response_model=CommentAssistantLikeResponse,
    responses={
        401: {"model": PostsErrorResponse},
        403: {"model": PostsErrorResponse},
        404: {"model": PostsErrorResponse},
        429: {"model": PostsErrorResponse},
        502: {"model": PostsErrorResponse},
        503: {"model": PostsErrorResponse},
    },
    summary="Like a comment on one of your posts",
    description=(
        "Proxy Unipile POST /api/v1/posts/reaction with comment_id. "
        "Body must include post_social_id (LinkedIn social_id)."
    ),
)
async def post_comment_like(
    comment_id: str,
    body: CommentAssistantLikeRequest,
    current_user: dict = Depends(get_current_user),
) -> CommentAssistantLikeResponse:
    """Like a comment via Unipile v1 reaction endpoint."""
    user_id = _user_id(current_user)
    logger.info(
        "[CommentAssistant] POST like user_id={} comment_id={}",
        user_id,
        comment_id,
    )
    try:
        return await like_comment(
            user_id,
            comment_id,
            body.post_social_id,
            reaction_type=body.reaction_type,
        )
    except (
        LinkedInPostCommentsNotAvailableError,
        LinkedInNotConnectedError,
        LinkedInPostCommentsValidationError,
        UnipileAPIError,
    ) as exc:
        _raise_inbox_http_error(exc, user_id=user_id, operation="like_comment")
    except Exception as exc:
        _raise_inbox_http_error(exc, user_id=user_id, operation="like_comment")
