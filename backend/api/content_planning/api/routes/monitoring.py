"""
API Monitoring Routes
Simple endpoints to expose API monitoring and cache statistics.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from loguru import logger

from services.subscription import get_monitoring_stats, get_lightweight_stats
from services.comprehensive_user_data_cache_service import ComprehensiveUserDataCacheService
from services.database import get_db
from middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/monitoring", tags=["monitoring"])

@router.get("/api-stats")
async def get_api_statistics(minutes: int = 5, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Get current API monitoring statistics."""
    try:
        user_id = current_user.get('id') or current_user.get('clerk_user_id')
        stats = await get_monitoring_stats(minutes=minutes)
        return {
            "status": "success",
            "data": stats,
            "message": "API monitoring statistics retrieved successfully"
        }
    except Exception as e:
        logger.error(f"Error getting API stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get API statistics")

@router.get("/lightweight-stats")
async def get_lightweight_statistics(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Get lightweight stats for dashboard header."""
    try:
        user_id = current_user.get('id') or current_user.get('clerk_user_id')
        logger.debug(f"Fetching lightweight stats for user {user_id}")
        
        if not user_id:
            logger.error(f"User ID is missing from current_user: {current_user}")
            # Return empty stats instead of 500
            return {
                "status": "success",
                "data": {
                    "status": "unknown",
                    "icon": "⚪",
                    "recent_requests": 0,
                    "recent_errors": 0,
                    "error_rate": 0.0,
                    "timestamp": datetime.utcnow().isoformat()
                },
                "message": "User ID missing, returning empty stats"
            }
        
        try:
            stats = await get_lightweight_stats(user_id)
            logger.debug(f"Lightweight stats retrieved for user {user_id}")
        except Exception as e:
            logger.error(f"Error calling get_lightweight_stats: {str(e)}", exc_info=True)
            # Return empty stats instead of 500 to keep frontend alive
            stats = {
                "status": "unknown",
                "icon": "⚪",
                "recent_requests": 0,
                "recent_errors": 0,
                "error_rate": 0.0,
                "timestamp": datetime.utcnow().isoformat()
            }

        return {
            "status": "success",
            "data": stats,
            "message": "Lightweight monitoring statistics retrieved successfully"
        }
    except Exception as e:
        logger.error(f"Error getting lightweight stats: {str(e)}", exc_info=True)
        # Even top-level error should not 500 if possible, but at least we log it.
        # We'll return a safe response here too.
        return {
            "status": "success",
            "data": {
                "status": "error",
                "icon": "🔴",
                "recent_requests": 0,
                "recent_errors": 0,
                "error_rate": 0.0,
                "timestamp": datetime.utcnow().isoformat()
            },
            "message": f"Error retrieving stats: {str(e)}"
        }

@router.get("/cache-stats")
async def get_cache_statistics(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db = None
) -> Dict[str, Any]:
    """Get comprehensive user data cache statistics."""
    try:
        if not db:
            db = next(get_db())
        
        cache_service = ComprehensiveUserDataCacheService(db)
        cache_stats = cache_service.get_cache_stats()
        
        return {
            "status": "success",
            "data": cache_stats,
            "message": "Cache statistics retrieved successfully"
        }
    except Exception as e:
        logger.error(f"Error getting cache stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get cache statistics")

@router.get("/health")
async def get_system_health(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Get overall system health status.
    
    Optimized to fail fast - cache stats are optional and won't block the response.
    """
    try:
        user_id = current_user.get('id') or current_user.get('clerk_user_id')
        # Get lightweight API stats (this is the critical path)
        api_stats = await get_lightweight_stats(user_id)
        
        # Get cache stats if available (non-blocking - don't fail if unavailable)
        cache_stats = {}
        try:
            db = next(get_db())
            cache_service = ComprehensiveUserDataCacheService(db)
            cache_stats = cache_service.get_cache_stats()
            db.close()
        except Exception as cache_err:
            # Cache stats are optional - log at debug level, don't fail
            logger.debug(f"Cache stats unavailable: {cache_err}")
            cache_stats = {"error": "Cache service unavailable"}
        
        # Determine overall health
        system_health = api_stats['status']
        if api_stats['recent_errors'] > 10:
            system_health = "critical"
        
        return {
            "status": "success",
            "data": {
                "system_health": system_health,
                "icon": api_stats['icon'],
                "api_performance": {
                    "recent_requests": api_stats['recent_requests'],
                    "recent_errors": api_stats['recent_errors'],
                    "error_rate": api_stats['error_rate']
                },
                "cache_performance": cache_stats,
                "timestamp": api_stats['timestamp']
            },
            "message": f"System health: {system_health}"
        }
    except Exception as e:
        logger.error(f"Error getting system health: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "data": {
                "system_health": "unknown",
                "icon": "⚪",
                "error": str(e)
            },
            "message": "Failed to get system health"
        }
