"""
Quick script to reset usage counters for Basic plan users.

This fixes the issue where plan limits were updated but old usage data remained.
Resets all usage counters (calls, tokens, images) to 0 for the current billing period.
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

from models.subscription_models import SubscriptionPlan, SubscriptionTier, UserSubscription, UsageSummary, UsageStatus
from services.database import DATABASE_URL
from services.subscription import PricingService

def reset_basic_plan_usage():
    """Reset usage counters for all Basic plan users."""
    
    try:
        engine = create_engine(DATABASE_URL, echo=False)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        try:
            # Find Basic plan
            basic_plan = db.query(SubscriptionPlan).filter(
                SubscriptionPlan.tier == SubscriptionTier.BASIC
            ).first()
            
            if not basic_plan:
                logger.error("❌ Basic plan not found in database!")
                return False
            
            # Get all Basic plan users
            user_subscriptions = db.query(UserSubscription).filter(
                UserSubscription.plan_id == basic_plan.id,
                UserSubscription.is_active == True
            ).all()
            
            logger.info(f"Found {len(user_subscriptions)} Basic plan user(s)")
            
            pricing_service = PricingService(db)
            reset_count = 0
            
            for sub in user_subscriptions:
                try:
                    # Get current billing period for this user
                    current_period = pricing_service.get_current_billing_period(sub.user_id) or datetime.now(timezone.utc).strftime("%Y-%m")
                    
                    # Find usage summary for current period
                    usage_summary = db.query(UsageSummary).filter(
                        UsageSummary.user_id == sub.user_id,
                        UsageSummary.billing_period == current_period
                    ).first()
                    
                    if usage_summary:
                        # Store old values for logging
                        old_gemini = usage_summary.gemini_calls or 0
                        old_mistral = usage_summary.mistral_calls or 0
                        old_tokens = (usage_summary.mistral_tokens or 0) + (usage_summary.gemini_tokens or 0)
                        old_images = usage_summary.stability_calls or 0
                        old_total_calls = usage_summary.total_calls or 0
                        old_total_tokens = usage_summary.total_tokens or 0
                        
                        # Reset all LLM provider counters
                        usage_summary.gemini_calls = 0
                        usage_summary.openai_calls = 0
                        usage_summary.anthropic_calls = 0
                        usage_summary.mistral_calls = 0
                        
                        # Reset all token counters
                        usage_summary.gemini_tokens = 0
                        usage_summary.openai_tokens = 0
                        usage_summary.anthropic_tokens = 0
                        usage_summary.mistral_tokens = 0
                        
                        # Reset image counter
                        usage_summary.stability_calls = 0
                        
                        # Reset totals
                        usage_summary.total_calls = 0
                        usage_summary.total_tokens = 0
                        usage_summary.total_cost = 0.0
                        
                        # Reset status to active
                        usage_summary.usage_status = UsageStatus.ACTIVE
                        usage_summary.updated_at = datetime.now(timezone.utc)
                        
                        db.commit()
                        reset_count += 1
                        
                        logger.info(f"\n✅ Reset usage for user {sub.user_id} (period {current_period}):")
                        logger.info(f"   Calls: {old_gemini + old_mistral} (gemini: {old_gemini}, mistral: {old_mistral}) → 0")
                        logger.info(f"   Tokens: {old_tokens} → 0")
                        logger.info(f"   Images: {old_images} → 0")
                        logger.info(f"   Total Calls: {old_total_calls} → 0")
                        logger.info(f"   Total Tokens: {old_total_tokens} → 0")
                    else:
                        logger.info(f"  ℹ️  No usage summary found for user {sub.user_id} (period {current_period}) - nothing to reset")
                        
                except Exception as reset_error:
                    logger.error(f"  ❌ Error resetting usage for user {sub.user_id}: {reset_error}")
                    import traceback
                    logger.error(traceback.format_exc())
                    db.rollback()
            
            if reset_count > 0:
                logger.info(f"\n✅ Successfully reset usage counters for {reset_count} user(s)")
            else:
                logger.info("\nℹ️  No usage counters to reset")
            
            logger.info("\n" + "="*60)
            logger.info("RESET COMPLETE")
            logger.info("="*60)
            logger.info("\n💡 Usage counters have been reset. Users can now use their new limits.")
            logger.info("   Next API call will start counting from 0.")
            
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"❌ Error resetting usage: {e}")
            import traceback
            logger.error(traceback.format_exc())
            raise
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"❌ Failed to connect to database: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False

if __name__ == "__main__":
    logger.info("🚀 Starting Basic plan usage counter reset...")
    logger.info("="*60)
    logger.info("This will reset all usage counters (calls, tokens, images) to 0")
    logger.info("for all Basic plan users in their current billing period.")
    logger.info("="*60)
    
    try:
        success = reset_basic_plan_usage()
        
        if success:
            logger.info("\n✅ Script completed successfully!")
            sys.exit(0)
        else:
            logger.error("\n❌ Script failed!")
            sys.exit(1)
            
    except KeyboardInterrupt:
        logger.info("\n⚠️  Script cancelled by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n❌ Unexpected error: {e}")
        sys.exit(1)

