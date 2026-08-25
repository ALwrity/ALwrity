#!/usr/bin/env python3
"""
Database migration script to create comprehensive user data cache table.
Run this script to add the cache table to your database.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from loguru import logger
import argparse
from services.database import get_user_db_path

def create_cache_table(user_id=None):
    """Create the comprehensive user data cache table."""
    try:
        # Get database URL from environment or use default
        if user_id:
            db_path = get_user_db_path(user_id)
            database_url = f'sqlite:///{db_path}'
            logger.info(f"Targeting user database: {db_path}")
        else:
            logger.error("❌ Error: user_id is required to create cache table.")
            return False
        
        # Create engine
        engine = create_engine(database_url)
        
        # Create session
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        # SQL to create the cache table
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS comprehensive_user_data_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            strategy_id INTEGER,
            data_hash VARCHAR(64) NOT NULL,
            comprehensive_data JSON NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
            access_count INTEGER DEFAULT 0
        );
        """
        
        # Create indexes
        create_indexes_sql = [
            "CREATE INDEX IF NOT EXISTS idx_user_strategy ON comprehensive_user_data_cache(user_id, strategy_id);",
            "CREATE INDEX IF NOT EXISTS idx_expires_at ON comprehensive_user_data_cache(expires_at);",
            "CREATE INDEX IF NOT EXISTS idx_data_hash ON comprehensive_user_data_cache(data_hash);"
        ]
        
        # Execute table creation
        logger.info("Creating comprehensive_user_data_cache table...")
        db.execute(text(create_table_sql))
        
        # Execute index creation
        logger.info("Creating indexes...")
        for index_sql in create_indexes_sql:
            db.execute(text(index_sql))
        
        # Commit changes
        db.commit()
        
        # Verify table creation
        result = db.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='comprehensive_user_data_cache';"))
        table_exists = result.fetchone()
        
        if table_exists:
            logger.info("✅ Comprehensive user data cache table created successfully!")
            
            # Show table structure
            result = db.execute(text("PRAGMA table_info(comprehensive_user_data_cache);"))
            columns = result.fetchall()
            
            logger.info("Table structure:")
            for column in columns:
                logger.info(f"  - {column[1]} ({column[2]})")
                
        else:
            logger.error("❌ Failed to create comprehensive_user_data_cache table")
            return False
            
        db.close()
        return True
        
    except Exception as e:
        logger.error(f"❌ Error creating cache table: {str(e)}")
        if 'db' in locals():
            db.close()
        return False

def drop_cache_table(user_id=None):
    """Drop the comprehensive user data cache table (for testing)."""
    try:
        # Get database URL from environment or use default
        if user_id:
            db_path = get_user_db_path(user_id)
            database_url = f'sqlite:///{db_path}'
            logger.info(f"Targeting user database: {db_path}")
        else:
            logger.error("❌ Error: user_id is required to drop cache table.")
            return False
        
        # Create engine
        engine = create_engine(database_url)
        
        # Create session
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        logger.info("Dropping comprehensive_user_data_cache table...")
        db.execute(text("DROP TABLE IF EXISTS comprehensive_user_data_cache"))
        db.commit()
        logger.info("✅ Table dropped successfully")
        
        db.close()
        return True
            
    except Exception as e:
        logger.error(f"❌ Error dropping cache table: {str(e)}")
        if 'db' in locals():
            db.close()
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create comprehensive user data cache table")
    parser.add_argument("--user_id", help="Target specific user ID")
    parser.add_argument("--drop", action="store_true", help="Drop the table instead of creating it")
    args = parser.parse_args()
    
    if args.drop:
        logger.info("🗑️ Dropping comprehensive user data cache table...")
        success = drop_cache_table(args.user_id)
    else:
        logger.info("🚀 Creating comprehensive user data cache table...")
        success = create_cache_table(args.user_id)
    
    if success:
        logger.success("🎉 Operation completed successfully!")
        sys.exit(0)
    else:
        logger.error("❌ Operation failed!")
        sys.exit(1)
