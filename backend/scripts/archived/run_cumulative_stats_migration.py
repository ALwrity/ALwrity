#!/usr/bin/env python3
"""
Script to run the cumulative stats migration.
This creates the scheduler_cumulative_stats table.
"""

import sqlite3
import os
import sys
import argparse

# Get the database path
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
sys.path.insert(0, str(backend_dir))

from services.database import get_user_db_path

def run_migration(user_id=None):
    if user_id:
        db_path = get_user_db_path(user_id)
        print(f"Targeting user database: {db_path}")
    else:
        print("❌ Error: user_id is required for migration.")
        return False

    migration_path = os.path.join(backend_dir, 'database', 'migrations', 'create_scheduler_cumulative_stats.sql')

    if not os.path.exists(db_path):
        print(f"❌ Database not found at {db_path}")
        return False

    if not os.path.exists(migration_path):
        print(f"❌ Migration file not found at {migration_path}")
        return False

    try:
        conn = sqlite3.connect(db_path)
        with open(migration_path, 'r') as f:
            conn.executescript(f.read())
        conn.commit()
        print("✅ Migration executed successfully")
        conn.close()
        return True
    except Exception as e:
        print(f"❌ Error running migration: {e}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run cumulative stats migration")
    parser.add_argument("--user_id", help="Target specific user ID")
    args = parser.parse_args()
    
    success = run_migration(args.user_id)
    sys.exit(0 if success else 1)

