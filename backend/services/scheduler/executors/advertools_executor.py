import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse
from loguru import logger
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from services.seo.advertools_service import AdvertoolsService
from services.seo.advertools_run_lock import release, try_acquire
from services.seo.sitemap_ssot import (
    get_fresh_inventory,
    get_stored_sitemap_url,
    save_sitemap_inventory,
)
from services.seo_tools.sitemap_service import SitemapService
from models.advertools_monitoring_models import AdvertoolsTask, AdvertoolsExecutionLog
from models.onboarding import WebsiteAnalysis, OnboardingSession
from services.scheduler.core.executor_interface import TaskExecutor, TaskExecutionResult


def _richer(existing: Any, incoming: Any) -> Any:
    """Return the value with more content; ties keep the EXISTING value.

    Used when a DEGRADED audit result would otherwise overwrite richer data
    stored by an earlier full run (the RCA last-writer-wins bug): a root-only
    fallback audit must not shrink a 15-URL audit's themes/link health, and
    its zeroed scalars (freshness_score=0, tiny counts) must never displace
    stored metrics — hence ties are conservative and keep what is stored.
    """
    def _size(value: Any) -> int:
        if value is None:
            return -1
        if isinstance(value, (list, dict, str)):
            return len(value)
        return 1  # scalars count as content

    return existing if _size(existing) >= _size(incoming) else incoming


# brand_analysis key -> audit_result key
BRAND_RESULT_KEYS = {
    'augmented_themes': 'themes',
    'link_health': 'link_health',
    'redirect_audit': 'redirect_audit',
    'image_seo': 'image_seo',
    'page_status': 'page_status',
    'url_structure': 'url_structure',
    'freshness': 'freshness',
    'robots_txt': 'robots_txt',
    'crawl_budget': 'crawl_budget',
}

