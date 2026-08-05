"""
Database Migration Script for Product Marketing Suite
Creates all tables needed for campaigns, proposals, and generated assets.
"""

import sys
import os
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
from loguru import logger
import traceback

# Import models - Product Marketing uses SubscriptionBase
# Import the Base first, then import product marketing models to register them
from models.base import Base
from models.product_marketing_models import Campaign, CampaignProposal, CampaignAsset
from services.database import DATABASE_URL

def create_product_marketing_tables():
    """Create all product marketing tables."""
    
    try:
        # Create engine
        engine = create_engine(DATABASE_URL, echo=False)
        
        # Create all tables (product marketing models share SubscriptionBase)
        logger.info("Creating product marketing tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Product marketing tables created successfully")
        
        # Verify tables were created
        with engine.connect() as conn:
            # Check if tables exist
            from sqlalchemy import inspect as sqlalchemy_inspect
            inspector = sqlalchemy_inspect(engine)
            tables = inspector.get_table_names()
            
            expected_tables = [
                'product_marketing_campaigns',
                'product_marketing_proposals',
                'product_marketing_assets'
            ]
            
            created_tables = [t for t in expected_tables if t in tables]
            missing_tables = [t for t in expected_tables if t not in tables]
            
            if created_tables:
                logger.info(f"✅ Created tables: {', '.join(created_tables)}")
            
            if missing_tables:
                logger.warning(f"⚠️ Missing tables: {', '.join(missing_tables)}")
            else:
                logger.info("🎉 All product marketing tables verified!")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error creating product marketing tables: {e}")
        logger.error(traceback.format_exc())
        return False

if __name__ == "__main__":
    success = create_product_marketing_tables()
    sys.exit(0 if success else 1)

