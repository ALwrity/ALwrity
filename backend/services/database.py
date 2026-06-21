"""
Database service for ALwrity backend.
Handles database connections and sessions.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException
from loguru import logger
from typing import Optional, List

# Import models
from models.onboarding import Base as OnboardingBase
from models.seo_analysis import Base as SEOAnalysisBase
from models.content_planning import Base as ContentPlanningBase
from models.enhanced_strategy_models import Base as EnhancedStrategyBase
# Monitoring models now use the same base as enhanced strategy models
from models.monitoring_models import Base as MonitoringBase
from models.api_monitoring import Base as APIMonitoringBase
from models.persona_models import Base as PersonaBase
from models.subscription_models import Base as SubscriptionBase
from models.user_business_info import Base as UserBusinessInfoBase
from models.content_asset_models import Base as ContentAssetBase
# Import daily workflow models to ensure they are registered with EnhancedStrategyBase
from models.daily_workflow_models import DailyWorkflowPlan, DailyWorkflowTask, TaskHistory
# Product Marketing models use SubscriptionBase, but import to ensure models are registered
from models.product_marketing_models import Campaign, CampaignProposal, CampaignAsset
# Product Asset models (Product Marketing Suite - product assets, not campaigns)
from models.product_asset_models import ProductAsset, ProductStyleTemplate, EcommerceExport
# Podcast Maker models use SubscriptionBase, but import to ensure models are registered
from models.podcast_models import PodcastProject

# Research models use SubscriptionBase
from models.research_models import ResearchProject
# Video Studio models
from models.video_models import VideoGenerationTask
# YouTube Creator task models
from models.youtube_task_models import YouTubeVideoTask
# Bing Analytics models
from models.bing_analytics_models import Base as BingAnalyticsBase

# Monitoring Task Models (Share EnhancedStrategyBase but need explicit import to register)
# Import these to ensure their tables are created by EnhancedStrategyBase.metadata.create_all
import models.oauth_token_monitoring_models
import models.website_analysis_monitoring_models
import models.platform_insights_monitoring_models
import models.agent_activity_models
import models.daily_workflow_models
# Phase 3.4: SIF indexing watermark table (per-user, per-source content-hash ledger)
import models.sif_indexing_watermark  # noqa: F401

from services.workspace_paths import get_workspace_root, get_user_workspace_dir

# Database configuration
WORKSPACE_DIR = str(get_workspace_root())

# Engine cache for multi-tenant support
_user_engines = {}


def _ensure_daily_workflow_schema(engine, user_id: str) -> None:
    """Backfill required daily_workflow_plans columns for legacy tenant DBs."""
    required_columns = {
        "generation_mode": "VARCHAR(30) NOT NULL DEFAULT 'llm_generation'",
        "committee_agent_count": "INTEGER NOT NULL DEFAULT 0",
        "fallback_used": "BOOLEAN NOT NULL DEFAULT 0",
        "generation_run_id": "INTEGER",
    }

    try:
        with engine.begin() as conn:
            table_check = conn.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='daily_workflow_plans'"
            ).fetchone()
            if not table_check:
                return

            existing_cols = {
                row[1] for row in conn.exec_driver_sql("PRAGMA table_info(daily_workflow_plans)").fetchall()
            }

            for col_name, col_def in required_columns.items():
                if col_name not in existing_cols:
                    conn.exec_driver_sql(
                        f"ALTER TABLE daily_workflow_plans ADD COLUMN {col_name} {col_def}"
                    )
                    logger.warning(
                        f"Auto-migrated daily_workflow_plans column '{col_name}' for user {user_id}"
                    )
    except Exception as e:
        logger.error(f"Failed daily_workflow_plans schema compatibility check for user {user_id}: {e}")


def _ensure_task_history_unique_index(engine, user_id: str) -> None:
    """Enforce unique index on task_history(user_id, task_hash).

    For SQLite, indexes cannot be altered in place; we drop and recreate
    the index. If duplicate rows exist, the new unique index will fail —
    in that case, log a warning and skip. Pre-existing duplicates should
    be rare (only from buggy code paths) and won't block functionality.
    """
    index_name = "ix_task_history_user_hash"
    try:
        with engine.begin() as conn:
            table_check = conn.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='task_history'"
            ).fetchone()
            if not table_check:
                return

            existing_idx = conn.exec_driver_sql(
                "PRAGMA index_list('task_history')"
            ).fetchall()
            target_idx = next((row for row in existing_idx if row[1] == index_name), None)

            if target_idx and target_idx[2] == 1:
                return

            if target_idx:
                conn.exec_driver_sql(f"DROP INDEX {index_name}")

            conn.exec_driver_sql(
                f"CREATE UNIQUE INDEX {index_name} ON task_history (user_id, task_hash)"
            )
            logger.warning(
                f"Auto-migrated task_history unique index '{index_name}' for user {user_id}"
            )
    except Exception as e:
        logger.error(f"Failed task_history unique index migration for user {user_id}: {e}")


def _ensure_scheduler_task_columns(engine, user_id: str) -> None:
    """Backfill started_at and last_heartbeat columns for all scheduler task tables."""
    task_tables = {
        "advertools_tasks": ["started_at", "last_heartbeat"],
        "onboarding_full_website_analysis_tasks": ["started_at", "last_heartbeat"],
        "deep_competitor_analysis_tasks": ["started_at", "last_heartbeat"],
        "deep_website_crawl_tasks": ["started_at", "last_heartbeat"],
        "sif_indexing_tasks": ["started_at", "last_heartbeat"],
        "market_trends_tasks": ["started_at", "last_heartbeat"],
        "website_analysis_tasks": ["started_at", "last_heartbeat"],
    }

    try:
        with engine.begin() as conn:
            for table_name, columns in task_tables.items():
                table_check = conn.exec_driver_sql(
                    f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}'"
                ).fetchone()
                if not table_check:
                    continue

                existing_cols = {
                    row[1] for row in conn.exec_driver_sql(
                        f"PRAGMA table_info({table_name})"
                    ).fetchall()
                }

                for col_name in columns:
                    if col_name not in existing_cols:
                        conn.exec_driver_sql(
                            f"ALTER TABLE {table_name} ADD COLUMN {col_name} DATETIME NULL"
                        )
                        logger.warning(
                            f"Auto-migrated {table_name} column '{col_name}' for user {user_id}"
                        )
    except Exception as e:
        logger.error(f"Failed scheduler task schema migration for user {user_id}: {e}")

    # Backfill frequency_days for deep_website_crawl_tasks (Integer, not DateTime)
    try:
        with engine.begin() as conn:
            table_check = conn.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='deep_website_crawl_tasks'"
            ).fetchone()
            if table_check:
                existing_cols = {
                    row[1] for row in conn.exec_driver_sql(
                        "PRAGMA table_info(deep_website_crawl_tasks)"
                    ).fetchall()
                }
                if "frequency_days" not in existing_cols:
                    conn.exec_driver_sql(
                        "ALTER TABLE deep_website_crawl_tasks ADD COLUMN frequency_days INTEGER DEFAULT 7"
                    )
                    logger.warning(
                        f"Auto-migrated deep_website_crawl_tasks column 'frequency_days' for user {user_id}"
                    )
    except Exception as e:
        logger.error(f"Failed frequency_days schema migration for user {user_id}: {e}")


def _ensure_sif_indexing_watermark_table(engine, user_id: str) -> None:
    """Phase 3.4: backfill the per-user sif_indexing_watermarks table.

    The model is registered with EnhancedStrategyBase.metadata so
    ``create_all`` will create the table on fresh databases. For
    legacy tenant DBs that pre-date the model, we explicitly CREATE
    TABLE IF NOT EXISTS with the same shape. We also add the unique
    constraint on (user_id, source_id) and the secondary index on
    (user_id, indexed_at) for time-range queries.
    """
    try:
        with engine.begin() as conn:
            conn.exec_driver_sql(
                """
                CREATE TABLE IF NOT EXISTS sif_indexing_watermarks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id VARCHAR(255) NOT NULL,
                    source_id VARCHAR(512) NOT NULL,
                    source_hash VARCHAR(128) NOT NULL DEFAULT '',
                    embedding_count INTEGER NOT NULL DEFAULT 0,
                    indexed_at DATETIME NOT NULL,
                    notes TEXT NULL
                )
                """
            )
            # Unique constraint (idempotent via IF NOT EXISTS).
            conn.exec_driver_sql(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_sif_watermark_user_source
                ON sif_indexing_watermarks (user_id, source_id)
                """
            )
            conn.exec_driver_sql(
                """
                CREATE INDEX IF NOT EXISTS ix_sif_watermark_user_indexed
                ON sif_indexing_watermarks (user_id, indexed_at)
                """
            )
    except Exception as e:
        # Don't block tenant DB init on watermark table failure; the
        # model will still be queryable and ``create_all`` is idempotent.
        logger.error(
            f"Failed sif_indexing_watermarks schema migration for user {user_id}: {e}"
        )