class AdvertoolsExecutor(TaskExecutor):
    """
    Executor for Advertools-based SEO intelligence tasks.
    Handles 'content_audit' and 'site_health' task types.
    """
    
    def __init__(self):
        self.advertools_service = AdvertoolsService()
        self.sitemap_service = SitemapService()
        self.logger = logger.bind(service="AdvertoolsExecutor")

    def _pause_other_active_duplicates(
        self, db: Session, user_id: str, website_url: str, task_type: str, keep_task_id: int
    ) -> int:
        """Self-heal: pause other 'active' duplicates of the same type.

        Older versions of ``schedule_step2_tasks`` appended a NEW task row on
        every step-2 save, so duplicate rows for the same (user, site, type)
        exist in some databases. Once one row runs successfully, the others
        are paused (not deleted, to preserve AdvertoolsExecutionLog history).
        Returns the number of rows paused.
        """
        paused = 0
        try:
            rows = db.query(AdvertoolsTask).filter(
                AdvertoolsTask.user_id == user_id,
                AdvertoolsTask.website_url == website_url,
                AdvertoolsTask.status == 'active',
            ).all()
            for row in rows:
                if row.id == keep_task_id:
                    continue
                if (row.payload or {}).get('type') != task_type:
                    continue
                row.status = 'paused'
                row.payload = {**(row.payload or {}), 'deduped_into': keep_task_id}
                db.add(row)
                paused += 1
                self.logger.info(
                    f"Paused duplicate {task_type} task id={row.id} "
                    f"(superseded by successful run of task {keep_task_id})"
                )
        except Exception as e:
            self.logger.warning(f"Duplicate self-heal failed (non-blocking): {e}")
        return paused

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

        # Cross-path execution mutex: another pipeline for the same
        # (user, site, type) may already be running — duplicate task rows each
        # got their own scheduler lease, or the user fired the interactive
        # route. Skip instead of double-crawling an already rate-limited
        # origin. The skipped row re-checks in 15 minutes (by then the winner
        # has usually finished and paused duplicates via self-heal).
        lock_acquired = False
        if user_id and website_url and task_type:
            lock_acquired = try_acquire(
                user_id, website_url, task_type,
                db=db,
                exclude_task_id=task_id if isinstance(task_id, int) else None,
            )
            if not lock_acquired:
                self.logger.warning(
                    f"Advertools task {task_id} ({task_type}) SKIPPED — "
                    f"another pipeline is already running for {website_url}"
                )
                if task_record:
                    try:
                        task_record.status = 'active'
                        task_record.next_execution = datetime.utcnow() + timedelta(minutes=15)
                        db.commit()
                    except Exception:
                        db.rollback()
                return TaskExecutionResult(
                    success=True,
                    result_data={
                        "skipped": True,
                        "reason": "another pipeline already running for this site",
                    },
                    execution_time_ms=0,
                    retryable=False,
                )

        try:
            if not website_url:
                raise ValueError("Missing website_url in payload")

            # 1. Sitemap SSOT first: reuse the URL discovered during website
            # analysis instead of re-discovering it on every run (re-discovery
            # re-hits an already rate-limited origin). Only discover when the
            # SSOT has nothing stored.
            effective_url = None
            try:
                effective_url = get_stored_sitemap_url(db, user_id)
            except Exception as ssot_err:
                self.logger.warning(f"Sitemap SSOT read failed (non-blocking): {ssot_err}")

            if effective_url:
                self.logger.info(f"Using SSOT sitemap URL: {effective_url}")
            else:
                discovered_sitemap = await self.sitemap_service.discover_sitemap_url(website_url)
                effective_url = discovered_sitemap if discovered_sitemap else website_url
            
            # Set status to running for UI feedback
            if task_record:
                task_record.status = 'running'
                db.commit()

            result = {}
            if task_type == 'content_audit':
                # Phase 1: Get sitemap analysis (freshness, URL structure, pillars).
                # max_retries=1 so a rate-limited origin (HTTP 429) degrades fast
                # instead of blocking the audit with 4 attempts × 30s backoff per
                # sub-sitemap.
                sitemap_result = await self.advertools_service.analyze_sitemap(
                    effective_url, max_retries=1
                )
                
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
                    # Persist the sitemap inventory into the user's SSOT so
                    # other consumers never re-fetch a rate-limited sitemap.
                    if metrics.get('inventory'):
                        save_sitemap_inventory(
                            db, user_id, website_url, effective_url, metrics['inventory']
                        )
                had_audit_urls = bool(audit_urls)

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
                
                # Phase 5: Crawl budget analysis — reuse Phase 1's sitemap total so we don't
                # re-fetch a rate-limited sitemap (429); skip re-fetch since Phase 1 already
                # attempted the primary sitemap URL. robots.txt sitemaps as fallbacks if needed.
                robots_sitemaps = robots_result.get("sitemap_urls") or []
                known_total = None
                if sitemap_result.get('success'):
                    known_total = sitemap_result.get('metrics', {}).get('total_urls')
                if not known_total:
                    # SSOT fallback: a prior successful run may have persisted
                    # the sitemap inventory. Reuse it instead of degrading to
                    # "no sitemap data" (root-crawl only).
                    try:
                        ssot_inventory = get_fresh_inventory(db, user_id)
                        if ssot_inventory and ssot_inventory.get('total_urls'):
                            known_total = ssot_inventory.get('total_urls')
                            self.logger.info(
                                f"Crawl budget: reusing SSOT sitemap total {known_total}"
                            )
                    except Exception as ssot_err:
                        self.logger.warning(f"Sitemap SSOT inventory read failed (non-blocking): {ssot_err}")
                budget_result = await self.advertools_service.analyze_crawl_budget(
                    effective_url, site_domain, fallback_sitemap_urls=robots_sitemaps,
                    known_sitemap_total=known_total, primary_sitemap_attempted=True,
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
                # Phase 4: attach why this run is partial (if at all), so the
                # persona merge can protect richer stored data and the UI can
                # show a partial-data warning.
                result.update(self._degradation_metadata(
                    sitemap_result=sitemap_result,
                    had_audit_urls=had_audit_urls,
                    website_url=website_url,
                    robots_result=robots_result,
                ))
                
                if result.get('success'):
                    await self._update_persona_augmentation(user_id, website_url, result, db)
                    
            elif task_type == 'site_health':
                # Site health: freshness, velocity, URL structure. Fast-fail on 429s.
                result = await self.advertools_service.analyze_sitemap(
                    effective_url, max_retries=1
                )
                
                if result.get('success'):
                    # Refresh the SSOT inventory on every successful health check.
                    health_metrics = result.get('metrics', {})
                    if health_metrics.get('inventory'):
                        save_sitemap_inventory(
                            db, user_id, website_url, effective_url, health_metrics['inventory']
                        )
                    await self._update_site_health_metrics(user_id, website_url, result, db)
            
            else:
                raise ValueError(f"Unknown task type: {task_type}")

            success = result.get('success', False)
            execution_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            # Self-heal pre-existing duplicate rows: once this run succeeded,
            # pause other 'active' duplicates so they stop re-firing.
            if success and isinstance(task_id, int) and user_id and website_url and task_type:
                self._pause_other_active_duplicates(
                    db, user_id, website_url, task_type, keep_task_id=task_id
                )

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
        finally:
            if lock_acquired:
                release(user_id, website_url, task_type)

    def calculate_next_execution(self, task: Any, frequency: str, last_execution: Optional[datetime] = None) -> datetime:
        base = last_execution or datetime.utcnow()
        freq_days = getattr(task, 'frequency_days', 7) or 7
        return base + timedelta(days=freq_days)

    @staticmethod
    def _degradation_metadata(
        sitemap_result: Dict[str, Any],
        had_audit_urls: bool,
        website_url: str,
        robots_result: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Collect why this audit result is partial (empty reasons = clean run).

        Feeds both the returned result and the persisted brand_analysis so the
        UI can show partial-data warnings instead of a silent downgrade.
        """
        reasons: list = []
        rate_limited = False

        if not sitemap_result.get('success'):
            reasons.append(f"sitemap analysis failed: {sitemap_result.get('error') or 'unknown error'}")
            if sitemap_result.get('rate_limited'):
                rate_limited = True
        elif sitemap_result.get('degraded'):
            reasons.append(sitemap_result.get('degraded_reason') or 'sitemap analysis partial (rate-limited)')
            if sitemap_result.get('rate_limited'):
                rate_limited = True

        if not had_audit_urls:
            reasons.append(
                f"sitemap produced no audit URLs; audited site root only ({website_url})"
            )

        if robots_result.get('degraded'):
            reasons.append('robots.txt analysis failed; crawl-budget fallbacks unavailable')

        return {
            "degraded": bool(reasons),
            "degraded_reasons": reasons,
            "rate_limited": rate_limited,
        }

    async def _update_persona_augmentation(self, user_id: str, website_url: str, audit_result: Dict[str, Any], db: Session):
        """
        Updates the user's Brand Persona with discovered themes, site structure,
        link health, and redirect data from the content audit.

        Merge-don't-clobber (Phase 4): a DEGRADED result (e.g. 429 circuit
        tripped, root-only audit) keeps the richer value per key that an
        earlier full run stored, instead of shrinking it. Clean results
        overwrite wholesale and clear the degraded flags.
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
            # Work on a COPY and reassign: when the column is NULL the old
            # pattern mutated a detached dict, so flag_modified flushed the
            # original (None) value and the whole write silently vanished.
            current_brand = dict(current_brand)
            degraded = bool(audit_result.get('degraded'))

            for brand_key, result_key in BRAND_RESULT_KEYS.items():
                incoming = audit_result.get(result_key)
                if degraded:
                    current_brand[brand_key] = _richer(current_brand.get(brand_key), incoming)
                else:
                    current_brand[brand_key] = incoming

            current_brand['last_advertools_audit'] = datetime.utcnow().isoformat()
            # Degradation transparency: the LAST run's state, even when we
            # kept richer per-key values from a previous full run.
            current_brand['degraded'] = degraded
            current_brand['degraded_reasons'] = list(audit_result.get('degraded_reasons') or [])
            current_brand['rate_limited'] = bool(audit_result.get('rate_limited'))

            analysis.brand_analysis = current_brand

            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(analysis, "brand_analysis")

            if 'avg_word_count' in audit_result:
                current_strategy = analysis.content_strategy_insights or {}
                # A root-only audit's average says nothing about the site —
                # keep the stored average when this run is degraded.
                if not degraded or current_strategy.get('avg_content_length') is None:
                    current_strategy['avg_content_length'] = audit_result['avg_word_count']
                    analysis.content_strategy_insights = current_strategy
                    flag_modified(analysis, "content_strategy_insights")

            if degraded:
                self.logger.info(
                    f"Updated persona augmentation for {user_id} (DEGRADED, kept richer "
                    f"stored values: {audit_result.get('degraded_reasons')})"
                )
            else:
                self.logger.info(f"Updated persona augmentation for {user_id}")

        except Exception as e:
            self.logger.error(f"Failed to update persona augmentation: {e}")
            raise e

    async def _update_site_health_metrics(self, user_id: str, website_url: str, health_result: Dict[str, Any], db: Session):
        """
        Updates the WebsiteAnalysis with site health metrics (velocity, freshness,
        URL structure analysis, freshness score).

        Merge-don't-clobber (Phase 4): a degraded health check (partial
        sitemap fan-out) keeps the richer stored metric per key and records
        the degraded flag for the UI.
        """
        try:
            session = db.query(OnboardingSession).filter(OnboardingSession.user_id == user_id).first()
            if not session:
                return

            analysis = db.query(WebsiteAnalysis).filter(WebsiteAnalysis.session_id == session.id).first()
            if not analysis:
                return

            current_seo = dict(analysis.seo_audit or {})
            metrics = health_result.get('metrics', {})
            degraded = bool(health_result.get('degraded'))

            incoming_health = {
                "total_urls": metrics.get('total_urls'),
                "publishing_velocity": metrics.get('publishing_velocity'),
                "stale_content_count": metrics.get('stale_content_count'),
                "stale_content_percentage": metrics.get('stale_content_percentage'),
                "freshness_score": metrics.get('freshness_score'),
                "publishing_recency": metrics.get('publishing_recency'),
                "publishing_trend": metrics.get('publishing_trend'),
                "top_pillars": metrics.get('top_pillars'),
                "url_structure": metrics.get('url_structure', {}),
            }

            if degraded:
                existing_health = current_seo.get('site_health') or {}
                merged_health = {
                    key: _richer(existing_health.get(key), value)
                    for key, value in incoming_health.items()
                }
            else:
                merged_health = incoming_health

            merged_health["degraded"] = degraded
            merged_health["degraded_reason"] = health_result.get('degraded_reason')
            current_seo['site_health'] = merged_health
            current_seo['last_advertools_health_check'] = datetime.utcnow().isoformat()

            analysis.seo_audit = current_seo
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(analysis, "seo_audit")

            if degraded:
                self.logger.info(
                    f"Updated site health metrics for {user_id} (DEGRADED, kept richer "
                    f"stored metrics: {health_result.get('degraded_reason')})"
                )
            else:
                self.logger.info(f"Updated site health metrics for {user_id}")

        except Exception as e:
            self.logger.error(f"Failed to update site health metrics: {e}")
            raise e
