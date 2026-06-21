"""
Unipile implementation of LinkedInSocialProvider for account connection (Phase 1).

This provider implements the LinkedInSocialProvider protocol using Unipile's API.
Phase 1 focuses on connection/disconnection only. Analytics and publishing methods
raise NotImplementedError and will be implemented in subsequent phases.
"""

from __future__ import annotations

import os
from typing import Any, Optional

from loguru import logger

from services.integrations.linkedin.protocol import LinkedInSocialProvider
from services.integrations.linkedin.types import (
    CommentInfo,
    CreatePostRequest,
    CreatePostResult,
    LinkedInAccount,
    LinkedInNotConnectedError,
    LinkedInOrganization,
    MediaUploadResult,
    OrgMetricType,
    ProfileAggregation,
    ReplyResult,
)
from services.integrations.linkedin.unipile_client import (
    UnipileClient,
    UnipileAPIError,
    avatar_url_from_user_profile,
    profile_identifier_from_owner,
)
from services.integrations.linkedin.zernio_client import avatar_url_from_item
from services.integrations.linkedin_oauth import LinkedInOAuthService


# Error messages for Phase 1 (methods not yet implemented)
_ANALYTICS_NOT_IMPLEMENTED = (
    "LinkedIn analytics via Unipile is not implemented in Phase 1. "
    "This feature is planned for Phase 3."
)
_PUBLISHING_NOT_IMPLEMENTED = (
    "LinkedIn publishing via Unipile is not implemented in Phase 1. "
    "This feature is planned for Phase 4."
)
_COMMENTS_NOT_IMPLEMENTED = (
    "LinkedIn comment management via Unipile is not implemented in Phase 1. "
    "This feature is planned for Phase 4."
)
_ORGANIZATIONS_NOT_IMPLEMENTED = (
    "LinkedIn organization management via Unipile is not implemented in Phase 1. "
    "This feature is planned for Phase 2."
)


def _is_internal_user_id(value: Optional[str]) -> bool:
    """Return True when a value looks like ALwrity's internal Clerk user id."""
    if not value or not isinstance(value, str):
        return False
    normalized = value.strip()
    return normalized.startswith("user_")


def unipile_avatar_url_from_item(item: dict[str, Any]) -> Optional[str]:
    """Extract avatar URL from a Unipile account or user profile payload."""
    url = avatar_url_from_user_profile(item)
    if url:
        return url

    profile = item.get("profile")
    if isinstance(profile, dict):
        nested = avatar_url_from_user_profile(profile)
        if nested:
            return nested

    return avatar_url_from_item(item)


def unipile_display_name_from_item(
    item: dict[str, Any],
    *,
    user_id: str,
    stored_account_name: Optional[str] = None,
) -> Optional[str]:
    """
    Resolve a human-readable LinkedIn display name from Unipile account data.

    Unipile hosted-auth stores ALwrity's internal user id in ``name``; that value
    must not be shown as the LinkedIn profile name.
    """
    for key in ("username", "display_name", "profile_name"):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            candidate = value.strip()
            if not _is_internal_user_id(candidate) and candidate != user_id:
                return candidate

    profile = item.get("profile")
    if isinstance(profile, dict):
        nested = unipile_display_name_from_item(
            profile,
            user_id=user_id,
            stored_account_name=None,
        )
        if nested:
            return nested

    name = item.get("name")
    if isinstance(name, str) and name.strip():
        candidate = name.strip()
        if not _is_internal_user_id(candidate) and candidate != user_id:
            return candidate

    if stored_account_name and not _is_internal_user_id(stored_account_name):
        return stored_account_name.strip()

    return None


