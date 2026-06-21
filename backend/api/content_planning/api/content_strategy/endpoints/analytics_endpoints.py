"""
Analytics Endpoints
Handles analytics and AI analysis endpoints for enhanced content strategies.
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from loguru import logger
from datetime import datetime

# Import database
from services.database import get_db_session

# Import services
from ....services.enhanced_strategy_service import EnhancedStrategyService
from ....services.enhanced_strategy_db_service import EnhancedStrategyDBService

# Import models
from models.enhanced_strategy_models import EnhancedContentStrategy, EnhancedAIAnalysisResult

# Import authentication
from middleware.auth_middleware import get_current_user

# Import utilities
from ....utils.error_handlers import ContentPlanningErrorHandler
from ....utils.response_builders import ResponseBuilder
from ....utils.constants import ERROR_MESSAGES, SUCCESS_MESSAGES

router = APIRouter(tags=["Strategy Analytics"])

# Helper function to get database session
def get_db():
    db = get_db_session()
    try:
        yield db
    finally:
        db.close()


async def _verify_strategy_ownership(
    strategy_id: int,
    current_user: Dict[str, Any],
    db_service: "EnhancedStrategyDBService",
) -> Dict[str, Any]:
    """Load the strategy and confirm the authenticated user owns it.

    The six analytics endpoints in this module all accept a
    strategy_id from the URL and an authenticated current_user
    from the auth dependency, but until this helper was added
    none of them actually compared the two. Any authenticated
    caller could read analytics, AI history, completion stats,
    or trigger AI re-generation on any strategy in the system.

    Returns the loaded strategy dict on success. Raises 404 if
    the strategy does not exist, and 403 if the strategy exists
    but is owned by a different user. 404 is preferred to 403 for
    the not-yours case so we do not leak the existence of other
    users' strategy IDs to a probing attacker.
    """
    clerk_user_id = str(current_user.get("id", ""))
    if not clerk_user_id:
        raise HTTPException(
            status_code=401,
            detail="Authenticated user id missing from request",
        )
    strategy = await db_service.get_enhanced_strategy(strategy_id)
    if not strategy:
        raise ContentPlanningErrorHandler.handle_not_found_error(
            "Enhanced strategy", strategy_id
        )
    if str(strategy.user_id) != clerk_user_id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to access this strategy",
        )
    return strategy

@router.get("/{strategy_id}/analytics")
async def get_enhanced_strategy_analytics(
    strategy_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get comprehensive analytics for an enhanced strategy."""
    try:
        logger.info(f"🚀 Getting analytics for enhanced strategy: {strategy_id}")

        db_service = EnhancedStrategyDBService(db)
        await _verify_strategy_ownership(strategy_id, current_user, db_service)

        # Get strategy with analytics
        strategies_with_analytics = await db_service.get_enhanced_strategies_with_analytics(
            strategy_id=strategy_id
        )

        if not strategies_with_analytics:
            raise ContentPlanningErrorHandler.handle_not_found_error("Enhanced strategy", strategy_id)

        strategy_analytics = strategies_with_analytics[0]

        logger.info(f"✅ Enhanced strategy analytics retrieved successfully: {strategy_id}")
        
        return ResponseBuilder.create_success_response(
            message="Enhanced strategy analytics retrieved successfully",
            data=strategy_analytics
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting enhanced strategy analytics: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "get_enhanced_strategy_analytics")

