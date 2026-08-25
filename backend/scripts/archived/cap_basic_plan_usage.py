"""
Standalone script to cap usage counters at new Basic plan limits.

This preserves historical usage data but caps it at the new limits so users
can continue making new calls within their limits.
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

def cap_basic_plan_usage():
    """Cap usage counters at new Basic plan limits."""
    
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
            
            # New limits
            new_call_limit = basic_plan.gemini_calls_limit  # Should be 10
            new_token_limit = basic_plan.gemini_tokens_limit  # Should be 2000
            new_image_limit = basic_plan.stability_calls_limit  # 25
            
            logger.info(f"📋 Basic Plan Limits:")
            logger.info(f"  Calls: {new_call_limit}")
            logger.info(f"  Tokens: {new_token_limit}")
            logger.info(f"  Images: {new_image_limit}")
            
            # Get all Basic plan users
            user_subscriptions = db.query(UserSubscription).filter(
                UserSubscription.plan_id == basic_plan.id,
                UserSubscription.is_active == True
            ).all()
            
            logger.info(f"\n👥 Found {len(user_subscriptions)} Basic plan user(s)")
            
            pricing_service = PricingService(db)
            capped_count = 0
            
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
                        old_openai = usage_summary.openai_calls or 0
                        old_anthropic = usage_summary.anthropic_calls or 0
                        old_tokens = max(
                            usage_summary.gemini_tokens or 0,
                            usage_summary.openai_tokens or 0,
                            usage_summary.anthropic_tokens or 0,
                            usage_summary.mistral_tokens or 0
                        )
                        old_images = usage_summary.stability_calls or 0
                        
                        # Check if capping is needed
                        needs_cap = (
                            old_gemini > new_call_limit or
                            old_mistral > new_call_limit or
                            old_openai > new_call_limit or
                            old_anthropic > new_call_limit or
                            old_images > new_image_limit or
                            old_tokens > new_token_limit
                        )
                        
                        if needs_cap:
                            # Cap LLM provider counters at new limits
                            usage_summary.gemini_calls = min(old_gemini, new_call_limit)
                            usage_summary.mistral_calls = min(old_mistral, new_call_limit)
                            usage_summary.openai_calls = min(old_openai, new_call_limit)
                            usage_summary.anthropic_calls = min(old_anthropic, new_call_limit)
                            
                            # Cap token counters at new limits
                            usage_summary.gemini_tokens = min(usage_summary.gemini_tokens or 0, new_token_limit)
                            usage_summary.openai_tokens = min(usage_summary.openai_tokens or 0, new_token_limit)
                            usage_summary.anthropic_tokens = min(usage_summary.anthropic_tokens or 0, new_token_limit)
                            usage_summary.mistral_tokens = min(usage_summary.mistral_tokens or 0, new_token_limit)
                            
                            # Cap image counter at new limit
                            usage_summary.stability_calls = min(old_images, new_image_limit)
                            
                            # Recalculate totals based on capped values
                            total_capped_calls = (
                                usage_summary.gemini_calls +
                                usage_summary.mistral_calls +
                                usage_summary.openai_calls +
                                usage_summary.anthropic_calls +
                                usage_summary.stability_calls
                            )
                            total_capped_tokens = (
                                usage_summary.gemini_tokens +
                                usage_summary.mistral_tokens +
                                usage_summary.openai_tokens +
                                usage_summary.anthropic_tokens
                            )
                            
                            usage_summary.total_calls = total_capped_calls
                            usage_summary.total_tokens = total_capped_tokens
                            
                            # Reset status to active to allow new calls
                            usage_summary.usage_status = UsageStatus.ACTIVE
                            usage_summary.updated_at = datetime.now(timezone.utc)
                            
                            db.commit()
                            capped_count += 1
                            
                            logger.info(f"\n✅ Capped usage for user {sub.user_id} (period {current_period}):")
                            logger.info(f"   Gemini Calls: {old_gemini} → {usage_summary.gemini_calls} (limit: {new_call_limit})")
                            logger.info(f"   Mistral Calls: {old_mistral} → {usage_summary.mistral_calls} (limit: {new_call_limit})")
                            logger.info(f"   OpenAI Calls: {old_openai} → {usage_summary.openai_calls} (limit: {new_call_limit})")
                            logger.info(f"   Anthropic Calls: {old_anthropic} → {usage_summary.anthropic_calls} (limit: {new_call_limit})")
                            logger.info(f"   Tokens: {old_tokens} → {max(usage_summary.gemini_tokens, usage_summary.mistral_tokens)} (limit: {new_token_limit})")
                            logger.info(f"   Images: {old_images} → {usage_summary.stability_calls} (limit: {new_image_limit})")
                        else:
                            logger.info(f"  ℹ️  User {sub.user_id} usage is within limits - no capping needed")
                    else:
                        logger.info(f"  ℹ️  No usage summary found for user {sub.user_id} (period {current_period})")
                        
                except Exception as cap_error:
                    logger.error(f"  ❌ Error capping usage for user {sub.user_id}: {cap_error}")
                    import traceback
                    logger.error(traceback.format_exc())
                    db.rollback()
            
            if capped_count > 0:
                logger.info(f"\n✅ Successfully capped usage for {capped_count} user(s)")
                logger.info("   Historical usage preserved, but capped at new limits")
                logger.info("   Users can now make new calls within their limits")
            else:
                logger.info("\nℹ️  No usage counters needed capping")
            
            logger.info("\n" + "="*60)
            logger.info("CAPPING COMPLETE")
            logger.info("="*60)
            
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"❌ Error capping usage: {e}")
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
    logger.info("🚀 Starting Basic plan usage capping...")
    logger.info("="*60)
    logger.info("This will cap usage counters at new Basic plan limits")
    logger.info("while preserving historical usage data.")
    logger.info("="*60)
    
    try:
        success = cap_basic_plan_usage()
        
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

