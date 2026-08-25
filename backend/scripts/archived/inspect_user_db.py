import os
import sys
import sqlite3

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.database import get_user_db_path

user_id = "user_33Gz1FPI86VDXhRY8QN4ragRFGN"
db_path = get_user_db_path(user_id)

print(f"Reading from: {db_path}")

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("\n--- API Usage Logs ---")
cursor.execute("SELECT * FROM api_usage_logs")
rows = cursor.fetchall()
for row in rows:
    print(dict(row))

print("\n--- Subscription Plans ---")
try:
    cursor.execute("SELECT * FROM subscription_plans")
    rows = cursor.fetchall()
    for row in rows:
        print(dict(row))
except Exception as e:
    print(f"Error reading subscription_plans: {e}")

print("\n--- Usage Summaries ---")
try:
    cursor.execute("SELECT * FROM usage_summaries")
    rows = cursor.fetchall()
    for row in rows:
        print(dict(row))
except Exception as e:
    print(f"Error reading usage_summaries: {e}")

conn.close()
