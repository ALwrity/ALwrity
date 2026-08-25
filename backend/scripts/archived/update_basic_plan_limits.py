"""
Script to update Basic plan subscription limits for testing rate limits and renewal flows.

Updates:
- LLM Calls (all providers): 10 calls (was 500-1000)
- LLM Tokens (all providers): 5000 tokens (increased from 2000 to support research workflow)
- Images: 5 images (was 50)

This script updates the SubscriptionPlan table, which automatically applies to all users
who have a Basic plan subscription via the plan_id foreign key.
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

from models.subscription_models import SubscriptionPlan, SubscriptionTier, UserSubscription, UsageStatus
from services.database import DATABASE_URL

def update_basic_plan_limits():
    """Update Basic plan limits for testing rate limits and renewal."""
    
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
            
            # Store old values for logging
            old_limits = {
                'gemini_calls': basic_plan.gemini_calls_limit,
                'mistral_calls': basic_plan.mistral_calls_limit,
                'gemini_tokens': basic_plan.gemini_tokens_limit,
                'mistral_tokens': basic_plan.mistral_tokens_limit,
                'stability_calls': basic_plan.stability_calls_limit,
            }
            
            logger.info(f"📋 Current Basic plan limits:")
            logger.info(f"  Gemini Calls: {old_limits['gemini_calls']}")
            logger.info(f"  Mistral Calls: {old_limits['mistral_calls']}")
            logger.info(f"  Gemini Tokens: {old_limits['gemini_tokens']}")
            logger.info(f"  Mistral Tokens: {old_limits['mistral_tokens']}")
            logger.info(f"  Images (Stability): {old_limits['stability_calls']}")
            
            # Update unified AI text generation limit to 10
            basic_plan.ai_text_generation_calls_limit = 10
            
            # Legacy per-provider limits (kept for backwards compatibility, but not used for enforcement)
            basic_plan.gemini_calls_limit = 1000
            basic_plan.openai_calls_limit = 500
            basic_plan.anthropic_calls_limit = 200
            basic_plan.mistral_calls_limit = 500
            
            # Update all LLM provider token limits to 20000 (increased from 5000 for better stability)
            basic_plan.gemini_tokens_limit = 20000
            basic_plan.openai_tokens_limit = 20000
            basic_plan.anthropic_tokens_limit = 20000
            basic_plan.mistral_tokens_limit = 20000
            
            # Update image generation limit to 25 (minimum 10 for podcast workflows)
            basic_plan.stability_calls_limit = 25

            # Update image edit limit to 25 (podcast episode covers + scene images)
            basic_plan.image_edit_calls_limit = 25

            # Update audio generation limit to 100 (TTS for podcast narration)
            basic_plan.audio_calls_limit = 100
            
            # Update timestamp
            basic_plan.updated_at = datetime.now(timezone.utc)
            
            logger.info("\n📝 New Basic plan limits:")
            logger.info(f"  LLM Calls (all providers): 10")
            logger.info(f"  LLM Tokens (all providers): 20000 (increased from 5000)")
            logger.info(f"  Images (stability): 25")
            logger.info(f"  Image Edits: 25")
            logger.info(f"  Audio Calls: 100")
            
            # Count and get affected users
            user_subscriptions = db.query(UserSubscription).filter(
                UserSubscription.plan_id == basic_plan.id,
                UserSubscription.is_active == True
            ).all()
            
            affected_users = len(user_subscriptions)
            
            logger.info(f"\n👥 Users affected: {affected_users}")
            
            if affected_users > 0:
                logger.info("\n📋 Affected user IDs:")
                for sub in user_subscriptions:
                    logger.info(f"  - {sub.user_id}")
            else:
                logger.info("  (No active Basic plan subscriptions found)")
            
            # Commit plan limit changes first
            db.commit()
            logger.info("\n✅ Basic plan limits updated successfully!")
            
            # Cap usage at new limits for all affected users (preserve historical data, but cap enforcement)
            logger.info("\n🔄 Capping usage counters at new limits for Basic plan users...")
            logger.info("   (Historical usage preserved, but capped to allow new calls within limits)")
            from models.subscription_models import UsageSummary
            from services.subscription import PricingService
            
            pricing_service = PricingService(db)
            capped_count = 0
            
            # New limits - use unified AI text generation limit if available
            new_call_limit = getattr(basic_plan, 'ai_text_generation_calls_limit', None) or basic_plan.gemini_calls_limit
            new_token_limit = basic_plan.gemini_tokens_limit  # 5000 (increased from 2000)
            new_image_limit = basic_plan.stability_calls_limit  # 5
            
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
                        
                        # Cap LLM provider counters at new limits (don't reset, just cap)
                        # This allows historical data to remain but prevents blocking from old usage
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
                        
                        # Update totals based on capped values (approximate)
                        # Recalculate total_calls and total_tokens based on capped provider values
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
                        
                        logger.info(f"  ✅ Capped usage for user {sub.user_id}:")
                        logger.info(f"     Gemini Calls: {old_gemini} → {usage_summary.gemini_calls} (limit: {new_call_limit})")
                        logger.info(f"     Mistral Calls: {old_mistral} → {usage_summary.mistral_calls} (limit: {new_call_limit})")
                        logger.info(f"     Tokens: {old_tokens} → {max(usage_summary.gemini_tokens, usage_summary.mistral_tokens)} (limit: {new_token_limit})")
                        logger.info(f"     Images: {old_images} → {usage_summary.stability_calls} (limit: {new_image_limit})")
                    else:
                        logger.info(f"  ℹ️  No usage summary found for user {sub.user_id} (period {current_period})")
                        
                except Exception as cap_error:
                    logger.error(f"  ❌ Error capping usage for user {sub.user_id}: {cap_error}")
                    import traceback
                    logger.error(traceback.format_exc())
                    db.rollback()
            
            if capped_count > 0:
                logger.info(f"\n✅ Capped usage counters for {capped_count} user(s)")
                logger.info("   Historical usage preserved, but capped at new limits to allow new calls")
            else:
                logger.info("\nℹ️  No usage counters to cap")
            
            # Note about cache clearing
            logger.info("\n🔄 Cache Information:")
            logger.info("  The subscription limits cache is per-instance and will refresh on next request.")
            logger.info("  No manual cache clearing needed - limits will be read from database on next check.")
            
            # Display final summary
            logger.info("\n" + "="*60)
            logger.info("BASIC PLAN UPDATE SUMMARY")
            logger.info("="*60)
            logger.info(f"\nPlan: {basic_plan.name} ({basic_plan.tier.value})")
            logger.info(f"Price: ${basic_plan.price_monthly}/mo, ${basic_plan.price_yearly}/yr")
            logger.info(f"\nUpdated Limits:")
            logger.info(f"  LLM Calls (gemini/openai/anthropic/mistral): {basic_plan.gemini_calls_limit}")
            logger.info(f"  LLM Tokens (gemini/openai/anthropic/mistral): {basic_plan.gemini_tokens_limit}")
            logger.info(f"  Images (stability): {basic_plan.stability_calls_limit}")
            logger.info(f"\nUsers Affected: {affected_users}")
            logger.info("\n" + "="*60)
            logger.info("\n💡 Note: These limits apply immediately to all Basic plan users.")
            logger.info("   Historical usage has been preserved but capped at new limits.")
            logger.info("   Users can continue making new calls up to the new limits.")
            logger.info("   Users will hit rate limits faster for testing purposes.")
            
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"❌ Error updating Basic plan: {e}")
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
    logger.info("🚀 Starting Basic plan limits update...")
    logger.info("="*60)
    logger.info("This will update Basic plan limits for testing rate limits:")
    logger.info("  - LLM Calls: 10 (all providers)")
    logger.info("  - LLM Tokens: 20000 (all providers, increased from 5000)")
    logger.info("  - Images: 5")
    logger.info("="*60)
    
    # Ask for confirmation in non-interactive mode, proceed directly
    # In interactive mode, you can add: input("\nPress Enter to continue or Ctrl+C to cancel...")
    
    try:
        success = update_basic_plan_limits()
        
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

