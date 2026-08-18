"""
Onboarding Task Scheduler
Shared task scheduling logic used by step_management_service.py (Steps 1-3)
and onboarding_completion_service.py (completion).
All scheduling is non-blocking -- step completion never fails on scheduling errors.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from loguru import logger


def _record_task_in_session(db: Session, user_id: str, task_type: str, step: int, details: Optional[Dict] = None):
    """Append a task record to the onboarding session payload manifest."""
    try:
        from models.onboarding import OnboardingSession
        session = db.query(OnboardingSession).filter(
            OnboardingSession.user_id == user_id
        ).order_by(OnboardingSession.id.desc()).first()
        if not session:
            return
        payload = dict(session.payload) if session.payload else {}
        tasks = payload.setdefault("scheduled_tasks", [])
        tasks.append({
            "type": task_type,
            "step": step,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **(details or {}),
        })
        session.payload = payload
        db.add(session)
        db.commit()
    except Exception:
        db.rollback()


def _upsert_task(db, model_cls, user_id: str, filters: dict, defaults: dict):
    """Insert or update a task row. Query-then-update pattern avoids race conditions."""
    existing = db.query(model_cls).filter_by(**filters).first()
    if existing:
        for key, value in defaults.items():
            setattr(existing, key, value)
        db.add(existing)
        return existing
    else:
        row = model_cls(**filters, **defaults)
        db.add(row)
        return row


def schedule_step2_tasks(
    user_id: str,
    db: Session,
    website_url: str,
    preferences: Optional[Dict[str, Any]] = None,
):
    """Schedule background tasks after Step 2 (Website Analysis) completes.

    Creates DB-backed monitoring tasks + advertools intelligence.
    All errors are non-blocking (logged, not raised).

    Args:
        preferences: Optional task preferences dict from the user
            e.g. {"seo_audit": {"enabled": False}, ...}
            If not provided, all tasks are enabled with default delays.
    """
    from .step2_task_preferences import get_task_delay_mins, get_task_label
    from models.website_analysis_monitoring_models import (
        OnboardingFullWebsiteAnalysisTask,
        SIFIndexingTask,
        MarketTrendsTask,
    )

    now = datetime.now(timezone.utc)
    default_next = now + timedelta(minutes=5)

    def _delay_for(task_id: str) -> Optional[timedelta]:
        """Return timedelta for task, or None if disabled."""
        if not preferences:
            return default_next
        mins = get_task_delay_mins(task_id, preferences)
        if mins < 0:
            return None  # disabled
        return now + timedelta(minutes=mins)

    # 1. Full-site SEO audit
    delay = _delay_for("seo_audit")
    task_status = "active" if delay is not None else "paused"
    try:
        _upsert_task(
            db, OnboardingFullWebsiteAnalysisTask,
            user_id=user_id,
            filters={"user_id": user_id, "website_url": website_url},
            defaults={
                "status": task_status,
                "next_execution": delay,
                "payload": {
                    "website_url": website_url,
                    "max_urls": 500,
                    "created_from": "onboarding_step2",
                },
            },
        )
        db.commit()
        logger.info(f"[onboarding_step2] Scheduled full-site SEO audit for {website_url}")
        _record_task_in_session(db, user_id, "onboarding_full_website_analysis", step=2, details={"website_url": website_url})
    except Exception as e:
        db.rollback()
        logger.warning(f"[onboarding_step2] Non-blocking: failed to schedule SEO audit: {e}")

    # 2. SIF Indexing
    delay = _delay_for("sif_indexing")
    task_status = "active" if delay is not None else "paused"
    try:
        _upsert_task(
            db, SIFIndexingTask,
            user_id=user_id,
            filters={"user_id": user_id, "website_url": website_url},
            defaults={
                "status": task_status,
                "next_execution": delay or now,
                "frequency_hours": 48,
                "payload": {
                    "website_url": website_url,
                    "mode": "initial_indexing",
                    "created_from": "onboarding_step2",
                },
            },
        )
        db.commit()
        logger.info(f"[onboarding_step2] Scheduled SIF indexing for {website_url} ({get_task_label("sif_indexing")})")
        _record_task_in_session(db, user_id, "sif_indexing", step=2, details={"website_url": website_url})
    except Exception as e:
        db.rollback()
        logger.warning(f"[onboarding_step2] Non-blocking: failed to schedule SIF indexing: {e}")

    # 3. Market Trends
    delay = _delay_for("market_trends")
    task_status = "active" if delay is not None else "paused"
    try:
        _upsert_task(
            db, MarketTrendsTask,
            user_id=user_id,
            filters={"user_id": user_id, "website_url": website_url},
            defaults={
                "status": task_status,
                "next_execution": delay,
                "frequency_hours": 72,
                "payload": {
                    "website_url": website_url,
                    "geo": "US",
                    "timeframe": "today 12-m",
                    "created_from": "onboarding_step2",
                },
            },
        )
        db.commit()
        logger.info(f"[onboarding_step2] Scheduled Market Trends for {website_url}")
        _record_task_in_session(db, user_id, "market_trends", step=2, details={"website_url": website_url})
    except Exception as e:
        db.rollback()
        logger.warning(f"[onboarding_step2] Non-blocking: failed to schedule Market Trends: {e}")

    # 4. Website analysis monitoring
    wa_delay = _delay_for("website_analysis_tasks")
    if wa_delay is not None:
        try:
            from services.website_analysis_monitoring_service import (
                schedule_website_analysis_task_creation,
            )
            mins = int((wa_delay - now).total_seconds() / 60)
            schedule_website_analysis_task_creation(user_id=user_id, delay_minutes=mins)
            logger.info(f"[onboarding_step2] Scheduled website analysis tasks for {website_url}")
        except Exception as e:
            logger.warning(f"[onboarding_step2] Non-blocking: failed to schedule website analysis: {e}")
    else:
        logger.info(f"[onboarding_step2] Skipped website analysis tasks for {website_url} (user deferred)")

    # 5. Advertools intelligence (content audit + site health)
    delay_content = _delay_for("advertools_content")
    delay_health = _delay_for("advertools_health")
    try:
        from models.advertools_monitoring_models import AdvertoolsTask

        audit = AdvertoolsTask(
            user_id=user_id,
            website_url=website_url,
            status="active" if delay_content is not None else "paused",
            next_execution=delay_content,
            frequency_days=7,
            payload={
                "type": "content_audit",
                "website_url": website_url,
                "created_from": "onboarding_step2",
            },
        )
        db.add(audit)

        health = AdvertoolsTask(
            user_id=user_id,
            website_url=website_url,
            status="active" if delay_health is not None else "paused",
            next_execution=delay_health,
            frequency_days=7,
            payload={
                "type": "site_health",
                "website_url": website_url,
                "created_from": "onboarding_step2",
            },
        )
        db.add(health)
        db.commit()
        logger.info(f"[onboarding_step2] Scheduled Advertools tasks for {website_url} (content={delay_content is not None}, health={delay_health is not None})")
        _record_task_in_session(db, user_id, "advertools_content_audit", step=2, details={"website_url": website_url})
        _record_task_in_session(db, user_id, "advertools_site_health", step=2, details={"website_url": website_url})
    except Exception as e:
        db.rollback()
        logger.warning(f"[onboarding_step2] Non-blocking: failed to schedule Advertools tasks: {e}")


def schedule_step3_tasks(
    user_id: str,
    db: Session,
    website_url: str,
    competitors: List[Dict[str, Any]],
):
    """Schedule background tasks after Step 3 (Research / Competitors) completes.

    Creates DeepCompetitorAnalysisTask if competitors exist.
    All errors are non-blocking (logged, not raised).
    """
    if not competitors or not isinstance(competitors, list) or len(competitors) == 0:
        logger.info(f"[onboarding_step3] No competitors to schedule deep analysis for {user_id}")
        return

    from models.website_analysis_monitoring_models import DeepCompetitorAnalysisTask

    now = datetime.now(timezone.utc)
    next_execution = now + timedelta(minutes=5)

    try:
        payload_deep = {
            "website_url": website_url,
            "competitors": competitors,
            "max_competitors": min(len(competitors), 10),
            "crawl_concurrency": 4,
            "mode": "strategic_insights",
            "created_from": "onboarding_step3",
        }
        _upsert_task(
            db, DeepCompetitorAnalysisTask,
            user_id=user_id,
            filters={"user_id": user_id, "website_url": website_url},
            defaults={
                "status": "active",
                "next_execution": next_execution,
                "payload": payload_deep,
            },
        )
        db.commit()
        logger.info(f"[onboarding_step3] Scheduled deep competitor analysis for {user_id} ({len(competitors)} competitors)")
        _record_task_in_session(db, user_id, "deep_competitor_analysis", step=3, details={
            "website_url": website_url, "competitor_count": len(competitors)
        })
    except Exception as e:
        db.rollback()
        logger.warning(f"[onboarding_step3] Non-blocking: failed to schedule deep competitor analysis: {e}")

    # 2. Record sitemap benchmark as a scheduled task (user-triggered via UI buttons)
    try:
        valid_competitors = [
            c.get("url") for c in competitors
            if isinstance(c, dict) and c.get("url", "").startswith("http")
        ][:5]
        if valid_competitors:
            _record_task_in_session(db, user_id, "sitemap_benchmark", step=3, details={
                "website_url": website_url,
                "competitor_count": len(valid_competitors),
                "competitors": valid_competitors,
            })
            logger.info(f"[onboarding_step3] Recorded sitemap benchmark task for {user_id} ({len(valid_competitors)} competitors)")
    except Exception as e:
        logger.warning(f"[onboarding_step3] Non-blocking: failed to record sitemap benchmark: {e}")


def schedule_step4_tasks(user_id: str, db: Optional[Session] = None):
    """Schedule background tasks after Step 4 (Persona) completes.

    Triggers APScheduler-based persona generation.
    All errors are non-blocking (logged, not raised).
    """
    # 1. Research persona
    try:
        from services.research.research_persona_scheduler import schedule_research_persona_generation
        schedule_research_persona_generation(user_id, delay_minutes=10)
        logger.info(f"[onboarding_step4] Scheduled research persona generation for {user_id}")
        if db:
            _record_task_in_session(db, user_id, "research_persona", step=4)
    except Exception as e:
        logger.warning(f"[onboarding_step4] Non-blocking: failed to schedule research persona: {e}")

    # 2. Platform personas (facebook, twitter, instagram, youtube, podcast)
    try:
        from services.persona.platform_persona_scheduler import schedule_platform_persona_generation
        from services.persona.platform_registry import get_scheduled_platforms
        for platform in get_scheduled_platforms():
            schedule_platform_persona_generation(user_id, platform["id"], delay_minutes=10)
            logger.info(f"[onboarding_step4] Scheduled {platform['id']} persona generation for {user_id}")
            if db:
                _record_task_in_session(db, user_id, f"persona_{platform['id']}", step=4)
    except Exception as e:
        logger.warning(f"[onboarding_step4] Non-blocking: failed to schedule platform personas: {e}")


def schedule_linkedin_tasks(user_id: str, db) -> None:
    """Schedule recurring LinkedIn background tasks after onboarding completes.

    Creates DB-backed scheduler tasks (profile sync, post analytics sync,
    growth reanalysis, OAuth monitoring). All errors are non-blocking.
    """
    from datetime import datetime, timezone, timedelta
    from models.linkedin_monitoring_models import (
        LinkedInProfileSyncTask,
        LinkedInPostAnalyticsSyncTask,
        LinkedInGrowthReanalysisTask,
    )

    now = datetime.now(timezone.utc)

    try:
        _upsert_task(
            db, LinkedInProfileSyncTask,
            user_id=user_id,
            filters={"user_id": user_id},
            defaults={
                "status": "active",
                "next_execution": now + timedelta(days=7),
                "frequency_days": 7,
                "payload": {
                    "created_from": "onboarding_completion",
                    "description": "Re-run LinkedIn profile pipeline (Phases 1-5)",
                },
            },
        )
        db.commit()
        logger.info(f"[schedule_linkedin_tasks] Scheduled linkedin_profile_sync for {user_id}")
        _record_task_in_session(db, user_id, "linkedin_profile_sync", step=6,
                                details={"frequency": 7, "frequency_unit": "days"})
    except Exception as e:
        db.rollback()
        logger.warning(f"[schedule_linkedin_tasks] Non-blocking: failed to schedule linkedin_profile_sync: {e}")

    try:
        _upsert_task(
            db, LinkedInPostAnalyticsSyncTask,
            user_id=user_id,
            filters={"user_id": user_id},
            defaults={
                "status": "active",
                "next_execution": now + timedelta(hours=24),
                "frequency_hours": 24,
                "payload": {
                    "created_from": "onboarding_completion",
                    "post_limit": 50,
                    "description": "Sync last 50 posts + engagement metrics from Unipile",
                },
            },
        )
        db.commit()
        logger.info(f"[schedule_linkedin_tasks] Scheduled linkedin_post_analytics_sync for {user_id}")
        _record_task_in_session(db, user_id, "linkedin_post_analytics_sync", step=6,
                                details={"frequency": 24, "frequency_unit": "hours"})
    except Exception as e:
        db.rollback()
        logger.warning(f"[schedule_linkedin_tasks] Non-blocking: failed to schedule linkedin_post_analytics_sync: {e}")

    try:
        _upsert_task(
            db, LinkedInGrowthReanalysisTask,
            user_id=user_id,
            filters={"user_id": user_id},
            defaults={
                "status": "active",
                "next_execution": now + timedelta(hours=72),
                "frequency_hours": 72,
                "payload": {
                    "created_from": "onboarding_completion",
                    "description": "Re-run ConsolidatedGrowthService.analyze_all() to capture trending topic drift",
                },
            },
        )
        db.commit()
        logger.info(f"[schedule_linkedin_tasks] Scheduled linkedin_growth_reanalysis for {user_id}")
        _record_task_in_session(db, user_id, "linkedin_growth_reanalysis", step=6,
                                details={"frequency": 72, "frequency_unit": "hours"})
    except Exception as e:
        db.rollback()
        logger.warning(f"[schedule_linkedin_tasks] Non-blocking: failed to schedule linkedin_growth_reanalysis: {e}")

    try:
        from services.oauth_token_monitoring_service import create_oauth_monitoring_tasks
        create_oauth_monitoring_tasks(user_id, db, ['linkedin'])
        db.commit()
        logger.info(f"[schedule_linkedin_tasks] Created OAuth monitoring task for {user_id}")
    except Exception as e:
        db.rollback()
        logger.warning(f"[schedule_linkedin_tasks] Non-blocking: failed to create OAuth monitoring task: {e}")


async def _run_sif_now(user_id: str, website_url: str):
    """Trigger SIF indexing immediately in background (non-blocking).

    Opens a fresh DB session, loads the SIF task, and runs the executor.
    Errors are silently logged — the user's onboarding flow is never blocked.
    """
    try:
        from models.website_analysis_monitoring_models import SIFIndexingTask
        from services.scheduler.executors.sif_indexing_executor import SIFIndexingExecutor
        from services.database.sessions import get_session_for_user

        session = get_session_for_user(user_id)
        if not session:
            return

        try:
            task = session.query(SIFIndexingTask).filter(
                SIFIndexingTask.user_id == user_id,
                SIFIndexingTask.website_url == website_url,
            ).first()

            if not task:
                return

            executor = SIFIndexingExecutor()
            await executor.execute_task(task, session)
            logger.info(f"[_run_sif_now] SIF indexing completed for {website_url}")
        finally:
            session.close()
    except Exception as e:
        logger.warning(f"[_run_sif_now] Non-blocking SIF trigger failed: {e}")


async def _sync_persona_to_sif(user_id: str):
    """Index the user's persona (core + platforms) into SIF — lightweight, non-blocking.

    Only syncs persona data (no harvest/content/guardian), so it is cheap and
    safe to fire after each persona slice is generated. Idempotent: index_content
    upserts by persona doc id. Errors are logged, never raised — the onboarding
    flow is never blocked by SIF.
    """
    try:
        from services.intelligence.sif_integration import SIFIntegrationService
        sif_service = SIFIntegrationService(user_id)
        await sif_service.sync_persona_data_to_sif()
    except Exception as e:
        logger.warning(f"[_sync_persona_to_sif] Non-blocking persona SIF sync failed for {user_id}: {e}")


def _fire_persona_sif_sync(user_id: str):
    """Fire-and-forget a persona SIF sync from a sync call site.

    Runs ``_sync_persona_to_sif`` in a background thread so the sync caller
    (which may be a synchronous method) is never blocked or made to wait.
    """
    import asyncio as _asyncio
    try:
        _asyncio.get_event_loop().run_in_executor(
            None, lambda: _asyncio.run(_sync_persona_to_sif(user_id))
        )
    except Exception as e:
        logger.warning(f"[_fire_persona_sif_sync] Failed to schedule persona SIF sync for {user_id}: {e}")
