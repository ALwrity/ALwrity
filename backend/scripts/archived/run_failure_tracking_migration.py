"""
Script to run the failure tracking migration.
Adds consecutive_failures and failure_pattern columns to task tables.
"""

import sqlite3
import os
import sys
import argparse
from pathlib import Path

# Add parent directory to path to import migration
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.database import get_user_db_path

def run_migration(user_id=None):
    """Run the failure tracking migration."""
    if user_id:
        db_path = get_user_db_path(user_id)
        print(f"Targeting user database: {db_path}")
    else:
        print("❌ Error: user_id is required for migration.")
        return False
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return False
    
    print(f"Running migration on database: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Read migration SQL
        migration_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'database',
            'migrations',
            'add_failure_tracking_to_tasks.sql'
        )
        
        if not os.path.exists(migration_file):
            print(f"Migration file not found: {migration_file}")
            return False
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        # Execute migration (SQLite doesn't support multiple statements in execute, so split)
        statements = [s.strip() for s in migration_sql.split(';') if s.strip()]
        
        for statement in statements:
            try:
                cursor.execute(statement)
                print(f"✓ Executed: {statement[:50]}...")
            except sqlite3.OperationalError as e:
                # Column might already exist - that's okay
                if 'duplicate column name' in str(e).lower() or 'already exists' in str(e).lower():
                    print(f"⚠ Column already exists (skipping): {statement[:50]}...")
                else:
                    raise
        
        conn.commit()
        print("\n✅ Migration completed successfully!")
        
        # Verify columns were added
        cursor.execute("PRAGMA table_info(oauth_token_monitoring_tasks)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'consecutive_failures' in columns and 'failure_pattern' in columns:
            print("✓ Verified: consecutive_failures and failure_pattern columns exist")
        else:
            print("⚠ Warning: Could not verify columns were added")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error running migration: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run failure tracking migration")
    parser.add_argument("--user_id", help="Target specific user ID")
    args = parser.parse_args()

    success = run_migration(args.user_id)
    sys.exit(0 if success else 1)

