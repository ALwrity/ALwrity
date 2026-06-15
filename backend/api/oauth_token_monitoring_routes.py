"""
OAuth Token Monitoring API Routes
Provides endpoints for managing OAuth token monitoring tasks and manual triggers.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime
from loguru import logger

from services.database import get_db_session
from middleware.auth_middleware import get_current_user
from models.oauth_token_monitoring_models import OAuthTokenMonitoringTask, OAuthTokenExecutionLog
from services.scheduler import get_scheduler
from services.oauth_token_monitoring_service import create_oauth_monitoring_tasks, get_connected_platforms

router = APIRouter(prefix="/api/oauth-tokens", tags=["oauth-tokens"])


@router.get("/status/{user_id}")
async def get_oauth_token_status(
    user_id: str,
    db: Session = Depends(get_db_session),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get OAuth token monitoring status for all platforms for a user.
    
    Returns:
        - List of monitoring tasks with status
        - Connection status for each platform
        - Last check time, last success, last failure
    """
    try:
        # Verify user can only access their own data
        if str(current_user.get('id')) != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get all monitoring tasks for user
        tasks = db.query(OAuthTokenMonitoringTask).filter(
            OAuthTokenMonitoringTask.user_id == user_id
        ).all()
        
        # Get connected platforms
        logger.info(f"[OAuth Status API] Getting token status for user: {user_id}")
        connected_platforms = get_connected_platforms(user_id)
        logger.info(f"[OAuth Status API] Found {len(connected_platforms)} connected platforms: {connected_platforms}")
        
        # Build status response
        platform_status = {}
        for platform in ['gsc', 'bing', 'wordpress', 'wix', 'linkedin']:
            task = next((t for t in tasks if t.platform == platform), None)
            is_connected = platform in connected_platforms
            
            platform_status[platform] = {
                'connected': is_connected,
                'monitoring_task': {
                    'id': task.id if task else None,
                    'status': task.status if task else 'not_created',
                    'last_check': task.last_check.isoformat() if task and task.last_check else None,
                    'last_success': task.last_success.isoformat() if task and task.last_success else None,
                    'last_failure': task.last_failure.isoformat() if task and task.last_failure else None,
                    'failure_reason': task.failure_reason if task else None,
                    'next_check': task.next_check.isoformat() if task and task.next_check else None,
                } if task else None
            }
            
            logger.info(
                f"[OAuth Status API] Platform {platform}: "
                f"connected={is_connected}, "
                f"task_exists={task is not None}, "
                f"task_status={task.status if task else 'N/A'}"
            )
        
        response_data = {
            "success": True,
            "data": {
                "user_id": user_id,
                "platform_status": platform_status,
                "connected_platforms": connected_platforms
            }
        }
        
        logger.info(f"[OAuth Status API] Returning status for user {user_id}: {len(connected_platforms)} platforms connected")
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting OAuth token status for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get token status: {str(e)}")


