"""
Onboarding Task Scheduler
Shared task scheduling logic used by step_management_service.py (Steps 2-5)
and onboarding_completion_service.py (Step 6).
All scheduling is non-blocking -- step completion never fails on scheduling errors.
"""

import asyncio
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


def schedule_step2_tasks(user_id: str, db: Session, website_url: str):
    """Schedule background tasks after Step 2 (Website Analysis) completes.

    Creates DB-backed monitoring tasks + advertools intelligence.
    All errors are non-blocking (logged, not raised).
    """
    from models.website_analysis_monitoring_models import (
        OnboardingFullWebsiteAnalysisTask,
        SIFIndexingTask,
        MarketTrendsTask,
    )

    now = datetime.now(timezone.utc)
    next_execution = now + timedelta(minutes=5)

    # 1. Full-site SEO audit
    try:
        _upsert_task(
            db, OnboardingFullWebsiteAnalysisTask,
            user_id=user_id,
            filters={"user_id": user_id, "website_url": website_url},
            defaults={
                "status": "active",
                "next_execution": next_execution,
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
    try:
        _upsert_task(
            db, SIFIndexingTask,
            user_id=user_id,
            filters={"user_id": user_id, "website_url": website_url},
            defaults={
                "status": "active",
                "next_execution": next_execution,
                "frequency_hours": 48,
                "payload": {
                    "website_url": website_url,
                    "mode": "initial_indexing",
                    "created_from": "onboarding_step2",
                },
            },
        )
        db.commit()
        logger.info(f"[onboarding_step2] Scheduled SIF indexing for {website_url}")
        _record_task_in_session(db, user_id, "sif_indexing", step=2, details={"website_url": website_url})
    except Exception as e:
        db.rollback()
        logger.warning(f"[onboarding_step2] Non-blocking: failed to schedule SIF indexing: {e}")

    # 3. Market Trends
    try:
        _upsert_task(
            db, MarketTrendsTask,
            user_id=user_id,
            filters={"user_id": user_id, "website_url": website_url},
            defaults={
                "status": "active",
                "next_execution": next_execution,
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

    # 4. Website analysis monitoring (APScheduler one-shot, 5 min delay)
    try:
        from services.website_analysis_monitoring_service import schedule_website_analysis_task_creation
        schedule_website_analysis_task_creation(user_id=user_id, delay_minutes=5)
        logger.info(f"[onboarding_step2] Scheduled website analysis task creation for {user_id}")
    except Exception as e:
        logger.warning(f"[onboarding_step2] Non-blocking: failed to schedule website analysis: {e}")

    # 5. Advertools intelligence (content audit + site health)
    try:
        from models.advertools_monitoring_models import AdvertoolsTask

        audit = AdvertoolsTask(
            user_id=user_id,
            website_url=website_url,
            status="active",
            next_execution=next_execution,
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
            status="active",
            next_execution=next_execution + timedelta(days=1),
            frequency_days=7,
            payload={
                "type": "site_health",
                "website_url": website_url,
                "created_from": "onboarding_step2",
            },
        )
        db.add(health)
        db.commit()
        logger.info(f"[onboarding_step2] Scheduled Advertools tasks for {website_url}")
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

    # 2. Facebook persona
    try:
        from services.persona.facebook.facebook_persona_scheduler import schedule_facebook_persona_generation
        schedule_facebook_persona_generation(user_id, delay_minutes=10)
        logger.info(f"[onboarding_step4] Scheduled Facebook persona generation for {user_id}")
        if db:
            _record_task_in_session(db, user_id, "facebook_persona", step=4)
    except Exception as e:
        logger.warning(f"[onboarding_step4] Non-blocking: failed to schedule Facebook persona: {e}")


async def _immediate_sif_index(user_id: str, website_url: str):
    """Fire SIFIntegrationService.sync_user_website_content() right now.

    Best-effort immediate indexing — if it fails, the scheduler's
    SIFIndexingTask (created by schedule_step2_tasks) still picks it up later.
    """
    from services.intelligence.sif_integration import SIFIntegrationService
    try:
        sif = SIFIntegrationService(user_id)
        await sif.sync_user_website_content(website_url)
        logger.success(f"[SIF] Immediate indexing done for {website_url}")
    except Exception:
        logger.warning(f"[SIF] Immediate indexing failed — scheduler still has it")


def schedule_step5_tasks(user_id: str, db: Session):
    """Schedule background tasks after Step 5 (Integrations) completes.

    Creates OAuth monitoring tasks if integrations present.
    All errors are non-blocking (logged, not raised).
    """
    try:
        from services.oauth_token_monitoring_service import create_oauth_monitoring_tasks
        monitoring_tasks = create_oauth_monitoring_tasks(user_id, db)
        if monitoring_tasks:
            logger.info(f"[onboarding_step5] Created {len(monitoring_tasks)} OAuth monitoring tasks for {user_id}")
            for task in monitoring_tasks:
                _record_task_in_session(db, user_id, "oauth_monitoring", step=5, details={
                    "platform": getattr(task, "platform", "unknown"),
                })
        else:
            logger.info(f"[onboarding_step5] No OAuth monitoring tasks created for {user_id}")
    except Exception as e:
        logger.warning(f"[onboarding_step5] Non-blocking: failed to create OAuth monitoring tasks: {e}")
