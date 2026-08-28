"""
Platform Insights Task Restoration
Automatically creates missing platform insights tasks for users who have connected platforms
but don't have insights tasks created yet.
"""

from datetime import datetime, timedelta
from typing import List
from sqlalchemy.orm import Session
from utils.logger_utils import get_service_logger

from services.database import get_session_for_user, get_all_user_ids
from models.platform_insights_monitoring_models import PlatformInsightsTask
from services.platform_insights_monitoring_service import create_platform_insights_task
from services.oauth_token_monitoring_service import get_connected_platforms
from models.oauth_token_monitoring_models import OAuthTokenMonitoringTask

logger = get_service_logger("platform_insights_task_restoration")


async def restore_platform_insights_tasks(scheduler):
    """
    Restore/create missing platform insights tasks for all users.
    
    This checks all users who have connected platforms (GSC/Bing) and ensures they have
    insights tasks created. Tasks are created for platforms that are:
    - Connected (detected via get_connected_platforms or OAuth tasks)
    - Missing insights tasks (no PlatformInsightsTask exists)
    
    Args:
        scheduler: TaskScheduler instance
    """
    try:
        logger.debug("[Platform Insights Restoration] Starting platform insights task restoration...")
        
        user_ids = get_all_user_ids()
        total_created = 0
        users_processed = 0
        total_existing_tasks = 0
        restoration_summary = []
        
        # Platforms that support insights (GSC and Bing only)
        insights_platforms = ['gsc', 'bing']
        
        for user_id in user_ids:
            try:
                db = get_session_for_user(user_id)
                if not db:
                    logger.debug(f"[Platform Insights Restoration] Could not get database session for user {user_id}")
                    continue
                
                try:
                    users_processed += 1
                    
                    # Get existing insights tasks
                    try:
                        existing_tasks = db.query(PlatformInsightsTask).filter(
                            PlatformInsightsTask.user_id == user_id
                        ).all()
                        total_existing_tasks += len(existing_tasks)
                    except Exception as table_error:
                        # Table might not exist
                        continue
                        
                    # Get connected platforms for this user
                    connected_platforms = get_connected_platforms(user_id)
                    
                    # Filter to only GSC and Bing
                    insights_connected = [p for p in connected_platforms if p in insights_platforms]
                    
                    if not insights_connected:
                        continue
                    
                    # Check which platforms are missing insights tasks
                    existing_platforms = {task.platform for task in existing_tasks}
                    
                    missing_platforms = [
                        platform 
                        for platform in insights_connected 
                        if platform not in existing_platforms
                    ]
                    
                    if missing_platforms:
                        # Create missing tasks for each platform
                        for platform in missing_platforms:
                            try:
                                # Don't fetch site_url here - it requires API calls
                                # The executor will fetch it when the task runs (weekly)
                                result = create_platform_insights_task(
                                    user_id=user_id,
                                    platform=platform,
                                    site_url=None,
                                    db=db
                                )
                                
                                if result.get('success'):
                                    total_created += 1
                                    restoration_summary.append(
                                        f"  ├─ User {user_id[:20]}...: {platform.upper()} task created"
                                    )
                                else:
                                    logger.debug(
                                        f"[Platform Insights Restoration] Failed to create {platform} task "
                                        f"for user {user_id}: {result.get('error')}"
                                    )
                            except Exception as e:
                                logger.debug(
                                    f"[Platform Insights Restoration] Error creating {platform} task "
                                    f"for user {user_id}: {e}"
                                )
                                continue
                                
                finally:
                    db.close()
                    
            except Exception as e:
                logger.warning(f"[Platform Insights Restoration] Error processing user {user_id}: {e}")
                continue
                
        # Log summary
        if total_created > 0:
            logger.info(
                f"[Platform Insights Restoration] ✅ Created {total_created} platform insights tasks:\n" +
                "\n".join(restoration_summary)
            )
        else:
            logger.info(
                f"[Platform Insights Restoration] ✅ All users have required platform insights tasks. "
                f"Processed {users_processed} users."
            )
            
        return total_existing_tasks + total_created
            
    except Exception as e:
        logger.error(f"[Platform Insights Restoration] Error during restoration: {e}", exc_info=True)
        return 0
