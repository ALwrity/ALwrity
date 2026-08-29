#!/usr/bin/env python3
"""
Migration script to add WaveSpeed provider fields to UsageSummary table
Run this script to update the database schema for WaveSpeed usage tracking
"""

import sqlite3
import os
import sys

def find_database():
    """Find the database file in common locations"""
    print("🔍 Searching for database files...")
    
    # Search in current directory and subdirectories
    for root, dirs, files in os.walk('.'):
        for file in files:
            if file.endswith('.db') or file.endswith('.sqlite'):
                db_path = os.path.join(root, file)
                print(f"📁 Found database: {db_path}")
                return db_path
    
    # Check common paths
    search_paths = [
        './data/alwrity.db',
        './alwrity.db', 
        './database/alwrity.db',
        './backend/data/alwrity.db',
        './backend/alwrity.db'
    ]
    
    for path in search_paths:
        if os.path.exists(path):
            print(f"📁 Found database at common path: {path}")
            return path
    
    print("❌ No database file found in any location")
    return None

def run_migration():
    """Execute the WaveSpeed migration"""
    db_path = find_database()
    
    if not db_path:
        print("❌ No database file found")
        print("Please ensure the application has been run at least once to create the database")
        return False
    
    print(f"📁 Using database: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if columns already exist
        cursor.execute('PRAGMA table_info(usage_summary)')
        columns = [col[1] for col in cursor.fetchall()]
        
        wavespeed_cols = [col for col in columns if 'wavespeed' in col]
        
        if wavespeed_cols:
            print(f"✅ WaveSpeed columns already exist: {wavespeed_cols}")
            return True
        
        print("🔧 Adding WaveSpeed columns to usage_summary table...")
        
        # Add the columns
        cursor.execute('ALTER TABLE usage_summary ADD COLUMN wavespeed_calls INTEGER DEFAULT 0')
        cursor.execute('ALTER TABLE usage_summary ADD COLUMN wavespeed_tokens INTEGER DEFAULT 0')
        cursor.execute('ALTER TABLE usage_summary ADD COLUMN wavespeed_cost FLOAT DEFAULT 0.0')
        
        conn.commit()
        
        # Verify the changes
        cursor.execute('PRAGMA table_info(usage_summary)')
        updated_columns = [col[1] for col in cursor.fetchall()]
        added_wavespeed_cols = [col for col in updated_columns if 'wavespeed' in col]
        
        print(f"✅ Successfully added WaveSpeed columns: {added_wavespeed_cols}")
        
        return True
        
    except sqlite3.Error as e:
        print(f"❌ SQLite error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    print("🚀 Running WaveSpeed migration...")
    success = run_migration()
    
    if success:
        print("✅ WaveSpeed migration completed successfully!")
        print("The system can now track WaveSpeed LLM usage and costs.")
    else:
        print("❌ Migration failed. Please check the error messages above.")
        sys.exit(1)
