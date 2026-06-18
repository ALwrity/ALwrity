import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse
from loguru import logger
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from services.seo.advertools_service import AdvertoolsService
from services.seo_tools.sitemap_service import SitemapService
from models.advertools_monitoring_models import AdvertoolsTask, AdvertoolsExecutionLog
from models.onboarding import WebsiteAnalysis, OnboardingSession
from services.scheduler.core.executor_interface import TaskExecutor, TaskExecutionResult

class AdvertoolsExecutor(TaskExecutor):
    """
    Executor for Advertools-based SEO intelligence tasks.
    Handles 'content_audit' and 'site_health' task types.
    """
    
    def __init__(self):
        self.advertools_service = AdvertoolsService()
        self.sitemap_service = SitemapService()
        self.logger = logger.bind(service="AdvertoolsExecutor")

    async def execute_task(self, task: Any, db: Session) -> TaskExecutionResult:
        """Execute an Advertools intelligence task."""
        start_time = datetime.utcnow()
        task_id = getattr(task, 'id', None)
        user_id = getattr(task, 'user_id', None)
        payload = getattr(task, 'payload', {}) or {}
        
        task_type = payload.get('type')
        website_url = payload.get('website_url')
        
        self.logger.info(f"Starting Advertools task {task_id} ({task_type}) for {website_url}")
        
        # Find the actual task record to update state
        task_record = None
        if isinstance(task_id, int):
            task_record = db.query(AdvertoolsTask).filter(AdvertoolsTask.id == task_id).first()

        try:
            if not website_url:
                raise ValueError("Missing website_url in payload")

            # 1. Discover exact sitemap URL first (essential for Advertools)
            discovered_sitemap = await self.sitemap_service.discover_sitemap_url(website_url)
            effective_url = discovered_sitemap if discovered_sitemap else website_url
            
            # Set status to running for UI feedback
            if task_record:
                task_record.status = 'running'
                db.commit()

            result = {}
            if task_type == 'content_audit':
                # Phase 1: Get sitemap analysis (freshness, URL structure, pillars)
                sitemap_result = await self.advertools_service.analyze_sitemap(effective_url)
                
                audit_urls = []
                url_structure = {}
                freshness = {}
                if sitemap_result.get('success'):
                    metrics = sitemap_result.get('metrics', {})
                    audit_urls = metrics.get('audit_sample_urls', [])
                    url_structure = metrics.get('url_structure', {})
                    freshness = {
                        "freshness_score": metrics.get('freshness_score'),
                        "publishing_velocity": metrics.get('publishing_velocity'),
                        "stale_content_percentage": metrics.get('stale_content_percentage'),
                        "publishing_recency": metrics.get('publishing_recency'),
                        "publishing_trend": metrics.get('publishing_trend'),
                    }
                
                if not audit_urls:
                    audit_urls = [website_url]
                
                # Phase 2: Theme analysis via content audit
                audit_result = await self.advertools_service.audit_content(audit_urls)
                
                # Phase 3: Site structure analysis (links, redirects, image SEO)
                site_domain = urlparse(website_url).netloc or website_url
                structure_result = await self.advertools_service.analyze_site_structure(
                    audit_urls, site_domain=site_domain
                )
                
                # Phase 4: Robots.txt compliance analysis
                robots_result = await self.advertools_service.analyze_robots_txt(website_url)
                
                # Phase 5: Crawl budget analysis
                budget_result = await self.advertools_service.analyze_crawl_budget(
                    effective_url, site_domain
                )
                
                # Merge results
                result = {
                    "success": audit_result.get('success', False) or structure_result.get('success', False),
                    "themes": audit_result.get('themes', []),
                    "page_count": audit_result.get('page_count', 0),
                    "avg_word_count": audit_result.get('avg_word_count', 0),
                    "link_health": structure_result.get('link_health', {}),
                    "redirect_audit": structure_result.get('redirect_audit', {}),
                    "image_seo": structure_result.get('image_seo', {}),
                    "page_status": structure_result.get('page_status', {}),
                    "url_structure": url_structure,
                    "freshness": freshness,
                    "robots_txt": robots_result,
                    "crawl_budget": budget_result,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                if result.get('success'):
                    await self._update_persona_augmentation(user_id, website_url, result, db)
                    
            elif task_type == 'site_health':
                # Site health: freshness, velocity, URL structure
                result = await self.advertools_service.analyze_sitemap(effective_url)
                
                if result.get('success'):
                    await self._update_site_health_metrics(user_id, website_url, result, db)
            
            else:
                raise ValueError(f"Unknown task type: {task_type}")

            success = result.get('success', False)
            execution_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            # Update task state
            if task_record:
                task_record.last_executed = datetime.utcnow()
                if success:
                    task_record.last_success = datetime.utcnow()
                    task_record.consecutive_failures = 0
                    task_record.status = 'active'
                    
                    # Smart Scheduling with Backoff reset
                    freq_days = task_record.frequency_days or 7
                    task_record.next_execution = datetime.utcnow() + timedelta(days=freq_days)
                else:
                    task_record.last_failure = datetime.utcnow()
                    task_record.failure_reason = result.get('error', 'Unknown error')
                    task_record.consecutive_failures = (task_record.consecutive_failures or 0) + 1
                    
                    # Exponential Backoff for repeated failures (up to 30 days)
                    backoff_days = min(30, (task_record.frequency_days or 7) * (2 ** (task_record.consecutive_failures - 1)))
                    task_record.next_execution = datetime.utcnow() + timedelta(days=backoff_days)
                    
                    if task_record.consecutive_failures >= 5:
                        task_record.status = 'failed' # Mark as failed after 5 attempts
            
            # Create execution log
            if isinstance(task_id, int):
                log_entry = AdvertoolsExecutionLog(
                    task_id=task_id,
                    status='success' if success else 'failed',
                    result_data=result,
                    error_message=result.get('error'),
                    execution_time_ms=execution_time_ms
                )
                db.add(log_entry)

            db.commit()
            
            if success:
                self.logger.info(f"Advertools task {task_id} completed successfully")
            else:
                self.logger.warning(f"Advertools task {task_id} failed: {result.get('error')}")
                
            return TaskExecutionResult(
                success=success,
                result_data=result,
                execution_time_ms=execution_time_ms,
                retryable=not success,
                retry_delay=300
            )

        except Exception as e:
            db.rollback()
            self.logger.error(f"Advertools task execution failed: {e}")
            
            # Try to update task record with failure even if main logic failed
            if task_record:
                try:
                    task_record.last_executed = datetime.utcnow()
                    task_record.last_failure = datetime.utcnow()
                    task_record.failure_reason = str(e)
                    task_record.consecutive_failures = (task_record.consecutive_failures or 0) + 1
                    db.commit()
                except:
                    db.rollback()
            
            execution_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            return TaskExecutionResult(
                success=False,
                error_message=str(e),
                execution_time_ms=execution_time_ms,
                retryable=True,
                retry_delay=300
            )

    def calculate_next_execution(self, task: Any, frequency: str, last_execution: Optional[datetime] = None) -> datetime:
        base = last_execution or datetime.utcnow()
        freq_days = getattr(task, 'frequency_days', 7) or 7
        return base + timedelta(days=freq_days)

    async def _update_persona_augmentation(self, user_id: str, website_url: str, audit_result: Dict[str, Any], db: Session):
        """
        Updates the user's Brand Persona with discovered themes, site structure,
        link health, and redirect data from the content audit.
        """
        try:
            session = db.query(OnboardingSession).filter(OnboardingSession.user_id == user_id).first()
            if not session:
                self.logger.warning(f"No onboarding session found for user {user_id}")
                return

            analysis = db.query(WebsiteAnalysis).filter(WebsiteAnalysis.session_id == session.id).first()
            if not analysis:
                self.logger.warning(f"No website analysis found for user {user_id}")
                return

            current_brand = analysis.brand_analysis or {}
            
            # Core themes
            current_brand['augmented_themes'] = audit_result.get('themes', [])
            
            # Link health
            current_brand['link_health'] = audit_result.get('link_health', {})
            
            # Redirect audit
            current_brand['redirect_audit'] = audit_result.get('redirect_audit', {})
            
            # Image SEO
            current_brand['image_seo'] = audit_result.get('image_seo', {})
            
            # Page status distribution
            current_brand['page_status'] = audit_result.get('page_status', {})
            
            # URL structure analysis
            current_brand['url_structure'] = audit_result.get('url_structure', {})
            
            # Freshness
            current_brand['freshness'] = audit_result.get('freshness', {})
            
            # Robots.txt compliance
            current_brand['robots_txt'] = audit_result.get('robots_txt', {})
            
            # Crawl budget analysis
            current_brand['crawl_budget'] = audit_result.get('crawl_budget', {})
            
            current_brand['last_advertools_audit'] = datetime.utcnow().isoformat()
            
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(analysis, "brand_analysis")
            
            if 'avg_word_count' in audit_result:
                current_strategy = analysis.content_strategy_insights or {}
                current_strategy['avg_content_length'] = audit_result['avg_word_count']
                analysis.content_strategy_insights = current_strategy
                flag_modified(analysis, "content_strategy_insights")

            self.logger.info(f"Updated persona augmentation for {user_id}")
            
        except Exception as e:
            self.logger.error(f"Failed to update persona augmentation: {e}")
            raise e

    async def _update_site_health_metrics(self, user_id: str, website_url: str, health_result: Dict[str, Any], db: Session):
        """
        Updates the WebsiteAnalysis with site health metrics (velocity, freshness,
        URL structure analysis, freshness score).
        """
        try:
            session = db.query(OnboardingSession).filter(OnboardingSession.user_id == user_id).first()
            if not session:
                return

            analysis = db.query(WebsiteAnalysis).filter(WebsiteAnalysis.session_id == session.id).first()
            if not analysis:
                return

            current_seo = analysis.seo_audit or {}
            metrics = health_result.get('metrics', {})
            
            current_seo['site_health'] = {
                "total_urls": metrics.get('total_urls'),
                "publishing_velocity": metrics.get('publishing_velocity'),
                "stale_content_count": metrics.get('stale_content_count'),
                "stale_content_percentage": metrics.get('stale_content_percentage'),
                "freshness_score": metrics.get('freshness_score'),
                "publishing_recency": metrics.get('publishing_recency'),
                "publishing_trend": metrics.get('publishing_trend'),
                "top_pillars": metrics.get('top_pillars'),
                "url_structure": metrics.get('url_structure', {})
            }
            current_seo['last_advertools_health_check'] = datetime.utcnow().isoformat()
            
            analysis.seo_audit = current_seo
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(analysis, "seo_audit")
            self.logger.info(f"Updated site health metrics for {user_id}")
            
        except Exception as e:
            self.logger.error(f"Failed to update site health metrics: {e}")
            raise e
