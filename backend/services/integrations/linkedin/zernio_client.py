"""
Low-level Zernio HTTP client for LinkedIn Growth Engine.
"""

from __future__ import annotations

import os
from typing import Any, Optional

import httpx

from services.integrations.linkedin.types import DEFAULT_ZERNIO_API_URL, LinkedInCredentials

DEFAULT_ZERNIO_API_URL = "https://zernio.com/api/v1"


def zernio_base_url() -> str:
    return os.getenv("ZERNIO_API_URL", DEFAULT_ZERNIO_API_URL).rstrip("/")


class ZernioAPIError(RuntimeError):
    """Raised when the Zernio API returns an error response."""

    def __init__(self, message: str, *, status_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.status_code = status_code


def _auth_headers(api_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _raise_for_error(response: httpx.Response) -> None:
    if response.status_code < 400:
        return
    raise ZernioAPIError(
        f"Zernio API returned HTTP {response.status_code}: {response.text}",
        status_code=response.status_code,
    )


def _parse_account_items(raw: Any) -> list[dict[str, Any]]:
    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, dict):
        items = raw.get("accounts", raw.get("data", []))
    else:
        items = []
    if not isinstance(items, list):
        return []
    return [item for item in items if isinstance(item, dict)]


def account_id_from_item(item: dict[str, Any]) -> str:
    return str(item.get("_id") or item.get("id") or item.get("accountId") or "")


def account_type_from_item(item: dict[str, Any]) -> Optional[str]:
    return item.get("accountType") or item.get("type")


def account_name_from_item(item: dict[str, Any]) -> Optional[str]:
    return item.get("displayName") or item.get("username") or item.get("name")


def avatar_url_from_item(item: dict[str, Any]) -> Optional[str]:
    for key in (
        "profilePicture",
        "profile_picture",
        "avatarUrl",
        "avatar_url",
        "logoUrl",
        "logo_url",
    ):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


class ZernioClient:
    """Async HTTP client for Zernio LinkedIn endpoints."""

    def __init__(self, credentials: LinkedInCredentials, timeout: float = 30.0):
        if not credentials.zernio_api_key:
            raise ValueError("Zernio API key is required")
        self._api_key = credentials.zernio_api_key
        self._base_url = credentials.zernio_api_url.rstrip("/")
        self._profile_id = credentials.zernio_profile_id
        self._timeout = timeout

    async def list_accounts(
        self, *, profile_id: Optional[str] = None, platform: str = "linkedin"
    ) -> dict[str, Any]:
        url = f"{self._base_url}/accounts"
        params: dict[str, str] = {"platform": platform}
        resolved_profile = profile_id or self._profile_id
        if resolved_profile:
            params["profileId"] = resolved_profile
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                url,
                params=params,
                headers=_auth_headers(self._api_key),
            )
        _raise_for_error(response)
        return response.json()

    async def list_organizations(self, account_id: str) -> dict[str, Any]:
        url = f"{self._base_url}/accounts/{account_id}/linkedin-organizations"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(url, headers=_auth_headers(self._api_key))
        _raise_for_error(response)
        return response.json()

    async def get_account(self, account_id: str) -> dict[str, Any]:
        """Fetch a single connected account (profile picture, metadata)."""
        url = f"{self._base_url}/accounts/{account_id}"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(url, headers=_auth_headers(self._api_key))
        _raise_for_error(response)
        return response.json()

    async def fetch_profile_aggregate_analytics(
        self,
        account_id: str,
        aggregation: str = "TOTAL",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        metrics: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        params: dict[str, str] = {"aggregation": aggregation}
        if start_date:
            params["startDate"] = start_date
        if end_date:
            params["endDate"] = end_date
        if metrics:
            params["metrics"] = ",".join(metrics)

        url = f"{self._base_url}/accounts/{account_id}/linkedin-aggregate-analytics"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                url, params=params, headers=_auth_headers(self._api_key)
            )
        _raise_for_error(response)
        return response.json()

    async def fetch_org_aggregate_analytics(
        self,
        account_id: str,
        since: Optional[str] = None,
        until: Optional[str] = None,
        metric_type: str = "total_value",
        metrics: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        params: dict[str, str] = {
            "accountId": account_id,
            "metricType": metric_type,
        }
        if since:
            params["since"] = since
        if until:
            params["until"] = until
        if metrics:
            params["metrics"] = ",".join(metrics)

        url = f"{self._base_url}/analytics/linkedin/org-aggregate-analytics"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                url, params=params, headers=_auth_headers(self._api_key)
            )
        _raise_for_error(response)
        return response.json()

    async def fetch_post_analytics(self, account_id: str, urn: str) -> dict[str, Any]:
        url = f"{self._base_url}/accounts/{account_id}/linkedin-post-analytics"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                url,
                params={"urn": urn},
                headers=_auth_headers(self._api_key),
            )
        _raise_for_error(response)
        return response.json()

    async def delete_account(self, account_id: str) -> dict[str, Any]:
        """Disconnect and remove a connected social account from Zernio."""
        url = f"{self._base_url}/accounts/{account_id}"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.delete(url, headers=_auth_headers(self._api_key))
        _raise_for_error(response)
        if response.content:
            return response.json()
        return {"message": "Account disconnected successfully"}


