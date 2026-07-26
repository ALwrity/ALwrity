"""
Unipile retrieve-post API — extends UnipileClient without growing unipile_client.py.

``GET /api/v1/posts/{post_id}`` is the reliable source for LinkedIn creator
``analytics`` (followers gained, page viewers, engagements, CTR, members reached).
List-posts often omits that nested object.
"""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

import httpx
from loguru import logger

from services.integrations.linkedin.unipile_client import (
    UnipileClient,
    _auth_headers,
    _raise_for_error,
)


class UnipileRetrievePostClient(UnipileClient):
    """Unipile client with single-post retrieve for creator analytics."""

    async def get_post(self, account_id: str, post_id: str) -> dict[str, Any]:
        """
        Retrieve a single post via ``GET /api/v1/posts/{post_id}``.

        Args:
            account_id: Unipile account ID for the connected LinkedIn profile
            post_id: Unipile/LinkedIn post id (numeric activity id, social_id, etc.)

        Returns:
            Raw Unipile Post response dict (may include ``analytics``)

        Raises:
            UnipileAPIError: If the API request fails
            ValueError: If API key is not configured or post_id is empty
        """
        if not self._api_key:
            raise ValueError("Unipile API key is required")
        if not post_id or not str(post_id).strip():
            raise ValueError("post_id is required")

        encoded_post_id = quote(str(post_id).strip(), safe="")
        url = self._get_full_url(f"/api/v1/posts/{encoded_post_id}")
        params = {"account_id": account_id}

        logger.info(
            "[UnipileRetrievePostClient] get_post account_id={} post_id={}",
            account_id,
            post_id,
        )

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                url,
                params=params,
                headers=_auth_headers(self._api_key),
            )
            _raise_for_error(response)
            data = response.json()

        has_analytics = isinstance(data, dict) and isinstance(data.get("analytics"), dict)
        analytics_keys = (
            sorted(data["analytics"].keys())
            if has_analytics and isinstance(data, dict)
            else []
        )
        logger.info(
            "[UnipileRetrievePostClient] get_post success account_id={} post_id={} "
            "has_analytics={} analytics_keys={}",
            account_id,
            post_id,
            has_analytics,
            analytics_keys,
        )
        if not isinstance(data, dict):
            raise ValueError(f"Unexpected Unipile get_post response type: {type(data)}")
        return data
