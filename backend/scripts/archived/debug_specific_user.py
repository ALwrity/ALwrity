import sys
import os
from sqlalchemy import text

# Add backend to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.database import get_session_for_user
from models.subscription_models import APIUsageLog, UsageSummary

USER_ID = "user_33Gz1FPI86VDXhRY8QN4ragRFGN"

def debug_user():
    print(f"Checking usage for user: {USER_ID}")
    try:
        db = get_session_for_user(USER_ID)
        if not db:
            print("Could not get DB session.")
            return

        # 1. Check UsageSummary
        print("\n--- UsageSummary ---")
        summaries = db.query(UsageSummary).all()
        for s in summaries:
            print(f"Period: {s.billing_period}, Calls: {s.total_calls}, Cost: {s.total_cost}, Status: {s.usage_status}")

        # 2. Check APIUsageLog
        print("\n--- APIUsageLog Stats ---")
        # Count logs
        count = db.query(APIUsageLog).count()
        print(f"Total Logs: {count}")
        
        # Group by billing period
        try:
            logs_by_period = db.execute(text("SELECT billing_period, COUNT(*), SUM(cost_total) FROM api_usage_logs GROUP BY billing_period")).fetchall()
            for row in logs_by_period:
                print(f"Period: {row[0]}, Count: {row[1]}, Sum Cost: {row[2]}")
        except Exception as e:
            print(f"Error querying logs group by: {e}")

        # 3. Check specific provider logs (to see if they are 'gemini' or 'GEMINI')
        print("\n--- Provider Check (First 5 logs) ---")
        logs = db.query(APIUsageLog).limit(5).all()
        for l in logs:
            print(f"ID: {l.id}, Provider: {l.provider}, Actual: {l.actual_provider_name}, Cost: {l.cost_total}, Period: {l.billing_period}")

        db.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_user()
