"""
AI Analytics Routes for Content Planning API
Extracted from the main content_planning.py file for better organization.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from datetime import datetime
from loguru import logger
import json
import time

# Import database service
from services.database import get_db_session, get_db
from services.content_planning_db import ContentPlanningDBService

# Import models
from ..models.requests import (
    ContentEvolutionRequest, PerformanceTrendsRequest,
    ContentPerformancePredictionRequest, StrategicIntelligenceRequest
)
from ..models.responses import AIAnalyticsResponse

# Import utilities
from ...utils.error_handlers import ContentPlanningErrorHandler
from ...utils.response_builders import ResponseBuilder
from ...utils.constants import ERROR_MESSAGES, SUCCESS_MESSAGES

# Import services
from ...services.ai_analytics_service import ContentPlanningAIAnalyticsService
from middleware.auth_middleware import get_current_user

# Initialize services
ai_analytics_service = ContentPlanningAIAnalyticsService()

# Create router
router = APIRouter(prefix="/ai-analytics", tags=["ai-analytics"])

@router.post("/content-evolution", response_model=AIAnalyticsResponse)
async def analyze_content_evolution(
    request: ContentEvolutionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Analyze content evolution over time for a specific strategy.
    """
    try:
        user_id = current_user.get("user_id")
        logger.info(f"Starting content evolution analysis for strategy {request.strategy_id} (user {user_id})")
        
        result = await ai_analytics_service.analyze_content_evolution(
            user_id=user_id,
            strategy_id=request.strategy_id,
            time_period=request.time_period
        )
        
        return AIAnalyticsResponse(**result)
        
    except Exception as e:
        logger.error(f"Error analyzing content evolution: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing content evolution: {str(e)}"
        )

