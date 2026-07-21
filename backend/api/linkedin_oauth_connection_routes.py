"""
LinkedIn OAuth & connection management routes — authorization URL, sync, callback,
disconnect, and connection status. Split out of the original linkedin_social_routes.py monolith.
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
from models.linkedin_social_models import LinkedInConnectionStatusResponse
from services.integrations.linkedin.factory import get_linkedin_provider
from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.integrations.linkedin.unipile_client import UnipileAPIError
from services.integrations.linkedin.unipile_health import (
    check_unipile_health,
    get_cached_unipile_health,
)
from services.integrations.linkedin_oauth import LinkedInOAuthService
from services.integrations.oauth_callback_utils import (
    build_oauth_callback_html,
    sanitize_error,
)

router = APIRouter(prefix="/api/linkedin-social", tags=["LinkedIn Social"])

_oauth_service = LinkedInOAuthService()


def _user_id(current_user: dict) -> str:
    uid = current_user.get("id") if current_user else None
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return str(uid)


class LinkedInAuthCallbackRequest(BaseModel):
    code: Optional[str] = None
    state: Optional[str] = None


async def _resolve_linkedin_callback_user(
    request: Request,
    alwrity_state: Optional[str] = None,
    state: Optional[str] = None,
    name: Optional[str] = None,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    """Resolve callback user from Clerk session, Unipile name, or validated OAuth state."""
    if credentials and credentials.credentials:
        user = await clerk_auth.verify_token(credentials.credentials)
        if user and user.get("id"):
            return str(user["id"])

    unipile_user_id = (name or request.query_params.get("name") or "").strip()
    if unipile_user_id:
        logger.info(
            f"[LinkedInConnect] Resolved callback user from Unipile name={unipile_user_id}"
        )
        return unipile_user_id

    oauth_state = alwrity_state or state or request.query_params.get("alwrity_state")
    if oauth_state:
        if ":" in oauth_state:
            user_id = _oauth_service.peek_oauth_state_user(oauth_state)
            if user_id:
                return user_id
        if oauth_state.startswith("user_"):
            return oauth_state

    raise HTTPException(
        status_code=401, detail="Authentication required for LinkedIn callback"
    )


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


@router.get("/unipile/health")
async def get_unipile_health(
    refresh: bool = Query(
        False,
        description="When true, re-run the Unipile API credential probe instead of returning the cached startup result.",
    ),
) -> Dict[str, Any]:
    """
    Report Unipile configuration and credential validity for LinkedIn Connect.

    Safe for pre-connect diagnostics: never returns the API key value.
    """
    if refresh:
        result = await check_unipile_health(probe_api=True)
    else:
        result = get_cached_unipile_health()
        if result is None:
            result = await check_unipile_health(probe_api=True)

    if result.get("healthy"):
        return result

    raise HTTPException(
        status_code=503,
        detail=result,
    )


@router.get("/auth/url")
async def get_authorization_url(
    state: Optional[str] = None,
    callback_base: Optional[str] = Query(
        None,
        description="Optional backend base URL for OAuth redirect (localhost dev)",
    ),
    current_user: dict = Depends(get_current_user),
) -> Dict[str, str]:
    """Return OAuth authorization URL for Unipile or native LinkedIn connect."""
    user_id = _user_id(current_user)
    logger.info(f"[LinkedInConnect] auth URL requested user_id={user_id}")
    try:
        oauth_state = state or str(uuid.uuid4())
        validated_callback_base = _oauth_service.validate_callback_base(callback_base)
        payload = await _oauth_service.generate_authorization_url(
            user_id,
            oauth_state,
            callback_base=validated_callback_base,
        )
        logger.info(
            f"[LinkedInConnect] auth URL generated user_id={user_id} provider={payload.get('provider')}"
        )
        return {
            "authorization_url": payload["auth_url"],
            "state": payload["state"],
            "provider": payload["provider"],
        }
    except ValueError as e:
        error_str = str(e).lower()
        if "unipile_api_key is not configured" in error_str:
            logger.error(f"[LinkedInConnect] missing UNIPILE_API_KEY user_id={user_id}")
        else:
            logger.warning(f"[LinkedInConnect] configuration error user_id={user_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e)) from e
    except UnipileAPIError as e:
        status = e.status_code or 502
        logger.warning(f"[LinkedInConnect] auth URL Unipile error user_id={user_id}: {e}")
        raise HTTPException(status_code=status, detail=str(e)) from e
    except Exception as e:
        logger.exception(f"[LinkedInConnect] auth URL failed user_id={user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/sync")
async def sync_linkedin_accounts(
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Best-effort Unipile account sync when credentials exist remotely."""
    user_id = _user_id(current_user)
    try:
        synced = await _oauth_service.try_sync_unipile_accounts(user_id)
        status = _oauth_service.get_connection_status(user_id)
        return {
            "success": synced or bool(status.get("connected")),
            "accounts": status.get("accounts") or [],
        }
    except LinkedInNotConnectedError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception(f"[LinkedInConnect] manual sync failed user_id={user_id}: {e}")
        raise HTTPException(status_code=502, detail=str(e)) from e


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
    provider: Optional[str] = Query(None, description="OAuth provider (unipile, native)"),
    status: Optional[str] = Query(None, description="Connection status (success, error)"),
    message: Optional[str] = Query(None, description="Error message if status is error"),
    name: Optional[str] = Query(None, description="User ID passed to Unipile as 'name' param"),
    user_id: str = Depends(_resolve_linkedin_callback_user),
) -> HTMLResponse:
    """HTML OAuth callback that stores credentials and notifies opener via postMessage.

    Handles callbacks from:
    - Unipile: provider=unipile, status=success|error, account_id, name
    - Native LinkedIn: code, state params
    """
    try:
        resolved_account_id = accountId or account_id

        # Detect Unipile callback
        is_unipile_redirect = provider == "unipile"
        if is_unipile_redirect:
            logger.info(
                f"[LinkedInConnect] Unipile callback user_id={user_id} "
                f"status={status} account_id_present={bool(resolved_account_id)}"
            )

            if status == "error":
                error_msg = message or "Unipile authentication failed"
                logger.error(f"[LinkedInConnect] Unipile callback error user_id={user_id}: {error_msg}")
                html = build_oauth_callback_html(
                    payload={
                        "type": "LINKEDIN_OAUTH_ERROR",
                        "success": False,
                        "provider": "unipile",
                        "error": error_msg,
                    },
                    title="LinkedIn Connection Failed",
                    heading="Connection Failed",
                    message=f"LinkedIn connection failed: {error_msg}. You can close this window and try again.",
                )
                return HTMLResponse(content=html)

            # Success case - store credentials (account_id may arrive via notify_url only)
            if resolved_account_id:
                ok = await _oauth_service.handle_unipile_callback(
                    user_id=user_id,
                    account_id=resolved_account_id,
                    status="success",
                )
                if not ok:
                    raise HTTPException(
                        status_code=400, detail="Failed to store Unipile credentials"
                    )
            else:
                logger.warning(
                    f"[LinkedInConnect] Unipile callback missing account_id user_id={user_id}; "
                    "attempting account sync (notify_url may have already stored credentials)"
                )
                await _oauth_service.try_sync_unipile_accounts(user_id)

            status_after = _oauth_service.get_connection_status(user_id)
            if not status_after.get("connected"):
                logger.warning(
                    f"[LinkedInConnect] Unipile browser callback complete but not connected yet "
                    f"user_id={user_id}; client will poll status or wait for webhook"
                )

            logger.info(f"[LinkedInConnect] Unipile callback succeeded user_id={user_id}")
            payload = {
                "type": "LINKEDIN_OAUTH_SUCCESS",
                "success": True,
                "provider": "unipile",
            }
            html = build_oauth_callback_html(
                payload=payload,
                title="LinkedIn Connected",
                heading="Connection Successful",
                message="Your LinkedIn account was connected via Unipile. You can close this window.",
            )
            return HTMLResponse(
                content=html,
                headers={
                    "Cross-Origin-Opener-Policy": "unsafe-none",
                    "Cross-Origin-Embedder-Policy": "unsafe-none",
                },
            )

        # Native LinkedIn OAuth
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
        result = await _oauth_service.disconnect_user(user_id)
        logger.info(
            f"[LinkedInConnect] disconnect completed user_id={user_id} "
            f"revoked={result.get('revoked')} unipile_account_deleted={result.get('unipile_account_deleted')}"
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
