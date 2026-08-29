"""
Update Basic Tier Limits and OSS Model Pricing
Updates existing subscription plans and pricing without recreating tables.
"""

import sys
import os
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from loguru import logger
import traceback

from services.database import DATABASE_URL
from services.subscription.pricing_service import PricingService

def update_pricing_and_plans():
    """Update pricing and plans without recreating tables."""
    
    try:
        # Create engine
        engine = create_engine(DATABASE_URL, echo=False)
        
        # Create session
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        try:
            # Initialize pricing and plans (will update existing)
            pricing_service = PricingService(db)
            
            logger.info("🔄 Updating default API pricing (including OSS models)...")
            pricing_service.initialize_default_pricing()
            logger.info("✅ Default API pricing updated")
            
            logger.info("🔄 Updating default subscription plans (Basic tier limits)...")
            pricing_service.initialize_default_plans()
            logger.info("✅ Default subscription plans updated")
            
            logger.info("🎉 Pricing and plans update completed successfully!")
            
        except Exception as e:
            logger.error(f"❌ Error updating pricing/plans: {e}")
            logger.error(traceback.format_exc())
            db.rollback()
            raise
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        logger.error(traceback.format_exc())
        raise

if __name__ == "__main__":
    logger.info("🚀 Updating Basic Tier Limits and OSS Model Pricing...")
    
    try:
        update_pricing_and_plans()
        logger.info("✅ Update completed successfully!")
        
    except KeyboardInterrupt:
        logger.info("Update cancelled by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"❌ Update failed: {e}")
        sys.exit(1)
