"""Google Search Console Authentication Router for ALwrity."""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import HTMLResponse, JSONResponse
from typing import Dict, List, Any, Optional
from pydantic import BaseModel
from loguru import logger
import os

from services.gsc_service import GSCService
from services.gsc_brainstorm_service import GSCBrainstormService
from services.analytics_cache_service import analytics_cache
from middleware.auth_middleware import get_current_user

# Initialize router
router = APIRouter(prefix="/gsc", tags=["Google Search Console"])

# Initialize GSC service
gsc_service = GSCService()
brainstorm_service = GSCBrainstormService(gsc_service)

# Pydantic models
class GSCAnalyticsRequest(BaseModel):
    site_url: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class GSCBrainstormRequest(BaseModel):
    keywords: str
    site_url: Optional[str] = None
    force_refresh: bool = False

class GSCStatusResponse(BaseModel):
    connected: bool
    sites: Optional[List[Dict[str, Any]]] = None
    last_sync: Optional[str] = None

@router.get("/auth/url")
async def get_gsc_auth_url(user: dict = Depends(get_current_user)):
    """Get Google Search Console OAuth authorization URL."""
    try:
        user_id = user.get('id')
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        logger.info(f"Generating GSC OAuth URL for user: {user_id}")
        
        auth_url = gsc_service.get_oauth_url(user_id)
        
        logger.info(f"GSC OAuth URL generated successfully for user: {user_id}")
        logger.info(f"OAuth URL: {auth_url[:100]}...")
        return {"auth_url": auth_url}
        
    except FileNotFoundError as e:
        logger.error(f"GSC credentials not found: {e}")
        raise HTTPException(
            status_code=503, 
            detail="Google Search Console integration is not configured. Please add gsc_credentials.json to the backend directory or set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables."
        )
    except Exception as e:
        logger.error(f"Error generating GSC OAuth URL: {e}")
        logger.error(f"Error details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating OAuth URL: {str(e)}")

@router.get("/callback")
async def handle_gsc_callback(
    code: str = Query(..., description="Authorization code from Google"),
    state: str = Query(..., description="State parameter for security")
):
    """Handle Google Search Console OAuth callback.

    For a smoother UX when opened in a popup, this endpoint returns a tiny HTML
    page that posts a completion message back to the opener window and closes
    itself. The JSON payload is still included in the page for debugging.
    """
    try:
        logger.info(f"Handling GSC OAuth callback with code: {code[:10]}...")
        
        success = gsc_service.handle_oauth_callback(code, state)
        
        # If state verification failed, check if user is already connected
        # (handles duplicate callbacks where state was consumed by a prior request)
        if not success:
            user_id_from_state = state.split(':')[0] if ':' in state else None
            if user_id_from_state:
                existing_creds = gsc_service.load_user_credentials(user_id_from_state)
                if existing_creds:
                    logger.info(f"GSC OAuth state already consumed, but user {user_id_from_state} has valid credentials — treating as success")
                    success = True
        
        if success:
            logger.info("GSC OAuth callback handled successfully")
            analytics_cache.invalidate('platform_status', user_id=state.split(':')[0] if ':' in state else None)
            
            # Create GSC insights task immediately after successful connection
            try:
                from services.database import get_session_for_user
                from services.platform_insights_monitoring_service import create_platform_insights_task
                
                # Get user_id from state (stored during OAuth flow)
                # Format is "user_id:random_string"
                user_id = state.split(':')[0] if ':' in state else None
                
                if user_id:
                    db = get_session_for_user(user_id)
                    if db:
                        try:
                            task_result = create_platform_insights_task(
                                user_id=user_id,
                                platform='gsc',
                                site_url=None,
                                db=db
                            )
                            
                            if task_result.get('success'):
                                logger.info(f"Created GSC insights task for user {user_id}")
                            else:
                                logger.warning(f"Failed to create GSC insights task: {task_result.get('error')}")
                        finally:
                            db.close()
                    else:
                        logger.warning(f"Could not create DB session for user {user_id}")
                else:
                    logger.warning(f"Could not extract user_id from state: {state}")
            except Exception as e:
                # Non-critical: log but don't fail OAuth callback
                logger.warning(f"Failed to create GSC insights task after OAuth: {e}", exc_info=True)
            
            html = """
<!doctype html>
<html>
  <head><meta charset=\"utf-8\"><title>GSC Connected</title></head>
  <body style=\"font-family: sans-serif; padding: 24px;\">
    <p>Connection Successful. You can close this window.</p>
    <script>
      try {{ window.opener && window.opener.postMessage({{ type: 'GSC_AUTH_SUCCESS' }}, '*'); }} catch (e) {{}}
      try {{ window.close(); }} catch (e) {{}}
    </script>
  </body>
  </html>
"""
            return HTMLResponse(
                content=html,
                headers={"Cross-Origin-Opener-Policy": "unsafe-none"},
            )
        else:
            logger.error("Failed to handle GSC OAuth callback")
            html = """
<!doctype html>
<html>
  <head><meta charset=\"utf-8\"><title>GSC Connection Failed</title></head>
  <body style=\"font-family: sans-serif; padding: 24px;\">
    <p>Connection Failed. Please close this window and try again.</p>
    <script>
      try {{ window.opener && window.opener.postMessage({{ type: 'GSC_AUTH_ERROR' }}, '*'); }} catch (e) {{}}
    </script>
  </body>
  </html>
"""
            return HTMLResponse(
                status_code=400,
                content=html,
                headers={"Cross-Origin-Opener-Policy": "unsafe-none"},
            )
            
    except Exception as e:
        logger.error(f"Error handling GSC OAuth callback: {e}")
        html = f"""
<!doctype html>
<html>
  <head><meta charset=\"utf-8\"><title>GSC Connection Error</title></head>
  <body style=\"font-family: sans-serif; padding: 24px;\">
    <p>Connection Error. Please close this window and try again.</p>
    <pre style=\"white-space: pre-wrap;\">{str(e)}</pre>
    <script>
      try {{ window.opener && window.opener.postMessage({{ type: 'GSC_AUTH_ERROR' }}, '*'); }} catch (e) {{}}
    </script>
  </body>
  </html>
"""
        return HTMLResponse(
            status_code=500,
            content=html,
            headers={"Cross-Origin-Opener-Policy": "unsafe-none"},
        )

