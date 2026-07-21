"""
Task Management System for Story Writer API

Handles background task execution, status tracking, and progress updates
for story generation operations.
"""

import asyncio
import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from fastapi import HTTPException
from loguru import logger


class TaskManager:
    """Manages background tasks for story generation."""
    
    def __init__(self):
        """Initialize the task manager."""
        self.task_storage: Dict[str, Dict[str, Any]] = {}
        logger.info("[StoryWriter] TaskManager initialized")
    
    def cleanup_old_tasks(self):
        """Remove tasks older than 1 hour to prevent memory leaks."""
        current_time = datetime.now()
        tasks_to_remove = []
        
        for task_id, task_data in self.task_storage.items():
            created_at = task_data.get("created_at")
            if created_at and (current_time - created_at).total_seconds() > 3600:  # 1 hour
                tasks_to_remove.append(task_id)
        
        for task_id in tasks_to_remove:
            del self.task_storage[task_id]
            logger.debug(f"[StoryWriter] Cleaned up old task: {task_id}")
    
    def create_task(
        self,
        task_type: str = "story_generation",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Create a new task and return its ID."""
        task_id = str(uuid.uuid4())
        task_metadata = metadata or {}
        
        self.task_storage[task_id] = {
            "status": "pending",
            "created_at": datetime.now(),
            "result": None,
            "error": None,
            "progress_messages": [],
            "task_type": task_type,
            "progress": 0.0,
            "metadata": task_metadata,
        }
        
        logger.info(f"[StoryWriter] Created task: {task_id} (type: {task_type})")
        return task_id
    
    def get_task_status(self, task_id: str, requester_user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Get the status of a task."""
        self.cleanup_old_tasks()
        
        if task_id not in self.task_storage:
            # Log at DEBUG level - task not found is expected when tasks expire or are cleaned up
            # This prevents log spam from frontend polling for expired/completed tasks
            logger.debug(f"[StoryWriter] Task not found: {task_id} (may have expired or been cleaned up)")
            return None
        
        task = self.task_storage[task_id]
        metadata = task.get("metadata", {}) or {}
        owner_user_id = metadata.get("owner_user_id")

        if requester_user_id is not None and owner_user_id is not None and requester_user_id != owner_user_id:
            logger.warning(
                f"[StoryWriter] Task access denied for task {task_id}: requester does not match owner"
            )
            return None

        progress_messages = task.get("progress_messages", [])
        response = {
            "task_id": task_id,
            "status": task["status"],
            "progress": task.get("progress", 0.0),
            "message": progress_messages[-1]["message"] if progress_messages else None,
            "progress_messages": progress_messages,
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
        """Update the status of a task."""
        if task_id not in self.task_storage:
            logger.warning(f"[StoryWriter] Cannot update non-existent task: {task_id}")
            return
        
        task = self.task_storage[task_id]
        task["status"] = status
        task["updated_at"] = datetime.now()
        
        if progress is not None:
            task["progress"] = progress
        
        if message:
            if "progress_messages" not in task:
                task["progress_messages"] = []
            task["progress_messages"].append({
                "timestamp": datetime.now().isoformat(),
                "message": message,
            })
            logger.info(f"[StoryWriter] Task {task_id}: {message} (progress: {progress}%)")
        
        if result is not None:
            task["result"] = result
        
        if error is not None:
            task["error"] = error
            logger.error(f"[StoryWriter] Task {task_id} error: {error}")
        if error_status is not None:
            task["error_status"] = error_status
        if error_data is not None:
            task["error_data"] = error_data
    
    def start_outline_generation_task(self, request_data: Dict[str, Any], user_id: str) -> str:
        """Start an outline generation operation and return a task ID for polling."""
        task_id = self.create_task("outline_generation", metadata={"owner_user_id": user_id})
        asyncio.create_task(self._run_outline_generation_task(task_id, request_data, user_id))
        return task_id

    async def _run_outline_generation_task(
        self,
        task_id: str,
        request_data: Dict[str, Any],
        user_id: str
    ):
        """Background task to run outline generation and update status."""
        from services.story_writer.story_service import StoryWriterService

        service = StoryWriterService()

        try:
            self.update_task_status(
                task_id, "processing", progress=0.0,
                message="Starting outline generation..."
            )

            self.update_task_status(
                task_id, "processing", progress=10.0,
                message="Reading your premise and story setup..."
            )

            self.update_task_status(
                task_id, "processing", progress=20.0,
                message="Building story context (persona, setting, characters, plot)..."
            )

            self.update_task_status(
                task_id, "processing", progress=35.0,
                message="Mapping scene arc — opening, development, resolution beats..."
            )

            outline = service.generate_outline(
                premise=request_data["premise"],
                persona=request_data.get("persona", ""),
                story_setting=request_data.get("story_setting", ""),
                character_input=request_data.get("character_input", ""),
                plot_elements=request_data.get("plot_elements", ""),
                writing_style=request_data.get("writing_style", ""),
                story_tone=request_data.get("story_tone", ""),
                narrative_pov=request_data.get("narrative_pov", ""),
                audience_age_group=request_data.get("audience_age_group", ""),
                content_rating=request_data.get("content_rating", ""),
                ending_preference=request_data.get("ending_preference", ""),
                user_id=user_id,
                use_structured_output=True,
                include_anime_bible=True,
            )

            self.update_task_status(
                task_id, "processing", progress=75.0,
                message="Crafting scene titles, descriptions, image prompts, and narration..."
            )

            anime_bible = None
            outline_payload = outline

            if isinstance(outline, dict):
                if "anime_bible" in outline:
                    anime_bible = outline.get("anime_bible")
                if "scenes" in outline:
                    outline_payload = outline.get("scenes")
                elif "outline" in outline:
                    outline_payload = outline.get("outline")

            result = {
                "outline": outline_payload,
                "is_structured": isinstance(outline_payload, list),
                "anime_bible": anime_bible,
            }

            self.update_task_status(
                task_id, "completed", progress=100.0,
                message="Outline generation completed!",
                result=result
            )

            logger.info(f"[StoryWriter] Outline task {task_id} completed successfully")

        except HTTPException as http_error:
            error_detail = http_error.detail
            error_message = error_detail.get("message", str(error_detail)) if isinstance(error_detail, dict) else str(error_detail)
            logger.error(f"[StoryWriter] Outline task {task_id} failed with HTTP {http_error.status_code}: {error_message}")
            self.update_task_status(
                task_id, "failed",
                error=error_message,
                error_status=http_error.status_code,
                error_data=error_detail if isinstance(error_detail, dict) else {"error": str(error_detail)},
                message=f"Outline generation failed: {error_message}"
            )

        except Exception as e:
            error_msg = str(e)
            logger.error(f"[StoryWriter] Outline task {task_id} failed: {error_msg}")
            self.update_task_status(
                task_id, "failed",
                error=error_msg,
                message=f"Outline generation failed: {error_msg}"
            )

    async def execute_story_generation_task(
        self,
        task_id: str,
        request_data: Dict[str, Any],
        user_id: str
    ):
        """Execute story generation task asynchronously."""
        from services.story_writer.story_service import StoryWriterService
        
        service = StoryWriterService()
        
        try:
            self.update_task_status(task_id, "processing", progress=0.0, message="Starting story generation...")
            
            # Step 1: Generate premise
            self.update_task_status(task_id, "processing", progress=10.0, message="Generating story premise...")
            premise = service.generate_premise(
                persona=request_data["persona"],
                story_setting=request_data["story_setting"],
                character_input=request_data["character_input"],
                plot_elements=request_data["plot_elements"],
                writing_style=request_data["writing_style"],
                story_tone=request_data["story_tone"],
                narrative_pov=request_data["narrative_pov"],
                audience_age_group=request_data["audience_age_group"],
                content_rating=request_data["content_rating"],
                ending_preference=request_data["ending_preference"],
                user_id=user_id,
            )
            
            # Step 2: Generate outline
            self.update_task_status(task_id, "processing", progress=30.0, message="Generating story outline...")
            outline = service.generate_outline(
                premise=premise,
                persona=request_data["persona"],
                story_setting=request_data["story_setting"],
                character_input=request_data["character_input"],
                plot_elements=request_data["plot_elements"],
                writing_style=request_data["writing_style"],
                story_tone=request_data["story_tone"],
                narrative_pov=request_data["narrative_pov"],
                audience_age_group=request_data["audience_age_group"],
                content_rating=request_data["content_rating"],
                ending_preference=request_data["ending_preference"],
                user_id=user_id,
            )
            
            # Step 3: Generate story start
            self.update_task_status(task_id, "processing", progress=50.0, message="Writing story beginning...")
            story_start = service.generate_story_start(
                premise=premise,
                outline=outline,
                persona=request_data["persona"],
                story_setting=request_data["story_setting"],
                character_input=request_data["character_input"],
                plot_elements=request_data["plot_elements"],
                writing_style=request_data["writing_style"],
                story_tone=request_data["story_tone"],
                narrative_pov=request_data["narrative_pov"],
                audience_age_group=request_data["audience_age_group"],
                content_rating=request_data["content_rating"],
                ending_preference=request_data["ending_preference"],
                anime_bible=request_data.get("anime_bible"),
                user_id=user_id,
            )
            
            # Step 4: Continue story
            self.update_task_status(task_id, "processing", progress=70.0, message="Continuing story generation...")
            story_text = story_start
            max_iterations = request_data.get("max_iterations", 10)
            iteration = 0
            
            while 'IAMDONE' not in story_text and iteration < max_iterations:
                iteration += 1
                progress = 70.0 + (iteration / max_iterations) * 25.0
                self.update_task_status(
                    task_id,
                    "processing",
                    progress=min(progress, 95.0),
                    message=f"Writing continuation {iteration}/{max_iterations}..."
                )
                
                continuation = service.continue_story(
                    premise=premise,
                    outline=outline,
                    story_text=story_text,
                    persona=request_data["persona"],
                    story_setting=request_data["story_setting"],
                    character_input=request_data["character_input"],
                    plot_elements=request_data["plot_elements"],
                    writing_style=request_data["writing_style"],
                    story_tone=request_data["story_tone"],
                    narrative_pov=request_data["narrative_pov"],
                    audience_age_group=request_data["audience_age_group"],
                    content_rating=request_data["content_rating"],
                    ending_preference=request_data["ending_preference"],
                    anime_bible=request_data.get("anime_bible"),
                    user_id=user_id,
                )
                
                if continuation:
                    story_text += '\n\n' + continuation
                else:
                    logger.warning(f"[StoryWriter] Empty continuation at iteration {iteration}")
                    break
            
            # Clean up and finalize
            final_story = story_text.replace('IAMDONE', '').strip()
            
            result = {
                "premise": premise,
                "outline": outline,
                "story": final_story,
                "is_complete": 'IAMDONE' in story_text or iteration >= max_iterations,
                "iterations": iteration
            }
            
            self.update_task_status(
                task_id,
                "completed",
                progress=100.0,
                message="Story generation completed!",
                result=result
            )
            
            logger.info(f"[StoryWriter] Task {task_id} completed successfully")
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"[StoryWriter] Task {task_id} failed: {error_msg}")
            self.update_task_status(
                task_id,
                "failed",
                error=error_msg,
                message=f"Story generation failed: {error_msg}"
            )


# Global task manager instance
task_manager = TaskManager()
