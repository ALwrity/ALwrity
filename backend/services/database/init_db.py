"""Database table initialization for per-user and global SQLite databases.

Since Alembic Phase 4, schema creation is driven by ``alembic upgrade head``
instead of ``Base.metadata.create_all`` + hand-rolled
``run_user_schema_migrations``.  This gives us versioned, reversible
migrations for every future schema change.

Existing user databases (created before Alembic) are auto-stamped at
head on first access so that future migrations apply normally.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

from loguru import logger
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker

from services.database.engine import get_engine_for_user
from services.database.legacy import default_engine
from models.base import Base

try:
    from alembic import command
    from alembic.config import Config as AlembicConfig
    _ALEMBIC_AVAILABLE = True
except ImportError:
    _ALEMBIC_AVAILABLE = False
    logger.warning("Alembic not available — falling back to create_all for schema init")

# Trigger model imports so all tables register with the shared Base.
# These are needed both for alembic env.py and for any code that does
# ``Base.metadata.create_all()`` directly (e.g. test fixtures).
import models.advertools_monitoring_models  # noqa: E402, F401
import models.agent_activity_models  # noqa: E402, F401
import models.api_monitoring  # noqa: E402, F401
import models.backlink_outreach_models  # noqa: E402, F401
import models.bing_analytics_models  # noqa: E402, F401
import models.comprehensive_user_data_cache  # noqa: E402, F401
import models.content_asset_models  # noqa: E402, F401
import models.content_planning  # noqa: E402, F401
import models.content_strategy_state_models  # noqa: E402, F401
import models.crawled_content  # noqa: E402, F401
import models.daily_workflow_models  # noqa: E402, F401
import models.enhanced_calendar_models  # noqa: E402, F401
import models.enhanced_persona_models  # noqa: E402, F401
import models.enhanced_strategy_models  # noqa: E402, F401
import models.gsc_brainstorm_cache_models  # noqa: E402, F401
import models.linkedin_brainstorm_saved_ideas_db_models  # noqa: E402, F401
import models.linkedin_comment_assistant_cache_model  # noqa: E402, F401
import models.linkedin_monitoring_models  # noqa: E402, F401
import models.linkedin_post_analytics_model  # noqa: E402, F401
import models.linkedin_pymk_cache_model  # noqa: E402, F401
import models.linkedin_watchdog_db_models  # noqa: E402, F401
import models.monitoring_models  # noqa: E402, F401
import models.oauth_token_monitoring_models  # noqa: E402, F401
import models.onboarding  # noqa: E402, F401
import models.persona_models  # noqa: E402, F401
import models.platform_insights_monitoring_models  # noqa: E402, F401
import models.podcast_models  # noqa: E402, F401
import models.post_analytics_snapshot_model  # noqa: E402, F401
import models.product_asset_models  # noqa: E402, F401
import models.product_marketing_models  # noqa: E402, F401
import models.research_models  # noqa: E402, F401
import models.scheduler_cumulative_stats_model  # noqa: E402, F401
import models.scheduler_models  # noqa: E402, F401
import models.semantic_health_check  # noqa: E402, F401
import models.semantic_monitoring_snapshot  # noqa: E402, F401
import models.seo_analysis  # noqa: E402, F401
import models.sif_indexing_watermark  # noqa: E402, F401
import models.story_project_models  # noqa: E402, F401
import models.subscription_models  # noqa: E402, F401
import models.user_business_info  # noqa: E402, F401
import models.video_models  # noqa: E402, F401
import models.website_analysis_monitoring_models  # noqa: E402, F401
import models.youtube_task_models  # noqa: E402, F401

_ALEMBIC_INI_PATH = Path(__file__).resolve().parents[2] / "alembic.ini"
_MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "alembic_migrations"


def _auto_stamp_existing_db(engine, user_id: str) -> bool:
    """Stamp an existing user DB at Alembic head if it has tables but no
    ``alembic_version`` row.

    Returns ``True`` if stamping was performed.
    """
    db_path = engine.url.database
    try:
        conn = sqlite3.connect(db_path)
        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
        if not tables:
            conn.close()
            return False

        has_alembic = any(t[0] == "alembic_version" for t in tables)
        conn.close()
        if has_alembic:
            return False

        if not _ALEMBIC_AVAILABLE:
            return False

        from alembic import command
        from alembic.config import Config as AlembicConfig

        cfg = AlembicConfig(str(_ALEMBIC_INI_PATH))
        cfg.set_main_option("sqlalchemy.url", f"sqlite:///{db_path}")
        command.stamp(cfg, "head")
        logger.info(f"Stamped existing DB for user {user_id} at Alembic head")
        return True
    except Exception as exc:
        logger.warning(f"Could not auto-stamp DB for user {user_id}: {exc}")
        return False

_pricing_initialized: set = set()


def init_user_database(user_id: str) -> None:
    """Initialize database tables for a specific user."""
    engine = get_engine_for_user(user_id)
    try:
        if _ALEMBIC_AVAILABLE:
            alembic_cfg = AlembicConfig(str(_ALEMBIC_INI_PATH))
            alembic_cfg.set_main_option(
                "sqlalchemy.url", f"sqlite:///{engine.url.database}"
            )
            _auto_stamp_existing_db(engine, user_id)
            command.upgrade(alembic_cfg, "head")
            Base.metadata.create_all(bind=engine, checkfirst=True)
        else:
            Base.metadata.create_all(bind=engine)

        if user_id not in _pricing_initialized:
            _pricing_initialized.add(user_id)
            try:
                from services.subscription.pricing_service import PricingService
                from services.subscription.schema_utils import ensure_subscription_plan_columns

                SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
                db = SessionLocal()
                try:
                    ensure_subscription_plan_columns(db)
                    pricing_service = PricingService(db)
                    pricing_service.initialize_default_pricing()
                    pricing_service.initialize_default_plans()
                    db.commit()
                    logger.info(f"Default pricing and plans initialized for user {user_id}")
                except Exception as data_error:
                    logger.error(f"Error initializing default data for user {user_id}: {data_error}")
                    db.rollback()
                finally:
                    db.close()
            except Exception as import_error:
                logger.warning(
                    f"Could not initialize pricing data (PricingService import failed): {import_error}"
                )

        logger.info(f"Database initialized successfully for user {user_id}")
    except SQLAlchemyError as e:
        logger.error(f"Error initializing database for user {user_id}: {str(e)}")
        raise


def init_database() -> None:
    """Initialize global database tables (backward compatibility / startup checks)."""
    engine = default_engine
    if not engine:
        logger.info(
            "Global database: legacy default_engine is disabled, "
            "using sqlite:///alwrity.db for startup checks"
        )
        from sqlalchemy import create_engine
        engine = create_engine("sqlite:///alwrity.db")
        import services.database.legacy as _legacy
        _legacy.default_engine = engine

    try:
        if _ALEMBIC_AVAILABLE:
            alembic_cfg = AlembicConfig(str(_ALEMBIC_INI_PATH))
            alembic_cfg.set_main_option(
                "sqlalchemy.url", f"sqlite:///{engine.url.database}"
            )
            _auto_stamp_existing_db(engine, "global")
            command.upgrade(alembic_cfg, "head")
            Base.metadata.create_all(bind=engine, checkfirst=True)
        else:
            Base.metadata.create_all(bind=engine, checkfirst=True)
        logger.info("Global database initialized successfully")
    except SQLAlchemyError as e:
        logger.error(f"Error initializing global database: {str(e)}")
