"""
Content Audit + Site Health endpoints for onboarding — user-driven with status.
Synchronous runs (like SEO preview) so the end user can fire them and see results.

Endpoints:
  GET  /api/onboarding/content-audit/status  — current audit/task status
  POST /api/onboarding/content-audit/run     — run the content audit now
  POST /api/onboarding/site-health/run       — run the site health analysis now
"""

from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/api/onboarding", tags=["Onboarding Content Audit"])


def _normalize_task_status(task: Any) -> Dict[str, Any]:
    """Map AdvertoolsTask status to a clean UI status.

    'active'   -> 'scheduled' (task enabled, awaiting execution or just ran)
    'running'  -> 'running'   (executor sets this while executing)
    'failed'   -> 'failed'
    'paused'   -> 'paused'
    None       -> 'not_created'
    """
    if not task:
        return {"status": "not_created", "last_executed": None}
    raw = task.status or "active"
    if raw == "active":
        status = "scheduled"
    elif raw in ("running", "failed", "paused"):
        status = raw
    else:
        status = "scheduled"
    return {
        "status": status,
        "last_executed": task.last_executed.isoformat() if task.last_executed else None,
        "last_success": task.last_success.isoformat() if task.last_success else None,
        "failure_reason": task.failure_reason,
    }


def _has_results_in_analysis(analysis: Any) -> bool:
    if not analysis or not analysis.brand_analysis:
        return False
    ba = analysis.brand_analysis
    return bool(
        ba.get("augmented_themes")
        or ba.get("link_health", {}).get("total_links_found")
        or ba.get("crawl_budget", {}).get("pages_crawled")
    )


