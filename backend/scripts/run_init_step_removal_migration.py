#!/usr/bin/env python3
"""
Migration script to remove the Init step (backend step 1 / API Keys) and renumber
remaining onboarding steps.

After this migration:
  Step 1 = Website Analysis (was step 2)
  Step 2 = AI Research     (was step 3)
  Step 3 = Personalization (was step 4)
  Step 4 = Integrations    (was step 5)
  Step 5 = Complete Setup  (was step 6)

Transforms existing session current_step values:
  old 0,1 -> new 1 (Website)
  old 2   -> new 1 (Website)
  old 3   -> new 2 (Research)
  old 4   -> new 3 (Personalization)
  old 5   -> new 4 (Integrations)
  old 6   -> new 5 (Complete Setup)
"""

import os
import sys
import sqlite3
import argparse
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from services.database import get_user_db_path


def migrate_database(db_path: str, label: str = "") -> bool:
    """Apply the current_step transformation to a single database."""
    prefix = f"[{label}] " if label else ""
    print(f"{prefix}📁 Database: {db_path}")

    if not os.path.exists(db_path):
        print(f"{prefix}⚠️  File not found, skipping")
        return False

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check if onboarding_sessions table exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='onboarding_sessions'"
        )
        if not cursor.fetchone():
            print(f"{prefix}ℹ️  No onboarding_sessions table, skipping")
            conn.close()
            return True

        # Count rows that would be affected
        cursor.execute("SELECT COUNT(*) FROM onboarding_sessions")
        total = cursor.fetchone()[0]
        if total == 0:
            print(f"{prefix}ℹ️  onboarding_sessions table is empty")
            conn.close()
            return True

        cursor.execute(
            "SELECT COUNT(*) FROM onboarding_sessions WHERE current_step > 0"
        )
        affected = cursor.fetchone()[0]

        print(f"{prefix}📊 Found {total} session(s), {affected} will be updated")

        if affected == 0:
            print(f"{prefix}✅ No rows need updating")
            conn.close()
            return True

        # Apply the transformation
        cursor.execute("""
            UPDATE onboarding_sessions
            SET current_step = CASE
                WHEN current_step <= 1 THEN 1
                ELSE current_step - 1
            END
        """)
        conn.commit()

        # Verify
        cursor.execute("SELECT current_step, COUNT(*) FROM onboarding_sessions GROUP BY current_step ORDER BY current_step")
        rows = cursor.fetchall()
        print(f"{prefix}✅ Updated {affected} row(s). Step distribution:")
        for step, count in rows:
            print(f"{prefix}   Step {step}: {count} session(s)")

        conn.close()
        return True

    except Exception as e:
        print(f"{prefix}❌ Error: {e}")
        return False


def migrate_all_user_databases():
    """Find and migrate all user databases."""
    print("🚀 Starting Init-step removal migration for all user databases...")
    print()

    workspace_dir = backend_dir / "workspace"
    if not workspace_dir.exists():
        print(f"❌ Workspace directory not found: {workspace_dir}")
        return False

    user_workspaces = [
        d for d in workspace_dir.iterdir()
        if d.is_dir() and d.name.startswith("workspace_")
    ]
    if not user_workspaces:
        print("❌ No user workspace directories found")
        return False

    print(f"📁 Found {len(user_workspaces)} user workspace(s)")
    print()

    success_count = 0
    for ws in sorted(user_workspaces):
        user_id = ws.name.replace("workspace_", "")
        db_path = get_user_db_path(user_id)
        if migrate_database(db_path, label=user_id[:12]):
            success_count += 1

    print()
    print(f"🎉 Migration completed!")
    print(f"✅ Successfully migrated: {success_count}/{len(user_workspaces)} database(s)")
    return success_count > 0


def main():
    parser = argparse.ArgumentParser(
        description="Migrate onboarding session current_step values after removing Init step"
    )
    parser.add_argument("--user_id", help="Migrate only a specific user")
    args = parser.parse_args()

    if args.user_id:
        print(f"🎯 Migrating specific user: {args.user_id}")
        db_path = get_user_db_path(args.user_id)
        success = migrate_database(db_path, label=args.user_id)
    else:
        success = migrate_all_user_databases()

    if success:
        print("\n✅ Init-step removal migration completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Migration failed. Check errors above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
