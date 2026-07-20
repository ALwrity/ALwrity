"""
LinkedIn avatar proxy route — proxies LinkedIn CDN images through the server
to avoid hotlink blocks. Kept separate from linkedin_social_routes.py to
avoid further growth of that module.
"""

from __future__ import annotations

from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from loguru import logger

from middleware.auth_middleware import get_current_user_with_query_token

router = APIRouter(prefix="/api/linkedin-social", tags=["LinkedIn Social"])


def _user_id(current_user: dict) -> str:
    uid = current_user.get("id") if current_user else None
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return str(uid)


@router.get("/avatar-proxy")
async def avatar_proxy(
    url: str = Query(..., description="LinkedIn CDN media URL (licdn.com hosts only)"),
    current_user: dict = Depends(get_current_user_with_query_token),
) -> Response:
    """Proxy LinkedIn CDN images through the server to avoid hotlink blocks.

    Supports authentication via:
    - Authorization: Bearer <token> header
    - ?token=<token> query parameter (for <img> tags that can't set headers)
    """
    user_id = _user_id(current_user)
    cleaned = url.strip()

    parsed = urlparse(cleaned)
    host = (parsed.hostname or "").lower()
    is_allowed = host == "media.licdn.com" or host.endswith(".licdn.com")
    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_MEDIA_URL",
                "message": "Only LinkedIn licdn.com media URLs are allowed",
            },
        )

    logger.debug("[AvatarProxy] Fetching from LinkedIn CDN: {} for user_id={}", cleaned[:80], user_id)

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            upstream = await client.get(
                cleaned,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    ),
                    "Referer": "https://www.linkedin.com/",
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                },
            )
    except httpx.HTTPError as exc:
        logger.error("[AvatarProxy] Upstream fetch failed for user_id={}: {}", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error_code": "MEDIA_FETCH_FAILED", "message": "Failed to fetch LinkedIn media"},
        ) from exc

    if upstream.status_code != 200:
        logger.warning("[AvatarProxy] Upstream returned status={} for user_id={}", upstream.status_code, user_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error_code": "MEDIA_FETCH_FAILED", "message": "LinkedIn media unavailable"},
        )

    content_type = upstream.headers.get("content-type", "image/jpeg")
    logger.debug(
        "[AvatarProxy] Successfully proxied image for user_id={} type={} size={}",
        user_id,
        content_type,
        len(upstream.content),
    )
    return Response(content=upstream.content, media_type=content_type)