@router.post("/performance-trends", response_model=AIAnalyticsResponse)
async def analyze_performance_trends(
    request: PerformanceTrendsRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Analyze performance trends for content strategy.
    """
    try:
        user_id = current_user.get("user_id")
        logger.info(f"Starting performance trends analysis for strategy {request.strategy_id} (user {user_id})")
        
        result = await ai_analytics_service.analyze_performance_trends(
            strategy_id=request.strategy_id,
            metrics=request.metrics
        )
        
        return AIAnalyticsResponse(**result)
        
    except Exception as e:
        logger.error(f"Error analyzing performance trends: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing performance trends: {str(e)}"
        )

@router.post("/predict-performance", response_model=AIAnalyticsResponse)
async def predict_content_performance(
    request: ContentPerformancePredictionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Predict content performance using AI models.
    """
    try:
        user_id = current_user.get("user_id")
        logger.info(f"Starting content performance prediction for strategy {request.strategy_id} (user {user_id})")
        
        result = await ai_analytics_service.predict_content_performance(
            strategy_id=request.strategy_id,
            content_data=request.content_data
        )
        
        return AIAnalyticsResponse(**result)
        
    except Exception as e:
        logger.error(f"Error predicting content performance: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error predicting content performance: {str(e)}"
        )

@router.post("/strategic-intelligence", response_model=AIAnalyticsResponse)
async def generate_strategic_intelligence(
    request: StrategicIntelligenceRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generate strategic intelligence for content planning.
    """
    try:
        user_id = current_user.get("user_id")
        logger.info(f"Starting strategic intelligence generation for strategy {request.strategy_id} (user {user_id})")
        
        result = await ai_analytics_service.generate_strategic_intelligence(
            user_id=user_id,
            strategy_id=request.strategy_id,
            market_data=request.market_data
        )
        
        return AIAnalyticsResponse(**result)
        
    except Exception as e:
        logger.error(f"Error generating strategic intelligence: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generating strategic intelligence: {str(e)}"
        )

@router.get("/", response_model=Dict[str, Any])
async def get_ai_analytics(
    strategy_id: Optional[int] = Query(None, description="Strategy ID"),
    force_refresh: bool = Query(False, description="Force refresh AI analysis"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get AI analytics with real personalized insights - Database first approach."""
    try:
        user_id = current_user.get("user_id") or current_user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID required")
        if not strategy_id:
            raise HTTPException(status_code=400, detail="strategy_id query parameter is required")
        logger.info(f"🚀 Starting AI analytics for user: {user_id}, strategy: {strategy_id}, force_refresh: {force_refresh}")
        
        result = await ai_analytics_service.get_ai_analytics(user_id, strategy_id, force_refresh)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error generating AI analytics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating AI analytics: {str(e)}")

@router.get("/health")
async def ai_analytics_health_check(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Health check for AI analytics services.
    """
    try:
        logger.debug(f"AI analytics health check by user: {current_user.get('id')}")
        # Check AI analytics service
        service_status = {}
        
        # Test AI analytics service
        try:
            # Test with a simple operation that doesn't require data
            # Just check if the service can be instantiated
            test_service = ContentPlanningAIAnalyticsService()
            service_status['ai_analytics_service'] = 'operational'
        except Exception as e:
            service_status['ai_analytics_service'] = f'error: {str(e)}'
        
        # Determine overall status
        operational_services = sum(1 for status in service_status.values() if status == 'operational')
        total_services = len(service_status)
        
        overall_status = 'healthy' if operational_services == total_services else 'degraded'
        
        health_status = {
            'status': overall_status,
            'services': service_status,
            'operational_services': operational_services,
            'total_services': total_services,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        return health_status
        
    except Exception as e:
        logger.error(f"AI analytics health check failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"AI analytics health check failed: {str(e)}"
        )

@router.get("/results/{user_id}")
async def get_user_ai_analysis_results(
    user_id: int,
    analysis_type: Optional[str] = Query(None, description="Filter by analysis type"),
    limit: int = Query(10, description="Number of results to return"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get AI analysis results for the authenticated user."""
    try:
        authenticated_user_id = current_user.get("user_id") or current_user.get("id")
        logger.info(f"Fetching AI analysis results for authenticated user {authenticated_user_id}")
        
        result = await ai_analytics_service.get_user_ai_analysis_results(
            user_id=authenticated_user_id,
            analysis_type=analysis_type,
            limit=limit
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching AI analysis results: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/refresh/{user_id}")
async def refresh_ai_analysis(
    user_id: int,
    analysis_type: str = Query(..., description="Type of analysis to refresh"),
    strategy_id: Optional[int] = Query(None, description="Strategy ID"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Force refresh of AI analysis for the authenticated user."""
    try:
        authenticated_user_id = current_user.get("user_id") or current_user.get("id")
        logger.info(f"Force refreshing AI analysis for authenticated user {authenticated_user_id}, type: {analysis_type}")
        
        result = await ai_analytics_service.refresh_ai_analysis(
            user_id=authenticated_user_id,
            analysis_type=analysis_type,
            strategy_id=strategy_id
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error refreshing AI analysis: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/cache/{user_id}")
async def clear_ai_analysis_cache(
    user_id: int,
    analysis_type: Optional[str] = Query(None, description="Specific analysis type to clear"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Clear AI analysis cache for the authenticated user."""
    try:
        authenticated_user_id = current_user.get("user_id") or current_user.get("id")
        logger.info(f"Clearing AI analysis cache for authenticated user {authenticated_user_id}")
        
        result = await ai_analytics_service.clear_ai_analysis_cache(
            user_id=authenticated_user_id,
            analysis_type=analysis_type
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error clearing AI analysis cache: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/statistics")
async def get_ai_analysis_statistics(
    current_user: Dict[str, Any] = Depends(get_current_user),
    user_id: Optional[int] = Query(None, description="User ID for user-specific stats")
):
    """Get AI analysis statistics."""
    try:
        clerk_user_id = str(current_user.get('id', ''))
        logger.info(f"📊 Getting AI analysis statistics for authenticated user: {clerk_user_id}")
        
        result = await ai_analytics_service.get_ai_analysis_statistics(user_id or clerk_user_id)
        return result
        
    except Exception as e:
        logger.error(f"❌ Error getting AI analysis statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get AI analysis statistics: {str(e)}"
        )
