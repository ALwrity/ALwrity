"""Comment Assistant Unipile comment reactions (like / celebrate / …)."""

from __future__ import annotations

from typing import Optional

from loguru import logger

from models.linkedin_comment_assistant_models import CommentAssistantLikeResponse
from services.integrations.linkedin.unipile_post_comments_client import (
    UnipilePostCommentsClient,
)
from services.integrations.linkedin_oauth import LinkedInOAuthService
from services.linkedin_comment_assistant_cache_service import mask_user_id
from services.linkedin_post_comments_service import (
    LinkedInPostCommentsValidationError,
    _ensure_unipile_provider,
    _resolve_account_id,
)


async def like_comment(
    user_id: str,
    comment_id: str,
    post_social_id: str,
    *,
    reaction_type: str = "like",
    oauth: Optional[LinkedInOAuthService] = None,
) -> CommentAssistantLikeResponse:
    """Like a comment via Unipile v1 ``POST /api/v1/posts/reaction`` + comment_id."""
    _ensure_unipile_provider()
    parent_id = (comment_id or "").strip()
    if not parent_id:
        raise LinkedInPostCommentsValidationError("comment_id is required to like.")

    social_id = (post_social_id or "").strip()
    if not social_id:
        raise LinkedInPostCommentsValidationError(
            "post_social_id is required to like a comment."
        )

    oauth_service = oauth or LinkedInOAuthService()
    account_id = _resolve_account_id(user_id, oauth_service)
    normalized_type = (reaction_type or "like").strip().lower() or "like"

    logger.info(
        "[CommentAssistant] Unipile like start user={} comment_id={} social_id={} type={}",
        mask_user_id(user_id),
        parent_id,
        social_id,
        normalized_type,
    )

    client = UnipilePostCommentsClient()
    try:
        await client.add_post_reaction(
            account_id,
            social_id,
            comment_id=parent_id,
            reaction_type=normalized_type,
        )
    except ValueError as exc:
        logger.warning(
            "[CommentAssistant] Unipile like validation user={} err={}",
            mask_user_id(user_id),
            exc,
        )
        raise LinkedInPostCommentsValidationError(str(exc)) from exc
    except Exception:
        logger.warning(
            "[CommentAssistant] Unipile like fail user={} comment_id={} social_id={}",
            mask_user_id(user_id),
            parent_id,
            social_id,
        )
        raise

    logger.info(
        "[CommentAssistant] Unipile like ok user={} comment_id={} type={}",
        mask_user_id(user_id),
        parent_id,
        normalized_type,
    )
    return CommentAssistantLikeResponse(
        success=True,
        comment_id=parent_id,
        reaction_type=normalized_type,
    )
