from typing import Dict, Any, Optional
import uuid
from datetime import datetime
from loguru import logger
from sqlalchemy.orm import sessionmaker
from services.database import get_engine_for_user
from models.video_models import VideoGenerationTask, VideoTaskStatus


class TaskManager:
    def __init__(self):
        pass

    def create_task(self, task_type: str, user_id: str, request_data: Optional[Dict] = None) -> str:
        """Create a new persistent task."""
        task_id = str(uuid.uuid4())
        
        try:
            engine = get_engine_for_user(user_id)
            SessionLocal = sessionmaker(bind=engine)
            db = SessionLocal()
            
            try:
                task = VideoGenerationTask(
                    task_id=task_id,
                    user_id=user_id,
                    status=VideoTaskStatus.PENDING,
                    request_data=request_data
                )
                db.add(task)
                db.commit()
                logger.info(f"[VideoStudio] Created persistent task {task_id} for user {user_id}")
                return task_id
            finally:
                db.close()
        except Exception as e:
            logger.error(f"[VideoStudio] Failed to create task: {e}")
            raise

    def update_task(
        self,
        task_id: str,
        status: str,
        result: Optional[Dict] = None,
        error: Optional[str] = None,
        user_id: str = None,
        progress: float = None,
        message: str = None,
        error_status: Optional[int] = None,
        error_data: Optional[Dict[str, Any]] = None,
    ):
        """Update an existing task."""
        if not user_id:
            logger.error(f"[VideoStudio] Cannot update task {task_id} without user_id")
            return

        try:
            engine = get_engine_for_user(user_id)
            SessionLocal = sessionmaker(bind=engine)
            db = SessionLocal()
            
            try:
                task = db.query(VideoGenerationTask).filter(VideoGenerationTask.task_id == task_id).first()
                if not task:
                    logger.warning(f"[VideoStudio] Task {task_id} not found in DB for update")
                    return
                
                # Map string status to Enum
                try:
                    # Handle case-insensitive status mapping
                    status_upper = status.upper()
                    if status_upper == "RUNNING": 
                        status_upper = "PROCESSING"
                    enum_status = VideoTaskStatus[status_upper]
                except KeyError:
                    logger.warning(f"[VideoStudio] Invalid status {status}, defaulting to PROCESSING")
                    enum_status = VideoTaskStatus.PROCESSING
                
                task.status = enum_status
                task.updated_at = datetime.utcnow()
                
                if result:
                    task.result = result
                if error:
                    task.error = error
                if error_status is not None or error_data is not None:
                    result_payload = task.result if isinstance(task.result, dict) else {}
                    if error_status is not None:
                        result_payload["error_status"] = error_status
                    if error_data is not None:
                        result_payload["error_data"] = error_data
                    task.result = result_payload
                if progress is not None:
                    task.progress = progress
                if message:
                    task.message = message
                
                db.commit()
                logger.debug(f"[VideoStudio] Updated task {task_id} to {status}")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"[VideoStudio] Failed to update task {task_id}: {e}")

    def get_task(self, task_id: str, user_id: str = None) -> Optional[Dict[str, Any]]:
        """Retrieve task status."""
        if not user_id:
            logger.error(f"[VideoStudio] Cannot get task {task_id} without user_id")
            return None

        try:
            engine = get_engine_for_user(user_id)
            SessionLocal = sessionmaker(bind=engine)
            db = SessionLocal()
            
            try:
                task = db.query(VideoGenerationTask).filter(VideoGenerationTask.task_id == task_id).first()
                if not task:
                    return None
                
                # Map internal status to frontend status
                status_val = task.status.value
                if status_val == "processing":
                    status_val = "running"

                response = {
                    "task_id": task.task_id,
                    "status": status_val,
                    "result": task.result,
                    "error": task.error,
                    "progress": task.progress,
                    "message": task.message,
                    "created_at": task.created_at,
                    "updated_at": task.updated_at
                }
                if isinstance(task.result, dict):
                    if task.result.get("error_status") is not None:
                        response["error_status"] = task.result.get("error_status")
                    if task.result.get("error_data") is not None:
                        response["error_data"] = task.result.get("error_data")
                return response
            finally:
                db.close()
        except Exception as e:
            logger.error(f"[VideoStudio] Failed to get task {task_id}: {e}")
            return None

task_manager = TaskManager()
