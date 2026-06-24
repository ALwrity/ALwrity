"""
Unipile HTTP client extensions for LinkedIn posts/articles fetch.

Subclasses ``UnipileClient`` without modifying the base module.
"""

from __future__ import annotations

from typing import Any, Optional
from urllib.parse import quote

import httpx
from loguru import logger

from services.integrations.linkedin.unipile_client import (
    UnipileAPIError,
    UnipileClient,
    _auth_headers,
    _raise_for_error,
)


def _normalize_post_list(data: Any) -> tuple[list[dict[str, Any]], Optional[str]]:
    """Parse PostList response into items and next cursor."""
    if not isinstance(data, dict):
        return [], None

    items_raw = data.get("items")
    items: list[dict[str, Any]] = []
    if isinstance(items_raw, list):
        items = [item for item in items_raw if isinstance(item, dict)]

    cursor = data.get("cursor")
    if isinstance(cursor, str) and cursor.strip():
        return items, cursor.strip()
    return items, None


class LinkedInPostsClient(UnipileClient):
    """Unipile client with LinkedIn posts list/detail endpoints."""

    async def list_user_posts(
        self,
        account_id: str,
        identifier: str,
        *,
        limit: int = 20,
        cursor: Optional[str] = None,
        is_company: Optional[bool] = None,
    ) -> tuple[list[dict[str, Any]], Optional[str]]:
        """
        List posts for a LinkedIn user or company.

        Uses ``GET /api/v1/users/{identifier}/posts``.
        """
        if not self._api_key:
            raise ValueError("Unipile API key is required")
        if not identifier or not identifier.strip():
            raise UnipileAPIError("Post list identifier is required")

        encoded_identifier = quote(identifier.strip(), safe="")
        url = self._get_full_url(f"/api/v1/users/{encoded_identifier}/posts")
        params: dict[str, Any] = {
            "account_id": account_id,
            "limit": max(1, min(limit, 100)),
        }
        if cursor:
            params["cursor"] = cursor
        if is_company is not None:
            params["is_company"] = is_company

        logger.debug(
            "[LinkedInPostsClient] list_user_posts account_id={} identifier={} limit={}",
            account_id,
            identifier,
            limit,
        )

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                url, params=params, headers=_auth_headers(self._api_key)
            )
            _raise_for_error(response)
            data = response.json()

        items, next_cursor = _normalize_post_list(data)
        logger.info(
            "[LinkedInPostsClient] list_user_posts returned {} items cursor={!r}",
            len(items),
            next_cursor,
        )
        return items, next_cursor

    async def get_post(
        self, account_id: str, post_id: str
    ) -> dict[str, Any]:
        """
        Retrieve a single post by Unipile post id.

        Uses ``GET /api/v1/posts/{post_id}``.
        """
        if not self._api_key:
            raise ValueError("Unipile API key is required")
        if not post_id or not post_id.strip():
            raise UnipileAPIError("Post id is required")

        encoded_post_id = quote(post_id.strip(), safe="")
        url = self._get_full_url(f"/api/v1/posts/{encoded_post_id}")
        params = {"account_id": account_id}

        logger.debug(
            "[LinkedInPostsClient] get_post account_id={} post_id={}",
            account_id,
            post_id,
        )

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                url, params=params, headers=_auth_headers(self._api_key)
            )
            _raise_for_error(response)
            data = response.json()

        if not isinstance(data, dict):
            raise UnipileAPIError(
                f"Unexpected post detail response type: {type(data).__name__}"
            )
        return data

    async def list_all_user_posts(
        self,
        account_id: str,
        identifier: str,
        *,
        limit_per_page: int = 100,
        max_pages: Optional[int] = None,
        is_company: Optional[bool] = None,
    ) -> list[dict[str, Any]]:
        """Follow cursors until exhausted or ``max_pages`` reached."""
        all_items: list[dict[str, Any]] = []
        cursor: Optional[str] = None
        pages = 0

        while True:
            items, cursor = await self.list_user_posts(
                account_id,
                identifier,
                limit=limit_per_page,
                cursor=cursor,
                is_company=is_company,
            )
            all_items.extend(items)
            pages += 1

            if not cursor:
                break
            if max_pages is not None and pages >= max_pages:
                break

        return all_items
