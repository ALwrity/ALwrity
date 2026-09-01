"""
Health Monitoring Routes for Content Planning API
Extracted from the main content_planning.py file for better organization.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from datetime import datetime
from loguru import logger

# Import authentication
from middleware.auth_middleware import get_current_user

# Import database service
from services.database import get_db, get_session_for_user
from services.content_planning_db import ContentPlanningDBService

# Import utilities
from ...utils.error_handlers import ContentPlanningErrorHandler
from ...utils.response_builders import ResponseBuilder
from ...utils.constants import ERROR_MESSAGES, SUCCESS_MESSAGES

# Import AI analysis database service
from services.ai_analysis_db_service import AIAnalysisDBService

# Initialize services
ai_analysis_db_service = AIAnalysisDBService()

# Create router
router = APIRouter(prefix="/health", tags=["health-monitoring"])

@router.get("/backend", response_model=Dict[str, Any])
async def check_backend_health(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Check core backend health (independent of AI services)
    """
    try:
        # Check basic backend functionality
        health_status = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "services": {
                "api_server": True,
                "database_connection": False,  # Will be updated below
                "file_system": True,
                "memory_usage": "normal"
            },
            "version": "1.0.0"
        }
        
        # Test database connection
        try:
            from sqlalchemy import text
            db_session = get_session_for_user(str(current_user.get('id')))
            result = db_session.execute(text("SELECT 1"))
            result.fetchone()
            health_status["services"]["database_connection"] = True
        except Exception as e:
            logger.warning(f"Database health check failed: {str(e)}")
            health_status["services"]["database_connection"] = False
        
        # Determine overall status
        all_services_healthy = all(health_status["services"].values())
        health_status["status"] = "healthy" if all_services_healthy else "degraded"
        
        return health_status
    except Exception as e:
        logger.error(f"Backend health check failed: {e}")
        return {
            "status": "unhealthy",
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e),
            "services": {
                "api_server": False,
                "database_connection": False,
                "file_system": False,
                "memory_usage": "unknown"
            }
        }

@router.get("/ai", response_model=Dict[str, Any])
async def check_ai_services_health(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Check AI services health separately
    """
    try:
        health_status = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "services": {
                "gemini_provider": False,
                "ai_analytics_service": False,
                "ai_engine_service": False
            }
        }
        
        # Test Gemini provider
        try:
            from services.llm_providers.gemini_provider import get_gemini_api_key
            api_key = get_gemini_api_key()
            if api_key:
                health_status["services"]["gemini_provider"] = True
        except Exception as e:
            logger.warning(f"Gemini provider health check failed: {e}")
        
        # Test AI Analytics Service
        try:
            from services.ai_analytics_service import AIAnalyticsService
            ai_service = AIAnalyticsService()
            health_status["services"]["ai_analytics_service"] = True
        except Exception as e:
            logger.warning(f"AI Analytics Service health check failed: {e}")
        
        # Test AI Engine Service
        try:
            from services.content_gap_analyzer.ai_engine_service import AIEngineService
            ai_engine = AIEngineService()
            health_status["services"]["ai_engine_service"] = True
        except Exception as e:
            logger.warning(f"AI Engine Service health check failed: {e}")
        
        # Determine overall AI status
        ai_services_healthy = any(health_status["services"].values())
        health_status["status"] = "healthy" if ai_services_healthy else "unhealthy"
        
        return health_status
    except Exception as e:
        logger.error(f"AI services health check failed: {e}")
        return {
            "status": "unhealthy",
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e),
            "services": {
                "gemini_provider": False,
                "ai_analytics_service": False,
                "ai_engine_service": False
            }
        }

@router.get("/database", response_model=Dict[str, Any])
async def database_health_check(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Health check for database operations.
    """
    try:
        logger.info("Performing database health check")
        
        db_service = ContentPlanningDBService(db)
        health_status = await db_service.health_check()
        
        logger.info(f"Database health check completed: {health_status['status']}")
        return health_status
        
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Database health check failed: {str(e)}"
        )

@router.get("/debug/strategies/{user_id}")
async def debug_content_strategies(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Debug endpoint to print content strategy data directly.
    """
    try:
        logger.info(f"🔍 DEBUG: Getting content strategy data for user {user_id}")
        
        # Get latest AI analysis
        latest_analysis = await ai_analysis_db_service.get_latest_ai_analysis(
            user_id=user_id, 
            analysis_type="strategic_intelligence"
        )
        
        if latest_analysis:
            logger.info("📊 DEBUG: Content Strategy Data Found")
            logger.info("=" * 50)
            logger.info("FULL CONTENT STRATEGY DATA:")
            logger.info("=" * 50)
            
            # Print the entire data structure
            import json
            logger.info(json.dumps(latest_analysis, indent=2, default=str))
            
            return {
                "status": "success",
                "message": "Content strategy data printed to logs",
                "data": latest_analysis
            }
        else:
            logger.warning("⚠️ DEBUG: No content strategy data found")
            return {
                "status": "not_found",
                "message": "No content strategy data found",
                "data": None
            }
            
    except Exception as e:
        logger.error(f"❌ DEBUG: Error getting content strategy data: {str(e)}")
        import traceback
        logger.error(f"DEBUG Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Debug error: {str(e)}"
        )

@router.get("/comprehensive", response_model=Dict[str, Any])
async def comprehensive_health_check(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Comprehensive health check for all content planning services.
    """
    try:
        logger.info("🏥 Performing comprehensive health check")
        
        # Check backend health
        backend_health = await check_backend_health()
        
        # Check AI services health
        ai_health = await check_ai_services_health()
        
        # Check database health
        try:
            db_session = get_session_for_user(str(current_user.get('id')))
            db_service = ContentPlanningDBService(db_session)
            db_health = await db_service.health_check()
        except Exception as e:
            db_health = {
                "status": "unhealthy",
                "error": str(e)
            }
        
        # Compile comprehensive health status
        all_services = {
            "backend": backend_health,
            "ai_services": ai_health,
            "database": db_health
        }
        
        # Determine overall status
        healthy_services = sum(1 for service in all_services.values() if service.get("status") == "healthy")
        total_services = len(all_services)
        
        overall_status = "healthy" if healthy_services == total_services else "degraded"
        
        comprehensive_health = {
            "status": overall_status,
            "timestamp": datetime.utcnow().isoformat(),
            "services": all_services,
            "summary": {
                "healthy_services": healthy_services,
                "total_services": total_services,
                "health_percentage": (healthy_services / total_services) * 100 if total_services > 0 else 0
            }
        }
        
        logger.info(f"✅ Comprehensive health check completed: {overall_status}")
        return comprehensive_health
        
    except Exception as e:
        logger.error(f"❌ Comprehensive health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e),
            "services": {
                "backend": {"status": "unknown"},
                "ai_services": {"status": "unknown"},
                "database": {"status": "unknown"}
            }
        }
