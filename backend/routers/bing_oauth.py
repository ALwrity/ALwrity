"""
Bing Webmaster OAuth2 Routes
Handles Bing Webmaster Tools OAuth2 authentication flow.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import RedirectResponse, HTMLResponse
from typing import Dict, Any, Optional
from pydantic import BaseModel
from loguru import logger

from services.integrations.bing_oauth import BingOAuthService
from middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/bing", tags=["Bing Webmaster OAuth"])

# Initialize OAuth service
oauth_service = BingOAuthService()

# Pydantic Models
class BingOAuthResponse(BaseModel):
    auth_url: str
    state: str

class BingCallbackResponse(BaseModel):
    success: bool
    message: str
    access_token: Optional[str] = None
    expires_in: Optional[int] = None

class BingStatusResponse(BaseModel):
    connected: bool
    sites: list
    total_sites: int

@router.get("/auth/url", response_model=BingOAuthResponse)
async def get_bing_auth_url(
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get Bing Webmaster OAuth2 authorization URL."""
    try:
        user_id = user.get('id')
        if not user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User ID not found.")
        
        auth_data = oauth_service.generate_authorization_url(user_id)
        if not auth_data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Bing Webmaster OAuth is not properly configured. Please check that BING_CLIENT_ID and BING_CLIENT_SECRET environment variables are set with valid Bing Webmaster application credentials."
            )
        
        return BingOAuthResponse(**auth_data)
        
    except Exception as e:
        logger.error(f"Error generating Bing Webmaster OAuth URL: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate Bing Webmaster OAuth URL."
        )

