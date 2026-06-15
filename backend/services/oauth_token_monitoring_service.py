"""
OAuth Token Monitoring Service
Service for creating and managing OAuth token monitoring tasks.
"""

from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from utils.logger_utils import get_service_logger
import os

# Use service logger for consistent logging (WARNING level visible in production)
logger = get_service_logger("oauth_token_monitoring")

from models.oauth_token_monitoring_models import OAuthTokenMonitoringTask
from services.gsc_service import GSCService
from services.integrations.bing_oauth import BingOAuthService
from services.integrations.wordpress_oauth import WordPressOAuthService
from services.integrations.linkedin_oauth import LinkedInOAuthService
from services.integrations.wix_oauth import WixOAuthService
from services.database import get_user_db_path


def get_connected_platforms(user_id: str) -> List[str]:
    """
    Detect which platforms are connected for a user by checking token storage.
    
    Checks:
    - GSC: gsc_credentials table
    - Bing: bing_oauth_tokens table
    - WordPress: wordpress_oauth_tokens table
    - Wix: wix_oauth_tokens table
    - YouTube: youtube_oauth_tokens table
    
    Args:
        user_id: User ID (Clerk string)
        
    Returns:
        List of connected platform identifiers: ['gsc', 'bing', 'wordpress', 'wix', 'youtube', 'linkedin']
    """
    connected = []
    
    # Use DEBUG level for routine checks (called frequently by dashboard)
    logger.debug(f"[OAuth Monitoring] Checking connected platforms for user: {user_id}")
    
    try:
        # Check GSC - use dynamic database path
        db_path = get_user_db_path(user_id)
        gsc_service = GSCService(db_path=db_path)
        gsc_credentials = gsc_service.load_user_credentials(user_id)
        if gsc_credentials:
            connected.append('gsc')
            logger.debug(f"[OAuth Monitoring] ✅ GSC connected for user {user_id}")
        else:
            logger.debug(f"[OAuth Monitoring] ❌ GSC not connected for user {user_id}")
    except Exception as e:
        logger.warning(f"[OAuth Monitoring] ⚠️ GSC check failed for user {user_id}: {e}", exc_info=True)
    
    try:
        # Check Bing - use dynamic database path
        db_path = get_user_db_path(user_id)
        bing_service = BingOAuthService()
        token_status = bing_service.get_user_token_status(user_id)
        has_active_tokens = token_status.get('has_active_tokens', False)
        has_expired_tokens = token_status.get('has_expired_tokens', False)
        expired_tokens = token_status.get('expired_tokens', [])
        
        # Check if expired tokens have refresh tokens (can be refreshed)
        has_refreshable_tokens = any(token.get('refresh_token') for token in expired_tokens)
        
        # Consider connected if user has active tokens OR expired tokens with refresh tokens
        if has_active_tokens or (has_expired_tokens and has_refreshable_tokens):
            connected.append('bing')
            logger.debug(f"[OAuth Monitoring] ✅ Bing connected for user {user_id}")
        else:
            logger.debug(f"[OAuth Monitoring] ❌ Bing not connected for user {user_id}")
    except Exception as e:
        logger.warning(f"[OAuth Monitoring] ⚠️ Bing check failed for user {user_id}: {e}", exc_info=True)
    
    try:
        # Check WordPress - use dynamic database path
        db_path = get_user_db_path(user_id)
        wordpress_service = WordPressOAuthService(db_path=db_path)
        token_status = wordpress_service.get_user_token_status(user_id)
        has_active_tokens = token_status.get('has_active_tokens', False)
        has_tokens = token_status.get('has_tokens', False)
        
        # Consider connected if user has any tokens (WordPress tokens may not have refresh tokens)
        # If tokens exist, user was connected even if expired (may need re-auth)
        if has_tokens:
            connected.append('wordpress')
            logger.debug(f"[OAuth Monitoring] ✅ WordPress connected for user {user_id}")
        else:
            logger.debug(f"[OAuth Monitoring] ❌ WordPress not connected for user {user_id}")
    except Exception as e:
        logger.warning(f"[OAuth Monitoring] ⚠️ WordPress check failed for user {user_id}: {e}", exc_info=True)
    
    try:
        # Check Wix - use dynamic database path
        db_path = get_user_db_path(user_id)
        wix_service = WixOAuthService(db_path=db_path)
        token_status = wix_service.get_user_token_status(user_id)
        has_active_tokens = token_status.get('has_active_tokens', False)
        has_expired_tokens = token_status.get('has_expired_tokens', False)
        expired_tokens = token_status.get('expired_tokens', [])
        
        # Check if expired tokens have refresh tokens (can be refreshed)
        has_refreshable_tokens = any(token.get('refresh_token') for token in expired_tokens)
        
        # Consider connected if user has active tokens OR expired tokens with refresh tokens
        if has_active_tokens or (has_expired_tokens and has_refreshable_tokens):
            connected.append('wix')
            logger.debug(f"[OAuth Monitoring] ✅ Wix connected for user {user_id}")
        else:
            logger.debug(f"[OAuth Monitoring] ❌ Wix not connected for user {user_id}")
    except Exception as e:
        logger.warning(f"[OAuth Monitoring] ⚠️ Wix check failed for user {user_id}: {e}", exc_info=True)
    
    try:
        # Check YouTube - use dynamic database path
        db_path = get_user_db_path(user_id)
        import sqlite3
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='youtube_oauth_tokens'"
            )
            if cursor.fetchone():
                cursor.execute(
                    "SELECT id, is_active, expires_at FROM youtube_oauth_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
                    (user_id,),
                )
                row = cursor.fetchone()
                if row:
                    token_id, is_active, expires_at_str = row
                    if is_active:
                        connected.append("youtube")
                        logger.debug(f"[OAuth Monitoring] ✅ YouTube connected for user {user_id}")
                    else:
                        logger.debug(f"[OAuth Monitoring] ❌ YouTube token inactive for user {user_id}")
                else:
                    logger.debug(f"[OAuth Monitoring] ❌ YouTube not connected for user {user_id}")
            else:
                logger.debug(f"[OAuth Monitoring] ❌ YouTube table not found for user {user_id}")
    except Exception as e:
        logger.warning(f"[OAuth Monitoring] ⚠️ YouTube check failed for user {user_id}: {e}", exc_info=True)
    
    try:
        db_path = get_user_db_path(user_id)
        linkedin_service = LinkedInOAuthService(db_path=db_path)
        token_status = linkedin_service.get_user_token_status(user_id)
        has_active = token_status.get("has_active_tokens", False)
        has_refreshable = token_status.get("has_refreshable_tokens", False)
        has_expired = token_status.get("has_expired_tokens", False)
        if has_active or (has_expired and has_refreshable):
            connected.append("linkedin")
            logger.debug(f"[OAuth Monitoring] ✅ LinkedIn connected for user {user_id}")
        else:
            logger.debug(f"[OAuth Monitoring] ❌ LinkedIn not connected for user {user_id}")
    except Exception as e:
        logger.warning(f"[OAuth Monitoring] ⚠️ LinkedIn check failed for user {user_id}: {e}", exc_info=True)
    
    # Don't log here - let the caller log a formatted summary if needed
    # This function is called frequently and should be silent
    return connected


