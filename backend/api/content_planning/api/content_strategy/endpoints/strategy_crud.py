"""
Strategy CRUD Endpoints
Handles CRUD operations for enhanced content strategies.
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from loguru import logger
import json
from datetime import datetime

# Import database
from services.database import get_db

# Import authentication middleware
from middleware.auth_middleware import get_current_user

# Import services
from ....services.enhanced_strategy_service import EnhancedStrategyService
from ....services.enhanced_strategy_db_service import EnhancedStrategyDBService

# Import models
from models.enhanced_strategy_models import EnhancedContentStrategy

# Import utilities
from ....utils.error_handlers import ContentPlanningErrorHandler
from ....utils.response_builders import ResponseBuilder
from ....utils.constants import ERROR_MESSAGES, SUCCESS_MESSAGES
from ....utils.data_parsers import parse_strategy_data

router = APIRouter(tags=["Strategy CRUD"])


@router.post("/create")
async def create_enhanced_strategy(
    strategy_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Create a new enhanced content strategy."""
    try:
        # Extract authenticated user_id from Clerk
        clerk_user_id = str(current_user.get('id', ''))
        if not clerk_user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid user ID in authentication token"
            )
        
        logger.info(f"Creating enhanced strategy: {strategy_data.get('name', 'Unknown')} for user: {clerk_user_id}")
        
        # Override user_id from request body with authenticated user_id (security)
        strategy_data['user_id'] = clerk_user_id
        
        # Validate required fields
        required_fields = ['name']
        for field in required_fields:
            if field not in strategy_data or not strategy_data[field]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Missing required field: {field}"
                )
        
        # Parse and validate strategy data using shared utilities
        cleaned_data, warnings = parse_strategy_data(strategy_data)
        
        # Log warnings if any
        if warnings:
            logger.warning(f"ℹ️ Strategy create warnings: {warnings}")
        
        # Create strategy
        db_service = EnhancedStrategyDBService(db)
        enhanced_service = EnhancedStrategyService(db_service)
        
        # Pass authenticated user_id for AI calls with subscription checks
        result = await enhanced_service.create_enhanced_strategy(cleaned_data, db)
        
        logger.info(f"Enhanced strategy created successfully: {result.get('strategy_id') if isinstance(result, dict) else getattr(result, 'id', None)}")
        
        response = ResponseBuilder.create_success_response(
            data=result,
            message=SUCCESS_MESSAGES['strategy_created']
        )
        
        # Include warnings if any
        if warnings:
            response['warnings'] = warnings
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating enhanced strategy: {str(e)}")
        return ContentPlanningErrorHandler.handle_general_error(e, "create_enhanced_strategy")

