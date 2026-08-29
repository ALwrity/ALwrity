"""
Verify current user data in the database
Check if data is being saved with Clerk user IDs
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from loguru import logger
from services.database import SessionLocal
from models.onboarding import OnboardingSession, WebsiteAnalysis, ResearchPreferences

def verify_user_data():
    """Check what user_id format is being used."""
    try:
        db = SessionLocal()
        
        logger.info("Checking onboarding_sessions table...")
        sessions = db.query(OnboardingSession).all()
        
        logger.info(f"Found {len(sessions)} sessions:")
        for session in sessions:
            logger.info(f"  Session ID: {session.id}")
            logger.info(f"  User ID: {session.user_id} (type: {type(session.user_id).__name__})")
            logger.info(f"  Current Step: {session.current_step}")
            logger.info(f"  Progress: {session.progress}%")
            
            # Check website analysis
            website = db.query(WebsiteAnalysis).filter(WebsiteAnalysis.session_id == session.id).first()
            if website:
                logger.info(f"  Website Analysis: {website.website_url}")
            else:
                logger.info(f"  Website Analysis: None")
            
            # Check research preferences
            research = db.query(ResearchPreferences).filter(ResearchPreferences.session_id == session.id).first()
            if research:
                logger.info(f"  Research Preferences: Found")
            else:
                logger.info(f"  Research Preferences: None")
            
            logger.info("")
        
        if len(sessions) == 0:
            logger.warning("⚠️ No sessions found in database!")
            logger.info("This means either:")
            logger.info("  1. No onboarding data has been saved yet")
            logger.info("  2. Data was cleared during migration")
            logger.info("\nYou need to go through onboarding steps 1-5 again to save data with Clerk user ID")
        
        return True
        
    except Exception as e:
        logger.error(f"Error verifying data: {e}")
        return False
    finally:
        if db:
            db.close()

if __name__ == "__main__":
    logger.info("="*60)
    logger.info("VERIFY CURRENT USER DATA IN DATABASE")
    logger.info("="*60)
    
    verify_user_data()

