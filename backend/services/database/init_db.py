"""Database table initialization for per-user and global SQLite databases."""

from __future__ import annotations

from loguru import logger
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker

from models.base import Base

# Trigger model imports so all tables register with the shared Base
import models.agent_activity_models  # noqa: F401
import models.daily_workflow_models  # noqa: F401
import models.enhanced_calendar_models  # noqa: F401
import models.gsc_brainstorm_cache_models  # noqa: F401
import models.linkedin_monitoring_models  # noqa: F401
import models.oauth_token_monitoring_models  # noqa: F401
import models.platform_insights_monitoring_models  # noqa: F401
import models.sif_indexing_watermark  # noqa: F401
import models.website_analysis_monitoring_models  # noqa: F401
from models.daily_workflow_models import DailyWorkflowPlan, DailyWorkflowTask, TaskHistory  # noqa: F401
from models.linkedin_comment_assistant_cache_model import (  # noqa: F401
    LinkedInCommentAssistantCache,
)
from models.podcast_models import PodcastProject  # noqa: F401
from models.product_asset_models import (  # noqa: F401
    EcommerceExport,
    ProductAsset,
    ProductStyleTemplate,
)
from models.product_marketing_models import (  # noqa: F401
    Campaign,
    CampaignAsset,
    CampaignProposal,
)
from models.research_models import ResearchProject  # noqa: F401
from models.video_models import VideoGenerationTask  # noqa: F401
from models.youtube_task_models import YouTubeVideoTask  # noqa: F401

from services.database.engine import get_engine_for_user
from services.database.legacy import default_engine
from services.database.schema_migrations import run_user_schema_migrations


def init_user_database(user_id: str) -> None:
    """Initialize database tables for a specific user."""
    engine = get_engine_for_user(user_id)
    try:
        Base.metadata.create_all(bind=engine)

        run_user_schema_migrations(engine, user_id)

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
    if not default_engine:
        logger.warning(
            "Global database initialization skipped: default_engine is disabled (Multi-tenant mode)"
        )
        return

    try:
        Base.metadata.create_all(bind=default_engine, checkfirst=True)
        logger.info("Global database initialized successfully")
    except SQLAlchemyError as e:
        logger.error(f"Error initializing global database: {str(e)}")
