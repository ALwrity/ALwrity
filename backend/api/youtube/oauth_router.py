"""
YouTube OAuth Router
Handles YouTube Data API v3 OAuth2 authentication flow.
Uses shared build_oauth_callback_html for popup-compatible callback responses.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from loguru import logger

from middleware.auth_middleware import get_current_user
from services.youtube.youtube_oauth_service import YouTubeOAuthService
from services.integrations.oauth_callback_utils import build_oauth_callback_html

# Mounted under /api/youtube — keep prefix relative so status is /api/youtube/oauth/status
router = APIRouter(prefix="/oauth", tags=["youtube-oauth"])


def get_oauth_service() -> YouTubeOAuthService:
    try:
        return YouTubeOAuthService()
    except ValueError as e:
        logger.error(f"YouTube OAuth service init failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/auth/url")
def get_youtube_auth_url(
    user: dict = Depends(get_current_user),
    service: YouTubeOAuthService = Depends(get_oauth_service),
):
    """Generate YouTube OAuth authorization URL. Frontend opens this in a popup."""
    try:
        user_id = user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")

        auth_url = service.generate_authorization_url(user_id)
        if not auth_url:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate authorization URL. Check server logs.",
            )

        logger.info(f"YouTube OAuth URL generated for user {user_id}")
        return {"auth_url": auth_url}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating YouTube auth URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/callback")
def handle_youtube_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
    request: Request = None,
    service: YouTubeOAuthService = Depends(get_oauth_service),
):
    """
    Handle OAuth callback from Google.

    Returns HTML with postMessage to the opener popup window (GSC/WordPress pattern).
    Supports JSON response via ?format=json for server-side flows.
    """
    # User denied authorization
    if error:
        logger.warning(f"YouTube OAuth: user denied authorization: {error}")
        html = build_oauth_callback_html(
            payload={"type": "YOUTUBE_OAUTH_ERROR", "error": error},
            title="Authorization Denied",
            heading="Authorization Denied",
            message=f"You denied the authorization request. {error}",
        )
        return _response_as_html(request, html)

    # Validate parameters
    if not code or not state:
        logger.error("YouTube OAuth: missing code or state parameters")
        html = build_oauth_callback_html(
            payload={"type": "YOUTUBE_OAUTH_ERROR", "error": "Missing authorization code or state"},
            title="Authorization Failed",
            heading="Missing Parameters",
            message="The authorization request was missing required parameters. Please try again.",
        )
        return _response_as_html(request, html)

    # Exchange code for tokens
    result = service.handle_oauth_callback(authorization_code=code, state=state)

    if result.get("success"):
        channel_name = result.get("channel_name", "your channel")
        html = build_oauth_callback_html(
            payload={
                "type": "YOUTUBE_OAUTH_SUCCESS",
                "channel_id": result.get("channel_id", ""),
                "channel_name": channel_name,
            },
            title="YouTube Connected",
            heading="YouTube Connected!",
            message=f"Successfully connected to {channel_name}. You can now close this window.",
        )
        logger.info(f"YouTube OAuth callback succeeded for channel: {channel_name}")
        return _response_as_html(request, html)

    error_msg = result.get("error", "Unknown error during authorization")
    logger.error(f"YouTube OAuth callback failed: {error_msg}")
    html = build_oauth_callback_html(
        payload={"type": "YOUTUBE_OAUTH_ERROR", "error": error_msg},
        title="Connection Failed",
        heading="Connection Failed",
        message=f"Failed to connect YouTube: {error_msg}. Please try again.",
    )
    return _response_as_html(request, html)


@router.get("/status")
def get_youtube_status(
    user: dict = Depends(get_current_user),
    service: YouTubeOAuthService = Depends(get_oauth_service),
):
    """Check YouTube connection status for the authenticated user."""
    try:
        user_id = user.get("id")
        status = service.get_connection_status(user_id)
        return {"success": True, **status}
    except Exception as e:
        logger.error(f"Error checking YouTube OAuth status: {e}")
        return {"success": False, "connected": False, "channels": [], "error": str(e)}


@router.delete("/disconnect/{token_id}")
def disconnect_youtube(
    token_id: int,
    user: dict = Depends(get_current_user),
    service: YouTubeOAuthService = Depends(get_oauth_service),
):
    """Deactivate a YouTube OAuth token."""
    try:
        user_id = user.get("id")
        result = service.revoke_token(user_id, token_id)
        if result:
            return {"success": True, "message": "YouTube disconnected"}
        return {"success": False, "message": "Failed to disconnect"}
    except Exception as e:
        logger.error(f"Error disconnecting YouTube: {e}")
        return {"success": False, "error": str(e)}


def _response_as_html(request: Request, html: str):
    """Return HTML response, or JSON if ?format=json is present."""
    if request and request.query_params.get("format") == "json":
        from fastapi.responses import JSONResponse
        import json as json_lib

        # Extract payload from HTML for JSON response
        try:
            payload_start = html.index('"type":')
            payload_end = html.index("</script>", payload_start)
            snippet = html[payload_start : payload_end - 3]
            payload = json_lib.loads("{" + snippet + "}")
            return JSONResponse(content=payload)
        except Exception:
            return JSONResponse(content={"success": False, "error": "OAuth processing completed"})

    from fastapi.responses import HTMLResponse

    return HTMLResponse(content=html, headers={"Cross-Origin-Opener-Policy": "unsafe-none"})
