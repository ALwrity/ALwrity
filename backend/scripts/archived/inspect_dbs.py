import os
import sqlite3
import pandas as pd
from pathlib import Path

def inspect_dbs():
    root = Path(os.getcwd())
    workspace_dir = root / 'workspace'
    
    if not workspace_dir.exists():
        print("No workspace directory found.")
        return

    print(f"Scanning {workspace_dir} for databases...")
    
    for user_dir in workspace_dir.iterdir():
        if user_dir.is_dir() and user_dir.name.startswith('workspace_'):
            db_dir = user_dir / 'db'
            if db_dir.exists():
                for db_file in db_dir.glob('*.db'):
                    print(f"\n--- Checking DB: {db_file} ---")
                    try:
                        conn = sqlite3.connect(db_file)
                        
                        # Check tables
                        cursor = conn.cursor()
                        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
                        tables = [r[0] for r in cursor.fetchall()]
                        print(f"Tables: {len(tables)}")
                        
                        if 'api_usage_logs' in tables:
                            count = cursor.execute("SELECT count(*) FROM api_usage_logs").fetchone()[0]
                            print(f"api_usage_logs count: {count}")
                            if count > 0:
                                # Show last 5 logs
                                print("Last 5 logs:")
                                df = pd.read_sql_query("SELECT * FROM api_usage_logs ORDER BY created_at DESC LIMIT 5", conn)
                                print(df[['id', 'provider', 'model_used', 'cost_total', 'created_at']].to_string())
                        else:
                            print("Table 'api_usage_logs' NOT found.")
                            
                        if 'usage_summaries' in tables:
                            print("Usage Summaries:")
                            df = pd.read_sql_query("SELECT * FROM usage_summaries", conn)
                            if not df.empty:
                                print(df.to_string())
                            else:
                                print("Table 'usage_summaries' is empty.")
                        else:
                            print("Table 'usage_summaries' NOT found.")
                            
                        conn.close()
                    except Exception as e:
                        print(f"Error reading DB: {e}")

if __name__ == "__main__":
    inspect_dbs()
