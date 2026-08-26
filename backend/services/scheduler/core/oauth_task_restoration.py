"""
OAuth Token Monitoring Task Restoration
Automatically creates missing OAuth monitoring tasks for users who have connected platforms
but don't have monitoring tasks created yet.
"""

from datetime import datetime, timedelta
from typing import List
from sqlalchemy.orm import Session
from utils.logger_utils import get_service_logger

from services.database import get_session_for_user, get_all_user_ids
from models.oauth_token_monitoring_models import OAuthTokenMonitoringTask
from services.oauth_token_monitoring_service import get_connected_platforms, create_oauth_monitoring_tasks

# Use service logger for consistent logging (WARNING level visible in production)
logger = get_service_logger("oauth_task_restoration")


async def restore_oauth_monitoring_tasks(scheduler):
    """
    Restore/create missing OAuth token monitoring tasks for all users.
    
    This checks all users who have connected platforms and ensures they have
    monitoring tasks created. Tasks are created for platforms that are:
    - Connected (detected via get_connected_platforms)
    - Missing monitoring tasks (no OAuthTokenMonitoringTask exists)
    
    Args:
        scheduler: TaskScheduler instance
    """
    try:
        logger.debug("[OAuth Task Restoration] Starting OAuth monitoring task restoration...")
        
        user_ids = get_all_user_ids()
        total_created = 0
        users_processed = 0
        total_existing_tasks = 0
        restoration_summary = []
        
        for user_id in user_ids:
            try:
                db = get_session_for_user(user_id)
                if not db:
                    logger.debug(f"[OAuth Task Restoration] Could not get database session for user {user_id}")
                    continue
                
                try:
                    users_processed += 1
                    
                    # Get existing tasks for this user
                    try:
                        existing_tasks = db.query(OAuthTokenMonitoringTask).filter(
                            OAuthTokenMonitoringTask.user_id == user_id
                        ).all()
                        total_existing_tasks += len(existing_tasks)
                    except Exception as table_error:
                        # Table might not exist for this user yet
                        continue
                    
                    # Get connected platforms for this user (silent - no logging)
                    connected_platforms = get_connected_platforms(user_id)
                    
                    if not connected_platforms:
                        continue
                    
                    # Check which platforms are missing tasks
                    existing_platforms = {task.platform for task in existing_tasks}
                    
                    missing_platforms = [
                        platform 
                        for platform in connected_platforms 
                        if platform not in existing_platforms
                    ]
                    
                    if missing_platforms:
                        # Create missing tasks
                        created = create_oauth_monitoring_tasks(
                            user_id=user_id,
                            db=db,
                            platforms=missing_platforms
                        )
                        
                        if created:
                            total_created += len(created)
                            platforms_str = ", ".join([p.upper() for p in missing_platforms])
                            restoration_summary.append(
                                f"  ├─ User {user_id[:20]}...: {len(created)} tasks ({platforms_str})"
                            )
                        
                finally:
                    db.close()
                    
            except Exception as e:
                logger.warning(f"[OAuth Task Restoration] Error processing user {user_id}: {e}")
                continue
        
        # Log summary
        if total_created > 0:
            summary_lines = "\n".join(restoration_summary[:5])
            if len(restoration_summary) > 5:
                summary_lines += f"\n  └─ ... and {len(restoration_summary) - 5} more users"
            
            logger.info(
                f"[OAuth Task Restoration] ✅ OAuth Monitoring Tasks Restored\n"
                f"   ├─ Users Processed: {users_processed}\n"
                f"   ├─ Existing Tasks: {total_existing_tasks}\n"
                f"   ├─ New Tasks Created: {total_created}\n"
                + summary_lines
            )
        else:
            logger.info(
                f"[OAuth Task Restoration] ✅ All users have required OAuth monitoring tasks. "
                f"Processed {users_processed} users."
            )
            
        return total_existing_tasks + total_created
            
    except Exception as e:
        logger.error(
            f"[OAuth Task Restoration] Error restoring OAuth monitoring tasks: {e}",
            exc_info=True
        )
        return 0
