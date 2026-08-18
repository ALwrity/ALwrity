"""
User Data Service
Handles fetching user data from the onboarding database.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from loguru import logger

from models.onboarding import OnboardingSession, WebsiteAnalysis, ResearchPreferences
from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService

class UserDataService:
    """Service for managing user data from onboarding."""
    
    def __init__(self, db_session: Session):
        self.db = db_session
        self.integration_service = OnboardingDataIntegrationService()
    
    def get_user_website_url(self, user_id: str) -> Optional[str]:
        """
        Get the website URL for a user from their onboarding data.
        
        Args:
            user_id: The user ID
            
        Returns:
            Website URL or None if not found
        """
        try:
            # Use SSOT integration service
            integrated_data = self.integration_service.get_integrated_data_sync(user_id, self.db)
            website_analysis = integrated_data.get('website_analysis', {})
            
            if not website_analysis:
                logger.warning(f"No website analysis found for user {user_id}")
                return None
            
            url = website_analysis.get('website_url')
            if url:
                logger.info(f"Found website URL: {url}")
                return url
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting user website URL: {str(e)}")
            return None
    
    def get_user_onboarding_data(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get comprehensive onboarding data for a user.
        
        Args:
            user_id: The user ID
            
        Returns:
            Dictionary with onboarding data or None if not found
        """
        try:
            # Use SSOT integration service
            integrated_data = self.integration_service.get_integrated_data_sync(user_id, self.db)
            
            if not integrated_data.get('onboarding_session'):
                return None
            
            # Map SSOT data to legacy format expected by consumers
            return {
                'session': integrated_data.get('onboarding_session'),
                'website_analysis': integrated_data.get('website_analysis'),
                'research_preferences': integrated_data.get('research_preferences')
            }
            
        except Exception as e:
            logger.error(f"Error getting user onboarding data: {str(e)}")
            return None
    
    def get_user_website_analysis(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get website analysis data for a user.
        
        Args:
            user_id: The user ID
            
        Returns:
            Website analysis data or None if not found
        """
        try:
            # Use SSOT integration service
            integrated_data = self.integration_service.get_integrated_data_sync(user_id, self.db)
            return integrated_data.get('website_analysis')
            
        except Exception as e:
            logger.error(f"Error getting user website analysis: {e}")
            return None 
    
    def save_website_extraction(self, user_id: str, extraction_data: Dict[str, Any]) -> bool:
        """
        Save website extraction data for future use.
        
        Args:
            user_id: The user ID
            extraction_data: Website extraction data (title, summary, highlights, url, subpages)
            
        Returns:
            True if saved successfully
        """
        try:
            # Clean data - remove images/favicon
            clean_data = {
                k: v for k, v in extraction_data.items()
                if k not in ('image', 'favicon')
            }
            clean_data['saved_at'] = datetime.now().isoformat()
            
            # Find or create user session for storing
            onboarding = self.db.query(OnboardingSession).filter(
                OnboardingSession.user_id == user_id
            ).first()
            
            if not onboarding:
                # Create new session if not exists
                onboarding = OnboardingSession(user_id=user_id)
                self.db.add(onboarding)
            
            # Try to update website_analysis field
            # The field might be JSON in the model
            try:
                existing = onboarding.website_analysis
                if isinstance(existing, dict):
                    existing.update(clean_data)
                    onboarding.website_analysis = existing
                else:
                    onboarding.website_analysis = clean_data
            except Exception as ex:
                logger.warning(f"Could not update website_analysis: {ex}")
                onboarding.website_analysis = clean_data
            
            self.db.commit()
            logger.info(f"Saved website extraction for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving website extraction: {str(e)}")
            self.db.rollback()
            return False
    
    def get_website_extraction(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get saved website extraction data.
        
        Args:
            user_id: The user ID
            
        Returns:
            Website extraction data or None
        """
        try:
            onboarding = self.db.query(OnboardingSession).filter(
                OnboardingSession.user_id == user_id
            ).first()
            
            if not onboarding:
                return None
            
            extraction = onboarding.website_analysis
            if isinstance(extraction, dict):
                # Return clean data without internal fields
                return {
                    k: v for k, v in extraction.items()
                    if k not in ('saved_at', 'full_analysis', 'analysis_status')
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting website extraction: {str(e)}")
            return None 
