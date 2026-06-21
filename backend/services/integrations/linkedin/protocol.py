"""
LinkedIn Social Provider Protocol — vendor-neutral contract for Growth Engine.
"""

from __future__ import annotations

from typing import Any, Optional, Protocol, runtime_checkable

from .types import (
    CommentInfo,
    CreatePostRequest,
    CreatePostResult,
    LinkedInAccount,
    LinkedInOrganization,
    MediaUploadResult,
    OrgMetricType,
    ProfileAggregation,
    ReplyResult,
)


@runtime_checkable
class LinkedInSocialProvider(Protocol):
    """Abstract contract for LinkedIn platform operations (Zernio or native API)."""

    @property
    def provider_name(self) -> str:
        ...

    async def list_accounts(self, user_id: str) -> list[LinkedInAccount]:
        ...

    async def list_organizations(
        self, user_id: str, account_id: str
    ) -> list[LinkedInOrganization]:
        ...

    async def get_profile_aggregate_analytics(
        self,
        user_id: str,
        account_id: str,
        aggregation: ProfileAggregation = "TOTAL",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        metrics: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        ...

    async def get_org_aggregate_analytics(
        self,
        user_id: str,
        account_id: str,
        since: Optional[str] = None,
        until: Optional[str] = None,
        metric_type: OrgMetricType = "total_value",
        metrics: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        ...

    async def get_post_analytics(
        self,
        user_id: str,
        account_id: str,
        urn: str,
    ) -> dict[str, Any]:
        ...

    async def create_post(
        self, user_id: str, request: CreatePostRequest
    ) -> CreatePostResult:
        ...

    async def upload_media(
        self,
        user_id: str,
        account_id: str,
        file_path: str,
        media_type: str,
    ) -> MediaUploadResult:
        ...

    async def schedule_post(
        self, user_id: str, request: CreatePostRequest
    ) -> CreatePostResult:
        ...

    async def list_comments(
        self, user_id: str, account_id: str, post_urn: str
    ) -> list[CommentInfo]:
        ...

    async def reply_to_comment(
        self,
        user_id: str,
        account_id: str,
        post_urn: str,
        comment_id: str,
        text: str,
    ) -> ReplyResult:
        ...