@router.get("/callback")
async def handle_bing_callback(
    code: str = Query(..., description="Authorization code from Bing"),
    state: str = Query(..., description="State parameter for security"),
    error: Optional[str] = Query(None, description="Error from Bing OAuth")
):
    """Handle Bing Webmaster OAuth2 callback."""
    try:
        if error:
            logger.error(f"Bing Webmaster OAuth error: {error}")
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <title>Bing Webmaster Connection Failed</title>
                <script>
                    // Send error message to parent window
                    window.onload = function() {{
                        window.parent.postMessage({{
                            type: 'BING_OAUTH_ERROR',
                            success: false,
                            error: '{error}'
                        }}, '*');
                        window.close();
                    }};
                </script>
            </head>
            <body>
                <h1>Connection Failed</h1>
                <p>There was an error connecting to Bing Webmaster Tools.</p>
                <p>You can close this window and try again.</p>
            </body>
            </html>
            """
            return HTMLResponse(content=html_content, headers={
                "Cross-Origin-Opener-Policy": "unsafe-none",
                "Cross-Origin-Embedder-Policy": "unsafe-none"
            })
        
        if not code or not state:
            logger.error("Missing code or state parameter in Bing Webmaster OAuth callback")
            html_content = """
            <!DOCTYPE html>
            <html>
            <head>
                <title>Bing Webmaster Connection Failed</title>
            <script>
                // Send error message to opener/parent window
                window.onload = function() {{
                    (window.opener || window.parent).postMessage({{
                            type: 'BING_OAUTH_ERROR',
                            success: false,
                            error: 'Missing parameters'
                    }}, '*');
                        window.close();
                    }};
                </script>
            </head>
            <body>
                <h1>Connection Failed</h1>
                <p>Missing required parameters.</p>
                <p>You can close this window and try again.</p>
            </body>
            </html>
            """
            return HTMLResponse(content=html_content, headers={
                "Cross-Origin-Opener-Policy": "unsafe-none",
                "Cross-Origin-Embedder-Policy": "unsafe-none"
            })
        
        # Exchange code for token
        result = oauth_service.handle_oauth_callback(code, state)
        
        if not result or not result.get('success'):
            logger.error("Failed to exchange Bing Webmaster OAuth code for token")
            html_content = """
            <!DOCTYPE html>
            <html>
            <head>
                <title>Bing Webmaster Connection Failed</title>
            <script>
                // Send error message to opener/parent window
                window.onload = function() {{
                    (window.opener || window.parent).postMessage({{
                            type: 'BING_OAUTH_ERROR',
                            success: false,
                            error: 'Token exchange failed'
                    }}, '*');
                        window.close();
                    }};
                </script>
            </head>
            <body>
                <h1>Connection Failed</h1>
                <p>Failed to exchange authorization code for access token.</p>
                <p>You can close this window and try again.</p>
            </body>
            </html>
            """
            return HTMLResponse(content=html_content)
        
        # Create Bing insights task immediately after successful connection
        try:
            from services.platform_insights_monitoring_service import create_platform_insights_task
            from services.database import get_session_for_user
            
            # Get user_id from Bing OAuth service state lookup
            import sqlite3
            with sqlite3.connect(oauth_service.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT user_id FROM bing_oauth_states WHERE state = ?', (state,))
                result_db = cursor.fetchone()
                if result_db:
                    user_id = result_db[0]
                    db = get_session_for_user(user_id)
                    try:
                        # Don't fetch site_url here - it requires API calls
                        # The executor will fetch it when the task runs (weekly)
                        # Create insights task without site_url to avoid API calls
                        task_result = create_platform_insights_task(
                            user_id=user_id,
                            platform='bing',
                            site_url=None,  # Will be fetched by executor when task runs
                            db=db
                        )
                        
                        if task_result.get('success'):
                            logger.info(f"Created Bing insights task for user {user_id}")
                        else:
                            logger.warning(f"Failed to create Bing insights task: {task_result.get('error')}")
                    finally:
                        db.close()
        except Exception as e:
            # Non-critical: log but don't fail OAuth callback
            logger.warning(f"Failed to create Bing insights task after OAuth: {e}")
        
        # Return success page with postMessage script
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Bing Webmaster Connection Successful</title>
            <script>
                // Send success message to opener/parent window
                window.onload = function() {{
                    (window.opener || window.parent).postMessage({{
                        type: 'BING_OAUTH_SUCCESS',
                        success: true,
                        accessToken: '{result.get('access_token', '')}',
                        expiresIn: {result.get('expires_in', 0)}
                    }}, '*');
                    window.close();
                }};
            </script>
        </head>
        <body>
            <h1>Connection Successful!</h1>
            <p>Your Bing Webmaster Tools account has been connected successfully.</p>
            <p>You can close this window now.</p>
        </body>
        </html>
        """

        return HTMLResponse(content=html_content, headers={
            "Cross-Origin-Opener-Policy": "unsafe-none",
            "Cross-Origin-Embedder-Policy": "unsafe-none"
        })
        
    except Exception as e:
        logger.error(f"Error handling Bing Webmaster OAuth callback: {e}")
        html_content = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Bing Webmaster Connection Failed</title>
            <script>
                // Send error message to opener/parent window
                window.onload = function() {{
                    (window.opener || window.parent).postMessage({{
                        type: 'BING_OAUTH_ERROR',
                        success: false,
                        error: 'Callback error'
                    }}, '*');
                    window.close();
                }};
            </script>
        </head>
        <body>
            <h1>Connection Failed</h1>
            <p>An unexpected error occurred during connection.</p>
            <p>You can close this window and try again.</p>
        </body>
        </html>
        """
        return HTMLResponse(content=html_content, headers={
            "Cross-Origin-Opener-Policy": "unsafe-none",
            "Cross-Origin-Embedder-Policy": "unsafe-none"
        })

@router.get("/status", response_model=BingStatusResponse)
async def get_bing_oauth_status(
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get Bing Webmaster OAuth connection status."""
    try:
        user_id = user.get('id')
        if not user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User ID not found.")
        
        status_data = oauth_service.get_connection_status(user_id)
        return BingStatusResponse(**status_data)
        
    except Exception as e:
        logger.error(f"Error getting Bing Webmaster OAuth status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get Bing Webmaster connection status."
        )

@router.delete("/disconnect/{token_id}")
async def disconnect_bing_site(
    token_id: int,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Disconnect a Bing Webmaster site."""
    try:
        user_id = user.get('id')
        if not user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User ID not found.")
        
        success = oauth_service.revoke_token(user_id, token_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bing Webmaster token not found or could not be disconnected."
            )
        
        return {"success": True, "message": f"Bing Webmaster site disconnected successfully."}
        
    except Exception as e:
        logger.error(f"Error disconnecting Bing Webmaster site: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to disconnect Bing Webmaster site."
        )

@router.get("/health")
async def bing_oauth_health():
    """Bing Webmaster OAuth health check."""
    return {
        "status": "healthy",
        "service": "bing_oauth",
        "timestamp": "2024-01-01T00:00:00Z",
        "version": "1.0.0"
    }

@router.post("/purge-expired")
async def purge_expired_bing_tokens(
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Purge user's expired/inactive Bing tokens to avoid refresh loops before reauth."""
    try:
        user_id = user.get('id')
        if not user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User ID not found.")

        deleted = oauth_service.purge_expired_tokens(user_id)
        return {
            "success": True,
            "purged": deleted,
            "message": f"Purged {deleted} expired/inactive Bing tokens"
        }
    except Exception as e:
        logger.error(f"Error purging expired Bing tokens: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to purge expired Bing tokens."
        )