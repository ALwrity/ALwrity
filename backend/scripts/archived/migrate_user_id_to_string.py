"""
Migration Script: Update onboarding_sessions.user_id from INTEGER to STRING
This script updates the database schema to support Clerk user IDs (strings)
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from loguru import logger
from sqlalchemy import text
from services.database import SessionLocal, engine

def migrate_user_id_column():
    """Migrate user_id column from INTEGER to VARCHAR(255)."""
    try:
        db = SessionLocal()
        
        logger.info("Starting migration: user_id INTEGER -> VARCHAR(255)")
        
        # Check if table exists (SQLite compatible)
        check_table_query = """
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='onboarding_sessions';
        """
        
        result = db.execute(text(check_table_query))
        table_exists = result.scalar()
        
        if not table_exists:
            logger.warning("Table 'onboarding_sessions' does not exist. Creating it instead.")
            # Create tables using the updated models
            from models.base import Base
            Base.metadata.create_all(bind=engine, checkfirst=True)
            logger.success("✅ Created onboarding_sessions table with VARCHAR user_id")
            return True
        
        # Check current column type (SQLite compatible)
        check_column_query = """
        SELECT type FROM pragma_table_info('onboarding_sessions') 
        WHERE name = 'user_id';
        """
        
        result = db.execute(text(check_column_query))
        current_type = result.scalar()
        
        if current_type and 'varchar' in current_type.lower():
            logger.info(f"✅ Column user_id is already VARCHAR ({current_type}). No migration needed.")
            return True
        
        logger.info(f"Current user_id type: {current_type}")
        
        # Backup existing data count
        count_query = "SELECT COUNT(*) FROM onboarding_sessions;"
        result = db.execute(text(count_query))
        record_count = result.scalar()
        logger.info(f"Found {record_count} existing records")
        
        if record_count > 0:
            logger.warning("⚠️  Found existing records. Backing up data...")
            # You may want to add backup logic here if needed
        
        # SQLite doesn't support ALTER COLUMN TYPE directly
        # We need to recreate the table
        logger.info("Recreating table with VARCHAR user_id (SQLite limitation)...")
        
        # Backup data
        logger.info("Backing up existing data...")
        backup_query = """
        CREATE TABLE onboarding_sessions_backup AS 
        SELECT * FROM onboarding_sessions;
        """
        db.execute(text(backup_query))
        db.commit()
        
        # Drop old table
        logger.info("Dropping old table...")
        db.execute(text("DROP TABLE onboarding_sessions;"))
        db.commit()
        
        # Recreate table with correct schema
        logger.info("Creating new table with VARCHAR user_id...")
        from models.base import Base
        Base.metadata.create_all(bind=engine, tables=[Base.metadata.tables['onboarding_sessions']], checkfirst=False)
        db.commit()
        
        # Restore data (converting integers to strings)
        logger.info("Restoring data...")
        restore_query = """
        INSERT INTO onboarding_sessions (id, user_id, current_step, progress, started_at, updated_at)
        SELECT id, CAST(user_id AS TEXT), current_step, progress, started_at, updated_at
        FROM onboarding_sessions_backup;
        """
        db.execute(text(restore_query))
        db.commit()
        
        # Drop backup table
        logger.info("Cleaning up backup table...")
        db.execute(text("DROP TABLE onboarding_sessions_backup;"))
        db.commit()
        
        logger.success("✅ Table recreated successfully")
        
        logger.success("🎉 Migration completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        if db:
            db.rollback()
        return False
    finally:
        if db:
            db.close()

if __name__ == "__main__":
    logger.info("="*60)
    logger.info("DATABASE MIGRATION: user_id INTEGER -> VARCHAR(255)")
    logger.info("="*60)
    
    success = migrate_user_id_column()
    
    if success:
        logger.success("\n✅ Migration completed successfully!")
        logger.info("The onboarding system now supports Clerk user IDs (strings)")
    else:
        logger.error("\n❌ Migration failed. Please check the logs above.")
        sys.exit(1)

