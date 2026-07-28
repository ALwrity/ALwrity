"""
Task Management System for Blog Writer API

Handles background task execution, status tracking, and progress updates
for research and outline generation operations.
Now uses database-backed persistence for reliability and recovery.
"""

import asyncio
import uuid
from datetime import datetime
from typing import Any, Dict, List
from fastapi import HTTPException
from loguru import logger
from sqlalchemy.orm import Session
from services.database import get_session_for_user

from models.blog_models import (
    BlogResearchRequest,
    BlogOutlineRequest,
    MediumBlogGenerateRequest,
    MediumBlogGenerateResult,
)
from services.blog_writer.blog_service import BlogWriterService
from services.blog_writer.database_task_manager import DatabaseTaskManager
from utils.text_asset_tracker import save_and_track_text_content


class TaskManager:
    """Manages background tasks for research and outline generation."""
    
    def __init__(self, db_connection=None):
        # Fallback to in-memory storage if no database connection
        if db_connection:
            self.db_manager = DatabaseTaskManager(db_connection)
            self.use_database = True
        else:
            self.task_storage: Dict[str, Dict[str, Any]] = {}
            self.service = BlogWriterService()
            self.use_database = False
            logger.warning("No database connection provided, using in-memory task storage")
    
    def cleanup_old_tasks(self):
        """Remove tasks older than 1 hour to prevent memory leaks."""
        current_time = datetime.now()
        tasks_to_remove = []
        
        for task_id, task_data in self.task_storage.items():
            if (current_time - task_data["created_at"]).total_seconds() > 3600:  # 1 hour
                tasks_to_remove.append(task_id)
        
        for task_id in tasks_to_remove:
            del self.task_storage[task_id]
    
    def create_task(self, task_type: str = "general") -> str:
        """Create a new task and return its ID."""
        task_id = str(uuid.uuid4())
        
        self.task_storage[task_id] = {
            "status": "pending",
            "created_at": datetime.now(),
            "result": None,
            "error": None,
            "progress_messages": [],
            "task_type": task_type
        }
        
        return task_id
    
    async def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """Get the status of a task."""
        if self.use_database:
            return await self.db_manager.get_task_status(task_id)
        else:
            self.cleanup_old_tasks()
            
            if task_id not in self.task_storage:
                return None
            
            task = self.task_storage[task_id]
            response = {
                "task_id": task_id,
                "status": task["status"],
                "created_at": task["created_at"].isoformat(),
                "progress_messages": task.get("progress_messages", [])
            }
            
            if task["status"] == "completed":
                response["result"] = task["result"]
            elif task["status"] == "failed":
                response["error"] = task["error"]
                if "error_status" in task:
                    response["error_status"] = task["error_status"]
                    logger.info(f"[TaskManager] get_task_status for {task_id}: Including error_status={task['error_status']} in response")
                if "error_data" in task:
                    response["error_data"] = task["error_data"]
                    logger.info(f"[TaskManager] get_task_status for {task_id}: Including error_data with keys: {list(task['error_data'].keys()) if isinstance(task['error_data'], dict) else 'not-dict'}")
                else:
                    logger.warning(f"[TaskManager] get_task_status for {task_id}: Task failed but no error_data found. Task keys: {list(task.keys())}")
            
            return response
    
    async def update_progress(self, task_id: str, message: str, percentage: float = None):
        """Update progress message for a task."""
        if self.use_database:
            await self.db_manager.update_progress(task_id, message, percentage)
        else:
            if task_id in self.task_storage:
                if "progress_messages" not in self.task_storage[task_id]:
                    self.task_storage[task_id]["progress_messages"] = []
                
                progress_entry = {
                    "timestamp": datetime.now().isoformat(),
                    "message": message
                }
                self.task_storage[task_id]["progress_messages"].append(progress_entry)
                
                # Keep only last 10 progress messages to prevent memory bloat
                if len(self.task_storage[task_id]["progress_messages"]) > 10:
                    self.task_storage[task_id]["progress_messages"] = self.task_storage[task_id]["progress_messages"][-10:]
                
                logger.info(f"Progress update for task {task_id}: {message}")
    
    async def start_research_task(self, request: BlogResearchRequest, user_id: str) -> str:
        """Start a research operation and return a task ID."""
        if self.use_database:
            return await self.db_manager.start_research_task(request, user_id)
        else:
            task_id = self.create_task("research")
            # Store user_id in task for subscription checks
            if task_id in self.task_storage:
                self.task_storage[task_id]["user_id"] = user_id
            # Start the research operation in the background
            asyncio.create_task(self._run_research_task(task_id, request, user_id))
            return task_id
    
    def start_outline_task(self, request: BlogOutlineRequest, user_id: str) -> str:
        """Start an outline generation operation and return a task ID."""
        task_id = self.create_task("outline")
        
        # Start the outline generation operation in the background
        asyncio.create_task(self._run_outline_generation_task(task_id, request, user_id))
        
        return task_id

    def start_medium_generation_task(self, request: MediumBlogGenerateRequest, user_id: str) -> str:
        """Start a medium (≤1000 words) full-blog generation task."""
        task_id = self.create_task("medium_generation")
        asyncio.create_task(self._run_medium_generation_task(task_id, request, user_id))
        return task_id

    def start_content_generation_task(self, request: MediumBlogGenerateRequest, user_id: str) -> str:
        """Start content generation (full blog via sections) with provider parity.

        Internally reuses medium generator pipeline for now but tracked under
        distinct task_type 'content_generation' and same polling contract.
        
        Args:
            request: Content generation request
            user_id: User ID (required for subscription checks and usage tracking)
        """
        task_id = self.create_task("content_generation")
        asyncio.create_task(self._run_medium_generation_task(task_id, request, user_id))
        return task_id
    
    async def _run_research_task(self, task_id: str, request: BlogResearchRequest, user_id: str):
        """Background task to run research and update status with progress messages."""
        try:
            # Update status to running
            self.task_storage[task_id]["status"] = "running"
            self.task_storage[task_id]["progress_messages"] = []
            
            # Send initial progress message
            await self.update_progress(task_id, "🔍 Starting research operation...")
            
            # Check cache first
            await self.update_progress(task_id, "📋 Checking cache for existing research...")
            
            # Run the actual research with progress updates (pass user_id for subscription checks)
            result = await self.service.research_with_progress(request, task_id, user_id)
            
            # Check if research failed gracefully
            if not result.success:
                await self.update_progress(task_id, f"❌ Research failed: {result.error_message or 'Unknown error'}")
                self.task_storage[task_id]["status"] = "failed"
                self.task_storage[task_id]["error"] = result.error_message or "Research failed"
                self.task_storage[task_id]["error_data"] = {"error_message": result.error_message or "Research failed", "error_type": "ResearchServiceError"}
            else:
                await self.update_progress(task_id, f"✅ Research completed successfully! Found {len(result.sources)} sources and {len(result.search_queries or [])} search queries.")
                # Update status to completed
                self.task_storage[task_id]["status"] = "completed"
                self.task_storage[task_id]["result"] = result.dict()
            
        except HTTPException as http_error:
            # Handle HTTPException (e.g., 429 subscription limit) - preserve error details for frontend
            error_detail = http_error.detail
            error_message = error_detail.get('message', str(error_detail)) if isinstance(error_detail, dict) else str(error_detail)
            await self.update_progress(task_id, f"❌ {error_message}")
            self.task_storage[task_id]["status"] = "failed"
            self.task_storage[task_id]["error"] = error_message
            # Store HTTP error details for frontend modal
            self.task_storage[task_id]["error_status"] = http_error.status_code
            self.task_storage[task_id]["error_data"] = error_detail if isinstance(error_detail, dict) else {"error": str(error_detail)}
        except Exception as e:
            await self.update_progress(task_id, f"❌ Research failed with error: {str(e)}")
            # Update status to failed
            self.task_storage[task_id]["status"] = "failed"
            self.task_storage[task_id]["error"] = str(e)
            self.task_storage[task_id]["error_data"] = {"error_message": str(e), "error_type": type(e).__name__}
        
        # Ensure we always send a final completion message
        finally:
            if task_id in self.task_storage:
                current_status = self.task_storage[task_id]["status"]
                if current_status not in ["completed", "failed"]:
                    # Force completion if somehow we didn't set a final status
                    await self.update_progress(task_id, "⚠️ Research operation completed with unknown status")
                    self.task_storage[task_id]["status"] = "failed"
                    self.task_storage[task_id]["error"] = "Research completed with unknown status"
                    self.task_storage[task_id]["error_data"] = {"error_message": "Research completed with unknown status", "error_type": "UnknownCompletionState"}
    
    async def _run_outline_generation_task(self, task_id: str, request: BlogOutlineRequest, user_id: str):
        """Background task to run outline generation and update status with progress messages."""
        try:
            # Update status to running
            self.task_storage[task_id]["status"] = "running"
            self.task_storage[task_id]["progress_messages"] = []
            
            # Send initial progress message
            await self.update_progress(task_id, "🧩 Starting outline generation...")
            
            # Run the actual outline generation with progress updates (pass user_id for subscription checks)
            result = await self.service.generate_outline_with_progress(request, task_id, user_id)
            
            # Update status to completed
            await self.update_progress(task_id, f"✅ Outline generated successfully! Created {len(result.outline)} sections with {len(result.title_options)} title options.")
            self.task_storage[task_id]["status"] = "completed"
            self.task_storage[task_id]["result"] = result.dict()
            
        except HTTPException as http_error:
            # Handle HTTPException (e.g., 429 subscription limit) - preserve error details for frontend
            error_detail = http_error.detail
            error_message = error_detail.get('message', str(error_detail)) if isinstance(error_detail, dict) else str(error_detail)
            await self.update_progress(task_id, f"❌ {error_message}")
            self.task_storage[task_id]["status"] = "failed"
            self.task_storage[task_id]["error"] = error_message
            # Store HTTP error details for frontend modal
            self.task_storage[task_id]["error_status"] = http_error.status_code
            self.task_storage[task_id]["error_data"] = error_detail if isinstance(error_detail, dict) else {"error": str(error_detail)}
        except Exception as e:
            await self.update_progress(task_id, f"❌ Outline generation failed: {str(e)}")
            # Update status to failed
            self.task_storage[task_id]["status"] = "failed"
            self.task_storage[task_id]["error"] = str(e)
            self.task_storage[task_id]["error_data"] = {"error_message": str(e), "error_type": type(e).__name__}

    async def _run_medium_generation_task(self, task_id: str, request: MediumBlogGenerateRequest, user_id: str):
        """Background task to generate a medium blog using a single structured JSON call."""
        try:
            self.task_storage[task_id]["status"] = "running"
            self.task_storage[task_id]["progress_messages"] = []

            await self.update_progress(task_id, "📝 Alwrity is preparing your blog content — this usually takes 20–40 seconds.")
            await self.update_progress(task_id, "📦 Packaging your outline sections and research data...")

            # Basic guard: respect global target words
            total_target = int(request.globalTargetWords or 1000)
            if total_target > 1000:
                raise ValueError("Global target words exceed 1000; medium generation not allowed")

            # Create a sync session for asset saving
            db_session = get_session_for_user(user_id)
            try:
                result: MediumBlogGenerateResult = await self.service.generate_medium_blog_with_progress(
                    request,
                    task_id,
                    user_id,
                    db=db_session
                )
            finally:
                db_session.close()

            if not result or not getattr(result, "sections", None):
                raise ValueError("Empty generation result from model")

            # Check if result came from cache
            cache_hit = getattr(result, 'cache_hit', False)
            if cache_hit:
                await self.update_progress(task_id, "⚡ Found existing content in cache — no need to regenerate!")
            else:
                await self.update_progress(task_id, "🧠 AI is writing each section with research-backed insights and natural flow...")
                await self.update_progress(task_id, "✨ Polishing content — improving structure, readability, and transitions...")

            # Mark completed
            self.task_storage[task_id]["status"] = "completed"
            self.task_storage[task_id]["result"] = result.dict()
            section_count = len(result.sections)
            total_words = sum(getattr(s, 'wordCount', 0) or 0 for s in result.sections)
            await self.update_progress(
                task_id,
                f"✅ Content generation complete! {section_count} sections written ({total_words} words). "
                "Next up: SEO Analysis to optimize your blog for search engines."
            )

            # Note: Blog content tracking is handled in the status endpoint
            # to ensure we have proper database session and user context

        except HTTPException as http_error:
            # Handle HTTPException (e.g., 429 subscription limit) - preserve error details for frontend
            logger.info(f"[TaskManager] Caught HTTPException in medium generation task {task_id}: status={http_error.status_code}, detail={http_error.detail}")
            error_detail = http_error.detail
            error_message = error_detail.get('message', str(error_detail)) if isinstance(error_detail, dict) else str(error_detail)
            await self.update_progress(task_id, f"❌ {error_message}")
            self.task_storage[task_id]["status"] = "failed"
            self.task_storage[task_id]["error"] = error_message
            # Store HTTP error details for frontend modal
            self.task_storage[task_id]["error_status"] = http_error.status_code
            self.task_storage[task_id]["error_data"] = error_detail if isinstance(error_detail, dict) else {"error": str(error_detail)}
            logger.info(f"[TaskManager] Stored error_status={http_error.status_code} and error_data keys: {list(error_detail.keys()) if isinstance(error_detail, dict) else 'not-dict'}")
        except Exception as e:
            # Check if this is an HTTPException that got wrapped (can happen in async tasks)
            # HTTPException has status_code and detail attributes
            logger.info(f"[TaskManager] Caught Exception in medium generation task {task_id}: type={type(e).__name__}, has_status_code={hasattr(e, 'status_code')}, has_detail={hasattr(e, 'detail')}")
            if hasattr(e, 'status_code') and hasattr(e, 'detail'):
                # This is an HTTPException that was caught as generic Exception
                logger.info(f"[TaskManager] Detected HTTPException in Exception handler: status={e.status_code}, detail={e.detail}")
                error_detail = e.detail
                error_message = error_detail.get('message', str(error_detail)) if isinstance(error_detail, dict) else str(error_detail)
                await self.update_progress(task_id, f"❌ {error_message}")
                self.task_storage[task_id]["status"] = "failed"
                self.task_storage[task_id]["error"] = error_message
                # Store HTTP error details for frontend modal
                self.task_storage[task_id]["error_status"] = e.status_code
                self.task_storage[task_id]["error_data"] = error_detail if isinstance(error_detail, dict) else {"error": str(error_detail)}
                logger.info(f"[TaskManager] Stored error_status={e.status_code} and error_data keys: {list(error_detail.keys()) if isinstance(error_detail, dict) else 'not-dict'}")
            else:
                await self.update_progress(task_id, f"❌ Medium generation failed: {str(e)}")
                self.task_storage[task_id]["status"] = "failed"
                self.task_storage[task_id]["error"] = str(e)
                self.task_storage[task_id]["error_data"] = {"error_message": str(e), "error_type": type(e).__name__}


# Global task manager instance
task_manager = TaskManager()
