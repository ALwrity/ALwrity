"""
Website Analysis Service for Onboarding Step 2
Handles storage and retrieval of website analysis results.
"""

from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime
import json
from loguru import logger

from models.onboarding import WebsiteAnalysis, OnboardingSession


class WebsiteAnalysisService:
    """Service for managing website analysis data during onboarding."""
    
    def __init__(self, db_session: Session):
        """Initialize the service with database session."""
        self.db = db_session
    
    def save_analysis(self, session_id: int, website_url: str, analysis_data: Dict[str, Any], preserve_persona: bool = False) -> Optional[int]:
        """
        Save website analysis results to database.
        
        Args:
            session_id: Onboarding session ID
            website_url: The analyzed website URL
            analysis_data: Complete analysis results from style detection
            preserve_persona: If True, existing brand persona fields (writing_style, target_audience, etc.)
                            will NOT be overwritten if they already contain data.
            
        Returns:
            Analysis ID if successful, None otherwise
        """
        try:
            # Check if analysis already exists for this URL and session
            existing_analysis = self.db.query(WebsiteAnalysis).filter_by(
                session_id=session_id,
                website_url=website_url
            ).first()
            
            if existing_analysis:
                # Update existing analysis
                style_analysis = analysis_data.get('style_analysis', {})
                
                # Prepare crawl_result with extra data to ensure no data loss
                crawl_result = analysis_data.get('crawl_result') or {}
                if not isinstance(crawl_result, dict):
                    crawl_result = {"raw": crawl_result}
                
                # Store extra fields in crawl_result if columns don't exist
                if style_analysis.get('meta_info'):
                    crawl_result['meta_info'] = style_analysis.get('meta_info')
                
                # Store sitemap_analysis in crawl_result since it doesn't have its own column
                if analysis_data.get('sitemap_analysis'):
                    crawl_result['sitemap_analysis'] = analysis_data.get('sitemap_analysis')

                # Update persona fields only if not preserving or if they are empty
                if not preserve_persona or not existing_analysis.writing_style:
                    existing_analysis.writing_style = style_analysis.get('writing_style')
                
                if not preserve_persona or not existing_analysis.content_characteristics:
                    existing_analysis.content_characteristics = style_analysis.get('content_characteristics')
                
                if not preserve_persona or not existing_analysis.target_audience:
                    existing_analysis.target_audience = style_analysis.get('target_audience')
                
                if not preserve_persona or not existing_analysis.content_type:
                    existing_analysis.content_type = style_analysis.get('content_type')
                
                if not preserve_persona or not existing_analysis.recommended_settings:
                    existing_analysis.recommended_settings = style_analysis.get('recommended_settings')
                
                # Store brand_analysis and content_strategy_insights if model supports it
                if hasattr(existing_analysis, 'brand_analysis'):
                    if not preserve_persona or not existing_analysis.brand_analysis:
                        existing_analysis.brand_analysis = style_analysis.get('brand_analysis')
                
                if hasattr(existing_analysis, 'content_strategy_insights'):
                    # Strategy insights are more dynamic, but arguably part of persona. 
                    # Let's preserve them too if requested, as user might have edited them.
                    if not preserve_persona or not existing_analysis.content_strategy_insights:
                        existing_analysis.content_strategy_insights = style_analysis.get('content_strategy_insights')
                
                # Always update technical/factual fields
                existing_analysis.crawl_result = crawl_result
                existing_analysis.style_patterns = analysis_data.get('style_patterns')
                existing_analysis.style_guidelines = analysis_data.get('style_guidelines')
                existing_analysis.seo_audit = analysis_data.get('seo_audit')
                existing_analysis.status = 'completed'
                existing_analysis.error_message = None
                existing_analysis.warning_message = analysis_data.get('warning')
                existing_analysis.updated_at = datetime.utcnow()
                
                self.db.commit()
                logger.info(f"Updated existing analysis for URL: {website_url} (preserve_persona={preserve_persona})")
                return existing_analysis.id
            else:
                # Create new analysis
                style_analysis = analysis_data.get('style_analysis', {})
                
                # Prepare crawl_result with extra data
                crawl_result = analysis_data.get('crawl_result') or {}
                if not isinstance(crawl_result, dict):
                    crawl_result = {"raw": crawl_result}
                
                # Store extra fields in crawl_result
                if style_analysis.get('meta_info'):
                    crawl_result['meta_info'] = style_analysis.get('meta_info')
                
                # Store sitemap_analysis in crawl_result since it doesn't have its own column
                if analysis_data.get('sitemap_analysis'):
                    crawl_result['sitemap_analysis'] = analysis_data.get('sitemap_analysis')
                
                analysis_args = {
                    'session_id': session_id,
                    'website_url': website_url,
                    'writing_style': style_analysis.get('writing_style'),
                    'content_characteristics': style_analysis.get('content_characteristics'),
                    'target_audience': style_analysis.get('target_audience'),
                    'content_type': style_analysis.get('content_type'),
                    'recommended_settings': style_analysis.get('recommended_settings'),
                    'crawl_result': crawl_result,
                    'style_patterns': analysis_data.get('style_patterns'),
                    'style_guidelines': analysis_data.get('style_guidelines'),
                    'seo_audit': analysis_data.get('seo_audit'),
                    'status': 'completed',
                    'warning_message': analysis_data.get('warning')
                }
                # Add brand_analysis and content_strategy_insights if model supports it
                if hasattr(WebsiteAnalysis, 'brand_analysis'):
                    analysis_args['brand_analysis'] = style_analysis.get('brand_analysis')
                if hasattr(WebsiteAnalysis, 'content_strategy_insights'):
                    analysis_args['content_strategy_insights'] = style_analysis.get('content_strategy_insights')
                
                analysis = WebsiteAnalysis(**analysis_args)
                
                self.db.add(analysis)
                self.db.commit()
                logger.info(f"Saved new analysis for URL: {website_url}")
                return analysis.id
                
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Error saving website analysis: {str(e)}")
            return None
    
    def get_analysis(self, analysis_id: int) -> Optional[Dict[str, Any]]:
        """
        Retrieve website analysis by ID.
        
        Args:
            analysis_id: Analysis ID
            
        Returns:
            Analysis data dictionary or None if not found
        """
        try:
            analysis = self.db.query(WebsiteAnalysis).get(analysis_id)
            if analysis:
                return analysis.to_dict()
            return None
            
        except SQLAlchemyError as e:
            logger.error(f"Error retrieving analysis {analysis_id}: {str(e)}")
            return None
    
    def get_analysis_by_url(self, session_id: int, website_url: str) -> Optional[Dict[str, Any]]:
        """
        Get analysis for a specific URL in a session.
        
        Args:
            session_id: Onboarding session ID
            website_url: Website URL
            
        Returns:
            Analysis data dictionary or None if not found
        """
        try:
            analysis = self.db.query(WebsiteAnalysis).filter_by(
                session_id=session_id,
                website_url=website_url
            ).first()
            
            if analysis:
                return analysis.to_dict()
            return None
            
        except SQLAlchemyError as e:
            logger.error(f"Error retrieving analysis for URL {website_url}: {str(e)}")
            return None
    
    def get_session_analyses(self, session_id: int) -> List[Dict[str, Any]]:
        """
        Get all analyses for a session.
        
        Args:
            session_id: Onboarding session ID
            
        Returns:
            List of analysis summaries
        """
        try:
            analyses = self.db.query(WebsiteAnalysis).filter_by(
                session_id=session_id
            ).order_by(WebsiteAnalysis.created_at.desc()).all()
            
            return [analysis.to_dict() for analysis in analyses]
            
        except SQLAlchemyError as e:
            logger.error(f"Error retrieving analyses for session {session_id}: {str(e)}")
            return []
    
    def get_analysis_by_session(self, session_id: int) -> Optional[Dict[str, Any]]:
        """
        Get the latest analysis for a session.
        
        Args:
            session_id: Onboarding session ID
            
        Returns:
            Latest analysis data or None if not found
        """
        try:
            analysis = self.db.query(WebsiteAnalysis).filter_by(
                session_id=session_id
            ).order_by(WebsiteAnalysis.created_at.desc()).first()
            
            if analysis:
                return analysis.to_dict()
            return None
            
        except SQLAlchemyError as e:
            logger.error(f"Error retrieving latest analysis for session {session_id}: {str(e)}")
            return None
    
    def check_existing_analysis(self, session_id: int, website_url: str) -> Optional[Dict[str, Any]]:
        """
        Check if analysis exists for a URL and return it if found.
        Used for confirmation dialog in frontend.
        
        Args:
            session_id: Onboarding session ID
            website_url: Website URL
            
        Returns:
            Analysis data if found, None otherwise
        """
        try:
            analysis = self.db.query(WebsiteAnalysis).filter_by(
                session_id=session_id,
                website_url=website_url,
                status='completed'
            ).order_by(WebsiteAnalysis.created_at.desc()).first()
            
            if analysis:
                return {
                    'exists': True,
                    'analysis_date': analysis.analysis_date.isoformat() if analysis.analysis_date else None,
                    'analysis_id': analysis.id,
                    'summary': {
                        'writing_style': analysis.writing_style,
                        'target_audience': analysis.target_audience,
                        'content_type': analysis.content_type
                    }
                }
            return {'exists': False}
            
        except SQLAlchemyError as e:
            logger.error(f"Error checking existing analysis for URL {website_url}: {str(e)}")
            return {'exists': False, 'error': str(e)}
    
    def delete_analysis(self, analysis_id: int) -> bool:
        """
        Delete a website analysis.
        
        Args:
            analysis_id: Analysis ID
            
        Returns:
            True if successful, False otherwise
        """
        try:
            analysis = self.db.query(WebsiteAnalysis).get(analysis_id)
            if analysis:
                self.db.delete(analysis)
                self.db.commit()
                logger.info(f"Deleted analysis {analysis_id}")
                return True
            return False
            
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Error deleting analysis {analysis_id}: {str(e)}")
            return False
    
    def update_analysis_content(self, analysis_id: int, analysis_data: Dict[str, Any]) -> bool:
        """
        Update specific content fields of an existing analysis.
        
        Args:
            analysis_id: Analysis ID to update
            analysis_data: Dictionary containing fields to update (writing_style, etc.)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            analysis = self.db.query(WebsiteAnalysis).get(analysis_id)
            if not analysis:
                logger.warning(f"Analysis {analysis_id} not found for update")
                return False

            # Update fields if present in data
            if 'writing_style' in analysis_data:
                analysis.writing_style = analysis_data['writing_style']
            if 'content_characteristics' in analysis_data:
                analysis.content_characteristics = analysis_data['content_characteristics']
            if 'target_audience' in analysis_data:
                analysis.target_audience = analysis_data['target_audience']
            if 'content_type' in analysis_data:
                analysis.content_type = analysis_data['content_type']
            if 'recommended_settings' in analysis_data:
                analysis.recommended_settings = analysis_data['recommended_settings']
            
            # Optional fields
            if 'brand_analysis' in analysis_data and hasattr(analysis, 'brand_analysis'):
                analysis.brand_analysis = analysis_data['brand_analysis']
            if 'content_strategy_insights' in analysis_data and hasattr(analysis, 'content_strategy_insights'):
                analysis.content_strategy_insights = analysis_data['content_strategy_insights']
                
            # Update guidelines if present (nested in style_guidelines usually)
            # But the frontend might send them separately or as part of a guidelines object
            # If the frontend sends the whole 'analysis' object structure, we might need to map it back
            # to style_guidelines structure if that's how it's stored.
            # Based on save_analysis, style_guidelines is a JSON field.
            
            # If the frontend sends 'guidelines', 'best_practices' etc. separately (flattened),
            # we need to reconstruct style_guidelines or update the existing one.
            # Let's assume the frontend sends the same structure as it received or we handle the mapping in the API layer.
            # For now, let's support direct update of style_guidelines if provided
            if 'style_guidelines' in analysis_data:
                analysis.style_guidelines = analysis_data['style_guidelines']
            
            # Update SEO audit if present
            if 'seo_audit' in analysis_data:
                analysis.seo_audit = analysis_data['seo_audit']
            
            analysis.updated_at = datetime.utcnow()
            self.db.commit()
            logger.info(f"Updated content for analysis {analysis_id}")
            return True
            
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Error updating analysis {analysis_id}: {str(e)}")
            return False

    def save_error_analysis(self, session_id: int, website_url: str, error_message: str) -> Optional[int]:
        """
        Save analysis record with error status.
        
        Args:
            session_id: Onboarding session ID
            website_url: Website URL
            error_message: Error message
            
        Returns:
            Analysis ID if successful, None otherwise
        """
        try:
            analysis = WebsiteAnalysis(
                session_id=session_id,
                website_url=website_url,
                status='failed',
                error_message=error_message
            )
            
            self.db.add(analysis)
            self.db.commit()
            logger.info(f"Saved error analysis for URL: {website_url}")
            return analysis.id
            
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Error saving error analysis: {str(e)}")
            return None

    def update_analysis_content(self, analysis_id: int, analysis_data: Dict[str, Any]) -> bool:
        """
        Update specific content fields of an existing analysis.
        
        Args:
            analysis_id: Analysis ID to update
            analysis_data: Dictionary containing fields to update (writing_style, etc.)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            analysis = self.db.query(WebsiteAnalysis).get(analysis_id)
            if not analysis:
                logger.warning(f"Analysis {analysis_id} not found for update")
                return False

            # Update fields if present in data
            if 'writing_style' in analysis_data:
                analysis.writing_style = analysis_data['writing_style']
            if 'content_characteristics' in analysis_data:
                analysis.content_characteristics = analysis_data['content_characteristics']
            if 'target_audience' in analysis_data:
                analysis.target_audience = analysis_data['target_audience']
            if 'content_type' in analysis_data:
                analysis.content_type = analysis_data['content_type']
            if 'recommended_settings' in analysis_data:
                analysis.recommended_settings = analysis_data['recommended_settings']
            
            # Optional fields
            if 'brand_analysis' in analysis_data and hasattr(analysis, 'brand_analysis'):
                analysis.brand_analysis = analysis_data['brand_analysis']
            if 'content_strategy_insights' in analysis_data and hasattr(analysis, 'content_strategy_insights'):
                analysis.content_strategy_insights = analysis_data['content_strategy_insights']
                
            # Update style_guidelines if provided
            if 'style_guidelines' in analysis_data:
                analysis.style_guidelines = analysis_data['style_guidelines']
            
            # Update SEO audit if provided
            if 'seo_audit' in analysis_data:
                analysis.seo_audit = analysis_data['seo_audit']
            
            analysis.updated_at = datetime.utcnow()
            self.db.commit()
            logger.info(f"Updated content for analysis {analysis_id}")
            return True
            
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Error updating analysis {analysis_id}: {str(e)}")
            return False
 