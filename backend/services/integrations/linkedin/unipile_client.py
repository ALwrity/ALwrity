"""
Low-level Unipile HTTP client for LinkedIn Growth Engine.

This client provides minimal functionality for Phase 1:
- Generate hosted auth link for LinkedIn connection
- Fetch account details
- List connected accounts
- Delete/disconnect account

Analytics and publishing methods are stubbed for future phases.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Optional
from urllib.parse import quote

import httpx
from loguru import logger

from services.integrations.linkedin.zernio_client import avatar_url_from_item


DEFAULT_UNIPILE_DSN = "api30.unipile.com:16037"


class UnipileAPIError(RuntimeError):
    """Raised when the Unipile API returns an error response."""

    def __init__(self, message: str, *, status_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.status_code = status_code


def _auth_headers(api_key: str) -> dict[str, str]:
    """Build authentication headers for Unipile API."""
    return {
        "X-API-KEY": api_key,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _raise_for_error(response: httpx.Response) -> None:
    """Raise UnipileAPIError for non-success status codes."""
    if response.status_code < 400:
        return
    raise UnipileAPIError(
        f"Unipile API returned HTTP {response.status_code}: {response.text}",
        status_code=response.status_code,
    )


def _normalize_account_list(data: Any) -> list[dict[str, Any]]:
    """
    Normalize Unipile list-accounts response into a flat list of account dicts.

    Unipile may return paginated objects under different keys or a top-level array.
    """
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]

    if not isinstance(data, dict):
        return []

    for key in ("items", "accounts", "data", "objects"):
        candidate = data.get(key)
        if isinstance(candidate, list):
            return [item for item in candidate if isinstance(item, dict)]

    return []


def profile_identifier_from_owner(owner: dict[str, Any]) -> Optional[str]:
    """
    Extract a LinkedIn profile identifier from an AccountOwnerProfile payload.

    Unipile accepts ``public_identifier`` or ``provider_id`` on
    ``GET /api/v1/users/{identifier}``.

    Args:
        owner: Raw dict from ``GET /api/v1/users/me``

    Returns:
        Identifier string, or None when neither field is present
    """
    if not isinstance(owner, dict):
        return None
    for key in ("public_identifier", "provider_id"):
        value = owner.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def avatar_url_from_user_profile(item: dict[str, Any]) -> Optional[str]:
    """
    Extract profile photo URL from a Unipile UserProfile payload.

    Prefers large variants when available (LinkedIn CDN URLs from Users API).
    """
    if not isinstance(item, dict):
        return None

    for key in (
        "profile_picture_url_large",
        "public_picture_url_large",
        "profile_picture_url",
        "public_picture_url",
        "profile_picture",
        "avatar_url",
        "picture_url",
    ):
        value = item.get(key)
        if isinstance(value, str) and value.strip().startswith("http"):
            return value.strip()

    return avatar_url_from_item(item)


@dataclass(frozen=True)
class HostedAuthLinkResult:
    """Result from creating a hosted auth link."""

    auth_url: str
    expires_at: datetime


class UnipileClient:
    """Async HTTP client for Unipile LinkedIn endpoints."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        dsn: Optional[str] = None,
        timeout: float = 30.0,
    ):
        """
        Initialize Unipile client.

        Args:
            api_key: Unipile API key. Defaults to UNIPILE_API_KEY env var.
            dsn: Unipile DSN (e.g., api1.unipile.com:13211). Defaults to UNIPILE_DSN env var.
            timeout: Request timeout in seconds.
        """
        self._api_key = api_key or os.getenv("UNIPILE_API_KEY", "")
        if not self._api_key:
            logger.warning("Unipile API key not configured")

        self._dsn = dsn or os.getenv("UNIPILE_DSN", DEFAULT_UNIPILE_DSN)
        self._base_url = f"https://{self._dsn}"
        self._timeout = timeout

    def _get_full_url(self, path: str) -> str:
        """Build full URL from API path."""
        return f"{self._base_url.rstrip('/')}/{path.lstrip('/')}"

    async def create_hosted_auth_link(
        self,
        user_id: str,
        success_redirect_url: str,
        failure_redirect_url: str,
        notify_url: str,
        providers: list[str] = None,
        expires_minutes: int = 120,
    ) -> HostedAuthLinkResult:
        """
        Generate a hosted auth link for LinkedIn connection.

        This creates a Unipile-hosted authentication page that handles
        the LinkedIn OAuth flow. The user will be redirected to
        success_redirect_url or failure_redirect_url after completion.

        Args:
            user_id: Internal user ID (stored as 'name' in Unipile for matching)
            success_redirect_url: URL to redirect on successful auth
            failure_redirect_url: URL to redirect on failed auth
            notify_url: Webhook URL for account status notifications
            providers: List of providers to show (default: ["LINKEDIN"])
            expires_minutes: Link expiration time (default: 120 minutes)

        Returns:
            HostedAuthLinkResult with auth_url and expiration time

        Raises:
            UnipileAPIError: If the API request fails
            ValueError: If API key is not configured
        """
        if not self._api_key:
            raise ValueError("Unipile API key is required")

        providers = providers or ["LINKEDIN"]
        expires_at = datetime.utcnow() + timedelta(minutes=expires_minutes)

        # Format expiresOn to exactly 3 decimal places (milliseconds) as required by Unipile API
        # Unipile's regex pattern requires: YYYY-MM-DDTHH:MM:SS.sssZ (exactly 3 digits)
        expires_ms = expires_at.microsecond // 1000
        expires_on_formatted = expires_at.strftime("%Y-%m-%dT%H:%M:%S") + f".{expires_ms:03d}Z"

        url = self._get_full_url("/api/v1/hosted/accounts/link")
        payload: dict[str, Any] = {
            "type": "create",
            "providers": providers,
            "api_url": self._base_url,
            "expiresOn": expires_on_formatted,
            "success_redirect_url": success_redirect_url,
            "failure_redirect_url": failure_redirect_url,
            "notify_url": notify_url,
            "name": user_id,  # Unipile returns this in callbacks for user matching
            "bypass_success_screen": True,
        }

        logger.info(
            f"[UnipileClient] Creating hosted auth link for user={user_id}, "
            f"providers={providers}, expires_at={expires_at.isoformat()}"
        )

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                url,
                json=payload,
                headers=_auth_headers(self._api_key),
            )
            _raise_for_error(response)
            data = response.json()

        # Try multiple possible field names for the auth URL
        # Unipile API may return 'link', 'url', 'auth_url', or 'hosted_auth_url'
        auth_url = data.get("link") or data.get("url") or data.get("auth_url") or data.get("hosted_auth_url")
        if not auth_url:
            logger.warning(
                f"[UnipileClient] Response missing expected auth URL field. "
                f"Available fields: {list(data.keys())}"
            )
            raise UnipileAPIError(
                f"Unipile response missing auth URL field. Available fields: {list(data.keys())}",
                status_code=response.status_code,
            )

        logger.info(f"[UnipileClient] Hosted auth link created for user={user_id}")

        return HostedAuthLinkResult(auth_url=auth_url, expires_at=expires_at)

    async def get_account(self, account_id: str) -> dict[str, Any]:
        """
        Fetch account details from Unipile.

        Args:
            account_id: Unipile account ID

        Returns:
            Account details dictionary

        Raises:
            UnipileAPIError: If the account is not found or request fails
        """
        if not self._api_key:
            raise ValueError("Unipile API key is required")

        url = self._get_full_url(f"/api/v1/accounts/{account_id}")

        logger.debug(f"[UnipileClient] Fetching account {account_id}")

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(url, headers=_auth_headers(self._api_key))
            _raise_for_error(response)
            return response.json()

    async def get_own_profile(self, account_id: str) -> dict[str, Any]:
        """
        Fetch the connected account owner's lightweight LinkedIn profile.

        Uses Unipile Users API ``GET /api/v1/users/me`` scoped to the account.
        Returns ``AccountOwnerProfile`` (identity, photos, counts) — not the
        section-rich ``UserProfile``. For full sections use ``get_user_profile``
        with the owner's ``public_identifier`` or ``provider_id``.

        Args:
            account_id: Unipile account ID for the connected LinkedIn account

        Returns:
            AccountOwnerProfile dictionary from Unipile

        Raises:
            UnipileAPIError: If the request fails
            ValueError: If API key is not configured
        """
        if not self._api_key:
            raise ValueError("Unipile API key is required")

        url = self._get_full_url("/api/v1/users/me")
        params: dict[str, str] = {"account_id": account_id}

        logger.debug(
            f"[UnipileClient] Fetching own profile account_id={account_id}"
        )

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                url, params=params, headers=_auth_headers(self._api_key)
            )
            _raise_for_error(response)
            data = response.json()

        if isinstance(data, dict):
            logger.info(
                f"[UnipileClient] Own profile fetched account_id={account_id} "
                f"object={data.get('object')!r} "
                f"public_identifier={data.get('public_identifier')!r} "
                f"keys={list(data.keys())}"
            )
        return data

    async def get_user_profile(
        self,
        account_id: str,
        identifier: str,
        *,
        linkedin_sections: Optional[str] = None,
        notify: Optional[bool] = None,
    ) -> dict[str, Any]:
        """
        Fetch a LinkedIn user profile by public identifier or provider id.

        Uses ``GET /api/v1/users/{identifier}`` which returns ``UserProfile``.
        Pass ``linkedin_sections=*`` for experience, skills, education, about, etc.

        Args:
            account_id: Unipile account ID
            identifier: LinkedIn public identifier (e.g. ``johndoe``) or provider id
            linkedin_sections: Optional sections query (e.g. ``*`` for full profile)
            notify: When ``False``, avoids notifying the profile owner on visit

        Returns:
            UserProfile dictionary from Unipile

        Raises:
            UnipileAPIError: If the request fails
            ValueError: If API key is not configured
        """
        if not self._api_key:
            raise ValueError("Unipile API key is required")

        encoded_identifier = quote(identifier, safe="")
        url = self._get_full_url(f"/api/v1/users/{encoded_identifier}")
        params: dict[str, Any] = {"account_id": account_id}
        if linkedin_sections is not None:
            params["linkedin_sections"] = linkedin_sections
        if notify is not None:
            params["notify"] = notify

        logger.debug(
            f"[UnipileClient] Fetching user profile account_id={account_id} "
            f"identifier={identifier} linkedin_sections={linkedin_sections!r} "
            f"notify={notify!r}"
        )

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                url, params=params, headers=_auth_headers(self._api_key)
            )
            _raise_for_error(response)
            data = response.json()

        if isinstance(data, dict):
            logger.info(
                f"[UnipileClient] User profile fetched account_id={account_id} "
                f"identifier={identifier} linkedin_sections={linkedin_sections!r} "
                f"object={data.get('object')!r} is_self={data.get('is_self')!r} "
                f"keys={list(data.keys())}"
            )
        return data

    async def list_accounts(
        self, provider: Optional[str] = "LINKEDIN"
    ) -> list[dict[str, Any]]:
        """
        List connected accounts from Unipile.

        Args:
            provider: Filter by provider (e.g., "LINKEDIN"). None for all.

        Returns:
            List of account dictionaries
        """
        if not self._api_key:
            raise ValueError("Unipile API key is required")

        url = self._get_full_url("/api/v1/accounts")
        params: dict[str, str] = {}
        if provider:
            params["provider"] = provider

        logger.debug(f"[UnipileClient] Listing accounts, provider={provider}")

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                url, params=params, headers=_auth_headers(self._api_key)
            )
            _raise_for_error(response)
            data = response.json()

        raw_keys = list(data.keys()) if isinstance(data, dict) else ["<list>"]
        items = _normalize_account_list(data)

        if not items:
            logger.warning(
                f"[UnipileClient] list_accounts returned HTTP 200 but parsed 0 accounts "
                f"(raw_keys={raw_keys}, provider={provider})"
            )
        else:
            logger.info(
                f"[UnipileClient] Listed {len(items)} accounts (raw_keys={raw_keys}, provider={provider})"
            )

        return items

    async def delete_account(self, account_id: str) -> bool:
        """
        Delete/disconnect an account from Unipile.

        Args:
            account_id: Unipile account ID to delete

        Returns:
            True if deletion was successful, False otherwise
        """
        if not self._api_key:
            logger.warning("Cannot delete account: Unipile API key not configured")
            return False

        url = self._get_full_url(f"/api/v1/accounts/{account_id}")

        logger.info(f"[UnipileClient] Deleting account {account_id}")

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.delete(url, headers=_auth_headers(self._api_key))
                if response.status_code < 400:
                    logger.info(f"[UnipileClient] Account {account_id} deleted successfully")
                    return True
                else:
                    logger.warning(
                        f"[UnipileClient] Failed to delete account {account_id}: "
                        f"HTTP {response.status_code}"
                    )
                    return False
        except Exception as e:
            logger.error(f"[UnipileClient] Error deleting account {account_id}: {e}")
            return False

    async def reconnect_account(
        self,
        account_id: str,
        success_redirect_url: str,
        failure_redirect_url: str,
        notify_url: str,
        expires_minutes: int = 120,
    ) -> HostedAuthLinkResult:
        """
        Generate a reconnection link for an existing disconnected account.

        Args:
            account_id: Existing Unipile account ID to reconnect
            success_redirect_url: URL to redirect on successful reconnection
            failure_redirect_url: URL to redirect on failed reconnection
            notify_url: Webhook URL for account status notifications
            expires_minutes: Link expiration time (default: 120 minutes)

        Returns:
            HostedAuthLinkResult with reconnection URL
        """
        if not self._api_key:
            raise ValueError("Unipile API key is required")

        expires_at = datetime.utcnow() + timedelta(minutes=expires_minutes)

        # Format expiresOn to exactly 3 decimal places (milliseconds) as required by Unipile API
        # Unipile's regex pattern requires: YYYY-MM-DDTHH:MM:SS.sssZ (exactly 3 digits)
        expires_ms = expires_at.microsecond // 1000
        expires_on_formatted = expires_at.strftime("%Y-%m-%dT%H:%M:%S") + f".{expires_ms:03d}Z"

        url = self._get_full_url("/api/v1/hosted/accounts/link")
        payload: dict[str, Any] = {
            "type": "reconnect",
            "reconnect_account": account_id,
            "api_url": self._base_url,
            "expiresOn": expires_on_formatted,
            "success_redirect_url": success_redirect_url,
            "failure_redirect_url": failure_redirect_url,
            "notify_url": notify_url,
        }

        logger.info(
            f"[UnipileClient] Creating reconnection link for account={account_id}, "
            f"expires_at={expires_at.isoformat()}"
        )

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                url,
                json=payload,
                headers=_auth_headers(self._api_key),
            )
            _raise_for_error(response)
            data = response.json()

        # Try multiple possible field names for the auth URL
        # Unipile API may return 'link', 'url', 'auth_url', or 'hosted_auth_url'
        auth_url = data.get("link") or data.get("url") or data.get("auth_url") or data.get("hosted_auth_url")
        if not auth_url:
            logger.warning(
                f"[UnipileClient] Response missing expected auth URL field. "
                f"Available fields: {list(data.keys())}"
            )
            raise UnipileAPIError(
                f"Unipile response missing auth URL field. Available fields: {list(data.keys())}",
                status_code=response.status_code,
            )

        logger.info(f"[UnipileClient] Reconnection link created for account={account_id}")

        return HostedAuthLinkResult(auth_url=auth_url, expires_at=expires_at)
