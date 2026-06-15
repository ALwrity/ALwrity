"""
LinkedIn Social API routes (Growth Engine — connect, analytics).

Separate from routers/linkedin.py (content generation / LinkedIn Writer).
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPAuthorizationCredentials
from loguru import logger
from pydantic import BaseModel

from middleware.auth_middleware import clerk_auth, get_current_user, security
from models.linkedin_social_models import (
    LinkedInAccountsListResponse,
    LinkedInAccountResponse,
    LinkedInAnalyticsResponse,
    LinkedInConnectionStatusResponse,
    LinkedInLandingAnalyticsResponse,
    LinkedInOrganizationResponse,
    LinkedInOrganizationsListResponse,
)
from services.integrations.linkedin.factory import get_linkedin_provider
from services.integrations.linkedin.landing_analytics import build_landing_analytics_payload
from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.integrations.linkedin.zernio_client import ZernioAPIError
from services.integrations.linkedin_oauth import LinkedInOAuthService
from services.integrations.oauth_callback_utils import (
    build_oauth_callback_html,
    sanitize_error,
)

router = APIRouter(prefix="/api/linkedin-social", tags=["LinkedIn Social"])

_oauth_service = LinkedInOAuthService()


class LinkedInAuthCallbackRequest(BaseModel):
    code: Optional[str] = None
    state: Optional[str] = None


def _user_id(current_user: dict) -> str:
    uid = current_user.get("id") if current_user else None
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return str(uid)


async def _resolve_linkedin_callback_user(
    request: Request,
    alwrity_state: Optional[str] = None,
    state: Optional[str] = None,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    """Resolve callback user from Clerk session or validated OAuth state."""
    if credentials and credentials.credentials:
        user = await clerk_auth.verify_token(credentials.credentials)
        if user and user.get("id"):
            return str(user["id"])

    oauth_state = alwrity_state or state or request.query_params.get("alwrity_state")
    if oauth_state:
        user_id = _oauth_service.peek_oauth_state_user(oauth_state)
        if user_id:
            return user_id

    raise HTTPException(status_code=401, detail="Authentication required for LinkedIn callback")


def _resolve_user_account_id(user_id: str, account_id: Optional[str]) -> str:
    if account_id:
        return account_id
    creds = _oauth_service.resolve_credentials(user_id)
    resolved = creds.primary_account_id
    if not resolved:
        raise HTTPException(
            status_code=400,
            detail="account_id query param is required when no default LinkedIn account is stored",
        )
    return resolved


@router.get("/connection/status", response_model=LinkedInConnectionStatusResponse)
async def get_connection_status(
    current_user: dict = Depends(get_current_user),
) -> LinkedInConnectionStatusResponse:
    """Return LinkedIn connection state for the authenticated user."""
    user_id = _user_id(current_user)
    status = _oauth_service.get_connection_status(user_id)

    organizations: List[Dict[str, Any]] = []
    if status.get("connected") and status.get("accounts"):
        primary_account = status["accounts"][0].get("account_id")
        if primary_account:
            try:
                provider = get_linkedin_provider()
                orgs = await provider.list_organizations(user_id, primary_account)
                organizations = [
                    {
                        "organization_id": o.organization_id,
                        "name": o.name,
                        "urn": o.urn,
                    }
                    for o in orgs
                ]
            except Exception as e:
                logger.warning(f"Could not load organizations for status: {e}")

    status["organizations"] = organizations
    return LinkedInConnectionStatusResponse(**status)


@router.get("/auth/url")
async def get_authorization_url(
    state: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, str]:
    """Return OAuth authorization URL for Zernio or native LinkedIn connect."""
    user_id = _user_id(current_user)
    logger.info(f"[LinkedInConnect] auth URL requested user_id={user_id}")
    try:
        oauth_state = state or str(uuid.uuid4())
        payload = _oauth_service.generate_authorization_url(user_id, oauth_state)
        logger.info(
            f"[LinkedInConnect] auth URL generated user_id={user_id} provider={payload.get('provider')}"
        )
        return {
            "authorization_url": payload["auth_url"],
            "state": payload["state"],
            "provider": payload["provider"],
        }
    except ValueError as e:
        if "ZERNIO_API_KEY" in str(e):
            logger.error(f"[LinkedInConnect] missing ZERNIO_API_KEY user_id={user_id}")
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception(f"[LinkedInConnect] auth URL failed user_id={user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/callback")
async def handle_oauth_callback_get(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    connected: Optional[str] = None,
    accountId: Optional[str] = None,
    account_id: Optional[str] = None,
    username: Optional[str] = None,
    alwrity_state: Optional[str] = None,
    user_id: str = Depends(_resolve_linkedin_callback_user),
) -> HTMLResponse:
    """HTML OAuth callback that stores credentials and notifies opener via postMessage."""
    try:
        resolved_account_id = accountId or account_id
        is_zernio_redirect = connected == "linkedin" or bool(resolved_account_id)

        if is_zernio_redirect:
            logger.info(
                f"[LinkedInConnect] Zernio callback user_id={user_id} "
                f"account_id_present={bool(resolved_account_id)}"
            )
            query_params = dict(request.query_params)
            ok = _oauth_service.handle_zernio_connect_callback(user_id, query_params)
            if not ok:
                raise HTTPException(status_code=400, detail="Zernio connect callback failed")
            logger.info(f"[LinkedInConnect] Zernio callback succeeded user_id={user_id}")
            payload = {
                "type": "LINKEDIN_OAUTH_SUCCESS",
                "success": True,
                "provider": "zernio",
            }
            html = build_oauth_callback_html(
                payload=payload,
                title="LinkedIn Connected",
                heading="Connection Successful",
                message="Your LinkedIn account was connected. You can close this window.",
            )
            return HTMLResponse(
                content=html,
                headers={
                    "Cross-Origin-Opener-Policy": "unsafe-none",
                    "Cross-Origin-Embedder-Policy": "unsafe-none",
                },
            )

        if not code or not state:
            raise HTTPException(status_code=400, detail="Missing OAuth code or state")

        token_result = _oauth_service.handle_native_oauth_callback(user_id, code, state)
        if not token_result:
            raise HTTPException(status_code=400, detail="LinkedIn OAuth token exchange failed")

        payload = {
            "type": "LINKEDIN_OAUTH_SUCCESS",
            "success": True,
            "provider": "native",
        }
        html = build_oauth_callback_html(
            payload=payload,
            title="LinkedIn Connected",
            heading="Connection Successful",
            message="Your LinkedIn account was connected. You can close this window.",
        )
        return HTMLResponse(
            content=html,
            headers={
                "Cross-Origin-Opener-Policy": "unsafe-none",
                "Cross-Origin-Embedder-Policy": "unsafe-none",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[LinkedInConnect] OAuth GET callback failed user_id={user_id}: {e}")
        html = build_oauth_callback_html(
            payload={
                "type": "LINKEDIN_OAUTH_ERROR",
                "success": False,
                "error": sanitize_error(e),
            },
            title="LinkedIn Connection Failed",
            heading="Connection Failed",
            message="LinkedIn connection failed. You can close this window and try again.",
        )
        return HTMLResponse(content=html)


@router.post("/auth/callback")
async def handle_oauth_callback_post(
    body: LinkedInAuthCallbackRequest,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """SPA fallback for native LinkedIn OAuth code exchange."""
    user_id = _user_id(current_user)
    if not body.code or not body.state:
        raise HTTPException(status_code=400, detail="Missing OAuth code or state")
    token_result = _oauth_service.handle_native_oauth_callback(
        user_id, body.code, body.state
    )
    if not token_result:
        raise HTTPException(status_code=400, detail="LinkedIn OAuth token exchange failed")
    status = _oauth_service.get_connection_status(user_id)
    return {"success": True, "connected": status.get("connected", False)}


@router.post("/disconnect")
async def disconnect_linkedin(
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Disconnect per-user LinkedIn credentials (soft-delete tokens)."""
    user_id = _user_id(current_user)
    logger.info(f"[LinkedInConnect] disconnect requested user_id={user_id}")
    try:
        result = _oauth_service.disconnect_user(user_id)
        logger.info(
            f"[LinkedInConnect] disconnect completed user_id={user_id} "
            f"revoked={result.get('revoked')} zernio_account_deleted={result.get('zernio_account_deleted')}"
        )
        return {
            "success": result.get("success", False),
            "connected": result.get("connected", False),
            "has_env_fallback": False,
            "message": "LinkedIn account disconnected successfully",
        }
    except Exception as e:
        logger.exception(f"[LinkedInConnect] disconnect failed user_id={user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/accounts", response_model=LinkedInAccountsListResponse)
