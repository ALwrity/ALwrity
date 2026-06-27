"""
AI Analysis Database Service
Handles database operations for AI analysis results including storage and retrieval.
"""

from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from datetime import datetime, timedelta
from loguru import logger

from models.content_planning import AIAnalysisResult, ContentStrategy
from services.database import get_db_session

class AIAnalysisDBService:
    """Service for managing AI analysis results in the database."""
    
    def __init__(self, db_session: Session = None):
        self.db = db_session or get_db_session()
    
    async def store_ai_analysis_result(
        self,
        user_id: int,
        analysis_type: str,
        insights: List[Dict[str, Any]],
        recommendations: List[Dict[str, Any]],
        performance_metrics: Optional[Dict[str, Any]] = None,
        personalized_data: Optional[Dict[str, Any]] = None,
        processing_time: Optional[float] = None,
        strategy_id: Optional[int] = None,
        ai_service_status: str = "operational",
        db: Optional[Session] = None
    ) -> AIAnalysisResult:
        """Store AI analysis result in the database."""
        session = db or self.db
        if session is None:
            logger.error("No database session available for storing AI analysis result")
            raise RuntimeError("Database session required")
        try:
            logger.info(f"Storing AI analysis result for user {user_id}, type: {analysis_type}")
            
            # Create new AI analysis result
            ai_result = AIAnalysisResult(
                user_id=user_id,
                strategy_id=strategy_id,
                analysis_type=analysis_type,
                insights=insights,
                recommendations=recommendations,
                performance_metrics=performance_metrics,
                personalized_data_used=personalized_data,
                processing_time=processing_time,
                ai_service_status=ai_service_status,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            session.add(ai_result)
            session.commit()
            session.refresh(ai_result)
            
            logger.info(f"✅ AI analysis result stored successfully: {ai_result.id}")
            return ai_result
            
        except Exception as e:
            logger.error(f"❌ Error storing AI analysis result: {str(e)}")
            session.rollback()
            raise
    
    async def get_latest_ai_analysis(
        self, 
        user_id: int, 
        analysis_type: str, 
        strategy_id: Optional[int] = None,
        max_age_hours: int = 24,
        db: Optional[Session] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get the latest AI analysis result with detailed logging.
        """
        session = db or self.db
        if session is None:
            logger.error("No database session available for retrieving AI analysis")
            return None
        try:
            logger.info(f"🔍 Retrieving latest AI analysis for user {user_id}, type: {analysis_type}")
            
            # Build query
            query = session.query(AIAnalysisResult).filter(
                AIAnalysisResult.user_id == user_id,
                AIAnalysisResult.analysis_type == analysis_type
            )
            
            if strategy_id:
                query = query.filter(AIAnalysisResult.strategy_id == strategy_id)
            
            # Get the most recent result
            latest_result = query.order_by(AIAnalysisResult.created_at.desc()).first()
            
            if latest_result:
                logger.info(f"✅ Found recent AI analysis result: {latest_result.id}")
                
                # Convert to dictionary and log details
                result_dict = {
                    "id": latest_result.id,
                    "user_id": latest_result.user_id,
                    "strategy_id": latest_result.strategy_id,
                    "analysis_type": latest_result.analysis_type,
                    "analysis_date": latest_result.created_at.isoformat(),
                    "results": latest_result.insights or {},
                    "recommendations": latest_result.recommendations or [],
                    "personalized_data_used": latest_result.personalized_data_used,
                    "ai_service_status": latest_result.ai_service_status
                }
                
                # Log the detailed structure
                logger.info(f"📊 AI Analysis Result Details:")
                logger.info(f"   - Result ID: {result_dict['id']}")
                logger.info(f"   - User ID: {result_dict['user_id']}")
                logger.info(f"   - Strategy ID: {result_dict['strategy_id']}")
                logger.info(f"   - Analysis Type: {result_dict['analysis_type']}")
                logger.info(f"   - Analysis Date: {result_dict['analysis_date']}")
                logger.info(f"   - Personalized Data Used: {result_dict['personalized_data_used']}")
                logger.info(f"   - AI Service Status: {result_dict['ai_service_status']}")
                
                # Log results structure
                results = result_dict.get("results", {})
                logger.info(f"   - Results Keys: {list(results.keys())}")
                logger.info(f"   - Results Type: {type(results)}")
                
                # Log recommendations
                recommendations = result_dict.get("recommendations", [])
                logger.info(f"   - Recommendations Count: {len(recommendations)}")
                logger.info(f"   - Recommendations Type: {type(recommendations)}")
                
                # Log specific data if available
                if results:
                    logger.info("🔍 RESULTS DATA BREAKDOWN:")
                    for key, value in results.items():
                        if isinstance(value, list):
                            logger.info(f"     {key}: {len(value)} items")
                        elif isinstance(value, dict):
                            logger.info(f"     {key}: {len(value)} keys")
                        else:
                            logger.info(f"     {key}: {value}")
                
                if recommendations:
                    logger.info("🔍 RECOMMENDATIONS DATA BREAKDOWN:")
                    for i, rec in enumerate(recommendations[:3]):  # Log first 3
                        if isinstance(rec, dict):
                            logger.info(f"     Recommendation {i+1}: {rec.get('title', 'N/A')}")
                            logger.info(f"       Type: {rec.get('type', 'N/A')}")
                            logger.info(f"       Priority: {rec.get('priority', 'N/A')}")
                        else:
                            logger.info(f"     Recommendation {i+1}: {rec}")
                
                return result_dict
            else:
                logger.warning(f"⚠️ No AI analysis result found for user {user_id}, type: {analysis_type}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Error retrieving latest AI analysis: {str(e)}")
            logger.error(f"Exception type: {type(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None
    
    async def get_user_ai_analyses(
        self,
        user_id: int,
        analysis_types: Optional[List[str]] = None,
        limit: int = 10
    ) -> List[AIAnalysisResult]:
        """Get all AI analysis results for a user."""
        try:
            logger.info(f"Retrieving AI analyses for user {user_id}")
            
            query = self.db.query(AIAnalysisResult).filter(
                AIAnalysisResult.user_id == user_id
            )
            
            # Filter by analysis types if provided
            if analysis_types:
                query = query.filter(AIAnalysisResult.analysis_type.in_(analysis_types))
            
            results = query.order_by(desc(AIAnalysisResult.created_at)).limit(limit).all()
            
            logger.info(f"✅ Retrieved {len(results)} AI analysis results for user {user_id}")
            return results
            
        except Exception as e:
            logger.error(f"❌ Error retrieving user AI analyses: {str(e)}")
            return []
    
    async def update_ai_analysis_result(
        self,
        result_id: int,
        updates: Dict[str, Any]
    ) -> Optional[AIAnalysisResult]:
        """Update an existing AI analysis result."""
        try:
            logger.info(f"Updating AI analysis result: {result_id}")
            
            result = self.db.query(AIAnalysisResult).filter(
                AIAnalysisResult.id == result_id
            ).first()
            
            if not result:
                logger.warning(f"AI analysis result not found: {result_id}")
                return None
            
            # Update fields
            for key, value in updates.items():
                if hasattr(result, key):
                    setattr(result, key, value)
            
            result.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(result)
            
            logger.info(f"✅ AI analysis result updated successfully: {result_id}")
            return result
            
        except Exception as e:
            logger.error(f"❌ Error updating AI analysis result: {str(e)}")
            self.db.rollback()
            return None
    
    async def delete_old_ai_analyses(
        self,
        days_old: int = 30,
        db: Optional[Session] = None
    ) -> int:
        """Delete AI analysis results older than specified days."""
        session = db or self.db
        if session is None:
            logger.error("No database session available for deleting old AI analyses")
            return 0
        try:
            logger.info(f"Cleaning up AI analysis results older than {days_old} days")
            
            cutoff_date = datetime.utcnow() - timedelta(days=days_old)
            
            deleted_count = session.query(AIAnalysisResult).filter(
                AIAnalysisResult.created_at < cutoff_date
            ).delete()
            
            session.commit()
            
            logger.info(f"✅ Deleted {deleted_count} old AI analysis results")
            return deleted_count
            
        except Exception as e:
            logger.error(f"❌ Error deleting old AI analyses: {str(e)}")
            session.rollback()
            return 0
    
    async def get_analysis_statistics(
        self,
        user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Get statistics about AI analysis results."""
        try:
            logger.info("Retrieving AI analysis statistics")
            
            query = self.db.query(AIAnalysisResult)
            
            if user_id:
                query = query.filter(AIAnalysisResult.user_id == user_id)
            
            total_analyses = query.count()
            
            # Get counts by analysis type
            type_counts = {}
            for analysis_type in ['performance_trends', 'strategic_intelligence', 'content_evolution', 'gap_analysis']:
                count = query.filter(AIAnalysisResult.analysis_type == analysis_type).count()
                type_counts[analysis_type] = count
            
            # Get average processing time
            avg_processing_time = self.db.query(
                self.db.func.avg(AIAnalysisResult.processing_time)
            ).scalar() or 0
            
            stats = {
                'total_analyses': total_analyses,
                'analysis_type_counts': type_counts,
                'average_processing_time': float(avg_processing_time),
                'user_id': user_id
            }
            
            logger.info(f"✅ Retrieved AI analysis statistics: {stats}")
            return stats
            
        except Exception as e:
            logger.error(f"❌ Error retrieving AI analysis statistics: {str(e)}")
            return {
                'total_analyses': 0,
                'analysis_type_counts': {},
                'average_processing_time': 0,
                'user_id': user_id
            } 