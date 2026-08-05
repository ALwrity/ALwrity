"""
One-time migration: shift onboarding_sessions.current_step from old (1-6)
to new numbering (1-5) after removal of the Integrations step.

Old → New mapping:
  1 (API keys)  → 1 (Connect Platforms) — no change
  2 (Website)   → 1 (Connect Platforms)
  3 (Research)  → 2 (Research)
  4 (Persona)   → 3 (Personalization)
  5 (Integ.)    → 4 (Finish) — skip removed step
  6 (Complete)  → 5 (Complete)

Run from the backend directory:
    python migrations/migrate_step_numbering_v2.py

This is idempotent — safe to run multiple times.
"""

import sqlite3
import os
import sys

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_ROOT)


def migrate_step(old: int) -> int:
    if old == 0:
        return 0
    if 2 <= old <= 6:
        return old - 1
    return old


def main():
    from services.database import get_workspace_root, get_user_db_path
    import glob

    workspace = get_workspace_root()
    pattern = os.path.join(workspace, "*.db")
    db_files = glob.glob(pattern)

    if not db_files:
        print(f"No .db files found in {workspace}")
        return

    total_updated = 0

    for db_path in db_files:
        try:
            conn = sqlite3.connect(db_path)
            rows = conn.execute(
                "SELECT id, user_id, current_step FROM onboarding_sessions"
            ).fetchall()

            updates = []
            for row_id, user_id, old_step in rows:
                new_step = migrate_step(old_step or 0)
                if new_step != old_step:
                    updates.append((new_step, row_id))
                    print(f"  user={user_id}: step {old_step} → {new_step}")

            if updates:
                conn.executemany(
                    "UPDATE onboarding_sessions SET current_step = ? WHERE id = ?",
                    updates,
                )
                conn.commit()
                total_updated += len(updates)
            elif rows:
                print(f"  {db_path}: all {len(rows)} sessions already at correct steps")

            conn.close()
        except Exception as e:
            print(f"  ERROR processing {db_path}: {e}")

    print(f"\nMigrated {total_updated} session(s) across {len(db_files)} database(s)")


if __name__ == "__main__":
    main()
