
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from loguru import logger
from sqlalchemy import text
from services.database import SessionLocal, engine

# Import models to ensure they are registered and we can recreate them
from models.content_planning import (
    ContentStrategy, ContentGapAnalysis, ContentRecommendation, AIAnalysisResult,
    Base as ContentPlanningBase
)
from models.enhanced_calendar_models import (
    ContentCalendarTemplate, AICalendarRecommendation, ContentPerformanceTracking,
    ContentTrendAnalysis, ContentOptimization, CalendarGenerationSession,
    Base as EnhancedCalendarBase
)
from models.enhanced_strategy_models import (
    EnhancedContentStrategy, EnhancedAIAnalysisResult, OnboardingDataIntegration,
    Base as EnhancedStrategyBase
)

def migrate_table(db, table_name, base_metadata):
    """Migrate user_id column for a specific table from INTEGER to VARCHAR(255)."""
    try:
        logger.info(f"Checking table: {table_name}")
        
        # Check if table exists
        check_table_query = f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}';"
        result = db.execute(text(check_table_query))
        if not result.scalar():
            logger.warning(f"Table '{table_name}' does not exist. Skipping migration for this table.")
            return True

        # Check current column type
        check_column_query = f"SELECT type FROM pragma_table_info('{table_name}') WHERE name = 'user_id';"
        result = db.execute(text(check_column_query))
        current_type = result.scalar()
        
        if not current_type:
             logger.info(f"Table {table_name} does not have user_id column. Skipping.")
             return True

        if 'varchar' in current_type.lower() or 'text' in current_type.lower():
            logger.info(f"✅ {table_name}.user_id is already {current_type}. No migration needed.")
            return True
            
        logger.info(f"Migrating {table_name}.user_id from {current_type} to VARCHAR...")
        
        # Backup data
        backup_table = f"{table_name}_backup"
        db.execute(text(f"DROP TABLE IF EXISTS {backup_table}")) # Ensure clean state
        db.execute(text(f"CREATE TABLE {backup_table} AS SELECT * FROM {table_name}"))
        
        # Drop old table
        db.execute(text(f"DROP TABLE {table_name}"))
        
        # Recreate table
        # We need to find the Table object in metadata
        table_obj = base_metadata.tables.get(table_name)
        if table_obj is not None:
            base_metadata.create_all(bind=engine, tables=[table_obj], checkfirst=False)
        else:
            logger.error(f"Could not find Table object for {table_name} in metadata")
            # Restore backup and abort
            db.execute(text(f"ALTER TABLE {backup_table} RENAME TO {table_name}"))
            return False

        # Restore data
        # We need to list columns to construct INSERT statement, excluding those that might be auto-generated if needed, 
        # but usually for restore we want all.
        # However, we need to cast user_id to TEXT.
        
        # Get columns from backup
        columns_result = db.execute(text(f"PRAGMA table_info({backup_table})"))
        columns = [row[1] for row in columns_result]
        
        cols_str = ", ".join(columns)
        
        # Construct select list with cast
        select_parts = []
        for col in columns:
            if col == 'user_id':
                select_parts.append("CAST(user_id AS TEXT)")
            else:
                select_parts.append(col)
        select_str = ", ".join(select_parts)
        
        restore_query = f"INSERT INTO {table_name} ({cols_str}) SELECT {select_str} FROM {backup_table}"
        db.execute(text(restore_query))
        
        # Drop backup
        db.execute(text(f"DROP TABLE {backup_table}"))
        
        db.commit()
        logger.success(f"✅ Migrated {table_name} successfully")
        return True

    except Exception as e:
        logger.error(f"❌ Failed to migrate {table_name}: {e}")
        db.rollback()
        return False

def migrate_all():
    db = SessionLocal()
    try:
        # Content Planning Tables
        cp_tables = [
            "content_strategies",
            "content_gap_analyses",
            "content_recommendations",
            "ai_analysis_results"
        ]
        
        for table in cp_tables:
            migrate_table(db, table, ContentPlanningBase.metadata)
            
        # Enhanced Calendar Tables
        ec_tables = [
            "content_calendar_templates",
            "ai_calendar_recommendations",
            "content_performance_tracking",
            "content_trend_analysis",
            "content_optimizations",
            "calendar_generation_sessions"
        ]
        
        for table in ec_tables:
            migrate_table(db, table, EnhancedCalendarBase.metadata)
        
        # Enhanced Strategy Tables
        es_tables = [
            "enhanced_content_strategies",
            "enhanced_ai_analysis_results",
            "onboarding_data_integrations"
        ]
        
        for table in es_tables:
            migrate_table(db, table, EnhancedStrategyBase.metadata)
            
    finally:
        db.close()

if __name__ == "__main__":
    logger.info("Starting comprehensive user_id migration...")
    migrate_all()
    logger.info("Migration finished.")
