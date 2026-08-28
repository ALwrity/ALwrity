"""
Data processing utilities for content strategy operations.
Provides functions for transforming onboarding data into strategy fields,
managing data sources, and processing various data types.
"""

import logging
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
from sqlalchemy.orm import Session

from models.onboarding import OnboardingSession, WebsiteAnalysis, ResearchPreferences

logger = logging.getLogger(__name__)


class DataProcessorService:
    """Service for processing and transforming data for content strategy operations."""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    async def get_onboarding_data(self, user_id: str) -> Dict[str, Any]:
        """
        Get comprehensive onboarding data for intelligent auto-population via AutoFillService.
        
        Args:
            user_id: The user ID to get onboarding data for
            
        Returns:
            Dictionary containing comprehensive onboarding data
        """
        try:
            from services.database import get_db_session
            from ..autofill import AutoFillService
            temp_db = get_db_session()
            try:
                service = AutoFillService(temp_db)
                # Use generate() method - get_autofill() does not exist
                payload = await service.generate(user_id)
                self.logger.info(f"Retrieved comprehensive onboarding data for user {user_id}")
                return payload
            except Exception as e:
                self.logger.error(f"Error getting onboarding data: {str(e)}")
                raise
            finally:
                temp_db.close()
        except Exception as e:
            self.logger.error(f"Error getting onboarding data: {str(e)}")
            raise
    
    def transform_onboarding_data_to_fields(self, processed_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform processed onboarding data into field-specific format for frontend.
        
        Args:
            processed_data: Dictionary containing processed onboarding data
            
        Returns:
            Dictionary with field-specific data for strategy builder
        """
        fields = {}
        
        website_data = processed_data.get('website_analysis', {})
        research_data = processed_data.get('research_preferences', {})
        api_data = processed_data.get('api_keys_data', {})
        session_data = processed_data.get('onboarding_session', {})
        
        # Business Context Fields
        if 'content_goals' in website_data and website_data.get('content_goals'):
            fields['business_objectives'] = {
                'value': website_data.get('content_goals'),
                'source': 'website_analysis',
                'confidence': website_data.get('confidence_level')
            }
        
        # Prefer explicit target_metrics; otherwise derive from performance_metrics
        if website_data.get('target_metrics'):
            fields['target_metrics'] = {
                'value': website_data.get('target_metrics'),
                'source': 'website_analysis',
                'confidence': website_data.get('confidence_level')
            }
        elif website_data.get('performance_metrics'):
            fields['target_metrics'] = {
                'value': website_data.get('performance_metrics'),
                'source': 'website_analysis',
                'confidence': website_data.get('confidence_level')
            }
        
        # Content budget: website data preferred, else onboarding session budget
        if website_data.get('content_budget') is not None:
            fields['content_budget'] = {
                'value': website_data.get('content_budget'),
                'source': 'website_analysis',
                'confidence': website_data.get('confidence_level')
            }
        elif isinstance(session_data, dict) and session_data.get('budget') is not None:
            fields['content_budget'] = {
                'value': session_data.get('budget'),
                'source': 'onboarding_session',
                'confidence': 0.7
            }
        
        # Team size: website data preferred, else onboarding session team_size
        if website_data.get('team_size') is not None:
            fields['team_size'] = {
                'value': website_data.get('team_size'),
                'source': 'website_analysis',
                'confidence': website_data.get('confidence_level')
            }
        elif isinstance(session_data, dict) and session_data.get('team_size') is not None:
            fields['team_size'] = {
                'value': session_data.get('team_size'),
                'source': 'onboarding_session',
                'confidence': 0.7
            }
        
        # Implementation timeline: website data preferred, else onboarding session timeline
        if website_data.get('implementation_timeline'):
            fields['implementation_timeline'] = {
                'value': website_data.get('implementation_timeline'),
                'source': 'website_analysis',
                'confidence': website_data.get('confidence_level')
            }
        elif isinstance(session_data, dict) and session_data.get('timeline'):
            fields['implementation_timeline'] = {
                'value': session_data.get('timeline'),
                'source': 'onboarding_session',
                'confidence': 0.7
            }
        
        # Market share: explicit if present; otherwise derive rough share from performance metrics if available
        if website_data.get('market_share'):
            fields['market_share'] = {
                'value': website_data.get('market_share'),
                'source': 'website_analysis',
                'confidence': website_data.get('confidence_level')
            }
        elif website_data.get('performance_metrics'):
            fields['market_share'] = {
                'value': website_data.get('performance_metrics').get('estimated_market_share', None),
                'source': 'website_analysis',
                'confidence': website_data.get('confidence_level')
            }
        
        fields['performance_metrics'] = {
            'value': website_data.get('performance_metrics', {}),
            'source': 'website_analysis',
            'confidence': website_data.get('confidence_level', 0.8)
        }
        
        # Audience Intelligence Fields
        # Extract audience data from research_data structure
        audience_research = research_data.get('audience_research', {})
        content_prefs = research_data.get('content_preferences', {})
        
        fields['content_preferences'] = {
            'value': content_prefs,
            'source': 'research_preferences',
            'confidence': research_data.get('confidence_level', 0.8)
        }
        
        fields['consumption_patterns'] = {
            'value': audience_research.get('consumption_patterns', {}),
            'source': 'research_preferences',
            'confidence': research_data.get('confidence_level', 0.8)
        }
        
        fields['audience_pain_points'] = {
            'value': audience_research.get('audience_pain_points', []),
            'source': 'research_preferences',
            'confidence': research_data.get('confidence_level', 0.8)
        }
        
        fields['buying_journey'] = {
            'value': audience_research.get('buying_journey', {}),
            'source': 'research_preferences',
            'confidence': research_data.get('confidence_level', 0.8)
        }
        
        fields['seasonal_trends'] = {
            'value': research_data.get('seasonal_trends', []),
            'source': 'research_preferences',
            'confidence': research_data.get('confidence_level', 0.7)
        }
        
        fields['engagement_metrics'] = {
            'value': website_data.get('performance_metrics', {}),
            'source': 'website_analysis',
            'confidence': website_data.get('confidence_level', 0.8)
        }
        
        # Competitive Intelligence Fields
        # Extract competitors from competitor_analysis list in processed_data
        competitors_list = processed_data.get('competitor_analysis', [])
        competitor_names = []
        
        if competitors_list:
            for comp in competitors_list:
                # Try to get domain or title, fallback to URL
                name = comp.get('competitor_domain') or comp.get('domain') or comp.get('title') or comp.get('competitor_url') or comp.get('url')
                if name:
                    competitor_names.append(name)
        
        # Fallback to website_analysis competitors if available (legacy/manual entry)
        if not competitor_names and website_data.get('competitors'):
            competitor_names = website_data.get('competitors')
            
        fields['top_competitors'] = {
            'value': competitor_names if competitor_names else [
                'Competitor A - Industry Leader',
                'Competitor B - Emerging Player', 
                'Competitor C - Niche Specialist'
            ],
            'source': 'competitor_analysis' if competitors_list else ('website_analysis' if website_data.get('competitors') else 'default'),
            'confidence': 0.9 if competitors_list else (website_data.get('confidence_level', 0.8) if website_data.get('competitors') else 0.3)
        }
        
        fields['competitor_content_strategies'] = {
            'value': ['Educational content', 'Case studies', 'Thought leadership'],
            'source': 'website_analysis',
            'confidence': website_data.get('confidence_level', 0.7)
        }
        
        fields['market_gaps'] = {
            'value': website_data.get('market_gaps', []),
            'source': 'website_analysis',
            'confidence': website_data.get('confidence_level', 0.8)
        }
        
        fields['industry_trends'] = {
            'value': ['Digital transformation', 'AI/ML adoption', 'Remote work'],
            'source': 'website_analysis',
            'confidence': website_data.get('confidence_level', 0.8)
        }
        
        fields['emerging_trends'] = {
            'value': ['Voice search optimization', 'Video content', 'Interactive content'],
            'source': 'website_analysis',
            'confidence': website_data.get('confidence_level', 0.7)
        }
        
        # Content Strategy Fields
        fields['preferred_formats'] = {
            'value': content_prefs.get('preferred_formats', [
                'Blog posts', 'Whitepapers', 'Webinars', 'Case studies', 'Videos'
            ]),
            'source': 'research_preferences',
            'confidence': research_data.get('confidence_level', 0.8)
        }
        
        fields['content_mix'] = {
            'value': {
                'blog_posts': 40,
                'whitepapers': 20,
                'webinars': 15,
                'case_studies': 15,
                'videos': 10
            },
            'source': 'research_preferences',
            'confidence': research_data.get('confidence_level', 0.8)
        }
        
        fields['content_frequency'] = {
            'value': 'Weekly',
            'source': 'research_preferences',
            'confidence': research_data.get('confidence_level', 0.8)
        }
        
        fields['optimal_timing'] = {
            'value': {
                'best_days': ['Tuesday', 'Wednesday', 'Thursday'],
                'best_times': ['9:00 AM', '1:00 PM', '3:00 PM']
            },
            'source': 'research_preferences',
            'confidence': research_data.get('confidence_level', 0.7)
        }
        
        fields['quality_metrics'] = {
            'value': {
                'readability_score': 8.5,
                'engagement_target': 5.0,
                'conversion_target': 2.0
            },
            'source': 'research_preferences',
            'confidence': research_data.get('confidence_level', 0.8)
        }
        
        fields['editorial_guidelines'] = {
            'value': {
                'tone': content_prefs.get('content_style', ['Professional', 'Educational']),
                'length': content_prefs.get('content_length', 'Medium (1000-2000 words)'),
                'formatting': ['Use headers', 'Include visuals', 'Add CTAs']
            },
            'source': 'research_preferences',
            'confidence': research_data.get('confidence_level', 0.8)
        }
        
        fields['brand_voice'] = {
            'value': {
                'tone': 'Professional yet approachable',
                'style': 'Educational and authoritative',
                'personality': 'Expert, helpful, trustworthy'
            },
            'source': 'research_preferences',
            'confidence': research_data.get('confidence_level', 0.8)
        }
        
        # Performance & Analytics Fields
        fields['traffic_sources'] = {
            'value': website_data.get('traffic_sources', {}),
            'source': 'website_analysis',
            'confidence': website_data.get('confidence_level', 0.8)
        }
        
        fields['conversion_rates'] = {
            'value': {
                'overall': website_data.get('performance_metrics', {}).get('conversion_rate', 3.2),
                'blog': 2.5,
                'landing_pages': 4.0,
                'email': 5.5
            },
            'source': 'website_analysis',
            'confidence': website_data.get('confidence_level', 0.8)
        }
        
        fields['content_roi_targets'] = {
            'value': {
                'target_roi': 300,
                'cost_per_lead': 50,
                'lifetime_value': 500
            },
            'source': 'website_analysis',
            'confidence': website_data.get('confidence_level', 0.7)
        }
        
        fields['ab_testing_capabilities'] = {
            'value': True,
            'source': 'api_keys_data',
            'confidence': api_data.get('confidence_level', 0.8)
        }
        
        return fields
    
    def get_data_sources(self, processed_data: Dict[str, Any]) -> Dict[str, str]:
        """
        Get data sources for each field.
        
        Args:
            processed_data: Dictionary containing processed data
            
        Returns:
            Dictionary mapping field names to their data sources
        """
        sources = {}
        
        # Map fields to their data sources
        website_fields = ['business_objectives', 'target_metrics', 'content_budget', 'team_size', 
                         'implementation_timeline', 'market_share', 'competitive_position', 
                         'performance_metrics', 'engagement_metrics', 'top_competitors', 
                         'competitor_content_strategies', 'market_gaps', 'industry_trends', 
                         'emerging_trends', 'traffic_sources', 'conversion_rates', 'content_roi_targets']
        
        research_fields = ['content_preferences', 'consumption_patterns', 'audience_pain_points', 
                          'buying_journey', 'seasonal_trends', 'preferred_formats', 'content_mix', 
                          'content_frequency', 'optimal_timing', 'quality_metrics', 'editorial_guidelines', 
                          'brand_voice']
        
        api_fields = ['ab_testing_capabilities']
        
        for field in website_fields:
            sources[field] = 'website_analysis'
        
        for field in research_fields:
            sources[field] = 'research_preferences'
        
        for field in api_fields:
            sources[field] = 'api_keys_data'
        
        return sources
    
    def get_detailed_input_data_points(self, processed_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Get detailed input data points for transparency.
        
        Args:
            processed_data: Dictionary containing processed data
            
        Returns:
            Dictionary with detailed data points
        """
        return {
            'website_analysis': {
                'total_fields': len(processed_data.get('website_analysis', {})),
                'confidence_level': processed_data.get('website_analysis', {}).get('confidence_level', 0.8),
                'data_freshness': processed_data.get('website_analysis', {}).get('data_freshness', 'recent')
            },
            'research_preferences': {
                'total_fields': len(processed_data.get('research_preferences', {})),
                'confidence_level': processed_data.get('research_preferences', {}).get('confidence_level', 0.8),
                'data_freshness': processed_data.get('research_preferences', {}).get('data_freshness', 'recent')
            },
            'api_keys_data': {
                'total_fields': len(processed_data.get('api_keys_data', {})),
                'confidence_level': processed_data.get('api_keys_data', {}).get('confidence_level', 0.8),
                'data_freshness': processed_data.get('api_keys_data', {}).get('data_freshness', 'recent')
            }
        }
    
    async def get_website_analysis_data(self, user_id: int) -> Dict[str, Any]:
        """
        Get website analysis data from onboarding.
        
        Args:
            user_id: The user ID to get data for
            
        Returns:
            Dictionary with website analysis data
        """
        try:
            raise RuntimeError("Website analysis data retrieval not implemented. Real data required.")
        except Exception as e:
            self.logger.error(f"Error getting website analysis data: {str(e)}")
            raise
    
    async def get_research_preferences_data(self, user_id: int) -> Dict[str, Any]:
        """
        Get research preferences data from onboarding.
        
        Args:
            user_id: The user ID to get data for
            
        Returns:
            Dictionary with research preferences data
        """
        try:
            raise RuntimeError("Research preferences data retrieval not implemented. Real data required.")
        except Exception as e:
            self.logger.error(f"Error getting research preferences data: {str(e)}")
            raise
    
    async def get_api_keys_data(self, user_id: int) -> Dict[str, Any]:
        """
        Get API keys and external data from onboarding.
        
        Args:
            user_id: The user ID to get data for
            
        Returns:
            Dictionary with API keys data
        """
        try:
            raise RuntimeError("API keys/external data retrieval not implemented. Real data required.")
        except Exception as e:
            self.logger.error(f"Error getting API keys data: {str(e)}")
            raise
    
    async def process_website_analysis(self, website_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process website analysis data (deprecated).
        
        Args:
            website_data: Raw website analysis data
            
        Returns:
            Processed website analysis data
        """
        raise RuntimeError("Deprecated: use AutoFillService normalizers")
    
    async def process_research_preferences(self, research_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process research preferences data (deprecated).
        
        Args:
            research_data: Raw research preferences data
            
        Returns:
            Processed research preferences data
        """
        raise RuntimeError("Deprecated: use AutoFillService normalizers")
    
    async def process_api_keys_data(self, api_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process API keys data (deprecated).
        
        Args:
            api_data: Raw API keys data
            
        Returns:
            Processed API keys data
        """
        raise RuntimeError("Deprecated: use AutoFillService normalizers")


# Standalone functions for backward compatibility
async def get_onboarding_data(user_id: str) -> Dict[str, Any]:
    """Get comprehensive onboarding data for intelligent auto-population via AutoFillService.
    
    Args:
        user_id: Clerk user ID (string format, e.g., 'user_xxx')
    """
    processor = DataProcessorService()
    return await processor.get_onboarding_data(user_id)


def transform_onboarding_data_to_fields(processed_data: Dict[str, Any]) -> Dict[str, Any]:
    """Transform processed onboarding data into field-specific format for frontend."""
    processor = DataProcessorService()
    return processor.transform_onboarding_data_to_fields(processed_data)


def get_data_sources(processed_data: Dict[str, Any]) -> Dict[str, str]:
    """Get data sources for each field."""
    processor = DataProcessorService()
    return processor.get_data_sources(processed_data)


def get_detailed_input_data_points(processed_data: Dict[str, Any]) -> Dict[str, Any]:
    """Get detailed input data points for transparency."""
    processor = DataProcessorService()
    return processor.get_detailed_input_data_points(processed_data)


async def get_website_analysis_data(user_id: int) -> Dict[str, Any]:
    """Get website analysis data from onboarding."""
    processor = DataProcessorService()
    return await processor.get_website_analysis_data(user_id)


async def get_research_preferences_data(user_id: int) -> Dict[str, Any]:
    """Get research preferences data from onboarding."""
    processor = DataProcessorService()
    return await processor.get_research_preferences_data(user_id)


async def get_api_keys_data(user_id: int) -> Dict[str, Any]:
    """Get API keys and external data from onboarding."""
    processor = DataProcessorService()
    return await processor.get_api_keys_data(user_id) 