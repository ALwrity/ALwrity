#!/usr/bin/env python3
"""
Migration script to create the user_business_info table.
This script should be run once to set up the database schema.
"""

import os
import sys
import sqlite3
from pathlib import Path
from loguru import logger

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from services.database import get_user_db_path

def run_migration(user_id=None):
    """Run the business info table migration."""
    try:
        # Get the database path
        if user_id:
            db_path = Path(get_user_db_path(user_id))
            logger.info(f"Targeting user database: {db_path}")
        else:
            logger.error("❌ Error: user_id is required for migration.")
            return False
        
        logger.info(f"🔄 Starting business info table migration...")
        logger.info(f"📁 Database path: {db_path}")
        
        # Check if database exists
        if not db_path.exists():
            logger.warning(f"⚠️ Database file not found at {db_path}")
            logger.info("📝 Creating new database file...")
        
        # Read the migration SQL
        migration_file = backend_dir / "database" / "migrations" / "add_business_info_table.sql"
        
        if not migration_file.exists():
            logger.error(f"❌ Migration file not found: {migration_file}")
            return False
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        logger.info("📋 Migration SQL loaded successfully")
        
        # Connect to database and run migration
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Check if table already exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='user_business_info'
        """)
        
        if cursor.fetchone():
            logger.info("ℹ️ Table 'user_business_info' already exists, skipping migration")
            conn.close()
            return True
        
        # Execute the migration
        cursor.executescript(migration_sql)
        conn.commit()
        
        # Verify the table was created
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='user_business_info'
        """)
        
        if cursor.fetchone():
            logger.success("✅ Migration completed successfully!")
            logger.info("📊 Table 'user_business_info' created with the following structure:")
            
            # Show table structure
            cursor.execute("PRAGMA table_info(user_business_info)")
            columns = cursor.fetchall()
            
            for col in columns:
                logger.info(f"   - {col[1]} ({col[2]}) {'NOT NULL' if col[3] else 'NULL'}")
            
            conn.close()
            return True
        else:
            logger.error("❌ Migration failed - table was not created")
            conn.close()
            return False
            
    except Exception as e:
        logger.error(f"❌ Migration failed with error: {str(e)}")
        return False

if __name__ == "__main__":
    logger.info("🚀 Starting ALwrity Business Info Migration")
    
    parser = argparse.ArgumentParser(description="Run business info migration")
    parser.add_argument("--user_id", help="Target specific user ID")
    args = parser.parse_args()
    
    success = run_migration(args.user_id)
    
    if success:
        logger.success("🎉 Migration completed successfully!")
        sys.exit(0)
    else:
        logger.error("💥 Migration failed!")
        sys.exit(1)
