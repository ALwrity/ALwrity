"""
Streaming Endpoints
Handles streaming endpoints for enhanced content strategies.
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from starlette.requests import Request
from sqlalchemy.orm import Session
from loguru import logger
import json
import asyncio
from datetime import datetime

# Import database
from services.database import get_db_session

# Import authentication middleware
from middleware.auth_middleware import get_current_user, get_current_user_with_query_token

# Import services
from ....services.enhanced_strategy_service import EnhancedStrategyService
from ....services.enhanced_strategy_db_service import EnhancedStrategyDBService

# Use bounded shared cache instead of process-local unbounded dict
from ....services.content_strategy.performance.caching import CachingService

router = APIRouter(tags=["Strategy Streaming"])

# Shared bounded cache for streaming endpoints
streaming_cache_service = CachingService()

# Helper function to get database session
def get_db():
    db = get_db_session()
    try:
        yield db
    finally:
        db.close()

async def stream_data(data_generator):
    """Helper function to stream data as Server-Sent Events"""
    async for chunk in data_generator:
        if isinstance(chunk, dict):
            yield f"data: {json.dumps(chunk)}\n\n"
        else:
            yield f"data: {json.dumps({'message': str(chunk)})}\n\n"
        await asyncio.sleep(0.1)  # Small delay to prevent overwhelming

@router.get("/stream/strategies")
async def stream_enhanced_strategies(
    strategy_id: Optional[int] = Query(None, description="Specific strategy ID"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Stream enhanced strategies with real-time updates."""
    
    async def strategy_generator():
        try:
            clerk_user_id = str(current_user.get('id', ''))
            if not clerk_user_id:
                yield {"type": "error", "message": "Invalid user ID in authentication token", "timestamp": datetime.utcnow().isoformat()}
                return
            
            authenticated_user_id = clerk_user_id
            
            logger.info(f"🚀 Starting strategy stream for authenticated user: {authenticated_user_id}, strategy: {strategy_id}")
            
            # Send initial status
            yield {"type": "status", "message": "Starting strategy retrieval...", "timestamp": datetime.utcnow().isoformat()}
            
            db_service = EnhancedStrategyDBService(db)
            enhanced_service = EnhancedStrategyService(db_service)
            
            # Send progress update
            yield {"type": "progress", "message": "Querying database...", "progress": 25}
            
            # Use authenticated user_id to ensure users can only see their own strategies
            strategies_data = await enhanced_service.get_enhanced_strategies(authenticated_user_id, strategy_id, db)
            
            # Send progress update
            yield {"type": "progress", "message": "Processing strategies...", "progress": 50}
            
            if strategies_data.get("status") == "not_found":
                yield {"type": "result", "status": "not_found", "data": strategies_data}
                return
            
            # Send progress update
            yield {"type": "progress", "message": "Finalizing data...", "progress": 75}
            
            # Send final result
            yield {"type": "result", "status": "success", "data": strategies_data, "progress": 100}
            
            logger.info(f"✅ Strategy stream completed for user: {authenticated_user_id}")
            
        except Exception as e:
            logger.error(f"❌ Error in strategy stream: {str(e)}")
            yield {"type": "error", "message": str(e), "timestamp": datetime.utcnow().isoformat()}
    
    return StreamingResponse(
        stream_data(strategy_generator()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )

@router.get("/stream/strategic-intelligence")
async def stream_strategic_intelligence(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user_with_query_token),
    db: Session = Depends(get_db)
):
    """Stream strategic intelligence data with real-time updates."""
    
    async def intelligence_generator():
        try:
            clerk_user_id = str(current_user.get('id', ''))
            if not clerk_user_id:
                yield {"type": "error", "message": "Invalid user ID in authentication token", "timestamp": datetime.utcnow().isoformat()}
                return
            
            authenticated_user_id = clerk_user_id
            
            logger.info(f"🚀 Starting strategic intelligence stream for authenticated user: {authenticated_user_id}")
            
            # Check bounded shared cache first
            cache_key = f"strategic_intelligence_{authenticated_user_id}"
            cached_data = await streaming_cache_service.get_cached_data("streaming_intelligence", cache_key)
            if cached_data:
                logger.info(f"✅ Returning cached strategic intelligence data for user: {authenticated_user_id}")
                yield {"type": "result", "status": "success", "data": cached_data, "progress": 100}
                return
            
            # Send initial status
            yield {"type": "status", "message": "Loading strategic intelligence...", "timestamp": datetime.utcnow().isoformat()}
            
            db_service = EnhancedStrategyDBService(db)
            enhanced_service = EnhancedStrategyService(db_service)
            
            # Send progress update
            yield {"type": "progress", "message": "Retrieving strategies...", "progress": 20}
            
            strategies_data = await enhanced_service.get_enhanced_strategies(authenticated_user_id, None, db)
            
            # Send progress update
            yield {"type": "progress", "message": "Analyzing market positioning...", "progress": 40}
            
            if strategies_data.get("status") == "not_found":
                yield {"type": "error", "status": "not_ready", "message": "No strategies found. Complete onboarding and create a strategy before generating intelligence.", "progress": 100}
                return
            
            # Extract strategic intelligence from first strategy
            strategy = strategies_data.get("strategies", [{}])[0]
            
            # Parse ai_recommendations if it's a JSON string
            ai_recommendations = {}
            if strategy.get("ai_recommendations"):
                try:
                    if isinstance(strategy["ai_recommendations"], str):
                        ai_recommendations = json.loads(strategy["ai_recommendations"])
                    else:
                        ai_recommendations = strategy["ai_recommendations"]
                except (json.JSONDecodeError, TypeError):
                    ai_recommendations = {}
            
            # Send progress update
            yield {"type": "progress", "message": "Processing intelligence data...", "progress": 60}
            
            # Build strategic intelligence from actual strategy data — no hardcoded fallback defaults
            strategic_intelligence = {
                "market_positioning": {
                    "current_position": strategy.get("competitive_position") or None,
                    "differentiation_factors": strategy.get("differentiation_factors") or None
                },
                "competitive_analysis": {
                    "top_competitors": (strategy.get("top_competitors") or [None])[:3],
                    "competitive_advantages": strategy.get("competitive_advantages") or None,
                    "market_gaps": strategy.get("market_gaps") or None
                },
                "ai_insights": ai_recommendations.get("strategic_insights") if ai_recommendations else None,
                "opportunities": strategy.get("opportunities") or None
            }
            
            # Filter out null-only sections for cleaner responses
            strategic_intelligence = {
                k: v for k, v in strategic_intelligence.items()
                if v is not None and v != [None]
            }
            
            # Cache the strategic intelligence data
            await streaming_cache_service.set_cached_data("streaming_intelligence", cache_key, strategic_intelligence)
            
            # Send progress update
            yield {"type": "progress", "message": "Finalizing strategic intelligence...", "progress": 80}
            
            # Send final result
            yield {"type": "result", "status": "success", "data": strategic_intelligence, "progress": 100}
            
            logger.info(f"✅ Strategic intelligence stream completed for user: {authenticated_user_id}")
            
        except Exception as e:
            logger.error(f"❌ Error in strategic intelligence stream: {str(e)}")
            yield {"type": "error", "message": str(e), "timestamp": datetime.utcnow().isoformat()}
    
    return StreamingResponse(
        stream_data(intelligence_generator()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )

@router.get("/stream/keyword-research")
async def stream_keyword_research(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user_with_query_token),
    db: Session = Depends(get_db)
):
    """Stream keyword research data with real-time updates."""
    
    async def keyword_generator():
        try:
            clerk_user_id = str(current_user.get('id', ''))
            if not clerk_user_id:
                yield {"type": "error", "message": "Invalid user ID in authentication token", "timestamp": datetime.utcnow().isoformat()}
                return
            
            authenticated_user_id = clerk_user_id
            
            logger.info(f"🚀 Starting keyword research stream for authenticated user: {authenticated_user_id}")
            
            # Check bounded shared cache first
            cache_key = f"keyword_research_{authenticated_user_id}"
            cached_data = await streaming_cache_service.get_cached_data("streaming_intelligence", cache_key)
            if cached_data:
                logger.info(f"✅ Returning cached keyword research data for user: {authenticated_user_id}")
                yield {"type": "result", "status": "success", "data": cached_data, "progress": 100}
                return
            
            # Send initial status
            yield {"type": "status", "message": "Loading keyword research...", "timestamp": datetime.utcnow().isoformat()}
            
            # Import gap analysis service
            from ....services.gap_analysis_service import GapAnalysisService
            
            # Send progress update
            yield {"type": "progress", "message": "Retrieving gap analyses...", "progress": 20}
            
            gap_service = GapAnalysisService()
            # Use authenticated user_id to ensure users can only see their own data
            gap_analyses = await gap_service.get_gap_analyses(authenticated_user_id)
            
            # Send progress update
            yield {"type": "progress", "message": "Analyzing keyword opportunities...", "progress": 40}
            
            # Handle case where gap_analyses is 0, None, or empty
            if not gap_analyses or gap_analyses == 0 or len(gap_analyses) == 0:
                yield {"type": "error", "status": "not_ready", "message": "No keyword research data available. Connect data sources or run analysis first.", "progress": 100}
                return
            
            # Extract keyword data from first gap analysis
            gap_analysis = gap_analyses[0] if isinstance(gap_analyses, list) else gap_analyses
            
            # Parse analysis_results if it's a JSON string
            analysis_results = {}
            if gap_analysis.get("analysis_results"):
                try:
                    if isinstance(gap_analysis["analysis_results"], str):
                        analysis_results = json.loads(gap_analysis["analysis_results"])
                    else:
                        analysis_results = gap_analysis["analysis_results"]
                except (json.JSONDecodeError, TypeError):
                    analysis_results = {}
            
            # Send progress update
            yield {"type": "progress", "message": "Processing keyword data...", "progress": 60}
            
            # Build keyword data from actual analysis — no hardcoded fallback defaults
            keyword_data = {
                "trend_analysis": {
                    "high_volume_keywords": (analysis_results.get("opportunities") or [None])[:3],
                    "trending_keywords": analysis_results.get("trending_keywords") or None
                },
                "intent_analysis": analysis_results.get("intent_analysis") or None,
                "opportunities": analysis_results.get("opportunities") or None
            }
            
            # Filter out null-only sections
            keyword_data = {
                k: v for k, v in keyword_data.items()
                if v is not None and v != [None]
            }
            
            # Cache the keyword data
            await streaming_cache_service.set_cached_data("streaming_intelligence", cache_key, keyword_data)
            
            # Send progress update
            yield {"type": "progress", "message": "Finalizing keyword research...", "progress": 80}
            
            # Send final result
            yield {"type": "result", "status": "success", "data": keyword_data, "progress": 100}
            
            logger.info(f"✅ Keyword research stream completed for user: {authenticated_user_id}")
            
        except Exception as e:
            logger.error(f"❌ Error in keyword research stream: {str(e)}")
            yield {"type": "error", "message": str(e), "timestamp": datetime.utcnow().isoformat()}
    
    return StreamingResponse(
        stream_data(keyword_generator()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )

@router.get("/stream/ai-generation-status")
async def stream_ai_generation_status(
    request: Request,
    strategy_id: int = Query(..., description="Strategy ID"),
    current_user: Dict[str, Any] = Depends(get_current_user_with_query_token),
    db: Session = Depends(get_db)
):
    """Stream AI generation status for a strategy with real-time updates."""
    
    async def status_generator():
        try:
            clerk_user_id = str(current_user.get('id', ''))
            if not clerk_user_id:
                yield {"type": "error", "detail": "Invalid user ID", "progress": 0}
                return
            
            authenticated_user_id = clerk_user_id
            
            logger.info(f"🚀 Starting AI generation status stream for user: {authenticated_user_id}, strategy: {strategy_id}")
            
            yield {"type": "progress", "detail": "Fetching AI generation status...", "progress": 10}
            
            db_service = EnhancedStrategyDBService(db)
            enhanced_service = EnhancedStrategyService(db_service)
            
            strategy = await enhanced_service.get_enhanced_strategy(strategy_id, authenticated_user_id, db)
            
            if not strategy or strategy.get("status") == "not_found":
                yield {"type": "error", "detail": "Strategy not found", "progress": 0}
                return
            
            yield {"type": "progress", "detail": "Checking AI analysis status...", "progress": 30}
            
            ai_recommendations = strategy.get("ai_recommendations")
            if ai_recommendations:
                if isinstance(ai_recommendations, str):
                    try:
                        ai_recommendations = json.loads(ai_recommendations)
                    except (json.JSONDecodeError, TypeError):
                        ai_recommendations = {}
            
            ai_status = "completed" if ai_recommendations else "pending"
            
            if ai_status == "completed":
                yield {"type": "progress", "detail": "AI analysis completed", "progress": 80}
                yield {"type": "result", "status": "completed", "detail": "AI generation completed", "progress": 100}
            else:
                yield {"type": "progress", "detail": "AI analysis is pending", "progress": 50}
                yield {"type": "result", "status": "pending", "detail": "AI generation is in progress", "progress": 50}
            
            logger.info(f"✅ AI generation status stream completed for user: {authenticated_user_id}")
            
        except Exception as e:
            logger.error(f"❌ Error in AI generation status stream: {str(e)}")
            yield {"type": "error", "detail": str(e), "progress": 0}
    
    return StreamingResponse(
        stream_data(status_generator()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )
