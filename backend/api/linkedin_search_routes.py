"""
LinkedIn Studio search API routes — Unipile Classic Search proxy.

Thin routes delegating to linkedin_search_service. Kept separate from
linkedin_social_routes.py to avoid further growth of that module.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

import os

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger

from middleware.auth_middleware import get_current_user
from models.linkedin_search_models import (
    LinkedInIndustriesCacheResponse,
    LinkedInSearchParametersResponse,
    LinkedInSearchRequest,
    LinkedInSearchResponse,
)
from services.integrations.linkedin.linkedin_industry_cache_service import (
    get_industries,
)
from services.integrations.linkedin.linkedin_industry_sync_job import (
    sync_linkedin_industries_scheduled,
)
from services.integrations.linkedin.linkedin_search_service import (
    LinkedInSearchNotAvailableError,
    LinkedInSearchValidationError,
    get_search_parameters,
    perform_search,
)
from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.integrations.linkedin.unipile_client import UnipileAPIError


router = APIRouter(prefix="/api/linkedin-social", tags=["LinkedIn Social Search"])


def _user_id(current_user: dict) -> str:
    uid = current_user.get("id") if current_user else None
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return str(uid)


def _ensure_admin(current_user: dict) -> None:
    """Restrict manual industry sync to admin users."""
    disable_auth = os.getenv("DISABLE_AUTH", "false").lower() == "true"
    if disable_auth:
        return

    email = (current_user.get("email") or "").lower()
    role = None
    public_metadata = current_user.get("public_metadata")
    if isinstance(public_metadata, dict):
        role = public_metadata.get("role") or current_user.get("role")
    else:
        role = current_user.get("role")

    admin_emails_raw = os.getenv("ADMIN_EMAILS", "")
    admin_emails = {
        item.strip().lower() for item in admin_emails_raw.split(",") if item.strip()
    }
    admin_domain = (os.getenv("ADMIN_EMAIL_DOMAIN") or "").lower().strip()

    is_admin_email = bool(email and email in admin_emails)
    is_admin_domain = bool(email and admin_domain and email.endswith("@" + admin_domain))
    is_admin_role = role == "admin"

    if not (is_admin_email or is_admin_domain or is_admin_role):
        raise HTTPException(status_code=403, detail="Admin access required")


def _raise_search_http_error(exc: Exception, *, user_id: str, operation: str) -> None:
    """Map search service failures to HTTP responses."""
    if isinstance(exc, LinkedInSearchNotAvailableError):
        logger.warning(
            "[LinkedInSearch] {} unavailable user_id={}: {}",
            operation,
            user_id,
            exc,
        )
        raise HTTPException(
            status_code=503,
            detail="LinkedIn search is not available with the current provider configuration.",
        ) from exc

    if isinstance(exc, LinkedInNotConnectedError):
        logger.warning(
            "[LinkedInSearch] {} not connected user_id={}: {}",
            operation,
            user_id,
            exc,
        )
        raise HTTPException(
            status_code=403,
            detail="LinkedIn account not connected",
        ) from exc

    if isinstance(exc, LinkedInSearchValidationError):
        logger.warning(
            "[LinkedInSearch] {} validation user_id={}: {}",
            operation,
            user_id,
            exc,
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if isinstance(exc, UnipileAPIError):
        status = exc.status_code
        message = str(exc).lower()
        if status == 429:
            logger.warning(
                "[LinkedInSearch] {} rate limited user_id={}: {}",
                operation,
                user_id,
                exc,
            )
            raise HTTPException(
                status_code=429,
                detail="LinkedIn search rate limit reached. Please try again shortly.",
            ) from exc
        if status == 401 or "disconnected" in message or "reconnect" in message:
            logger.warning(
                "[LinkedInSearch] {} reconnect required user_id={}: {}",
                operation,
                user_id,
                exc,
            )
            raise HTTPException(status_code=401, detail="Reconnect required") from exc
        logger.warning(
            "[LinkedInSearch] {} Unipile error user_id={}: {}",
            operation,
            user_id,
            exc,
        )
        raise HTTPException(
            status_code=502,
            detail="Unable to complete LinkedIn search",
        ) from exc

    logger.exception(
        "[LinkedInSearch] {} unexpected error user_id={}: {}",
        operation,
        user_id,
        exc,
    )
    raise HTTPException(
        status_code=500,
        detail="An unexpected error occurred during LinkedIn search",
    ) from exc


@router.post("/search", response_model=LinkedInSearchResponse)
async def perform_linkedin_search(
    body: LinkedInSearchRequest,
    current_user: dict = Depends(get_current_user),
) -> LinkedInSearchResponse:
    """Perform a LinkedIn Classic search via Unipile for the connected account."""
    user_id = _user_id(current_user)
    logger.info(
        "[LinkedInSearch] POST /search user_id={} category={} keywords_len={}",
        user_id,
        body.category,
        len(body.keywords.strip()),
    )
    try:
        return await perform_search(user_id, body)
    except HTTPException:
        raise
    except Exception as exc:
        _raise_search_http_error(exc, user_id=user_id, operation="POST /search")


@router.get("/search/parameters", response_model=LinkedInSearchParametersResponse)
async def get_linkedin_search_parameters(
    type: str = Query(..., description="Unipile parameter type, e.g. LOCATION"),
    keywords: Optional[str] = Query(None, description="Narrow parameter lookup"),
    limit: int = Query(10, ge=1, le=100),
    service: str = Query("CLASSIC", description="CLASSIC, RECRUITER, or SALES_NAVIGATOR"),
    account_id: Optional[str] = Query(None, description="Optional Unipile account override"),
    current_user: dict = Depends(get_current_user),
) -> LinkedInSearchParametersResponse:
    """Retrieve LinkedIn search parameter IDs for filter autocomplete."""
    user_id = _user_id(current_user)
    logger.info(
        "[LinkedInSearch] GET /search/parameters user_id={} type={} keywords={!r}",
        user_id,
        type,
        keywords,
    )
    try:
        return await get_search_parameters(
            user_id,
            type,
            keywords=keywords,
            limit=limit,
            service=service,
            account_id=account_id,
        )
    except HTTPException:
        raise
    except Exception as exc:
        _raise_search_http_error(exc, user_id=user_id, operation="GET /search/parameters")


@router.get("/industries", response_model=LinkedInIndustriesCacheResponse)
async def get_linkedin_industries(
    current_user: dict = Depends(get_current_user),
) -> LinkedInIndustriesCacheResponse:
    """Return cached LinkedIn industry titles for persona autocomplete."""
    user_id = _user_id(current_user)
    logger.info("[LinkedInIndustryCache] GET /industries user_id={}", user_id)
    try:
        payload = get_industries()
        return LinkedInIndustriesCacheResponse(
            success=True,
            items=payload["items"],
            synced_at=payload.get("synced_at"),
            item_count=payload.get("item_count", 0),
            cache_status=payload.get("cache_status", "empty"),
        )
    except Exception as exc:
        logger.exception(
            "[LinkedInIndustryCache] GET /industries failed user_id={}: {}",
            user_id,
            exc,
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to load LinkedIn industry cache",
        ) from exc


@router.post("/industries/sync")
async def sync_linkedin_industries_manual(
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Admin-only manual refresh of the LinkedIn industry cache."""
    user_id = _user_id(current_user)
    _ensure_admin(current_user)
    logger.info("[LinkedInIndustrySync] POST /industries/sync user_id={}", user_id)
    try:
        result = await sync_linkedin_industries_scheduled()
        if not result.get("success"):
            raise HTTPException(
                status_code=503,
                detail=result.get("reason") or "Industry sync did not produce any items",
            )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "[LinkedInIndustrySync] POST /industries/sync failed user_id={}: {}",
            user_id,
            exc,
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to sync LinkedIn industry cache",
        ) from exc
