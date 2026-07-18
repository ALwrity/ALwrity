"""
Pydantic models for LinkedIn Posts API.

Request/response models for fetching and displaying user's LinkedIn posts.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, HttpUrl


class PostEngagementMetrics(BaseModel):
    """Engagement metrics for a single LinkedIn post."""

    reactions: int = Field(default=0, ge=0, description="Number of reactions (likes, etc.)")
    comments: int = Field(default=0, ge=0, description="Number of comments")
    reposts: int = Field(default=0, ge=0, description="Number of reposts/shares")
    impressions: int = Field(default=0, ge=0, description="Number of impressions/views")
    engagement_rate: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Engagement rate (engagements / impressions)"
    )
    clicks: int = Field(default=0, ge=0, description="Number of clicks")
    followers_gained: int = Field(
        default=0,
        description="Number of followers gained from this post"
    )


class PostAuthor(BaseModel):
    """Author information for a LinkedIn post."""

    name: str = Field(..., description="Author's display name")
    avatar_url: Optional[str] = Field(
        default=None,
        description="URL to author's profile picture"
    )
    headline: Optional[str] = Field(
        default=None,
        description="Author's headline/title"
    )
    public_identifier: Optional[str] = Field(
        default=None,
        description="LinkedIn public identifier (e.g., 'johndoe')"
    )


class LinkedInPost(BaseModel):
    """A single LinkedIn post with metadata and engagement."""

    id: str = Field(..., description="Unique post identifier (URN)")
    social_id: Optional[str] = Field(
        default=None,
        description="Social platform specific ID"
    )
    text: str = Field(..., description="Post content text")
    title: Optional[str] = Field(
        default=None,
        description="Post title (if any)"
    )
    created_at: datetime = Field(..., description="Post creation datetime")
    engagement: PostEngagementMetrics = Field(
        default_factory=PostEngagementMetrics,
        description="Engagement metrics"
    )
    author: PostAuthor = Field(..., description="Post author information")
    share_url: Optional[str] = Field(
        default=None,
        description="URL to view post on LinkedIn"
    )
    is_repost: bool = Field(
        default=False,
        description="Whether this is a repost of another post"
    )
    is_company_post: bool = Field(
        default=False,
        description="Whether posted by a company page"
    )
    user_reacted: Optional[str] = Field(
        default=None,
        description="Type of reaction by current user (LIKE, etc.)"
    )


class PostListResponse(BaseModel):
    """Response model for list of LinkedIn posts."""

    posts: list[LinkedInPost] = Field(
        default_factory=list,
        description="List of LinkedIn posts"
    )
    cursor: Optional[str] = Field(
        default=None,
        description="Pagination cursor for next page"
    )
    has_more: bool = Field(
        default=False,
        description="Whether more posts are available"
    )
    total_count: Optional[int] = Field(
        default=None,
        description="Total number of posts (if available)"
    )


class FetchPostsRequest(BaseModel):
    """Query parameters for fetching posts."""

    cursor: Optional[str] = Field(
        default=None,
        description="Pagination cursor from previous response"
    )
    limit: int = Field(
        default=20,
        ge=1,
        le=100,
        description="Number of posts to fetch (max 100)"
    )


class PostsErrorResponse(BaseModel):
    """Error response for posts API."""

    error_code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[dict[str, Any]] = Field(
        default=None,
        description="Additional error details"
    )


class PostAnalyticsSummary(BaseModel):
    """Summary statistics across all posts."""

    total_posts: int = Field(..., ge=0)
    total_reactions: int = Field(..., ge=0)
    total_comments: int = Field(..., ge=0)
    total_reposts: int = Field(..., ge=0)
    total_impressions: int = Field(..., ge=0)
    total_clicks: int = Field(..., ge=0)
    total_followers_gained: int = Field(..., ge=0)
    average_engagement_rate: float = Field(..., ge=0.0, le=1.0)
    best_performing_post_id: Optional[str] = Field(default=None)


# ── Engagement Trends (time-series history) ─────────────────────────────


class MetricDelta(BaseModel):
    """Before/after values and deltas for a single metric."""
    before: int
    now: int
    delta: int
    pct_change: float


class PostDelta(BaseModel):
    """Per-post delta between two snapshot epochs."""
    post_id: str
    social_id: Optional[str] = Field(
        default=None,
        description="Unipile social_id required for list/reply comments API",
    )
    text: str
    author_name: str
    share_url: Optional[str] = None
    reactions_delta: int = 0
    comments_delta: int = 0
    impressions_delta: int = 0
    followers_delta: int = 0
    clicks_delta: int = 0
    reposts_delta: int = 0
    engagement_rate_now: float = 0.0
    engagement_rate_before: float = 0.0
    impressions_now: int = 0
    reactions_now: int = 0
    growth_contribution_pct: Optional[float] = Field(
        default=None,
        description=(
            "Share of total positive engagement growth contributed by this post "
            "across the comparison period (reactions + comments + impressions + followers)"
        ),
    )


class EngagementSummary(BaseModel):
    """Aggregate summary across all posts for the comparison period."""
    total_posts: int
    reactions: MetricDelta
    comments: MetricDelta
    impressions: MetricDelta
    followers: Optional[MetricDelta] = None
    clicks: Optional[MetricDelta] = None
    reposts: Optional[MetricDelta] = None
    avg_engagement_rate_before: float
    avg_engagement_rate_now: float


class PostAnalyticsHistoryResponse(BaseModel):
    """Response model for GET /post-analytics/history."""
    period: dict  # {"from": iso, "to": iso}
    summary: EngagementSummary
    top_gainers: list[PostDelta]
    top_decliners: list[PostDelta]
    top_posts: list[PostDelta] = Field(default_factory=list)
    rising_posts: list[PostDelta] = Field(default_factory=list)
    falling_posts: list[PostDelta] = Field(default_factory=list)
    period_key: str = Field(
        default="since_joining",
        description="Requested comparison window: 1d|7d|15d|30d|since_joining",
    )
    baseline_reason: Optional[str] = Field(
        default=None,
        description="Why this baseline was chosen, or why history is insufficient",
    )
    recommended_sync_cooldown_seconds: int = Field(
        default=300,
        description="Suggested client wait between Sync clicks (seconds)",
    )
    last_synced_at: Optional[datetime] = Field(
        default=None,
        description="When post analytics were last fetched from LinkedIn",
    )