@router.get("/{strategy_id}/ai-analyses")
async def get_enhanced_strategy_ai_analysis(
    strategy_id: int,
    limit: int = Query(10, description="Number of AI analysis results to return"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get AI analysis history for an enhanced strategy."""
    try:
        logger.info(f"🚀 Getting AI analysis for enhanced strategy: {strategy_id}")

        db_service = EnhancedStrategyDBService(db)
        await _verify_strategy_ownership(strategy_id, current_user, db_service)

        # Get AI analysis history
        ai_analysis_history = await db_service.get_ai_analysis_history(strategy_id, limit)
        
        logger.info(f"✅ AI analysis history retrieved successfully: {strategy_id}")
        
        return ResponseBuilder.create_success_response(
            message="Enhanced strategy AI analysis retrieved successfully",
            data={
                "strategy_id": strategy_id,
                "ai_analysis_history": ai_analysis_history,
                "total_analyses": len(ai_analysis_history)
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting enhanced strategy AI analysis: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "get_enhanced_strategy_ai_analysis")

@router.get("/{strategy_id}/completion")
async def get_enhanced_strategy_completion_stats(
    strategy_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get completion statistics for an enhanced strategy."""
    try:
        logger.info(f"🚀 Getting completion stats for enhanced strategy: {strategy_id}")

        db_service = EnhancedStrategyDBService(db)
        strategy = await _verify_strategy_ownership(
            strategy_id, current_user, db_service
        )

        # Calculate completion stats
        completion_stats = {
            "strategy_id": strategy_id,
            "completion_percentage": strategy.completion_percentage,
            "total_fields": 30,  # 30+ strategic inputs
            "filled_fields": len([f for f in strategy.__dict__.keys() if getattr(strategy, f) is not None]),
            "missing_fields": 30 - len([f for f in strategy.__dict__.keys() if getattr(strategy, f) is not None]),
            "last_updated": strategy.updated_at.isoformat() if strategy.updated_at else None
        }
        
        logger.info(f"✅ Completion stats retrieved successfully: {strategy_id}")
        
        return ResponseBuilder.create_success_response(
            message="Enhanced strategy completion stats retrieved successfully",
            data=completion_stats
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting enhanced strategy completion stats: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "get_enhanced_strategy_completion_stats")

@router.get("/{strategy_id}/onboarding-integration")
async def get_enhanced_strategy_onboarding_integration(
    strategy_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get onboarding data integration for an enhanced strategy."""
    try:
        logger.info(f"🚀 Getting onboarding integration for enhanced strategy: {strategy_id}")

        db_service = EnhancedStrategyDBService(db)
        await _verify_strategy_ownership(strategy_id, current_user, db_service)
        onboarding_integration = await db_service.get_onboarding_integration(strategy_id)
        
        if not onboarding_integration:
            return ResponseBuilder.create_success_response(
                data={"strategy_id": strategy_id, "onboarding_integration": None},
                message="No onboarding integration found for this strategy",
                status_code=200
            )
        
        logger.info(f"✅ Onboarding integration retrieved successfully: {strategy_id}")
        
        return ResponseBuilder.create_success_response(
            message="Enhanced strategy onboarding integration retrieved successfully",
            data=onboarding_integration
        )
        
    except Exception as e:
        logger.error(f"❌ Error getting onboarding integration: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "get_enhanced_strategy_onboarding_integration")

@router.post("/{strategy_id}/ai-recommendations")
async def generate_enhanced_ai_recommendations(
    strategy_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Generate AI recommendations for an enhanced strategy."""
    try:
        logger.info(f"🚀 Generating AI recommendations for enhanced strategy: {strategy_id}")

        # Get strategy
        db_service = EnhancedStrategyDBService(db)
        strategy = await _verify_strategy_ownership(
            strategy_id, current_user, db_service
        )

        # Generate AI recommendations
        enhanced_service = EnhancedStrategyService(db_service)
        # Use the authenticated user id (not strategy.user_id) for
        # subscription checks and downstream attribution. The previous
        # code derived user_id from strategy.user_id, which is fine
        # for an owned strategy but would silently attribute work to
        # the strategy owner in any path that bypassed auth.
        user_id = str(current_user.get("id", ""))
        await enhanced_service._generate_comprehensive_ai_recommendations(strategy, db, user_id=user_id)
        
        # Get updated strategy data
        updated_strategy = await db_service.get_enhanced_strategy(strategy_id)
        
        logger.info(f"✅ AI recommendations generated successfully: {strategy_id}")
        
        return ResponseBuilder.create_success_response(
            message="Enhanced strategy AI recommendations generated successfully",
            data=updated_strategy.to_dict()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error generating AI recommendations: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "generate_enhanced_ai_recommendations")

@router.post("/{strategy_id}/ai-analysis/regenerate")
async def regenerate_enhanced_strategy_ai_analysis(
    strategy_id: int,
    analysis_type: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Regenerate AI analysis for an enhanced strategy."""
    try:
        logger.info(f"🚀 Regenerating AI analysis for enhanced strategy: {strategy_id}, type: {analysis_type}")

        # Get strategy
        db_service = EnhancedStrategyDBService(db)
        strategy = await _verify_strategy_ownership(
            strategy_id, current_user, db_service
        )

        # Regenerate AI analysis
        enhanced_service = EnhancedStrategyService(db_service)
        # Use the authenticated user id, not strategy.user_id (see
        # ai-recommendations endpoint above for rationale).
        user_id = str(current_user.get("id", ""))
        await enhanced_service._generate_specialized_recommendations(strategy, analysis_type, db, user_id=user_id)
        
        # Get updated strategy data
        updated_strategy = await db_service.get_enhanced_strategy(strategy_id)
        
        logger.info(f"✅ AI analysis regenerated successfully: {strategy_id}")
        
        return ResponseBuilder.create_success_response(
            message="Enhanced strategy AI analysis regenerated successfully",
            data=updated_strategy.to_dict()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error regenerating AI analysis: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "regenerate_enhanced_strategy_ai_analysis") 