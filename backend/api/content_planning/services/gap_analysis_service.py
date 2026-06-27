"""
Gap Analysis Service for Content Planning API
Extracted business logic from the gap analysis route for better separation of concerns.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
from loguru import logger
from sqlalchemy.orm import Session

# Import database services
from services.content_planning_db import ContentPlanningDBService
from services.ai_analysis_db_service import AIAnalysisDBService
from services.database import SessionLocal, get_session_for_user
from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService

# Import migrated content gap analysis services
from services.content_gap_analyzer.content_gap_analyzer import ContentGapAnalyzer
from services.content_gap_analyzer.competitor_analyzer import CompetitorAnalyzer
from services.content_gap_analyzer.keyword_researcher import KeywordResearcher
from services.content_gap_analyzer.ai_engine_service import AIEngineService
from services.content_gap_analyzer.website_analyzer import WebsiteAnalyzer

# Import utilities
from ..utils.error_handlers import ContentPlanningErrorHandler
from ..utils.response_builders import ResponseBuilder
from ..utils.constants import ERROR_MESSAGES, SUCCESS_MESSAGES

class GapAnalysisService:
    """Service class for content gap analysis operations."""
    
    def __init__(self):
        self.ai_analysis_db_service = AIAnalysisDBService()
        self.onboarding_integration_service = OnboardingDataIntegrationService()
        
        # Initialize migrated services
        self.content_gap_analyzer = ContentGapAnalyzer()
        self.competitor_analyzer = CompetitorAnalyzer()
        self.keyword_researcher = KeywordResearcher()
        self.ai_engine_service = AIEngineService()
        self.website_analyzer = WebsiteAnalyzer()
    
    async def create_gap_analysis(self, analysis_data: Dict[str, Any], db: Session) -> Dict[str, Any]:
        """Create a new content gap analysis."""
        try:
            logger.info(f"Creating content gap analysis for: {analysis_data.get('website_url', 'Unknown')}")
            
            db_service = ContentPlanningDBService(db)
            created_analysis = await db_service.create_content_gap_analysis(analysis_data)
            
            if created_analysis:
                logger.info(f"Content gap analysis created successfully: {created_analysis.id}")
                return created_analysis.to_dict()
            else:
                raise Exception("Failed to create gap analysis")
                
        except Exception as e:
            logger.error(f"Error creating content gap analysis: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "create_gap_analysis")
    
    async def get_gap_analyses(self, user_id: Optional[Any] = None, strategy_id: Optional[int] = None, force_refresh: bool = False) -> Dict[str, Any]:
        """Get content gap analysis with real AI insights - Database first approach."""
        current_user_id = user_id or "1"
        ai_db = get_session_for_user(str(current_user_id))
        try:
            logger.info(f"🚀 Starting content gap analysis for user: {user_id}, strategy: {strategy_id}, force_refresh: {force_refresh}")

            if not force_refresh:
                logger.info(f"🔍 Checking database for existing gap analysis for user {current_user_id}")
                existing_analysis = await self.ai_analysis_db_service.get_latest_ai_analysis(
                    user_id=current_user_id,
                    analysis_type="gap_analysis",
                    strategy_id=strategy_id,
                    max_age_hours=24,
                    db=ai_db
                )

                if existing_analysis:
                    return {
                        "gap_analyses": [{"recommendations": existing_analysis.get('recommendations', [])}],
                        "total_gaps": len(existing_analysis.get('recommendations', [])),
                        "generated_at": existing_analysis.get('created_at', datetime.utcnow()).isoformat(),
                        "ai_service_status": existing_analysis.get('ai_service_status', 'operational'),
                        "personalized_data_used": True if existing_analysis.get('personalized_data_used') else False,
                        "data_source": "database_cache",
                        "cache_age_hours": (datetime.utcnow() - existing_analysis.get('created_at', datetime.utcnow())).total_seconds() / 3600
                    }

            logger.info(f"🔄 Running new gap analysis for user {current_user_id} (force_refresh: {force_refresh})")

            db = get_session_for_user(str(current_user_id))
            try:
                personalized_inputs = await self.onboarding_integration_service.process_onboarding_data(str(current_user_id), db)
            finally:
                db.close()

            gap_analysis = await self.ai_engine_service.generate_content_recommendations(personalized_inputs, user_id=str(current_user_id))
            logger.info(f"✅ AI gap analysis completed: {len(gap_analysis)} recommendations")

            try:
                await self.ai_analysis_db_service.store_ai_analysis_result(
                    user_id=current_user_id,
                    analysis_type="gap_analysis",
                    insights=[],
                    recommendations=gap_analysis,
                    personalized_data=personalized_inputs,
                    strategy_id=strategy_id,
                    ai_service_status="operational",
                    db=ai_db
                )
                logger.info(f"💾 Gap analysis results stored in database for user {current_user_id}")
            except Exception as e:
                logger.error(f"❌ Failed to store gap analysis in database: {str(e)}")
            
            return {
                "gap_analyses": [{"recommendations": gap_analysis}],
                "total_gaps": len(gap_analysis),
                "generated_at": datetime.utcnow().isoformat(),
                "ai_service_status": "operational",
                "personalized_data_used": True,
                "data_source": "ai_analysis"
            }
            
        except Exception as e:
            logger.error(f"❌ Error generating content gap analysis: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "get_gap_analyses")
        finally:
            ai_db.close()
    
    async def get_gap_analysis_by_id(self, analysis_id: int, db: Session) -> Dict[str, Any]:
        """Get a specific content gap analysis by ID."""
        try:
            logger.info(f"Fetching content gap analysis: {analysis_id}")
            
            db_service = ContentPlanningDBService(db)
            analysis = await db_service.get_content_gap_analysis(analysis_id)
            
            if analysis:
                return analysis.to_dict()
            else:
                raise ContentPlanningErrorHandler.handle_not_found_error("Content gap analysis", analysis_id)
            
        except Exception as e:
            logger.error(f"Error getting content gap analysis: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "get_gap_analysis_by_id")
    
    async def analyze_content_gaps(self, request_data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """Analyze content gaps between your website and competitors."""
        try:
            logger.info(f"Starting content gap analysis for: {request_data.get('website_url', 'Unknown')}")
            
            # Use ContentGapAnalyzer for comprehensive analysis
            results = await self.content_gap_analyzer.analyze_comprehensive_gap(
                target_url=request_data.get('website_url'),
                competitor_urls=request_data.get('competitor_urls', []),
                target_keywords=request_data.get('target_keywords', []),
                user_id=user_id,
                industry=request_data.get('industry', 'general')
            )
            
            if 'error' in results:
                raise Exception(results['error'])
            
            # Map results to ContentGapAnalysisFullResponse structure
            # ContentGapAnalyzer returns a rich structure, we map it to the response model
            response_data = {
                'website_analysis': {
                    'serp_analysis': results.get('serp_analysis', {}),
                    'keyword_expansion': results.get('keyword_expansion', {})
                },
                'competitor_analysis': results.get('competitor_content', {}),
                'gap_analysis': results.get('gap_analysis', {}),
                'recommendations': results.get('recommendations', []),
                'opportunities': results.get('ai_insights', {}).get('strategic_insights', []),
                'created_at': datetime.utcnow()
            }
            
            logger.info(f"Content gap analysis completed successfully")
            return response_data
            
        except Exception as e:
            logger.error(f"Error analyzing content gaps: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "analyze_content_gaps")
    
    async def get_user_gap_analyses(self, user_id: int, db: Session) -> List[Dict[str, Any]]:
        """Get all gap analyses for a specific user."""
        try:
            logger.info(f"Fetching gap analyses for user: {user_id}")
            
            db_service = ContentPlanningDBService(db)
            analyses = await db_service.get_user_content_gap_analyses(user_id)
            
            return [analysis.to_dict() for analysis in analyses]
            
        except Exception as e:
            logger.error(f"Error getting user gap analyses: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "get_user_gap_analyses")
    
    async def update_gap_analysis(self, analysis_id: int, update_data: Dict[str, Any], db: Session) -> Dict[str, Any]:
        """Update a content gap analysis."""
        try:
            logger.info(f"Updating content gap analysis: {analysis_id}")
            
            db_service = ContentPlanningDBService(db)
            updated_analysis = await db_service.update_content_gap_analysis(analysis_id, update_data)
            
            if updated_analysis:
                return updated_analysis.to_dict()
            else:
                raise ContentPlanningErrorHandler.handle_not_found_error("Content gap analysis", analysis_id)
            
        except Exception as e:
            logger.error(f"Error updating content gap analysis: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "update_gap_analysis")
    
    async def delete_gap_analysis(self, analysis_id: int, db: Session) -> bool:
        """Delete a content gap analysis."""
        try:
            logger.info(f"Deleting content gap analysis: {analysis_id}")
            
            db_service = ContentPlanningDBService(db)
            deleted = await db_service.delete_content_gap_analysis(analysis_id)
            
            if deleted:
                return True
            else:
                raise ContentPlanningErrorHandler.handle_not_found_error("Content gap analysis", analysis_id)
            
        except Exception as e:
            logger.error(f"Error deleting content gap analysis: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "delete_gap_analysis")
