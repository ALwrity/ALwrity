
import os
import sys
import sqlite3

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.database import get_user_db_path

user_id = "user_33Gz1FPI86VDXhRY8QN4ragRFGN"
resolved = get_user_db_path(user_id)
legacy_filename = "alwrity.db"
print(f"Resolved active DB path for user {user_id}: {resolved}")
print(f"Legacy filename still supported in db/: {legacy_filename}")

def check_db(path):
    if not os.path.exists(path):
        print(f"  [MISSING] {path}")
        return
    
    try:
        conn = sqlite3.connect(path)
        cursor = conn.cursor()
        cursor.execute("SELECT count(*) FROM api_usage_logs")
        count = cursor.fetchone()[0]
        print(f"  [EXISTS] {path} - Rows in api_usage_logs: {count}")
        conn.close()
    except Exception as e:
        print(f"  [EXISTS] {path} - Error reading: {e}")

check_db(resolved)

print("-" * 30)
print(f"Application resolves to: {resolved}")
