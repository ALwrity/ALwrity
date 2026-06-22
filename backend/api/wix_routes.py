"""
Wix Integration API Routes

Handles Wix authentication, connection status, and blog publishing.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import HTMLResponse
from typing import Dict, Any, Optional, List, Tuple
from collections import defaultdict
from loguru import logger
from pydantic import BaseModel
import os
import uuid
import requests
import time

from services.wix_service import WixService
from services.integrations.wix_oauth import WixOAuthService
from services.integrations.wix.utils import extract_meta_from_token
from services.integrations.oauth_callback_utils import (
    build_oauth_callback_html,
    sanitize_error,
)
from middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/api/wix", tags=["Wix Integration"])
qa_router = APIRouter(prefix="/api/wix/test", tags=["Wix Integration QA"])


# Initialize Wix service
wix_service = WixService()

# Initialize Wix OAuth service for token storage
wix_oauth_service = WixOAuthService()

# ---------------------------------------------------------------------------
# Rate limiting for 401 recovery — prevents rapid retry loops when Wix
# keeps rejecting freshly refreshed tokens (e.g. account revoked, site
# deleted, experiment routing issues). In-memory per-process state is
# "approximately correct" for production: the exact limit is per-worker,
# but the worst case is bounded in each process.
# ---------------------------------------------------------------------------
_recovery_attempts: Dict[str, List[float]] = defaultdict(list)
_RECOVERY_COOLDOWN_SECONDS = 30      # Minimum seconds between recovery attempts per user
_MAX_RECOVERIES_PER_WINDOW = 5       # Max recovery attempts per rolling window
_RECOVERY_WINDOW_SECONDS = 300       # Rolling window length (5 minutes)


def _allow_recovery(user_id: str) -> Tuple[bool, Optional[str]]:
    """
    Check whether a token recovery (401 → refresh → retry) is allowed
    for *user_id* based on recent attempt history. Resets on successful
    API calls that don't trigger recovery.

    Returns:
        (allowed, reason) — ``allowed`` is ``True`` when the recovery
        may proceed; ``reason`` is a short string suitable for log
        messages when denied.
    """
    now = time.time()
    window_start = now - _RECOVERY_WINDOW_SECONDS

    # Purge entries outside the rolling window
    recent = [ts for ts in _recovery_attempts.get(user_id, []) if ts > window_start]
    _recovery_attempts[user_id] = recent

    # Cooldown: must be at least N seconds since the last attempt
    if recent and (now - recent[-1]) < _RECOVERY_COOLDOWN_SECONDS:
        return False, "cooldown active"

    # Rate cap: at most N attempts per rolling window
    if len(recent) >= _MAX_RECOVERIES_PER_WINDOW:
        return False, f"rate limit ({len(recent)}/{_RECOVERY_WINDOW_SECONDS // 60}min)"

    return True, None


def _record_recovery(user_id: str) -> None:
    """Record a recovery attempt for rate limiting."""
    now = time.time()
    window_start = now - _RECOVERY_WINDOW_SECONDS
    recent = [ts for ts in _recovery_attempts.get(user_id, []) if ts > window_start]
    recent.append(now)
    _recovery_attempts[user_id] = recent


def _clear_recovery_state(user_id: str) -> None:
    """Called after a successful API call (no 401) to reset the rate limiter."""
    _recovery_attempts.pop(user_id, None)


def _get_current_user_id(current_user: dict) -> str:
    user_id = current_user.get("id") if current_user else None
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing authenticated user context")
    return user_id


def _map_wix_error(exc: Exception, fallback: str = "Wix API request failed") -> HTTPException:
    """Map Wix API exceptions to proper HTTP responses with actionable guidance."""
    import traceback
    
    if isinstance(exc, HTTPException):
        return exc
    
    # Try to extract meaningful error from Wix API response
    wix_error_detail = None
    wix_error_code = None
    
    if hasattr(exc, 'response') and exc.response is not None:
        try:
            err_body = exc.response.json()
            if isinstance(err_body, dict):
                wix_error_detail = err_body.get('message') or err_body.get('error') or err_body.get('details')
                wix_error_code = err_body.get('code') or err_body.get('errorCode')
        except:
            wix_error_detail = exc.response.text[:300] if exc.response.text else None
    
    if isinstance(exc, requests.HTTPError):
        status = exc.response.status_code if exc.response is not None else None
        msg = wix_error_detail or str(exc) if str(exc) != "" else fallback
        
        if status == 401:
            return HTTPException(
                status_code=401, 
                detail=f"Wix authorization failed. Please reconnect your Wix account."
            )
        if status == 403:
            return HTTPException(
                status_code=403,
                detail=f"Wix permission denied. Ensure your OAuth app has blog permissions (BLOG.CREATE-DRAFT)."
            )
        if status == 404:
            return HTTPException(
                status_code=502,
                detail=f"Wix API endpoint not found. The blog feature may not be enabled on this site."
            )
        if status == 429:
            return HTTPException(
                status_code=429,
                detail=f"Wix rate limit exceeded. Please wait a moment and try again."
            )
        if status == 500:
            return HTTPException(
                status_code=502,
                detail=f"Wix server error. This is usually temporary — please try again."
            )
        if status == 502 or status == 503 or status == 504:
            return HTTPException(
                status_code=502,
                detail=f"Wix service temporarily unavailable. Please try again in a moment."
            )
        return HTTPException(status_code=502, detail=msg or fallback)
    
    if isinstance(exc, requests.RequestException):
        return HTTPException(
            status_code=502, 
            detail="Network error connecting to Wix. Please check your connection and try again."
        )
    
    # Handle WixAPIError from our retry/API layer
    from services.integrations.wix.retry import WixAPIError
    if isinstance(exc, WixAPIError):
        status = exc.status_code
        msg = exc.response_body or str(exc)
        if status == 401:
            return HTTPException(
                status_code=401,
                detail="Wix authorization failed. Please reconnect your Wix account."
            )
        if status == 403:
            return HTTPException(
                status_code=403,
                detail="Wix permission denied. Ensure your OAuth app has blog permissions (BLOG.CREATE-DRAFT)."
            )
        if status == 404:
            return HTTPException(
                status_code=502,
                detail="Wix API endpoint not found. Ensure the site ID is correct and the blog feature is enabled."
            )
        if status == 429:
            return HTTPException(
                status_code=429,
                detail="Wix rate limit exceeded. Please wait a moment and try again."
            )
        if status in (500, 502, 503, 504):
            return HTTPException(
                status_code=502,
                detail="Wix service temporarily unavailable. Please try again in a moment."
            )
        return HTTPException(status_code=status or 502, detail=msg or fallback)
    
    # For validation errors from blog_publisher
    error_str = str(exc)
    if "validation failed" in error_str.lower():
        return HTTPException(status_code=400, detail=error_str)
    
    return HTTPException(status_code=500, detail=f"{fallback}: {error_str}")


def _resolve_valid_wix_token(current_user: dict) -> Dict[str, Any]:
    user_id = _get_current_user_id(current_user)
    tokens = wix_oauth_service.get_user_tokens(user_id)
    if tokens:
        logger.info(f"Wix token resolved from DB for user {user_id[:8]}...")
        return tokens[0]

    token_status = wix_oauth_service.get_user_token_status(user_id)
    expired_tokens = token_status.get("expired_tokens", [])
    if not expired_tokens:
        raise HTTPException(status_code=401, detail="Wix account not connected")

    MAX_REFRESH_ATTEMPTS = 3
    attempt = 0
    for candidate in expired_tokens:
        if attempt >= MAX_REFRESH_ATTEMPTS:
            logger.warning(f"Wix token refresh: reached max {MAX_REFRESH_ATTEMPTS} attempts for user {user_id[:8]}...")
            break
        refresh_token = candidate.get("refresh_token")
        token_id = candidate.get("id")
        if not refresh_token:
            continue
        attempt += 1
        if attempt > 1:
            backoff = min(2 ** (attempt - 1), 8)
            logger.info(f"Wix token refresh: attempt {attempt}/{MAX_REFRESH_ATTEMPTS}, waiting {backoff}s...")
            time.sleep(backoff)
        try:
            refreshed = wix_service.refresh_access_token(refresh_token)
        except Exception as exc:
            logger.warning(f"Wix token refresh attempt {attempt} failed: {str(exc)[:120]}")
            continue

        wix_oauth_service.update_tokens(
            user_id=user_id,
            access_token=refreshed.get("access_token"),
            refresh_token=refreshed.get("refresh_token", refresh_token),
            expires_in=refreshed.get("expires_in"),
            token_id=token_id,
        )
        site_id = candidate.get("site_id")
        if not site_id:
            meta_info = extract_meta_from_token(refreshed.get("access_token"))
            site_id = meta_info.get('metaSiteId') or site_id
        logger.info(f"Wix token refreshed successfully on attempt {attempt} for user {user_id[:8]}...")
        return {
            "access_token": refreshed.get("access_token"),
            "refresh_token": refreshed.get("refresh_token", refresh_token),
            "member_id": candidate.get("member_id"),
            "site_id": site_id,
            "id": token_id,
        }

    raise HTTPException(status_code=401, detail="Wix token expired and cannot be refreshed")


def _execute_with_401_recovery(
    fn,
    *,
    user_id: str,
    operation: str,
    token_holder: Dict[str, Optional[str]],
    token_id: Optional[int] = None,
    refresh_token: Optional[str] = None,
) -> Tuple[Any, bool]:
    """
    Run a Wix-bound callable and silently recover from a single 401 by
    refreshing the stored access token and retrying once.

    Wix can invalidate a token server-side for many reasons (rotation,
    user disconnect, account changes) that our local ``expires_at``
    doesn't capture. The pre-flight check in ``_resolve_valid_wix_token``
    will happily hand us a token that Wix then rejects with 401. Rather
    than forcing the user through a full OAuth re-connect for what is
    usually a 4-hour refresh, attempt one transparent refresh + retry.

    The ``token_holder`` dict lets the helper swap the access token
    between attempts so the retry uses the freshly refreshed value.
    Pass it as ``{"access_token": "..."}``; the helper writes back
    ``token_holder["access_token"]`` after a successful refresh.

    Behaviour:
        - First call:  ``fn()`` with ``token_holder["access_token"]``
        - If 401:      refresh the stored token (one attempt), update
                       ``token_holder["access_token"]``, call ``fn()``
                       again
        - If retry 401s, or refresh fails:  re-raise the latest
                       ``WixAPIError`` so the caller maps it to the
                       normal 401 "please reconnect" response.

    Rate limiting:
        Recovery is subject to per-user rate limiting (cooldown + max
        attempts per rolling window) to prevent rapid retry loops when
        Wix keeps rejecting refreshed tokens. See ``_allow_recovery``.

    Args:
        fn: Zero-arg callable that performs the API call. It should
            read ``token_holder["access_token"]`` each time it runs
            (not capture the value in a closure).
        user_id: Current user id (used to refresh the stored token).
        operation: Human-readable operation name for logs.
        token_holder: Mutable dict holding the current access token
            under key ``"access_token"``. Updated in place on refresh.
        token_id: Optional stored Wix token id to update on refresh.
        refresh_token: Optional stored refresh token; required to attempt
                       a refresh on 401.

    Returns:
        ``(fn_result, was_refreshed)`` — ``was_refreshed`` is ``True``
        when a 401 was caught, the token was successfully refreshed,
        and the retry succeeded.

    Raises:
        WixAPIError: Re-raised after a failed refresh + retry, or when
                     rate limiting prevents the recovery attempt, so the
                     caller's error mapper produces the standard 401.
    """
    from services.integrations.wix.retry import WixAPIError

    try:
        result = fn()
        _clear_recovery_state(user_id)
        return result, False
    except WixAPIError as exc:
        if exc.status_code != 401:
            raise

        if not refresh_token:
            logger.warning(
                f"{operation}: 401 from Wix but no refresh_token on file — user must reconnect"
            )
            raise

        # Rate limit check — if we're refreshing too often, surface the
        # 401 so the user gets the standard "reconnect" response instead
        # of burning through refresh tokens.
        allowed, reason = _allow_recovery(user_id)
        if not allowed:
            logger.warning(
                f"{operation}: 401 rate-limited for user {user_id[:8]}... "
                f"({reason}) — surfacing original 401"
            )
            raise

        logger.info(
            f"{operation}: 401 from Wix — attempting silent token refresh "
            f"for user {user_id[:8]}..."
        )
        try:
            refreshed = wix_service.refresh_access_token(refresh_token)
        except Exception as refresh_exc:
            logger.warning(
                f"{operation}: token refresh failed, surfacing original 401: "
                f"{str(refresh_exc)[:120]}"
            )
            # Re-raise the ORIGINAL 401 from the API call (not the refresh
            # network exception) so the caller's error mapper produces a
            # consistent "please reconnect" response.
            raise exc from refresh_exc

        new_access = refreshed.get("access_token")
        new_refresh = refreshed.get("refresh_token", refresh_token)
        expires_in = refreshed.get("expires_in")
        if not new_access:
            logger.warning(
                f"{operation}: refresh response missing access_token — surfacing 401"
            )
            raise exc  # surface the original 401, not a bare raise

        # Update the in-memory holder so the retry uses the new token.
        token_holder["access_token"] = new_access
        _record_recovery(user_id)

        # Persist the new token so the next request uses it.
        try:
            wix_oauth_service.update_tokens(
                user_id=user_id,
                access_token=new_access,
                refresh_token=new_refresh,
                expires_in=expires_in,
                token_id=token_id,
            )
            logger.info(
                f"{operation}: token refreshed successfully for "
                f"user {user_id[:8]}... — retrying once"
            )
        except Exception as persist_exc:
            logger.warning(
                f"{operation}: failed to persist refreshed token, "
                f"retrying with in-memory token: {str(persist_exc)[:120]}"
            )

        # Retry once. If it 401s again, the refresh didn't help — the
        # underlying token is genuinely bad (revoked, site deleted, etc.)
        # and we want to surface that to the user as a reconnect request.
        try:
            retry_result = fn()
            _clear_recovery_state(user_id)
            return retry_result, True
        except WixAPIError as retry_exc:
            if retry_exc.status_code == 401:
                logger.warning(
                    f"{operation}: 401 persisted after token refresh — "
                    f"Wix still rejects. User will need to reconnect."
                )
            raise


class WixAuthRequest(BaseModel):
    """Request model for Wix authentication.
    Supports two modes:
    1. Backend exchanges code: requires code + code_verifier
    2. Frontend already exchanged: provides access_token directly
    """
    code: Optional[str] = None
    state: Optional[str] = None
    code_verifier: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    expires_in: Optional[int] = None
    token_type: Optional[str] = "Bearer"


class WixPublishRequest(BaseModel):
    """Request model for publishing to Wix"""
    title: str
    content: str
    cover_image_url: Optional[str] = None
    category_ids: Optional[list] = None
    category_names: Optional[list] = None
    tag_ids: Optional[list] = None
    tag_names: Optional[list] = None
    publish: bool = True
    access_token: Optional[str] = None
    member_id: Optional[str] = None
    site_id: Optional[str] = None
    seo_metadata: Optional[Dict[str, Any]] = None
class WixCreateCategoryRequest(BaseModel):
    access_token: str
    label: str
    description: Optional[str] = None
    language: Optional[str] = None


class WixCreateTagRequest(BaseModel):
    access_token: str
    label: str
    language: Optional[str] = None


class WixConnectionStatus(BaseModel):
    """Response model for Wix connection status"""
    connected: bool
    has_permissions: bool
    site_info: Optional[Dict[str, Any]] = None
    permissions: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


def _is_wix_test_mode_enabled() -> bool:
    return os.getenv("WIX_TEST_ROUTES_ENABLED", "false").lower() in {"1", "true", "yes", "on"}


def _is_admin_user(current_user: Dict[str, Any]) -> bool:
    email = (current_user.get("email") or "").lower()
    role = current_user.get("role")
    public_metadata = current_user.get("public_metadata")
    if isinstance(public_metadata, dict):
        role = public_metadata.get("role") or role

    admin_emails = {
        e.strip().lower()
        for e in os.getenv("ADMIN_EMAILS", "").split(",")
        if e.strip()
    }
    admin_domain = (os.getenv("ADMIN_EMAIL_DOMAIN") or "").lower().strip()

    return bool(
        role == "admin"
        or (email and email in admin_emails)
        or (email and admin_domain and email.endswith(f"@{admin_domain}"))
    )


def _require_wix_test_access(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if not _is_wix_test_mode_enabled():
        raise HTTPException(status_code=404, detail="Not found")
    if not _is_admin_user(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/auth/url")
async def get_authorization_url(state: Optional[str] = None, current_user: dict = Depends(get_current_user)) -> Dict[str, str]:
    """
    Get Wix OAuth authorization URL
    
    Args:
        state: Optional state parameter for security
        
    Returns:
        Authorization URL
    """
    try:
        user_id = current_user.get('id') if current_user else None
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")

        oauth_state = state or str(uuid.uuid4())
        oauth_payload = wix_service.get_authorization_url(oauth_state)
        saved = wix_oauth_service.store_pkce_verifier(
            user_id=user_id,
            state=oauth_state,
            code_verifier=oauth_payload["code_verifier"],
            ttl_seconds=600
        )
        if not saved:
            raise HTTPException(status_code=500, detail="Failed to persist OAuth verifier state")
        return {"authorization_url": oauth_payload["authorization_url"], "state": oauth_state}
    except Exception as e:
        logger.error(f"Failed to generate authorization URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/auth/callback")
async def handle_oauth_callback(request: WixAuthRequest, current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Handle OAuth callback and exchange code for tokens
    
    Args:
        request: OAuth callback request with code
        current_user: Current authenticated user
        
    Returns:
        Token information and connection status
    """
    try:
        user_id = current_user.get('id')
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        access_token: str | None = None
        refresh_token: str | None = None
        expires_in: int | None = None
        token_type: str = "Bearer"
        site_info: dict = {}
        site_id: str | None = None
        member_id: str | None = None
        permissions: dict = {}
        
        # MODE 2: Frontend already exchanged the code (preferred — avoids PKCE verifier mismatch)
        if request.access_token:
            logger.info(f"Wix callback mode=FRONTEND_TOKEN for user {user_id}")
            access_token = request.access_token
            refresh_token = request.refresh_token
            expires_in = request.expires_in
            token_type = request.token_type or "Bearer"
            
            # Non-fatal enrichment
            try:
                site_info = wix_service.get_site_info(access_token)
                site_id = site_info.get('siteId') or site_info.get('site_id')
                if not site_id and site_info.get('_no_site'):
                    meta_info = extract_meta_from_token(access_token)
                    site_id = meta_info.get('metaSiteId')
            except Exception as e:
                logger.warning(f"get_site_info failed (non-fatal): {e}")
            try:
                member_id = wix_service.extract_member_id_from_access_token(access_token)
            except Exception:
                pass
            try:
                permissions = wix_service.check_blog_permissions(access_token, site_id=site_id)
            except Exception as e:
                logger.warning(f"check_blog_permissions failed (non-fatal): {e}")
        
        # MODE 1: Backend exchanges code (legacy / requires correct code_verifier)
        elif request.code:
            if not request.state:
                raise HTTPException(status_code=400, detail="Missing OAuth state")
            code_verifier = request.code_verifier
            if not code_verifier:
                code_verifier = wix_oauth_service.consume_pkce_verifier(user_id=user_id, state=request.state)
                if code_verifier:
                    logger.info(f"Fallback: using DB-stored code_verifier for user {user_id}")
            if not code_verifier:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid or expired OAuth state. Please restart Wix connection."
                )
            logger.info(f"Wix callback mode=BACKEND_EXCHANGE for user {user_id}")
            tokens = wix_service.exchange_code_for_tokens(request.code, code_verifier=code_verifier)
            logger.info(f"Token exchange succeeded for user {user_id}")
            access_token = tokens['access_token']
            refresh_token = tokens.get('refresh_token')
            expires_in = tokens.get('expires_in')
            token_type = tokens.get('token_type', 'Bearer')
            
            try:
                site_info = wix_service.get_site_info(access_token)
                site_id = site_info.get('siteId') or site_info.get('site_id')
                if not site_id and site_info.get('_no_site'):
                    meta_info = extract_meta_from_token(access_token)
                    site_id = meta_info.get('metaSiteId') or site_id
            except Exception as e:
                logger.warning(f"get_site_info failed (non-fatal): {e}")
            try:
                meta_info = extract_meta_from_token(access_token)
                site_id = meta_info.get('metaSiteId') or site_id
            except Exception:
                pass
            try:
                member_id = wix_service.extract_member_id_from_access_token(access_token)
            except Exception:
                pass
            try:
                permissions = wix_service.check_blog_permissions(access_token, site_id=site_id)
            except Exception as e:
                logger.warning(f"check_blog_permissions failed (non-fatal): {e}")
        else:
            raise HTTPException(status_code=400, detail="Missing code or access_token")
        
        if not access_token:
            raise HTTPException(status_code=500, detail="No access_token available")
        
        # Store tokens securely in database
        stored = wix_oauth_service.store_tokens(
            user_id=user_id,
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=expires_in,
            token_type=token_type,
            site_id=site_id,
            member_id=member_id
        )
        
        if not stored:
            logger.warning(f"Failed to store Wix tokens for user {user_id}, but OAuth succeeded")
        
        return {
            "success": True,
            "tokens": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "expires_in": expires_in,
                "token_type": token_type
            },
            "site_info": site_info,
            "permissions": permissions,
            "message": "Successfully connected to Wix"
        }
        
    except Exception as e:
        logger.error(f"Failed to handle OAuth callback: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/callback")
