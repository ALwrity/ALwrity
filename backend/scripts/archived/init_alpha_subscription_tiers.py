#!/usr/bin/env python3
"""
Initialize Alpha Tester Subscription Tiers
Creates subscription plans for alpha testing with appropriate limits.

NOTE: Pricing is seeded via PricingService.initialize_default_pricing() 
which runs in services/database.py:init_user_database()
NOT via this script.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from models.subscription_models import (
    SubscriptionPlan, SubscriptionTier
)
from services.database import get_db_session
from datetime import datetime
from loguru import logger

def create_alpha_subscription_tiers():
    """Create subscription tiers for alpha testers."""
    if os.getenv('ENABLE_ALPHA', 'false').lower() not in {'1','true','yes','on'}:
        logger.info("Alpha tier initialization is disabled (ENABLE_ALPHA is false)")
        return False
    
    db = get_db_session()
    if not db:
        logger.error("Could not get database session")
        return False
    
    try:
        # Define alpha subscription tiers
        alpha_tiers = [
            {
                "name": "Free Alpha",
                "tier": SubscriptionTier.FREE,
                "price_monthly": 0.0,
                "price_yearly": 0.0,
                "description": "Free tier for alpha testing - Limited usage",
                "features": ["blog_writer", "basic_seo", "content_planning"],
                "limits": {
                    "gemini_calls_limit": 50,
                    "gemini_tokens_limit": 10000,
                    "tavily_calls_limit": 20,
                    "serper_calls_limit": 10,
                    "stability_calls_limit": 5,
                    "monthly_cost_limit": 5.0
                }
            },
            {
                "name": "Basic Alpha",
                "tier": SubscriptionTier.BASIC,
                "price_monthly": 29.0,
                "price_yearly": 290.0,
                "description": "Basic alpha tier - Moderate usage for testing",
                "features": ["blog_writer", "seo_analysis", "content_planning", "strategy_copilot"],
                "limits": {
                    "gemini_calls_limit": 200,
                    "gemini_tokens_limit": 50000,
                    "tavily_calls_limit": 100,
                    "serper_calls_limit": 50,
                    "stability_calls_limit": 25,
                    "monthly_cost_limit": 25.0
                }
            },
            {
                "name": "Pro Alpha",
                "tier": SubscriptionTier.PRO,
                "price_monthly": 99.0,
                "price_yearly": 990.0,
                "description": "Pro alpha tier - High usage for power users",
                "features": ["blog_writer", "seo_analysis", "content_planning", "strategy_copilot", "advanced_analytics"],
                "limits": {
                    "gemini_calls_limit": 500,
                    "gemini_tokens_limit": 150000,
                    "tavily_calls_limit": 300,
                    "serper_calls_limit": 150,
                    "stability_calls_limit": 100,
                    "monthly_cost_limit": 100.0
                }
            },
            {
                "name": "Enterprise Alpha",
                "tier": SubscriptionTier.ENTERPRISE,
                "price_monthly": 299.0,
                "price_yearly": 2990.0,
                "description": "Enterprise alpha tier - Unlimited usage for enterprise testing",
                "features": ["blog_writer", "seo_analysis", "content_planning", "strategy_copilot", "advanced_analytics", "custom_integrations"],
                "limits": {
                    "gemini_calls_limit": 0,
                    "gemini_tokens_limit": 0,
                    "tavily_calls_limit": 0,
                    "serper_calls_limit": 0,
                    "stability_calls_limit": 0,
                    "monthly_cost_limit": 500.0
                }
            }
        ]
        
        # Create subscription plans
        for tier_data in alpha_tiers:
            existing_plan = db.query(SubscriptionPlan).filter(
                SubscriptionPlan.name == tier_data["name"]
            ).first()
            
            if existing_plan:
                logger.info(f"Plan '{tier_data['name']}' already exists, updating...")
                for key, value in tier_data["limits"].items():
                    setattr(existing_plan, key, value)
                existing_plan.description = tier_data["description"]
                existing_plan.features = tier_data["features"]
                existing_plan.updated_at = datetime.utcnow()
            else:
                logger.info(f"Creating new plan: {tier_data['name']}")
                plan = SubscriptionPlan(
                    name=tier_data["name"],
                    tier=tier_data["tier"],
                    price_monthly=tier_data["price_monthly"],
                    price_yearly=tier_data["price_yearly"],
                    description=tier_data["description"],
                    features=tier_data["features"],
                    **tier_data["limits"]
                )
                db.add(plan)
        
        db.commit()
        logger.info("Alpha subscription tiers created/updated successfully!")
        
        return True
        
    except Exception as e:
        logger.error(f"Error creating alpha subscription tiers: {e}")
        db.rollback()
        return False
    finally:
        db.close()

def assign_default_plan_to_users():
    """Assign Free Alpha plan to all existing users."""
    if os.getenv('ENABLE_ALPHA', 'false').lower() not in {'1','true','yes','on'}:
        logger.info("Alpha default plan assignment is disabled (ENABLE_ALPHA is false)")
        return False
    
    db = get_db_session()
    if not db:
        logger.error("Could not get database session")
        return False
    
    try:
        free_plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.name == "Free Alpha"
        ).first()
        
        if not free_plan:
            logger.error("Free Alpha plan not found")
            return False

        from models.subscription_models import UserSubscription, BillingCycle, UsageStatus
        from datetime import timedelta
        
        default_user_id = "default_user"
        existing_subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == default_user_id
        ).first()
        
        if not existing_subscription:
            logger.info(f"Creating default subscription for {default_user_id}")
            subscription = UserSubscription(
                user_id=default_user_id,
                plan_id=free_plan.id,
                billing_cycle=BillingCycle.MONTHLY,
                current_period_start=datetime.utcnow(),
                current_period_end=datetime.utcnow() + timedelta(days=30),
                status=UsageStatus.ACTIVE,
                is_active=True,
                auto_renew=True
            )
            db.add(subscription)
            db.commit()
            logger.info(f"Default subscription created for {default_user_id}")
        else:
            logger.info(f"Default subscription already exists for {default_user_id}")
        
        return True
        
    except Exception as e:
        logger.error(f"Error assigning default plan: {e}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    logger.info("Initializing Alpha Subscription Tiers...")
    
    success = create_alpha_subscription_tiers()
    if success:
        logger.info("Subscription tiers created successfully!")
        
        assign_success = assign_default_plan_to_users()
        if assign_success:
            logger.info("Default plan assigned successfully!")
        else:
            logger.error("Failed to assign default plan")
    else:
        logger.error("Failed to create subscription tiers")
    
    logger.info("Alpha subscription system initialization complete!")