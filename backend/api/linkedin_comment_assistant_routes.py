"""
Comment Assistant inbox API — thin routes for Issue #73.

Delegates aggregation and Unipile reactions to linkedin_comment_assistant_service.
Reply / load-more remain on existing post-comments routes.
"""

from __future__ import annotations

import json
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from loguru import logger
from sqlalchemy.orm import Session

from middleware.auth_middleware import get_current_user
from models.linkedin_comment_assistant_models import (
    CommentAssistantInboxResponse,
    CommentAssistantLikeRequest,
    CommentAssistantLikeResponse,
)
from models.linkedin_post_comments_models import (
    PostCommentMention,
    PostCommentReplyResponse,
)
from models.linkedin_posts_models import PostsErrorResponse
from services.database import get_db
from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.integrations.linkedin.unipile_client import UnipileAPIError
from services.linkedin_comment_assistant_cache_service import (
    LinkedInCommentAssistantCacheService,
    mask_user_id,
)
from services.linkedin_comment_assistant_inbox import get_comment_assistant_inbox
from services.linkedin_comment_assistant_service import like_comment
from services.linkedin_post_comments_service import (
    LinkedInPostCommentsNotAvailableError,
    LinkedInPostCommentsValidationError,
    reply_to_comment,
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
    uid = mask_user_id(user_id)
    if isinstance(exc, LinkedInPostCommentsNotAvailableError):
        logger.warning(
            "[CommentAssistant] {} unavailable user={}: {}",
            operation,
            uid,
            type(exc).__name__,
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
            "[CommentAssistant] {} not_connected user={}",
            operation,
            uid,
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
            "[CommentAssistant] {} validation user={} message={}",
            operation,
            uid,
            str(exc)[:200],
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "VALIDATION_ERROR", "message": str(exc)},
        ) from exc

    if isinstance(exc, UnipileAPIError):
        message = str(exc).lower()
        http_status = exc.status_code
        logger.warning(
            "[CommentAssistant] {} unipile_error user={} status={}",
            operation,
            uid,
            http_status,
        )
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
                    "message": "LinkedIn denied this action. Try again or reconnect.",
                },
            ) from exc
        if http_status == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error_code": "NOT_FOUND",
                    "message": "Comment or post not found. Sync comments and try again.",
                },
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "error_code": "UNIPILE_ERROR",
                "message": "Unable to reach LinkedIn for Comment Assistant. Please try again.",
            },
        ) from exc

    logger.exception(
        "[CommentAssistant] {} unexpected error user={}",
        operation,
        uid,
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
        description="Bypass workspace cache and refetch comments from LinkedIn (Sync)",
    ),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommentAssistantInboxResponse:
    """Return post-grouped inbox comments for the connected user."""
    user_id = _user_id(current_user)
    logger.info(
        "[CommentAssistant] GET inbox user={} priority={} refresh={}",
        mask_user_id(user_id),
        priority,
        refresh,
    )
    try:
        result = await get_comment_assistant_inbox(
            user_id,
            db,
            priority=priority,
            refresh=refresh,
        )
        logger.info(
            "[CommentAssistant] GET inbox ok user={} from_cache={} groups={} counts={}",
            mask_user_id(user_id),
            result.from_cache,
            len(result.groups),
            result.counts,
        )
        return result
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
    "/comment-assistant/posts/{social_id}/comments/reply",
    response_model=PostCommentReplyResponse,
    responses={
        401: {"model": PostsErrorResponse},
        403: {"model": PostsErrorResponse},
        404: {"model": PostsErrorResponse},
        429: {"model": PostsErrorResponse},
        502: {"model": PostsErrorResponse},
        503: {"model": PostsErrorResponse},
    },
    summary="Reply to a comment (mentions + optional image)",
    description=(
        "Multipart reply with optional LinkedIn mentions and one image attachment. "
        "Text may use {{0}} placeholders matching the mentions JSON array."
    ),
)
async def post_inbox_comment_reply(
    social_id: str,
    comment_id: str = Form(...),
    text: str = Form(...),
    mentions: Optional[str] = Form(
        None,
        description='JSON array of {"name","profile_id"} objects',
    ),
    attachment: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostCommentReplyResponse:
    """Reply with Unipile mentions and optional image (Comment Assistant)."""
    user_id = _user_id(current_user)
    mention_models: list[PostCommentMention] = []
    if mentions and mentions.strip():
        try:
            raw_mentions = json.loads(mentions)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error_code": "VALIDATION_ERROR",
                    "message": "mentions must be a valid JSON array.",
                },
            ) from exc
        if isinstance(raw_mentions, list):
            for item in raw_mentions:
                if isinstance(item, dict) and item.get("name") and item.get("profile_id"):
                    mention_models.append(
                        PostCommentMention(
                            name=str(item["name"]),
                            profile_id=str(item["profile_id"]),
                        )
                    )

    attachment_tuple = None
    if attachment is not None and attachment.filename:
        content = await attachment.read()
        if content:
            if len(content) > 5 * 1024 * 1024:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "error_code": "VALIDATION_ERROR",
                        "message": "Image must be 5MB or smaller.",
                    },
                )
            content_type = attachment.content_type or "image/jpeg"
            attachment_tuple = (attachment.filename, content, content_type)

    logger.info(
        "[CommentAssistant] POST reply user={} social_id={} comment_id={} "
        "mentions={} has_attachment={}",
        mask_user_id(user_id),
        social_id,
        comment_id,
        len(mention_models),
        attachment_tuple is not None,
    )
    try:
        result = await reply_to_comment(
            user_id,
            social_id,
            comment_id,
            text,
            mentions=mention_models or None,
            attachment=attachment_tuple,
        )
        # Reply changes thread classification — invalidate so next load rebuilds.
        LinkedInCommentAssistantCacheService(db).clear(user_id)
        logger.info(
            "[CommentAssistant] POST reply ok user={} comment_id={} cache_cleared=true",
            mask_user_id(user_id),
            comment_id,
        )
        return result
    except (
        LinkedInPostCommentsNotAvailableError,
        LinkedInNotConnectedError,
        LinkedInPostCommentsValidationError,
        UnipileAPIError,
    ) as exc:
        logger.warning(
            "[CommentAssistant] POST reply fail user={} comment_id={}",
            mask_user_id(user_id),
            comment_id,
        )
        _raise_inbox_http_error(exc, user_id=user_id, operation="reply_comment")
    except Exception as exc:
        logger.warning(
            "[CommentAssistant] POST reply fail user={} comment_id={}",
            mask_user_id(user_id),
            comment_id,
        )
        _raise_inbox_http_error(exc, user_id=user_id, operation="reply_comment")


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
    db: Session = Depends(get_db),
) -> CommentAssistantLikeResponse:
    """Like a comment via Unipile v1 reaction endpoint."""
    user_id = _user_id(current_user)
    logger.info(
        "[CommentAssistant] POST like user={} comment_id={}",
        mask_user_id(user_id),
        comment_id,
    )
    try:
        result = await like_comment(
            user_id,
            comment_id,
            body.post_social_id,
            reaction_type=body.reaction_type,
        )
        LinkedInCommentAssistantCacheService(db).patch_reaction(
            user_id,
            comment_id,
            result.reaction_type,
        )
        logger.info(
            "[CommentAssistant] POST like ok user={} comment_id={} type={}",
            mask_user_id(user_id),
            comment_id,
            result.reaction_type,
        )
        return result
    except (
        LinkedInPostCommentsNotAvailableError,
        LinkedInNotConnectedError,
        LinkedInPostCommentsValidationError,
        UnipileAPIError,
    ) as exc:
        logger.warning(
            "[CommentAssistant] POST like fail user={} comment_id={}",
            mask_user_id(user_id),
            comment_id,
        )
        _raise_inbox_http_error(exc, user_id=user_id, operation="like_comment")
    except Exception as exc:
        logger.warning(
            "[CommentAssistant] POST like fail user={} comment_id={}",
            mask_user_id(user_id),
            comment_id,
        )
        _raise_inbox_http_error(exc, user_id=user_id, operation="like_comment")
