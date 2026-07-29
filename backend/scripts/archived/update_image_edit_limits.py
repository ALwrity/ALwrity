"""
Script to update existing subscription plans with image_edit_calls_limit values.

This script updates the SubscriptionPlan table to set image_edit_calls_limit
for plans that were created before this column was added.

Limits:
- Free: 10 image editing calls/month
- Basic: 30 image editing calls/month
- Pro: 100 image editing calls/month
- Enterprise: 0 (unlimited)
"""

import sys
import os
from pathlib import Path
from datetime import datetime, timezone

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from loguru import logger

from models.subscription_models import SubscriptionPlan, SubscriptionTier
from services.database import DATABASE_URL

def update_image_edit_limits():
    """Update existing subscription plans with image_edit_calls_limit values."""
    
    try:
        # Create engine
        engine = create_engine(DATABASE_URL, echo=False)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        try:
            # Ensure schema columns exist
            from services.subscription.schema_utils import ensure_subscription_plan_columns
            ensure_subscription_plan_columns(db)
            
            # Define limits for each tier
            limits_by_tier = {
                SubscriptionTier.FREE: 10,
                SubscriptionTier.BASIC: 30,
                SubscriptionTier.PRO: 100,
                SubscriptionTier.ENTERPRISE: 0,  # Unlimited
            }
            
            updated_count = 0
            
            # Update each plan
            for tier, limit in limits_by_tier.items():
                plans = db.query(SubscriptionPlan).filter(
                    SubscriptionPlan.tier == tier,
                    SubscriptionPlan.is_active == True
                ).all()
                
                for plan in plans:
                    current_limit = getattr(plan, 'image_edit_calls_limit', 0) or 0
                    
                    # Only update if limit is 0 (not set) or if it's different
                    if current_limit != limit:
                        setattr(plan, 'image_edit_calls_limit', limit)
                        plan.updated_at = datetime.now(timezone.utc)
                        updated_count += 1
                        logger.info(f"Updated {plan.name} plan ({tier.value}): image_edit_calls_limit = {current_limit} -> {limit}")
                    else:
                        logger.debug(f"Plan {plan.name} ({tier.value}) already has image_edit_calls_limit = {limit}")
            
            # Commit changes
            db.commit()
            
            if updated_count > 0:
                logger.info(f"✅ Successfully updated {updated_count} subscription plan(s) with image_edit_calls_limit")
            else:
                logger.info("✅ All subscription plans already have correct image_edit_calls_limit values")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error updating image_edit_limits: {e}")
            db.rollback()
            raise
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"❌ Error creating database connection: {e}")
        raise

if __name__ == "__main__":
    logger.info("🔄 Updating subscription plans with image_edit_calls_limit...")
    success = update_image_edit_limits()
    if success:
        logger.info("🎉 Image edit limits update completed successfully!")
    else:
        logger.error("❌ Image edit limits update failed")
        sys.exit(1)

