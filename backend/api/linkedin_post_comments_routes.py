"""
LinkedIn post comments API routes — Unipile proxy for Engagement Trends.

Thin routes delegating to linkedin_post_comments_service. Kept separate from
linkedin_post_analytics_routes.py to avoid further growth of that module.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger

from middleware.auth_middleware import get_current_user
from models.linkedin_post_comments_models import (
    PostCommentReplyRequest,
    PostCommentReplyResponse,
    PostCommentsListResponse,
)
from models.linkedin_posts_models import PostsErrorResponse
from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.integrations.linkedin.unipile_client import UnipileAPIError
from services.linkedin_post_comments_service import (
    LinkedInPostCommentsNotAvailableError,
    LinkedInPostCommentsValidationError,
    list_comments,
    reply_to_comment,
)


router = APIRouter(prefix="/api/linkedin", tags=["LinkedIn Post Comments"])


def _user_id(current_user: dict) -> str:
    uid = current_user.get("id") if current_user else None
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return str(uid)


def _raise_comments_http_error(exc: Exception, *, user_id: str, operation: str) -> None:
    """Map comment service failures to HTTP responses."""
    if isinstance(exc, LinkedInPostCommentsNotAvailableError):
        logger.warning(
            "[PostComments] {} unavailable user_id={}: {}",
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
            "[PostComments] {} not connected user_id={}: {}",
            operation,
            user_id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error_code": "NOT_CONNECTED",
                "message": "Could not load comments. Connect LinkedIn and try again.",
            },
        ) from exc

    if isinstance(exc, LinkedInPostCommentsValidationError):
        logger.warning(
            "[PostComments] {} validation user_id={}: {}",
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
                    "message": "LinkedIn comment rate limit reached. Please try again shortly.",
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
                    "error_code": "POST_NOT_FOUND",
                    "message": "Post or comments not found. Verify social_id and try again.",
                },
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error_code": "UNIPILE_ERROR", "message": str(exc)},
        ) from exc

    logger.exception(
        "[PostComments] {} unexpected error user_id={}: {}",
        operation,
        user_id,
        exc,
    )
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail={
            "error_code": "INTERNAL_ERROR",
            "message": "An unexpected error occurred while processing post comments.",
        },
    ) from exc


@router.get(
    "/post-analytics/posts/{social_id}/comments",
    response_model=PostCommentsListResponse,
    responses={
        401: {"model": PostsErrorResponse},
        403: {"model": PostsErrorResponse},
        404: {"model": PostsErrorResponse},
        429: {"model": PostsErrorResponse},
        502: {"model": PostsErrorResponse},
    },
    summary="List comments on a LinkedIn post",
    description=(
        "Proxy Unipile GET /api/v1/posts/{social_id}/comments. "
        "Pass comment_id to list nested replies under a parent comment. "
        "Requires LINKEDIN_PROVIDER=unipile and a connected LinkedIn account."
    ),
)
async def get_post_comments(
    social_id: str,
    cursor: Optional[str] = Query(None, description="Pagination cursor"),
    limit: int = Query(20, ge=1, le=100, description="Comments per page"),
    sort_by: str = Query("MOST_RECENT", description="MOST_RECENT or MOST_RELEVANT"),
    comment_id: Optional[str] = Query(
        None,
        description="When set, list replies under this parent comment id",
    ),
    current_user: dict = Depends(get_current_user),
) -> PostCommentsListResponse:
    """List comments for a post by Unipile social_id (or replies when comment_id is set)."""
    user_id = _user_id(current_user)
    try:
        return await list_comments(
            user_id,
            social_id,
            cursor=cursor,
            limit=limit,
            sort_by=sort_by,
            comment_id=comment_id,
        )
    except (LinkedInPostCommentsNotAvailableError, LinkedInNotConnectedError, LinkedInPostCommentsValidationError, UnipileAPIError) as exc:
        _raise_comments_http_error(exc, user_id=user_id, operation="list_comments")
    except Exception as exc:
        _raise_comments_http_error(exc, user_id=user_id, operation="list_comments")


@router.post(
    "/post-analytics/posts/{social_id}/comments/reply",
    response_model=PostCommentReplyResponse,
    responses={
        401: {"model": PostsErrorResponse},
        403: {"model": PostsErrorResponse},
        404: {"model": PostsErrorResponse},
        429: {"model": PostsErrorResponse},
        502: {"model": PostsErrorResponse},
    },
    summary="Reply to a comment on a LinkedIn post",
    description=(
        "Proxy Unipile POST /api/v1/posts/{social_id}/comments with comment_id. "
        "Requires LINKEDIN_PROVIDER=unipile and a connected LinkedIn account."
    ),
)
async def post_comment_reply(
    social_id: str,
    body: PostCommentReplyRequest,
    current_user: dict = Depends(get_current_user),
) -> PostCommentReplyResponse:
    """Reply to a comment on a LinkedIn post."""
    user_id = _user_id(current_user)
    try:
        return await reply_to_comment(
            user_id,
            social_id,
            body.comment_id,
            body.text,
            mentions=body.mentions,
        )
    except (LinkedInPostCommentsNotAvailableError, LinkedInNotConnectedError, LinkedInPostCommentsValidationError, UnipileAPIError) as exc:
        _raise_comments_http_error(exc, user_id=user_id, operation="reply_to_comment")
    except Exception as exc:
        _raise_comments_http_error(exc, user_id=user_id, operation="reply_to_comment")
