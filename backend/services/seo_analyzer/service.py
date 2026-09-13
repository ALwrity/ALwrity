"""
SEO Analysis Service
Handles storing and retrieving SEO analysis data from the database.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from loguru import logger

from models.seo_analysis import (
    SEOAnalysis,
    SEOIssue,
    SEOWarning,
    SEORecommendation,
    SEOCategoryScore,
    SEOAnalysisHistory,
    create_analysis_from_result,
    create_issues_from_result,
    create_warnings_from_result,
    create_recommendations_from_result,
    create_category_scores_from_result
)
from .core import SEOAnalysisResult

class SEOAnalysisService:
    """Service for managing SEO analysis data in the database."""
    
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def store_analysis_result(
        self,
        result: SEOAnalysisResult,
        triggered_by_user_id: Optional[str] = None,
    ) -> Optional[SEOAnalysis]:
        """
        Store SEO analysis result in the database.

        Args:
            result: SEOAnalysisResult from the analyzer
            triggered_by_user_id: Clerk user id that triggered the analysis.
                Phase 8: threads the authenticated user into the storage so
                analyses are per-user scoped (column precedent:
                SEOAnalysisSession.triggered_by_user_id). Legacy/global callers
                keep NULL.

        Returns:
            Stored SEOAnalysis record or None if failed
        """
        try:
            # Create main analysis record
            analysis_record = create_analysis_from_result(result)
            # Phase 8: bind the triggering user on the persisted row.
            analysis_record.triggered_by_user_id = triggered_by_user_id
            self.db.add(analysis_record)
            self.db.flush()  # Get the ID
            
            # Create related records
            issues = create_issues_from_result(analysis_record.id, result)
            warnings = create_warnings_from_result(analysis_record.id, result)
            recommendations = create_recommendations_from_result(analysis_record.id, result)
            category_scores = create_category_scores_from_result(analysis_record.id, result)
            
            # Add all related records
            for issue in issues:
                self.db.add(issue)
            for warning in warnings:
                self.db.add(warning)
            for recommendation in recommendations:
                self.db.add(recommendation)
            for score in category_scores:
                self.db.add(score)
            
            # Create history record
            history_record = SEOAnalysisHistory(
                url=result.url,
                analysis_date=result.timestamp,
                overall_score=result.overall_score,
                health_status=result.health_status,
                score_change=0,  # Will be calculated later
                # Phase 8: history rows carry the user too, so per-user
                # trend reads can scope without joining analyses.
                triggered_by_user_id=triggered_by_user_id,
                critical_issues_count=len(result.critical_issues),
                warnings_count=len(result.warnings),
                recommendations_count=len(result.recommendations)
            )
            
            # Add category scores to history
            for category, data in result.data.items():
                if isinstance(data, dict) and 'score' in data:
                    if category == 'url_structure':
                        history_record.url_structure_score = data['score']
                    elif category == 'meta_data':
                        history_record.meta_data_score = data['score']
                    elif category == 'content_analysis':
                        history_record.content_score = data['score']
                    elif category == 'technical_seo':
                        history_record.technical_score = data['score']
                    elif category == 'performance':
                        history_record.performance_score = data['score']
                    elif category == 'accessibility':
                        history_record.accessibility_score = data['score']
                    elif category == 'user_experience':
                        history_record.user_experience_score = data['score']
                    elif category == 'security_headers':
                        history_record.security_score = data['score']
            
            self.db.add(history_record)
            self.db.commit()
            
            logger.info(
                f"Stored SEO analysis for {result.url} with score {result.overall_score} "
                f"user_id={triggered_by_user_id or 'anonymous'}"
            )
            return analysis_record
            
        except Exception as e:
            logger.error(f"Error storing SEO analysis: {str(e)}")
            self.db.rollback()
            return None
    
    def get_latest_analysis(self, url: str) -> Optional[SEOAnalysis]:
        """
        Get the latest SEO analysis for a URL.
        
        Args:
            url: The URL to get analysis for
            
        Returns:
            Latest SEOAnalysis record or None
        """
        try:
            return self.db.query(SEOAnalysis).filter(
                SEOAnalysis.url == url
            ).order_by(SEOAnalysis.timestamp.desc()).first()
        except Exception as e:
            logger.error(f"Error getting latest analysis for {url}: {str(e)}")
            return None
    
    def get_analysis_history(self, url: str, limit: int = 10) -> List[SEOAnalysisHistory]:
        """
        Get analysis history for a URL.
        
        Args:
            url: The URL to get history for
            limit: Maximum number of records to return
            
        Returns:
            List of SEOAnalysisHistory records
        """
        try:
            return self.db.query(SEOAnalysisHistory).filter(
                SEOAnalysisHistory.url == url
            ).order_by(SEOAnalysisHistory.analysis_date.desc()).limit(limit).all()
        except Exception as e:
            logger.error(f"Error getting analysis history for {url}: {str(e)}")
            return []
    
    def get_analysis_by_id(self, analysis_id: int) -> Optional[SEOAnalysis]:
        """
        Get SEO analysis by ID.
        
        Args:
            analysis_id: The analysis ID
            
        Returns:
            SEOAnalysis record or None
        """
        try:
            return self.db.query(SEOAnalysis).filter(
                SEOAnalysis.id == analysis_id
            ).first()
        except Exception as e:
            logger.error(f"Error getting analysis by ID {analysis_id}: {str(e)}")
            return None
    
    def get_all_analyses(self, limit: int = 50) -> List[SEOAnalysis]:
        """
        Get all SEO analyses with pagination.
        
        Args:
            limit: Maximum number of records to return
            
        Returns:
            List of SEOAnalysis records
        """
        try:
            return self.db.query(SEOAnalysis).order_by(
                SEOAnalysis.timestamp.desc()
            ).limit(limit).all()
        except Exception as e:
            logger.error(f"Error getting all analyses: {str(e)}")
            return []
    
    def delete_analysis(self, analysis_id: int) -> bool:
        """
        Delete an SEO analysis.
        
        Args:
            analysis_id: The analysis ID to delete
            
        Returns:
            True if successful, False otherwise
        """
        try:
            analysis = self.db.query(SEOAnalysis).filter(
                SEOAnalysis.id == analysis_id
            ).first()
            
            if analysis:
                self.db.delete(analysis)
                self.db.commit()
                logger.info(f"Deleted SEO analysis {analysis_id}")
                return True
            else:
                logger.warning(f"Analysis {analysis_id} not found for deletion")
                return False
                
        except Exception as e:
            logger.error(f"Error deleting analysis {analysis_id}: {str(e)}")
            self.db.rollback()
            return False
    
    def get_analysis_statistics(self) -> Dict[str, Any]:
        """
        Get overall statistics for SEO analyses.
        
        Returns:
            Dictionary with analysis statistics
        """
        try:
            total_analyses = self.db.query(SEOAnalysis).count()
            total_urls = self.db.query(SEOAnalysis.url).distinct().count()
            
            # Get average scores by health status
            excellent_count = self.db.query(SEOAnalysis).filter(
                SEOAnalysis.health_status == 'excellent'
            ).count()
            
            good_count = self.db.query(SEOAnalysis).filter(
                SEOAnalysis.health_status == 'good'
            ).count()
            
            needs_improvement_count = self.db.query(SEOAnalysis).filter(
                SEOAnalysis.health_status == 'needs_improvement'
            ).count()
            
            poor_count = self.db.query(SEOAnalysis).filter(
                SEOAnalysis.health_status == 'poor'
            ).count()
            
            # Calculate average overall score
            avg_score_result = self.db.query(
                func.avg(SEOAnalysis.overall_score)
            ).scalar()
            avg_score = float(avg_score_result) if avg_score_result else 0
            
            return {
                'total_analyses': total_analyses,
                'total_urls': total_urls,
                'average_score': round(avg_score, 2),
                'health_distribution': {
                    'excellent': excellent_count,
                    'good': good_count,
                    'needs_improvement': needs_improvement_count,
                    'poor': poor_count
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting analysis statistics: {str(e)}")
            return {
                'total_analyses': 0,
                'total_urls': 0,
                'average_score': 0,
                'health_distribution': {
                    'excellent': 0,
                    'good': 0,
                    'needs_improvement': 0,
                    'poor': 0
                }
            } 