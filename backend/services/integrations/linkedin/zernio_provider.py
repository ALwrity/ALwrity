"""
Zernio implementation of LinkedInSocialProvider.
"""

from __future__ import annotations

from typing import Any, Optional

from loguru import logger

from services.integrations.linkedin_oauth import LinkedInOAuthService
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
from services.integrations.linkedin.zernio_client import (
    ZernioAPIError,
    ZernioClient,
    avatar_url_from_item,
)

_PHASE2_MSG = "LinkedIn publishing is not implemented in Phase 1 (deferred to Phase 2)."


class ZernioProvider:
    """LinkedIn platform operations via Zernio REST API."""

    provider_name = "zernio"

    def __init__(
        self,
        oauth_service: Optional[LinkedInOAuthService] = None,
        deduplicator: Optional[ContentDeduplicator] = None,
        media_validator: Optional[LinkedInMediaValidator] = None,
    ):
        self._oauth = oauth_service or LinkedInOAuthService()
        self._deduplicator = deduplicator or ContentDeduplicator()
        self._media_validator = media_validator or LinkedInMediaValidator()

    async def _client_for_user(self, user_id: str) -> ZernioClient:
        creds = self._oauth.resolve_credentials(user_id)
        return ZernioClient(creds)

    def _resolve_account_id(
        self, user_id: str, account_id: Optional[str], *, prefer_org: bool = False
    ) -> str:
        if account_id:
            return account_id
        creds = self._oauth.resolve_credentials(user_id)
        resolved = creds.org_account_id if prefer_org else creds.primary_account_id
        if not resolved:
            raise ValueError("account_id is required and no default is configured")
        return resolved

    async def list_accounts(self, user_id: str) -> list[LinkedInAccount]:
        creds = self._oauth.resolve_credentials(user_id)
        accounts: list[LinkedInAccount] = []

        try:
            client = ZernioClient(creds)
            raw = await client.list_accounts(profile_id=creds.zernio_profile_id)
            items = raw if isinstance(raw, list) else raw.get("accounts", raw.get("data", []))
            if isinstance(items, list):
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    aid = str(item.get("id") or item.get("accountId") or item.get("_id") or "")
                    if not aid:
                        continue
                    accounts.append(
                        LinkedInAccount(
                            account_id=aid,
                            account_type=item.get("accountType") or item.get("type"),
                            username=item.get("username") or item.get("name"),
                            avatar_url=avatar_url_from_item(item),
                            platform="linkedin",
                        )
                    )
        except ZernioAPIError as e:
            logger.warning(f"Zernio list_accounts failed, synthesizing from credentials: {e}")

        if not accounts and creds.zernio_account_id:
            accounts.append(
                LinkedInAccount(
                    account_id=creds.zernio_account_id,
                    account_type="personal",
                    username=creds.account_name,
                    platform="linkedin",
                )
            )
        if creds.zernio_org_account_id and creds.zernio_org_account_id != creds.zernio_account_id:
            accounts.append(
                LinkedInAccount(
                    account_id=creds.zernio_org_account_id,
                    account_type="organization",
                    username=creds.account_name,
                    platform="linkedin",
                )
            )
        return accounts

    async def list_organizations(
        self, user_id: str, account_id: str
    ) -> list[LinkedInOrganization]:
        client = await self._client_for_user(user_id)
        resolved_id = self._resolve_account_id(user_id, account_id)
        raw = await client.list_organizations(resolved_id)
        items = raw if isinstance(raw, list) else raw.get("organizations", raw.get("data", []))
        orgs: list[LinkedInOrganization] = []
        if not isinstance(items, list):
            return orgs
        for item in items:
            if not isinstance(item, dict):
                continue
            org_id = str(item.get("id") or item.get("organizationId", ""))
            urn = item.get("urn") or item.get("organizationUrn")
            if not urn and org_id:
                urn = f"urn:li:organization:{org_id}"
            orgs.append(
                LinkedInOrganization(
                    organization_id=org_id,
                    name=item.get("name") or item.get("localizedName"),
                    urn=urn,
                )
            )
        return orgs

    async def get_profile_aggregate_analytics(
        self,
        user_id: str,
        account_id: str,
        aggregation: ProfileAggregation = "TOTAL",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        metrics: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        client = await self._client_for_user(user_id)
        resolved_id = self._resolve_account_id(user_id, account_id)
        return await client.fetch_profile_aggregate_analytics(
            resolved_id,
            aggregation=aggregation,
            start_date=start_date,
            end_date=end_date,
            metrics=metrics,
        )

    async def get_org_aggregate_analytics(
        self,
        user_id: str,
        account_id: str,
        since: Optional[str] = None,
        until: Optional[str] = None,
        metric_type: OrgMetricType = "total_value",
        metrics: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        client = await self._client_for_user(user_id)
        resolved_id = self._resolve_account_id(user_id, account_id, prefer_org=True)
        return await client.fetch_org_aggregate_analytics(
            resolved_id,
            since=since,
            until=until,
            metric_type=metric_type,
            metrics=metrics,
        )

    async def get_post_analytics(
        self,
        user_id: str,
        account_id: str,
        urn: str,
    ) -> dict[str, Any]:
        client = await self._client_for_user(user_id)
        resolved_id = self._resolve_account_id(user_id, account_id)
        return await client.fetch_post_analytics(resolved_id, urn)

    async def resolve_account_avatar_url(
        self, user_id: str, account: LinkedInAccount
    ) -> Optional[str]:
        """Return avatar URL from account list data or Zernio GET /accounts/{id}."""
        if account.avatar_url:
            return account.avatar_url
        try:
            client = await self._client_for_user(user_id)
            raw = await client.get_account(account.account_id)
            item = raw.get("account") if isinstance(raw.get("account"), dict) else raw
            if isinstance(item, dict):
                return avatar_url_from_item(item)
        except Exception as exc:
            logger.warning(
                f"Avatar fetch failed for account {account.account_id}: {exc}"
            )
        return None

    async def create_post(
        self, user_id: str, request: CreatePostRequest
    ) -> CreatePostResult:
        await run_publish_preflight(
            user_id,
            request,
            deduplicator=self._deduplicator,
            media_validator=self._media_validator,
        )
        raise NotImplementedError(_PHASE2_MSG)

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
        raise NotImplementedError(_PHASE2_MSG)

    async def schedule_post(
        self, user_id: str, request: CreatePostRequest
    ) -> CreatePostResult:
        await run_publish_preflight(
            user_id,
            request,
            deduplicator=self._deduplicator,
            media_validator=self._media_validator,
        )
        raise NotImplementedError(_PHASE2_MSG)

    async def list_comments(
        self, user_id: str, account_id: str, post_urn: str
    ) -> list[CommentInfo]:
        raise NotImplementedError(_PHASE2_MSG)

    async def reply_to_comment(
        self,
        user_id: str,
        account_id: str,
        post_urn: str,
        comment_id: str,
        text: str,
    ) -> ReplyResult:
        raise NotImplementedError(_PHASE2_MSG)
