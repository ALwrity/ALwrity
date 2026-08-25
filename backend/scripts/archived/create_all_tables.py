#!/usr/bin/env python3
"""
Script to create all database tables in the correct order.
This ensures foreign key dependencies are satisfied.
"""

import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.database import engine
from models.base import Base
from models.base import Base
from models.base import Base
from loguru import logger

def create_all_tables():
    """Create all tables in the correct order"""
    try:
        logger.info("Creating all database tables...")
        
        # Step 1: Create enhanced strategy tables first
        logger.info("Step 1: Creating enhanced strategy tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Enhanced strategy tables created!")
        
        # Step 2: Create monitoring tables
        logger.info("Step 2: Creating monitoring tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Monitoring tables created!")
        
        # Step 3: Create persona tables
        logger.info("Step 3: Creating persona tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Persona tables created!")
        
        logger.info("✅ All tables created successfully!")
        
    except Exception as e:
        logger.error(f"❌ Error creating tables: {e}")
        sys.exit(1)

if __name__ == "__main__":
    create_all_tables()
