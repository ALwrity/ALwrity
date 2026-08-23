import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool
from alembic import context

# Ensure the backend directory is on sys.path so we can import models.
_backend_root = Path(__file__).resolve().parents[1]
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import the shared Base and trigger all model registrations.
from models.base import Base  # noqa: E402
import models  # noqa: E402

# Load all model modules so their tables register with Base.metadata.
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
import models.daily_workflow_models  # noqa: E402, F401
import models.workflow_execution_models  # noqa: E402, F401
import models.enhanced_calendar_models  # noqa: E402, F401
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
import models.youtube_channel_bible_models  # noqa: E402, F401

target_metadata = Base.metadata


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
