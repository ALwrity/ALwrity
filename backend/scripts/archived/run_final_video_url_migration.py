#!/usr/bin/env python3
"""
Migration script to add final_video_url column to podcast_projects table.
This script should be run once to add the column to existing databases.
"""

import os
import sys
import sqlite3
import argparse
from pathlib import Path
from loguru import logger

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from services.database import get_user_db_path

def run_migration(user_id=None):
    """Run the final_video_url column migration."""
    try:
        # Get the database path
        if user_id:
            db_path = Path(get_user_db_path(user_id))
            logger.info(f"Targeting user database: {db_path}")
        else:
            logger.error("❌ Error: user_id is required for migration.")
            return False
        
        logger.info(f"🔄 Starting final_video_url column migration...")
        logger.info(f"📁 Database path: {db_path}")
        
        # Check if database exists
        if not db_path.exists():
            logger.warning(f"⚠️ Database file not found at {db_path}")
            logger.info("ℹ️ New databases will have this column created automatically by SQLAlchemy")
            return True
        
        # Read the migration SQL
        migration_file = backend_dir / "database" / "migrations" / "009_add_final_video_url_to_podcast_projects.sql"
        
        if not migration_file.exists():
            logger.error(f"❌ Migration file not found: {migration_file}")
            return False
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        logger.info("📋 Migration SQL loaded successfully")
        
        # Connect to database and run migration
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Check if column already exists
        cursor.execute("PRAGMA table_info(podcast_projects)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'final_video_url' in columns:
            logger.info("ℹ️ Column 'final_video_url' already exists, skipping migration")
            conn.close()
            return True
        
        # Execute the migration
        logger.info("🔧 Adding final_video_url column...")
        cursor.execute("ALTER TABLE podcast_projects ADD COLUMN final_video_url VARCHAR(1000) NULL")
        conn.commit()
        
        # Verify the column was added
        cursor.execute("PRAGMA table_info(podcast_projects)")
        columns_after = [row[1] for row in cursor.fetchall()]
        
        if 'final_video_url' in columns_after:
            logger.info("✅ Migration completed successfully! Column 'final_video_url' added to podcast_projects table")
            conn.close()
            return True
        else:
            logger.error("❌ Migration failed: Column was not added")
            conn.close()
            return False
            
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            logger.info("ℹ️ Column 'final_video_url' already exists, skipping migration")
            return True
        else:
            logger.error(f"❌ Database error: {e}")
            return False
    except Exception as e:
        logger.error(f"❌ Error running migration: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run final_video_url migration")
    parser.add_argument("--user_id", help="Target specific user ID")
    args = parser.parse_args()
    
    success = run_migration(args.user_id)
    sys.exit(0 if success else 1)

