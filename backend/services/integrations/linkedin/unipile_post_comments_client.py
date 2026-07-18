"""
Unipile post comments API — extends UnipileClient without growing unipile_client.py.

LinkedIn requires post ``social_id`` (not URL post id) for list/reply:
https://developer.unipile.com/reference/postscontroller_listallcomments
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
    _mime_for_attachment,
    _post_auth_headers,
    _raise_for_error,
)

SUPPORTED_COMMENT_SORT = frozenset({"MOST_RECENT", "MOST_RELEVANT"})
SUPPORTED_REACTION_TYPES = frozenset(
    {"like", "celebrate", "support", "love", "insightful", "funny"}
)


class UnipilePostCommentsClient(UnipileClient):
    """Unipile client with post comment list and reply endpoints."""

    async def list_post_comments(
        self,
        account_id: str,
        post_social_id: str,
        *,
        cursor: Optional[str] = None,
        limit: int = 20,
        sort_by: str = "MOST_RECENT",
        comment_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        List comments on a LinkedIn post via ``GET /api/v1/posts/{post_id}/comments``.

        Args:
            account_id: Unipile account ID
            post_social_id: LinkedIn ``social_id`` from the post object
            cursor: Pagination cursor from a previous response
            limit: Page size (1–100)
            sort_by: ``MOST_RECENT`` or ``MOST_RELEVANT``
            comment_id: When set, list replies to this comment

        Returns:
            Raw Unipile CommentList response dict
        """
        if not self._api_key:
            raise ValueError("Unipile API key is required")

        safe_limit = max(1, min(limit, 100))
        normalized_sort = sort_by if sort_by in SUPPORTED_COMMENT_SORT else "MOST_RECENT"
        encoded_post_id = quote(post_social_id, safe="")
        url = self._get_full_url(f"/api/v1/posts/{encoded_post_id}/comments")
        params: dict[str, str | int] = {
            "account_id": account_id,
            "limit": safe_limit,
            "sort_by": normalized_sort,
        }
        if cursor:
            params["cursor"] = cursor
        if comment_id:
            params["comment_id"] = comment_id

        logger.info(
            "[UnipilePostCommentsClient] list_post_comments account_id={} post_social_id={} "
            "limit={} sort_by={} cursor={}",
            account_id,
            post_social_id,
            safe_limit,
            normalized_sort,
            "set" if cursor else "none",
        )

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                url,
                params=params,
                headers=_auth_headers(self._api_key),
            )
            _raise_for_error(response)
            data = response.json()

        item_count = 0
        next_cursor = None
        if isinstance(data, dict):
            items = data.get("items")
            if isinstance(items, list):
                item_count = len(items)
            next_cursor = data.get("cursor")

        logger.info(
            "[UnipilePostCommentsClient] list_post_comments success account_id={} "
            "items={} next_cursor={}",
            account_id,
            item_count,
            "set" if next_cursor else "none",
        )
        return data if isinstance(data, dict) else {}

    async def send_post_comment(
        self,
        account_id: str,
        post_social_id: str,
        text: str,
        *,
        comment_id: Optional[str] = None,
        mentions: Optional[list[dict[str, Any]]] = None,
        attachment: Optional[tuple[str, bytes, str]] = None,
    ) -> dict[str, Any]:
        """
        Comment on a post or reply via ``POST /api/v1/posts/{post_id}/comments``.

        Uses multipart/form-data. Mentions use ``{{0}}`` placeholders in ``text``
        plus ``mentions[i][name|profile_id]`` fields. Optional image attachment
        (LinkedIn: one image, max 6012×6012).
        """
        if not self._api_key:
            raise ValueError("Unipile API key is required")

        trimmed = (text or "").strip()
        if not trimmed:
            raise ValueError("Comment text is required")
        if len(trimmed) > 1250:
            raise ValueError("Comment text must be 1250 characters or fewer")

        encoded_post_id = quote(post_social_id, safe="")
        url = self._get_full_url(f"/api/v1/posts/{encoded_post_id}/comments")
        form_fields: list[tuple[str, Any]] = [
            ("account_id", (None, account_id)),
            ("text", (None, trimmed)),
        ]
        if comment_id:
            form_fields.append(("comment_id", (None, comment_id)))

        mention_count = 0
        if mentions:
            for idx, mention in enumerate(mentions):
                if not isinstance(mention, dict):
                    continue
                name = str(mention.get("name") or "").strip()
                profile_id = str(mention.get("profile_id") or "").strip()
                if not name or not profile_id:
                    continue
                form_fields.append((f"mentions[{idx}][name]", (None, name)))
                form_fields.append((f"mentions[{idx}][profile_id]", (None, profile_id)))
                mention_count += 1

        has_attachment = False
        if attachment:
            filename, content, content_type = attachment
            if content:
                mime = content_type or _mime_for_attachment(filename or "image.png")
                form_fields.append(
                    ("attachments", (filename or "image.png", content, mime))
                )
                has_attachment = True

        logger.info(
            "[UnipilePostCommentsClient] send_post_comment account_id={} post_social_id={} "
            "text_len={} reply_to={} mentions={} attachment={}",
            account_id,
            post_social_id,
            len(trimmed),
            comment_id or "none",
            mention_count,
            has_attachment,
        )

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                url,
                files=form_fields,
                headers=_post_auth_headers(self._api_key),
            )
            _raise_for_error(response)
            data = response.json()

        reply_id = data.get("comment_id") if isinstance(data, dict) else None
        logger.info(
            "[UnipilePostCommentsClient] send_post_comment success account_id={} "
            "status={} comment_id={}",
            account_id,
            response.status_code,
            reply_id,
        )
        return data if isinstance(data, dict) else {}

    async def list_post_reactions(
        self,
        account_id: str,
        post_social_id: str,
        *,
        comment_id: Optional[str] = None,
        cursor: Optional[str] = None,
        limit: int = 100,
    ) -> dict[str, Any]:
        """
        List reactions on a post or comment via ``GET /api/v1/posts/{post_id}/reactions``.

        Pass ``comment_id`` to list reactions on that comment (v1).
        """
        if not self._api_key:
            raise ValueError("Unipile API key is required")

        safe_limit = max(1, min(limit, 100))
        encoded_post_id = quote(post_social_id, safe="")
        url = self._get_full_url(f"/api/v1/posts/{encoded_post_id}/reactions")
        params: dict[str, str | int] = {
            "account_id": account_id,
            "limit": safe_limit,
        }
        if comment_id:
            params["comment_id"] = comment_id
        if cursor:
            params["cursor"] = cursor

        logger.info(
            "[UnipilePostCommentsClient] list_post_reactions account_id={} "
            "post_social_id={} comment_id={} limit={}",
            account_id,
            post_social_id,
            comment_id or "none",
            safe_limit,
        )

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                url,
                params=params,
                headers=_auth_headers(self._api_key),
            )
            _raise_for_error(response)
            data = response.json()

        item_count = 0
        if isinstance(data, dict):
            items = data.get("items")
            if isinstance(items, list):
                item_count = len(items)

        logger.info(
            "[UnipilePostCommentsClient] list_post_reactions success account_id={} items={}",
            account_id,
            item_count,
        )
        return data if isinstance(data, dict) else {}

    async def add_post_reaction(
        self,
        account_id: str,
        post_social_id: str,
        *,
        comment_id: Optional[str] = None,
        reaction_type: str = "like",
    ) -> dict[str, Any]:
        """
        React to a post or comment via ``POST /api/v1/posts/reaction``.

        Body uses post ``social_id`` as ``post_id``. Pass ``comment_id`` to like a comment.
        """
        if not self._api_key:
            raise ValueError("Unipile API key is required")

        normalized_type = (reaction_type or "like").strip().lower() or "like"
        if normalized_type not in SUPPORTED_REACTION_TYPES:
            raise ValueError(
                f"Unsupported reaction_type '{normalized_type}'. "
                f"Use one of: {', '.join(sorted(SUPPORTED_REACTION_TYPES))}."
            )
        payload: dict[str, str] = {
            "account_id": account_id,
            "post_id": post_social_id,
            "reaction_type": normalized_type,
        }
        if comment_id:
            payload["comment_id"] = comment_id

        url = self._get_full_url("/api/v1/posts/reaction")
        logger.info(
            "[UnipilePostCommentsClient] add_post_reaction account_id={} "
            "post_social_id={} comment_id={} reaction_type={}",
            account_id,
            post_social_id,
            comment_id or "none",
            normalized_type,
        )

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                url,
                json=payload,
                headers=_auth_headers(self._api_key),
            )
            _raise_for_error(response)
            data = response.json() if response.content else {}

        logger.info(
            "[UnipilePostCommentsClient] add_post_reaction success account_id={} status={}",
            account_id,
            response.status_code,
        )
        return data if isinstance(data, dict) else {}
