"""
OAuth Token Monitoring Service
Service for creating and managing OAuth token monitoring tasks.
"""

from datetime import datetime, timedelta
from typing import Callable, List, Optional, Tuple
from sqlalchemy.orm import Session
from utils.logger_utils import get_service_logger
import os

# Use service logger for consistent logging (WARNING level visible in production)
logger = get_service_logger("oauth_token_monitoring")

from models.oauth_token_monitoring_models import OAuthTokenMonitoringTask
from services.gsc_service import GSCService
from services.integrations.bing_oauth import BingOAuthService
from services.integrations.wordpress_oauth import WordPressOAuthService
from services.integrations.wix_oauth import WixOAuthService
# YouTube OAuth service is imported lazily inside _check_youtube() so the
# module import doesn't fail in environments where Google credentials aren't
# configured.
from services.database import get_user_db_path


# Per-platform connection checkers. Each is Callable[[str], bool]: takes a
# user_id, returns True if the user has at least one valid token for that
# platform. Order matches the historical order of the inline blocks so the
# returned list preserves stability for callers.
def _check_gsc(user_id: str) -> bool:
    db_path = get_user_db_path(user_id)
    gsc_service = GSCService(db_path=db_path)
    return bool(gsc_service.load_user_credentials(user_id))


def _check_bing(user_id: str) -> bool:
    bing_service = BingOAuthService()
    token_status = bing_service.get_user_token_status(user_id)
    if token_status.get('has_active_tokens'):
        return True
    expired = token_status.get('expired_tokens', [])
    return bool(expired) and any(t.get('refresh_token') for t in expired)


def _check_wordpress(user_id: str) -> bool:
    db_path = get_user_db_path(user_id)
    wordpress_service = WordPressOAuthService(db_path=db_path)
    token_status = wordpress_service.get_user_token_status(user_id)
    return bool(token_status.get('has_tokens'))


def _check_wix(user_id: str) -> bool:
    db_path = get_user_db_path(user_id)
    wix_service = WixOAuthService(db_path=db_path)
    token_status = wix_service.get_user_token_status(user_id)
    if token_status.get('has_active_tokens'):
        return True
    expired = token_status.get('expired_tokens', [])
    return bool(expired) and any(t.get('refresh_token') for t in expired)


def _check_youtube(user_id: str) -> bool:
    # Imported lazily so the module can load in environments without
    # GOOGLE_CLIENT_ID / YOUTUBE_TOKEN_ENCRYPTION_KEY configured.
    from services.youtube.youtube_oauth_service import YouTubeOAuthService
    try:
        youtube_service = YouTubeOAuthService()
        status = youtube_service.get_connection_status(user_id)
        return bool(status.get('connected'))
    except Exception as exc:
        # Constructor may raise (missing key, missing client_id) or the
        # status call may hit a database error. Either way, treat as
        # "not connected" so we don't poison the whole detection.
        logger.debug(
            f"[OAuth Monitoring] YouTube check skipped for user {user_id}: {exc}"
        )
        return False


# Stable ordering preserved from the previous inline implementation.
_PLATFORM_CHECKS: List[Tuple[str, Callable[[str], bool]]] = [
    ('gsc', _check_gsc),
    ('bing', _check_bing),
    ('wordpress', _check_wordpress),
    ('wix', _check_wix),
    ('youtube', _check_youtube),
]


def _safe_check(platform: str, checker: Callable[[str], bool], user_id: str) -> bool:
    """Run a per-platform connection check, swallowing any exception.

    One platform's check must never abort the rest of the detection loop.
    """
    try:
        connected = bool(checker(user_id))
        if connected:
            logger.debug(
                f"[OAuth Monitoring] \u2705 {platform} connected for user {user_id}"
            )
        else:
            logger.debug(
                f"[OAuth Monitoring] \u274c {platform} not connected for user {user_id}"
            )
        return connected
    except Exception as exc:
        logger.warning(
            f"[OAuth Monitoring] \u26a0\ufe0f {platform} check failed for user {user_id}: {exc}",
            exc_info=True,
        )
        return False


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
        List of connected platform identifiers: ['gsc', 'bing', 'wordpress', 'wix', 'youtube']
    """
    connected: List[str] = []

    # Use DEBUG level for routine checks (called frequently by dashboard)
    logger.debug(f"[OAuth Monitoring] Checking connected platforms for user: {user_id}")

    for platform_id, checker in _PLATFORM_CHECKS:
        if _safe_check(platform_id, checker, user_id):
            connected.append(platform_id)

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
                   Valid values: 'gsc', 'bing', 'wordpress', 'wix'
        
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

