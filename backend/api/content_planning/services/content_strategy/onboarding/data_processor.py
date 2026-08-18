"""
Onboarding Data Processor
Handles processing and transformation of onboarding data for strategic intelligence.
"""

import logging
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
from sqlalchemy.orm import Session

# Import database models
from models.onboarding import OnboardingSession, WebsiteAnalysis, ResearchPreferences

logger = logging.getLogger(__name__)

class OnboardingDataProcessor:
    """Processes and transforms onboarding data for strategic intelligence generation."""
    
    def __init__(self):
        pass
    
    async def process_onboarding_data(self, user_id: int, db: Session) -> Optional[Dict[str, Any]]:
        """Process onboarding data for a user and return structured data for strategic intelligence."""
        try:
            logger.info(f"Processing onboarding data for user {user_id}")
            
            # Get onboarding session
            onboarding_session = db.query(OnboardingSession).filter(
                OnboardingSession.user_id == user_id
            ).first()
            
            if not onboarding_session:
                logger.warning(f"No onboarding session found for user {user_id}")
                return None
            
            # Get website analysis data
            website_analysis = db.query(WebsiteAnalysis).filter(
                WebsiteAnalysis.session_id == onboarding_session.id
            ).first()
            
            # Get research preferences data
            research_preferences = db.query(ResearchPreferences).filter(
                ResearchPreferences.session_id == onboarding_session.id
            ).first()
            
            # Process each data type
            processed_data = {
                'website_analysis': await self._process_website_analysis(website_analysis),
                'research_preferences': await self._process_research_preferences(research_preferences),
                'session_data': self._process_session_data(onboarding_session)
            }
            
            # Transform into strategic intelligence format
            strategic_data = self._transform_to_strategic_format(processed_data)
            
            logger.info(f"Successfully processed onboarding data for user {user_id}")
            return strategic_data
            
        except Exception as e:
            logger.error(f"Error processing onboarding data for user {user_id}: {str(e)}")
            return None
    
    async def _process_website_analysis(self, website_analysis: Optional[WebsiteAnalysis]) -> Dict[str, Any]:
        """Process website analysis data."""
        if not website_analysis:
            return {}
        
        try:
            return {
                'website_url': getattr(website_analysis, 'website_url', ''),
                'industry': getattr(website_analysis, 'industry', 'Technology'),  # Default value if attribute doesn't exist
                'content_goals': getattr(website_analysis, 'content_goals', []),
                'performance_metrics': getattr(website_analysis, 'performance_metrics', {}),
                'traffic_sources': getattr(website_analysis, 'traffic_sources', []),
                'content_gaps': getattr(website_analysis, 'content_gaps', []),
                'topics': getattr(website_analysis, 'topics', []),
                'content_quality_score': getattr(website_analysis, 'content_quality_score', 0),
                'seo_opportunities': getattr(website_analysis, 'seo_opportunities', []),
                'competitors': getattr(website_analysis, 'competitors', []),
                'competitive_advantages': getattr(website_analysis, 'competitive_advantages', []),
                'market_gaps': getattr(website_analysis, 'market_gaps', []),
                'last_updated': website_analysis.updated_at.isoformat() if hasattr(website_analysis, 'updated_at') and website_analysis.updated_at else None
            }
        except Exception as e:
            logger.error(f"Error processing website analysis: {str(e)}")
            return {}
    
    async def _process_research_preferences(self, research_preferences: Optional[ResearchPreferences]) -> Dict[str, Any]:
        """Process research preferences data."""
        if not research_preferences:
            return {}
        
        try:
            return {
                'content_preferences': {
                    'preferred_formats': research_preferences.content_types,
                    'content_topics': research_preferences.research_topics,
                    'content_style': research_preferences.writing_style.get('tone', []) if research_preferences.writing_style else [],
                    'content_length': research_preferences.content_length,
                    'visual_preferences': research_preferences.visual_preferences
                },
                'audience_research': {
                    'target_audience': research_preferences.target_audience.get('demographics', []) if research_preferences.target_audience else [],
                    'audience_pain_points': research_preferences.target_audience.get('pain_points', []) if research_preferences.target_audience else [],
                    'buying_journey': research_preferences.target_audience.get('buying_journey', {}) if research_preferences.target_audience else {},
                    'consumption_patterns': research_preferences.target_audience.get('consumption_patterns', {}) if research_preferences.target_audience else {}
                },
                'research_goals': {
                    'primary_goals': research_preferences.research_topics,
                    'secondary_goals': research_preferences.content_types,
                    'success_metrics': research_preferences.success_metrics
                },
                'last_updated': research_preferences.updated_at.isoformat() if research_preferences.updated_at else None
            }
        except Exception as e:
            logger.error(f"Error processing research preferences: {str(e)}")
            return {}
    
    def _process_session_data(self, onboarding_session: OnboardingSession) -> Dict[str, Any]:
        """Process onboarding session data."""
        try:
            return {
                'session_id': getattr(onboarding_session, 'id', None),
                'user_id': getattr(onboarding_session, 'user_id', None),
                'created_at': onboarding_session.created_at.isoformat() if hasattr(onboarding_session, 'created_at') and onboarding_session.created_at else None,
                'updated_at': onboarding_session.updated_at.isoformat() if hasattr(onboarding_session, 'updated_at') and onboarding_session.updated_at else None,
                'completion_status': getattr(onboarding_session, 'completion_status', 'in_progress'),
                'session_data': getattr(onboarding_session, 'session_data', {}),
                'progress_percentage': getattr(onboarding_session, 'progress_percentage', 0),
                'last_activity': getattr(onboarding_session, 'last_activity', None)
            }
        except Exception as e:
            logger.error(f"Error processing session data: {str(e)}")
            return {}
    
    def _transform_to_strategic_format(self, processed_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform processed onboarding data into strategic intelligence format."""
        try:
            website_data = processed_data.get('website_analysis', {})
            research_data = processed_data.get('research_preferences', {})
            session_data = processed_data.get('session_data', {})
            
            # Return data in nested format that field transformation service expects
            return {
                'website_analysis': {
                    'content_goals': website_data.get('content_goals', []),
                    'performance_metrics': website_data.get('performance_metrics', {}),
                    'competitors': website_data.get('competitors', []),
                    'content_gaps': website_data.get('content_gaps', []),
                    'industry': website_data.get('industry', 'Technology'),
                    'target_audience': website_data.get('target_audience', {}),
                    'business_type': website_data.get('business_type', 'Technology')
                },
                'research_preferences': {
                    'content_types': research_data.get('content_preferences', {}).get('preferred_formats', []),
                    'research_topics': research_data.get('research_topics', []),
                    'performance_tracking': research_data.get('performance_tracking', []),
                    'competitor_analysis': research_data.get('competitor_analysis', []),
                    'target_audience': research_data.get('audience_research', {}).get('target_audience', {}),
                    'industry_focus': research_data.get('industry_focus', []),
                    'trend_analysis': research_data.get('trend_analysis', []),
                    'content_calendar': research_data.get('content_calendar', {})
                },
                'onboarding_session': {
                    'session_data': {
                        'budget': session_data.get('budget', 3000),
                        'team_size': session_data.get('team_size', 2),
                        'timeline': session_data.get('timeline', '3 months'),
                        'brand_voice': session_data.get('brand_voice', 'Professional yet approachable')
                    }
                }
            }
            
        except Exception as e:
            logger.error(f"Error transforming to strategic format: {str(e)}")
            return {}
    
    def calculate_data_quality_scores(self, processed_data: Dict[str, Any]) -> Dict[str, float]:
        """Calculate quality scores for each data source."""
        scores = {}
        
        for source, data in processed_data.items():
            if data and isinstance(data, dict):
                # Simple scoring based on data completeness
                total_fields = len(data)
                present_fields = len([v for v in data.values() if v is not None and v != {}])
                completeness = present_fields / total_fields if total_fields > 0 else 0.0
                scores[source] = completeness * 100
            else:
                scores[source] = 0.0
        
        return scores
    
    def calculate_confidence_levels(self, processed_data: Dict[str, Any]) -> Dict[str, float]:
        """Calculate confidence levels for processed data."""
        confidence_levels = {}
        
        # Base confidence on data source quality
        base_confidence = {
            'website_analysis': 0.8,
            'research_preferences': 0.7,
            'session_data': 0.9
        }
        
        for source, data in processed_data.items():
            if data and isinstance(data, dict):
                # Adjust confidence based on data completeness
                quality_score = self.calculate_data_quality_scores({source: data})[source] / 100
                base_conf = base_confidence.get(source, 0.5)
                confidence_levels[source] = base_conf * quality_score
            else:
                confidence_levels[source] = 0.0
        
        return confidence_levels
    
    def calculate_data_freshness(self, session_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate data freshness for onboarding data."""
        try:
            updated_at = session_data.get('updated_at')
            if not updated_at:
                return {'status': 'unknown', 'age_days': 'unknown'}
            
            # Convert string to datetime if needed
            if isinstance(updated_at, str):
                try:
                    updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
                except ValueError:
                    return {'status': 'unknown', 'age_days': 'unknown'}
            
            age_days = (datetime.utcnow() - updated_at).days
            
            if age_days <= 7:
                status = 'fresh'
            elif age_days <= 30:
                status = 'recent'
            elif age_days <= 90:
                status = 'aging'
            else:
                status = 'stale'
            
            return {
                'status': status,
                'age_days': age_days,
                'last_updated': updated_at.isoformat() if hasattr(updated_at, 'isoformat') else str(updated_at)
            }
            
        except Exception as e:
            logger.error(f"Error calculating data freshness: {str(e)}")
            return {'status': 'unknown', 'age_days': 'unknown'} 