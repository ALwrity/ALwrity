"""
AI Generation Endpoints
Handles AI-powered strategy generation endpoints.
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from loguru import logger
from datetime import datetime

# Import database
from services.database import get_db_session

# Import services
from ....services.content_strategy.ai_generation import AIStrategyGenerator, StrategyGenerationConfig
from ....services.enhanced_strategy_service import EnhancedStrategyService
from ....services.enhanced_strategy_db_service import EnhancedStrategyDBService

# Import educational content manager
from .content_strategy.educational_content import EducationalContentManager

# Import authentication
from middleware.auth_middleware import get_current_user

# Import utilities
from ....utils.error_handlers import ContentPlanningErrorHandler
from ....utils.response_builders import ResponseBuilder
from ....utils.constants import ERROR_MESSAGES, SUCCESS_MESSAGES

router = APIRouter(tags=["AI Strategy Generation"])

# Helper function to get database session
def get_db():
    db = get_db_session()
    try:
        yield db
    finally:
        db.close()

# Global storage for latest strategies (more persistent than task status)
_latest_strategies = {}

@router.post("/generate-comprehensive-strategy")
async def generate_comprehensive_strategy(
    current_user: Dict[str, Any] = Depends(get_current_user),
    strategy_name: Optional[str] = None,
    config: Optional[Dict[str, Any]] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Generate a comprehensive AI-powered content strategy."""
    try:
        user_id = current_user.get('id')
        logger.info(f"🚀 Generating comprehensive AI strategy for user: {user_id}")
        
        # Get user context and onboarding data
        db_service = EnhancedStrategyDBService(db)
        enhanced_service = EnhancedStrategyService(db_service)
        
        # Get onboarding data for context
        onboarding_data = await enhanced_service._get_onboarding_data(user_id)
        
        # Build context for AI generation
        context = {
            "onboarding_data": onboarding_data,
            "user_id": user_id,
            "generation_config": config or {}
        }
        
        # Create strategy generation config
        generation_config = StrategyGenerationConfig(
            include_competitive_analysis=config.get("include_competitive_analysis", True) if config else True,
            include_content_calendar=config.get("include_content_calendar", True) if config else True,
            include_performance_predictions=config.get("include_performance_predictions", True) if config else True,
            include_implementation_roadmap=config.get("include_implementation_roadmap", True) if config else True,
            include_risk_assessment=config.get("include_risk_assessment", True) if config else True,
            max_content_pieces=config.get("max_content_pieces", 50) if config else 50,
            timeline_months=config.get("timeline_months", 12) if config else 12
        )
        
        # Initialize AI strategy generator
        strategy_generator = AIStrategyGenerator(generation_config)
        
        # Generate comprehensive strategy
        comprehensive_strategy = await strategy_generator.generate_comprehensive_strategy(
            user_id=user_id,
            context=context,
            strategy_name=strategy_name
        )
        
        logger.info(f"✅ Comprehensive AI strategy generated successfully for user: {user_id}")
        
        return ResponseBuilder.create_success_response(
            message="Comprehensive AI strategy generated successfully",
            data=comprehensive_strategy
        )
        
    except RuntimeError as e:
        logger.error(f"❌ AI service error generating comprehensive strategy: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"AI service temporarily unavailable: {str(e)}"
        )
    except Exception as e:
        logger.error(f"❌ Error generating comprehensive strategy: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "generate_comprehensive_strategy")

@router.post("/generate-strategy-component")
async def generate_strategy_component(
    component_type: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    base_strategy: Optional[Dict[str, Any]] = None,
    context: Optional[Dict[str, Any]] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Generate a specific strategy component using AI."""
    try:
        user_id = current_user.get('id')
        logger.info(f"🚀 Generating strategy component '{component_type}' for user: {user_id}")
        
        # Validate component type
        valid_components = [
            "strategic_insights",
            "competitive_analysis", 
            "content_calendar",
            "performance_predictions",
            "implementation_roadmap",
            "risk_assessment"
        ]
        
        if component_type not in valid_components:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid component type. Must be one of: {valid_components}"
            )
        
        # Get context if not provided
        if not context:
            db_service = EnhancedStrategyDBService(db)
            enhanced_service = EnhancedStrategyService(db_service)
            onboarding_data = await enhanced_service._get_onboarding_data(user_id)
            context = {"onboarding_data": onboarding_data, "user_id": user_id}
        
        # Get base strategy if not provided
        if not base_strategy:
            # Generate base strategy using autofill
            from ....services.content_strategy.autofill.ai_structured_autofill import AIStructuredAutofillService
            autofill_service = AIStructuredAutofillService()
            autofill_result = await autofill_service.generate_autofill_fields(user_id, context)
            base_strategy = autofill_result.get("fields", {})
        
        # Initialize AI strategy generator
        strategy_generator = AIStrategyGenerator()
        
        # Generate specific component
        if component_type == "strategic_insights":
            component = await strategy_generator._generate_strategic_insights(base_strategy, context)
        elif component_type == "competitive_analysis":
            component = await strategy_generator._generate_competitive_analysis(base_strategy, context)
        elif component_type == "content_calendar":
            component = await strategy_generator._generate_content_calendar(base_strategy, context)
        elif component_type == "performance_predictions":
            component = await strategy_generator._generate_performance_predictions(base_strategy, context)
        elif component_type == "implementation_roadmap":
            component = await strategy_generator._generate_implementation_roadmap(base_strategy, context)
        elif component_type == "risk_assessment":
            component = await strategy_generator._generate_risk_assessment(base_strategy, context)
        
        logger.info(f"✅ Strategy component '{component_type}' generated successfully for user: {user_id}")
        
        return ResponseBuilder.create_success_response(
            message=f"Strategy component '{component_type}' generated successfully",
            data={
                "component_type": component_type,
                "component_data": component,
                "generated_at": datetime.utcnow().isoformat(),
                "user_id": user_id
            }
        )
        
    except RuntimeError as e:
        logger.error(f"❌ AI service error generating strategy component: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"AI service temporarily unavailable for {component_type}: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error generating strategy component: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "generate_strategy_component")

@router.get("/strategy-generation-status")
async def get_strategy_generation_status(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get the status of strategy generation for a user."""
    try:
        user_id = current_user.get('id')
        logger.info(f"Getting strategy generation status for user: {user_id}")
        
        # Get user's strategies
        db_service = EnhancedStrategyDBService(db)
        enhanced_service = EnhancedStrategyService(db_service)
        
        strategies_data = await enhanced_service.get_enhanced_strategies(user_id, None, db)
        
        # Analyze generation status
        strategies = strategies_data.get("strategies", [])
        
        status_data = {
            "user_id": user_id,
            "total_strategies": len(strategies),
            "ai_generated_strategies": len([s for s in strategies if s.get("ai_generated", False)]),
            "last_generation": None,
            "generation_stats": {
                "comprehensive_strategies": 0,
                "partial_strategies": 0,
                "manual_strategies": 0
            }
        }
        
        if strategies:
            # Find most recent AI-generated strategy
            ai_strategies = [s for s in strategies if s.get("ai_generated", False)]
            if ai_strategies:
                latest_ai = max(ai_strategies, key=lambda x: x.get("created_at", ""))
                status_data["last_generation"] = latest_ai.get("created_at")
            
            # Categorize strategies
            for strategy in strategies:
                if strategy.get("ai_generated", False):
                    if strategy.get("comprehensive", False):
                        status_data["generation_stats"]["comprehensive_strategies"] += 1
                    else:
                        status_data["generation_stats"]["partial_strategies"] += 1
                else:
                    status_data["generation_stats"]["manual_strategies"] += 1
        
        logger.info(f"✅ Strategy generation status retrieved for user: {user_id}")
        
        return ResponseBuilder.create_success_response(
            message="Strategy generation status retrieved successfully",
            data=status_data
        )
        
    except Exception as e:
        logger.error(f"❌ Error getting strategy generation status: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "get_strategy_generation_status")

@router.post("/optimize-existing-strategy")
async def optimize_existing_strategy(
    strategy_id: int,
    optimization_type: str = "comprehensive",
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Optimize an existing strategy using AI."""
    try:
        logger.info(f"🚀 Optimizing existing strategy {strategy_id} with type: {optimization_type}")
        
        # Get existing strategy
        db_service = EnhancedStrategyDBService(db)
        enhanced_service = EnhancedStrategyService(db_service)
        
        strategies_data = await enhanced_service.get_enhanced_strategies(strategy_id=strategy_id, db=db)
        
        if strategies_data.get("status") == "not_found" or not strategies_data.get("strategies"):
            raise HTTPException(
                status_code=404,
                detail=f"Strategy with ID {strategy_id} not found"
            )
        
        existing_strategy = strategies_data["strategies"][0]
        user_id = existing_strategy.get("user_id")
        
        # Get user context
        onboarding_data = await enhanced_service._get_onboarding_data(user_id)
        context = {"onboarding_data": onboarding_data, "user_id": user_id}
        
        # Initialize AI strategy generator
        strategy_generator = AIStrategyGenerator()
        
        # Generate optimization based on type
        if optimization_type == "comprehensive":
            # Generate comprehensive optimization
            optimized_strategy = await strategy_generator.generate_comprehensive_strategy(
                user_id=user_id,
                context=context,
                strategy_name=f"Optimized: {existing_strategy.get('name', 'Strategy')}"
            )
        else:
            # Generate specific component optimization
            component = await strategy_generator._generate_strategic_insights(existing_strategy, context)
            optimized_strategy = {
                "optimization_type": optimization_type,
                "original_strategy": existing_strategy,
                "optimization_data": component,
                "optimized_at": datetime.utcnow().isoformat()
            }
        
        logger.info(f"✅ Strategy {strategy_id} optimized successfully")
        
        return ResponseBuilder.create_success_response(
            message="Strategy optimized successfully",
            data=optimized_strategy
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error optimizing strategy: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "optimize_existing_strategy") 

@router.post("/generate-comprehensive-strategy-polling")
async def generate_comprehensive_strategy_polling(
    request: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Generate a comprehensive AI-powered content strategy using polling approach."""
    try:
        # Extract parameters from request body
        user_id = current_user.get('id')
        strategy_name = request.get("strategy_name")
        config = request.get("config", {})
        
        logger.info(f"🚀 Starting polling-based AI strategy generation for user: {user_id}")
        
        # Get user context and onboarding data
        db_service = EnhancedStrategyDBService(db)
        enhanced_service = EnhancedStrategyService(db_service)
        
        # Get onboarding data for context
        onboarding_data = await enhanced_service._get_onboarding_data(user_id)
                
        # Build context for AI generation
        context = {
                    "onboarding_data": onboarding_data,
                    "user_id": user_id,
                    "generation_config": config or {}
        }
                
        # Create strategy generation config
        generation_config = StrategyGenerationConfig(
            include_competitive_analysis=config.get("include_competitive_analysis", True) if config else True,
            include_content_calendar=config.get("include_content_calendar", True) if config else True,
            include_performance_predictions=config.get("include_performance_predictions", True) if config else True,
            include_implementation_roadmap=config.get("include_implementation_roadmap", True) if config else True,
            include_risk_assessment=config.get("include_risk_assessment", True) if config else True,
            max_content_pieces=config.get("max_content_pieces", 50) if config else 50,
            timeline_months=config.get("timeline_months", 12) if config else 12
        )
                
                # Initialize AI strategy generator
        strategy_generator = AIStrategyGenerator(generation_config)
        
        # Start generation in background (non-blocking)
        import asyncio
        import uuid
        
        # Generate unique task ID
        task_id = str(uuid.uuid4())
        
        # Store initial status
        generation_status = {
            "task_id": task_id,
            "user_id": user_id,
            "status": "started",
            "progress": 0,
            "step": 0,
            "message": "Initializing AI strategy generation...",
            "started_at": datetime.utcnow().isoformat(),
            "estimated_completion": None,
            "strategy": None,
            "error": None,
            "educational_content": EducationalContentManager.get_initialization_content()
        }
        
        # Store status in memory (in production, use Redis or database)
        if not hasattr(generate_comprehensive_strategy_polling, '_task_status'):
            generate_comprehensive_strategy_polling._task_status = {}
        
        generate_comprehensive_strategy_polling._task_status[task_id] = generation_status
        
        # Start background task
        async def generate_strategy_background():
            try:
                logger.info(f"🔄 Starting background strategy generation for task: {task_id}")
                
                # Step 1: Get user context
                generate_comprehensive_strategy_polling._task_status[task_id].update({
                    "step": 1,
                    "progress": 10,
                    "message": "Getting user context...",
                    "educational_content": EducationalContentManager.get_step_content(1)
                })
                
                # Step 2: Generate base strategy fields
                generate_comprehensive_strategy_polling._task_status[task_id].update({
                    "step": 2,
                    "progress": 20,
                    "message": "Generating base strategy fields...",
                    "educational_content": EducationalContentManager.get_step_content(2)
                })
                
                # Step 3: Generate strategic insights
                generate_comprehensive_strategy_polling._task_status[task_id].update({
                    "step": 3,
                    "progress": 30,
                    "message": "Generating strategic insights...",
                    "educational_content": EducationalContentManager.get_step_content(3)
                })
                
                strategic_insights = await strategy_generator._generate_strategic_insights({}, context)
                
                generate_comprehensive_strategy_polling._task_status[task_id].update({
                    "step": 3,
                    "progress": 35,
                    "message": "Strategic insights generated successfully",
                    "educational_content": EducationalContentManager.get_step_completion_content(3, strategic_insights)
                })
                
                # Step 4: Generate competitive analysis
                generate_comprehensive_strategy_polling._task_status[task_id].update({
                    "step": 4,
                    "progress": 40,
                    "message": "Generating competitive analysis...",
                    "educational_content": EducationalContentManager.get_step_content(4)
                })
                
                competitive_analysis = await strategy_generator._generate_competitive_analysis({}, context)
                
                generate_comprehensive_strategy_polling._task_status[task_id].update({
                    "step": 4,
                    "progress": 45,
                    "message": "Competitive analysis generated successfully",
                    "educational_content": EducationalContentManager.get_step_completion_content(4, competitive_analysis)
                })
                
                # Step 5: Generate performance predictions
                generate_comprehensive_strategy_polling._task_status[task_id].update({
                    "step": 5,
                    "progress": 50,
                    "message": "Generating performance predictions...",
                    "educational_content": EducationalContentManager.get_step_content(5)
                })
                
                performance_predictions = await strategy_generator._generate_performance_predictions({}, context)
                
                generate_comprehensive_strategy_polling._task_status[task_id].update({
                    "step": 5,
                    "progress": 55,
                    "message": "Performance predictions generated successfully",
                    "educational_content": EducationalContentManager.get_step_completion_content(5, performance_predictions)
                })
                
                # Step 6: Generate implementation roadmap
                generate_comprehensive_strategy_polling._task_status[task_id].update({
                    "step": 6,
                    "progress": 60,
                    "message": "Generating implementation roadmap...",
                    "educational_content": EducationalContentManager.get_step_content(6)
                })
                
                implementation_roadmap = await strategy_generator._generate_implementation_roadmap({}, context)
                
                generate_comprehensive_strategy_polling._task_status[task_id].update({
                    "step": 6,
                    "progress": 65,
                    "message": "Implementation roadmap generated successfully",
                    "educational_content": EducationalContentManager.get_step_completion_content(6, implementation_roadmap)
                })
                
                # Step 7: Generate risk assessment
                generate_comprehensive_strategy_polling._task_status[task_id].update({
                    "step": 7,
                    "progress": 70,
                    "message": "Generating risk assessment...",
                    "educational_content": EducationalContentManager.get_step_content(7)
                })
                
                risk_assessment = await strategy_generator._generate_risk_assessment({}, context)
                
                generate_comprehensive_strategy_polling._task_status[task_id].update({
                    "step": 7,
                    "progress": 75,
                    "message": "Risk assessment generated successfully",
                    "educational_content": EducationalContentManager.get_step_completion_content(7, risk_assessment)
                })
                
                # Step 8: Compile comprehensive strategy
                generate_comprehensive_strategy_polling._task_status[task_id].update({
                    "step": 8,
                    "progress": 80,
                    "message": "Compiling comprehensive strategy...",
                    "educational_content": EducationalContentManager.get_step_content(8)
                })
                
                # Compile the comprehensive strategy (NO CONTENT CALENDAR)
                comprehensive_strategy = {
                    "strategic_insights": strategic_insights,
                    "competitive_analysis": competitive_analysis,
                    "performance_predictions": performance_predictions,
                    "implementation_roadmap": implementation_roadmap,
                    "risk_assessment": risk_assessment,
                    "metadata": {
                        "ai_generated": True,
                        "comprehensive": True,
                        "generation_timestamp": datetime.utcnow().isoformat(),
                        "user_id": user_id,
                        "strategy_name": strategy_name or "Enhanced Content Strategy",
                        "content_calendar_ready": False  # Indicates calendar needs to be generated separately
                    }
                }
                
                # Step 8: Complete
                completion_content = EducationalContentManager.get_step_content(8)
                completion_content = EducationalContentManager.update_completion_summary(
                    completion_content, 
                    {
                        "performance_predictions": performance_predictions,
                        "implementation_roadmap": implementation_roadmap,
                        "risk_assessment": risk_assessment
                    }
                )
                
                # Save the comprehensive strategy to database
                try:
                    from models.enhanced_strategy_models import EnhancedContentStrategy
                    
                    # Create enhanced strategy record
                    enhanced_strategy = EnhancedContentStrategy(
                        user_id=user_id,
                        name=strategy_name or "Enhanced Content Strategy",
                        industry="technology",  # Default, can be updated later
                        
                        # Store the comprehensive AI analysis in the dedicated field
                        comprehensive_ai_analysis=comprehensive_strategy,
                        
                        # Store metadata
                        ai_recommendations=comprehensive_strategy,
                        
                        # Mark as AI-generated and comprehensive
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    )
                    
                    # Add to database
                    db.add(enhanced_strategy)
                    db.commit()
                    db.refresh(enhanced_strategy)
                    
                    logger.info(f"💾 Strategy saved to database with ID: {enhanced_strategy.id}")
                    
                    # Update the comprehensive strategy with the database ID
                    comprehensive_strategy["metadata"]["strategy_id"] = enhanced_strategy.id
                    
                except Exception as db_error:
                    logger.error(f"❌ Error saving strategy to database: {str(db_error)}")
                    # Continue without database save, strategy is still available in memory
                
                # Final completion update
                final_status = {
                    "step": 8,
                    "progress": 100,
                    "status": "completed",
                    "message": "Strategy generation completed successfully!",
                    "strategy": comprehensive_strategy,
                    "completed_at": datetime.utcnow().isoformat(),
                    "educational_content": completion_content
                }
                
                generate_comprehensive_strategy_polling._task_status[task_id].update(final_status)
                
                logger.info(f"🎯 Final status update for task {task_id}: {final_status}")
                logger.info(f"🎯 Task status after update: {generate_comprehensive_strategy_polling._task_status[task_id]}")
                
                # Store in global latest strategies for persistent access
                _latest_strategies[user_id] = {
                    "strategy": comprehensive_strategy,
                    "completed_at": datetime.utcnow().isoformat(),
                    "task_id": task_id
                }
                
                logger.info(f"✅ Background strategy generation completed for task: {task_id}")
                logger.info(f"💾 Strategy stored in global storage for user: {user_id}")
                
            except Exception as e:
                logger.error(f"❌ Error in background strategy generation for task {task_id}: {str(e)}")
                generate_comprehensive_strategy_polling._task_status[task_id].update({
                    "status": "failed",
                    "error": str(e),
                    "message": f"Strategy generation failed: {str(e)}",
                    "failed_at": datetime.utcnow().isoformat()
                })
        
        # Start the background task
        asyncio.create_task(generate_strategy_background())
        
        logger.info(f"✅ Polling-based AI strategy generation started for user: {user_id}, task: {task_id}")
        
        return ResponseBuilder.create_success_response(
            message="AI strategy generation started successfully",
            data={
                "task_id": task_id,
                "status": "started",
                "message": "Strategy generation is running in the background. Use the task_id to check progress.",
                "polling_endpoint": f"/api/content-planning/content-strategy/ai-generation/strategy-generation-status/{task_id}",
                "estimated_completion": "2-3 minutes"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Error starting polling-based strategy generation: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "generate_comprehensive_strategy_polling")

@router.get("/strategy-generation-status/{task_id}")
async def get_strategy_generation_status_by_task(
    task_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get the status of strategy generation for a specific task."""
    try:
        logger.info(f"Getting strategy generation status for task: {task_id}")
        
        # Check if task status exists
        if not hasattr(generate_comprehensive_strategy_polling, '_task_status'):
            raise HTTPException(
                status_code=404,
                detail="No task status found. Task may have expired or never existed."
            )
        
        task_status = generate_comprehensive_strategy_polling._task_status.get(task_id)
        
        if not task_status:
            raise HTTPException(
                status_code=404,
                detail=f"Task {task_id} not found. It may have expired or never existed."
            )
        
        logger.info(f"✅ Strategy generation status retrieved for task: {task_id}")
        
        return ResponseBuilder.create_success_response(
            message="Strategy generation status retrieved successfully",
            data=task_status
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting strategy generation status: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "get_strategy_generation_status_by_task")

@router.get("/latest-strategy")
async def get_latest_generated_strategy(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get the latest generated strategy from the polling system or database."""
    try:
        user_id = current_user.get('id')
        logger.info(f"🔍 Getting latest generated strategy for user: {user_id}")
        
        # First, try to get from database (most reliable)
        try:
            from models.enhanced_strategy_models import EnhancedContentStrategy
            from sqlalchemy import desc
            
            logger.info(f"🔍 Querying database for strategies with user_id: {user_id}")
            
            # Query for the most recent strategy with comprehensive AI analysis
            # First, let's see all strategies for this user
            all_strategies = db.query(EnhancedContentStrategy).filter(
                EnhancedContentStrategy.user_id == user_id
            ).order_by(desc(EnhancedContentStrategy.created_at)).all()
            
            logger.info(f"🔍 Found {len(all_strategies)} total strategies for user {user_id}")
            for i, strategy in enumerate(all_strategies):
                logger.info(f"   Strategy {i+1}: ID={strategy.id}, name={strategy.name}, created_at={strategy.created_at}, has_comprehensive_ai_analysis={strategy.comprehensive_ai_analysis is not None}")
            
            # Now query for the most recent strategy with comprehensive AI analysis
            latest_db_strategy = db.query(EnhancedContentStrategy).filter(
                EnhancedContentStrategy.user_id == user_id,
                EnhancedContentStrategy.comprehensive_ai_analysis.isnot(None)
            ).order_by(desc(EnhancedContentStrategy.created_at)).first()
            
            logger.info(f"🔍 Database query result: {latest_db_strategy}")
            
            if latest_db_strategy and latest_db_strategy.comprehensive_ai_analysis:
                logger.info(f"✅ Found latest strategy in database: {latest_db_strategy.id}")
                logger.info(f"🔍 Strategy comprehensive_ai_analysis keys: {list(latest_db_strategy.comprehensive_ai_analysis.keys()) if isinstance(latest_db_strategy.comprehensive_ai_analysis, dict) else 'Not a dict'}")
                return ResponseBuilder.create_success_response(
                    message="Latest generated strategy retrieved successfully from database",
                    data={
                        "user_id": user_id,
                        "strategy": latest_db_strategy.comprehensive_ai_analysis,
                        "completed_at": latest_db_strategy.created_at.isoformat(),
                        "strategy_id": latest_db_strategy.id
                    }
                )
            else:
                logger.info(f"⚠️ No strategy with comprehensive_ai_analysis found in database for user: {user_id}")
                
                # Fallback: Try to get the most recent strategy regardless of comprehensive_ai_analysis
                fallback_strategy = db.query(EnhancedContentStrategy).filter(
                    EnhancedContentStrategy.user_id == user_id
                ).order_by(desc(EnhancedContentStrategy.created_at)).first()
                
                if fallback_strategy:
                    logger.info(f"🔍 Found fallback strategy: ID={fallback_strategy.id}, name={fallback_strategy.name}")
                    logger.info(f"🔍 Fallback strategy has ai_recommendations: {fallback_strategy.ai_recommendations is not None}")
                    
                    # Try to use ai_recommendations as the strategy data
                    if fallback_strategy.ai_recommendations:
                        logger.info(f"✅ Using ai_recommendations as strategy data for fallback strategy {fallback_strategy.id}")
                        return ResponseBuilder.create_success_response(
                            message="Latest generated strategy retrieved successfully from database (fallback)",
                            data={
                                "user_id": user_id,
                                "strategy": fallback_strategy.ai_recommendations,
                                "completed_at": fallback_strategy.created_at.isoformat(),
                                "strategy_id": fallback_strategy.id
                            }
                        )
                    else:
                        logger.info(f"⚠️ Fallback strategy has no ai_recommendations either")
                else:
                    logger.info(f"🔍 No strategy record found at all for user: {user_id}")
        except Exception as db_error:
            logger.warning(f"⚠️ Database query failed: {str(db_error)}")
            logger.error(f"❌ Database error details: {type(db_error).__name__}: {str(db_error)}")
        
        # Fallback: Check in-memory task status
        if not hasattr(generate_comprehensive_strategy_polling, '_task_status'):
            logger.warning("⚠️ No task status storage found")
            return ResponseBuilder.create_success_response(
                data={"user_id": user_id, "strategy": None},
                message="No strategy generation tasks found",
                status_code=200
            )
        
        # Debug: Log all task statuses
        logger.info(f"📊 Total tasks in storage: {len(generate_comprehensive_strategy_polling._task_status)}")
        for task_id, task_status in generate_comprehensive_strategy_polling._task_status.items():
            logger.info(f"   Task {task_id}: user_id={task_status.get('user_id')}, status={task_status.get('status')}, has_strategy={bool(task_status.get('strategy'))}")
        
        # Find the most recent completed strategy for this user
        latest_strategy = None
        latest_completion_time = None
        
        for task_id, task_status in generate_comprehensive_strategy_polling._task_status.items():
            logger.info(f"🔍 Checking task {task_id}: user_id={task_status.get('user_id')} vs requested {user_id}")
            
            if (task_status.get("user_id") == user_id and 
                task_status.get("status") == "completed" and 
                task_status.get("strategy")):
                
                completion_time = task_status.get("completed_at")
                logger.info(f"✅ Found completed strategy for user {user_id} at {completion_time}")
                logger.info(f"🔍 Strategy keys: {list(task_status.get('strategy', {}).keys())}")
                
                if completion_time and (latest_completion_time is None or completion_time > latest_completion_time):
                    latest_strategy = task_status.get("strategy")
                    latest_completion_time = completion_time
                    logger.info(f"🔄 Updated latest strategy with completion time: {completion_time}")
        
        if latest_strategy:
            logger.info(f"✅ Found latest generated strategy for user: {user_id}")
            return ResponseBuilder.create_success_response(
                message="Latest generated strategy retrieved successfully from memory",
                data={
                    "user_id": user_id,
                    "strategy": latest_strategy,
                    "completed_at": latest_completion_time
                }
            )
        else:
            logger.info(f"⚠️ No completed strategies found for user: {user_id}")
            return ResponseBuilder.create_success_response(
                data={"user_id": user_id, "strategy": None},
                message="No completed strategy generation found",
                status_code=200
            )
        
    except Exception as e:
        logger.error(f"❌ Error getting latest generated strategy: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "get_latest_generated_strategy")