def create_oauth_monitoring_tasks(
    user_id: str,
    db: Session,
    platforms: Optional[List[str]] = None
) -> List[OAuthTokenMonitoringTask]:
    """
    Create OAuth token monitoring tasks for a user.
    
    If platforms are not provided, automatically detects connected platforms.
    Creates one task per platform with next_check set to 7 days from now.
    
    Args:
        user_id: User ID (Clerk string)
        db: Database session
        platforms: Optional list of platforms to create tasks for.
                   If None, auto-detects connected platforms.
                   Valid values: 'gsc', 'bing', 'wordpress', 'wix', 'linkedin'
        
    Returns:
        List of created OAuthTokenMonitoringTask instances
    """
    try:
        # Auto-detect platforms if not provided
        if platforms is None:
            platforms = get_connected_platforms(user_id)
            logger.warning(f"[OAuth Monitoring] Auto-detected {len(platforms)} connected platforms for user {user_id}: {platforms}")
        else:
            logger.warning(f"[OAuth Monitoring] Creating monitoring tasks for specified platforms: {platforms}")
        
        if not platforms:
            logger.warning(f"[OAuth Monitoring] No connected platforms found for user {user_id}. No monitoring tasks created.")
            return []
        
        created_tasks = []
        now = datetime.utcnow()
        next_check = now + timedelta(days=7)  # 7 days from now
        
        for platform in platforms:
            # Check if task already exists for this user/platform combination
            existing_task = db.query(OAuthTokenMonitoringTask).filter(
                OAuthTokenMonitoringTask.user_id == user_id,
                OAuthTokenMonitoringTask.platform == platform
            ).first()
            
            if existing_task:
                logger.warning(
                    f"[OAuth Monitoring] Monitoring task already exists for user {user_id}, platform {platform}. "
                    f"Skipping creation."
                )
                continue
            
            # Create new monitoring task
            task = OAuthTokenMonitoringTask(
                user_id=user_id,
                platform=platform,
                status='active',
                next_check=next_check,
                created_at=now,
                updated_at=now
            )
            
            db.add(task)
            created_tasks.append(task)
            logger.warning(
                f"[OAuth Monitoring] Created OAuth token monitoring task for user {user_id}, "
                f"platform {platform}, next_check: {next_check.isoformat()}"
            )
        
        db.commit()
        logger.warning(
            f"[OAuth Monitoring] Successfully created {len(created_tasks)} OAuth token monitoring tasks "
            f"for user {user_id}"
        )
        
        return created_tasks
        
    except Exception as e:
        logger.error(
            f"Error creating OAuth token monitoring tasks for user {user_id}: {e}",
            exc_info=True
        )
        db.rollback()
        return []

