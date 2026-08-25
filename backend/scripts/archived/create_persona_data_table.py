"""
Script to create the persona_data table for onboarding step 4.
This migration adds support for storing persona generation data.

Usage:
    python backend/scripts/create_persona_data_table.py
"""

import sys
import os
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from loguru import logger
from sqlalchemy import inspect

def create_persona_data_table():
    """Create the persona_data table."""
    try:
        # Import after path is set
        from services.database import engine
        from models.base import Base, PersonaData
        
        logger.info("🔍 Checking if persona_data table exists...")
        
        # Check if table already exists
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        
        if 'persona_data' in existing_tables:
            logger.info("✅ persona_data table already exists")
            return True
        
        logger.info("📊 Creating persona_data table...")
        
        # Create only the persona_data table
        PersonaData.__table__.create(bind=engine, checkfirst=True)
        
        logger.info("✅ persona_data table created successfully")
        
        # Verify creation
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        
        if 'persona_data' in existing_tables:
            logger.info("✅ Verification successful - persona_data table exists")
            
            # Show table structure
            columns = inspector.get_columns('persona_data')
            logger.info(f"📋 Table structure ({len(columns)} columns):")
            for col in columns:
                logger.info(f"   - {col['name']}: {col['type']}")
            
            return True
        else:
            logger.error("❌ Table creation verification failed")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error creating persona_data table: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False

def check_onboarding_tables():
    """Check all onboarding-related tables."""
    try:
        from services.database import engine
        from sqlalchemy import inspect
        
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        
        onboarding_tables = [
            'onboarding_sessions',
            'api_keys',
            'website_analyses',
            'research_preferences',
            'persona_data'
        ]
        
        logger.info("📋 Onboarding Tables Status:")
        for table in onboarding_tables:
            status = "✅" if table in existing_tables else "❌"
            logger.info(f"   {status} {table}")
        
        return True
        
    except Exception as e:
        logger.error(f"Error checking tables: {e}")
        return False

if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Persona Data Table Migration")
    logger.info("=" * 60)
    
    # Check existing tables
    check_onboarding_tables()
    
    logger.info("")
    
    # Create persona_data table
    if create_persona_data_table():
        logger.info("")
        logger.info("=" * 60)
        logger.info("✅ Migration completed successfully!")
        logger.info("=" * 60)
        
        # Check again to confirm
        logger.info("")
        check_onboarding_tables()
        
        sys.exit(0)
    else:
        logger.error("")
        logger.error("=" * 60)
        logger.error("❌ Migration failed!")
        logger.error("=" * 60)
        sys.exit(1)

