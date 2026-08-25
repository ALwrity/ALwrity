"""
Migration Script: Add ai_text_generation_calls_limit column to subscription_plans table.

This adds the unified AI text generation limit column that applies to all LLM providers
(gemini, openai, anthropic, mistral) instead of per-provider limits.
"""

import sys
import os
from pathlib import Path
from datetime import datetime, timezone

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
from loguru import logger

from models.subscription_models import SubscriptionPlan, SubscriptionTier
from services.database import DATABASE_URL

def add_ai_text_generation_limit_column():
    """Add ai_text_generation_calls_limit column to subscription_plans table."""
    
    try:
        engine = create_engine(DATABASE_URL, echo=False)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        try:
            # Check if column already exists
            inspector = inspect(engine)
            columns = [col['name'] for col in inspector.get_columns('subscription_plans')]
            
            if 'ai_text_generation_calls_limit' in columns:
                logger.info("✅ Column 'ai_text_generation_calls_limit' already exists. Skipping migration.")
                return True
            
            logger.info("📋 Adding 'ai_text_generation_calls_limit' column to subscription_plans table...")
            
            # Add the column (SQLite compatible)
            alter_query = text("""
                ALTER TABLE subscription_plans 
                ADD COLUMN ai_text_generation_calls_limit INTEGER DEFAULT 0
            """)
            
            db.execute(alter_query)
            db.commit()
            
            logger.info("✅ Column added successfully!")
            
            # Update existing plans with unified limits based on their current limits
            logger.info("\n🔄 Updating existing subscription plans with unified limits...")
            
            plans = db.query(SubscriptionPlan).all()
            updated_count = 0
            
            for plan in plans:
                # Use the first non-zero LLM provider limit as the unified limit
                # Or use gemini_calls_limit as default
                unified_limit = (
                    plan.ai_text_generation_calls_limit or
                    plan.gemini_calls_limit or
                    plan.openai_calls_limit or
                    plan.anthropic_calls_limit or
                    plan.mistral_calls_limit or
                    0
                )
                
                # For Basic plan, ensure it's set to 10 (from our recent update)
                if plan.tier == SubscriptionTier.BASIC:
                    unified_limit = 10
                
                if plan.ai_text_generation_calls_limit != unified_limit:
                    plan.ai_text_generation_calls_limit = unified_limit
                    plan.updated_at = datetime.now(timezone.utc)
                    updated_count += 1
                    
                    logger.info(f"  ✅ Updated {plan.name} ({plan.tier.value}): ai_text_generation_calls_limit = {unified_limit}")
                else:
                    logger.info(f"  ℹ️  {plan.name} ({plan.tier.value}): already set to {unified_limit}")
            
            if updated_count > 0:
                db.commit()
                logger.info(f"\n✅ Updated {updated_count} subscription plan(s)")
            else:
                logger.info("\nℹ️  No plans needed updating")
            
            # Display summary
            logger.info("\n" + "="*60)
            logger.info("MIGRATION SUMMARY")
            logger.info("="*60)
            
            all_plans = db.query(SubscriptionPlan).all()
            for plan in all_plans:
                logger.info(f"\n{plan.name} ({plan.tier.value}):")
                logger.info(f"  Unified AI Text Gen Limit: {plan.ai_text_generation_calls_limit if plan.ai_text_generation_calls_limit else 'Not set'}")
                logger.info(f"  Legacy Limits: gemini={plan.gemini_calls_limit}, mistral={plan.mistral_calls_limit}")
            
            logger.info("\n" + "="*60)
            logger.info("✅ Migration completed successfully!")
            
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"❌ Error during migration: {e}")
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
    logger.info("🚀 Starting ai_text_generation_calls_limit column migration...")
    logger.info("="*60)
    logger.info("This will add the unified AI text generation limit column")
    logger.info("and update existing plans with appropriate values.")
    logger.info("="*60)
    
    try:
        success = add_ai_text_generation_limit_column()
        
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

