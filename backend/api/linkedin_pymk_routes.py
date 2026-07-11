"""LinkedIn People You May Know API routes."""

from __future__ import annotations

from typing import Optional

from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from loguru import logger

from middleware.auth_middleware import get_current_user, get_current_user_with_query_token
from models.linkedin_pymk_models import PymkCohortDefaultsResponse, PymkListResponse
from services.database import get_db
from services.integrations.linkedin.pymk_service import PymkService, PymkServiceError, get_pymk_service
from services.integrations.linkedin.pymk_types import PymkCohort
from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.linkedin_pymk_cache_service import LinkedInPymkCacheService
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/linkedin", tags=["LinkedIn PYMK"])

_COHORT_QUERY = Query(
    default="recent_activity",
    description="PYMK cohort: recent_activity, same_school, same_job, same_industry",
)


def _user_id(current_user: dict) -> str:
    uid = current_user.get("id") if current_user else None
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return str(uid)


def _parse_cohort(value: str) -> PymkCohort:
    try:
        return PymkCohort(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "INVALID_COHORT",
                "message": (
                    "cohort must be one of: recent_activity, same_school, "
                    "same_job, same_industry"
                ),
            },
        ) from exc


@router.get("/network/pymk/cohort-defaults", response_model=PymkCohortDefaultsResponse)
async def get_pymk_cohort_defaults(
    current_user: dict = Depends(get_current_user),
    service: PymkService = Depends(get_pymk_service),
) -> PymkCohortDefaultsResponse:
    """Return auto-detected school, industry, and job cohort ids from LinkedIn profile."""
    user_id = _user_id(current_user)
    try:
        defaults = await service.get_cohort_defaults(user_id)
        return PymkCohortDefaultsResponse(**defaults)
    except LinkedInNotConnectedError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error_code": "NOT_CONNECTED", "message": str(exc)},
        ) from exc


_LICDN_HOST = "https://media.licdn.com/"


def _is_allowed_pymk_media_url(url: str) -> bool:
    """Allow LinkedIn CDN hosts used for profile and cover images."""
    try:
        parsed = urlparse(url.strip())
    except Exception:
        return False
    if parsed.scheme not in {"http", "https"}:
        return False
    host = (parsed.hostname or "").lower()
    return host == "media.licdn.com" or host.endswith(".licdn.com")


@router.get("/network/pymk/media-proxy")
async def pymk_media_proxy(
    url: str = Query(..., description="LinkedIn CDN media URL (licdn.com hosts only)"),
    current_user: dict = Depends(get_current_user_with_query_token),
) -> Response:
    """Proxy LinkedIn profile/cover images so the browser can load them without hotlink blocks.

    Supports authentication via:
    - Authorization: Bearer <token> header
    - ?token=<token> query parameter (for <img> tags that can't set headers)
    """
    user_id = _user_id(current_user)
    cleaned = url.strip()

    logger.debug(
        "[PYMK MediaProxy] Request from user_id={} url_length={}",
        user_id,
        len(cleaned),
    )

    if not _is_allowed_pymk_media_url(cleaned):
        logger.warning(
            "[PYMK MediaProxy] Rejected invalid URL host for user_id={}: {}",
            user_id,
            urlparse(cleaned).hostname,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_MEDIA_URL",
                "message": "Only LinkedIn licdn.com media URLs are allowed",
            },
        )

    logger.info("[PYMK MediaProxy] Fetching from LinkedIn CDN: {}", cleaned[:80])
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
        logger.error(
            "[PYMK MediaProxy] Upstream fetch failed for user_id={}: {}",
            user_id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error_code": "MEDIA_FETCH_FAILED", "message": "Failed to fetch LinkedIn media"},
        ) from exc

    if upstream.status_code != 200:
        logger.warning(
            "[PYMK MediaProxy] Upstream returned status={} for user_id={}",
            upstream.status_code,
            user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error_code": "MEDIA_FETCH_FAILED", "message": "LinkedIn media unavailable"},
        )

    content_type = upstream.headers.get("content-type", "image/jpeg")
    content_length = len(upstream.content)
    logger.debug(
        "[PYMK MediaProxy] Successfully proxied image for user_id={} type={} size={}",
        user_id,
        content_type,
        content_length,
    )
    return Response(content=upstream.content, media_type=content_type)


@router.get("/network/people-you-may-know", response_model=PymkListResponse)
async def get_people_you_may_know(
    cohort: str = _COHORT_QUERY,
    page_start: int = Query(default=0, ge=0, le=500),
    page_size: int = Query(default=10, ge=1, le=50),
    cohort_id: Optional[str] = Query(
        default=None,
        description="school_id, super_title_id, or industry_id depending on cohort",
    ),
    refresh: bool = Query(
        False,
        description="Fetch fresh data from LinkedIn before returning (page 0 only)",
    ),
    current_user: dict = Depends(get_current_user),
    service: PymkService = Depends(get_pymk_service),
    db: Session = Depends(get_db),
) -> PymkListResponse:
    """
    Fetch live LinkedIn People You May Know suggestions (view-only).

    For ``page_start=0``, returns workspace DB cache unless ``refresh=true``.
    Pagination requests (``page_start > 0``) always call LinkedIn live.

    Cohort-specific IDs are required for same_school, same_job, and same_industry.
    """
    user_id = _user_id(current_user)
    parsed_cohort = _parse_cohort(cohort)
    normalized_cohort_id = (cohort_id or "").strip()

    logger.info(
        "[PYMK] request user_id={} cohort={} page_start={} page_size={} cohort_id={} refresh={}",
        user_id,
        parsed_cohort.value,
        page_start,
        page_size,
        cohort_id,
        refresh,
    )

    cache_service = LinkedInPymkCacheService(db)

    if page_start == 0 and not refresh:
        cached = cache_service.get_cached(user_id, parsed_cohort.value, normalized_cohort_id)
        if cached is not None:
            return cached

    try:
        result = await service.get_suggestions(
            user_id,
            cohort=parsed_cohort,
            page_start=page_start,
            page_size=page_size,
            cohort_id=cohort_id,
        )
    except LinkedInNotConnectedError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error_code": "NOT_CONNECTED", "message": str(exc)},
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "INVALID_REQUEST", "message": str(exc)},
        ) from exc
    except PymkServiceError as exc:
        status_code = status.HTTP_502_BAD_GATEWAY
        if "429" in str(exc):
            status_code = status.HTTP_429_TOO_MANY_REQUESTS
        raise HTTPException(
            status_code=status_code,
            detail={"error_code": "PYMK_FETCH_FAILED", "message": str(exc)},
        ) from exc
    except Exception as exc:
        logger.exception("[PYMK] unexpected error user_id={}", user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "PYMK_ERROR", "message": "Failed to fetch PYMK suggestions"},
        ) from exc

    if page_start == 0:
        cache_service.store(user_id, parsed_cohort.value, normalized_cohort_id, result)

    return result
