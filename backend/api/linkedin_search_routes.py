"""
LinkedIn Studio search API routes — Unipile Classic Search proxy.

Thin routes delegating to linkedin_search_service. Kept separate from
linkedin_social_routes.py to avoid further growth of that module.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger

from middleware.auth_middleware import get_current_user
from models.linkedin_search_models import (
    LinkedInSearchParametersResponse,
    LinkedInSearchRequest,
    LinkedInSearchResponse,
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
