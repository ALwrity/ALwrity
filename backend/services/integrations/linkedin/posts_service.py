"""
LinkedIn Posts Service - Business logic for fetching and normalizing posts.

This service handles:
- Fetching posts from Unipile API
- Normalizing raw Unipile data to our Pydantic models
- Calculating engagement metrics
- Handling edge cases and missing data
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from loguru import logger

from models.linkedin_posts_models import (
    LinkedInPost,
    PostAuthor,
    PostEngagementMetrics,
    PostListResponse,
)
from services.integrations.linkedin.post_attachments import normalize_post_attachments
from services.integrations.linkedin.post_analytics_enrichment import (
    enrich_posts_with_retrieve_analytics,
)
from services.integrations.linkedin.unipile_client import UnipileClient, UnipileAPIError
from services.integrations.linkedin.unipile_retrieve_post_client import (
    UnipileRetrievePostClient,
)


def _parse_datetime(date_str: Optional[str]) -> datetime:
    """
    Parse date string from Unipile response to datetime.

    Handles multiple formats:
    - ISO 8601 with timezone (2024-01-15T10:30:00Z)
    - Date only (2024-01-15)
    - parsed_datetime field
    """
    if not date_str:
        return datetime.utcnow()

    formats = [
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d",
    ]

    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue

    # Fallback to current time if parsing fails
    logger.warning(f"[PostsService] Could not parse date: {date_str}")
    return datetime.utcnow()


def _calculate_engagement_rate(engagements: int, impressions: int) -> float:
    """Calculate engagement rate as engagements / impressions."""
    if impressions <= 0:
        return 0.0
    return round(engagements / impressions, 4)


def _analytics_dict(unipile_item: dict[str, Any]) -> dict[str, Any]:
    raw = unipile_item.get("analytics")
    return raw if isinstance(raw, dict) else {}


def _first_present(analytics: dict[str, Any], *keys: str) -> Any:
    """Return the first key that exists in analytics (including explicit 0)."""
    for key in keys:
        if key in analytics and analytics[key] is not None:
            return analytics[key]
    return None


def _optional_non_negative_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return None


def _optional_non_negative_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed < 0:
        return None
    return parsed


def _normalize_author(unipile_item: dict[str, Any]) -> PostAuthor:
    """
    Extract and normalize author information from Unipile post item.
    """
    author_data = unipile_item.get("author", {})

    return PostAuthor(
        name=author_data.get("name", "Unknown"),
        avatar_url=author_data.get("profile_picture_url"),
        headline=author_data.get("headline"),
        public_identifier=author_data.get("public_identifier"),
    )


def _normalize_engagement(unipile_item: dict[str, Any]) -> PostEngagementMetrics:
    """
    Extract and normalize engagement metrics from Unipile post item.

    Uses both top-level counters and nested analytics object.
    Supports legacy analytics keys and Unipile ``*_counter`` renames.
    Optional analytics fields stay ``None`` when the provider omits them.
    """
    analytics = _analytics_dict(unipile_item)

    reactions = unipile_item.get("reaction_counter", 0) or analytics.get("reactions", 0) or 0
    comments = unipile_item.get("comment_counter", 0) or analytics.get("comments", 0) or 0
    reposts = unipile_item.get("repost_counter", 0) or analytics.get("reposts", 0) or 0
    impressions = (
        unipile_item.get("impressions_counter", 0)
        or analytics.get("impressions", 0)
        or analytics.get("impressions_counter", 0)
        or 0
    )

    clicks_raw = _first_present(analytics, "clicks", "clicks_counter")
    clicks = _optional_non_negative_int(clicks_raw) or 0

    followers_raw = _first_present(
        analytics,
        "followers_gained_from_this_post",
        "followers_gained_from_this_post_counter",
    )
    followers_gained = _optional_non_negative_int(followers_raw) or 0

    engagements = _optional_non_negative_int(
        _first_present(analytics, "engagements", "engagements_counter")
    )
    clickthrough_rate = _optional_non_negative_float(
        _first_present(analytics, "clickthrough_rate", "clickthrough_rate_counter")
    )
    page_viewers = _optional_non_negative_int(
        _first_present(
            analytics,
            "page_viewers_from_this_post",
            "page_viewers_from_this_post_counter",
        )
    )
    reach = _optional_non_negative_int(
        _first_present(
            analytics,
            "members_reached",
            "users_reached_counter",
            "members_reached_counter",
        )
    )

    reactions_i = max(0, int(reactions or 0))
    comments_i = max(0, int(comments or 0))
    reposts_i = max(0, int(reposts or 0))
    impressions_i = max(0, int(impressions or 0))

    # Prefer provider engagement_rate when present; otherwise derive from counters.
    provider_rate = _optional_non_negative_float(
        _first_present(analytics, "engagement_rate")
    )
    if provider_rate is not None:
        engagement_rate = min(1.0, provider_rate if provider_rate <= 1 else provider_rate / 100.0)
    else:
        derived_engagements = engagements if engagements is not None else (
            reactions_i + comments_i + reposts_i + clicks
        )
        engagement_rate = _calculate_engagement_rate(derived_engagements, impressions_i)

    logger.debug(
        "[PostsService] normalized engagement impressions={} clicks={} "
        "followers_gained={} engagements={} page_viewers={} reach={} ctr={}",
        impressions_i,
        clicks,
        followers_gained,
        engagements,
        page_viewers,
        reach,
        clickthrough_rate,
    )

    return PostEngagementMetrics(
        reactions=reactions_i,
        comments=comments_i,
        reposts=reposts_i,
        impressions=impressions_i,
        engagement_rate=engagement_rate,
        clicks=clicks,
        followers_gained=followers_gained,
        engagements=engagements,
        clickthrough_rate=clickthrough_rate,
        page_viewers=page_viewers,
        reach=reach,
    )


def _normalize_post(unipile_item: dict[str, Any]) -> LinkedInPost:
    """
    Convert a single Unipile post item to our LinkedInPost model.
    """
    # Get the best available date
    date_str = (
        unipile_item.get("parsed_datetime")
        or unipile_item.get("date")
    )
    created_at = _parse_datetime(date_str)

    # Determine if repost
    is_repost = unipile_item.get("is_repost", False)

    # Determine if company post
    author_data = unipile_item.get("author", {})
    is_company = author_data.get("is_company", False)

    return LinkedInPost(
        id=unipile_item.get("id", ""),
        social_id=unipile_item.get("social_id"),
        text=unipile_item.get("text", ""),
        title=unipile_item.get("title"),
        created_at=created_at,
        engagement=_normalize_engagement(unipile_item),
        author=_normalize_author(unipile_item),
        share_url=unipile_item.get("share_url"),
        is_repost=is_repost,
        is_company_post=is_company,
        user_reacted=unipile_item.get("user_reacted"),
        attachments=normalize_post_attachments(unipile_item),
    )


class PostsServiceError(RuntimeError):
    """Raised when posts service encounters an error."""

    def __init__(self, message: str, *, cause: Optional[Exception] = None) -> None:
        super().__init__(message)
        self.cause = cause


class PostsService:
    """Service for fetching and normalizing LinkedIn posts."""

    def __init__(self, unipile_client: Optional[UnipileClient] = None) -> None:
        """
        Initialize the posts service.

        Args:
            unipile_client: Unipile client instance. If None, uses retrieve-post
                capable client so creator analytics can be enriched.
        """
        self._client = unipile_client or UnipileRetrievePostClient()

    async def fetch_user_posts(
        self,
        account_id: str,
        identifier: str,
        cursor: Optional[str] = None,
        limit: int = 20,
        *,
        enrich_analytics: bool = True,
    ) -> PostListResponse:
        """
        Fetch and normalize LinkedIn posts for a user.

        When ``enrich_analytics`` is True (default), posts missing nested creator
        ``analytics`` are enriched via Unipile retrieve-post.

        Args:
            account_id: Unipile personal account ID
            identifier: LinkedIn provider internal id (ACo/ADo...)
            cursor: Optional pagination cursor
            limit: Number of posts to fetch (default 20, max 100)
            enrich_analytics: Merge retrieve-post analytics when list omits them

        Returns:
            PostListResponse with normalized posts and pagination info

        Raises:
            PostsServiceError: If fetching or normalization fails
        """
        logger.info(
            f"[PostsService] Fetching posts for identifier={identifier} "
            f"account_id={account_id} limit={limit} enrich_analytics={enrich_analytics}"
        )

        try:
            # Fetch raw data from Unipile
            raw_response = await self._client.get_user_posts(
                account_id=account_id,
                identifier=identifier,
                cursor=cursor,
                limit=limit,
                is_company=False,
            )

            # Validate response structure
            if not isinstance(raw_response, dict):
                raise PostsServiceError(
                    f"Unexpected response type from Unipile: {type(raw_response)}"
                )

            # Extract posts list
            items = raw_response.get("items", [])
            if not isinstance(items, list):
                raise PostsServiceError(
                    f"Unexpected items type from Unipile: {type(items)}"
                )

            if enrich_analytics and hasattr(self._client, "get_post"):
                items = await enrich_posts_with_retrieve_analytics(
                    self._client,
                    account_id,
                    items,
                )

            # Normalize each post
            normalized_posts: list[LinkedInPost] = []
            for item in items:
                try:
                    if isinstance(item, dict):
                        post = _normalize_post(item)
                        normalized_posts.append(post)
                    else:
                        logger.warning(f"[PostsService] Skipping invalid post item: {item}")
                except Exception as e:
                    logger.warning(f"[PostsService] Failed to normalize post: {e}")
                    # Continue with other posts instead of failing completely

            # Extract pagination info
            next_cursor = raw_response.get("cursor")
            has_more = bool(next_cursor)

            # Try to get total count from paging info
            paging = raw_response.get("paging", {})
            total_count = None
            if isinstance(paging, dict):
                # Unipile doesn't provide total, but we can estimate from page_count
                page_count = paging.get("page_count")
                if page_count:
                    total_count = page_count * limit

            with_creator = sum(
                1
                for p in normalized_posts
                if (
                    p.engagement.engagements is not None
                    or p.engagement.page_viewers is not None
                    or p.engagement.reach is not None
                    or p.engagement.followers_gained > 0
                    or p.engagement.clicks > 0
                    or p.engagement.clickthrough_rate is not None
                )
            )
            logger.info(
                f"[PostsService] Successfully normalized {len(normalized_posts)} posts "
                f"for identifier={identifier} with_creator_analytics={with_creator}"
            )

            return PostListResponse(
                posts=normalized_posts,
                cursor=next_cursor,
                has_more=has_more,
                total_count=total_count,
            )

        except UnipileAPIError as e:
            logger.error(f"[PostsService] Unipile API error: {e}")
            raise PostsServiceError(
                f"Failed to fetch posts from LinkedIn: {str(e)}",
                cause=e,
            ) from e
        except Exception as e:
            logger.error(f"[PostsService] Unexpected error: {e}")
            raise PostsServiceError(
                f"Failed to fetch posts: {str(e)}",
                cause=e,
            ) from e


# Singleton instance for reuse
_posts_service_instance: Optional[PostsService] = None


def get_posts_service() -> PostsService:
    """Get or create singleton PostsService instance."""
    global _posts_service_instance
    if _posts_service_instance is None:
        _posts_service_instance = PostsService()
    return _posts_service_instance


def reset_posts_service() -> None:
    """Reset the singleton instance (useful for testing)."""
    global _posts_service_instance
    _posts_service_instance = None