@router.post("/refresh/{user_id}/{platform}")
async def manual_refresh_token(
    user_id: str,
    platform: str,
    db: Session = Depends(get_db_session),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Manually trigger token refresh for a specific platform.
    
    This will:
    1. Find or create the monitoring task
    2. Execute the token check/refresh immediately
    3. Update the task status and next_check time
    
    Args:
        user_id: User ID
        platform: Platform identifier ('gsc', 'bing', 'wordpress', 'wix', 'linkedin')
    """
    try:
        # Verify user can only access their own data
        if str(current_user.get('id')) != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Validate platform
        valid_platforms = ['gsc', 'bing', 'wordpress', 'wix', 'linkedin']
        if platform not in valid_platforms:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid platform. Must be one of: {', '.join(valid_platforms)}"
            )
        
        # Get or create monitoring task
        task = db.query(OAuthTokenMonitoringTask).filter(
            OAuthTokenMonitoringTask.user_id == user_id,
            OAuthTokenMonitoringTask.platform == platform
        ).first()
        
        if not task:
            # Create task if it doesn't exist
            task = OAuthTokenMonitoringTask(
                user_id=user_id,
                platform=platform,
                status='active',
                next_check=datetime.utcnow(),  # Set to now to trigger immediately
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(task)
            db.commit()
            db.refresh(task)
            logger.info(f"Created monitoring task for manual refresh: user={user_id}, platform={platform}")
        
        # Get scheduler and executor
        scheduler = get_scheduler()
        try:
            executor = scheduler.registry.get_executor('oauth_token_monitoring')
        except ValueError:
            raise HTTPException(status_code=500, detail="OAuth token monitoring executor not available")
        
        # Execute task immediately
        logger.info(f"Manually triggering token refresh: user={user_id}, platform={platform}")
        result = await executor.execute_task(task, db)
        
        # Get updated task
        db.refresh(task)
        
        return {
            "success": result.success,
            "message": "Token refresh completed" if result.success else "Token refresh failed",
            "data": {
                "platform": platform,
                "status": task.status,
                "last_check": task.last_check.isoformat() if task.last_check else None,
                "last_success": task.last_success.isoformat() if task.last_success else None,
                "last_failure": task.last_failure.isoformat() if task.last_failure else None,
                "failure_reason": task.failure_reason,
                "next_check": task.next_check.isoformat() if task.next_check else None,
                "execution_result": {
                    "success": result.success,
                    "error_message": result.error_message,
                    "execution_time_ms": result.execution_time_ms,
                    "result_data": result.result_data
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error manually refreshing token for user {user_id}, platform {platform}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to refresh token: {str(e)}")


@router.get("/execution-logs/{user_id}")
async def get_execution_logs(
    user_id: str,
    platform: Optional[str] = Query(None, description="Filter by platform"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of logs"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: Session = Depends(get_db_session),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get execution logs for OAuth token monitoring tasks.
    
    Args:
        user_id: User ID
        platform: Optional platform filter
        limit: Maximum number of logs to return
        offset: Pagination offset
    """
    try:
        # Verify user can only access their own data
        if str(current_user.get('id')) != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Build query
        query = db.query(OAuthTokenExecutionLog).join(
            OAuthTokenMonitoringTask,
            OAuthTokenExecutionLog.task_id == OAuthTokenMonitoringTask.id
        ).filter(
            OAuthTokenMonitoringTask.user_id == user_id
        )
        
        # Apply platform filter if provided
        if platform:
            query = query.filter(OAuthTokenMonitoringTask.platform == platform)
        
        # Get total count
        total_count = query.count()
        
        # Get paginated logs
        logs = query.order_by(
            OAuthTokenExecutionLog.execution_date.desc()
        ).offset(offset).limit(limit).all()
        
        # Format logs
        logs_data = []
        for log in logs:
            logs_data.append({
                "id": log.id,
                "task_id": log.task_id,
                "platform": log.task.platform,  # Get platform from relationship
                "execution_date": log.execution_date.isoformat(),
                "status": log.status,
                "result_data": log.result_data,
                "error_message": log.error_message,
                "execution_time_ms": log.execution_time_ms,
                "created_at": log.created_at.isoformat()
            })
        
        return {
            "success": True,
            "data": {
                "logs": logs_data,
                "total_count": total_count,
                "limit": limit,
                "offset": offset
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting execution logs for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get execution logs: {str(e)}")


@router.post("/create-tasks/{user_id}")
async def create_monitoring_tasks(
    user_id: str,
    platforms: Optional[List[str]] = None,
    db: Session = Depends(get_db_session),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Manually create OAuth token monitoring tasks for a user.
    
    If platforms are not provided, automatically detects connected platforms.
    
    Args:
        user_id: User ID
        platforms: Optional list of platforms to create tasks for
    """
    try:
        # Verify user can only access their own data
        if str(current_user.get('id')) != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Create tasks
        tasks = create_oauth_monitoring_tasks(user_id, db, platforms)
        
        return {
            "success": True,
            "message": f"Created {len(tasks)} monitoring task(s)",
            "data": {
                "tasks_created": len(tasks),
                "tasks": [
                    {
                        "id": task.id,
                        "platform": task.platform,
                        "status": task.status,
                        "next_check": task.next_check.isoformat() if task.next_check else None
                    }
                    for task in tasks
                ]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating monitoring tasks for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create monitoring tasks: {str(e)}")

