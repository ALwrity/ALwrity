#!/usr/bin/env python3
"""
Fix website analysis index name conflicts.
Drops old conflicting indexes and ensures proper index names.
"""

import sys
import os
import sqlite3
import argparse
from pathlib import Path
from loguru import logger

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from services.database import get_user_db_path

def fix_indexes(user_id=None):
    """Fix index name conflicts."""
    if user_id:
        db_path = Path(get_user_db_path(user_id))
        logger.info(f"Targeting user database: {db_path}")
    else:
        # Legacy fallback
        db_path = Path(get_user_db_path('alwrity'))
        logger.info(f"Targeting default/legacy database: {db_path}")
    
    if not db_path.exists():
        logger.error(f"Database not found at {db_path}")
        return False
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    try:
        # Check for old conflicting indexes
        cursor.execute("""
            SELECT name, tbl_name 
            FROM sqlite_master 
            WHERE type='index' 
            AND name = 'idx_status'
            AND tbl_name IN ('website_analysis_tasks', 'website_analysis_execution_logs')
        """)
        
        conflicting = cursor.fetchall()
        
        if conflicting:
            logger.warning(f"Found {len(conflicting)} conflicting indexes:")
            for name, tbl_name in conflicting:
                logger.warning(f"  - {name} on {tbl_name}")
            
            # Drop old indexes
            for name, tbl_name in conflicting:
                try:
                    cursor.execute(f"DROP INDEX IF EXISTS {name}")
                    logger.info(f"✅ Dropped old index: {name} on {tbl_name}")
                except Exception as e:
                    logger.error(f"❌ Error dropping index {name}: {e}")
            
            conn.commit()
            logger.info("✅ Index conflicts resolved")
        else:
            logger.info("✅ No conflicting indexes found")
        
        # Verify correct indexes exist
        cursor.execute("""
            SELECT name, tbl_name 
            FROM sqlite_master 
            WHERE type='index' 
            AND (name LIKE '%website_analysis%' OR name LIKE '%competitor_analyses%')
            ORDER BY tbl_name, name
        """)
        
        indexes = cursor.fetchall()
        logger.info(f"\n📋 Current website analysis indexes ({len(indexes)}):")
        for name, tbl_name in indexes:
            logger.info(f"  - {name} on {tbl_name}")
        
        return True
        
    except Exception as e:
        logger.error(f"Error fixing indexes: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fix website analysis index conflicts.")
    parser.add_argument("--user_id", help="Target specific user ID")
    args = parser.parse_args()

    logger.info("🔧 Fixing website analysis index conflicts...")
    success = fix_indexes(args.user_id)
    if success:
        logger.info("✅ Index fix complete. You can now restart the backend.")
        sys.exit(0)
    else:
        logger.error("❌ Index fix failed")
        sys.exit(1)

