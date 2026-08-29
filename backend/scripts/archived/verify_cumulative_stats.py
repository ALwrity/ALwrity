#!/usr/bin/env python3
"""Verify cumulative stats table exists and has data"""

import sqlite3
import os
import sys
import argparse

script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
sys.path.insert(0, backend_dir)

from services.database import get_user_db_path

def verify_stats(user_id=None):
    if user_id:
        db_path = get_user_db_path(user_id)
        print(f"Targeting user database: {db_path}")
    else:
        print("❌ Error: user_id is required.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check if table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='scheduler_cumulative_stats'")
    result = cursor.fetchone()
    print(f"Table exists: {result is not None}")

    if result:
        cursor.execute("SELECT * FROM scheduler_cumulative_stats WHERE id=1")
        row = cursor.fetchone()
        if row:
            print(f"Row data: {row}")
        else:
            print("Table exists but no row with id=1")
    else:
        print("Table does not exist")

    conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Verify cumulative stats")
    parser.add_argument("--user_id", help="Target specific user ID")
    args = parser.parse_args()
    
    verify_stats(args.user_id)

