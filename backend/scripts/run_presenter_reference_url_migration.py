import os
import sys
import sqlite3
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

def migrate_db(db_path: Path) -> bool:
    if not db_path.exists():
        print(f"[-] DB not found: {db_path}")
        return False

    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()

        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='podcast_projects'")
        if not cursor.fetchone():
            conn.close()
            return True

        cursor.execute("PRAGMA table_info(podcast_projects)")
        columns = [row[1] for row in cursor.fetchall()]

        if "presenter_reference_url" in columns:
            print(f"[+] {db_path.name}: 'presenter_reference_url' already exists.")
            conn.close()
            return True

        print(f"[*] {db_path.name}: Adding 'presenter_reference_url' column...")
        cursor.execute("ALTER TABLE podcast_projects ADD COLUMN presenter_reference_url VARCHAR(1000) NULL")
        conn.commit()

        cursor.execute("PRAGMA table_info(podcast_projects)")
        columns_after = [row[1] for row in cursor.fetchall()]
        conn.close()

        if "presenter_reference_url" in columns_after:
            print(f"[SUCCESS] {db_path.name}: 'presenter_reference_url' column added successfully!")
            return True
        else:
            print(f"[ERROR] {db_path.name}: Failed to verify column addition.")
            return False

    except Exception as e:
        print(f"[ERROR] {db_path.name}: Migration failed: {e}")
        return False

def main():
    root_dir = backend_dir.parent
    db_files = list(root_dir.glob("**/*.db"))
    print(f"Found {len(db_files)} .db files to check.")

    success_count = 0
    for db_path in db_files:
        if migrate_db(db_path):
            success_count += 1

    print(f"\nMigration complete: {success_count}/{len(db_files)} databases checked/migrated successfully.")

if __name__ == "__main__":
    main()
