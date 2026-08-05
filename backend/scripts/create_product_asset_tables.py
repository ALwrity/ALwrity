"""
Database Migration Script for Product Asset Tables
Creates all tables needed for Product Marketing Suite (product asset creation).
These tables are separate from campaign-related tables and focus on product-specific assets.
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

# Import models - Product Asset models use SubscriptionBase
from models.base import Base
from models.product_asset_models import ProductAsset, ProductStyleTemplate, EcommerceExport
from services.database import DATABASE_URL


def create_product_asset_tables():
    """Create all product asset tables."""
    
    try:
        # Create engine
        engine = create_engine(DATABASE_URL, echo=False)
        
        # Create all tables (product asset models share SubscriptionBase)
        logger.info("Creating product asset tables for Product Marketing Suite...")
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Product asset tables created successfully")
        
        # Verify tables were created
        with engine.connect() as conn:
            # Check if tables exist
            inspector = inspect(engine)
            tables = inspector.get_table_names()
            
            expected_tables = [
                'product_assets',
                'product_style_templates',
                'product_ecommerce_exports'
            ]
            
            created_tables = [t for t in expected_tables if t in tables]
            missing_tables = [t for t in expected_tables if t not in tables]
            
            if created_tables:
                logger.info(f"✅ Created tables: {', '.join(created_tables)}")
            
            if missing_tables:
                logger.warning(f"⚠️ Missing tables: {', '.join(missing_tables)}")
            else:
                logger.info("🎉 All product asset tables verified!")
        
        # Verify indexes were created
        with engine.connect() as conn:
            inspector = inspect(engine)
            
            # Check ProductAsset indexes
            product_asset_indexes = inspector.get_indexes('product_assets')
            logger.info(f"✅ ProductAsset indexes: {len(product_asset_indexes)} indexes created")
            
            # Check ProductStyleTemplate indexes
            style_template_indexes = inspector.get_indexes('product_style_templates')
            logger.info(f"✅ ProductStyleTemplate indexes: {len(style_template_indexes)} indexes created")
            
            # Check EcommerceExport indexes
            ecommerce_export_indexes = inspector.get_indexes('product_ecommerce_exports')
            logger.info(f"✅ EcommerceExport indexes: {len(ecommerce_export_indexes)} indexes created")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error creating product asset tables: {e}")
        logger.error(traceback.format_exc())
        return False


if __name__ == "__main__":
    success = create_product_asset_tables()
    sys.exit(0 if success else 1)

