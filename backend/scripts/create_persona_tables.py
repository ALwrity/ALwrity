#!/usr/bin/env python3
"""
Script to create persona database tables.
This script creates the new persona-related tables for storing writing personas.
"""

import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.database import engine
from models.base import Base
from loguru import logger

def create_persona_tables():
    """Create all persona-related tables"""
    try:
        logger.info("Creating persona database tables...")
        
        # Create persona tables
        logger.info("Creating persona tables...")
        PersonaBase.metadata.create_all(bind=engine)
        logger.info("✅ Persona tables created!")
        
        logger.info("✅ All persona tables created successfully!")
        
        # Verify tables were created
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        persona_tables = [
            'writing_personas',
            'platform_personas', 
            'persona_analysis_results',
            'persona_validation_results'
        ]
        
        created_tables = [table for table in persona_tables if table in tables]
        logger.info(f"✅ Verified tables created: {created_tables}")
        
        if len(created_tables) != len(persona_tables):
            missing = [table for table in persona_tables if table not in created_tables]
            logger.warning(f"⚠️ Missing tables: {missing}")
        
    except Exception as e:
        logger.error(f"❌ Error creating persona tables: {e}")
        sys.exit(1)

if __name__ == "__main__":
    create_persona_tables()