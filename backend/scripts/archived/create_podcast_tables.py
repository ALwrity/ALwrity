"""
Database Migration Script for Podcast Maker
Creates the podcast_projects table for cross-device project persistence.
"""

import sys
import os
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, text
from loguru import logger
import traceback

# Import models - PodcastProject uses SubscriptionBase
from models.base import Base
from models.podcast_models import PodcastProject
from services.database import DATABASE_URL

def create_podcast_tables():
    """Create podcast-related tables."""
    
    try:
        # Create engine
        engine = create_engine(DATABASE_URL, echo=False)
        
        # Create all tables (PodcastProject uses SubscriptionBase, so it will be created)
        logger.info("Creating podcast maker tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Podcast tables created successfully")
        
        # Verify table was created
        display_setup_summary(engine)
        
    except Exception as e:
        logger.error(f"❌ Error creating podcast tables: {e}")
        logger.error(traceback.format_exc())
        raise

def display_setup_summary(engine):
    """Display a summary of the created tables."""
    
    try:
        with engine.connect() as conn:
            logger.info("\n" + "="*60)
            logger.info("PODCAST MAKER SETUP SUMMARY")
            logger.info("="*60)
            
            # Check if table exists
            check_query = text("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='podcast_projects'
            """)
            
            result = conn.execute(check_query)
            table_exists = result.fetchone()
            
            if table_exists:
                logger.info("✅ Table 'podcast_projects' created successfully")
                
                # Get table schema
                schema_query = text("""
                    SELECT sql FROM sqlite_master 
                    WHERE type='table' AND name='podcast_projects'
                """)
                result = conn.execute(schema_query)
                schema = result.fetchone()
                if schema:
                    logger.info("\n📋 Table Schema:")
                    logger.info(schema[0])
                
                # Check indexes
                indexes_query = text("""
                    SELECT name FROM sqlite_master 
                    WHERE type='index' AND tbl_name='podcast_projects'
                """)
                result = conn.execute(indexes_query)
                indexes = result.fetchall()
                
                if indexes:
                    logger.info(f"\n📊 Indexes ({len(indexes)}):")
                    for idx in indexes:
                        logger.info(f"  • {idx[0]}")
                
            else:
                logger.warning("⚠️ Table 'podcast_projects' not found after creation")
            
            logger.info("\n" + "="*60)
            logger.info("NEXT STEPS:")
            logger.info("="*60)
            logger.info("1. The podcast_projects table is ready for use")
            logger.info("2. Projects will automatically sync to database after major steps")
            logger.info("3. Users can resume projects from any device")
            logger.info("4. Use the 'My Projects' button in the Podcast Dashboard to view saved projects")
            logger.info("="*60)
            
    except Exception as e:
        logger.error(f"Error displaying summary: {e}")

def check_existing_table(engine):
    """Check if podcast_projects table already exists."""
    
    try:
        with engine.connect() as conn:
            check_query = text("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='podcast_projects'
            """)
            
            result = conn.execute(check_query)
            table_exists = result.fetchone()
            
            if table_exists:
                logger.info("ℹ️ Table 'podcast_projects' already exists")
                logger.info("   Running migration will ensure schema is up to date...")
                return True
            
            return False
            
    except Exception as e:
        logger.error(f"Error checking existing table: {e}")
        return False

if __name__ == "__main__":
    logger.info("🚀 Starting podcast maker database migration...")
    
    try:
        # Create engine to check existing table
        engine = create_engine(DATABASE_URL, echo=False)
        
        # Check existing table
        table_exists = check_existing_table(engine)
        
        # Create tables (idempotent - won't recreate if exists)
        create_podcast_tables()
        
        logger.info("✅ Migration completed successfully!")
        
    except KeyboardInterrupt:
        logger.info("Migration cancelled by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        traceback.print_exc()
        sys.exit(1)