@router.get("/content-audit/status")
async def get_content_audit_status(
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return content-audit and site-health statuses plus whether results exist."""
    user_id = str(current_user.get("id", ""))
    from services.database import get_session_for_user

    db = get_session_for_user(user_id)
    if not db:
        raise HTTPException(status_code=503, detail="Database connection failed")

    try:
        from models.advertools_monitoring_models import AdvertoolsTask
        from models.onboarding import OnboardingSession, WebsiteAnalysis

        tasks = db.query(AdvertoolsTask).filter(
            AdvertoolsTask.user_id == user_id
        ).order_by(AdvertoolsTask.updated_at.desc()).all()

        content_task = None
        health_task = None
        for t in tasks:
            ptype = (t.payload or {}).get("type")
            if ptype == "content_audit" and not content_task:
                content_task = t
            elif ptype == "site_health" and not health_task:
                health_task = t

        has_results = False
        session = db.query(OnboardingSession).filter(
            OnboardingSession.user_id == user_id
        ).first()
        if session:
            analysis = db.query(WebsiteAnalysis).filter(
                WebsiteAnalysis.session_id == session.id
            ).first()
            has_results = _has_results_in_analysis(analysis)

        return {
            "success": True,
            "content_audit": _normalize_task_status(content_task),
            "site_health": _normalize_task_status(health_task),
            "has_results": has_results,
        }
    finally:
        db.close()


@router.post("/content-audit/run")
async def run_content_audit(
    request: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Run the advertools content audit synchronously and persist results.

    Mirrors the scheduler executor's content_audit flow so the end user can
    fire it on demand and see results immediately (like the SEO preview).
    """
    website_url = (request.get("website_url") or "").strip()
    if not website_url:
        raise HTTPException(status_code=400, detail="website_url is required")

    user_id = str(current_user.get("id", "unknown"))
    logger.info(f"[ContentAudit] Requested by user={user_id} for {website_url}")

    from urllib.parse import urlparse
    from services.database import get_session_for_user
    from services.seo.advertools_service import AdvertoolsService
    from services.seo_tools.sitemap_service import SitemapService
    from services.scheduler.executors.advertools_executor import AdvertoolsExecutor
    from models.onboarding import OnboardingSession, WebsiteAnalysis

    db = get_session_for_user(user_id)
    if not db:
        raise HTTPException(status_code=503, detail="Database connection failed")

    try:
        # Reuse the sitemap URL from the initial website analysis if available,
        # avoiding a redundant discover_sitemap_url call that may trigger 429s.
        discovered_sitemap = None
        session = db.query(OnboardingSession).filter(
            OnboardingSession.user_id == user_id
        ).first()
        if session:
            analysis = db.query(WebsiteAnalysis).filter(
                WebsiteAnalysis.session_id == session.id
            ).first()
            if analysis:
                crawl_result = analysis.crawl_result or {}
                sitemap_analysis = crawl_result.get("sitemap_analysis") or {}
                discovered_sitemap = sitemap_analysis.get("sitemap_url")
                logger.info(f"[ContentAudit] Reusing sitemap from initial analysis: {discovered_sitemap}")

        if not discovered_sitemap:
            logger.info(f"[ContentAudit] No stored sitemap, discovering...")
            sitemap_service = SitemapService()
            discovered_sitemap = await sitemap_service.discover_sitemap_url(website_url)
            logger.info(f"[ContentAudit] Discovered sitemap: {discovered_sitemap}")

        effective_url = discovered_sitemap if discovered_sitemap else website_url
        logger.info(f"[ContentAudit] Using effective_url for sitemap analysis: {effective_url}")

        advertools_service = AdvertoolsService()

        # Phase 1: sitemap analysis (freshness, URL structure, sample URLs).
        # max_retries=1 so a rate-limited origin (429) fails fast instead of
        # blocking the synchronous request with 4 attempts × 30s backoff.
        sitemap_result = await advertools_service.analyze_sitemap(effective_url, max_retries=1)

        audit_urls = []
        url_structure = {}
        freshness = {}
        if sitemap_result.get("success"):
            metrics = sitemap_result.get("metrics", {})
            audit_urls = metrics.get("audit_sample_urls", [])
            url_structure = metrics.get("url_structure", {})
            freshness = {
                "freshness_score": metrics.get("freshness_score"),
                "publishing_velocity": metrics.get("publishing_velocity"),
                "stale_content_percentage": metrics.get("stale_content_percentage"),
                "publishing_recency": metrics.get("publishing_recency"),
                "publishing_trend": metrics.get("publishing_trend"),
            }

        if not audit_urls:
            audit_urls = [website_url]

        # Phase 2: theme analysis via content audit
        audit_result = await advertools_service.audit_content(audit_urls)

        # Phase 3: site structure (links, redirects, image SEO)
        site_domain = urlparse(website_url).netloc or website_url
        structure_result = await advertools_service.analyze_site_structure(
            audit_urls, site_domain=site_domain
        )

        # Phase 4: robots.txt compliance
        robots_result = await advertools_service.analyze_robots_txt(website_url)

        # Phase 5: crawl budget analysis — reuse Phase 1's sitemap total so we don't
        # re-fetch a rate-limited sitemap (429); skip re-fetch entirely since Phase 1
        # already attempted the primary sitemap URL. robots.txt sitemaps as fallbacks only.
        robots_sitemaps = robots_result.get("sitemap_urls") or []
        known_total = None
        if sitemap_result.get("success"):
            known_total = sitemap_result.get("metrics", {}).get("total_urls")
        budget_result = await advertools_service.analyze_crawl_budget(
            effective_url,
            site_domain,
            fallback_sitemap_urls=robots_sitemaps,
            known_sitemap_total=known_total,
            primary_sitemap_attempted=True,
        )

        result = {
            "success": audit_result.get("success", False) or structure_result.get("success", False),
            "themes": audit_result.get("themes", []),
            "page_count": audit_result.get("page_count", 0),
            "avg_word_count": audit_result.get("avg_word_count", 0),
            "link_health": structure_result.get("link_health", {}),
            "redirect_audit": structure_result.get("redirect_audit", {}),
            "image_seo": structure_result.get("image_seo", {}),
            "page_status": structure_result.get("page_status", {}),
            "url_structure": url_structure,
            "freshness": freshness,
            "robots_txt": robots_result,
            "crawl_budget": budget_result,
        }

        # Persist into WebsiteAnalysis.brand_analysis + AdvertoolsTask record
        executor = AdvertoolsExecutor()
        await executor._update_persona_augmentation(user_id, website_url, result, db)

        # Update/create the AdvertoolsTask record so status reflects completion
        from models.advertools_monitoring_models import AdvertoolsTask
        from datetime import datetime

        existing_tasks = db.query(AdvertoolsTask).filter(
            AdvertoolsTask.user_id == user_id
        ).all()
        task = None
        for t in existing_tasks:
            if (t.payload or {}).get("type") == "content_audit":
                task = t
                break
        if task:
            task.status = "active"
            task.last_executed = datetime.utcnow()
            task.last_success = datetime.utcnow()
            task.consecutive_failures = 0
            task.failure_reason = None
        else:
            task = AdvertoolsTask(
                user_id=user_id,
                website_url=website_url,
                status="active",
                payload={"type": "content_audit", "website_url": website_url},
                last_executed=datetime.utcnow(),
                last_success=datetime.utcnow(),
            )
            db.add(task)

        db.commit()

        logger.info(f"[ContentAudit] Completed for user={user_id} url={website_url}")

        return {
            "success": result.get("success", False),
            "audit": result,
            "error": None if result.get("success") else "Content audit produced no results",
        }
    except Exception as e:
        logger.error(f"[ContentAudit] Failed for {website_url}: {e}")
        raise HTTPException(status_code=500, detail=f"Content audit failed: {e}")
    finally:
        db.close()


@router.post("/site-health/run")
async def run_site_health(
    request: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Run the site health analysis (sitemap freshness/velocity/structure) synchronously.

    Mirrors the scheduler executor's site_health flow so the end user can fire it
    on demand and see results immediately (like the content audit run).
    """
    website_url = (request.get("website_url") or "").strip()
    if not website_url:
        raise HTTPException(status_code=400, detail="website_url is required")

    user_id = str(current_user.get("id", "unknown"))
    logger.info(f"[SiteHealth] Requested by user={user_id} for {website_url}")

    from services.database import get_session_for_user
    from services.seo.advertools_service import AdvertoolsService
    from services.seo_tools.sitemap_service import SitemapService
    from services.scheduler.executors.advertools_executor import AdvertoolsExecutor
    from models.onboarding import OnboardingSession, WebsiteAnalysis

    db = get_session_for_user(user_id)
    if not db:
        raise HTTPException(status_code=503, detail="Database connection failed")

    try:
        # Reuse the sitemap URL from the initial website analysis if available,
        # avoiding a redundant discover_sitemap_url call that may trigger 429s.
        discovered_sitemap = None
        session = db.query(OnboardingSession).filter(
            OnboardingSession.user_id == user_id
        ).first()
        if session:
            analysis = db.query(WebsiteAnalysis).filter(
                WebsiteAnalysis.session_id == session.id
            ).first()
            if analysis:
                crawl_result = analysis.crawl_result or {}
                sitemap_analysis = crawl_result.get("sitemap_analysis") or {}
                discovered_sitemap = sitemap_analysis.get("sitemap_url")
                logger.info(f"[SiteHealth] Reusing sitemap from initial analysis: {discovered_sitemap}")

        if not discovered_sitemap:
            logger.info(f"[SiteHealth] No stored sitemap, discovering...")
            sitemap_service = SitemapService()
            discovered_sitemap = await sitemap_service.discover_sitemap_url(website_url)
            logger.info(f"[SiteHealth] Discovered sitemap: {discovered_sitemap}")

        effective_url = discovered_sitemap if discovered_sitemap else website_url
        logger.info(f"[SiteHealth] Using effective_url for sitemap analysis: {effective_url}")

        advertools_service = AdvertoolsService()

        sitemap_result = await advertools_service.analyze_sitemap(effective_url, max_retries=1)

        if not sitemap_result.get("success"):
            logger.warning(f"[SiteHealth] Sitemap analysis failed for {effective_url}: {sitemap_result.get('error')}")
            raise HTTPException(status_code=502, detail=f"Site health analysis failed: {sitemap_result.get('error')}")

        # Persist into WebsiteAnalysis.seo_audit.site_health + AdvertoolsTask record
        executor = AdvertoolsExecutor()
        await executor._update_site_health_metrics(user_id, website_url, sitemap_result, db)

        # Update/create the AdvertoolsTask record so status reflects completion
        from models.advertools_monitoring_models import AdvertoolsTask
        from datetime import datetime

        existing_tasks = db.query(AdvertoolsTask).filter(
            AdvertoolsTask.user_id == user_id
        ).all()
        task = None
        for t in existing_tasks:
            if (t.payload or {}).get("type") == "site_health":
                task = t
                break
        if task:
            task.status = "active"
            task.last_executed = datetime.utcnow()
            task.last_success = datetime.utcnow()
            task.consecutive_failures = 0
            task.failure_reason = None
        else:
            task = AdvertoolsTask(
                user_id=user_id,
                website_url=website_url,
                status="active",
                payload={"type": "site_health", "website_url": website_url},
                last_executed=datetime.utcnow(),
                last_success=datetime.utcnow(),
            )
            db.add(task)

        db.commit()

        metrics = sitemap_result.get("metrics", {})
        site_health = {
            "total_urls": metrics.get("total_urls"),
            "publishing_velocity": metrics.get("publishing_velocity"),
            "stale_content_count": metrics.get("stale_content_count"),
            "stale_content_percentage": metrics.get("stale_content_percentage"),
            "freshness_score": metrics.get("freshness_score"),
            "publishing_recency": metrics.get("publishing_recency"),
            "publishing_trend": metrics.get("publishing_trend"),
            "top_pillars": metrics.get("top_pillars"),
            "url_structure": metrics.get("url_structure", {}),
        }

        logger.info(f"[SiteHealth] Completed for user={user_id} url={website_url}")

        return {
            "success": True,
            "site_health": site_health,
            "error": None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[SiteHealth] Failed for {website_url}: {e}")
        raise HTTPException(status_code=500, detail=f"Site health analysis failed: {e}")
    finally:
        db.close()
