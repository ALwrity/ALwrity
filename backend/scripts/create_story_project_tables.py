"""
Database Migration Script for Story Studio
Creates the story_projects table for cross-device story project persistence.
"""

import sys
from pathlib import Path

from loguru import logger
from sqlalchemy import create_engine, text
import traceback

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from models.base import Base
from models.story_project_models import StoryProject  # noqa: F401
from services.database import DATABASE_URL


def create_story_tables() -> None:
    """Create story-related project tables."""
    try:
        engine = create_engine(DATABASE_URL, echo=False)

        logger.info("Creating Story Studio project tables...")
        SubscriptionBase.metadata.create_all(bind=engine)
        logger.info("✅ Story project tables created successfully")

        display_setup_summary(engine)
    except Exception as e:
        logger.error(f"❌ Error creating story project tables: {e}")
        logger.error(traceback.format_exc())
        raise


def display_setup_summary(engine) -> None:
    """Display a summary of the created tables."""
    try:
        with engine.connect() as conn:
            logger.info("\n" + "=" * 60)
            logger.info("STORY STUDIO PROJECT SETUP SUMMARY")
            logger.info("=" * 60)

            check_query = text(
                """
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='story_projects'
                """
            )

            result = conn.execute(check_query)
            table_exists = result.fetchone()

            if table_exists:
                logger.info("✅ Table 'story_projects' created successfully")

                schema_query = text(
                    """
                    SELECT sql FROM sqlite_master 
                    WHERE type='table' AND name='story_projects'
                    """
                )
                result = conn.execute(schema_query)
                schema = result.fetchone()
                if schema:
                    logger.info("\n📋 Table Schema:")
                    logger.info(schema[0])

                indexes_query = text(
                    """
                    SELECT name FROM sqlite_master 
                    WHERE type='index' AND tbl_name='story_projects'
                    """
                )
                result = conn.execute(indexes_query)
                indexes = result.fetchall()

                if indexes:
                    logger.info(f"\n📊 Indexes ({len(indexes)}):")
                    for idx in indexes:
                        logger.info(f"  • {idx[0]}")
            else:
                logger.warning("⚠️ Table 'story_projects' not found after creation")

            logger.info("\n" + "=" * 60)
            logger.info("NEXT STEPS:")
            logger.info("=" * 60)
            logger.info("1. The story_projects table is ready for use")
            logger.info("2. Story Studio projects will sync to database via new endpoints")
            logger.info("3. Users will be able to resume Story Studio sessions across devices")
            logger.info("=" * 60)
    except Exception as e:
        logger.error(f"Error displaying Story Studio setup summary: {e}")


def check_existing_table(engine) -> bool:
    """Check if story_projects table already exists."""
    try:
        with engine.connect() as conn:
            check_query = text(
                """
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='story_projects'
                """
            )

            result = conn.execute(check_query)
            table_exists = result.fetchone()

            if table_exists:
                logger.info("ℹ️ Table 'story_projects' already exists")
                logger.info("   Running migration will ensure schema is up to date...")
                return True

            return False
    except Exception as e:
        logger.error(f"Error checking existing Story Studio table: {e}")
        return False


if __name__ == "__main__":
    logger.info("🚀 Starting Story Studio database migration...")

    try:
        engine = create_engine(DATABASE_URL, echo=False)

        check_existing_table(engine)

        create_story_tables()

        logger.info("✅ Story Studio migration completed successfully!")
    except KeyboardInterrupt:
        logger.info("Migration cancelled by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"❌ Story Studio migration failed: {e}")
        traceback.print_exc()
        sys.exit(1)

