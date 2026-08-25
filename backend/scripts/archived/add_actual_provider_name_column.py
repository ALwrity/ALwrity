"""
Database Migration Script: Add actual_provider_name column to api_usage_logs table

This script adds the actual_provider_name column to track real providers
(WaveSpeed, Google, HuggingFace, etc.) instead of just generic enum values.
"""

import sys
import os

# Add parent directory to path - handle both direct execution and module import
script_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(script_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from sqlalchemy import text
from services.database import get_db
from loguru import logger

def add_actual_provider_name_column():
    """Add actual_provider_name column to api_usage_logs table if it doesn't exist."""
    
    db = next(get_db())
    
    try:
        # Check if column already exists (SQLite compatible)
        try:
            result = db.execute(text("PRAGMA table_info(api_usage_logs)"))
            columns = [row[1] for row in result.fetchall()]
            column_exists = 'actual_provider_name' in columns
            
            if column_exists:
                logger.info("Column 'actual_provider_name' already exists in api_usage_logs table")
                return
        except Exception as e:
            # If PRAGMA fails, try MySQL/PostgreSQL approach
            try:
                result = db.execute(text("""
                    SELECT COUNT(*) as count
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME = 'api_usage_logs'
                    AND COLUMN_NAME = 'actual_provider_name'
                """))
                column_exists = result.fetchone()[0] > 0
                if column_exists:
                    logger.info("Column 'actual_provider_name' already exists in api_usage_logs table")
                    return
            except:
                # Column check failed, try to add anyway (will fail if exists)
                pass
        
        # Add the column
        logger.info("Adding 'actual_provider_name' column to api_usage_logs table...")
        try:
            db.execute(text("""
                ALTER TABLE api_usage_logs
                ADD COLUMN actual_provider_name VARCHAR(50) NULL
            """))
            db.commit()
            logger.success("Successfully added 'actual_provider_name' column to api_usage_logs table")
        except Exception as alter_error:
            # Column might already exist, check again
            if 'duplicate' in str(alter_error).lower() or 'already exists' in str(alter_error).lower():
                logger.info("Column 'actual_provider_name' already exists (detected during ALTER)")
                db.rollback()
                return
            raise
        
        # Optionally, backfill existing records with detected provider names
        logger.info("Backfilling existing records with detected provider names...")
        from services.subscription.provider_detection import detect_actual_provider
        from models.subscription_models import APIUsageLog, APIProvider
        
        # Get all records without actual_provider_name
        logs = db.query(APIUsageLog).filter(
            APIUsageLog.actual_provider_name.is_(None)
        ).all()
        
        updated_count = 0
        for log in logs:
            try:
                actual_provider = detect_actual_provider(
                    provider_enum=log.provider,
                    model_name=log.model_used,
                    endpoint=log.endpoint
                )
                log.actual_provider_name = actual_provider
                updated_count += 1
            except Exception as e:
                logger.warning(f"Failed to detect provider for log {log.id}: {e}")
        
        db.commit()
        logger.success(f"Backfilled {updated_count} existing records with actual provider names")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error adding actual_provider_name column: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    logger.info("Starting migration: Add actual_provider_name column")
    add_actual_provider_name_column()
    logger.info("Migration completed successfully")
