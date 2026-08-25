
import sys
import os
import logging

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from models.subscription_models import APIUsageLog, UserSubscription, APIProvider
from services.subscription import UsageTrackingService, PricingService

USER_ID = "user_33Gz1FPI86VDXhRY8QN4ragRFGN"

def get_db_path(user_id):
    from services.database import get_user_db_path
    return get_user_db_path(user_id)

def check_user_data():
    db_path = get_db_path(USER_ID)
    logger.info(f"Checking DB at: {db_path}")
    
    if not os.path.exists(db_path):
        logger.error(f"DB file not found at {db_path}")
        # Check default DB as fallback
        default_db = os.path.join(os.getcwd(), 'backend', 'data', 'alwrity.db')
        if os.path.exists(default_db):
             logger.info(f"Falling back to default DB: {default_db}")
             db_url = f"sqlite:///{default_db}"
        else:
             return
    else:
        db_url = f"sqlite:///{db_path}"

    engine = create_engine(db_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # 1. Check API Usage Logs
        logs = db.query(APIUsageLog).filter(APIUsageLog.user_id == USER_ID).all()
        logger.info(f"Found {len(logs)} usage logs for user {USER_ID}")
        
        if logs:
            last_log = logs[-1]
            logger.info(f"Last log: {last_log.timestamp} - {last_log.provider} - {last_log.cost_total}")
            
            # Print provider breakdown
            from collections import Counter
            providers = Counter([l.provider for l in logs])
            logger.info(f"Provider breakdown: {providers}")

        # 2. Check Subscription
        sub = db.query(UserSubscription).filter(UserSubscription.user_id == USER_ID).first()
        if sub:
            logger.info(f"Subscription found: {sub.plan_type} ({sub.status})")
        else:
            logger.warning("No subscription found")

        # 3. Run Usage Service
        logger.info("Running UsageTrackingService.get_user_usage_stats...")
        service = UsageTrackingService(db)
        stats = service.get_user_usage_stats(USER_ID)
        logger.info(f"Service Stats: {stats}")

    except Exception as e:
        logger.error(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_user_data()
