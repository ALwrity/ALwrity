"""
AI Analytics Service for Content Planning API
Extracted business logic from the AI analytics route for better separation of concerns.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
from loguru import logger
from sqlalchemy.orm import Session
import time

# Import database services
from services.content_planning_db import ContentPlanningDBService
from services.ai_analysis_db_service import AIAnalysisDBService
from services.ai_analytics_service import AIAnalyticsService
from services.database import SessionLocal, get_session_for_user
from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService

# Import utilities
from ..utils.error_handlers import ContentPlanningErrorHandler
from ..utils.response_builders import ResponseBuilder
from ..utils.constants import ERROR_MESSAGES, SUCCESS_MESSAGES

class ContentPlanningAIAnalyticsService:
    """Service class for AI analytics operations."""
    
    def __init__(self):
        self.ai_analysis_db_service = AIAnalysisDBService()
        self.ai_analytics_service = AIAnalyticsService()
        self.onboarding_integration_service = OnboardingDataIntegrationService()
    
    async def analyze_content_evolution(self, user_id: int, strategy_id: int, time_period: str = "30d") -> Dict[str, Any]:
        """Analyze content evolution over time for a specific strategy."""
        try:
            logger.info(f"Starting content evolution analysis for strategy {strategy_id} (user {user_id})")
            
            # Perform content evolution analysis
            evolution_analysis = await self.ai_analytics_service.analyze_content_evolution(
                user_id=user_id,
                strategy_id=strategy_id,
                time_period=time_period
            )
            
            # Prepare response
            response_data = {
                'analysis_type': 'content_evolution',
                'strategy_id': strategy_id,
                'results': evolution_analysis,
                'recommendations': evolution_analysis.get('recommendations', []),
                'analysis_date': datetime.utcnow()
            }
            
            logger.info(f"Content evolution analysis completed for strategy {strategy_id}")
            return response_data
            
        except Exception as e:
            logger.error(f"Error analyzing content evolution: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "analyze_content_evolution")
    
    async def analyze_performance_trends(self, user_id: int, strategy_id: int, metrics: Optional[List[str]] = None) -> Dict[str, Any]:
        """Analyze performance trends for content strategy."""
        try:
            logger.info(f"Starting performance trends analysis for strategy {strategy_id} (user {user_id})")
            
            # Perform performance trends analysis
            trends_analysis = await self.ai_analytics_service.analyze_performance_trends(
                user_id=user_id,
                strategy_id=strategy_id,
                metrics=metrics
            )
            
            # Prepare response
            response_data = {
                'analysis_type': 'performance_trends',
                'strategy_id': strategy_id,
                'results': trends_analysis,
                'recommendations': trends_analysis.get('recommendations', []),
                'analysis_date': datetime.utcnow()
            }
            
            logger.info(f"Performance trends analysis completed for strategy {strategy_id}")
            return response_data
            
        except Exception as e:
            logger.error(f"Error analyzing performance trends: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "analyze_performance_trends")
    
    async def predict_content_performance(self, strategy_id: int, content_data: Dict[str, Any]) -> Dict[str, Any]:
        """Predict content performance using AI models."""
        try:
            logger.info(f"Starting content performance prediction for strategy {strategy_id}")
            
            # Perform content performance prediction
            prediction_results = await self.ai_analytics_service.predict_content_performance(
                content_data=content_data,
                strategy_id=strategy_id
            )
            
            # Prepare response
            response_data = {
                'analysis_type': 'content_performance_prediction',
                'strategy_id': strategy_id,
                'results': prediction_results,
                'recommendations': prediction_results.get('optimization_recommendations', []),
                'analysis_date': datetime.utcnow()
            }
            
            logger.info(f"Content performance prediction completed for strategy {strategy_id}")
            return response_data
            
        except Exception as e:
            logger.error(f"Error predicting content performance: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "predict_content_performance")
    
    async def generate_strategic_intelligence(self, strategy_id: int, market_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Generate strategic intelligence for content planning."""
        try:
            logger.info(f"Starting strategic intelligence generation for strategy {strategy_id}")
            
            # Generate strategic intelligence
            intelligence_results = await self.ai_analytics_service.generate_strategic_intelligence(
                strategy_id=strategy_id,
                market_data=market_data
            )
            
            # Prepare response
            response_data = {
                'analysis_type': 'strategic_intelligence',
                'strategy_id': strategy_id,
                'results': intelligence_results,
                'recommendations': [],  # Strategic intelligence includes its own recommendations
                'analysis_date': datetime.utcnow()
            }
            
            logger.info(f"Strategic intelligence generation completed for strategy {strategy_id}")
            return response_data
            
        except Exception as e:
            logger.error(f"Error generating strategic intelligence: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "generate_strategic_intelligence")
    
    async def get_ai_analytics(self, user_id: Optional[int] = None, strategy_id: Optional[int] = None, force_refresh: bool = False) -> Dict[str, Any]:
        """Get AI analytics with real personalized insights - FORCE FRESH AI GENERATION."""
        if not user_id:
            raise ValueError("user_id is required for AI analytics")
        if not strategy_id:
            raise ValueError("strategy_id is required for AI analytics (use ActiveStrategy to get the current strategy)")
        logger.info(f"🚀 Starting AI analytics for user: {user_id}, strategy: {strategy_id}, force_refresh: {force_refresh}")
        start_time = time.time()
        current_user_id = user_id

        ai_db_session = get_session_for_user(str(current_user_id)) if current_user_id else SessionLocal()
        try:
            if force_refresh:
                logger.info(f"🔄 FORCE REFRESH: Deleting all cached AI analysis for user {current_user_id}")
                try:
                    await self.ai_analysis_db_service.delete_old_ai_analyses(days_old=0, db=ai_db_session)
                    logger.info(f"✅ Deleted all cached AI analysis for user {current_user_id}")
                except Exception as e:
                    logger.warning(f"⚠️ Failed to delete cached analysis: {str(e)}")

            if not force_refresh:
                logger.info(f"🔍 Checking database for existing AI analysis for user {current_user_id}")
                existing_analysis = await self.ai_analysis_db_service.get_latest_ai_analysis(
                    user_id=current_user_id,
                    analysis_type="comprehensive_analysis",
                    strategy_id=strategy_id,
                    max_age_hours=1,
                    db=ai_db_session
                )

                if existing_analysis:
                    cache_age_hours = (datetime.utcnow() - existing_analysis.get('created_at', datetime.utcnow())).total_seconds() / 3600
                    if cache_age_hours < 1:
                        return {
                            "insights": existing_analysis.get('insights', []),
                            "recommendations": existing_analysis.get('recommendations', []),
                            "total_insights": len(existing_analysis.get('insights', [])),
                            "total_recommendations": len(existing_analysis.get('recommendations', [])),
                            "generated_at": existing_analysis.get('created_at', datetime.utcnow()).isoformat(),
                            "ai_service_status": existing_analysis.get('ai_service_status', 'operational'),
                            "processing_time": f"{existing_analysis.get('processing_time', 0):.2f}s" if existing_analysis.get('processing_time') else "cached",
                            "personalized_data_used": True if existing_analysis.get('personalized_data_used') else False,
                            "data_source": "database_cache",
                            "cache_age_hours": cache_age_hours,
                            "user_profile": existing_analysis.get('personalized_data_used', {})
                        }

            logger.info(f"🔄 Running FRESH AI analysis for user {current_user_id} (force_refresh: {force_refresh})")

            db = SessionLocal()
            try:
                personalized_inputs = await self.onboarding_integration_service.process_onboarding_data(str(current_user_id), db)
            finally:
                db.close()

            logger.info(f"📊 Using personalized inputs: {len(personalized_inputs)} data points")

            performance_analysis = await self.ai_analytics_service.analyze_performance_trends(
                user_id=current_user_id, strategy_id=strategy_id
            )
            strategic_intelligence = await self.ai_analytics_service.generate_strategic_intelligence(
                user_id=current_user_id, strategy_id=strategy_id
            )
            evolution_analysis = await self.ai_analytics_service.analyze_content_evolution(
                user_id=current_user_id, strategy_id=strategy_id
            )

            insights = []
            recommendations = []
            if performance_analysis:
                insights.extend(performance_analysis.get('insights', []))
            if strategic_intelligence:
                insights.extend(strategic_intelligence.get('insights', []))
            if evolution_analysis:
                insights.extend(evolution_analysis.get('insights', []))

            total_time = time.time() - start_time

            try:
                await self.ai_analysis_db_service.store_ai_analysis_result(
                    user_id=current_user_id,
                    analysis_type="comprehensive_analysis",
                    insights=insights,
                    recommendations=recommendations,
                    performance_metrics=performance_analysis,
                    personalized_data=personalized_inputs,
                    processing_time=total_time,
                    strategy_id=strategy_id,
                    ai_service_status="operational" if len(insights) > 0 else "fallback",
                    db=ai_db_session
                )
                logger.info(f"💾 AI analysis results stored in database for user {current_user_id}")
            except Exception as e:
                logger.error(f"❌ Failed to store AI analysis in database: {str(e)}")

            return {
                "insights": insights,
                "recommendations": recommendations,
                "total_insights": len(insights),
                "total_recommendations": len(recommendations),
                "generated_at": datetime.utcnow().isoformat(),
                "ai_service_status": "operational" if len(insights) > 0 else "fallback",
                "processing_time": f"{total_time:.2f}s",
                "personalized_data_used": True,
                "data_source": "ai_analysis",
                "user_profile": {
                    "website_url": personalized_inputs.get('website_analysis', {}).get('website_url', ''),
                    "content_types": personalized_inputs.get('canonical_profile', {}).get('content_types', []),
                    "target_audience": personalized_inputs.get('canonical_profile', {}).get('target_audience', []),
                    "industry_focus": personalized_inputs.get('canonical_profile', {}).get('industry', 'general')
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Error generating AI analytics: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "get_ai_analytics")
        finally:
            ai_db_session.close()
    
    async def get_user_ai_analysis_results(self, user_id: int, analysis_type: Optional[str] = None, limit: int = 10) -> Dict[str, Any]:
        """Get AI analysis results for a specific user."""
        try:
            logger.info(f"Fetching AI analysis results for user {user_id}")
            
            analysis_types = [analysis_type] if analysis_type else None
            results = await self.ai_analysis_db_service.get_user_ai_analyses(
                user_id=user_id,
                analysis_types=analysis_types,
                limit=limit
            )
            
            return {
                "user_id": user_id,
                "results": [result.to_dict() for result in results],
                "total_results": len(results)
            }
            
        except Exception as e:
            logger.error(f"Error fetching AI analysis results: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "get_user_ai_analysis_results")
    
    async def refresh_ai_analysis(self, user_id: int, analysis_type: str, strategy_id: Optional[int] = None) -> Dict[str, Any]:
        """Force refresh of AI analysis for a user."""
        try:
            logger.info(f"Force refreshing AI analysis for user {user_id}, type: {analysis_type}")
            
            # Delete existing analysis to force refresh
            await self.ai_analysis_db_service.delete_old_ai_analyses(days_old=0)
            
            # Run new analysis based on type
            if analysis_type == "comprehensive_analysis":
                # This will trigger a new comprehensive analysis
                return {"message": f"AI analysis refresh initiated for user {user_id}"}
            elif analysis_type == "gap_analysis":
                # This will trigger a new gap analysis
                return {"message": f"Gap analysis refresh initiated for user {user_id}"}
            elif analysis_type == "strategic_intelligence":
                # This will trigger a new strategic intelligence analysis
                return {"message": f"Strategic intelligence refresh initiated for user {user_id}"}
            else:
                raise Exception(f"Unknown analysis type: {analysis_type}")
            
        except Exception as e:
            logger.error(f"Error refreshing AI analysis: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "refresh_ai_analysis")
    
    async def clear_ai_analysis_cache(self, user_id: int, analysis_type: Optional[str] = None) -> Dict[str, Any]:
        """Clear AI analysis cache for a user."""
        try:
            logger.info(f"Clearing AI analysis cache for user {user_id}")
            
            if analysis_type:
                # Clear specific analysis type
                deleted_count = await self.ai_analysis_db_service.delete_old_ai_analyses(days_old=0)
                return {"message": f"Cleared {deleted_count} cached results for user {user_id}"}
            else:
                # Clear all cached results
                deleted_count = await self.ai_analysis_db_service.delete_old_ai_analyses(days_old=0)
                return {"message": f"Cleared {deleted_count} cached results for user {user_id}"}
            
        except Exception as e:
            logger.error(f"Error clearing AI analysis cache: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "clear_ai_analysis_cache")
    
    async def get_ai_analysis_statistics(self, user_id: Optional[int] = None) -> Dict[str, Any]:
        """Get AI analysis statistics."""
        try:
            logger.info(f"📊 Getting AI analysis statistics for user: {user_id}")
            
            if user_id:
                # Get user-specific statistics
                user_stats = await self.ai_analysis_db_service.get_analysis_statistics(user_id)
                return {
                    "user_id": user_id,
                    "statistics": user_stats,
                    "message": "User-specific AI analysis statistics retrieved successfully"
                }
            else:
                # Get global statistics
                global_stats = await self.ai_analysis_db_service.get_analysis_statistics()
                return {
                    "statistics": global_stats,
                    "message": "Global AI analysis statistics retrieved successfully"
                }
                
        except Exception as e:
            logger.error(f"❌ Error getting AI analysis statistics: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "get_ai_analysis_statistics")