def create_profile_sync(
    api_key: str,
    base_url: str,
    name: str,
    *,
    description: Optional[str] = None,
    timeout: float = 30.0,
) -> dict[str, Any]:
    """Create a Zernio profile (Quickstart Step 1)."""
    import requests

    url = f"{base_url.rstrip('/')}/profiles"
    payload: dict[str, str] = {"name": name}
    if description:
        payload["description"] = description
    response = requests.post(
        url,
        json=payload,
        headers=_auth_headers(api_key),
        timeout=timeout,
    )
    if response.status_code >= 400:
        raise ZernioAPIError(
            f"Zernio create profile returned HTTP {response.status_code}: {response.text}"
        )
    data = response.json()
    profile = data.get("profile") if isinstance(data.get("profile"), dict) else data
    profile_id = profile.get("_id") or profile.get("id") or data.get("_id")
    if not profile_id:
        raise ZernioAPIError("Zernio create profile response missing profile _id")
    return {"profileId": str(profile_id), "profile": profile}


def list_accounts_sync(
    api_key: str,
    base_url: str,
    profile_id: str,
    *,
    platform: str = "linkedin",
    timeout: float = 30.0,
) -> dict[str, Any]:
    """List connected accounts for a profile (Quickstart Step 3)."""
    import requests

    url = f"{base_url.rstrip('/')}/accounts"
    response = requests.get(
        url,
        params={"profileId": profile_id, "platform": platform},
        headers=_auth_headers(api_key),
        timeout=timeout,
    )
    if response.status_code >= 400:
        raise ZernioAPIError(
            f"Zernio list accounts returned HTTP {response.status_code}: {response.text}"
        )
    return response.json()


def get_connect_url_sync(
    api_key: str,
    base_url: str,
    profile_id: str,
    redirect_url: str,
    *,
    timeout: float = 30.0,
) -> dict[str, Any]:
    """Sync helper for OAuth connect URL (used by LinkedInOAuthService)."""
    import requests

    url = f"{base_url.rstrip('/')}/connect/linkedin"
    response = requests.get(
        url,
        params={"profileId": profile_id, "redirect_url": redirect_url},
        headers=_auth_headers(api_key),
        timeout=timeout,
    )
    if response.status_code >= 400:
        raise ZernioAPIError(
            f"Zernio connect URL returned HTTP {response.status_code}: {response.text}"
        )
    data = response.json()
    auth_url = data.get("authUrl") or data.get("auth_url")
    if not auth_url:
        raise ZernioAPIError("Zernio connect response missing authUrl")
    return {"authUrl": auth_url, "state": data.get("state")}


def delete_account_sync(
    api_key: str,
    base_url: str,
    account_id: str,
    *,
    timeout: float = 30.0,
) -> bool:
    """Best-effort sync disconnect for M4 (non-fatal on failure)."""
    import requests

    url = f"{base_url.rstrip('/')}/accounts/{account_id}"
    try:
        response = requests.delete(
            url,
            headers=_auth_headers(api_key),
            timeout=timeout,
        )
        return response.status_code < 400
    except Exception:
        return False