@router.get("/")
async def get_enhanced_strategies(
    user_id: Optional[str] = Query(None, description="User ID to filter strategies (deprecated - use authenticated user)"),
    strategy_id: Optional[int] = Query(None, description="Specific strategy ID"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get enhanced content strategies."""
    try:
        # Extract authenticated user_id from Clerk
        clerk_user_id = str(current_user.get('id', ''))
        if not clerk_user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid user ID in authentication token"
            )
        
        authenticated_user_id = clerk_user_id
        
        logger.info(f"Getting enhanced strategies for authenticated user: {authenticated_user_id}, strategy: {strategy_id}")
        
        db_service = EnhancedStrategyDBService(db)
        enhanced_service = EnhancedStrategyService(db_service)
        
        # Use authenticated user_id to ensure users can only see their own strategies
        strategies_data = await enhanced_service.get_enhanced_strategies(authenticated_user_id, strategy_id, db)
        
        logger.info(f"Retrieved {strategies_data.get('total_count', 0)} strategies")
        return ResponseBuilder.create_success_response(
            data=strategies_data,
            message=SUCCESS_MESSAGES['strategies_retrieved']
        )
        
    except Exception as e:
        logger.error(f"Error getting enhanced strategies: {str(e)}")
        return ContentPlanningErrorHandler.handle_general_error(e, "get_enhanced_strategies")

@router.get("/{strategy_id}")
async def get_enhanced_strategy_by_id(
    strategy_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get a specific enhanced strategy by ID."""
    try:
        clerk_user_id = str(current_user.get('id', ''))
        if not clerk_user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid user ID in authentication token"
            )
        
        authenticated_user_id = clerk_user_id
        
        logger.info(f"Getting enhanced strategy by ID: {strategy_id} for authenticated user: {authenticated_user_id}")
        
        db_service = EnhancedStrategyDBService(db)
        enhanced_service = EnhancedStrategyService(db_service)
        
        strategies_data = await enhanced_service.get_enhanced_strategies(user_id=authenticated_user_id, strategy_id=strategy_id, db=db)
        
        if strategies_data.get("status") == "not_found" or not strategies_data.get("strategies"):
            raise HTTPException(
                status_code=404,
                detail=f"Enhanced strategy with ID {strategy_id} not found or you don't have access to it"
            )
        
        strategy = strategies_data["strategies"][0]
        
        # Verify ownership
        if strategy.get('user_id') != authenticated_user_id:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to access this strategy"
            )
        
        logger.info(f"Retrieved strategy: {strategy.get('name')}")
        return ResponseBuilder.create_success_response(
            data=strategy,
            message=SUCCESS_MESSAGES['strategy_retrieved']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting enhanced strategy by ID: {str(e)}")
        return ContentPlanningErrorHandler.handle_general_error(e, "get_enhanced_strategy_by_id")

@router.put("/{strategy_id}")
async def update_enhanced_strategy(
    strategy_id: int,
    update_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Update an enhanced strategy."""
    try:
        clerk_user_id = str(current_user.get('id', ''))
        if not clerk_user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid user ID in authentication token"
            )
        
        authenticated_user_id = clerk_user_id
        
        logger.info(f"Updating enhanced strategy: {strategy_id} for authenticated user: {authenticated_user_id}")
        
        # Check if strategy exists and verify ownership
        existing_strategy = db.query(EnhancedContentStrategy).filter(
            EnhancedContentStrategy.id == strategy_id
        ).first()
        
        if not existing_strategy:
            raise HTTPException(
                status_code=404,
                detail=f"Enhanced strategy with ID {strategy_id} not found"
            )
        
        # Verify ownership
        if existing_strategy.user_id != authenticated_user_id:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to update this strategy"
            )
        
        # Update strategy fields
        # Remap the public-API key 'performance_metrics' (the JSON
        # column) to the renamed attribute 'performance_metrics_data'.
        # The relationship slot on the model is also named
        # 'performance_metrics' but expects a list of
        # StrategyPerformanceMetrics records, not a JSON dict, so
        # the setattr loop must not stomp it. (C2 mass-assignment
        # fix is a separate concern -- this only prevents the
        # relationship from being clobbered.)
        for field, value in update_data.items():
            target_field = 'performance_metrics_data' if field == 'performance_metrics' else field
            if hasattr(existing_strategy, target_field):
                setattr(existing_strategy, target_field, value)
        
        existing_strategy.updated_at = datetime.utcnow()
        
        # Save to database
        db.commit()
        db.refresh(existing_strategy)
        
        logger.info(f"Enhanced strategy updated successfully: {strategy_id}")
        return ResponseBuilder.create_success_response(
            data=existing_strategy.to_dict(),
            message=SUCCESS_MESSAGES['strategy_updated']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating enhanced strategy: {str(e)}")
        return ContentPlanningErrorHandler.handle_general_error(e, "update_enhanced_strategy")

@router.delete("/{strategy_id}")
async def delete_enhanced_strategy(
    strategy_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Delete an enhanced strategy."""
    try:
        # Extract authenticated user_id from Clerk
        clerk_user_id = str(current_user.get('id', ''))
        if not clerk_user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid user ID in authentication token"
            )
        
        authenticated_user_id = clerk_user_id
        
        logger.info(f"Deleting enhanced strategy: {strategy_id} for authenticated user: {authenticated_user_id}")
        
        # Check if strategy exists and verify ownership
        strategy = db.query(EnhancedContentStrategy).filter(
            EnhancedContentStrategy.id == strategy_id
        ).first()
        
        if not strategy:
            raise HTTPException(
                status_code=404,
                detail=f"Enhanced strategy with ID {strategy_id} not found"
            )
        
        # Verify ownership
        if strategy.user_id != authenticated_user_id:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to delete this strategy"
            )
        
        # Delete strategy
        db.delete(strategy)
        db.commit()
        
        logger.info(f"Enhanced strategy deleted successfully: {strategy_id}")
        return ResponseBuilder.create_success_response(
            data={"strategy_id": strategy_id},
            message=SUCCESS_MESSAGES['strategy_deleted']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting enhanced strategy: {str(e)}")
        return ContentPlanningErrorHandler.handle_general_error(e, "delete_enhanced_strategy") 
