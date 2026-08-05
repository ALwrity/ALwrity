#!/usr/bin/env python3
"""
Script to create enhanced strategy tables in the database.
Run this script to ensure all enhanced strategy tables are created before monitoring tables.
"""

import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.database import engine
from models.base import Base
from loguru import logger

def create_enhanced_strategy_tables():
    """Create all enhanced strategy tables"""
    try:
        logger.info("Creating enhanced strategy tables...")
        
        # Create enhanced strategy tables first
        Base.metadata.create_all(bind=engine)
        
        logger.info("✅ Enhanced strategy tables created successfully!")
        
    except Exception as e:
        logger.error(f"❌ Error creating enhanced strategy tables: {e}")
        sys.exit(1)

if __name__ == "__main__":
    create_enhanced_strategy_tables()
