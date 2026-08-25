#!/usr/bin/env python3
"""
Script to check database tables and debug foreign key issues.
"""

import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.database import engine
from sqlalchemy import inspect
from loguru import logger

def check_database_tables():
    """Check what tables exist in the database"""
    try:
        logger.info("Checking database tables...")
        
        # Get inspector
        inspector = inspect(engine)
        
        # Get all table names
        table_names = inspector.get_table_names()
        
        logger.info(f"Found {len(table_names)} tables:")
        for table_name in sorted(table_names):
            logger.info(f"  - {table_name}")
            
        # Check if enhanced_content_strategies exists
        if 'enhanced_content_strategies' in table_names:
            logger.info("✅ enhanced_content_strategies table exists!")
            
            # Get columns for this table
            columns = inspector.get_columns('enhanced_content_strategies')
            logger.info(f"Columns in enhanced_content_strategies:")
            for column in columns:
                logger.info(f"  - {column['name']}: {column['type']}")
        else:
            logger.error("❌ enhanced_content_strategies table does not exist!")
            
    except Exception as e:
        logger.error(f"❌ Error checking database tables: {e}")
        sys.exit(1)

if __name__ == "__main__":
    check_database_tables()
