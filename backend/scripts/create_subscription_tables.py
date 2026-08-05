"""
Database Migration Script for Subscription System
Creates all tables needed for usage-based subscription and monitoring.
"""

import sys
import os
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from loguru import logger
import traceback

# Import models
from models.base import Base
from services.database import DATABASE_URL
from services.subscription.pricing_service import PricingService

def create_subscription_tables():
    """Create all subscription-related tables."""
    
    try:
        # Create engine
        engine = create_engine(DATABASE_URL, echo=True)
        
        # Create all tables
        logger.info("Creating subscription system tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Subscription tables created successfully")
        
        # Create session for data initialization
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        try:
            # Initialize pricing and plans
            pricing_service = PricingService(db)
            
            logger.info("Initializing default API pricing...")
            pricing_service.initialize_default_pricing()
            logger.info("✅ Default API pricing initialized")
            
            logger.info("Initializing default subscription plans...")
            pricing_service.initialize_default_plans()
            logger.info("✅ Default subscription plans initialized")
            
        except Exception as e:
            logger.error(f"Error initializing default data: {e}")
            logger.error(traceback.format_exc())
            db.rollback()
            raise
        finally:
            db.close()
            
        logger.info("🎉 Subscription system setup completed successfully!")
        
        # Display summary
        display_setup_summary(engine)
        
    except Exception as e:
        logger.error(f"❌ Error creating subscription tables: {e}")
        logger.error(traceback.format_exc())
        raise

def display_setup_summary(engine):
    """Display a summary of the created tables and data."""
    
    try:
        with engine.connect() as conn:
            logger.info("\n" + "="*60)
            logger.info("SUBSCRIPTION SYSTEM SETUP SUMMARY")
            logger.info("="*60)
            
            # Check tables
            tables_query = text("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name LIKE '%subscription%' OR name LIKE '%usage%' OR name LIKE '%pricing%'
                ORDER BY name
            """)
            
            result = conn.execute(tables_query)
            tables = result.fetchall()
            
            logger.info(f"\n📊 Created Tables ({len(tables)}):")
            for table in tables:
                logger.info(f"  • {table[0]}")
            
            # Check subscription plans
            plans_query = text("SELECT COUNT(*) FROM subscription_plans")
            result = conn.execute(plans_query)
            plan_count = result.fetchone()[0]
            logger.info(f"\n💳 Subscription Plans: {plan_count}")
            
            if plan_count > 0:
                plans_detail_query = text("""
                    SELECT name, tier, price_monthly, price_yearly 
                    FROM subscription_plans 
                    ORDER BY price_monthly
                """)
                result = conn.execute(plans_detail_query)
                plans = result.fetchall()
                
                for plan in plans:
                    name, tier, monthly, yearly = plan
                    logger.info(f"  • {name} ({tier}): ${monthly}/month, ${yearly}/year")
            
            # Check API pricing
            pricing_query = text("SELECT COUNT(*) FROM api_provider_pricing")
            result = conn.execute(pricing_query)
            pricing_count = result.fetchone()[0]
            logger.info(f"\n💰 API Pricing Entries: {pricing_count}")
            
            if pricing_count > 0:
                pricing_detail_query = text("""
                    SELECT provider, model_name, cost_per_input_token, cost_per_output_token 
                    FROM api_provider_pricing 
                    WHERE cost_per_input_token > 0 OR cost_per_output_token > 0
                    ORDER BY provider, model_name
                """)
                result = conn.execute(pricing_detail_query)
                pricing_entries = result.fetchall()
                
                logger.info("\n  LLM Pricing (per token):")
                for entry in pricing_entries:
                    provider, model, input_cost, output_cost = entry
                    logger.info(f"    • {provider}/{model}: ${input_cost:.8f} in, ${output_cost:.8f} out")
            
            logger.info("\n" + "="*60)
            logger.info("NEXT STEPS:")
            logger.info("="*60)
            logger.info("1. Update your FastAPI app to include subscription routes:")
            logger.info("   from api.subscription import router as subscription_router")
            logger.info("   app.include_router(subscription_router)")
            logger.info("\n2. Update database service to include subscription models:")
            logger.info("   Add Base.metadata.create_all(bind=engine) to init_database()")
            logger.info("\n3. Test the API endpoints:")
            logger.info("   GET /api/subscription/plans")
            logger.info("   GET /api/subscription/usage/{user_id}")
            logger.info("   GET /api/subscription/dashboard/{user_id}")
            logger.info("\n4. Configure user identification in middleware")
            logger.info("   Ensure user_id is properly extracted from requests")
            logger.info("\n5. Set up monitoring dashboard frontend integration")
            logger.info("="*60)
            
    except Exception as e:
        logger.error(f"Error displaying summary: {e}")

def check_existing_tables(engine):
    """Check if subscription tables already exist."""
    
    try:
        with engine.connect() as conn:
            # Check for subscription tables
            check_query = text("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND (
                    name = 'subscription_plans' OR 
                    name = 'user_subscriptions' OR 
                    name = 'api_usage_logs' OR
                    name = 'usage_summaries'
                )
            """)
            
            result = conn.execute(check_query)
            existing_tables = result.fetchall()
            
            if existing_tables:
                logger.warning(f"Found existing subscription tables: {[t[0] for t in existing_tables]}")
                response = input("Tables already exist. Do you want to continue and potentially overwrite data? (y/N): ")
                if response.lower() != 'y':
                    logger.info("Migration cancelled by user")
                    return False
            
            return True
            
    except Exception as e:
        logger.error(f"Error checking existing tables: {e}")
        return True  # Proceed anyway

if __name__ == "__main__":
    logger.info("🚀 Starting subscription system database migration...")
    
    try:
        # Create engine to check existing tables
        engine = create_engine(DATABASE_URL, echo=False)
        
        # Check existing tables
        if not check_existing_tables(engine):
            sys.exit(0)
        
        # Create tables and initialize data
        create_subscription_tables()
        
        logger.info("✅ Migration completed successfully!")
        
    except KeyboardInterrupt:
        logger.info("Migration cancelled by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        sys.exit(1)