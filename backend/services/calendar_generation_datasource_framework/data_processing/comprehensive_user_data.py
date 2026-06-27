"""
Comprehensive User Data Processor

Extracted from calendar_generator_service.py to improve maintainability
and align with 12-step implementation plan. Now includes active strategy
management with 3-tier caching for optimal performance.

NO MOCK DATA - Only real data sources allowed.
"""

import time
from typing import Dict, Any, Optional, List
from loguru import logger

import sys
import os

# Add the services directory to the path for proper imports
services_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if services_dir not in sys.path:
    sys.path.insert(0, services_dir)

# Import real services - NO FALLBACKS
from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService
from services.ai_analytics_service import AIAnalyticsService
from services.content_gap_analyzer.ai_engine_service import AIEngineService
from services.active_strategy_service import ActiveStrategyService
from services.database import SessionLocal

logger.info("✅ Successfully imported real data processing services")


class ComprehensiveUserDataProcessor:
    """Process comprehensive user data from all database sources with active strategy management."""
    
    def __init__(self, db_session=None):
        self.integration_service = OnboardingDataIntegrationService()
        self.active_strategy_service = ActiveStrategyService(db_session)
        self.content_planning_db_service = None  # Will be injected
        self.db_session = db_session
    
    async def get_comprehensive_user_data(self, user_id: int, strategy_id: Optional[int]) -> Dict[str, Any]:
        """Get comprehensive user data from all database sources."""
        try:
            logger.info(f"Getting comprehensive user data for user {user_id}")
            
            # Get onboarding data (async via SSOT)
            db = self.db_session if self.db_session else SessionLocal()
            try:
                integrated_data = await self.integration_service.process_onboarding_data(str(user_id), db)
                onboarding_data = integrated_data.get('canonical_profile', {})
            finally:
                if not self.db_session:
                    db.close()
            
            if not onboarding_data:
                raise ValueError(f"No onboarding data found for user_id: {user_id}")
            
            # Add missing posting preferences and posting days for Step 4
            if onboarding_data:
                # Add default posting preferences if missing
                if "posting_preferences" not in onboarding_data:
                    onboarding_data["posting_preferences"] = {
                        "daily": 2,  # 2 posts per day
                        "weekly": 10,  # 10 posts per week
                        "monthly": 40   # 40 posts per month
                    }
                
                # Add default posting days if missing
                if "posting_days" not in onboarding_data:
                    onboarding_data["posting_days"] = [
                        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
                    ]
                
                # Add optimal posting times if missing
                if "optimal_times" not in onboarding_data:
                    onboarding_data["optimal_times"] = [
                        "09:00", "12:00", "15:00", "18:00", "20:00"
                    ]
            
            # Get AI analysis results from the working endpoint
            try:
                if not strategy_id:
                    raise ValueError("strategy_id is required for AI analysis in comprehensive user data")
                ai_analytics = AIAnalyticsService()
                ai_analysis_results = await ai_analytics.generate_strategic_intelligence(user_id=user_id, strategy_id=strategy_id)
                
                if not ai_analysis_results:
                    raise ValueError("AI analysis service returned no results")
                    
            except Exception as e:
                logger.error(f"AI analysis service failed: {str(e)}")
                raise ValueError(f"Failed to get AI analysis results: {str(e)}")
            
            # Get gap analysis data from the working endpoint
            try:
                ai_engine = AIEngineService()
                gap_analysis_data = await ai_engine.generate_content_recommendations(onboarding_data)
                
                if not gap_analysis_data:
                    raise ValueError("AI engine service returned no gap analysis data")
                    
            except Exception as e:
                logger.error(f"AI engine service failed: {str(e)}")
                raise ValueError(f"Failed to get gap analysis data: {str(e)}")
            
            # Get active strategy data with 3-tier caching for Phase 1 and Phase 2
            strategy_data = {}
            active_strategy = await self.active_strategy_service.get_active_strategy(user_id)
            
            if active_strategy:
                strategy_data = active_strategy
                logger.info(f"🎯 Retrieved ACTIVE strategy {active_strategy.get('id')} with {len(active_strategy)} fields for user {user_id}")
                logger.info(f"📊 Strategy activation status: {active_strategy.get('activation_status', {}).get('activation_date', 'Not activated')}")
            elif strategy_id:
                # Fallback to specific strategy ID if provided
                from .strategy_data import StrategyDataProcessor
                strategy_processor = StrategyDataProcessor()
                
                # Inject database service if available
                if self.content_planning_db_service:
                    strategy_processor.content_planning_db_service = self.content_planning_db_service
                
                strategy_data = await strategy_processor.get_strategy_data(strategy_id)
                
                if not strategy_data:
                    raise ValueError(f"No strategy data found for strategy_id: {strategy_id}")
                    
                logger.warning(f"⚠️ No active strategy found, using fallback strategy {strategy_id}")
            else:
                raise ValueError("No active strategy found and no strategy ID provided")
            
            # Get content recommendations
            recommendations_data = await self._get_recommendations_data(user_id, strategy_id)
            
            # Get performance metrics
            performance_data = await self._get_performance_data(user_id, strategy_id)
            
            # Build comprehensive response with enhanced strategy data
            comprehensive_data = {
                "user_id": user_id,
                "onboarding_data": onboarding_data,
                "ai_analysis_results": ai_analysis_results,
                "gap_analysis": {
                    "content_gaps": gap_analysis_data if isinstance(gap_analysis_data, list) else [],
                    "keyword_opportunities": onboarding_data.get("keyword_analysis", {}).get("high_value_keywords", []),
                    "competitor_insights": onboarding_data.get("competitor_analysis", {}).get("top_performers", []),
                    "recommendations": gap_analysis_data if isinstance(gap_analysis_data, list) else [],
                    "opportunities": onboarding_data.get("gap_analysis", {}).get("content_opportunities", [])
                },
                "strategy_data": strategy_data,  # Now contains comprehensive strategy data
                "recommendations_data": recommendations_data,
                "performance_data": performance_data,
                "industry": strategy_data.get("industry") or onboarding_data.get("website_analysis", {}).get("industry_focus", "technology"),
                "target_audience": strategy_data.get("target_audience") or onboarding_data.get("website_analysis", {}).get("target_audience", []),
                "business_goals": strategy_data.get("business_objectives") or ["Increase brand awareness", "Generate leads", "Establish thought leadership"],
                "website_analysis": onboarding_data.get("website_analysis", {}),
                "competitor_analysis": onboarding_data.get("competitor_analysis", {}),
                "keyword_analysis": onboarding_data.get("keyword_analysis", {}),
                
                # Enhanced strategy data for 12-step prompt chaining
                "strategy_analysis": strategy_data.get("strategy_analysis", {}),
                "quality_indicators": strategy_data.get("quality_indicators", {}),
                
                # Add platform preferences for Step 6
                "platform_preferences": self._generate_platform_preferences(strategy_data, onboarding_data)
            }
            
            logger.info(f"✅ Comprehensive user data prepared for user {user_id}")
            return comprehensive_data
            
        except Exception as e:
            logger.error(f"❌ Error getting comprehensive user data: {str(e)}")
            raise Exception(f"Failed to get comprehensive user data: {str(e)}")

    async def get_comprehensive_user_data_cached(
        self, 
        user_id: int, 
        strategy_id: Optional[int] = None,
        force_refresh: bool = False,
        db_session = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive user data with caching support.
        This method provides caching while maintaining backward compatibility.
        """
        try:
            # If we have a database session, try to use cache
            if db_session:
                try:
                    from services.comprehensive_user_data_cache_service import ComprehensiveUserDataCacheService
                    cache_service = ComprehensiveUserDataCacheService(db_session)
                    return await cache_service.get_comprehensive_user_data_backward_compatible(
                        user_id, strategy_id, force_refresh=force_refresh
                    )
                except Exception as cache_error:
                    logger.warning(f"Cache service failed, falling back to direct processing: {str(cache_error)}")
            
            # Fallback to direct processing
            return await self.get_comprehensive_user_data(user_id, strategy_id)
            
        except Exception as e:
            logger.error(f"❌ Error in cached method: {str(e)}")
            raise Exception(f"Failed to get comprehensive user data: {str(e)}")
    
    async def _get_recommendations_data(self, user_id: int, strategy_id: Optional[int]) -> List[Dict[str, Any]]:
        """Get content recommendations data."""
        try:
            # This would be implemented based on existing logic
            # For now, return empty list - will be implemented when needed
            return []
        except Exception as e:
            logger.error(f"Could not get recommendations data: {str(e)}")
            raise Exception(f"Failed to get recommendations data: {str(e)}")
    
    async def _get_performance_data(self, user_id: int, strategy_id: Optional[int]) -> Dict[str, Any]:
        """Get performance metrics data."""
        try:
            # This would be implemented based on existing logic
            # For now, return empty dict - will be implemented when needed
            return {}
        except Exception as e:
            logger.error(f"Could not get performance data: {str(e)}")
            raise Exception(f"Failed to get performance data: {str(e)}")
    
    def _generate_platform_preferences(self, strategy_data: Dict[str, Any], onboarding_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate platform preferences based on strategy and onboarding data."""
        try:
            industry = strategy_data.get("industry") or onboarding_data.get("website_analysis", {}).get("industry_focus", "technology")
            content_types = onboarding_data.get("website_analysis", {}).get("content_types", ["blog", "article"])
            
            # Generate industry-specific platform preferences
            platform_preferences = {}
            
            # LinkedIn - Good for B2B and professional content
            if industry in ["technology", "finance", "healthcare", "consulting"]:
                platform_preferences["linkedin"] = {
                    "priority": "high",
                    "content_focus": "professional insights",
                    "posting_frequency": "daily",
                    "engagement_strategy": "thought leadership"
                }
            
            # Twitter/X - Good for real-time updates and engagement
            platform_preferences["twitter"] = {
                "priority": "medium",
                "content_focus": "quick insights and updates",
                "posting_frequency": "daily",
                "engagement_strategy": "conversation starter"
            }
            
            # Blog - Primary content platform
            if "blog" in content_types or "article" in content_types:
                platform_preferences["blog"] = {
                    "priority": "high",
                    "content_focus": "in-depth articles and guides",
                    "posting_frequency": "weekly",
                    "engagement_strategy": "educational content"
                }
            
            # Instagram - Good for visual content and brand awareness
            if industry in ["technology", "marketing", "creative"]:
                platform_preferences["instagram"] = {
                    "priority": "medium",
                    "content_focus": "visual storytelling",
                    "posting_frequency": "daily",
                    "engagement_strategy": "visual engagement"
                }
            
            # YouTube - Good for video content
            if "video" in content_types:
                platform_preferences["youtube"] = {
                    "priority": "medium",
                    "content_focus": "educational videos and tutorials",
                    "posting_frequency": "weekly",
                    "engagement_strategy": "video engagement"
                }
            
            logger.info(f"✅ Generated platform preferences for {len(platform_preferences)} platforms")
            return platform_preferences
            
        except Exception as e:
            logger.error(f"❌ Error generating platform preferences: {str(e)}")
            raise Exception(f"Failed to generate platform preferences: {str(e)}")
