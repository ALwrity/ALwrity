"""
Native LinkedIn Marketing API provider (stub — Phase 2+).
"""

from __future__ import annotations

from typing import Any, Optional

from services.integrations.linkedin.content_deduplicator import ContentDeduplicator
from services.integrations.linkedin.media_validator import LinkedInMediaValidator
from services.integrations.linkedin.publish_preflight import (
    run_publish_preflight,
    run_upload_preflight,
)
from services.integrations.linkedin.types import (
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

_STUB_MSG = (
    "Native LinkedIn Marketing API provider is not implemented yet. "
    "Set LINKEDIN_PROVIDER=zernio to use Zernio."
)


class NativeLinkedInProvider:
    """Placeholder for direct LinkedIn Marketing API integration."""

    provider_name = "native"

    def __init__(
        self,
        deduplicator: Optional[ContentDeduplicator] = None,
        media_validator: Optional[LinkedInMediaValidator] = None,
    ):
        self._deduplicator = deduplicator or ContentDeduplicator()
        self._media_validator = media_validator or LinkedInMediaValidator()

    def _not_implemented(self) -> None:
        raise NotImplementedError(_STUB_MSG)

    async def list_accounts(self, user_id: str) -> list[LinkedInAccount]:
        self._not_implemented()

    async def list_organizations(
        self, user_id: str, account_id: str
    ) -> list[LinkedInOrganization]:
        self._not_implemented()

    async def get_profile_aggregate_analytics(
        self,
        user_id: str,
        account_id: str,
        aggregation: ProfileAggregation = "TOTAL",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        metrics: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        self._not_implemented()

    async def get_org_aggregate_analytics(
        self,
        user_id: str,
        account_id: str,
        since: Optional[str] = None,
        until: Optional[str] = None,
        metric_type: OrgMetricType = "total_value",
        metrics: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        self._not_implemented()

    async def get_post_analytics(
        self,
        user_id: str,
        account_id: str,
        urn: str,
    ) -> dict[str, Any]:
        self._not_implemented()

    async def create_post(
        self, user_id: str, request: CreatePostRequest
    ) -> CreatePostResult:
        await run_publish_preflight(
            user_id,
            request,
            deduplicator=self._deduplicator,
            media_validator=self._media_validator,
        )
        self._not_implemented()

    async def upload_media(
        self,
        user_id: str,
        account_id: str,
        file_path: str,
        media_type: str,
    ) -> MediaUploadResult:
        await run_upload_preflight(
            file_path,
            media_type,
            media_validator=self._media_validator,
        )
        self._not_implemented()

    async def schedule_post(
        self, user_id: str, request: CreatePostRequest
    ) -> CreatePostResult:
        await run_publish_preflight(
            user_id,
            request,
            deduplicator=self._deduplicator,
            media_validator=self._media_validator,
        )
        self._not_implemented()
    async def list_comments(
        self, user_id: str, account_id: str, post_urn: str
    ) -> list[CommentInfo]:
        self._not_implemented()

    async def reply_to_comment(
        self,
        user_id: str,
        account_id: str,
        post_urn: str,
        comment_id: str,
        text: str,
    ) -> ReplyResult:
        self._not_implemented()
