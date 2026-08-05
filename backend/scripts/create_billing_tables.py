"""
Database Migration Script for Billing System
Creates all tables needed for billing, usage tracking, and subscription management.
Supports multi-tenant architecture.
"""

import sys
import os
import argparse
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
from loguru import logger
import traceback

# Import models
from models.base import Base
from services.database import get_engine_for_user, get_all_user_ids, init_user_database
from services.subscription.pricing_service import PricingService

def check_existing_tables(engine):
    """Check if billing tables exist."""
    if engine is None:
        return False
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        # Check for a key table
        return 'subscription_plans' in tables
    except Exception as e:
        logger.warning(f"Error checking existing tables: {e}")
        return False

def create_billing_tables(user_id):
    """Create all billing and subscription-related tables for a specific user."""
    
    try:
        logger.info(f"Setting up billing tables for user: {user_id}")
        
        # Get engine for user
        engine = get_engine_for_user(user_id)
        
        # Create all tables (idempotent)
        logger.debug("Creating billing and subscription system tables...")
        Base.metadata.create_all(bind=engine)
        logger.debug("✅ Billing and subscription tables created/verified")
        
        # Create session for data initialization
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        try:
            # Initialize pricing and plans
            pricing_service = PricingService(db)
            
            logger.debug("Initializing default API pricing...")
            pricing_service.initialize_default_pricing()
            logger.debug("✅ Default API pricing initialized")
            
            logger.debug("Initializing default subscription plans...")
            pricing_service.initialize_default_plans()
            logger.debug("✅ Default subscription plans initialized")
            
            db.commit()
            
        except Exception as e:
            logger.error(f"Error initializing default data: {e}")
            logger.error(traceback.format_exc())
            db.rollback()
            raise
        finally:
            db.close()
            
        logger.info(f"✅ Billing system setup completed successfully for {user_id}!")
        
        # Display summary
        display_setup_summary(engine)
        
        return True

    except Exception as e:
        logger.error(f"❌ Error creating billing tables for {user_id}: {e}")
        logger.error(traceback.format_exc())
        return False

def display_setup_summary(engine):
    """Display a summary of the created tables and data."""
    
    try:
        with engine.connect() as conn:
            logger.info("\n" + "="*60)
            logger.info("BILLING SYSTEM SETUP SUMMARY")
            logger.info("="*60)
            
            # Check tables
            tables_query = text("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND (
                    name LIKE '%subscription%' OR 
                    name LIKE '%usage%' OR 
                    name LIKE '%billing%' OR
                    name LIKE '%pricing%' OR
                    name LIKE '%alert%'
                )
                ORDER BY name
            """)
            
            result = conn.execute(tables_query)
            tables = result.fetchall()
            
            logger.info(f"\n📊 Created Tables ({len(tables)}):")
            for table in tables:
                logger.debug(f"  • {table[0]}")
            
            # Check subscription plans
            try:
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
                        logger.debug(f"  • {name} ({tier}): ${monthly}/month, ${yearly}/year")
            except Exception as e:
                logger.warning(f"Could not check subscription plans: {e}")
            
            # Check API pricing
            try:
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
                        LIMIT 10
                    """)
                    result = conn.execute(pricing_detail_query)
                    pricing_entries = result.fetchall()

                    logger.info("\n  LLM Pricing (per token) - Top 10:")
                    for entry in pricing_entries:
                        provider, model, input_cost, output_cost = entry
                        logger.debug(f"    • {provider}/{model}: ${input_cost:.8f} in, ${output_cost:.8f} out")
            except Exception as e:
                logger.warning(f"Could not check API pricing: {e}")
            
            logger.info("\n" + "="*60)
            
    except Exception as e:
        logger.error(f"Error displaying summary: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Create billing tables for a user.')
    parser.add_argument('--user_id', type=str, help='Specific user ID to setup billing for')
    parser.add_argument('--all', action='store_true', help='Setup billing for ALL users')
    
    args = parser.parse_args()
    
    if args.user_id:
        create_billing_tables(args.user_id)
    elif args.all:
        user_ids = get_all_user_ids()
        logger.info(f"Found {len(user_ids)} users to process")
        for uid in user_ids:
            create_billing_tables(uid)
    else:
        logger.warning("No user_id provided. Using default behavior (checking for single tenant or exiting).")
        logger.warning("Usage: python create_billing_tables.py --user_id <user_id> OR --all")
        
        # Fallback: if there's only one user, maybe we can guess?
        # But safer to just exit or ask for input.
        # For now, let's try to discover users and if only 1, do it.
        user_ids = get_all_user_ids()
        if len(user_ids) == 1:
            logger.info(f"Single user found: {user_ids[0]}. Proceeding...")
            create_billing_tables(user_ids[0])
        elif len(user_ids) > 1:
            logger.error(f"Multiple users found {user_ids}. Please specify --user_id or --all")
        else:
            logger.error("No users found.")
