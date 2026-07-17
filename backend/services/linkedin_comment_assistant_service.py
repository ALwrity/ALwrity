"""
Comment Assistant inbox aggregation (Issue #73).

Selects capped posts with comments from post-analytics cache, lists Unipile
comments with limited concurrency, classifies Needs reply / Active / Older.
Soft-fails per post so one Unipile error never blanks the whole inbox.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from loguru import logger
from sqlalchemy.orm import Session

from models.linkedin_comment_assistant_models import (
    CommentAssistantCommentItem,
    CommentAssistantInboxResponse,
    CommentAssistantLikeResponse,
    CommentAssistantPostGroup,
    CommentAssistantPriority,
)
from models.linkedin_post_comments_models import PostCommentAuthor
from models.linkedin_posts_models import LinkedInPost
from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.integrations.linkedin.unipile_client import (
    UnipileAPIError,
    UnipileClient,
    personal_profile_provider_id_from_owner,
)
from services.integrations.linkedin.unipile_post_comments_client import (
    UnipilePostCommentsClient,
)
from services.integrations.linkedin_oauth import LinkedInOAuthService
from services.linkedin_post_analytics_service import LinkedInPostAnalyticsService
from services.linkedin_post_comments_service import (
    LinkedInPostCommentsNotAvailableError,
    LinkedInPostCommentsValidationError,
    _ensure_unipile_provider,
    _iso_timestamp,
    _resolve_account_id,
)

# Guardrails from the implementation plan (safe Unipile fan-out).
MAX_POSTS = 12
COMMENTS_PER_POST = 15
MAX_REPLY_CHECKS_PER_POST = 5
POST_CONCURRENCY = 3
OLDER_DAYS = 14
POST_SNIPPET_LEN = 160


def _parse_created_at(value: str) -> Optional[datetime]:
    """Best-effort parse of ISO / Unipile timestamps to aware UTC datetime."""
    raw = (value or "").strip()
    if not raw:
        return None
    try:
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


def _collect_me_ids(owner: dict[str, Any]) -> set[str]:
    """Identity keys used to detect comments/replies authored by the connected user."""
    ids: set[str] = set()
    provider_id = personal_profile_provider_id_from_owner(owner)
    if provider_id:
        ids.add(provider_id.lower())
    for key in ("public_identifier", "provider_id", "id", "entity_urn", "member_urn"):
        value = owner.get(key)
        if isinstance(value, str) and value.strip():
            ids.add(value.strip().lower())
    return ids


def _raw_author_id(raw: dict[str, Any]) -> Optional[str]:
    """Extract author id from Unipile comment shapes."""
    details = raw.get("author_details")
    if isinstance(details, dict):
        for key in ("id", "provider_id", "public_identifier"):
            value = details.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    author = raw.get("author")
    if isinstance(author, dict):
        for key in ("id", "provider_id", "public_identifier"):
            value = author.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    for key in ("author_id", "author_provider_id"):
        value = raw.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _raw_author_name(raw: dict[str, Any]) -> str:
    details = raw.get("author_details")
    if isinstance(details, dict) and details.get("name"):
        return str(details["name"])
    author = raw.get("author")
    if isinstance(author, str) and author.strip():
        return author.strip()
    if isinstance(author, dict):
        return str(
            author.get("name")
            or author.get("public_identifier")
            or author.get("provider_id")
            or "Unknown"
        )
    return "Unknown"


def _is_me(author_id: Optional[str], me_ids: set[str]) -> bool:
    if not author_id or not me_ids:
        return False
    return author_id.strip().lower() in me_ids


def _select_candidate_posts(posts: list[LinkedInPost]) -> list[LinkedInPost]:
    """Newest posts with social_id and comments > 0, capped."""
    candidates: list[LinkedInPost] = []
    for post in posts:
        social_id = (post.social_id or "").strip()
        if not social_id:
            continue
        if int(post.engagement.comments or 0) <= 0:
            continue
        candidates.append(post)
        if len(candidates) >= MAX_POSTS:
            break
    return candidates


def _post_snippet(text: str) -> str:
    cleaned = " ".join((text or "").split())
    if len(cleaned) <= POST_SNIPPET_LEN:
        return cleaned
    return cleaned[: POST_SNIPPET_LEN - 1].rstrip() + "…"


def _normalize_inbox_comment(
    raw: dict[str, Any],
    *,
    me_ids: set[str],
    older_cutoff: datetime,
    i_replied: bool,
) -> Optional[CommentAssistantCommentItem]:
    comment_id = raw.get("id") or raw.get("provider_id")
    if not comment_id:
        return None

    author_id = _raw_author_id(raw)
    created_at = _iso_timestamp(raw.get("date") or raw.get("created_at"))
    created_dt = _parse_created_at(created_at)
    reply_count = int(raw.get("reply_counter") or raw.get("child_comment_count") or 0)
    reaction_count = int(raw.get("reaction_counter") or raw.get("comment_like_count") or 0)
    user_reacted_raw = raw.get("user_reacted")
    user_reacted = str(user_reacted_raw) if user_reacted_raw else None
    if raw.get("has_liked_comment") is True and not user_reacted:
        user_reacted = "LIKE"

    details = raw.get("author_details") if isinstance(raw.get("author_details"), dict) else {}
    author = PostCommentAuthor(
        name=_raw_author_name(raw),
        headline=details.get("headline") if details else None,
        avatar_url=(
            details.get("profile_picture_url")
            if details
            else None
        ) or raw.get("picture_url"),
        profile_url=details.get("profile_url") if details else None,
    )

    # Skip own top-level comments from triage inbox.
    if _is_me(author_id, me_ids):
        return None

    is_older = bool(created_dt and created_dt < older_cutoff)
    if is_older:
        priority: str = "older"
        needs_reply = False
    elif i_replied:
        priority = "active"
        needs_reply = False
    else:
        priority = "needs_reply"
        needs_reply = True

    return CommentAssistantCommentItem(
        id=str(comment_id),
        text=str(raw.get("text") or ""),
        author=author,
        author_id=author_id,
        created_at=created_at,
        reply_count=reply_count,
        reaction_count=reaction_count,
        user_reacted=user_reacted,
        needs_reply=needs_reply,
        priority=priority,  # type: ignore[arg-type]
    )


async def _user_replied_in_thread(
    client: UnipilePostCommentsClient,
    account_id: str,
    social_id: str,
    parent_comment_id: str,
    me_ids: set[str],
) -> bool:
    """Best-effort: first page of replies includes an author matching me."""
    try:
        raw = await client.list_post_comments(
            account_id,
            social_id,
            limit=10,
            sort_by="MOST_RECENT",
            comment_id=parent_comment_id,
        )
    except Exception as exc:
        logger.warning(
            "[CommentAssistant] reply check failed social_id={} comment_id={}: {}",
            social_id,
            parent_comment_id,
            exc,
        )
        return False

    items = raw.get("items") if isinstance(raw, dict) else None
    if not isinstance(items, list):
        return False
    for item in items:
        if isinstance(item, dict) and _is_me(_raw_author_id(item), me_ids):
            return True
    return False


async def _load_post_group(
    client: UnipilePostCommentsClient,
    account_id: str,
    post: LinkedInPost,
    me_ids: set[str],
    older_cutoff: datetime,
    semaphore: asyncio.Semaphore,
) -> CommentAssistantPostGroup:
    social_id = (post.social_id or "").strip()
    snippet = _post_snippet(post.text)
    base = CommentAssistantPostGroup(
        post_id=post.id,
        social_id=social_id,
        post_snippet=snippet,
        comment_count_hint=int(post.engagement.comments or 0),
    )

    async with semaphore:
        logger.info(
            "[CommentAssistant] loading comments post_id={} social_id={}",
            post.id,
            social_id,
        )
        try:
            raw = await client.list_post_comments(
                account_id,
                social_id,
                limit=COMMENTS_PER_POST,
                sort_by="MOST_RECENT",
            )
        except Exception as exc:
            logger.warning(
                "[CommentAssistant] soft-fail list comments post_id={} social_id={}: {}",
                post.id,
                social_id,
                exc,
            )
            base.error = "Could not load comments for this post. Try again later."
            return base

    items_raw = raw.get("items") if isinstance(raw, dict) else None
    if not isinstance(items_raw, list):
        items_raw = []

    reply_checks = 0
    comments: list[CommentAssistantCommentItem] = []
    for item in items_raw:
        if not isinstance(item, dict):
            continue
        comment_id = str(item.get("id") or item.get("provider_id") or "")
        reply_count = int(item.get("reply_counter") or item.get("child_comment_count") or 0)
        i_replied = False
        if comment_id and reply_count > 0 and reply_checks < MAX_REPLY_CHECKS_PER_POST:
            reply_checks += 1
            i_replied = await _user_replied_in_thread(
                client, account_id, social_id, comment_id, me_ids
            )

        normalized = _normalize_inbox_comment(
            item,
            me_ids=me_ids,
            older_cutoff=older_cutoff,
            i_replied=i_replied,
        )
        if normalized:
            comments.append(normalized)

    cursor = raw.get("cursor") if isinstance(raw, dict) else None
    cursor_str = str(cursor) if cursor else None
    base.comments = comments
    base.has_more_comments = bool(cursor_str)
    base.comments_cursor = cursor_str
    return base


def _filter_groups_by_priority(
    groups: list[CommentAssistantPostGroup],
    priority: CommentAssistantPriority,
) -> list[CommentAssistantPostGroup]:
    if priority == "all":
        return groups

    filtered: list[CommentAssistantPostGroup] = []
    for group in groups:
        if group.error and not group.comments:
            # Keep soft-fail shells visible on every priority tab.
            filtered.append(group)
            continue
        matching = [c for c in group.comments if c.priority == priority]
        if matching or group.error:
            filtered.append(
                group.model_copy(update={"comments": matching})
            )
    return filtered


def _count_priorities(groups: list[CommentAssistantPostGroup]) -> dict[str, int]:
    counts = {"needs_reply": 0, "active": 0, "older": 0}
    for group in groups:
        for comment in group.comments:
            counts[comment.priority] = counts.get(comment.priority, 0) + 1
    return counts


async def get_comment_assistant_inbox(
    user_id: str,
    db: Session,
    *,
    priority: CommentAssistantPriority = "needs_reply",
    refresh: bool = False,
    oauth: Optional[LinkedInOAuthService] = None,
) -> CommentAssistantInboxResponse:
    """
    Build inbox payload from cached posts + live Unipile comment lists.

    ``refresh`` is reserved for Phase 4 cache busting; Phase 2 always loads
    comments live and re-reads the post-analytics cache.
    """
    _ensure_unipile_provider()
    oauth_service = oauth or LinkedInOAuthService()
    account_id = _resolve_account_id(user_id, oauth_service)

    analytics = LinkedInPostAnalyticsService(db)
    stored = analytics.get_stored_analytics(user_id)
    candidates = _select_candidate_posts(stored.posts)

    logger.info(
        "[CommentAssistant] inbox start user_id={} priority={} refresh={} "
        "stored_posts={} candidates={}",
        user_id,
        priority,
        refresh,
        len(stored.posts),
        len(candidates),
    )

    if not candidates:
        logger.info(
            "[CommentAssistant] inbox empty user_id={} (no posts with comments+social_id)",
            user_id,
        )
        return CommentAssistantInboxResponse(
            groups=[],
            priority=priority,
            posts_considered=0,
            older_days=OLDER_DAYS,
            counts={"needs_reply": 0, "active": 0, "older": 0},
        )

    client = UnipilePostCommentsClient()
    me_ids: set[str] = set()
    try:
        owner = await UnipileClient().get_own_profile(account_id)
        me_ids = _collect_me_ids(owner if isinstance(owner, dict) else {})
        logger.info(
            "[CommentAssistant] resolved me_ids_count={} user_id={}",
            len(me_ids),
            user_id,
        )
    except Exception as exc:
        logger.warning(
            "[CommentAssistant] get_own_profile failed user_id={}: {} "
            "(classification will be best-effort without self ids)",
            user_id,
            exc,
        )

    older_cutoff = datetime.now(timezone.utc) - timedelta(days=OLDER_DAYS)
    semaphore = asyncio.Semaphore(POST_CONCURRENCY)
    groups = await asyncio.gather(
        *[
            _load_post_group(
                client, account_id, post, me_ids, older_cutoff, semaphore
            )
            for post in candidates
        ]
    )

    all_groups = list(groups)
    counts = _count_priorities(all_groups)
    filtered = _filter_groups_by_priority(all_groups, priority)

    logger.info(
        "[CommentAssistant] inbox done user_id={} groups={} filtered={} counts={}",
        user_id,
        len(all_groups),
        len(filtered),
        counts,
    )
    return CommentAssistantInboxResponse(
        groups=filtered,
        priority=priority,
        posts_considered=len(candidates),
        older_days=OLDER_DAYS,
        counts=counts,
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
        "[CommentAssistant] like_comment user_id={} comment_id={} social_id={} type={}",
        user_id,
        parent_id,
        social_id,
        normalized_type,
    )

    client = UnipilePostCommentsClient()
    await client.add_post_reaction(
        account_id,
        social_id,
        comment_id=parent_id,
        reaction_type=normalized_type,
    )
    return CommentAssistantLikeResponse(
        success=True,
        comment_id=parent_id,
        reaction_type=normalized_type,
    )


# Re-export errors used by routes for a single import surface.
__all__ = [
    "get_comment_assistant_inbox",
    "like_comment",
    "LinkedInPostCommentsNotAvailableError",
    "LinkedInPostCommentsValidationError",
    "LinkedInNotConnectedError",
    "UnipileAPIError",
]
