"""
Add brand_analysis and content_strategy_insights columns to website_analyses table.
These columns store rich brand insights and SWOT analysis from Step 2.
"""

import sys
import os
from pathlib import Path
from loguru import logger

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text, inspect
from services.database import SessionLocal, engine


def add_brand_analysis_columns():
    """Add brand_analysis and content_strategy_insights columns if they don't exist."""
    
    db = SessionLocal()
    
    try:
        # Check if columns already exist
        inspector = inspect(engine)
        columns = [col['name'] for col in inspector.get_columns('website_analyses')]
        
        brand_analysis_exists = 'brand_analysis' in columns
        content_strategy_insights_exists = 'content_strategy_insights' in columns
        
        if brand_analysis_exists and content_strategy_insights_exists:
            logger.info("✅ Columns already exist. No migration needed.")
            return True
        
        logger.info("🔄 Starting migration to add brand analysis columns...")
        
        # Add brand_analysis column if missing
        if not brand_analysis_exists:
            logger.info("Adding brand_analysis column...")
            db.execute(text("""
                ALTER TABLE website_analyses 
                ADD COLUMN brand_analysis JSON
            """))
            logger.success("✅ Added brand_analysis column")
        
        # Add content_strategy_insights column if missing
        if not content_strategy_insights_exists:
            logger.info("Adding content_strategy_insights column...")
            db.execute(text("""
                ALTER TABLE website_analyses 
                ADD COLUMN content_strategy_insights JSON
            """))
            logger.success("✅ Added content_strategy_insights column")
        
        db.commit()
        logger.success("🎉 Migration completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("DATABASE MIGRATION: Add Brand Analysis Columns")
    logger.info("=" * 60)
    
    success = add_brand_analysis_columns()
    
    if success:
        logger.success("\n✅ Migration completed successfully!")
        logger.info("The website_analyses table now includes:")
        logger.info("  - brand_analysis: Brand voice, values, positioning")
        logger.info("  - content_strategy_insights: SWOT analysis, recommendations")
    else:
        logger.error("\n❌ Migration failed. Please check the error messages above.")
        sys.exit(1)

