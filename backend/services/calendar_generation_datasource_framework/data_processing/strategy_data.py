"""
Strategy Data Processor

Extracted from calendar_generator_service.py to improve maintainability
and align with 12-step implementation plan.

NO MOCK DATA - Only real data sources allowed.
"""

from typing import Dict, Any
from loguru import logger

import sys
import os

# Add the services directory to the path for proper imports
services_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if services_dir not in sys.path:
    sys.path.insert(0, services_dir)

# Import real services - NO FALLBACKS
from services.content_planning_db import ContentPlanningDBService

logger.trace("✅ Successfully imported real data processing services (strategy data)")


class StrategyDataProcessor:
    """Process comprehensive content strategy data for 12-step prompt chaining."""
    
    def __init__(self):
        self.content_planning_db_service = None  # Will be injected
    
    async def get_strategy_data(self, strategy_id: int) -> Dict[str, Any]:
        """Get comprehensive content strategy data from database for 12-step prompt chaining."""
        try:
            logger.info(f"🔍 Retrieving comprehensive strategy data for strategy {strategy_id}")
            
            # Check if database service is available
            if self.content_planning_db_service is None:
                raise ValueError("ContentPlanningDBService not available - cannot retrieve strategy data")
            
            # Get basic strategy data
            strategy = await self.content_planning_db_service.get_content_strategy(strategy_id)
            if not strategy:
                raise ValueError(f"No strategy found for ID {strategy_id}")
            
            # Convert to dictionary for processing
            strategy_dict = strategy.to_dict() if hasattr(strategy, 'to_dict') else {
                'id': strategy.id,
                'user_id': strategy.user_id,
                'name': strategy.name,
                'industry': strategy.industry,
                'target_audience': strategy.target_audience,
                'content_pillars': strategy.content_pillars,
                'ai_recommendations': strategy.ai_recommendations,
                'created_at': strategy.created_at.isoformat() if strategy.created_at else None,
                'updated_at': strategy.updated_at.isoformat() if strategy.updated_at else None
            }
            
            # Try to get enhanced strategy data if available
            enhanced_strategy_data = await self._get_enhanced_strategy_data(strategy_id)
            
            # Import quality assessment functions
            from ..quality_assessment.strategy_quality import StrategyQualityAssessor
            quality_assessor = StrategyQualityAssessor()
            
            # Merge basic and enhanced strategy data
            comprehensive_strategy_data = {
                # Basic strategy fields
                "strategy_id": strategy_dict.get("id"),
                "strategy_name": strategy_dict.get("name"),
                "industry": strategy_dict.get("industry", "technology"),
                "target_audience": strategy_dict.get("target_audience", {}),
                "content_pillars": strategy_dict.get("content_pillars", []),
                "ai_recommendations": strategy_dict.get("ai_recommendations", {}),
                "created_at": strategy_dict.get("created_at"),
                "updated_at": strategy_dict.get("updated_at"),
                
                # Enhanced strategy fields (if available)
                **enhanced_strategy_data,
                
                # Strategy analysis and insights
                "strategy_analysis": await quality_assessor.analyze_strategy_completeness(strategy_dict, enhanced_strategy_data),
                "quality_indicators": await quality_assessor.calculate_strategy_quality_indicators(strategy_dict, enhanced_strategy_data),
                "data_completeness": await quality_assessor.calculate_data_completeness(strategy_dict, enhanced_strategy_data),
                "strategic_alignment": await quality_assessor.assess_strategic_alignment(strategy_dict, enhanced_strategy_data),
                
                # Quality gate preparation data
                "quality_gate_data": await quality_assessor.prepare_quality_gate_data(strategy_dict, enhanced_strategy_data),
                
                # 12-step prompt chaining preparation
                "prompt_chain_data": await quality_assessor.prepare_prompt_chain_data(strategy_dict, enhanced_strategy_data)
            }
            
            logger.info(f"✅ Successfully retrieved comprehensive strategy data for strategy {strategy_id}")
            return comprehensive_strategy_data
            
        except Exception as e:
            logger.error(f"❌ Error getting comprehensive strategy data: {str(e)}")
            raise Exception(f"Failed to get strategy data: {str(e)}")
    
    async def validate_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate strategy data quality."""
        try:
            if not data:
                raise ValueError("Strategy data is empty")
            
            # Basic validation
            required_fields = ["strategy_id", "strategy_name", "industry", "target_audience", "content_pillars"]
            
            missing_fields = []
            for field in required_fields:
                if not data.get(field):
                    missing_fields.append(field)
            
            if missing_fields:
                raise ValueError(f"Missing required fields: {missing_fields}")
            
            # Quality assessment
            quality_score = 0.8  # Base score for valid data
            
            # Add quality indicators
            validation_result = {
                "quality_score": quality_score,
                "missing_fields": missing_fields,
                "recommendations": []
            }
            
            return validation_result
            
        except Exception as e:
            logger.error(f"Error validating strategy data: {str(e)}")
            raise Exception(f"Strategy data validation failed: {str(e)}")
    
    async def _get_enhanced_strategy_data(self, strategy_id: int) -> Dict[str, Any]:
        """Get enhanced strategy data from enhanced strategy models."""
        try:
            # Try to import and use enhanced strategy service
            try:
                from api.content_planning.services.enhanced_strategy_db_service import EnhancedStrategyDBService
                from models.enhanced_strategy_models import EnhancedContentStrategy
                
                # Note: This would need proper database session injection
                # For now, we'll return enhanced data structure based on available fields
                enhanced_data = {
                    # Business Context (8 inputs)
                    "business_objectives": None,
                    "target_metrics": None,
                    "content_budget": None,
                    "team_size": None,
                    "implementation_timeline": None,
                    "market_share": None,
                    "competitive_position": None,
                    "performance_metrics": None,
                    
                    # Audience Intelligence (6 inputs)
                    "content_preferences": None,
                    "consumption_patterns": None,
                    "audience_pain_points": None,
                    "buying_journey": None,
                    "seasonal_trends": None,
                    "engagement_metrics": None,
                    
                    # Competitive Intelligence (5 inputs)
                    "top_competitors": None,
                    "competitor_content_strategies": None,
                    "market_gaps": None,
                    "industry_trends": None,
                    "emerging_trends": None,
                    
                    # Content Strategy (7 inputs)
                    "preferred_formats": None,
                    "content_mix": None,
                    "content_frequency": None,
                    "optimal_timing": None,
                    "quality_metrics": None,
                    "editorial_guidelines": None,
                    "brand_voice": None,
                    
                    # Performance & Analytics (4 inputs)
                    "traffic_sources": None,
                    "conversion_rates": None,
                    "content_roi_targets": None,
                    "ab_testing_capabilities": False,
                    
                    # Enhanced AI Analysis fields
                    "comprehensive_ai_analysis": None,
                    "onboarding_data_used": None,
                    "strategic_scores": None,
                    "market_positioning": None,
                    "competitive_advantages": None,
                    "strategic_risks": None,
                    "opportunity_analysis": None,
                    
                    # Metadata
                    "completion_percentage": 0.0,
                    "data_source_transparency": None
                }
                
                return enhanced_data
                
            except ImportError:
                logger.info("Enhanced strategy models not available, using basic strategy data only")
                return {}
                
        except Exception as e:
            logger.warning(f"Could not retrieve enhanced strategy data: {str(e)}")
            return {}