@router.get("/sites")
async def get_gsc_sites(user: dict = Depends(get_current_user)):
    """Get user's Google Search Console sites."""
    try:
        user_id = user.get('id')
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        logger.info(f"Getting GSC sites for user: {user_id}")
        
        sites = gsc_service.get_site_list(user_id)
        
        logger.info(f"Retrieved {len(sites)} GSC sites for user: {user_id}")
        return {"sites": sites}
        
    except Exception as e:
        logger.error(f"Error getting GSC sites: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting sites: {str(e)}")

@router.post("/analytics")
async def get_gsc_analytics(
    request: GSCAnalyticsRequest,
    user: dict = Depends(get_current_user)
):
    """Get Google Search Console analytics data."""
    try:
        user_id = user.get('id')
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        logger.info(f"Getting GSC analytics for user: {user_id}, site: {request.site_url}")
        
        analytics = gsc_service.get_search_analytics(
            user_id=user_id,
            site_url=request.site_url,
            start_date=request.start_date,
            end_date=request.end_date
        )
        
        logger.info(f"Retrieved GSC analytics for user: {user_id}")
        return analytics
        
    except Exception as e:
        logger.error(f"Error getting GSC analytics: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting analytics: {str(e)}")

@router.post("/brainstorm")
async def brainstorm_topics(
    request: GSCBrainstormRequest,
    user: dict = Depends(get_current_user),
):
    """Brainstorm blog topic suggestions based on the user's GSC data.

    The user must have GSC connected. If no site_url is provided,
    the first verified site is used automatically.
    """
    try:
        user_id = user.get('id')
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")

        tokens = request.keywords.strip().split()
        if len(tokens) < 3:
            raise HTTPException(
                status_code=400,
                detail="Please provide at least 3 words for brainstorming topic suggestions.",
            )

        logger.info(f"GSC brainstorm for user: {user_id}, keywords: {request.keywords!r}")

        # Check DB cache first (unless forced refresh)
        if not request.force_refresh:
            from services.gsc_brainstorm_cache_service import get_cached_result
            cached = get_cached_result(user_id, request.keywords, request.site_url)
            if cached:
                logger.info(f"GSC brainstorm cache HIT for user: {user_id}")
                return cached

        result = brainstorm_service.brainstorm_topics(
            user_id=user_id,
            keywords=request.keywords,
            site_url=request.site_url,
        )

        if "error" in result and not result.get("content_opportunities"):
            status = 400 if "No GSC sites" in result["error"] else 500
            raise HTTPException(status_code=status, detail=result["error"])

        # Save successful result to DB cache
        if not result.get("error") and result.get("content_opportunities"):
            from services.gsc_brainstorm_cache_service import save_cached_result
            save_cached_result(user_id, request.keywords, result, request.site_url)

        logger.info(f"GSC brainstorm completed for user: {user_id}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in GSC brainstorm: {e}")
        raise HTTPException(status_code=500, detail=f"Error brainstorming topics: {str(e)}")