class UnipileProvider:
    """
    LinkedIn platform operations via Unipile REST API (Phase 1 - Connection Only).

    This provider implements connection/disconnection functionality using
    Unipile's Hosted Auth Wizard. Analytics, publishing, and comment
    management are stubbed and will be implemented in future phases.

    Provider name: 'unipile'
    """

    provider_name = "unipile"

    def __init__(
        self,
        api_key: Optional[str] = None,
        dsn: Optional[str] = None,
        oauth_service: Optional[LinkedInOAuthService] = None,
    ):
        """
        Initialize Unipile provider.

        Args:
            api_key: Unipile API key. Defaults to UNIPILE_API_KEY env var.
            dsn: Unipile DSN. Defaults to UNIPILE_DSN env var.
            oauth_service: OAuth service for credential lookup and stored names.
        """
        self._client = UnipileClient(api_key=api_key, dsn=dsn)
        self._oauth = oauth_service or LinkedInOAuthService()
        logger.info("[UnipileProvider] Initialized (Phase 1 - Connection Only)")

    def _account_id_from_item(self, item: dict[str, Any]) -> Optional[str]:
        raw = item.get("id") or item.get("account_id")
        return str(raw) if raw else None

    def _item_matches_user(
        self,
        item: dict[str, Any],
        *,
        user_id: str,
        user_account_ids: set[str],
    ) -> bool:
        account_id = self._account_id_from_item(item)
        if account_id and account_id in user_account_ids:
            return True
        hosted_name = item.get("name")
        return isinstance(hosted_name, str) and hosted_name == user_id

    async def _resolve_avatar_url(
        self,
        account_id: str,
        *sources: dict[str, Any],
    ) -> Optional[str]:
        """
        Resolve LinkedIn profile photo URL for a Unipile account.

        Tries account/list payloads first, then Account API, then Users API (``/users/me``).
        """
        for source in sources:
            url = unipile_avatar_url_from_item(source)
            if url:
                return url

        account_detail: dict[str, Any] = {}
        try:
            account_detail = await self._client.get_account(account_id)
            url = unipile_avatar_url_from_item(account_detail)
            if url:
                logger.info(
                    f"[UnipileProvider] Avatar resolved via get_account "
                    f"account_id={account_id}"
                )
                return url
        except UnipileAPIError as exc:
            logger.debug(
                f"[UnipileProvider] get_account avatar lookup failed "
                f"account_id={account_id}: {exc}"
            )
        except Exception as exc:
            logger.debug(
                f"[UnipileProvider] get_account avatar lookup error "
                f"account_id={account_id}: {exc}"
            )

        try:
            profile = await self._client.get_own_profile(account_id)
            url = unipile_avatar_url_from_item(profile)
            if url:
                logger.info(
                    f"[UnipileProvider] Avatar resolved via users/me "
                    f"account_id={account_id}"
                )
                return url
            logger.warning(
                f"[UnipileProvider] users/me returned no avatar account_id={account_id} "
                f"keys={list(profile.keys()) if isinstance(profile, dict) else profile}"
            )
        except UnipileAPIError as exc:
            logger.warning(
                f"[UnipileProvider] get_own_profile failed account_id={account_id}: {exc}"
            )
        except Exception as exc:
            logger.warning(
                f"[UnipileProvider] get_own_profile error account_id={account_id}: {exc}"
            )

        for id_key in ("public_identifier", "provider_id", "username"):
            identifier = account_detail.get(id_key)
            if not isinstance(identifier, str) or not identifier.strip():
                continue
            try:
                profile = await self._client.get_user_profile(
                    account_id, identifier.strip()
                )
                url = unipile_avatar_url_from_item(profile)
                if url:
                    logger.info(
                        f"[UnipileProvider] Avatar resolved via users/{id_key} "
                        f"account_id={account_id}"
                    )
                    return url
            except UnipileAPIError as exc:
                logger.debug(
                    f"[UnipileProvider] get_user_profile failed account_id={account_id} "
                    f"identifier={identifier}: {exc}"
                )
            except Exception as exc:
                logger.debug(
                    f"[UnipileProvider] get_user_profile error account_id={account_id}: {exc}"
                )

        return None

    async def _build_account_from_item(
        self,
        item: dict[str, Any],
        *,
        user_id: str,
        stored_account_name: Optional[str],
    ) -> Optional[LinkedInAccount]:
        account_id = self._account_id_from_item(item)
        if not account_id:
            logger.warning(f"[UnipileProvider] Skipping account with no ID: {item}")
            return None

        account_type = item.get("account_type") or item.get("type") or "personal"
        username = unipile_display_name_from_item(
            item,
            user_id=user_id,
            stored_account_name=stored_account_name,
        )

        if not username:
            try:
                detail = await self._client.get_account(account_id)
                username = unipile_display_name_from_item(
                    detail,
                    user_id=user_id,
                    stored_account_name=stored_account_name,
                )
            except Exception as exc:
                logger.debug(
                    f"[UnipileProvider] get_account name enrichment failed "
                    f"account_id={account_id}: {exc}"
                )

        avatar_url = await self._resolve_avatar_url(account_id, item)

        return LinkedInAccount(
            account_id=account_id,
            account_type=str(account_type),
            username=username,
            avatar_url=avatar_url,
            platform="linkedin",
        )

    async def list_accounts(self, user_id: str) -> list[LinkedInAccount]:
        """
        List connected LinkedIn accounts from Unipile for the current user.

        Args:
            user_id: Internal user ID (for logging/matching purposes)

        Returns:
            List of LinkedInAccount objects
        """
        logger.info(f"[UnipileProvider] Listing accounts for user={user_id}")

        try:
            creds = self._oauth.resolve_credentials(user_id)
        except LinkedInNotConnectedError:
            logger.warning(
                f"[UnipileProvider] list_accounts skipped — user not connected user={user_id}"
            )
            raise

        stored_account_name = creds.account_name
        user_account_ids = {
            account_id
            for account_id in (creds.unipile_account_id, creds.unipile_org_account_id)
            if account_id
        }

        try:
            items = await self._client.list_accounts(provider="LINKEDIN")
            matched_items = [
                item
                for item in items
                if isinstance(item, dict)
                and self._item_matches_user(
                    item,
                    user_id=user_id,
                    user_account_ids=user_account_ids,
                )
            ]

            accounts: list[LinkedInAccount] = []
            for item in matched_items:
                account = await self._build_account_from_item(
                    item,
                    user_id=user_id,
                    stored_account_name=stored_account_name,
                )
                if account:
                    accounts.append(account)

            if not accounts and creds.unipile_account_id:
                logger.info(
                    f"[UnipileProvider] list_accounts fallback to stored account_id="
                    f"{creds.unipile_account_id} user={user_id}"
                )
                try:
                    detail = await self._client.get_account(creds.unipile_account_id)
                    account = await self._build_account_from_item(
                        detail,
                        user_id=user_id,
                        stored_account_name=stored_account_name,
                    )
                    if account:
                        accounts.append(account)
                except Exception as exc:
                    logger.warning(
                        f"[UnipileProvider] Stored account fetch failed user={user_id}: {exc}"
                    )
                    accounts.append(
                        LinkedInAccount(
                            account_id=creds.unipile_account_id,
                            account_type="personal",
                            username=(
                                stored_account_name
                                if stored_account_name
                                and not _is_internal_user_id(stored_account_name)
                                else None
                            ),
                            platform="linkedin",
                        )
                    )

            enriched_accounts: list[LinkedInAccount] = []
            for account in accounts:
                if account.avatar_url:
                    enriched_accounts.append(account)
                    continue
                avatar_url = await self._resolve_avatar_url(account.account_id)
                enriched_accounts.append(
                    LinkedInAccount(
                        account_id=account.account_id,
                        account_type=account.account_type,
                        username=account.username,
                        avatar_url=avatar_url,
                        platform=account.platform,
                    )
                )
            accounts = enriched_accounts

            if (
                creds.unipile_org_account_id
                and creds.unipile_org_account_id != creds.unipile_account_id
                and not any(
                    account.account_id == creds.unipile_org_account_id for account in accounts
                )
            ):
                accounts.append(
                    LinkedInAccount(
                        account_id=creds.unipile_org_account_id,
                        account_type="organization",
                        username=(
                            stored_account_name
                            if stored_account_name
                            and not _is_internal_user_id(stored_account_name)
                            else None
                        ),
                        platform="linkedin",
                    )
                )

            logger.info(
                f"[UnipileProvider] Found {len(accounts)} LinkedIn accounts for user={user_id}"
            )
            return accounts

        except UnipileAPIError as e:
            logger.error(
                f"[UnipileProvider] Failed to list accounts for user={user_id}: {e}"
            )
            return []
        except Exception as e:
            logger.exception(
                f"[UnipileProvider] Unexpected error listing accounts for user={user_id}: {e}"
            )
            return []

    async def fetch_own_linkedin_profile(
        self,
        user_id: str,
        *,
        linkedin_sections: str = "*",
    ) -> dict[str, Any]:
        """
        Fetch the connected user's full LinkedIn UserProfile from Unipile.

        Uses a two-step v1 flow:
        1. ``GET /api/v1/users/me`` → ``AccountOwnerProfile`` (resolve identifier)
        2. ``GET /api/v1/users/{identifier}?linkedin_sections=*`` → ``UserProfile``

        The ``linkedin_sections`` parameter is only valid on step 2 per Unipile OpenAPI.

        Args:
            user_id: Internal ALwrity user ID (Clerk)
            linkedin_sections: Unipile sections query (default ``*`` for full profile)

        Returns:
            Raw Unipile UserProfile dictionary

        Raises:
            LinkedInNotConnectedError: If user has no Unipile account connected
            UnipileAPIError: If the Unipile API request fails or identifier is missing
        """
        logger.info(
            f"[UnipileProvider] fetch_own_linkedin_profile user={user_id} "
            f"linkedin_sections={linkedin_sections!r}"
        )

        creds = self._oauth.resolve_credentials(user_id)
        account_id = creds.unipile_account_id
        if not account_id:
            raise LinkedInNotConnectedError(
                "No Unipile LinkedIn account connected. "
                "Connect via hosted OAuth before fetching profile."
            )

        logger.info(
            f"[UnipileProvider] Step 1/2 — AccountOwnerProfile via /users/me "
            f"account_id={account_id} user={user_id}"
        )
        owner = await self._client.get_own_profile(account_id)
        if not isinstance(owner, dict):
            raise UnipileAPIError(
                f"Unexpected /users/me response type: {type(owner).__name__}"
            )

        identifier = profile_identifier_from_owner(owner)
        if not identifier:
            raise UnipileAPIError(
                f"AccountOwnerProfile missing public_identifier and provider_id "
                f"for account_id={account_id}"
            )

        logger.info(
            f"[UnipileProvider] Step 2/2 — UserProfile via /users/{{identifier}} "
            f"account_id={account_id} identifier={identifier!r} "
            f"linkedin_sections={linkedin_sections!r}"
        )
        return await self._client.get_user_profile(
            account_id,
            identifier,
            linkedin_sections=linkedin_sections,
            notify=False,
        )

    async def list_organizations(
        self, user_id: str, account_id: str
    ) -> list[LinkedInOrganization]:
        """
        List LinkedIn organizations (company pages) accessible to the account.

        Phase 1: Not implemented. Returns empty list.
        Phase 2: Will implement organization listing.
        """
        logger.warning(
            "[UnipileProvider] list_organizations not implemented (Phase 1) user_id={} "
            "account_id={} — returning empty list",
            user_id,
            account_id,
        )
        return []

    async def get_profile_aggregate_analytics(
        self,
        user_id: str,
        account_id: str,
        aggregation: ProfileAggregation = "TOTAL",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        metrics: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        """
        Fetch profile aggregate analytics.

        Phase 1: Not implemented. Raises NotImplementedError.
        Phase 3: Will implement analytics fetching.
        """
        logger.warning(
            f"[UnipileProvider] get_profile_aggregate_analytics called but not implemented (Phase 1)"
        )
        raise NotImplementedError(_ANALYTICS_NOT_IMPLEMENTED)

    async def get_org_aggregate_analytics(
        self,
        user_id: str,
        account_id: str,
        since: Optional[str] = None,
        until: Optional[str] = None,
        metric_type: OrgMetricType = "total_value",
        metrics: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        """
        Fetch organization aggregate analytics.

        Phase 1: Not implemented. Raises NotImplementedError.
        Phase 3: Will implement organization analytics.
        """
        logger.warning(
            f"[UnipileProvider] get_org_aggregate_analytics called but not implemented (Phase 1)"
        )
        raise NotImplementedError(_ANALYTICS_NOT_IMPLEMENTED)

    async def get_post_analytics(
        self,
        user_id: str,
        account_id: str,
        urn: str,
    ) -> dict[str, Any]:
        """
        Fetch analytics for a specific post.

        Phase 1: Not implemented. Raises NotImplementedError.
        Phase 3: Will implement post analytics.
        """
        logger.warning(
            f"[UnipileProvider] get_post_analytics called but not implemented (Phase 1)"
        )
        raise NotImplementedError(_ANALYTICS_NOT_IMPLEMENTED)

    async def resolve_account_avatar_url(
        self, user_id: str, account: LinkedInAccount
    ) -> Optional[str]:
        """
        Resolve the avatar URL for a LinkedIn account.

        Args:
            user_id: Internal user ID
            account: LinkedInAccount to get avatar for

        Returns:
            Avatar URL string or None if not available
        """
        # Return cached avatar if available
        if account.avatar_url:
            return account.avatar_url

        return await self._resolve_avatar_url(account.account_id)

    async def create_post(
        self, user_id: str, request: CreatePostRequest
    ) -> CreatePostResult:
        """
        Create a LinkedIn post.

        Phase 1: Not implemented. Raises NotImplementedError.
        Phase 4: Will implement publishing.
        """
        logger.warning(
            f"[UnipileProvider] create_post called but not implemented (Phase 1)"
        )
        raise NotImplementedError(_PUBLISHING_NOT_IMPLEMENTED)

    async def upload_media(
        self,
        user_id: str,
        account_id: str,
        file_path: str,
        media_type: str,
    ) -> MediaUploadResult:
        """
        Upload media for a LinkedIn post.

        Phase 1: Not implemented. Raises NotImplementedError.
        Phase 4: Will implement media upload.
        """
        logger.warning(
            f"[UnipileProvider] upload_media called but not implemented (Phase 1)"
        )
        raise NotImplementedError(_PUBLISHING_NOT_IMPLEMENTED)

    async def schedule_post(
        self, user_id: str, request: CreatePostRequest
    ) -> CreatePostResult:
        """
        Schedule a LinkedIn post.

        Phase 1: Not implemented. Raises NotImplementedError.
        Phase 4: Will implement scheduling.
        """
        logger.warning(
            f"[UnipileProvider] schedule_post called but not implemented (Phase 1)"
        )
        raise NotImplementedError(_PUBLISHING_NOT_IMPLEMENTED)

    async def list_comments(
        self, user_id: str, account_id: str, post_urn: str
    ) -> list[CommentInfo]:
        """
        List comments on a LinkedIn post.

        Phase 1: Not implemented. Raises NotImplementedError.
        Phase 4: Will implement comment listing.
        """
        logger.warning(
            f"[UnipileProvider] list_comments called but not implemented (Phase 1)"
        )
        raise NotImplementedError(_COMMENTS_NOT_IMPLEMENTED)

    async def reply_to_comment(
        self,
        user_id: str,
        account_id: str,
        post_urn: str,
        comment_id: str,
        text: str,
    ) -> ReplyResult:
        """
        Reply to a LinkedIn comment.

        Phase 1: Not implemented. Raises NotImplementedError.
        Phase 4: Will implement comment replies.
        """
        logger.warning(
            f"[UnipileProvider] reply_to_comment called but not implemented (Phase 1)"
        )
        raise NotImplementedError(_COMMENTS_NOT_IMPLEMENTED)

    # Phase 1 helper methods for connection management

    async def generate_auth_url(
        self,
        user_id: str,
        success_redirect_url: str,
        failure_redirect_url: str,
        notify_url: str,
    ) -> str:
        """
        Generate Unipile hosted auth URL for LinkedIn connection.

        This is a Phase 1 helper method for initiating the OAuth flow.

        Args:
            user_id: Internal user ID
            success_redirect_url: Callback URL for successful auth
            failure_redirect_url: Callback URL for failed auth
            notify_url: Webhook URL for status notifications

        Returns:
            Unipile hosted auth URL string
        """
        result = await self._client.create_hosted_auth_link(
            user_id=user_id,
            success_redirect_url=success_redirect_url,
            failure_redirect_url=failure_redirect_url,
            notify_url=notify_url,
            providers=["LINKEDIN"],
        )
        return result.auth_url

    async def disconnect_account(self, account_id: str) -> bool:
        """
        Disconnect a LinkedIn account from Unipile.

        Args:
            account_id: Unipile account ID to disconnect

        Returns:
            True if disconnection was successful
        """
        return await self._client.delete_account(account_id)