async def list_accounts(
    current_user: dict = Depends(get_current_user),
) -> LinkedInAccountsListResponse:
    """List LinkedIn accounts available to the user via the configured provider."""
    user_id = _user_id(current_user)
    provider = get_linkedin_provider()
    try:
        accounts = await provider.list_accounts(user_id)
    except LinkedInNotConnectedError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    except Exception as e:
        logger.error(f"list_accounts failed for user {user_id}: {e}")
        raise HTTPException(status_code=502, detail=str(e)) from e

    return LinkedInAccountsListResponse(
        accounts=[
            LinkedInAccountResponse(
                account_id=a.account_id,
                account_type=a.account_type,
                username=a.username,
                avatar_url=a.avatar_url,
                platform=a.platform,
            )
            for a in accounts
        ],
        provider=provider.provider_name,
    )


@router.get("/organizations", response_model=LinkedInOrganizationsListResponse)
async def list_organizations(
    account_id: str = Query(..., description="Zernio LinkedIn account id"),
    current_user: dict = Depends(get_current_user),
) -> LinkedInOrganizationsListResponse:
    """List LinkedIn company pages for an account."""
    user_id = _user_id(current_user)
    provider = get_linkedin_provider()
    try:
        orgs = await provider.list_organizations(user_id, account_id)
    except LinkedInNotConnectedError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    except Exception as e:
        logger.error(f"list_organizations failed for user {user_id}: {e}")
        raise HTTPException(status_code=502, detail=str(e)) from e

    return LinkedInOrganizationsListResponse(
        account_id=account_id,
        organizations=[
            LinkedInOrganizationResponse(
                organization_id=o.organization_id,
                name=o.name,
                urn=o.urn,
            )
            for o in orgs
        ],
    )


