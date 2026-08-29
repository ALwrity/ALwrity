#!/usr/bin/env python3
"""
WaveSpeed Migration Script for Per-User SQLite Databases
This script finds user databases and adds WaveSpeed columns to usage_summaries table
"""

import os
import sqlite3
import sys
from pathlib import Path

def get_user_db_path(user_id: str) -> str:
    """Get the database path for a specific user."""
    # Sanitize user_id to be safe for filesystem
    safe_user_id = "".join(c for c in user_id if c.isalnum() or c in ('-', '_'))
    
    # Get workspace directory (assuming we're in backend folder)
    root_dir = Path(__file__).parent.parent
    workspace_dir = root_dir / 'workspace'
    user_workspace = workspace_dir / f"workspace_{safe_user_id}"
    
    # Check for legacy naming convention first
    legacy_db_path = user_workspace / 'db' / 'alwrity.db'
    specific_db_path = user_workspace / 'db' / f'alwrity_{safe_user_id}.db'
    
    # If the specific one exists, use it (preferred)
    if specific_db_path.exists():
        return str(specific_db_path)
        
    # If legacy exists and specific doesn't, use legacy
    if legacy_db_path.exists():
        return str(legacy_db_path)
        
    # Default to specific for new databases
    return str(specific_db_path)

def migrate_user_database(user_id: str, db_path: str) -> bool:
    """Migrate a single user database"""
    print(f"\n🔧 Migrating database for user: {user_id}")
    print(f"📁 Database path: {db_path}")
    
    if not os.path.exists(db_path):
        print(f"❌ Database file not found: {db_path}")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if usage_summaries table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='usage_summaries'")
        table_exists = cursor.fetchone()
        
        if not table_exists:
            print("⚠️  usage_summaries table not found, skipping this database")
            return True
        
        # Check if columns already exist
        cursor.execute('PRAGMA table_info(usage_summaries)')
        columns = [col[1] for col in cursor.fetchall()]
        
        wavespeed_cols = [col for col in columns if 'wavespeed' in col]
        
        if wavespeed_cols:
            print(f"✅ WaveSpeed columns already exist: {wavespeed_cols}")
            return True
        
        print("➕ Adding WaveSpeed columns...")
        
        # Add the columns
        try:
            cursor.execute('ALTER TABLE usage_summaries ADD COLUMN wavespeed_calls INTEGER DEFAULT 0')
            print("  ✅ Added wavespeed_calls")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("  ⚠️  wavespeed_calls already exists")
            else:
                raise e
        
        try:
            cursor.execute('ALTER TABLE usage_summaries ADD COLUMN wavespeed_tokens INTEGER DEFAULT 0')
            print("  ✅ Added wavespeed_tokens")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("  ⚠️  wavespeed_tokens already exists")
            else:
                raise e
        
        try:
            cursor.execute('ALTER TABLE usage_summaries ADD COLUMN wavespeed_cost REAL DEFAULT 0.0')
            print("  ✅ Added wavespeed_cost")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("  ⚠️  wavespeed_cost already exists")
            else:
                raise e
        
        conn.commit()
        
        # Verify the changes
        cursor.execute('PRAGMA table_info(usage_summaries)')
        updated_columns = [col[1] for col in cursor.fetchall()]
        added_wavespeed_cols = [col for col in updated_columns if 'wavespeed' in col]
        
        print(f"✅ WaveSpeed columns successfully added: {added_wavespeed_cols}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error migrating database: {e}")
        return False
    finally:
        if 'conn' in locals():
            conn.close()

def migrate_all_user_databases():
    """Find and migrate all user databases"""
    print("🚀 Starting WaveSpeed migration for all user databases...")
    
    # Get workspace directory
    root_dir = Path(__file__).parent.parent
    workspace_dir = root_dir / 'workspace'
    
    if not workspace_dir.exists():
        print(f"❌ Workspace directory not found: {workspace_dir}")
        return False
    
    # Find all user workspace directories
    user_workspaces = [d for d in workspace_dir.iterdir() if d.is_dir() and d.name.startswith('workspace_')]
    
    if not user_workspaces:
        print("❌ No user workspace directories found")
        return False
    
    print(f"📁 Found {len(user_workspaces)} user workspace directories")
    
    success_count = 0
    
    for workspace_dir in user_workspaces:
        # Extract user_id from directory name
        user_id = workspace_dir.name.replace('workspace_', '')
        
        # Get database path
        db_path = get_user_db_path(user_id)
        
        # Migrate this user's database
        if migrate_user_database(user_id, db_path):
            success_count += 1
    
    print(f"\n🎉 Migration completed!")
    print(f"✅ Successfully migrated: {success_count}/{len(user_workspaces)} databases")
    
    return success_count > 0

def migrate_specific_user(user_id: str):
    """Migrate a specific user's database"""
    print(f"🎯 Migrating specific user: {user_id}")
    
    db_path = get_user_db_path(user_id)
    return migrate_user_database(user_id, db_path)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Migrate specific user
        user_id = sys.argv[1]
        success = migrate_specific_user(user_id)
    else:
        # Migrate all users
        success = migrate_all_user_databases()
    
    if success:
        print("\n✅ WaveSpeed migration completed successfully!")
        print("The system can now track WaveSpeed LLM usage and costs.")
    else:
        print("\n❌ Migration failed. Please check the error messages above.")
        sys.exit(1)