async def handle_oauth_callback_get(code: str, state: Optional[str] = None, request: Request = None, current_user: dict = Depends(get_current_user)):
    """HTML callback page for Wix OAuth that exchanges code and notifies opener via postMessage."""
    try:
        user_id = current_user.get('id') if current_user else None
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")
        if not state:
            raise HTTPException(status_code=400, detail="Missing OAuth state")
        code_verifier = wix_oauth_service.consume_pkce_verifier(user_id=user_id, state=state)
        if not code_verifier:
            raise HTTPException(status_code=400, detail="Invalid or expired OAuth state. Please reconnect Wix.")
        tokens = wix_service.exchange_code_for_tokens(code, code_verifier=code_verifier)
        
        # Non-fatal: get site info and permissions
        site_info = {}
        permissions = {}
        site_id = None
        try:
            site_info = wix_service.get_site_info(tokens['access_token'])
            site_id = site_info.get('siteId') or site_info.get('site_id')
            if not site_id and site_info.get('_no_site'):
                meta_info = extract_meta_from_token(tokens['access_token'])
                site_id = meta_info.get('metaSiteId')
        except Exception as e:
            logger.warning(f"GET callback: get_site_info non-fatal: {e}")
        try:
            permissions = wix_service.check_blog_permissions(tokens['access_token'], site_id=site_id)
        except Exception as e:
            logger.warning(f"GET callback: check_blog_permissions non-fatal: {e}")
        
        # Store tokens in database if we have user_id
        member_id = None
        try:
            member_id = wix_service.extract_member_id_from_access_token(tokens['access_token'])
        except Exception:
            pass
        
        stored = wix_oauth_service.store_tokens(
            user_id=user_id,
            access_token=tokens['access_token'],
            refresh_token=tokens.get('refresh_token'),
            expires_in=tokens.get('expires_in'),
            token_type=tokens.get('token_type', 'Bearer'),
            scope=tokens.get('scope'),
            site_id=site_id,
            member_id=member_id
        )
        if not stored:
            logger.warning(f"Failed to store Wix tokens for user {user_id} in GET callback")

        # Build success payload for postMessage
        payload = {
            "type": "WIX_OAUTH_SUCCESS",
            "success": True,
            "tokens": {
                "access_token": tokens['access_token'],
                "refresh_token": tokens.get('refresh_token'),
                "expires_in": tokens.get('expires_in'),
                "token_type": tokens.get('token_type', 'Bearer')
            },
            "site_info": site_info,
            "permissions": permissions
        }

        html = build_oauth_callback_html(
            payload=payload,
            title="Wix Connected",
            heading="Connection Successful",
            message="Your Wix account was connected. You can close this window."
        )
        return HTMLResponse(content=html, headers={
            "Cross-Origin-Opener-Policy": "unsafe-none",
            "Cross-Origin-Embedder-Policy": "unsafe-none"
        })
    except Exception as e:
        logger.error(f"Wix OAuth GET callback failed: {e}")
        html = build_oauth_callback_html(
            payload={"type": "WIX_OAUTH_ERROR", "success": False, "error": sanitize_error(e)},
            title="Wix Connection Failed",
            heading="Connection Failed",
            message="There was an issue connecting your Wix account. You can close this window and try again."
        )
        return HTMLResponse(content=html, headers={
            "Cross-Origin-Opener-Policy": "unsafe-none",
            "Cross-Origin-Embedder-Policy": "unsafe-none"
        })