@router.get("/analytics/landing", response_model=LinkedInLandingAnalyticsResponse)
async def get_landing_analytics(
    current_user: dict = Depends(get_current_user),
) -> LinkedInLandingAnalyticsResponse:
    """Rolling last-7-day personal + org analytics for the LinkedIn Writer landing page."""
    user_id = _user_id(current_user)
    provider = get_linkedin_provider()
    try:
        payload = await build_landing_analytics_payload(
            user_id, provider, _oauth_service
        )
        return LinkedInLandingAnalyticsResponse(**payload)
    except LinkedInNotConnectedError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    except ZernioAPIError as e:
        status = e.status_code or 502
        if status in (402, 403, 412):
            raise HTTPException(status_code=status, detail=str(e)) from e
        logger.warning(f"[LinkedInAnalytics] landing Zernio error user_id={user_id}: {e}")
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:
        logger.exception(f"[LinkedInAnalytics] landing failed user_id={user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to load LinkedIn analytics") from e


@router.get("/analytics/profile", response_model=LinkedInAnalyticsResponse)
async def get_profile_analytics(
    account_id: Optional[str] = Query(None, description="Defaults to connected personal account"),
    aggregation: str = Query("TOTAL", pattern="^(TOTAL|DAILY)$"),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD (exclusive)"),
    metrics: Optional[str] = Query(None, description="Comma-separated metrics"),
    current_user: dict = Depends(get_current_user),
) -> LinkedInAnalyticsResponse:
    """Fetch LinkedIn personal profile aggregate analytics."""
    user_id = _user_id(current_user)
    provider = get_linkedin_provider()
    metric_list = [m.strip().upper() for m in metrics.split(",")] if metrics else None
    try:
        resolved_account = _resolve_user_account_id(user_id, account_id)
    except LinkedInNotConnectedError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    try:
        data = await provider.get_profile_aggregate_analytics(
            user_id,
            resolved_account,
            aggregation=aggregation,  # type: ignore[arg-type]
            start_date=start_date,
            end_date=end_date,
            metrics=metric_list,
        )
    except LinkedInNotConnectedError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    except Exception as e:
        logger.error(f"profile analytics failed for user {user_id}: {e}")
        raise HTTPException(status_code=502, detail=str(e)) from e

    return LinkedInAnalyticsResponse(data=data, provider=provider.provider_name)


