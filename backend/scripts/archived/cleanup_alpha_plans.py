"""
Script to remove Alpha subscription plans and update limits for production testing.
Only keeps: Free, Basic, Pro, Enterprise with updated feature limits.
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

from models.subscription_models import SubscriptionPlan, SubscriptionTier
from services.database import DATABASE_URL

def cleanup_alpha_plans():
    """Remove alpha subscription plans and update limits."""
    
    try:
        engine = create_engine(DATABASE_URL, echo=True)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        try:
            # Delete all plans with "Alpha" in the name
            alpha_plans = db.query(SubscriptionPlan).filter(
                SubscriptionPlan.name.like('%Alpha%')
            ).all()
            
            for plan in alpha_plans:
                logger.info(f"Deleting Alpha plan: {plan.name}")
                db.delete(plan)
            
            db.commit()
            logger.info(f"✅ Deleted {len(alpha_plans)} Alpha plans")
            
            # Update existing plans with new limits
            logger.info("Updating plan limits...")
            
            # Free Plan - Blog, LinkedIn, Facebook writers + Text & Image only
            free_plan = db.query(SubscriptionPlan).filter(
                SubscriptionPlan.tier == SubscriptionTier.FREE
            ).first()
            
            if free_plan:
                free_plan.name = "Free"
                free_plan.description = "Perfect for trying ALwrity with Blog, LinkedIn & Facebook writers"
                free_plan.gemini_calls_limit = 100
                free_plan.openai_calls_limit = 50
                free_plan.anthropic_calls_limit = 0
                free_plan.mistral_calls_limit = 50
                free_plan.tavily_calls_limit = 20
                free_plan.serper_calls_limit = 20
                free_plan.metaphor_calls_limit = 10
                free_plan.firecrawl_calls_limit = 10
                free_plan.stability_calls_limit = 10  # Image generation
                free_plan.gemini_tokens_limit = 100000
                free_plan.monthly_cost_limit = 5.0
                free_plan.features = [
                    "blog_writer",
                    "linkedin_writer", 
                    "facebook_writer",
                    "text_generation",
                    "image_generation",
                    "wix_integration",
                    "wordpress_integration",
                    "gsc_integration"
                ]
                logger.info("✅ Updated Free plan")
            
            # Basic Plan - Blog, LinkedIn, Facebook writers + Text & Image only
            basic_plan = db.query(SubscriptionPlan).filter(
                SubscriptionPlan.tier == SubscriptionTier.BASIC
            ).first()
            
            if basic_plan:
                basic_plan.name = "Basic"
                basic_plan.description = "Great for solopreneurs with Blog, LinkedIn & Facebook writers"
                basic_plan.price_monthly = 29.0
                basic_plan.price_yearly = 278.0  # ~20% discount
                basic_plan.gemini_calls_limit = 500
                basic_plan.openai_calls_limit = 250
                basic_plan.anthropic_calls_limit = 100
                basic_plan.mistral_calls_limit = 250
                basic_plan.tavily_calls_limit = 100
                basic_plan.serper_calls_limit = 100
                basic_plan.metaphor_calls_limit = 50
                basic_plan.firecrawl_calls_limit = 50
                basic_plan.stability_calls_limit = 50  # Image generation
                basic_plan.gemini_tokens_limit = 500000
                basic_plan.openai_tokens_limit = 250000
                basic_plan.monthly_cost_limit = 25.0
                basic_plan.features = [
                    "blog_writer",
                    "linkedin_writer",
                    "facebook_writer",
                    "text_generation",
                    "image_generation",
                    "wix_integration",
                    "wordpress_integration",
                    "gsc_integration",
                    "priority_support"
                ]
                logger.info("✅ Updated Basic plan")
            
            # Pro Plan - 6 Social Platforms + Website Management + Text, Image, Audio, Video
            pro_plan = db.query(SubscriptionPlan).filter(
                SubscriptionPlan.tier == SubscriptionTier.PRO
            ).first()
            
            if pro_plan:
                pro_plan.name = "Pro"
                pro_plan.description = "Perfect for businesses with 6 social platforms & multimodal AI"
                pro_plan.price_monthly = 79.0
                pro_plan.price_yearly = 758.0  # ~20% discount
                pro_plan.gemini_calls_limit = 2000
                pro_plan.openai_calls_limit = 1000
                pro_plan.anthropic_calls_limit = 500
                pro_plan.mistral_calls_limit = 1000
                pro_plan.tavily_calls_limit = 500
                pro_plan.serper_calls_limit = 500
                pro_plan.metaphor_calls_limit = 250
                pro_plan.firecrawl_calls_limit = 250
                pro_plan.stability_calls_limit = 200  # Image generation
                pro_plan.gemini_tokens_limit = 2000000
                pro_plan.openai_tokens_limit = 1000000
                pro_plan.anthropic_tokens_limit = 500000
                pro_plan.monthly_cost_limit = 100.0
                pro_plan.features = [
                    "blog_writer",
                    "linkedin_writer",
                    "facebook_writer",
                    "instagram_writer",
                    "twitter_writer",
                    "tiktok_writer",
                    "youtube_writer",
                    "text_generation",
                    "image_generation",
                    "audio_generation",
                    "video_generation",
                    "wix_integration",
                    "wordpress_integration",
                    "gsc_integration",
                    "website_management",
                    "content_scheduling",
                    "advanced_analytics",
                    "priority_support"
                ]
                logger.info("✅ Updated Pro plan")
            
            # Enterprise Plan - Unlimited with all features
            enterprise_plan = db.query(SubscriptionPlan).filter(
                SubscriptionPlan.tier == SubscriptionTier.ENTERPRISE
            ).first()
            
            if enterprise_plan:
                enterprise_plan.name = "Enterprise"
                enterprise_plan.description = "For large teams with unlimited usage & custom integrations"
                enterprise_plan.price_monthly = 199.0
                enterprise_plan.price_yearly = 1908.0  # ~20% discount
                enterprise_plan.gemini_calls_limit = 0  # Unlimited
                enterprise_plan.openai_calls_limit = 0
                enterprise_plan.anthropic_calls_limit = 0
                enterprise_plan.mistral_calls_limit = 0
                enterprise_plan.tavily_calls_limit = 0
                enterprise_plan.serper_calls_limit = 0
                enterprise_plan.metaphor_calls_limit = 0
                enterprise_plan.firecrawl_calls_limit = 0
                enterprise_plan.stability_calls_limit = 0
                enterprise_plan.gemini_tokens_limit = 0
                enterprise_plan.openai_tokens_limit = 0
                enterprise_plan.anthropic_tokens_limit = 0
                enterprise_plan.mistral_tokens_limit = 0
                enterprise_plan.monthly_cost_limit = 0.0  # Unlimited
                enterprise_plan.features = [
                    "blog_writer",
                    "linkedin_writer",
                    "facebook_writer",
                    "instagram_writer",
                    "twitter_writer",
                    "tiktok_writer",
                    "youtube_writer",
                    "text_generation",
                    "image_generation",
                    "audio_generation",
                    "video_generation",
                    "wix_integration",
                    "wordpress_integration",
                    "gsc_integration",
                    "website_management",
                    "content_scheduling",
                    "advanced_analytics",
                    "custom_integrations",
                    "dedicated_account_manager",
                    "white_label",
                    "priority_support"
                ]
                logger.info("✅ Updated Enterprise plan")
            
            db.commit()
            logger.info("✅ All plans updated successfully!")
            
            # Display summary
            logger.info("\n" + "="*60)
            logger.info("SUBSCRIPTION PLANS SUMMARY")
            logger.info("="*60)
            
            all_plans = db.query(SubscriptionPlan).filter(
                SubscriptionPlan.is_active == True
            ).order_by(SubscriptionPlan.price_monthly).all()
            
            for plan in all_plans:
                logger.info(f"\n{plan.name} ({plan.tier.value})")
                logger.info(f"  Price: ${plan.price_monthly}/mo, ${plan.price_yearly}/yr")
                logger.info(f"  Gemini: {plan.gemini_calls_limit if plan.gemini_calls_limit > 0 else 'Unlimited'} calls/month")
                logger.info(f"  OpenAI: {plan.openai_calls_limit if plan.openai_calls_limit > 0 else 'Unlimited'} calls/month")
                logger.info(f"  Research: {plan.tavily_calls_limit if plan.tavily_calls_limit > 0 else 'Unlimited'} searches/month")
                logger.info(f"  Images: {plan.stability_calls_limit if plan.stability_calls_limit > 0 else 'Unlimited'} images/month")
                logger.info(f"  Features: {', '.join(plan.features or [])}")
            
            logger.info("\n" + "="*60)
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"❌ Error cleaning up plans: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise

if __name__ == "__main__":
    logger.info("🚀 Starting subscription plans cleanup...")
    
    try:
        cleanup_alpha_plans()
        logger.info("✅ Cleanup completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Cleanup failed: {e}")
        sys.exit(1)

