"""
Website Analysis Task Executor
Handles execution of website analysis tasks for user and competitor websites.
"""

import logging
import os
import time
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from functools import partial
from urllib.parse import urlparse

from ..core.executor_interface import TaskExecutor, TaskExecutionResult
from ..core.exception_handler import TaskExecutionError, DatabaseError, SchedulerExceptionHandler
from models.website_analysis_monitoring_models import WebsiteAnalysisTask, WebsiteAnalysisExecutionLog
from models.onboarding import CompetitorAnalysis, OnboardingSession
from utils.logger_utils import get_service_logger

# Import website analysis services
from services.component_logic.web_crawler_logic import WebCrawlerLogic
from services.component_logic.style_detection_logic import StyleDetectionLogic
from services.website_analysis_service import WebsiteAnalysisService

logger = get_service_logger("website_analysis_executor")


class WebsiteAnalysisExecutor(TaskExecutor):
    """
    Executor for website analysis tasks.
    
    Handles:
    - Analyzing user's website (updates existing WebsiteAnalysis record)
    - Analyzing competitor websites (stores in CompetitorAnalysis table)
    - Logging results and updating task status
    - Scheduling next execution based on frequency_days
    """
    
    def __init__(self):
        self.logger = logger
        self.exception_handler = SchedulerExceptionHandler()
        self.crawler_logic = WebCrawlerLogic()
        self.style_logic = StyleDetectionLogic()
    
    async def execute_task(
        self, 
        task: WebsiteAnalysisTask, 
        db: Session
    ) -> TaskExecutionResult:
        """
        Execute a website analysis task.
        
        This performs complete website analysis using the same logic as
        /api/onboarding/style-detection/complete endpoint.
        
        Args:
            task: WebsiteAnalysisTask instance
            db: Database session
            
        Returns:
            TaskExecutionResult
        """
        start_time = time.time()
        user_id = task.user_id
        website_url = task.website_url
        task_type = task.task_type
        
        try:
            self.logger.info(
                f"Executing website analysis: task_id={task.id} | "
                f"user_id={user_id} | url={website_url} | type={task_type}"
            )
            
            # Create execution log
            execution_log = WebsiteAnalysisExecutionLog(
                task_id=task.id,
                execution_date=datetime.utcnow(),
                status='running'
            )
            db.add(execution_log)
            db.flush()
            
            # Perform website analysis
            result = await self._perform_website_analysis(
                website_url=website_url,
                user_id=user_id,
                task_type=task_type,
                task=task,
                db=db
            )
            
            # Update execution log
            execution_time_ms = int((time.time() - start_time) * 1000)
            execution_log.status = 'success' if result.success else 'failed'
            execution_log.result_data = result.result_data
            execution_log.error_message = result.error_message
            execution_log.execution_time_ms = execution_time_ms
            
            # Update task based on result
            task.last_check = datetime.utcnow()
            task.updated_at = datetime.utcnow()
            
            if result.success:
                task.last_success = datetime.utcnow()
                task.status = 'active'
                task.failure_reason = None
                # Reset failure tracking on success
                task.consecutive_failures = 0
                task.failure_pattern = None
                # Schedule next check based on frequency_days
                task.next_check = self.calculate_next_execution(
                    task=task,
                    frequency='Custom',
                    last_execution=task.last_check,
                    custom_days=task.frequency_days
                )
                
                # Commit all changes to database
                db.commit()
                
                self.logger.info(
                    f"Website analysis completed successfully for task {task.id}. "
                    f"Next check scheduled for {task.next_check}"
                )
                return result
            else:
                # Analyze failure pattern
                from services.scheduler.core.failure_detection_service import FailureDetectionService
                failure_detection = FailureDetectionService(db)
                pattern = failure_detection.analyze_task_failures(
                    task.id, "website_analysis", task.user_id
                )
                
                task.last_failure = datetime.utcnow()
                task.failure_reason = result.error_message
                
                if pattern and pattern.should_cool_off:
                    # Mark task for human intervention
                    task.status = "needs_intervention"
                    task.consecutive_failures = pattern.consecutive_failures
                    task.failure_pattern = {
                        "consecutive_failures": pattern.consecutive_failures,
                        "recent_failures": pattern.recent_failures,
                        "failure_reason": pattern.failure_reason.value,
                        "error_patterns": pattern.error_patterns,
                        "cool_off_until": (datetime.utcnow() + timedelta(days=7)).isoformat()
                    }
                    # Clear next_check - task won't run automatically
                    task.next_check = None
                    
                    self.logger.warning(
                        f"Task {task.id} marked for human intervention: "
                        f"{pattern.consecutive_failures} consecutive failures, "
                        f"reason: {pattern.failure_reason.value}"
                    )
                else:
                    # Normal failure handling
                    task.status = 'failed'
                    task.consecutive_failures = (task.consecutive_failures or 0) + 1
                    # Do NOT update next_check - wait for manual retry
                
                # Commit all changes to database
                db.commit()
                
                self.logger.warning(
                    f"Website analysis failed for task {task.id}. "
                    f"Error: {result.error_message}. "
                    f"{'Marked for human intervention' if pattern and pattern.should_cool_off else 'Waiting for manual retry'}."
                )
                return result
                
        except Exception as e:
            execution_time_ms = int((time.time() - start_time) * 1000)
            
            error = TaskExecutionError(
                message=f"Error executing website analysis task {task.id}: {str(e)}",
                user_id=user_id,
                task_id=task.id,
                task_type="website_analysis",
                execution_time_ms=execution_time_ms,
                context={
                    "website_url": website_url,
                    "task_type": task_type,
                    "user_id": user_id
                },
                original_error=e
            )
            
            # Handle exception with structured logging
            self.exception_handler.handle_exception(error, db=db)
            
            # Update execution log with error
            try:
                execution_log = WebsiteAnalysisExecutionLog(
                    task_id=task.id,
                    execution_date=datetime.utcnow(),
                    status='failed',
                    error_message=str(e),
                    execution_time_ms=execution_time_ms,
                    result_data={
                        "error_type": error.error_type.value,
                        "severity": error.severity.value,
                        "context": error.context
                    }
                )
                db.add(execution_log)
                
                task.last_failure = datetime.utcnow()
                task.failure_reason = str(e)
                task.status = 'failed'
                task.last_check = datetime.utcnow()
                task.updated_at = datetime.utcnow()
                # Do NOT update next_check - wait for manual retry
                
                db.commit()
            except Exception as commit_error:
                db_error = DatabaseError(
                    message=f"Error saving execution log: {str(commit_error)}",
                    user_id=user_id,
                    task_id=task.id,
                    original_error=commit_error
                )
                self.exception_handler.handle_exception(db_error, db=db)
                db.rollback()
            
            return TaskExecutionResult(
                success=False,
                error_message=str(e),
                execution_time_ms=execution_time_ms,
                retryable=True
            )
    
    async def _perform_website_analysis(
        self,
        website_url: str,
        user_id: str,
        task_type: str,
        task: WebsiteAnalysisTask,
        db: Session
    ) -> TaskExecutionResult:
        """
        Perform website analysis using existing service logic.
        
        Reuses the same logic as /api/onboarding/style-detection/complete.
        """
        try:
            # Step 1: Crawl website content
            self.logger.info(f"Crawling website: {website_url}")
            crawl_result = await self.crawler_logic.crawl_website(website_url)
            
            if not crawl_result.get('success'):
                error_msg = crawl_result.get('error', 'Crawling failed')
                self.logger.error(f"Crawling failed for {website_url}: {error_msg}")
                return TaskExecutionResult(
                    success=False,
                    error_message=f"Crawling failed: {error_msg}",
                    result_data={'crawl_result': crawl_result},
                    retryable=True
                )
            
            # Step 2: Run style analysis and patterns analysis in parallel
            self.logger.info(f"Running style analysis for {website_url}")
            
            async def run_style_analysis():
                """Run style analysis in executor"""
                loop = asyncio.get_event_loop()
                return await loop.run_in_executor(
                    None, 
                    partial(self.style_logic.analyze_content_style, crawl_result['content'], user_id=self.user_id)
                )
            
            async def run_patterns_analysis():
                """Run patterns analysis in executor"""
                loop = asyncio.get_event_loop()
                return await loop.run_in_executor(
                    None, 
                    partial(self.style_logic.analyze_style_patterns, crawl_result['content'], user_id=self.user_id)
                )

            async def run_seo_audit():
                loop = asyncio.get_event_loop()
                return await loop.run_in_executor(
                    None,
                    partial(self.style_logic.perform_seo_audit, website_url, crawl_result['content'])
                )
            
            style_analysis, patterns_result, seo_audit_result = await asyncio.gather(
                run_style_analysis(),
                run_patterns_analysis(),
                run_seo_audit(),
                return_exceptions=True
            )
            
            # Check for exceptions
            if isinstance(style_analysis, Exception):
                self.logger.error(f"Style analysis exception: {style_analysis}")
                return TaskExecutionResult(
                    success=False,
                    error_message=f"Style analysis failed: {str(style_analysis)}",
                    retryable=True
                )
            
            if isinstance(patterns_result, Exception):
                self.logger.warning(f"Patterns analysis exception: {patterns_result}")
                patterns_result = None

            seo_audit = None
            if isinstance(seo_audit_result, Exception):
                self.logger.warning(f"SEO audit exception: {seo_audit_result}")
            else:
                seo_audit = seo_audit_result
            
            # Step 3: Generate style guidelines
            style_guidelines = None
            if style_analysis and style_analysis.get('success'):
                loop = asyncio.get_event_loop()
                guidelines_result = await loop.run_in_executor(
                    None, 
                    partial(self.style_logic.generate_style_guidelines, style_analysis.get('analysis', {}), user_id=self.user_id)
                )
                if guidelines_result and guidelines_result.get('success'):
                    style_guidelines = guidelines_result.get('guidelines')
            
            # Prepare analysis data
            analysis_data = {
                'crawl_result': crawl_result,
                'style_analysis': style_analysis.get('analysis') if style_analysis and style_analysis.get('success') else None,
                'style_patterns': patterns_result if patterns_result and not isinstance(patterns_result, Exception) else None,
                'style_guidelines': style_guidelines,
                'seo_audit': seo_audit,
            }
            
            # Step 4: Store results based on task type
            if task_type == 'user_website':
                # Update existing WebsiteAnalysis record
                await self._update_user_website_analysis(
                    user_id=user_id,
                    website_url=website_url,
                    analysis_data=analysis_data,
                    db=db
                )
            elif task_type == 'competitor':
                # Store in CompetitorAnalysis table
                await self._store_competitor_analysis(
                    user_id=user_id,
                    competitor_url=website_url,
                    competitor_id=task.competitor_id,
                    analysis_data=analysis_data,
                    db=db
                )
            
            self.logger.info(f"Website analysis completed successfully for {website_url}")
            
            return TaskExecutionResult(
                success=True,
                result_data=analysis_data,
                retryable=False
            )
            
        except Exception as e:
            self.logger.error(f"Error performing website analysis: {e}", exc_info=True)
            return TaskExecutionResult(
                success=False,
                error_message=str(e),
                retryable=True
            )
    
    async def _update_user_website_analysis(
        self,
        user_id: str,
        website_url: str,
        analysis_data: Dict[str, Any],
        db: Session
    ):
        """Update existing WebsiteAnalysis record for user's website."""
        try:
            session = db.query(OnboardingSession).filter(
                OnboardingSession.user_id == user_id
            ).order_by(OnboardingSession.updated_at.desc()).first()
            
            if not session:
                raise ValueError(f"No onboarding session found for user {user_id}")
            
            # Use WebsiteAnalysisService to update
            analysis_service = WebsiteAnalysisService(db)
            
            # Prepare data in format expected by save_analysis
            response_data = {
                'crawl_result': analysis_data.get('crawl_result'),
                'style_analysis': analysis_data.get('style_analysis'),
                'style_patterns': analysis_data.get('style_patterns'),
                'style_guidelines': analysis_data.get('style_guidelines'),
                'seo_audit': analysis_data.get('seo_audit'),
            }
            
            # Save/update analysis
            analysis_id = analysis_service.save_analysis(
                session_id=session.id,
                website_url=website_url,
                analysis_data=response_data,
                preserve_persona=True
            )
            
            if analysis_id:
                self.logger.info(f"Updated user website analysis for {website_url} (analysis_id: {analysis_id})")
            else:
                self.logger.warning(f"Failed to update user website analysis for {website_url}")
                
        except Exception as e:
            self.logger.error(f"Error updating user website analysis: {e}", exc_info=True)
            raise
    
    async def _store_competitor_analysis(
        self,
        user_id: str,
        competitor_url: str,
        competitor_id: Optional[str],
        analysis_data: Dict[str, Any],
        db: Session
    ):
        """Store competitor analysis in CompetitorAnalysis table."""
        try:
            # Get onboarding session for user
            session = db.query(OnboardingSession).filter(
                OnboardingSession.user_id == user_id
            ).first()
            
            if not session:
                raise ValueError(f"No onboarding session found for user {user_id}")
            
            # Extract domain from URL
            parsed_url = urlparse(competitor_url)
            competitor_domain = parsed_url.netloc or competitor_id
            
            # Check if analysis already exists for this competitor
            existing = db.query(CompetitorAnalysis).filter(
                CompetitorAnalysis.session_id == session.id,
                CompetitorAnalysis.competitor_url == competitor_url
            ).first()
            
            if existing:
                # Update existing analysis
                existing.analysis_data = analysis_data
                existing.analysis_date = datetime.utcnow()
                existing.status = 'completed'
                existing.error_message = None
                existing.warning_message = None
                existing.updated_at = datetime.utcnow()
                self.logger.info(f"Updated competitor analysis for {competitor_url}")
            else:
                # Create new analysis
                competitor_analysis = CompetitorAnalysis(
                    session_id=session.id,
                    competitor_url=competitor_url,
                    competitor_domain=competitor_domain,
                    analysis_data=analysis_data,
                    status='completed',
                    analysis_date=datetime.utcnow()
                )
                db.add(competitor_analysis)
                self.logger.info(f"Created new competitor analysis for {competitor_url}")
            
            db.commit()
            
        except Exception as e:
            db.rollback()
            self.logger.error(f"Error storing competitor analysis: {e}", exc_info=True)
            raise
    
    def calculate_next_execution(
        self,
        task: WebsiteAnalysisTask,
        frequency: str,
        last_execution: Optional[datetime] = None,
        custom_days: Optional[int] = None
    ) -> datetime:
        """
        Calculate next execution time based on frequency or custom days.
        
        Args:
            task: WebsiteAnalysisTask instance
            frequency: Frequency string ('Custom' for website analysis)
            last_execution: Last execution datetime (defaults to task.last_check or now)
            custom_days: Custom number of days (from task.frequency_days)
            
        Returns:
            Next execution datetime
        """
        if last_execution is None:
            last_execution = task.last_check if task.last_check else datetime.utcnow()
        
        # Use custom_days if provided, otherwise use task.frequency_days
        days = custom_days if custom_days is not None else task.frequency_days
        
        if frequency == 'Custom' and days:
            return last_execution + timedelta(days=days)
        else:
            # Default to task's frequency_days
            self.logger.warning(
                f"Unknown frequency '{frequency}' for website analysis task {task.id}. "
                f"Using frequency_days={task.frequency_days}."
            )
            return last_execution + timedelta(days=task.frequency_days)

    async def _perform_full_site_analysis(self, user_id: str, website_url: str, db: Session):
        """
        Discover sitemap and perform non-AI SEO audit on all found pages.
        """
        try:
            self.logger.info(f"Starting full site scan for {website_url}")
            sitemap_service = SitemapService()
            
            # 1. Discover Sitemap
            sitemap_url = await sitemap_service.discover_sitemap_url(website_url)
            if not sitemap_url:
                self.logger.warning(f"No sitemap found for {website_url}, skipping full site scan")
                return

            # 2. Get URLs (Raw mode)
            sitemap_data = await sitemap_service.analyze_sitemap(
                sitemap_url=sitemap_url,
                analyze_content_trends=False,
                analyze_publishing_patterns=False,
                include_ai_insights=False
            )
            
            urls = [u.get('loc') for u in sitemap_data.get('urls', []) if u.get('loc')]
            self.logger.info(f"Found {len(urls)} URLs in sitemap for {website_url}")
            
            # 3. Batch Process (Limit to 50 for safety during testing)
            urls_to_scan = urls[:50]
            
            for page_url in urls_to_scan:
                try:
                    # Check if exists
                    existing = db.query(SEOPageAudit).filter(
                        SEOPageAudit.user_id == user_id,
                        SEOPageAudit.page_url == page_url
                    ).first()
                    
                    # Run in executor to avoid blocking
                    loop = asyncio.get_event_loop()
                    # Pass empty content dict to trigger internal fetching in perform_seo_audit
                    audit_result = await loop.run_in_executor(
                        None,
                        partial(self.style_logic.perform_seo_audit, page_url, {})
                    )
                    
                    if existing:
                        existing.overall_score = audit_result.get('overall_score')
                        existing.category_scores = {k: v.get('score') for k, v in audit_result.items() if isinstance(v, dict) and 'score' in v}
                        existing.issues = audit_result.get('summary', {}).get('critical_issues', [])
                        existing.warnings = audit_result.get('summary', {}).get('warnings', [])
                        existing.audit_data = audit_result
                        existing.last_analyzed_at = datetime.utcnow()
                        existing.status = 'completed'
                    else:
                        new_audit = SEOPageAudit(
                            user_id=user_id,
                            website_url=website_url,
                            page_url=page_url,
                            overall_score=audit_result.get('overall_score'),
                            category_scores={k: v.get('score') for k, v in audit_result.items() if isinstance(v, dict) and 'score' in v},
                            issues=audit_result.get('summary', {}).get('critical_issues', []),
                            warnings=audit_result.get('summary', {}).get('warnings', []),
                            audit_data=audit_result,
                            analysis_source='scheduled_full_site',
                            status='completed'
                        )
                        db.add(new_audit)
                    
                    db.commit() # Commit each page to show progress
                    
                except Exception as e:
                    self.logger.error(f"Error auditing page {page_url}: {e}")
                    db.rollback()
            
            self.logger.info(f"Completed full site scan for {website_url}")
            
        except Exception as e:
            self.logger.error(f"Error in full site analysis: {e}")


