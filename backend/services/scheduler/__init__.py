"""
Task Scheduler Package
Modular, pluggable scheduler for ALwrity tasks.
"""

import os

from sqlalchemy.orm import Session
from apscheduler.triggers.cron import CronTrigger

from .core.scheduler import TaskScheduler
from .core.executor_interface import TaskExecutor, TaskExecutionResult
from .core.exception_handler import (
    SchedulerExceptionHandler, SchedulerException, SchedulerErrorType, SchedulerErrorSeverity,
    TaskExecutionError, DatabaseError, TaskLoaderError, SchedulerConfigError
)
from .executors.monitoring_task_executor import MonitoringTaskExecutor
from .executors.oauth_token_monitoring_executor import OAuthTokenMonitoringExecutor
from .executors.website_analysis_executor import WebsiteAnalysisExecutor
from .executors.onboarding_full_website_analysis_executor import OnboardingFullWebsiteAnalysisExecutor
from .executors.deep_competitor_analysis_executor import DeepCompetitorAnalysisExecutor
from .executors.deep_website_crawl_executor import DeepWebsiteCrawlExecutor
from .executors.gsc_insights_executor import GSCInsightsExecutor
from .executors.bing_insights_executor import BingInsightsExecutor
from .executors.advertools_executor import AdvertoolsExecutor
from .executors.sif_indexing_executor import SIFIndexingExecutor
from .executors.market_trends_executor import MarketTrendsExecutor
from .utils.task_loader import load_due_monitoring_tasks
from .utils.oauth_token_task_loader import (
    load_due_oauth_token_monitoring_tasks,
    load_near_expiry_oauth_token_tasks
)
from .utils.website_analysis_task_loader import load_due_website_analysis_tasks
from .utils.onboarding_full_website_analysis_task_loader import load_due_onboarding_full_website_analysis_tasks
from .utils.deep_competitor_analysis_task_loader import load_due_deep_competitor_analysis_tasks
from .utils.deep_website_crawl_task_loader import load_due_deep_website_crawl_tasks
from .utils.platform_insights_task_loader import load_due_platform_insights_tasks
from .utils.advertools_task_loader import load_due_advertools_tasks
from .utils.sif_indexing_task_loader import load_due_sif_indexing_tasks
from .utils.market_trends_task_loader import load_due_market_trends_tasks
from services.today_workflow_service import generate_scheduled_daily_workflows

# Global scheduler instance (initialized on first access)
_scheduler_instance: TaskScheduler = None


def get_scheduler() -> TaskScheduler:
    """
    Get global scheduler instance (singleton pattern).
    
    Returns:
        TaskScheduler instance
    """
    global _scheduler_instance
    if _scheduler_instance is None:
        _scheduler_instance = TaskScheduler(
            check_interval_minutes=15,
            max_concurrent_executions=10
        )
        
        # Register monitoring task executor
        monitoring_executor = MonitoringTaskExecutor()
        _scheduler_instance.register_executor(
            'monitoring_task',
            monitoring_executor,
            load_due_monitoring_tasks
        )
        
        # Register OAuth token monitoring executor
        oauth_token_executor = OAuthTokenMonitoringExecutor()
        _scheduler_instance.register_executor(
            'oauth_token_monitoring',
            oauth_token_executor,
            load_due_oauth_token_monitoring_tasks
        )
        _scheduler_instance.register_executor(
            'oauth_token_refresh',
            oauth_token_executor,
            load_near_expiry_oauth_token_tasks
        )
        
        # Register website analysis executor
        website_analysis_executor = WebsiteAnalysisExecutor()
        _scheduler_instance.register_executor(
            'website_analysis',
            website_analysis_executor,
            load_due_website_analysis_tasks
        )

        onboarding_full_site_executor = OnboardingFullWebsiteAnalysisExecutor()
        _scheduler_instance.register_executor(
            'onboarding_full_website_analysis',
            onboarding_full_site_executor,
            load_due_onboarding_full_website_analysis_tasks
        )

        deep_competitor_analysis_executor = DeepCompetitorAnalysisExecutor()
        _scheduler_instance.register_executor(
            'deep_competitor_analysis',
            deep_competitor_analysis_executor,
            load_due_deep_competitor_analysis_tasks
        )
        
        # Register deep website crawl executor
        deep_website_crawl_executor = DeepWebsiteCrawlExecutor()
        _scheduler_instance.register_executor(
            'deep_website_crawl',
            deep_website_crawl_executor,
            load_due_deep_website_crawl_tasks
        )
        
        # Register platform insights executors
        # GSC insights executor
        def load_due_gsc_insights_tasks(db: Session, user_id=None):
            return load_due_platform_insights_tasks(db, user_id, platform='gsc')
        
        gsc_insights_executor = GSCInsightsExecutor()
        _scheduler_instance.register_executor(
            'gsc_insights',
            gsc_insights_executor,
            load_due_gsc_insights_tasks
        )
        
        # Bing insights executor
        def load_due_bing_insights_tasks(db: Session, user_id=None):
            return load_due_platform_insights_tasks(db, user_id, platform='bing')
        
        bing_insights_executor = BingInsightsExecutor()
        _scheduler_instance.register_executor(
            'bing_insights',
            bing_insights_executor,
            load_due_bing_insights_tasks
        )

        # Register Advertools executor
        advertools_executor = AdvertoolsExecutor()
        _scheduler_instance.register_executor(
            'advertools_intelligence',
            advertools_executor,
            load_due_advertools_tasks
        )

        # Register SIF indexing executor
        sif_indexing_executor = SIFIndexingExecutor()
        _scheduler_instance.register_executor(
            'sif_indexing',
            sif_indexing_executor,
            load_due_sif_indexing_tasks
        )

        # Register market trends executor
        market_trends_executor = MarketTrendsExecutor()
        _scheduler_instance.register_executor(
            'market_trends',
            market_trends_executor,
            load_due_market_trends_tasks
        )

        today_workflow_hour_utc = int(os.getenv('TODAY_WORKFLOW_SCHEDULE_HOUR_UTC', '2'))
        today_workflow_minute_utc = int(os.getenv('TODAY_WORKFLOW_SCHEDULE_MINUTE_UTC', '0'))
        _scheduler_instance.scheduler.add_job(
            generate_scheduled_daily_workflows,
            trigger=CronTrigger(hour=today_workflow_hour_utc, minute=today_workflow_minute_utc, timezone='UTC'),
            id='generate_daily_workflows',
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=3600,
        )
    
    return _scheduler_instance


__all__ = [
    'TaskScheduler',
    'TaskExecutor',
    'TaskExecutionResult',
    'MonitoringTaskExecutor',
    'OAuthTokenMonitoringExecutor',
    'WebsiteAnalysisExecutor',
    'OnboardingFullWebsiteAnalysisExecutor',
    'GSCInsightsExecutor',
    'BingInsightsExecutor',
    'SIFIndexingExecutor',
    'MarketTrendsExecutor',
    'get_scheduler',
    # Exception handling
    'SchedulerExceptionHandler',
    'SchedulerException',
    'SchedulerErrorType',
    'SchedulerErrorSeverity',
    'TaskExecutionError',
    'DatabaseError',
    'TaskLoaderError',
    'SchedulerConfigError'
]
