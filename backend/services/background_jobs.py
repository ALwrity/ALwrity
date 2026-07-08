"""
Background Job Service

Handles background processing of expensive operations like comprehensive Bing insights generation.
"""

import asyncio
import threading
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Callable
from loguru import logger
from enum import Enum
import json


class JobStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class BackgroundJob:
    """Represents a background job"""
    
    def __init__(self, job_id: str, job_type: str, user_id: str, data: Dict[str, Any]):
        self.job_id = job_id
        self.job_type = job_type
        self.user_id = user_id
        self.data = data
        self.status = JobStatus.PENDING
        self.created_at = datetime.now()
        self.started_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None
        self.result: Optional[Dict[str, Any]] = None
        self.error: Optional[str] = None
        self.progress = 0
        self.message = "Job queued"


class BackgroundJobService:
    """Service for managing background jobs"""
    
    def __init__(self):
        self.jobs: Dict[str, BackgroundJob] = {}
        self.workers: Dict[str, threading.Thread] = {}
        self.job_handlers: Dict[str, Callable] = {}
        self.max_concurrent_jobs = 3
        self._lock = threading.RLock()
        
        # Register job handlers
        self._register_job_handlers()
    
    def _register_job_handlers(self):
        """Register handlers for different job types"""
        self.job_handlers = {
            'bing_comprehensive_insights': self._handle_bing_comprehensive_insights,
            'bing_data_collection': self._handle_bing_data_collection,
            'analytics_refresh': self._handle_analytics_refresh,
        }
    
    def create_job(self, job_type: str, user_id: str, data: Dict[str, Any]) -> str:
        """Create a new background job"""
        job_id = f"{job_type}_{user_id}_{int(time.time())}"
        
        job = BackgroundJob(job_id, job_type, user_id, data)
        with self._lock:
            self.jobs[job_id] = job
            
            logger.info(f"Created background job: {job_id} for user {user_id}")
            
            # Start the job if we have capacity
            if len(self.workers) < self.max_concurrent_jobs:
                self._start_job(job_id)
            else:
                logger.info(f"Job {job_id} queued - max concurrent jobs reached")
            
        return job_id
    
    def _start_job(self, job_id: str):
        """Start a background job"""
        with self._lock:
            if job_id not in self.jobs:
                logger.error(f"Job {job_id} not found")
                return
            
            job = self.jobs[job_id]
            if job.status != JobStatus.PENDING:
                logger.warning(f"Job {job_id} is not pending, current status: {job.status}")
                return
            
            # Create worker thread
            worker = threading.Thread(
                target=self._run_job,
                args=(job_id,),
                daemon=True,
                name=f"BackgroundJob-{job_id}"
            )
            
            self.workers[job_id] = worker
            job.status = JobStatus.RUNNING
            job.started_at = datetime.now()
            job.message = "Job started"
            
            worker.start()
        logger.info(f"Started background job: {job_id}")
    
    def _run_job(self, job_id: str):
        """Run a background job in a separate thread"""
        try:
            job = self.jobs[job_id]
            handler = self.job_handlers.get(job.job_type)
            
            if not handler:
                raise ValueError(f"No handler registered for job type: {job.job_type}")
            
            logger.info(f"Running job {job_id}: {job.job_type}")
            
            # Run the job handler
            result = handler(job)
            
            # Mark job as completed
            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.now()
            job.result = result
            job.progress = 100
            job.message = "Job completed successfully"
            
            logger.info(f"Completed job {job_id} in {(job.completed_at - job.started_at).total_seconds():.2f}s")
            
        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}")
            job = self.jobs.get(job_id)
            if job:
                job.status = JobStatus.FAILED
                job.completed_at = datetime.now()
                job.error = str(e)
                job.message = f"Job failed: {str(e)}"
        finally:
            with self._lock:
                # Clean up worker thread
                if job_id in self.workers:
                    del self.workers[job_id]
                
                # Start next pending job
                self._start_next_pending_job()
    
    def _start_next_pending_job(self):
        """Start the next pending job if we have capacity"""
        with self._lock:
            if len(self.workers) >= self.max_concurrent_jobs:
                return
            
            # Find next pending job
            for job_id, job in self.jobs.items():
                if job.status == JobStatus.PENDING:
                    self._start_job(job_id)
                    break
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get the status of a job"""
        with self._lock:
            job = self.jobs.get(job_id)
            if not job:
                return None
            
            return {
                'job_id': job.job_id,
                'job_type': job.job_type,
                'user_id': job.user_id,
                'status': job.status.value,
                'progress': job.progress,
                'message': job.message,
                'created_at': job.created_at.isoformat(),
                'started_at': job.started_at.isoformat() if job.started_at else None,
                'completed_at': job.completed_at.isoformat() if job.completed_at else None,
                'result': job.result,
                'error': job.error
            }
    
    def get_user_jobs(self, user_id: str, limit: int = 10) -> list:
        """Get recent jobs for a user"""
        user_jobs = []
        with self._lock:
            for job in self.jobs.values():
                if job.user_id == user_id:
                    user_jobs.append(self.get_job_status(job.job_id))
        
        # Sort by created_at descending and limit
        user_jobs.sort(key=lambda x: x['created_at'], reverse=True)
        return user_jobs[:limit]
    
    def cancel_job(self, job_id: str) -> bool:
        """Cancel a pending job"""
        with self._lock:
            job = self.jobs.get(job_id)
            if not job:
                return False
            
            if job.status == JobStatus.PENDING:
                job.status = JobStatus.CANCELLED
                job.message = "Job cancelled"
                logger.info(f"Cancelled job {job_id}")
                return True
            
            return False
    
    def cleanup_old_jobs(self, max_age_hours: int = 24):
        """Clean up old completed/failed jobs"""
        cutoff_time = datetime.now() - timedelta(hours=max_age_hours)
        
        jobs_to_remove = []
        with self._lock:
            for job_id, job in self.jobs.items():
                if (job.status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED] and
                    job.created_at < cutoff_time):
                    jobs_to_remove.append(job_id)
            
            for job_id in jobs_to_remove:
                del self.jobs[job_id]
        
        if jobs_to_remove:
            logger.info(f"Cleaned up {len(jobs_to_remove)} old jobs")
    
    # Job Handlers
    
    def _handle_bing_comprehensive_insights(self, job: BackgroundJob) -> Dict[str, Any]:
        """Handle Bing comprehensive insights generation"""
        try:
            user_id = job.user_id
            site_url = job.data.get('site_url')
            if not site_url:
                raise ValueError("No site URL provided for Bing insights")
            days = job.data.get('days', 30)
            
            logger.info(f"Generating comprehensive Bing insights for user {user_id}")
            
            # Import here to avoid circular imports
            from services.analytics.insights.bing_insights_service import BingInsightsService
            import os
            
            database_url = os.getenv('DATABASE_URL', 'sqlite:///./bing_analytics.db')
            insights_service = BingInsightsService(database_url)
            
            job.progress = 10
            job.message = "Getting performance insights..."
            
            # Get performance insights
            performance_insights = insights_service.get_performance_insights(user_id, site_url, days)
            
            job.progress = 30
            job.message = "Getting SEO insights..."
            
            # Get SEO insights
            seo_insights = insights_service.get_seo_insights(user_id, site_url, days)
            
            job.progress = 60
            job.message = "Getting competitive insights..."
            
            # Get competitive insights
            competitive_insights = insights_service.get_competitive_insights(user_id, site_url, days)
            
            job.progress = 80
            job.message = "Getting actionable recommendations..."
            
            # Get actionable recommendations
            recommendations = insights_service.get_actionable_recommendations(user_id, site_url, days)
            
            job.progress = 95
            job.message = "Finalizing results..."
            
            # Combine all insights
            comprehensive_insights = {
                'performance': performance_insights,
                'seo': seo_insights,
                'competitive': competitive_insights,
                'recommendations': recommendations,
                'generated_at': datetime.now().isoformat(),
                'site_url': site_url,
                'analysis_period': f"{days} days"
            }
            
            job.progress = 100
            job.message = "Comprehensive insights generated successfully"
            
            logger.info(f"Successfully generated comprehensive Bing insights for user {user_id}")
            
            return comprehensive_insights
            
        except Exception as e:
            logger.error(f"Error generating comprehensive Bing insights: {e}")
            raise
    
    def _handle_bing_data_collection(self, job: BackgroundJob) -> Dict[str, Any]:
        """Handle Bing data collection from API"""
        try:
            user_id = job.user_id
            site_url = job.data.get('site_url')
            if not site_url:
                raise ValueError("No site URL provided for Bing data collection")
            days_back = job.data.get('days_back', 30)
            
            logger.info(f"Collecting Bing data for user {user_id}")
            
            # Import here to avoid circular imports
            from services.bing_analytics_storage_service import BingAnalyticsStorageService
            from services.database import DB_DATA_DIR
            import os
            
            db_path = os.path.join(DB_DATA_DIR, 'bing_analytics.db')
            database_url = os.getenv('DATABASE_URL', f'sqlite:///{db_path}')
            storage_service = BingAnalyticsStorageService(database_url)
            
            job.progress = 20
            job.message = "Collecting fresh data from Bing API..."
            
            # Collect and store data
            success = storage_service.collect_and_store_data(user_id, site_url, days_back)
            
            job.progress = 80
            job.message = "Generating daily metrics..."
            
            # Generate daily metrics
            if success:
                job.progress = 100
                job.message = "Data collection completed successfully"
                
                return {
                    'success': True,
                    'message': f'Collected {days_back} days of Bing data',
                    'site_url': site_url,
                    'collected_at': datetime.now().isoformat()
                }
            else:
                raise Exception("Failed to collect data from Bing API")
            
        except Exception as e:
            logger.error(f"Error collecting Bing data: {e}")
            raise
    
    def _handle_analytics_refresh(self, job: BackgroundJob) -> Dict[str, Any]:
        """Handle analytics refresh for all platforms"""
        try:
            user_id = job.user_id
            platforms = job.data.get('platforms', ['bing', 'gsc'])
            
            logger.info(f"Refreshing analytics for user {user_id}, platforms: {platforms}")
            
            # Import here to avoid circular imports
            from services.analytics import PlatformAnalyticsService
            
            analytics_service = PlatformAnalyticsService()
            
            job.progress = 20
            job.message = "Invalidating cache..."
            
            # Invalidate cache
            analytics_service.invalidate_user_cache(user_id)
            
            job.progress = 60
            job.message = "Refreshing analytics data..."
            
            # Get fresh analytics data
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                analytics_data = loop.run_until_complete(
                    analytics_service.get_comprehensive_analytics(user_id, platforms)
                )
            finally:
                loop.close()
            
            job.progress = 90
            job.message = "Generating summary..."
            
            # Generate summary
            summary = analytics_service.get_analytics_summary(analytics_data)
            
            job.progress = 100
            job.message = "Analytics refresh completed"
            
            return {
                'success': True,
                'analytics_data': {k: v.__dict__ for k, v in analytics_data.items()},
                'summary': summary,
                'refreshed_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error refreshing analytics: {e}")
            raise


# Global instance
background_job_service = BackgroundJobService()
