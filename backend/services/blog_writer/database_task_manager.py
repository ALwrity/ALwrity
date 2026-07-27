"""
Database-Backed Task Manager for Blog Writer

Replaces in-memory task storage with persistent database storage for
reliability, recovery, and analytics.
"""

import asyncio
import uuid
import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from loguru import logger

from services.blog_writer.logger_config import blog_writer_logger, log_function_call
from models.blog_models import (
    BlogResearchRequest,
    BlogOutlineRequest,
    MediumBlogGenerateRequest,
    MediumBlogGenerateResult,
)
from services.blog_writer.blog_service import BlogWriterService
from services.database import SessionLocal

class DatabaseTaskManager:
    """Database-backed task manager for blog writer operations."""
    
    def __init__(self, db_connection):
        self.db = db_connection
        self.service = BlogWriterService()
        self._cleanup_task = None
        self._start_cleanup_task()
    
    def _start_cleanup_task(self):
        """Start background task to clean up old completed tasks."""
        async def cleanup_loop():
            while True:
                try:
                    await self.cleanup_old_tasks()
                    await asyncio.sleep(3600)  # Run every hour
                except Exception as e:
                    logger.error(f"Error in cleanup task: {e}")
                    await asyncio.sleep(300)  # Wait 5 minutes on error
        
        self._cleanup_task = asyncio.create_task(cleanup_loop())
    
    @log_function_call("create_task")
    async def create_task(
        self, 
        user_id: str,
        task_type: str,
        request_data: Dict[str, Any],
        correlation_id: Optional[str] = None,
        operation: Optional[str] = None,
        priority: int = 0,
        max_retries: int = 3,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """Create a new task in the database."""
        task_id = str(uuid.uuid4())
        correlation_id = correlation_id or str(uuid.uuid4())
        
        query = """
        INSERT INTO blog_writer_tasks 
        (id, user_id, task_type, status, request_data, correlation_id, operation, priority, max_retries, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        """
        
        await self.db.execute(
            query,
            task_id,
            user_id,
            task_type,
            'pending',
            json.dumps(request_data),
            correlation_id,
            operation,
            priority,
            max_retries,
            json.dumps(metadata or {})
        )
        
        blog_writer_logger.log_operation_start(
            "task_created",
            task_id=task_id,
            task_type=task_type,
            user_id=user_id,
            correlation_id=correlation_id
        )
        
        return task_id
    
    @log_function_call("get_task_status")
    async def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get the status of a task."""
        query = """
        SELECT 
            id, user_id, task_type, status, request_data, result_data, error_data,
            created_at, updated_at, completed_at, correlation_id, operation,
            retry_count, max_retries, priority, metadata
        FROM blog_writer_tasks 
        WHERE id = $1
        """
        
        row = await self.db.fetchrow(query, task_id)
        if not row:
            return None
        
        # Get progress messages
        progress_query = """
        SELECT timestamp, message, percentage, progress_type, metadata
        FROM blog_writer_task_progress 
        WHERE task_id = $1 
        ORDER BY timestamp DESC 
        LIMIT 10
        """
        
        progress_rows = await self.db.fetch(progress_query, task_id)
        progress_messages = [
            {
                "timestamp": row["timestamp"].isoformat(),
                "message": row["message"],
                "percentage": float(row["percentage"]),
                "progress_type": row["progress_type"],
                "metadata": row["metadata"] or {}
            }
            for row in progress_rows
        ]
        
        return {
            "task_id": row["id"],
            "user_id": row["user_id"],
            "task_type": row["task_type"],
            "status": row["status"],
            "created_at": row["created_at"].isoformat(),
            "updated_at": row["updated_at"].isoformat(),
            "completed_at": row["completed_at"].isoformat() if row["completed_at"] else None,
            "correlation_id": row["correlation_id"],
            "operation": row["operation"],
            "retry_count": row["retry_count"],
            "max_retries": row["max_retries"],
            "priority": row["priority"],
            "progress_messages": progress_messages,
            "result": json.loads(row["result_data"]) if row["result_data"] else None,
            "error": json.loads(row["error_data"]) if row["error_data"] else None,
            "metadata": json.loads(row["metadata"]) if row["metadata"] else {}
        }
    
    @log_function_call("update_task_status")
    async def update_task_status(
        self,
        task_id: str,
        status: str,
        result_data: Optional[Dict[str, Any]] = None,
        error_data: Optional[Dict[str, Any]] = None,
        completed_at: Optional[datetime] = None
    ):
        """Update task status and data."""
        query = """
        UPDATE blog_writer_tasks 
        SET status = $2, result_data = $3, error_data = $4, completed_at = $5, updated_at = NOW()
        WHERE id = $1
        """
        
        await self.db.execute(
            query,
            task_id,
            status,
            json.dumps(result_data) if result_data else None,
            json.dumps(error_data) if error_data else None,
            completed_at or (datetime.now() if status in ['completed', 'failed', 'cancelled'] else None)
        )
        
        blog_writer_logger.log_operation_end(
            "task_status_updated",
            0,
            success=status in ['completed', 'cancelled'],
            task_id=task_id,
            status=status
        )
    
    @log_function_call("update_progress")
    async def update_progress(
        self,
        task_id: str,
        message: str,
        percentage: Optional[float] = None,
        progress_type: str = "info",
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Update task progress."""
        # Insert progress record
        progress_query = """
        INSERT INTO blog_writer_task_progress 
        (task_id, message, percentage, progress_type, metadata)
        VALUES ($1, $2, $3, $4, $5)
        """
        
        await self.db.execute(
            progress_query,
            task_id,
            message,
            percentage or 0.0,
            progress_type,
            json.dumps(metadata or {})
        )
        
        # Update task status to running if it was pending
        status_query = """
        UPDATE blog_writer_tasks 
        SET status = 'running', updated_at = NOW()
        WHERE id = $1 AND status = 'pending'
        """
        
        await self.db.execute(status_query, task_id)
        
        logger.info(f"Progress update for task {task_id}: {message}")
    
    @log_function_call("record_metrics")
    async def record_metrics(
        self,
        task_id: str,
        operation: str,
        duration_ms: int,
        token_usage: Optional[Dict[str, int]] = None,
        api_calls: int = 0,
        cache_hits: int = 0,
        cache_misses: int = 0,
        error_count: int = 0,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Record performance metrics for a task."""
        query = """
        INSERT INTO blog_writer_task_metrics 
        (task_id, operation, duration_ms, token_usage, api_calls, cache_hits, cache_misses, error_count, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """
        
        await self.db.execute(
            query,
            task_id,
            operation,
            duration_ms,
            json.dumps(token_usage) if token_usage else None,
            api_calls,
            cache_hits,
            cache_misses,
            error_count,
            json.dumps(metadata or {})
        )
        
        blog_writer_logger.log_performance(
            f"task_metrics_{operation}",
            duration_ms,
            "ms",
            task_id=task_id,
            operation=operation,
            api_calls=api_calls,
            cache_hits=cache_hits,
            cache_misses=cache_misses
        )
    
    @log_function_call("increment_retry_count")
    async def increment_retry_count(self, task_id: str) -> int:
        """Increment retry count and return new count."""
        query = """
        UPDATE blog_writer_tasks 
        SET retry_count = retry_count + 1, updated_at = NOW()
        WHERE id = $1
        RETURNING retry_count
        """
        
        result = await self.db.fetchval(query, task_id)
        return result or 0
    
    @log_function_call("cleanup_old_tasks")
    async def cleanup_old_tasks(self, days: int = 7) -> int:
        """Clean up old completed tasks."""
        query = """
        DELETE FROM blog_writer_tasks 
        WHERE status IN ('completed', 'failed', 'cancelled') 
        AND created_at < NOW() - INTERVAL '1 day' * $1
        """
        
        result = await self.db.execute(query, days)
        deleted_count = int(result.split()[-1]) if result else 0
        
        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} old blog writer tasks")
        
        return deleted_count
    
    @log_function_call("get_user_tasks")
    async def get_user_tasks(
        self,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
        status_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get tasks for a specific user."""
        query = """
        SELECT 
            id, task_type, status, created_at, updated_at, completed_at,
            operation, retry_count, max_retries, priority
        FROM blog_writer_tasks 
        WHERE user_id = $1
        """
        
        params = [user_id]
        param_count = 1
        
        if status_filter:
            param_count += 1
            query += f" AND status = ${param_count}"
            params.append(status_filter)
        
        query += f" ORDER BY created_at DESC LIMIT ${param_count + 1} OFFSET ${param_count + 2}"
        params.extend([limit, offset])
        
        rows = await self.db.fetch(query, *params)
        
        return [
            {
                "task_id": row["id"],
                "task_type": row["task_type"],
                "status": row["status"],
                "created_at": row["created_at"].isoformat(),
                "updated_at": row["updated_at"].isoformat(),
                "completed_at": row["completed_at"].isoformat() if row["completed_at"] else None,
                "operation": row["operation"],
                "retry_count": row["retry_count"],
                "max_retries": row["max_retries"],
                "priority": row["priority"]
            }
            for row in rows
        ]
    
    @log_function_call("get_task_analytics")
    async def get_task_analytics(self, days: int = 7) -> Dict[str, Any]:
        """Get task analytics for monitoring."""
        query = """
        SELECT 
            task_type,
            status,
            COUNT(*) as task_count,
            AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - created_at))) as avg_duration_seconds,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
            COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
            COUNT(CASE WHEN status = 'running' THEN 1 END) as running_count
        FROM blog_writer_tasks
        WHERE created_at >= NOW() - INTERVAL '1 day' * $1
        GROUP BY task_type, status
        ORDER BY task_type, status
        """
        
        rows = await self.db.fetch(query, days)
        
        analytics = {
            "summary": {
                "total_tasks": sum(row["task_count"] for row in rows),
                "completed_tasks": sum(row["completed_count"] for row in rows),
                "failed_tasks": sum(row["failed_count"] for row in rows),
                "running_tasks": sum(row["running_count"] for row in rows)
            },
            "by_task_type": {},
            "by_status": {}
        }
        
        for row in rows:
            task_type = row["task_type"]
            status = row["status"]
            
            if task_type not in analytics["by_task_type"]:
                analytics["by_task_type"][task_type] = {}
            
            analytics["by_task_type"][task_type][status] = {
                "count": row["task_count"],
                "avg_duration_seconds": float(row["avg_duration_seconds"]) if row["avg_duration_seconds"] else 0
            }
            
            if status not in analytics["by_status"]:
                analytics["by_status"][status] = 0
            analytics["by_status"][status] += row["task_count"]
        
        return analytics
    
    # Task execution methods (same as original but with database persistence)
    async def start_research_task(self, request: BlogResearchRequest, user_id: str) -> str:
        """Start a research operation and return a task ID."""
        task_id = await self.create_task(
            user_id=user_id,
            task_type="research",
            request_data=request.dict(),
            operation="research_operation"
        )
        
        # Start the research operation in the background
        asyncio.create_task(self._run_research_task(task_id, request))
        
        return task_id
    
    async def start_outline_task(self, request: BlogOutlineRequest, user_id: str) -> str:
        """Start an outline generation operation and return a task ID."""
        task_id = await self.create_task(
            user_id=user_id,
            task_type="outline",
            request_data=request.dict(),
            operation="outline_generation"
        )
        
        # Start the outline generation operation in the background
        asyncio.create_task(self._run_outline_generation_task(task_id, request))
        
        return task_id
    
    async def start_medium_generation_task(self, request: MediumBlogGenerateRequest, user_id: str) -> str:
        """Start a medium blog generation task."""
        task_id = await self.create_task(
            user_id=user_id,
            task_type="medium_generation",
            request_data=request.dict(),
            operation="medium_blog_generation"
        )
        
        asyncio.create_task(self._run_medium_generation_task(task_id, request, user_id))
        return task_id
    
    async def _run_research_task(self, task_id: str, request: BlogResearchRequest):
        """Background task to run research and update status with progress messages."""
        try:
            await self.update_progress(task_id, "🔍 Starting research operation...", 0)
            
            # Run the actual research with progress updates
            result = await self.service.research_with_progress(request, task_id)
            
            # Check if research failed gracefully
            if not result.success:
                await self.update_progress(
                    task_id, 
                    f"❌ Research failed: {result.error_message or 'Unknown error'}", 
                    100, 
                    "error"
                )
                await self.update_task_status(
                    task_id, 
                    "failed", 
                    error_data={
                        "error_message": result.error_message,
                        "retry_suggested": result.retry_suggested,
                        "error_code": result.error_code,
                        "actionable_steps": result.actionable_steps
                    }
                )
            else:
                await self.update_progress(
                    task_id, 
                    f"✅ Research completed successfully! Found {len(result.sources)} sources and {len(result.search_queries or [])} search queries.", 
                    100, 
                    "success"
                )
                await self.update_task_status(
                    task_id, 
                    "completed", 
                    result_data=result.dict()
                )
            
        except Exception as e:
            await self.update_progress(task_id, f"❌ Research failed with error: {str(e)}", 100, "error")
            await self.update_task_status(
                task_id, 
                "failed", 
                error_data={"error_message": str(e), "error_type": type(e).__name__}
            )
            blog_writer_logger.log_error(e, "research_task", context={"task_id": task_id})
    
    async def _run_outline_generation_task(self, task_id: str, request: BlogOutlineRequest):
        """Background task to run outline generation and update status with progress messages."""
        try:
            await self.update_progress(task_id, "🧩 Starting outline generation...", 0)
            
            # Run the actual outline generation with progress updates
            result = await self.service.generate_outline_with_progress(request, task_id)
            
            await self.update_progress(
                task_id, 
                f"✅ Outline generated successfully! Created {len(result.outline)} sections with {len(result.title_options)} title options.", 
                100, 
                "success"
            )
            await self.update_task_status(task_id, "completed", result_data=result.dict())
            
        except Exception as e:
            await self.update_progress(task_id, f"❌ Outline generation failed: {str(e)}", 100, "error")
            await self.update_task_status(
                task_id, 
                "failed", 
                error_data={"error_message": str(e), "error_type": type(e).__name__}
            )
            blog_writer_logger.log_error(e, "outline_generation_task", context={"task_id": task_id})
    
    async def _run_medium_generation_task(self, task_id: str, request: MediumBlogGenerateRequest, user_id: str):
        """Background task to generate a medium blog using a single structured JSON call."""
        try:
            await self.update_progress(task_id, "📦 Packaging outline and metadata...", 0)
            
            # Basic guard: respect global target words
            total_target = int(request.globalTargetWords or 1000)
            if total_target > 1000:
                raise ValueError("Global target words exceed 1000; medium generation not allowed")
            
            result: MediumBlogGenerateResult = await self.service.generate_medium_blog_with_progress(
                request,
                task_id,
                user_id,
                db=self.db
            )
            
            if not result or not getattr(result, "sections", None):
                raise ValueError("Empty generation result from model")
            
            # Check if result came from cache
            cache_hit = getattr(result, 'cache_hit', False)
            if cache_hit:
                await self.update_progress(task_id, "⚡ Found cached content - loading instantly!", 100, "success")
            else:
                await self.update_progress(task_id, "🤖 Generated fresh content with AI...", 100, "success")
            
            await self.update_task_status(task_id, "completed", result_data=result.dict())
            
        except Exception as e:
            await self.update_progress(task_id, f"❌ Medium generation failed: {str(e)}", 100, "error")
            await self.update_task_status(
                task_id, 
                "failed", 
                error_data={"error_message": str(e), "error_type": type(e).__name__}
            )
            blog_writer_logger.log_error(e, "medium_generation_task", context={"task_id": task_id})