@router.get("/connection/status")
async def get_connection_status(current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Check Wix connection status and permissions.
    Returns connected: false when no tokens are stored (instead of 401).
    """
    try:
        token_info = _resolve_valid_wix_token(current_user)
        access_token = token_info["access_token"]
        site_id = token_info.get("site_id")
        
        # Check site info — distinguish "no site" from "token expired"
        site_info = wix_service.get_site_info(access_token)
        if site_info.get("_auth_failed"):
            return {
                "connected": False,
                "has_permissions": False,
                "error": "Wix token expired — please reconnect",
                "reconnect_required": True
            }
        
        # If get_site_info returned _no_site, try extracting metaSiteId from token
        if site_info.get("_no_site") and not site_id:
            meta_info = extract_meta_from_token(access_token)
            site_id = meta_info.get('metaSiteId')
        
        permissions = wix_service.check_blog_permissions(access_token, site_id=site_id)
        return {
            "connected": True,
            "has_permissions": permissions.get("has_permissions", False),
            "site_info": site_info,
            "permissions": permissions,
            "site_id": site_id,
        }
    except HTTPException as e:
        if e.status_code == 401:
            return {"connected": False, "has_permissions": False, "error": "Wix account not connected", "reconnect_required": True}
        raise
    except Exception as e:
        logger.error(f"Failed to check connection status: {e}")
        return {"connected": False, "has_permissions": False, "error": "Unable to check Wix connection"}


@router.get("/status")
async def get_wix_status(current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Get Wix connection status (similar to GSC/WordPress pattern)
    """
    try:
        token_info = _resolve_valid_wix_token(current_user)
        site_info = wix_service.get_site_info(token_info["access_token"])
        return {
            "connected": True,
            "sites": [site_info],
            "total_sites": 1,
            "site_info": site_info
        }
    except Exception as e:
        logger.error(f"Failed to get Wix status: {e}")
        mapped = _map_wix_error(e, "Failed to get Wix status")
        raise mapped


@router.post("/publish")
async def publish_to_wix(request: WixPublishRequest, current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Publish blog post to Wix using server-stored OAuth tokens.

    The backend resolves the access token from the database (via
    _resolve_valid_wix_token), so callers do NOT need to pass
    access_token unless they want to override the stored one.

    If Wix rejects the resolved token with 401 (server-side token
    rotation / revocation / short-lived expiry that the local
    ``expires_at`` doesn't capture), the publish call is transparently
    retried once with a freshly refreshed token. See
    ``_execute_with_401_recovery`` for the full recovery flow.
    """
    user_id = _get_current_user_id(current_user)
    try:
        site_id = request.site_id
        stored_token_id: Optional[int] = None
        stored_refresh_token: Optional[str] = None
        # ``token_holder`` is a mutable container so the 401-recovery helper
        # can swap in a refreshed access token between attempts.
        token_holder: Dict[str, Optional[str]] = {"access_token": None}
        if request.access_token:
            from services.integrations.wix.utils import normalize_token_string
            token_holder["access_token"] = normalize_token_string(request.access_token)
            logger.info(f"Wix publish: using frontend-fallback token for user {user_id[:8]}...")
        else:
            try:
                token_info = _resolve_valid_wix_token(current_user)
                token_holder["access_token"] = token_info["access_token"]
                stored_token_id = token_info.get("id")
                stored_refresh_token = token_info.get("refresh_token")
                if not site_id:
                    site_id = token_info.get("site_id")
                if not site_id and token_holder["access_token"]:
                    meta_info = extract_meta_from_token(token_holder["access_token"])
                    site_id = meta_info.get('metaSiteId')
                logger.info(f"Wix publish: using backend DB token for user {user_id[:8]}...")
            except HTTPException:
                token_holder["access_token"] = None

        access_token = token_holder["access_token"]
        if not access_token:
            return {
                "success": False,
                "error": "Wix account not connected. Connect your Wix account first.",
            }

        if not request.content or not request.content.strip():
            return {
                "success": False,
                "error": "Content cannot be empty. Please write your blog post before publishing.",
            }

        content_length = len(request.content.strip())
        if content_length > 50000:
            return {
                "success": False,
                "error": f"Content is {content_length // 1000}K characters — maximum is 50K. Please shorten your content.",
            }

        content_warning = None
        if content_length > 30000:
            content_warning = f"Content is {content_length // 1000}K characters. Very long posts may take longer to publish on Wix."
            logger.warning(f"Wix publish: large content ({content_length} chars) for user {_get_current_user_id(current_user)[:8]}...")

        member_id = request.member_id
        if not member_id:
            member_id = wix_service.extract_member_id_from_access_token(access_token)
        if not member_id:
            try:
                member_info = wix_service.get_current_member(access_token)
                if member_info and isinstance(member_info, dict):
                    member_id = (member_info.get("member") or {}).get("id") or member_info.get("id")
            except Exception as e:
                logger.warning(f"Wix: could not resolve member ID from token: {e}")
        if not member_id:
            return {
                "success": False,
                "error": "Unable to resolve Wix member ID. Please reconnect your Wix account.",
            }

        # Resolve categories/tags: precedence is top-level params > seo_metadata fallback
        category_ids = request.category_ids or request.category_names
        tag_ids = request.tag_ids or request.tag_names

        seo_metadata = request.seo_metadata
        if seo_metadata:
            if not category_ids and seo_metadata.get("blog_categories"):
                category_ids = seo_metadata.get("blog_categories")
            if not tag_ids and seo_metadata.get("blog_tags"):
                tag_ids = seo_metadata.get("blog_tags")

            if seo_metadata.get("url_slug"):
                logger.info(f"Wix publish: using SEO url_slug for post slug: {seo_metadata.get('url_slug')[:50]}")

        # Ensure category_ids and tag_ids are lists of strings (not ints)
        if category_ids:
            category_ids = [str(c) for c in category_ids if c is not None]
        if tag_ids:
            tag_ids = [str(t) for t in tag_ids if t is not None]

        result, token_refreshed = _execute_with_401_recovery(
            lambda: wix_service.create_blog_post(
                access_token=token_holder["access_token"],
                title=request.title,
                content=request.content,
                cover_image_url=request.cover_image_url,
                category_ids=category_ids,
                tag_ids=tag_ids,
                publish=request.publish,
                member_id=member_id,
                seo_metadata=seo_metadata,
                site_id=site_id,
            ),
            user_id=user_id,
            operation="Wix publish",
            token_holder=token_holder,
            token_id=stored_token_id,
            refresh_token=stored_refresh_token,
        )
        if token_refreshed:
            logger.info(f"Wix publish: transparent token refresh succeeded for user {user_id[:8]}...")
        post = result.get("draftPost") or result.get("post") or result
        raw_url = post.get("url")
        if isinstance(raw_url, dict):
            post_url = raw_url.get("base", "").rstrip("/") + "/" + raw_url.get("path", "").lstrip("/")
        elif isinstance(raw_url, str):
            post_url = raw_url
        else:
            post_url = None
        publish_warnings = result.get("_warnings", [])
        all_warnings = [w for w in [content_warning] + publish_warnings if w]
        response: Dict[str, Any] = {
            "success": True,
            "post_id": str(post.get("id", "")),
            "url": post_url,
            "publish_state": "PUBLISHED" if request.publish else "DRAFT",
        }
        if all_warnings:
            response["warning"] = " | ".join(all_warnings)
        if token_refreshed:
            response["_token_refreshed"] = True
        return response
    except Exception as e:
        logger.error(f"Failed to publish to Wix: {e}")
        raise _map_wix_error(e, "Failed to publish to Wix")


@router.get("/categories")
async def get_blog_categories(current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Get available blog categories from Wix
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        List of blog categories
    """
    user_id = _get_current_user_id(current_user)
    try:
        token_info = _resolve_valid_wix_token(current_user)
        token_holder = {"access_token": token_info["access_token"]}

        result, token_refreshed = _execute_with_401_recovery(
            lambda: wix_service.get_blog_categories(
                access_token=token_holder["access_token"],
            ),
            user_id=user_id,
            operation="Wix fetch categories",
            token_holder=token_holder,
            token_id=token_info.get("id"),
            refresh_token=token_info.get("refresh_token"),
        )
        response: Dict[str, Any] = {
            "success": True,
            "categories": result,
        }
        if token_refreshed:
            response["_token_refreshed"] = True
        return response
    except Exception as e:
        logger.error(f"Failed to get blog categories: {e}")
        raise _map_wix_error(e, "Failed to fetch Wix blog categories")


@router.get("/tags")
async def get_blog_tags(current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Get available blog tags from Wix
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        List of blog tags
    """
    user_id = _get_current_user_id(current_user)
    try:
        token_info = _resolve_valid_wix_token(current_user)
        token_holder = {"access_token": token_info["access_token"]}

        result, token_refreshed = _execute_with_401_recovery(
            lambda: wix_service.get_blog_tags(
                access_token=token_holder["access_token"],
            ),
            user_id=user_id,
            operation="Wix fetch tags",
            token_holder=token_holder,
            token_id=token_info.get("id"),
            refresh_token=token_info.get("refresh_token"),
        )
        response: Dict[str, Any] = {
            "success": True,
            "tags": result,
        }
        if token_refreshed:
            response["_token_refreshed"] = True
        return response
    except Exception as e:
        logger.error(f"Failed to get blog tags: {e}")
        raise _map_wix_error(e, "Failed to fetch Wix blog tags")


@router.post("/disconnect")
async def disconnect_wix(current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Disconnect Wix account
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Disconnection status
    """
    try:
        user_id = _get_current_user_id(current_user)
        token_status = wix_oauth_service.get_user_token_status(user_id)
        all_tokens = token_status.get("active_tokens", []) + token_status.get("expired_tokens", [])
        for token in all_tokens:
            token_id = token.get("id")
            if token_id:
                wix_oauth_service.revoke_token(user_id, token_id)
        return {
            "success": True,
            "connected": False,
            "message": "Wix account disconnected successfully"
        }
        
    except Exception as e:
        logger.error(f"Failed to disconnect Wix: {e}")
        raise _map_wix_error(e, "Failed to disconnect Wix account")


# =============================================================================
# TEST ENDPOINTS - No authentication required for testing
# =============================================================================

@qa_router.get("/connection/status")
async def get_test_connection_status(_: Dict[str, Any] = Depends(_require_wix_test_access)) -> WixConnectionStatus:
    """
    TEST ENDPOINT: Check Wix connection status without authentication
    
    Returns:
        Connection status and permissions
    """
    try:
        logger.info("TEST: Checking Wix connection status (no auth required)")
        
        return WixConnectionStatus(
            connected=False,
            has_permissions=False,
            error="No stored tokens found. Please connect your Wix account first."
        )
        
    except Exception as e:
        logger.error(f"TEST: Failed to check connection status: {e}")
        return WixConnectionStatus(
            connected=False,
            has_permissions=False,
            error=str(e)
        )


@qa_router.get("/auth/url")
async def get_test_authorization_url(state: Optional[str] = None, _: Dict[str, Any] = Depends(_require_wix_test_access)) -> Dict[str, str]:
    """
    TEST ENDPOINT: Get Wix OAuth authorization URL without authentication
    
    Args:
        state: Optional state parameter for security
        
    Returns:
        Authorization URL for user to visit
    """
    try:
        logger.info("TEST: Generating Wix authorization URL (no auth required)")
        
        # Check if Wix service is properly configured
        if not wix_service.client_id:
            logger.warning("TEST: Wix Client ID not configured, returning mock URL")
            return {
                "url": (
                    "https://www.wix.com/oauth/access?client_id=YOUR_CLIENT_ID"
                    "&redirect_uri=http://localhost:3000/wix/callback"
                    "&response_type=code&scope="
                    "BLOG.CREATE-DRAFT,BLOG.PUBLISH-POST,BLOG.READ-CATEGORY,"
                    "BLOG.CREATE-CATEGORY,BLOG.READ-TAG,BLOG.CREATE-TAG,"
                    "MEDIA.SITE_MEDIA_FILES_IMPORT"
                    "&code_challenge=test&code_challenge_method=S256"
                ),
                "state": state or "test_state",
                "message": "WIX_CLIENT_ID not configured. Please set it in your .env file to get a real authorization URL."
            }
        
        auth_payload = wix_service.get_authorization_url(state)
        return {"url": auth_payload.get("authorization_url", ""), "state": state or "test_state"}
    except Exception as e:
        logger.error(f"TEST: Failed to generate authorization URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@qa_router.post("/publish")
async def test_publish_to_wix(request: WixPublishRequest, _: Dict[str, Any] = Depends(_require_wix_test_access)) -> Dict[str, Any]:
    """
    TEST ENDPOINT: Simulate publishing a blog post to Wix without authentication.

    Returns a fake success response so the frontend can validate the flow.
    """
    try:
        logger.info("TEST: Simulating publish to Wix (no auth required)")
        return {
            "success": True,
            "post_id": "test_post_id",
            "url": "https://example.com/blog/test-post",
            "message": "Simulated blog post published successfully (test mode)"
        }
    except Exception as e:
        logger.error(f"TEST: Failed to simulate publish: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refresh-token")
async def refresh_wix_token(current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Refresh Wix access token using stored refresh token.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        New token information with access_token, refresh_token, expires_in
    """
    try:
        user_id = _get_current_user_id(current_user)
        token_status = wix_oauth_service.get_user_token_status(user_id)
        all_tokens = token_status.get("active_tokens", []) + token_status.get("expired_tokens", [])
        
        refresh_token = None
        token_id = None
        for t in all_tokens:
            if t.get("refresh_token"):
                refresh_token = t["refresh_token"]
                token_id = t["id"]
                break
        
        if not refresh_token:
            raise HTTPException(status_code=400, detail="No refresh token found. Please reconnect your Wix account.")
        
        new_tokens = wix_service.refresh_access_token(refresh_token)
        
        wix_oauth_service.update_tokens(
            user_id=user_id,
            access_token=new_tokens.get("access_token"),
            refresh_token=new_tokens.get("refresh_token", refresh_token),
            expires_in=new_tokens.get("expires_in"),
            token_id=token_id,
        )
        
        return {
            "success": True,
            "expires_in": new_tokens.get("expires_in"),
            "token_type": new_tokens.get("token_type", "Bearer")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to refresh Wix token: {e}")
        raise _map_wix_error(e, "Failed to refresh token")


@qa_router.post("/publish/real")
async def test_publish_real(payload: Dict[str, Any], _: Dict[str, Any] = Depends(_require_wix_test_access)) -> Dict[str, Any]:
    """
    TEST ENDPOINT: Perform a real publish to Wix using a provided access token.

    Notes:
      - Expects request.access_token from the frontend's Wix SDK tokens
      - Derives member_id server-side (required by Wix for third-party apps)
    """
    try:
        # Normalize access_token from payload (could be string, dict, or other format)
        from services.integrations.wix.utils import normalize_token_string
        raw_access_token = payload.get("access_token")
        if not raw_access_token:
            raise HTTPException(status_code=400, detail="Missing access_token")
        
        # Normalize token to string (handles dict with accessToken.value, int, etc.)
        access_token = normalize_token_string(raw_access_token)
        if not access_token:
            # Fallback: try to convert to string directly
            access_token = str(raw_access_token).strip()
            if not access_token or access_token == "None":
                raise HTTPException(status_code=400, detail="Invalid access_token format")

        # Derive current member id from token (try local decode first, then API fallback)
        member_id = wix_service.extract_member_id_from_access_token(access_token)
        if not member_id:
            member_info = wix_service.get_current_member(access_token)
            member_id = (
                (member_info.get("member") or {}).get("id")
                or member_info.get("id")
            )
        if not member_id:
            raise HTTPException(status_code=400, detail="Unable to resolve member_id from token")

        # Extract SEO metadata if provided
        seo_metadata = payload.get("seo_metadata")
        
        # Extract category/tag IDs or names
        # Can be either:
        # - IDs: List of UUID strings
        # - Names: List of name strings (will be looked up/created)
        category_ids = payload.get("category_ids") or payload.get("category_names")
        tag_ids = payload.get("tag_ids") or payload.get("tag_names")
        
        # If SEO metadata has categories/tags but they weren't explicitly provided, use them
        if seo_metadata:
            if not category_ids and seo_metadata.get("blog_categories"):
                category_ids = seo_metadata.get("blog_categories")
            if not tag_ids and seo_metadata.get("blog_tags"):
                tag_ids = seo_metadata.get("blog_tags")
        
        result = wix_service.create_blog_post(
            access_token=access_token,
            title=payload.get("title") or "Untitled",
            content=payload.get("content") or "",
            cover_image_url=payload.get("cover_image_url"),
            category_ids=category_ids,
            tag_ids=tag_ids,
            publish=bool(payload.get("publish", True)),
            member_id=member_id,
            seo_metadata=seo_metadata,
        )

        publish_warnings = result.get("_warnings", [])
        return {
            "success": True,
            "post_id": (result.get("draftPost") or result.get("post") or {}).get("id"),
            "url": (result.get("draftPost") or result.get("post") or {}).get("url"),
            "message": "Blog post published to Wix",
            **({"warning": " | ".join(publish_warnings)} if publish_warnings else {}),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TEST: Real publish failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@qa_router.post("/category")
async def test_create_category(request: WixCreateCategoryRequest, _: Dict[str, Any] = Depends(_require_wix_test_access)) -> Dict[str, Any]:
    try:
        result = wix_service.create_category(
            access_token=request.access_token,
            label=request.label,
            description=request.description,
            language=request.language,
        )
        return {"success": True, "category": result.get("category", {}), "raw": result}
    except Exception as e:
        logger.error(f"TEST: Create category failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@qa_router.post("/tag")
async def test_create_tag(request: WixCreateTagRequest, _: Dict[str, Any] = Depends(_require_wix_test_access)) -> Dict[str, Any]:
    try:
        result = wix_service.create_tag(
            access_token=request.access_token,
            label=request.label,
            language=request.language,
        )
        return {"success": True, "tag": result.get("tag", {}), "raw": result}
    except Exception as e:
        logger.error(f"TEST: Create tag failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
