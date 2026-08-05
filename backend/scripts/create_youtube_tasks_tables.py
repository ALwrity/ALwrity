"""
Create YouTube Video Tasks Table

Standalone script to create the youtube_video_tasks table in all user
databases. Also recovers stale in-flight tasks by marking them as failed.
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from loguru import logger
from models.youtube_task_models import YouTubeVideoTask, Base
from models.base import Base
from services.database import get_engine_for_user, _user_engines
from sqlalchemy import inspect


def create_youtube_tasks_tables():
    """Create youtube_video_tasks table for all existing user databases."""
    from services.database import get_all_user_dbs
    created = 0
    skipped = 0
    recovered = 0

    try:
        user_dbs = get_all_user_dbs()
    except Exception:
        user_dbs = []

    if not user_dbs:
        logger.warning("No user databases found. Creating table in default database.")
        user_dbs = [None]

    for user_id in user_dbs:
        try:
            if user_id:
                engine = get_engine_for_user(user_id)
            else:
                from services.database import default_engine
                if not default_engine:
                    logger.error("No default engine available")
                    continue
                engine = default_engine

            SubscriptionBase.metadata.create_all(bind=engine, checkfirst=True)

            # Recover stale tasks
            from sqlalchemy.orm import sessionmaker
            SessionLocal = sessionmaker(bind=engine)
            db = SessionLocal()
            try:
                stale = db.query(YouTubeVideoTask).filter(
                    YouTubeVideoTask.status.in_([
                        'pending', 'processing',
                    ])
                ).all()

                for task in stale:
                    task.status = 'failed'
                    task.error = 'Task interrupted by server restart'
                    task.message = 'Recovered on table creation'
                    recovered += 1

                if stale:
                    db.commit()
                    logger.info(f"Recovered {len(stale)} stale tasks for user {user_id}")
            except Exception as e:
                logger.warning(f"Failed to recover stale tasks for user {user_id}: {e}")
                db.rollback()
            finally:
                db.close()

            created += 1
            logger.info(f"Created youtube_video_tasks table for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to create table for user {user_id}: {e}")
            skipped += 1

    logger.info(f"YouTube task table creation complete: {created} created, {skipped} skipped, {recovered} recovered")
    return created


if __name__ == "__main__":
    create_youtube_tasks_tables()