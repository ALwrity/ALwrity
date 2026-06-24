"""
LinkedIn posts/articles acquisition — fetch, normalize, optional persist.

Composes existing Unipile OAuth/client code without modifying those modules.
"""

from __future__ import annotations

from typing import Any, Callable, Optional

from loguru import logger
from sqlalchemy.orm import Session

from services.integrations.linkedin.linkedin_posts_client import LinkedInPostsClient
from services.integrations.linkedin.linkedin_posts_normalizer import (
    normalize_unipile_post,
    normalize_unipile_posts,
)
from services.integrations.linkedin.linkedin_posts_storage import persist_fetched_posts
from services.integrations.linkedin.linkedin_posts_types import FetchPostsResult
from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.integrations.linkedin.unipile_client import (
    UnipileAPIError,
    profile_identifier_from_owner,
)
from services.integrations.linkedin_oauth import LinkedInOAuthService


async def resolve_post_list_identifier(
    client: LinkedInPostsClient,
    account_id: str,
    identifier: Optional[str] = None,
) -> str:
    """Resolve LinkedIn provider id for posts list (defaults to connected user)."""
    if identifier and identifier.strip():
        return identifier.strip()

    owner = await client.get_own_profile(account_id)
    if not isinstance(owner, dict):
        raise UnipileAPIError(
            f"Unexpected /users/me response type: {type(owner).__name__}"
        )
    resolved = profile_identifier_from_owner(owner)
    if not resolved:
        raise UnipileAPIError(
            f"AccountOwnerProfile missing identifier for account_id={account_id}"
        )
    return resolved


async def _maybe_enrich_article(
    client: LinkedInPostsClient,
    account_id: str,
    raw: dict[str, Any],
    *,
    include_article_body: bool,
) -> dict[str, Any]:
    if not include_article_body:
        return raw
    article = raw.get("article")
    if not isinstance(article, dict):
        return raw
    post_id = raw.get("id")
    if not isinstance(post_id, str) or not post_id.strip():
        return raw

    try:
        detail = await client.get_post(account_id, post_id)
        if isinstance(detail, dict):
            return detail
    except UnipileAPIError as exc:
        logger.warning(
            "[LinkedInPosts] article detail fetch failed post_id={}: {}",
            post_id,
            exc,
        )
    return raw


async def fetch_user_posts(
    user_id: str,
    *,
    identifier: Optional[str] = None,
    limit: int = 20,
    cursor: Optional[str] = None,
    fetch_all: bool = False,
    include_article_body: bool = True,
    persist: bool = False,
    db: Optional[Session] = None,
    client: Optional[LinkedInPostsClient] = None,
    oauth: Optional[LinkedInOAuthService] = None,
    persist_fn: Optional[Callable] = None,
) -> FetchPostsResult:
    """
    Fetch LinkedIn posts for a connected user via Unipile.

    Args:
        user_id: ALwrity Clerk user id
        identifier: LinkedIn provider id; resolved from /users/me when omitted
        limit: Page size (1–100) when not using fetch_all
        cursor: Pagination cursor for a single page fetch
        fetch_all: Follow all cursors (ignores incoming cursor)
        include_article_body: Fetch full post detail for article items
        persist: Save to asset library via save_and_track_text_content()
        db: SQLAlchemy session (required when persist=True)
        client: Injectable Unipile posts client (for tests)
        oauth: Injectable OAuth service (for tests)
        persist_fn: Injectable save function (for tests)
    """
    logger.info(
        "[LinkedInPosts] fetch_user_posts user_id={} limit={} fetch_all={} persist={}",
        user_id,
        limit,
        fetch_all,
        persist,
    )

    oauth_service = oauth or LinkedInOAuthService()
    posts_client = client or LinkedInPostsClient()

    creds = oauth_service.resolve_credentials(user_id)
    account_id = creds.unipile_account_id
    if not account_id:
        raise LinkedInNotConnectedError(
            "No Unipile LinkedIn account connected. "
            "Connect via hosted OAuth before fetching posts."
        )

    resolved_identifier = await resolve_post_list_identifier(
        posts_client, account_id, identifier
    )

    raw_items: list[dict[str, Any]] = []
    next_cursor: Optional[str] = None

    if fetch_all:
        raw_items = await posts_client.list_all_user_posts(
            account_id, resolved_identifier, limit_per_page=min(limit, 100)
        )
    else:
        raw_items, next_cursor = await posts_client.list_user_posts(
            account_id,
            resolved_identifier,
            limit=limit,
            cursor=cursor,
        )

    enriched_items: list[dict[str, Any]] = []
    for item in raw_items:
        enriched = await _maybe_enrich_article(
            posts_client,
            account_id,
            item,
            include_article_body=include_article_body,
        )
        enriched_items.append(enriched)

    normalized = normalize_unipile_posts(enriched_items)

    result = FetchPostsResult(
        user_id=user_id,
        account_id=account_id,
        identifier=resolved_identifier,
        posts=normalized,
        cursor=next_cursor,
    )

    if persist:
        if db is None:
            raise ValueError("db session is required when persist=True")
        kwargs: dict[str, Any] = {}
        if persist_fn is not None:
            kwargs["save_fn"] = persist_fn
        asset_ids, skipped = persist_fetched_posts(db, user_id, normalized, **kwargs)
        result.persisted_asset_ids = asset_ids
        result.skipped_social_ids = skipped

    logger.info(
        "[LinkedInPosts] fetch complete user_id={} count={} persisted={}",
        user_id,
        len(normalized),
        len(result.persisted_asset_ids),
    )
    return result


async def fetch_single_post(
    user_id: str,
    post_id: str,
    *,
    client: Optional[LinkedInPostsClient] = None,
    oauth: Optional[LinkedInOAuthService] = None,
) -> dict[str, Any]:
    """Fetch and normalize a single post by Unipile post id."""
    oauth_service = oauth or LinkedInOAuthService()
    posts_client = client or LinkedInPostsClient()

    creds = oauth_service.resolve_credentials(user_id)
    account_id = creds.unipile_account_id
    if not account_id:
        raise LinkedInNotConnectedError(
            "No Unipile LinkedIn account connected."
        )

    raw = await posts_client.get_post(account_id, post_id)
    normalized = normalize_unipile_post(raw)
    return {
        "account_id": account_id,
        "post": {
            "unipile_post_id": normalized.unipile_post_id,
            "social_id": normalized.social_id,
            "content_kind": normalized.content_kind,
            "title": normalized.title,
            "text": normalized.text,
            "share_url": normalized.share_url,
            "parsed_datetime": normalized.parsed_datetime,
            "is_repost": normalized.is_repost,
            "reaction_counter": normalized.reaction_counter,
            "comment_counter": normalized.comment_counter,
            "repost_counter": normalized.repost_counter,
            "impressions_counter": normalized.impressions_counter,
            "author_name": normalized.author_name,
            "author_public_identifier": normalized.author_public_identifier,
            "article_subtitle": normalized.article_subtitle,
            "article_cover_url": normalized.article_cover_url,
        },
        "raw": raw,
    }
