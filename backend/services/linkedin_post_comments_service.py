"""
LinkedIn post comments service — Unipile proxy with normalized responses.

Requires LINKEDIN_PROVIDER=unipile. Resolves the user's connected account and
maps Unipile CommentList items to stable ALwrity schema for the frontend.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Optional

from loguru import logger

from models.linkedin_post_comments_models import (
    PostCommentAuthor,
    PostCommentItem,
    PostCommentReplyResponse,
    PostCommentsListResponse,
)
from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.integrations.linkedin.unipile_post_comments_client import (
    UnipilePostCommentsClient,
)
from services.integrations.linkedin_oauth import LinkedInOAuthService


class LinkedInPostCommentsNotAvailableError(RuntimeError):
    """Raised when post comments require Unipile but another provider is active."""


class LinkedInPostCommentsValidationError(ValueError):
    """Raised when comment request parameters are invalid."""


def _ensure_unipile_provider() -> None:
    """Require LINKEDIN_PROVIDER=unipile for comment operations."""
    mode = os.getenv("LINKEDIN_PROVIDER", "zernio").lower()
    if mode != "unipile":
        logger.warning(
            "[PostComments] unavailable provider_mode={} (requires unipile)",
            mode,
        )
        raise LinkedInPostCommentsNotAvailableError(
            "LinkedIn post comments are only available when LINKEDIN_PROVIDER=unipile."
        )


def _resolve_account_id(user_id: str, oauth: LinkedInOAuthService) -> str:
    """Resolve Unipile account id for the authenticated user."""
    connection_status = oauth.get_connection_status(user_id)
    if not connection_status.get("connected"):
        raise LinkedInNotConnectedError(
            "LinkedIn account not connected. Please connect your LinkedIn account first."
        )

    creds = oauth.resolve_credentials(user_id)
    account_id = creds.unipile_account_id or creds.primary_account_id
    if not account_id:
        raise LinkedInNotConnectedError(
            "No Unipile LinkedIn account connected. "
            "Connect via hosted OAuth before loading post comments."
        )
    return account_id


def _require_social_id(social_id: str) -> str:
    """Validate LinkedIn post social_id required by Unipile comments API."""
    normalized = (social_id or "").strip()
    if not normalized:
        raise LinkedInPostCommentsValidationError(
            "Post social_id is required to load comments. "
            "Re-sync post analytics to refresh post identifiers."
        )
    return normalized


def _iso_timestamp(value: Any) -> str:
    """Convert Unipile date fields to ISO-8601 UTC string."""
    if value is None:
        return ""
    if isinstance(value, str) and value.strip():
        return value.strip()
    if isinstance(value, (int, float)):
        try:
            dt = datetime.fromtimestamp(float(value), tz=timezone.utc)
            return dt.isoformat().replace("+00:00", "Z")
        except (OSError, OverflowError, ValueError):
            return str(value)
    return str(value)


def _normalize_comment_item(raw: dict[str, Any]) -> Optional[PostCommentItem]:
    """Map Unipile Comment (LinkedIn or Instagram shape) to PostCommentItem."""
    if not isinstance(raw, dict):
        return None

    comment_id = raw.get("id") or raw.get("provider_id")
    if not comment_id:
        return None

    text = raw.get("text") or ""
    created_at = _iso_timestamp(raw.get("date") or raw.get("created_at"))

    reply_count = 0
    reaction_count = 0
    author_name = "Unknown"
    headline: Optional[str] = None
    avatar_url: Optional[str] = None
    profile_url: Optional[str] = None

    # LinkedIn shape: author string + author_details object
    author_details = raw.get("author_details")
    if isinstance(author_details, dict):
        headline = author_details.get("headline")
        avatar_url = author_details.get("profile_picture_url") or raw.get("picture_url")
        profile_url = author_details.get("profile_url")
        author_name = (
            (raw.get("author") if isinstance(raw.get("author"), str) else None)
            or author_details.get("name")
            or "Unknown"
        )
        reply_count = int(raw.get("reply_counter") or 0)
        reaction_count = int(raw.get("reaction_counter") or 0)
    else:
        # Instagram-style shape: author object
        author_obj = raw.get("author")
        if isinstance(author_obj, dict):
            avatar_url = author_obj.get("profile_pic_url")
            author_name = (
                author_obj.get("public_identifier")
                or author_obj.get("provider_id")
                or "Unknown"
            )
            if author_obj.get("public_identifier"):
                profile_url = f"https://www.instagram.com/{author_obj['public_identifier']}/"
        elif isinstance(raw.get("author"), str):
            author_name = raw["author"]

        reply_count = int(raw.get("child_comment_count") or raw.get("reply_counter") or 0)
        reaction_count = int(
            raw.get("comment_like_count") or raw.get("reaction_counter") or 0
        )

    return PostCommentItem(
        id=str(comment_id),
        text=str(text),
        author=PostCommentAuthor(
            name=str(author_name),
            headline=headline,
            avatar_url=avatar_url,
            profile_url=profile_url,
        ),
        created_at=created_at,
        reply_count=reply_count,
        reaction_count=reaction_count,
    )


def _normalize_comment_list(data: dict[str, Any]) -> PostCommentsListResponse:
    """Build PostCommentsListResponse from raw Unipile CommentList."""
    items_raw = data.get("items")
    items: list[PostCommentItem] = []
    if isinstance(items_raw, list):
        for raw in items_raw:
            if isinstance(raw, dict):
                normalized = _normalize_comment_item(raw)
                if normalized:
                    items.append(normalized)

    cursor = data.get("cursor")
    cursor_str = str(cursor) if cursor else None
    total_count = data.get("total_items")
    if total_count is None:
        paging = data.get("paging")
        if isinstance(paging, dict):
            total_count = paging.get("total_count")

    return PostCommentsListResponse(
        items=items,
        cursor=cursor_str,
        has_more=bool(cursor_str),
        total_count=int(total_count) if total_count is not None else None,
    )


async def list_comments(
    user_id: str,
    social_id: str,
    *,
    cursor: Optional[str] = None,
    limit: int = 20,
    sort_by: str = "MOST_RECENT",
    oauth: Optional[LinkedInOAuthService] = None,
) -> PostCommentsListResponse:
    """List comments for a post via Unipile."""
    _ensure_unipile_provider()
    resolved_social_id = _require_social_id(social_id)
    oauth_service = oauth or LinkedInOAuthService()
    account_id = _resolve_account_id(user_id, oauth_service)

    client = UnipilePostCommentsClient()
    raw = await client.list_post_comments(
        account_id,
        resolved_social_id,
        cursor=cursor,
        limit=limit,
        sort_by=sort_by,
    )
    return _normalize_comment_list(raw)


async def reply_to_comment(
    user_id: str,
    social_id: str,
    comment_id: str,
    text: str,
    *,
    oauth: Optional[LinkedInOAuthService] = None,
) -> PostCommentReplyResponse:
    """Reply to a comment on a post via Unipile."""
    _ensure_unipile_provider()
    resolved_social_id = _require_social_id(social_id)
    parent_id = (comment_id or "").strip()
    if not parent_id:
        raise LinkedInPostCommentsValidationError("comment_id is required to reply.")

    trimmed = (text or "").strip()
    if not trimmed:
        raise LinkedInPostCommentsValidationError("Reply text is required.")
    if len(trimmed) > 1250:
        raise LinkedInPostCommentsValidationError(
            "Reply text must be 1250 characters or fewer."
        )

    oauth_service = oauth or LinkedInOAuthService()
    account_id = _resolve_account_id(user_id, oauth_service)

    client = UnipilePostCommentsClient()
    raw = await client.send_post_comment(
        account_id,
        resolved_social_id,
        trimmed,
        comment_id=parent_id,
    )
    new_id = raw.get("comment_id") if isinstance(raw, dict) else None
    return PostCommentReplyResponse(success=True, comment_id=str(new_id) if new_id else None)