@router.get("/analytics/org", response_model=LinkedInAnalyticsResponse)
async def get_org_analytics(
    account_id: Optional[str] = Query(None, description="Defaults to connected org account"),
    since: Optional[str] = Query(None, description="YYYY-MM-DD"),
    until: Optional[str] = Query(None, description="YYYY-MM-DD"),
    metric_type: str = Query("total_value", pattern="^(total_value|time_series)$"),
    metrics: Optional[str] = Query(None, description="Comma-separated org metrics"),
    current_user: dict = Depends(get_current_user),
) -> LinkedInAnalyticsResponse:
    """Fetch LinkedIn organization page aggregate analytics."""
    user_id = _user_id(current_user)
    provider = get_linkedin_provider()
    metric_list = [m.strip().lower() for m in metrics.split(",")] if metrics else None
    try:
        creds = _oauth_service.resolve_credentials(user_id)
        resolved_account = account_id or creds.zernio_org_account_id or creds.zernio_account_id
        if not resolved_account:
            raise HTTPException(
                status_code=400,
                detail="account_id query param is required when no org account is connected",
            )
    except LinkedInNotConnectedError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    try:
        data = await provider.get_org_aggregate_analytics(
            user_id,
            resolved_account,
            since=since,
            until=until,
            metric_type=metric_type,  # type: ignore[arg-type]
            metrics=metric_list,
        )
    except LinkedInNotConnectedError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    except Exception as e:
        logger.error(f"org analytics failed for user {user_id}: {e}")
        raise HTTPException(status_code=502, detail=str(e)) from e

    return LinkedInAnalyticsResponse(data=data, provider=provider.provider_name)


@router.get("/analytics/post", response_model=LinkedInAnalyticsResponse)
async def get_post_analytics(
    urn: str = Query(..., description="LinkedIn post URN"),
    account_id: Optional[str] = Query(None, description="Defaults to connected personal account"),
    current_user: dict = Depends(get_current_user),
) -> LinkedInAnalyticsResponse:
    """Fetch analytics for a single LinkedIn post by URN."""
    user_id = _user_id(current_user)
    provider = get_linkedin_provider()
    try:
        resolved_account = _resolve_user_account_id(user_id, account_id)
    except LinkedInNotConnectedError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    try:
        data = await provider.get_post_analytics(user_id, resolved_account, urn)
    except LinkedInNotConnectedError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    except Exception as e:
        logger.error(f"post analytics failed for user {user_id}: {e}")
        raise HTTPException(status_code=502, detail=str(e)) from e

    return LinkedInAnalyticsResponse(data=data, provider=provider.provider_name)
