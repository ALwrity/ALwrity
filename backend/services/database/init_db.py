"""Database table initialization for per-user and global SQLite databases.

Schema creation is driven by ``alembic upgrade head``.
Alembic is required — the server will not start without it.

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

from alembic import command
from alembic.config import Config as AlembicConfig

# Trigger model imports so all tables register with the shared Base.
# These are needed for alembic env.py and for test fixtures.
import models.advertools_monitoring_models  # noqa: E402, F401
import models.agent_activity_models  # noqa: E402, F401
import models.api_monitoring  # noqa: E402, F401
import models.backlink_outreach_models  # noqa: E402, F401
import models.bing_analytics_models  # noqa: E402, F401
import models.comprehensive_user_data_cache  # noqa: E402, F401
import models.content_asset_models  # noqa: E402, F401
import models.conversion_event_models  # noqa: E402, F401
import models.content_planning  # noqa: E402, F401
import models.content_strategy_state_models  # noqa: E402, F401
import models.crawled_content  # noqa: E402, F401
import models.daily_meeting_models  # noqa: E402, F401
import models.daily_workflow_models  # noqa: E402, F401
import models.daily_email_ledger  # noqa: E402, F401
import models.workflow_execution_models  # noqa: E402, F401
import models.enhanced_calendar_models  # noqa: E402, F401
import models.enhanced_strategy_models  # noqa: E402, F401
import models.gsc_brainstorm_cache_models  # noqa: E402, F401
import models.linkedin_oauth_models  # noqa: E402, F401
import models.linkedin_brainstorm_saved_ideas_db_models  # noqa: E402, F401
import models.linkedin_comment_assistant_cache_model  # noqa: E402, F401
import models.linkedin_monitoring_models  # noqa: E402, F401
import models.linkedin_post_analytics_model  # noqa: E402, F401
import models.linkedin_pymk_cache_model  # noqa: E402, F401
import models.linkedin_watchdog_db_models  # noqa: E402, F401
import models.monitoring_models  # noqa: E402, F401
import models.oauth_token_monitoring_models  # noqa: E402, F401
import models.oauth_provider_models  # noqa: E402, F401
import models.onboarding  # noqa: E402, F401
import models.persona_task_models  # noqa: E402, F401
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
import models.task_memory_models  # noqa: E402, F401
import models.user_business_info  # noqa: E402, F401
import models.video_models  # noqa: E402, F401
import models.wordpress_models  # noqa: E402, F401
import models.website_analysis_monitoring_models  # noqa: E402, F401
import models.youtube_task_models  # noqa: E402, F401
import models.youtube_channel_bible_models  # noqa: E402, F401
import models.platform_analytics  # noqa: E402, F401

_ALEMBIC_INI_PATH = Path(__file__).resolve().parents[2] / "alembic.ini"
_MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "alembic_migrations"


_BASELINE_SENTINEL_TABLES = (
    "onboarding_sessions",
    "subscription_plans",
    "user_business_info",
)


_BASELINE_REVISION = "a4fe799f2cab"


def _auto_stamp_existing_db(engine, user_id: str) -> bool:
    """Stamp an existing user DB at Alembic baseline if it looks like a complete
    pre-Alembic (``Base.metadata.create_all`` era) schema.

    A DB qualifies for stamping only when it has tables, lacks an
    ``alembic_version`` row, AND contains at least one baseline sentinel table.
    Partially-initialized DBs — e.g. one holding only raw-SQL OAuth tables
    created before Alembic ever ran — are left unstamped so that
    ``command.upgrade(head)`` builds the baseline schema alongside them.
    Stamping at baseline ensures that any subsequent incremental migrations
    are applied cleanly by ``command.upgrade(head)``.

    Returns ``True`` if stamping was performed.
    """
    db_path = engine.url.database
    try:
        conn = sqlite3.connect(db_path)
        tables = [
            t[0]
            for t in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        ]
        conn.close()
        if not tables:
            return False

        if "alembic_version" in tables:
            return False

        has_baseline_tables = any(t in _BASELINE_SENTINEL_TABLES for t in tables)
        if not has_baseline_tables:
            logger.info(
                f"Skipping auto-stamp for user {user_id}: DB has {len(tables)} "
                f"table(s) but none of the baseline sentinels "
                f"{_BASELINE_SENTINEL_TABLES}; 'upgrade head' will create the "
                f"baseline schema."
            )
            return False

        cfg = AlembicConfig(str(_ALEMBIC_INI_PATH))
        cfg.set_main_option("sqlalchemy.url", f"sqlite:///{db_path}")
        command.stamp(cfg, _BASELINE_REVISION)
        logger.info(f"Stamped existing DB for user {user_id} at Alembic baseline {_BASELINE_REVISION}")
        return True
    except Exception as exc:
        logger.warning(f"Could not auto-stamp DB for user {user_id}: {exc}")
        return False

_pricing_initialized: set = set()


def init_user_database(user_id: str) -> None:
    """Initialize database tables for a specific user."""
    engine = get_engine_for_user(user_id)
    try:
        alembic_cfg = AlembicConfig(str(_ALEMBIC_INI_PATH))
        alembic_cfg.set_main_option(
            "sqlalchemy.url", f"sqlite:///{engine.url.database}"
        )
        _auto_stamp_existing_db(engine, user_id)
        command.upgrade(alembic_cfg, "head")

        # Ensure schema integrity for columns that might have been skipped by premature head stamps
        db_path = engine.url.database
        try:
            conn = sqlite3.connect(db_path)
            tables = [t[0] for t in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
            if "onboarding_sessions" in tables:
                cols = [c[1] for c in conn.execute("PRAGMA table_info(onboarding_sessions)").fetchall()]
                if "timezone" not in cols:
                    conn.execute("ALTER TABLE onboarding_sessions ADD COLUMN timezone VARCHAR(50)")
                if "contact_email" not in cols:
                    conn.execute("ALTER TABLE onboarding_sessions ADD COLUMN contact_email VARCHAR(255)")
                if "email_digest_opt_in" not in cols:
                    conn.execute("ALTER TABLE onboarding_sessions ADD COLUMN email_digest_opt_in BOOLEAN DEFAULT 0")
                conn.commit()
            if "research_preferences" in tables:
                cols = [c[1] for c in conn.execute("PRAGMA table_info(research_preferences)").fetchall()]
                if "content_pillars" not in cols:
                    conn.execute("ALTER TABLE research_preferences ADD COLUMN content_pillars JSON")
                if "research_summary" not in cols:
                    conn.execute("ALTER TABLE research_preferences ADD COLUMN research_summary JSON")
                if "social_media_citations" not in cols:
                    conn.execute("ALTER TABLE research_preferences ADD COLUMN social_media_citations JSON")
                conn.commit()
            conn.close()
        except Exception as heal_exc:
            logger.debug(f"Schema column check for {user_id}: {heal_exc}")

        if user_id not in _pricing_initialized:
            _pricing_initialized.add(user_id)
            try:
                from services.subscription.pricing_service import PricingService

                SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
                db = SessionLocal()
                try:
                    pricing_service = PricingService(db)
                    pricing_service.initialize_default_pricing()
                    pricing_service.initialize_default_plans()
                    db.commit()
                    logger.debug(f"Default pricing and plans initialized for user {user_id}")
                except Exception as data_error:
                    logger.error(f"Error initializing default data for user {user_id}: {data_error}")
                    db.rollback()
                finally:
                    db.close()
            except Exception as import_error:
                logger.warning(
                    f"Could not initialize pricing data (PricingService import failed): {import_error}"
                )

        logger.debug(f"Database initialized successfully for user {user_id}")
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
        alembic_cfg = AlembicConfig(str(_ALEMBIC_INI_PATH))
        alembic_cfg.set_main_option(
            "sqlalchemy.url", f"sqlite:///{engine.url.database}"
        )
        _auto_stamp_existing_db(engine, "global")
        command.upgrade(alembic_cfg, "head")
        logger.info("Global database initialized successfully")
    except SQLAlchemyError as e:
        logger.error(f"Error initializing global database: {str(e)}")
        raise