def _ensure_semantic_health_checks_table(engine, user_id: str) -> None:
    """Phase 5: backfill the per-user semantic_health_checks table.

    Replaces the JSON-file state previously stored at
    ``~/.alwrity/scheduler_state/semantic_last_checks.json`` so the
    24-hour cadence and the latest health snapshot survive across
    process restarts and stay consistent across multi-instance
    deployments.

    The shape mirrors ``models.semantic_health_check.SemanticHealthCheck``:
    one row per user with the latest check timestamp, status,
    value, and JSON-serialised recommendations + snapshot.
    """
    try:
        with engine.begin() as conn:
            conn.exec_driver_sql(
                """
                CREATE TABLE IF NOT EXISTS semantic_health_checks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id VARCHAR(255) NOT NULL,
                    last_check_at DATETIME NOT NULL,
                    status VARCHAR(32) NOT NULL DEFAULT 'unknown',
                    value INTEGER NOT NULL DEFAULT 0,
                    description TEXT NULL,
                    recommendations_json TEXT NULL,
                    snapshot_json TEXT NULL
                )
                """
            )
            conn.exec_driver_sql(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_semantic_health_check_user
                ON semantic_health_checks (user_id)
                """
            )
            conn.exec_driver_sql(
                """
                CREATE INDEX IF NOT EXISTS ix_semantic_health_check_user
                ON semantic_health_checks (user_id)
                """
            )
    except Exception as e:
        # Don't block tenant DB init on this table's failure. The
        # scheduler will fall back to an in-memory cadence tracker
        # and log a warning.
        logger.error(
            f"Failed semantic_health_checks schema migration for user {user_id}: {e}"
        )


def _ensure_semantic_monitoring_snapshots_table(engine, user_id: str) -> None:
    """Phase 5: backfill the per-user semantic_monitoring_snapshots table.

    Stores per-cycle monitoring snapshots so the dashboard can show
    trend data across process restarts. Replaces the in-memory
    ``RealTimeSemanticMonitor.monitoring_history`` list which is
    bounded to one process.

    Shape mirrors ``models.semantic_monitoring_snapshot.SemanticMonitoringSnapshot``:
    one row per snapshot, indexed by (user_id, captured_at) for
    time-range queries.
    """
    try:
        with engine.begin() as conn:
            conn.exec_driver_sql(
                """
                CREATE TABLE IF NOT EXISTS semantic_monitoring_snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id VARCHAR(255) NOT NULL,
                    captured_at DATETIME NOT NULL,
                    snapshot_json TEXT NOT NULL
                )
                """
            )
            conn.exec_driver_sql(
                """
                CREATE INDEX IF NOT EXISTS ix_semantic_snapshot_user_captured
                ON semantic_monitoring_snapshots (user_id, captured_at)
                """
            )
    except Exception as e:
        # Don't block tenant DB init on this table's failure. The
        # monitor will fall back to its in-memory history list.
        logger.error(
            f"Failed semantic_monitoring_snapshots schema migration for user {user_id}: {e}"
        )


def _ensure_onboarding_data_integration_columns(engine, user_id: str) -> None:
    """Backfill required onboarding_data_integrations columns for legacy tenant DBs."""
    required_columns = {
        "canonical_profile": "JSON NULL",
    }

    try:
        with engine.begin() as conn:
            table_check = conn.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='onboarding_data_integrations'"
            ).fetchone()
            if not table_check:
                return

            existing_cols = {
                row[1] for row in conn.exec_driver_sql("PRAGMA table_info(onboarding_data_integrations)").fetchall()
            }

            for col_name, col_def in required_columns.items():
                if col_name not in existing_cols:
                    conn.exec_driver_sql(
                        f"ALTER TABLE onboarding_data_integrations ADD COLUMN {col_name} {col_def}"
                    )
                    logger.warning(
                        f"Auto-migrated onboarding_data_integrations column '{col_name}' for user {user_id}"
                    )
    except Exception as e:
        logger.error(f"Failed onboarding_data_integrations schema compatibility check for user {user_id}: {e}")

def _ensure_onboarding_session_payload_column(engine, user_id: str) -> None:
    """Backfill payload column for onboarding_sessions table."""
    try:
        with engine.begin() as conn:
            table_check = conn.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='onboarding_sessions'"
            ).fetchone()
            if not table_check:
                return

            existing_cols = {
                row[1] for row in conn.exec_driver_sql(
                    "PRAGMA table_info(onboarding_sessions)"
                ).fetchall()
            }

            if "payload" not in existing_cols:
                conn.exec_driver_sql(
                    "ALTER TABLE onboarding_sessions ADD COLUMN payload JSON NULL"
                )
                logger.warning(
                    f"Auto-migrated onboarding_sessions column 'payload' for user {user_id}"
                )
    except Exception as e:
        logger.error(f"Failed onboarding_sessions payload schema migration for user {user_id}: {e}")


def _sanitize_user_id(user_id: str) -> str:
    """Sanitize user_id to be safe for filesystem."""
    return "".join(c for c in user_id if c.isalnum() or c in ('-', '_'))


def ensure_user_workspace_db_directory(user_id: str) -> str:
    """Ensure modern `db/` directory exists, migrating legacy `database/` when safe."""
    safe_user_id = _sanitize_user_id(user_id)
    user_workspace = str(get_user_workspace_dir(user_id))
    db_dir = os.path.join(user_workspace, 'db')
    legacy_db_dir = os.path.join(user_workspace, 'database')

    if os.path.isdir(legacy_db_dir) and not os.path.exists(db_dir):
        try:
            os.rename(legacy_db_dir, db_dir)
            logger.info(f"Migrated legacy database directory to db/: {user_workspace}")
        except OSError as rename_error:
            logger.warning(
                f"Could not rename legacy database directory for {user_workspace}: {rename_error}"
            )
            os.makedirs(db_dir, exist_ok=True)
            for filename in os.listdir(legacy_db_dir):
                src = os.path.join(legacy_db_dir, filename)
                dst = os.path.join(db_dir, filename)
                if os.path.isfile(src) and not os.path.exists(dst):
                    try:
                        os.link(src, dst)
                    except OSError:
                        # Fall back to copy when hard-linking is not possible.
                        import shutil
                        shutil.copy2(src, dst)
    else:
        os.makedirs(db_dir, exist_ok=True)

    return db_dir

def get_user_db_path(user_id: str) -> str:
    """Get the database path for a specific user."""
    safe_user_id = _sanitize_user_id(user_id)
    user_workspace = str(get_user_workspace_dir(user_id))
    db_dir = ensure_user_workspace_db_directory(user_id)
    
    # Check for legacy naming convention first (to support existing data)
    # Some older workspaces might have 'alwrity.db' instead of 'alwrity_{user_id}.db'
    legacy_db_path = os.path.join(db_dir, 'alwrity.db')
    specific_db_path = os.path.join(db_dir, f'alwrity_{safe_user_id}.db')

    # Backward compatibility when filesystem migration couldn't run yet.
    legacy_dir_path = os.path.join(user_workspace, 'database', f'alwrity_{safe_user_id}.db')
    legacy_dir_default = os.path.join(user_workspace, 'database', 'alwrity.db')
    
    # If the specific one exists, use it (preferred)
    if os.path.exists(specific_db_path):
        return specific_db_path
        
    # If legacy exists and specific doesn't, use legacy
    if os.path.exists(legacy_db_path):
        return legacy_db_path

    if os.path.exists(legacy_dir_path):
        return legacy_dir_path

    if os.path.exists(legacy_dir_default):
        return legacy_dir_default
        
    # Default to specific for new databases
    return specific_db_path


def has_onboarding_session(user_id: str, db: Optional[Session] = None) -> bool:
    """Return True when at least one onboarding session exists for the given user."""
    if not user_id:
        return False

    db_session = db
    close_db = False

    try:
        if db_session is None:
            # Avoid opening/creating a DB for non-existent user workspace.
            db_path = get_user_db_path(user_id)
            if not os.path.exists(db_path):
                return False
            db_session = get_session_for_user(user_id)
            close_db = True

        if not db_session:
            return False

        from models.onboarding import OnboardingSession

        onboarding_row = (
            db_session.query(OnboardingSession.id)
            .filter(OnboardingSession.user_id == user_id)
            .first()
        )
        return onboarding_row is not None

    except Exception as e:
        logger.debug(f"Failed onboarding session existence check for user {user_id}: {e}")
        return False
    finally:
        if close_db and db_session:
            try:
                db_session.close()
            except Exception:
                pass

def get_all_user_ids() -> List[str]:
    """
    Discover all user IDs by scanning workspace directories.

    IMPORTANT:
    Workspace folder names are filesystem-safe IDs (sanitized). In some deployments,
    the canonical auth user ID stored in DB can contain characters that are removed
    during sanitization. To avoid downstream lookup mismatches (e.g. onboarding status
    checks), we resolve the canonical `user_id` from DB when possible.

    Returns:
        List of canonical user IDs when discoverable, otherwise workspace IDs.
    """
    user_ids: List[str] = []
    if not os.path.exists(WORKSPACE_DIR):
        return []

    try:
        workspace_ids: List[str] = []
        for item in os.listdir(WORKSPACE_DIR):
            if item.startswith("workspace_") and os.path.isdir(os.path.join(WORKSPACE_DIR, item)):
                workspace_id = item[len("workspace_"):]
                if workspace_id:
                    workspace_ids.append(workspace_id)

        # Resolve canonical IDs from DB rows when available.
        # Falls back to workspace ID for empty/new workspaces.
        from models.onboarding import OnboardingSession

        for workspace_id in workspace_ids:
            canonical_user_id = workspace_id
            db = None
            try:
                # Check if DB file exists before opening session to avoid creating/initializing DBs
                db_path = get_user_db_path(workspace_id)
                if not os.path.exists(db_path):
                    # No DB file exists, use workspace ID as fallback
                    canonical_user_id = workspace_id
                else:
                    # DB file exists, try to resolve canonical user_id from DB
                    db = get_session_for_user(workspace_id)
                    if db:
                        onboarding_row = (
                            db.query(OnboardingSession.user_id)
                            .order_by(OnboardingSession.updated_at.desc())
                            .first()
                        )
                        if onboarding_row and onboarding_row[0]:
                            canonical_user_id = str(onboarding_row[0])
            except Exception as resolve_error:
                logger.debug(
                    f"Could not resolve canonical user_id from DB for workspace {workspace_id}: {resolve_error}"
                )
            finally:
                if db:
                    db.close()

            if canonical_user_id not in user_ids:
                user_ids.append(canonical_user_id)

    except Exception as e:
        logger.error(f"Error discovering user workspaces: {e}")

    return user_ids

def get_engine_for_user(user_id: str):
    """Get or create a SQLAlchemy engine for a specific user."""
    if user_id in _user_engines:
        return _user_engines[user_id]
    
    db_path = get_user_db_path(user_id)
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    database_url = f"sqlite:///{db_path}"
    
    engine_kwargs = {
        "echo": False,
        "pool_pre_ping": True,
        "pool_recycle": 300,
        "pool_size": int(os.getenv("DB_POOL_SIZE", "20")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "40")),
        "pool_timeout": int(os.getenv("DB_POOL_TIMEOUT", "30")),
        "connect_args": {"check_same_thread": False}
    }
    
    engine = create_engine(database_url, **engine_kwargs)
    _user_engines[user_id] = engine

    # Ensure tables are initialized for this user
    # This runs once per process per user when the engine is created
    try:
        # We need to import the function here or rely on it being available in the module scope
        # Since this function is called at runtime, init_user_database should be available
        init_user_database(user_id)
    except Exception as e:
        logger.error(f"Failed to auto-initialize database for user {user_id}: {e}")
        # We don't raise here to allow the engine to be returned, 
        # but the application might fail later if tables are missing.
    
    return engine

def init_user_database(user_id: str):
    """Initialize database tables for a specific user."""
    engine = get_engine_for_user(user_id)
    try:
        # Create all tables for all models
        OnboardingBase.metadata.create_all(bind=engine)
        SEOAnalysisBase.metadata.create_all(bind=engine)
        ContentPlanningBase.metadata.create_all(bind=engine)
        EnhancedStrategyBase.metadata.create_all(bind=engine)
        _ensure_scheduler_task_columns(engine, user_id)
        _ensure_onboarding_data_integration_columns(engine, user_id)
        _ensure_onboarding_session_payload_column(engine, user_id)
        MonitoringBase.metadata.create_all(bind=engine)
        APIMonitoringBase.metadata.create_all(bind=engine)
        PersonaBase.metadata.create_all(bind=engine)
        SubscriptionBase.metadata.create_all(bind=engine)
        UserBusinessInfoBase.metadata.create_all(bind=engine)
        ContentAssetBase.metadata.create_all(bind=engine)
        BingAnalyticsBase.metadata.create_all(bind=engine)
        _ensure_daily_workflow_schema(engine, user_id)
        _ensure_task_history_unique_index(engine, user_id)
        # Phase 3.4: ensure the SIF indexing watermark table exists.
        _ensure_sif_indexing_watermark_table(engine, user_id)
        # Phase 5: ensure the semantic health checks table exists.
        # Replaces the JSON-file cadence tracker in check_cycle_handler.
        _ensure_semantic_health_checks_table(engine, user_id)
        # Phase 5: ensure the per-cycle monitoring snapshot table exists.
        # Provides durable history for the dashboard across restarts.
        _ensure_semantic_monitoring_snapshots_table(engine, user_id)
        
        # Initialize default data for new databases
        try:
            # Import here to avoid circular dependencies
            from services.subscription.pricing_service import PricingService
            
            # Create a session for data initialization
            SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
            db = SessionLocal()
            try:
                # Ensure all subscription table columns exist before querying
                from services.subscription.schema_utils import ensure_subscription_plan_columns
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
            logger.warning(f"Could not initialize pricing data (PricingService import failed): {import_error}")

        logger.info(f"Database initialized successfully for user {user_id}")
    except SQLAlchemyError as e:
        logger.error(f"Error initializing database for user {user_id}: {str(e)}")
        raise

def init_database():
    """
    Initialize global database tables (for backward compatibility/startup checks).
    Uses default engine.
    """
    if not default_engine:
        logger.warning("Global database initialization skipped: default_engine is disabled (Multi-tenant mode)")
        return

    try:
        # Create all tables for all models using default engine
        # Use checkfirst=True (default) to avoid errors for existing tables
        from sqlalchemy import create_engine
        from sqlalchemy.pool import StaticPool
        
        # Create tables with checkfirst=True explicitly to handle existing objects
        for base in [OnboardingBase, SEOAnalysisBase, ContentPlanningBase, 
                     EnhancedStrategyBase, MonitoringBase, APIMonitoringBase, 
                     PersonaBase, SubscriptionBase, UserBusinessInfoBase, ContentAssetBase]:
            base.metadata.create_all(bind=default_engine, checkfirst=True)
        logger.info("Global database initialized successfully")
    except SQLAlchemyError as e:
        logger.error(f"Error initializing global database: {str(e)}")


# Import here to avoid circular dependency at module level if possible, 
# but get_db needs it. 
# We assume auth_middleware is available.
from middleware.auth_middleware import get_current_user
from fastapi import Depends

# Legacy support for single-tenant code
# TODO: Refactor all consumers to use get_db or get_session_for_user
default_db_path = None # os.path.join(ROOT_DIR, 'alwrity.db')
DATABASE_URL = None # f"sqlite:///{default_db_path}"
default_engine = None # create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
engine = None # default_engine
SessionLocal = None # sessionmaker(autocommit=False, autoflush=False, bind=default_engine)

def get_db(current_user: dict = Depends(get_current_user)):
    """
    Database dependency for FastAPI endpoints.
    Context-aware: connects to the authenticated user's database.
    """
    user_id = current_user.get('id') or current_user.get('clerk_user_id')
    if not user_id:
        logger.error("No user ID found in context for DB connection")
        raise HTTPException(status_code=401, detail="User ID required for database access")
        
    try:
        engine = get_engine_for_user(user_id)
    except Exception as e:
        logger.error(f"[DB] Failed to create engine for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail="Database temporarily unavailable")

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Helper for scripts/legacy that explicitly know the user_id
def get_session_for_user(user_id: str) -> Optional[Session]:
    """
    Get a new database session for a specific user.
    The session is not scoped, so the caller is responsible for closing it.
    """
    engine = get_engine_for_user(user_id)
    if not engine:
        return None
        
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()

def get_db_session(user_id: Optional[str] = None) -> Optional[Session]:
    """
    DEPRECATED: Use get_session_for_user(user_id) instead.
    Legacy wrapper to prevent ImportErrors during refactoring.
    """
    from utils.logger_utils import get_service_logger
    logger = get_service_logger("database")
    # logger.warning("Using deprecated get_db_session. Please update to get_session_for_user(user_id).")
    
    if user_id:
        return get_session_for_user(user_id)
        
    # If no user_id, we can't give a valid session in multi-tenant mode
    return None


def close_database():
    """
    Close database connections.
    """
    try:
        for engine in _user_engines.values():
            engine.dispose()
        _user_engines.clear()
        logger.info("Database connections closed")
    except Exception as e:
        logger.error(f"Error closing database connections: {str(e)}")
 
