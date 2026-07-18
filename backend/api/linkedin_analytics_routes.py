"""
LinkedIn aggregate analytics routes (profile / org / landing).

Kept separate from linkedin_social_routes.py (file already >500 lines).
Unipile aggregate analytics are not implemented yet — endpoints return 501.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger

from middleware.auth_middleware import get_current_user
from models.linkedin_social_models import (
    LinkedInAnalyticsResponse,
    LinkedInLandingAnalyticsResponse,
    LinkedInPersonalAnalyticsResponse,
)
from services.integrations.linkedin.factory import get_linkedin_provider
from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.integrations.linkedin_oauth import LinkedInOAuthService

router = APIRouter(prefix="/api/linkedin-social", tags=["LinkedIn Social Analytics"])
_oauth_service = LinkedInOAuthService()

_UNAVAILABLE = (
    "LinkedIn profile and organization aggregate analytics are not available yet "
    "for Unipile. Reconnect LinkedIn if needed; this endpoint will return data "
    "when Unipile analytics ships."
)


def _user_id(current_user: dict) -> str:
    uid = current_user.get("id") if current_user else None
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return str(uid)


def _ensure_connected(user_id: str) -> None:
    try:
        _oauth_service.resolve_credentials(user_id)
    except LinkedInNotConnectedError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.get("/analytics/landing", response_model=LinkedInLandingAnalyticsResponse)
async def get_landing_analytics(
    current_user: dict = Depends(get_current_user),
) -> LinkedInLandingAnalyticsResponse:
    """Landing analytics — not yet available via Unipile."""
    user_id = _user_id(current_user)
    _ensure_connected(user_id)
    logger.info(f"[LinkedInAnalytics] landing unavailable (Unipile) user_id={user_id}")
    raise HTTPException(status_code=501, detail=_UNAVAILABLE)


@router.get("/analytics/personal", response_model=LinkedInPersonalAnalyticsResponse)
async def get_personal_analytics(
    preset_days: Optional[int] = Query(None, alias="presetDays"),
    start_date: Optional[str] = Query(None, alias="startDate"),
    end_date: Optional[str] = Query(None, alias="endDate"),
    current_user: dict = Depends(get_current_user),
) -> LinkedInPersonalAnalyticsResponse:
    """Personal aggregate analytics — not yet available via Unipile."""
    user_id = _user_id(current_user)
    _ensure_connected(user_id)
    logger.info(
        f"[LinkedInAnalytics] personal unavailable (Unipile) user_id={user_id} "
        f"preset_days={preset_days} start={start_date} end={end_date}"
    )
    raise HTTPException(status_code=501, detail=_UNAVAILABLE)


@router.get("/analytics/profile", response_model=LinkedInAnalyticsResponse)
async def get_profile_analytics(
    account_id: Optional[str] = Query(None),
    aggregation: str = Query("TOTAL", pattern="^(TOTAL|DAILY)$"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    metrics: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
) -> LinkedInAnalyticsResponse:
    """Profile aggregate analytics — not yet available via Unipile."""
    user_id = _user_id(current_user)
    _ensure_connected(user_id)
    logger.info(
        f"[LinkedInAnalytics] profile unavailable (Unipile) user_id={user_id} "
        f"account_id={account_id} aggregation={aggregation}"
    )
    raise HTTPException(status_code=501, detail=_UNAVAILABLE)


@router.get("/analytics/org", response_model=LinkedInAnalyticsResponse)
async def get_org_analytics(
    account_id: Optional[str] = Query(None),
    since: Optional[str] = Query(None),
    until: Optional[str] = Query(None),
    metric_type: str = Query("total_value", pattern="^(total_value|time_series)$"),
    metrics: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
) -> LinkedInAnalyticsResponse:
    """Organization aggregate analytics — not yet available via Unipile."""
    user_id = _user_id(current_user)
    try:
        creds = _oauth_service.resolve_credentials(user_id)
        resolved = account_id or creds.org_account_id
        if not resolved:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No LinkedIn organization account is connected. "
                    "Connect a company page before requesting org analytics."
                ),
            )
    except LinkedInNotConnectedError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    logger.info(
        f"[LinkedInAnalytics] org unavailable (Unipile) user_id={user_id} "
        f"account_id={resolved} metric_type={metric_type}"
    )
    raise HTTPException(status_code=501, detail=_UNAVAILABLE)


@router.get("/analytics/post", response_model=LinkedInAnalyticsResponse)
async def get_post_analytics(
    urn: str = Query(..., description="LinkedIn post URN"),
    account_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
) -> LinkedInAnalyticsResponse:
    """
    Single-post analytics via the configured provider.

    Unipile may still raise NotImplementedError; return a clear 501 in that case.
    """
    user_id = _user_id(current_user)
    provider = get_linkedin_provider()
    try:
        creds = _oauth_service.resolve_credentials(user_id)
        resolved_account = account_id or creds.primary_account_id
        if not resolved_account:
            raise LinkedInNotConnectedError("No LinkedIn personal account is connected")
        data = await provider.get_post_analytics(user_id, resolved_account, urn)
    except LinkedInNotConnectedError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except NotImplementedError as exc:
        logger.info(f"[LinkedInAnalytics] post unavailable user_id={user_id}: {exc}")
        raise HTTPException(status_code=501, detail=str(exc) or _UNAVAILABLE) from exc
    except Exception as exc:
        logger.error(f"post analytics failed for user {user_id}: {exc}")
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return LinkedInAnalyticsResponse(data=data, provider=provider.provider_name)
