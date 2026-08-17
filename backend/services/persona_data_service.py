"""
Persona Data Service
Direct service for working with PersonaData table from onboarding.
Leverages the rich JSON structure for better content generation.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
from loguru import logger
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from services.database import get_db_session
from models.onboarding import PersonaData, OnboardingSession


class PersonaDataService:
    """Service for working directly with PersonaData table."""
    
    def __init__(self, db_session: Optional[Session] = None):
        self.db = db_session
    
    def get_user_persona_data(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get complete persona data for a user from PersonaData table."""
        db = self.db
        should_close = False
        
        try:
            if not db:
                db = get_db_session(user_id)
                should_close = True
            
            if not db:
                logger.error(f"Could not get database session for user {user_id}")
                return None
                
            # Get onboarding session for user
            session = db.query(OnboardingSession).filter(
                OnboardingSession.user_id == user_id
            ).first()
            
            if not session:
                logger.warning(f"No onboarding session found for user {user_id}")
                return None
            
            # Get persona data
            persona_data = db.query(PersonaData).filter(
                PersonaData.session_id == session.id
            ).first()
            
            if not persona_data:
                logger.warning(f"No persona data found for user {user_id}")
                return None
            
            return persona_data.to_dict()
            
        except Exception as e:
            logger.error(f"Error getting persona data for user {user_id}: {str(e)}")
            return None
        finally:
            if should_close and db:
                db.close()
    
    def get_platform_persona(self, user_id: str, platform: str) -> Optional[Dict[str, Any]]:
        """Get platform-specific persona data for a user."""
        try:
            persona_data = self.get_user_persona_data(user_id)
            if not persona_data:
                return None
            
            platform_personas = persona_data.get('platform_personas', {})
            platform_data = platform_personas.get(platform)
            
            if not platform_data:
                logger.warning(f"No {platform} persona found for user {user_id}")
                return None
            
            # Return rich platform-specific data
            return {
                "platform": platform,
                "platform_persona": platform_data,
                "core_persona": persona_data.get('core_persona', {}),
                "quality_metrics": persona_data.get('quality_metrics', {}),
                "selected_platforms": persona_data.get('selected_platforms', []),
                "created_at": persona_data.get('created_at'),
                "updated_at": persona_data.get('updated_at')
            }
            
        except Exception as e:
            logger.error(f"Error getting {platform} persona for user {user_id}: {str(e)}")
            return None
    
    def get_all_platform_personas(self, user_id: str) -> Dict[str, Any]:
        """Get all platform personas for a user."""
        try:
            persona_data = self.get_user_persona_data(user_id)
            if not persona_data:
                return {}
            
            platform_personas = persona_data.get('platform_personas', {})
            
            # Return structured data for all platforms
            result = {}
            for platform, platform_data in platform_personas.items():
                if isinstance(platform_data, dict) and 'error' not in platform_data:
                    result[platform] = {
                        "platform": platform,
                        "platform_persona": platform_data,
                        "core_persona": persona_data.get('core_persona', {}),
                        "quality_metrics": persona_data.get('quality_metrics', {}),
                        "created_at": persona_data.get('created_at'),
                        "updated_at": persona_data.get('updated_at')
                    }
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting all platform personas for user {user_id}: {str(e)}")
            return {}
    
    def get_core_persona(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get core persona data for a user."""
        try:
            persona_data = self.get_user_persona_data(user_id)
            if not persona_data:
                return None
            
            return {
                "core_persona": persona_data.get('core_persona', {}),
                "quality_metrics": persona_data.get('quality_metrics', {}),
                "selected_platforms": persona_data.get('selected_platforms', []),
                "created_at": persona_data.get('created_at'),
                "updated_at": persona_data.get('updated_at')
            }
            
        except Exception as e:
            logger.error(f"Error getting core persona for user {user_id}: {str(e)}")
            return None
    
    def get_persona_quality_metrics(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get quality metrics for a user's persona."""
        try:
            persona_data = self.get_user_persona_data(user_id)
            if not persona_data:
                return None
            
            return persona_data.get('quality_metrics', {})
            
        except Exception as e:
            logger.error(f"Error getting quality metrics for user {user_id}: {str(e)}")
            return None
    
    def update_platform_persona(self, user_id: str, platform: str, updates: Dict[str, Any]) -> bool:
        """Update platform-specific persona data."""
        db = self.db
        should_close = False
        
        try:
            if not db:
                db = get_db_session(user_id)
                should_close = True
            
            if not db:
                logger.error(f"Could not get database session for user {user_id}")
                return False

            # Get onboarding session for user
            session = db.query(OnboardingSession).filter(
                OnboardingSession.user_id == user_id
            ).first()
            
            if not session:
                logger.error(f"No onboarding session found for user {user_id}")
                return False
            
            # Get persona data
            persona_data = db.query(PersonaData).filter(
                PersonaData.session_id == session.id
            ).first()
            
            if not persona_data:
                logger.error(f"No persona data found for user {user_id}")
                return False
            
            # Update platform-specific data
            # NOTE: dict() + flag_modified are REQUIRED (see save_platform_persona
            # below for the full explanation) so SQLAlchemy actually persists the
            # JSON mutation instead of silently dropping it.
            platform_personas = dict(persona_data.platform_personas or {})
            if platform in platform_personas:
                platform_personas[platform].update(updates)
                persona_data.platform_personas = platform_personas
                flag_modified(persona_data, "platform_personas")
                persona_data.updated_at = datetime.utcnow()
                
                db.commit()
                logger.info(f"Updated {platform} persona for user {user_id}")
                return True
            else:
                logger.warning(f"Platform {platform} not found for user {user_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error updating {platform} persona for user {user_id}: {str(e)}")
            if db:
                db.rollback()
            return False
        finally:
            if should_close and db:
                db.close()
    
    def save_platform_persona(self, user_id: str, platform: str, platform_data: Dict[str, Any]) -> bool:
        """Save or create platform-specific persona data (creates if doesn't exist)."""
        db = self.db
        should_close = False
        
        try:
            if not db:
                db = get_db_session(user_id)
                should_close = True
            
            if not db:
                logger.error(f"Could not get database session for user {user_id}")
                return False

            # Get onboarding session
            session = db.query(OnboardingSession).filter(
                OnboardingSession.user_id == user_id
            ).first()
            
            if not session:
                logger.error(f"No onboarding session found for user {user_id}")
                return False
            
            # Get persona data
            persona_data = db.query(PersonaData).filter(
                PersonaData.session_id == session.id
            ).first()
            
            if not persona_data:
                logger.error(f"No persona data found for user {user_id}")
                return False
            
            # Update or create platform persona
            #
            # IMPORTANT — SQLAlchemy JSON mutation-detection bug:
            # `persona_data.platform_personas` is a plain `Column(JSON)`. If we mutate
            # the loaded dict IN PLACE and reassign the *same* object, the ORM's
            # history check compares old vs new with `==` (operator.eq), sees the
            # identical object, and skips the UPDATE entirely. This caused on-demand
            # "Generate Now" personas (YouTube/podcast/etc.) to silently vanish after
            # a page reload because the write never hit the DB.
            # Two defenses, both REQUIRED:
            #   1. `dict(...)` copies the old dict FIRST, so the reassigned object
            #      differs from the committed one and the change is detected.
            #   2. `flag_modified(...)` force-marks the JSON column dirty regardless
            #      of the `==` comparison.
            # Do NOT "simplify" this back to in-place mutation — that reopens the bug.
            platform_personas = dict(persona_data.platform_personas or {})
            platform_personas[platform] = platform_data  # Create or overwrite
            persona_data.platform_personas = platform_personas
            flag_modified(persona_data, "platform_personas")
            persona_data.updated_at = datetime.utcnow()
            
            db.commit()
            logger.info(f"Saved {platform} persona for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving {platform} persona for user {user_id}: {str(e)}")
            if db:
                db.rollback()
            return False
        finally:
            if should_close and db:
                db.close()
    
    def get_supported_platforms(self, user_id: str) -> List[str]:
        """Get list of platforms for which personas exist."""
        try:
            persona_data = self.get_user_persona_data(user_id)
            if not persona_data:
                return []
            
            platform_personas = persona_data.get('platform_personas', {})
            return [platform for platform, data in platform_personas.items() 
                   if isinstance(data, dict) and 'error' not in data]
            
        except Exception as e:
            logger.error(f"Error getting supported platforms for user {user_id}: {str(e)}")
            return []
    
    def get_persona_summary(self, user_id: str) -> Dict[str, Any]:
        """Get a summary of persona data for a user."""
        try:
            persona_data = self.get_user_persona_data(user_id)
            if not persona_data:
                return {"error": "No persona data found"}
            
            platform_personas = persona_data.get('platform_personas', {})
            quality_metrics = persona_data.get('quality_metrics', {})
            
            return {
                "user_id": user_id,
                "has_core_persona": bool(persona_data.get('core_persona')),
                "platforms": list(platform_personas.keys()),
                "platform_count": len(platform_personas),
                "quality_score": quality_metrics.get('overall_score', 0),
                "selected_platforms": persona_data.get('selected_platforms', []),
                "created_at": persona_data.get('created_at'),
                "updated_at": persona_data.get('updated_at')
            }
            
        except Exception as e:
            logger.error(f"Error getting persona summary for user {user_id}: {str(e)}")
            return {"error": str(e)}
