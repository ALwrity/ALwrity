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
from services.integrations.linkedin.unipile_client import UnipileClient, UnipileAPIError


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
    """
    # Get analytics data if available
    analytics = unipile_item.get("analytics", {})

    # Extract raw values with fallbacks
    reactions = unipile_item.get("reaction_counter", 0) or analytics.get("reactions", 0)
    comments = unipile_item.get("comment_counter", 0) or analytics.get("comments", 0)
    reposts = unipile_item.get("repost_counter", 0) or analytics.get("reposts", 0)
    impressions = unipile_item.get("impressions_counter", 0) or analytics.get("impressions", 0)
    clicks = analytics.get("clicks", 0) or analytics.get("clicks_counter", 0)
    followers_gained = (
        analytics.get("followers_gained_from_this_post", 0)
        or analytics.get("followers_gained_from_this_post_counter", 0)
    )
    reach_raw = analytics.get("users_reached_counter")
    reach = int(reach_raw) if reach_raw is not None else None

    # Calculate engagement rate
    total_engagements = reactions + comments + reposts + clicks
    engagement_rate = _calculate_engagement_rate(total_engagements, impressions)

    return PostEngagementMetrics(
        reactions=max(0, reactions),
        comments=max(0, comments),
        reposts=max(0, reposts),
        impressions=max(0, impressions),
        engagement_rate=engagement_rate,
        clicks=max(0, clicks),
        followers_gained=max(0, followers_gained),
        reach=max(0, reach) if reach is not None else None,
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
            unipile_client: Unipile client instance. If None, creates new instance.
        """
        self._client = unipile_client or UnipileClient()

    async def fetch_user_posts(
        self,
        account_id: str,
        identifier: str,
        cursor: Optional[str] = None,
        limit: int = 20,
    ) -> PostListResponse:
        """
        Fetch and normalize LinkedIn posts for a user.

        Args:
            account_id: Unipile personal account ID
            identifier: LinkedIn provider internal id (ACo/ADo...)
            cursor: Optional pagination cursor
            limit: Number of posts to fetch (default 20, max 100)

        Returns:
            PostListResponse with normalized posts and pagination info

        Raises:
            PostsServiceError: If fetching or normalization fails
        """
        logger.info(
            f"[PostsService] Fetching posts for identifier={identifier} "
            f"account_id={account_id} limit={limit}"
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

            logger.info(
                f"[PostsService] Successfully normalized {len(normalized_posts)} posts "
                f"for identifier={identifier}"
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