@router.get("/sitemaps/{site_url:path}")
async def get_gsc_sitemaps(
    site_url: str,
    user: dict = Depends(get_current_user)
):
    """Get sitemaps for a specific site."""
    try:
        user_id = user.get('id')
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        logger.info(f"Getting GSC sitemaps for user: {user_id}, site: {site_url}")
        
        sitemaps = gsc_service.get_sitemaps(user_id, site_url)
        
        logger.info(f"Retrieved {len(sitemaps)} sitemaps for user: {user_id}")
        return {"sitemaps": sitemaps}
        
    except Exception as e:
        logger.error(f"Error getting GSC sitemaps: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting sitemaps: {str(e)}")

@router.get("/status")
async def get_gsc_status(user: dict = Depends(get_current_user)):
    """Get GSC connection status for user."""
    try:
        user_id = user.get('id')
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        logger.info(f"Checking GSC status for user: {user_id}")
        
        # Check if user has credentials
        credentials = gsc_service.load_user_credentials(user_id)
        connected = credentials is not None
        
        sites = []
        if connected:
            try:
                sites = gsc_service.get_site_list(user_id)
            except Exception as e:
                logger.warning(f"Could not get sites for user {user_id}: {e}")
                # Clear incomplete credentials and mark as disconnected
                gsc_service.clear_incomplete_credentials(user_id)
                connected = False
        
        status_response = GSCStatusResponse(
            connected=connected,
            sites=sites if connected else None,
            last_sync=None  # Could be enhanced to track last sync time
        )
        
        logger.info(f"GSC status checked for user: {user_id}, connected: {connected}")
        return status_response
        
    except Exception as e:
        logger.error(f"Error checking GSC status: {e}")
        raise HTTPException(status_code=500, detail=f"Error checking status: {str(e)}")

@router.delete("/disconnect")
async def disconnect_gsc(user: dict = Depends(get_current_user)):
    """Disconnect user's Google Search Console account."""
    try:
        user_id = user.get('id')
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        logger.info(f"Disconnecting GSC for user: {user_id}")
        
        success = gsc_service.revoke_user_access(user_id)
        
        if success:
            logger.info(f"GSC disconnected successfully for user: {user_id}")
            return {"success": True, "message": "GSC disconnected successfully"}
        else:
            logger.error(f"Failed to disconnect GSC for user: {user_id}")
            raise HTTPException(status_code=500, detail="Failed to disconnect GSC")
            
    except Exception as e:
        logger.error(f"Error disconnecting GSC: {e}")
        raise HTTPException(status_code=500, detail=f"Error disconnecting GSC: {str(e)}")

@router.post("/clear-incomplete")
async def clear_incomplete_credentials(user: dict = Depends(get_current_user)):
    """Clear incomplete GSC credentials that are missing required fields."""
    try:
        user_id = user.get('id')
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        logger.info(f"Clearing incomplete GSC credentials for user: {user_id}")
        
        success = gsc_service.clear_incomplete_credentials(user_id)
        
        if success:
            logger.info(f"Incomplete GSC credentials cleared for user: {user_id}")
            return {"success": True, "message": "Incomplete credentials cleared"}
        else:
            logger.error(f"Failed to clear incomplete credentials for user: {user_id}")
            raise HTTPException(status_code=500, detail="Failed to clear incomplete credentials")
            
    except Exception as e:
        logger.error(f"Error clearing incomplete credentials: {e}")
        raise HTTPException(status_code=500, detail=f"Error clearing incomplete credentials: {str(e)}")

@router.get("/health")
async def gsc_health_check():
    """Health check for GSC service."""
    try:
        logger.info("GSC health check requested")
        return {
            "status": "healthy",
            "service": "Google Search Console API",
            "timestamp": "2024-01-15T10:30:00Z"
        }
    except Exception as e:
        logger.error(f"GSC health check failed: {e}")
        raise HTTPException(status_code=500, detail="GSC service unhealthy")
