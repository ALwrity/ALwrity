"""
YouTube Creator Task Manager

Hybrid DB-backed + in-memory task manager for YouTube video operations.
Writes task state to PostgreSQL so renders/combines/publishes survive
server restarts. Falls back to in-memory dict when DB is unavailable.

API surface matches Story Writer's TaskManager for drop-in compatibility.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from loguru import logger
from sqlalchemy.orm import Session

from models.youtube_task_models import YouTubeVideoTask, YouTubeTaskType, YouTubeTaskStatus
from services.database import get_session_for_user


class YouTubeTaskManager:
    """Hybrid persistent + in-memory task manager for YouTube Creator."""

    def __init__(self):
        self.task_storage: Dict[str, Dict[str, Any]] = {}

    def _get_db(self, user_id: str) -> Optional[Session]:
        """Get a DB session for the given user. Returns None on failure."""
        if not user_id:
            return None
        try:
            return get_session_for_user(user_id)
        except Exception as e:
            logger.warning(f"[YouTubeTaskManager] DB unavailable for user {user_id}: {e}")
            return None

    def _map_task_type(self, task_type_str: str) -> YouTubeTaskType:
        """Map a string task type to the enum."""
        mapping = {
            "youtube_video_render": YouTubeTaskType.RENDER,
            "youtube_scene_video_render": YouTubeTaskType.SCENE_RENDER,
            "youtube_video_combine": YouTubeTaskType.COMBINE,
            "youtube_combine_video": YouTubeTaskType.COMBINE,
            "youtube_publish": YouTubeTaskType.PUBLISH,
            "youtube_image_generation": YouTubeTaskType.IMAGE_GENERATION,
            "youtube_audio_generation": YouTubeTaskType.AUDIO_GENERATION,
        }
        return mapping.get(task_type_str, YouTubeTaskType.RENDER)

    def _map_status_to_enum(self, status: str) -> YouTubeTaskStatus:
        """Map a frontend status string to the DB enum."""
        mapping = {
            "pending": YouTubeTaskStatus.PENDING,
            "processing": YouTubeTaskStatus.PROCESSING,
            "running": YouTubeTaskStatus.PROCESSING,
            "completed": YouTubeTaskStatus.COMPLETED,
            "failed": YouTubeTaskStatus.FAILED,
        }
        return mapping.get(status, YouTubeTaskStatus.PENDING)

    def _map_status_from_enum(self, status: YouTubeTaskStatus) -> str:
        """Map DB enum to frontend status string."""
        mapping = {
            YouTubeTaskStatus.PENDING: "pending",
            YouTubeTaskStatus.PROCESSING: "processing",
            YouTubeTaskStatus.COMPLETED: "completed",
            YouTubeTaskStatus.FAILED: "failed",
        }
        return mapping.get(status, "pending")

    def create_task(
        self,
        task_type: str = "youtube_video_render",
        metadata: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
    ) -> str:
        """Create a new task. Persists to DB if user_id provided; always writes to in-memory."""
        task_id = str(uuid.uuid4())
        task_metadata = metadata or {}
        now = datetime.now(timezone.utc)

        # Always write to in-memory for fast lookups
        self.task_storage[task_id] = {
            "status": "pending",
            "created_at": now,
            "updated_at": now,
            "result": None,
            "error": None,
            "progress_messages": [],
            "task_type": task_type,
            "progress": 0.0,
            "metadata": task_metadata,
        }

        # Persist to DB
        effective_user_id = user_id or task_metadata.get("owner_user_id")
        if effective_user_id:
            db = self._get_db(effective_user_id)
            if db:
                try:
                    db_task = YouTubeVideoTask(
                        task_id=task_id,
                        user_id=effective_user_id,
                        task_type=self._map_task_type(task_type),
                        status=YouTubeTaskStatus.PENDING,
                        progress=0.0,
                        request_data=task_metadata if task_metadata else None,
                        created_at=now,
                        updated_at=now,
                    )
                    db.add(db_task)
                    db.commit()
                    logger.debug(f"[YouTubeTaskManager] Persisted task {task_id} to DB for user {effective_user_id}")
                except Exception as e:
                    logger.warning(f"[YouTubeTaskManager] Failed to persist task {task_id} to DB: {e}")
                    db.rollback()
                finally:
                    db.close()

        logger.info(f"[YouTubeTaskManager] Created task: {task_id} (type: {task_type})")
        return task_id

    def get_task_status(self, task_id: str, requester_user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Get task status. Checks in-memory first, then DB."""
        # Check in-memory first (fast path)
        if task_id in self.task_storage:
            task = self.task_storage[task_id]
            metadata = task.get("metadata", {}) or {}
            owner_user_id = metadata.get("owner_user_id")

            if requester_user_id is not None and owner_user_id is not None and requester_user_id != owner_user_id:
                logger.warning(f"[YouTubeTaskManager] Task access denied for task {task_id}")
                return None

            response = {
                "task_id": task_id,
                "status": task["status"],
                "progress": task.get("progress", 0.0),
                "message": task.get("progress_messages", [])[-1] if task.get("progress_messages") else None,
                "created_at": task["created_at"].isoformat() if task.get("created_at") else None,
                "updated_at": task.get("updated_at", task.get("created_at")).isoformat() if task.get("updated_at") or task.get("created_at") else None,
            }
            if task["status"] == "completed" and task.get("result"):
                response["result"] = task["result"]
            if task["status"] == "failed" and task.get("error"):
                response["error"] = task["error"]
                if task.get("error_status") is not None:
                    response["error_status"] = task["error_status"]
                if task.get("error_data") is not None:
                    response["error_data"] = task["error_data"]
            return response

        # Fall back to DB
        if requester_user_id:
            db = self._get_db(requester_user_id)
            if db:
                try:
                    db_task = db.query(YouTubeVideoTask).filter(YouTubeVideoTask.task_id == task_id).first()
                    if db_task:
                        status_val = self._map_status_from_enum(db_task.status)
                        response = {
                            "task_id": db_task.task_id,
                            "status": status_val,
                            "progress": db_task.progress or 0.0,
                            "message": db_task.message,
                            "created_at": db_task.created_at.isoformat() if db_task.created_at else None,
                            "updated_at": db_task.updated_at.isoformat() if db_task.updated_at else None,
                        }
                        if db_task.result:
                            response["result"] = db_task.result if isinstance(db_task.result, dict) else db_task.result
                        if db_task.error:
                            response["error"] = db_task.error
                            if isinstance(db_task.result, dict):
                                if db_task.result.get("error_status") is not None:
                                    response["error_status"] = db_task.result["error_status"]
                                if db_task.result.get("error_data") is not None:
                                    response["error_data"] = db_task.result["error_data"]
                        return response
                except Exception as e:
                    logger.warning(f"[YouTubeTaskManager] DB lookup failed for task {task_id}: {e}")
                finally:
                    db.close()

        return None

    def update_task_status(
        self,
        task_id: str,
        status: str,
        progress: Optional[float] = None,
        message: Optional[str] = None,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        error_status: Optional[int] = None,
        error_data: Optional[Dict[str, Any]] = None,
    ):
        """Update task status. Writes to both in-memory and DB."""
        now = datetime.now(timezone.utc)

        # Update in-memory
        if task_id in self.task_storage:
            task = self.task_storage[task_id]
            task["status"] = status
            task["updated_at"] = now
            if progress is not None:
                task["progress"] = progress
            if message:
                if "progress_messages" not in task:
                    task["progress_messages"] = []
                task["progress_messages"].append(message)
                logger.info(f"[YouTubeTaskManager] Task {task_id}: {message} (progress: {progress}%)")
            if result is not None:
                task["result"] = result
            if error is not None:
                task["error"] = error
                logger.error(f"[YouTubeTaskManager] Task {task_id} error: {error}")
            if error_status is not None:
                task["error_status"] = error_status
            if error_data is not None:
                task["error_data"] = error_data

            # Try DB update
            metadata = task.get("metadata", {}) or {}
            user_id = metadata.get("owner_user_id")
            self._update_db_task(task_id, user_id, status, progress, message, result, error, now)
        else:
            logger.warning(f"[YouTubeTaskManager] Cannot update non-existent task: {task_id}")

    def _update_db_task(
        self,
        task_id: str,
        user_id: Optional[str],
        status: str,
        progress: Optional[float],
        message: Optional[str],
        result: Optional[Dict[str, Any]],
        error: Optional[str],
        now: datetime,
    ):
        """Update task in DB."""
        if not user_id:
            return

        db = self._get_db(user_id)
        if not db:
            return

        try:
            db_task = db.query(YouTubeVideoTask).filter(YouTubeVideoTask.task_id == task_id).first()
            if db_task:
                db_task.status = self._map_status_to_enum(status)
                db_task.updated_at = now
                if progress is not None:
                    db_task.progress = progress
                if message:
                    db_task.message = message[:500] if message else None
                if result:
                    # Merge error fields into result if present
                    existing_result = db_task.result if isinstance(db_task.result, dict) else {}
                    existing_result.update(result)
                    db_task.result = existing_result
                if error:
                    db_task.error = error
                if status in ("completed", "failed"):
                    db_task.completed_at = now
                db.commit()
                logger.debug(f"[YouTubeTaskManager] Persisted status update for task {task_id}")
            else:
                logger.debug(f"[YouTubeTaskManager] Task {task_id} not found in DB for update")
        except Exception as e:
            logger.warning(f"[YouTubeTaskManager] Failed to update DB task {task_id}: {e}")
            db.rollback()
        finally:
            db.close()

    def recover_stale_tasks(self, user_id: str):
        """Mark in-flight tasks that were interrupted by server restart as failed.

        Called on startup for each user to handle tasks that were 'processing'
        when the server went down.
        """
        db = self._get_db(user_id)
        if not db:
            return 0

        count = 0
        try:
            stale_tasks = db.query(YouTubeVideoTask).filter(
                YouTubeVideoTask.user_id == user_id,
                YouTubeVideoTask.status.in_([
                    YouTubeTaskStatus.PENDING,
                    YouTubeTaskStatus.PROCESSING,
                ]),
            ).all()

            for task in stale_tasks:
                task.status = YouTubeTaskStatus.FAILED
                task.error = "Task interrupted by server restart"
                task.message = "Marked as failed on server restart"
                task.completed_at = datetime.now(timezone.utc)
                task.updated_at = datetime.now(timezone.utc)
                count += 1
                logger.info(f"[YouTubeTaskManager] Recovered stale task {task.task_id} for user {user_id}")

            if count > 0:
                db.commit()
                logger.info(f"[YouTubeTaskManager] Recovered {count} stale tasks for user {user_id}")
        except Exception as e:
            logger.warning(f"[YouTubeTaskManager] Failed to recover stale tasks: {e}")
            db.rollback()
        finally:
            db.close()

        return count

    def cleanup_old_tasks(self):
        """Remove in-memory tasks older than 1 hour. DB cleanup is handled by vacuum."""
        now = datetime.now(timezone.utc)
        cutoff = now.timestamp() - 3600  # 1 hour

        tasks_to_remove = []
        for task_id, task_data in self.task_storage.items():
            created_at = task_data.get("created_at")
            if created_at:
                ts = created_at.timestamp() if hasattr(created_at, 'timestamp') else 0
                if ts < cutoff:
                    tasks_to_remove.append(task_id)

        for task_id in tasks_to_remove:
            del self.task_storage[task_id]
            logger.debug(f"[YouTubeTaskManager] Cleaned up old in-memory task: {task_id}")

    def cleanup_old_db_tasks(self, days: int = 7, user_id: Optional[str] = None):
        """Delete completed/failed DB tasks older than N days."""
        if not user_id:
            return 0

        db = self._get_db(user_id)
        if not db:
            return 0

        count = 0
        try:
            from datetime import timedelta
            cutoff = datetime.now(timezone.utc) - timedelta(days=days)
            old_tasks = db.query(YouTubeVideoTask).filter(
                YouTubeVideoTask.user_id == user_id,
                YouTubeVideoTask.status.in_([YouTubeTaskStatus.COMPLETED, YouTubeTaskStatus.FAILED]),
                YouTubeVideoTask.created_at < cutoff,
            ).all()

            for task in old_tasks:
                db.delete(task)
                count += 1

            if count > 0:
                db.commit()
                logger.info(f"[YouTubeTaskManager] Cleaned up {count} old DB tasks for user {user_id}")
        except Exception as e:
            logger.warning(f"[YouTubeTaskManager] Failed to cleanup old DB tasks: {e}")
            db.rollback()
        finally:
            db.close()

        return count


# Global singleton instance
task_manager = YouTubeTaskManager()