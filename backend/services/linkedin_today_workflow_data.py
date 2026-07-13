"""
LinkedIn Today's Workflow — Data & LLM Layer
=============================================

Module-level async functions for fetching LinkedIn data and calling the LLM.
No class dependency — all functions take ``user_id`` as first parameter.
"""

import hashlib
import json
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from loguru import logger

from models.daily_workflow_models import TaskHistory
from services.database import get_session_for_user
from services.llm_providers.main_text_generation import llm_text_gen


# ── Constants ─────────────────────────────────────────────────────────────────

LINKEDIN_PILLAR_IDS = (
    "plan", "create", "publish", "analysis", "engagement", "remarket",
)

LINKEDIN_PILLAR_LABELS = {
    "plan": "Plan",
    "create": "Create",
    "publish": "Publish",
    "analysis": "Analysis",
    "engagement": "Engagement",
    "remarket": "Remarket",
}

LINKEDIN_PILLAR_ACTION_URLS = {
    "plan": "/linkedin-writer?wedge=plan",
    "create": "/linkedin-writer?wedge=create",
    "publish": "/linkedin-writer?wedge=publish",
    "analysis": "/linkedin-writer?wedge=analysis",
    "engagement": "/linkedin-writer?wedge=engagement",
    "remarket": "/linkedin-writer?wedge=remarket",
}

MAX_TASKS_PER_PILLAR = 2
GLOBAL_MAX_TASKS = 10
WORKFLOW_TYPE = "linkedin"

# ── Generation progress store (in-memory, keyed by "user_id:date") ──────────
_generation_progress: Dict[str, Dict[str, Any]] = {}

def set_generation_progress(user_id: str, date: str, message: str) -> None:
    key = f"{user_id}:{date}"
    _generation_progress[key] = {"message": message, "updated_at": time.time()}

def get_generation_progress(user_id: str, date: str) -> Optional[str]:
    entry = _generation_progress.get(f"{user_id}:{date}")
    return entry["message"] if entry else None

def clear_generation_progress(user_id: str, date: str) -> None:
    _generation_progress.pop(f"{user_id}:{date}", None)

PILLAR_PRIORITY_ORDER = [
    "analysis",
    "engagement",
    "plan",
    "create",
    "publish",
    "remarket",
]

_SYSTEM_PROMPT = """You are a LinkedIn productivity strategist. Based on the user's current data, suggest up to {max_tasks} tasks for TODAY only.

Rules:
- Titles must be under 60 characters, action-oriented, specific
- Descriptions under 200 characters — explain WHY this task matters today
- Priority: high = immediate visibility/engagement impact, medium = should do today, low = nice to have
- estimated_time in minutes (5-60), be realistic
- Assign each task an roi_score (0-100, where 100 = highest potential impact on LinkedIn growth) and an impact_label (one of: "High ROI", "Medium ROI", "Low ROI"). Base the score on how directly the task advances the user's stated goals.
- Return ONLY a JSON object with a "tasks" key containing an array — no markdown, no explanation
- Return {{"tasks": []}} if no task is valuable enough for today
"""

TASK_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "tasks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "priority": {"type": "string"},
                    "estimatedTime": {"type": "number"},
                    "tool_action": {"type": "string"},
                    "roi_score": {"type": "number"},
                    "impact_label": {"type": "string"},
                },
                "required": ["title"],
            },
        },
    },
    "required": ["tasks"],
}


def today_date_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def check_has_linkedin_account(user_id: str) -> bool:
    """Return True if the user has onboarded LinkedIn as a connected platform."""
    from models.onboarding import OnboardingSession, PlatformIntegration

    db = get_session_for_user(user_id)
    if db is None:
        return False
    try:
        platform_row = (
            db.query(PlatformIntegration)
            .join(
                OnboardingSession,
                PlatformIntegration.session_id == OnboardingSession.id,
            )
            .filter(OnboardingSession.user_id == user_id)
            .first()
        )
        if platform_row and platform_row.connected_platforms:
            return "linkedin" in platform_row.connected_platforms
        return False
    except Exception:
        return False
    finally:
        db.close()


# ── LLM infra ─────────────────────────────────────────────────────────────────

async def call_llm_for_tasks(
    user_id: str,
    pillar_data: str,
    max_tasks: int,
    pillar_id: str,
    system_prompt: Optional[str] = None,
    common_context: Optional[str] = None,
    cross_pillar_context: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Call LLM to generate task suggestions from contextual data.

    Args:
        user_id: Clerk user ID.
        pillar_data: Context/instructions specific to this pillar.
        max_tasks: Maximum number of tasks to return.
        pillar_id: Pillar identifier (plan, create, publish, etc.).
        system_prompt: Optional per-pillar system prompt override.
                       Falls back to generic ``_SYSTEM_PROMPT`` if omitted.
        common_context: Optional personalisation context (goals, cadence, draft types)
                        prepended to the user prompt for all pillars.
        cross_pillar_context: Optional summary of tasks already assigned by earlier
                              pillars, so this pillar can complement rather than conflict.
    """
    if not pillar_data.strip():
        return []

    system_text = (system_prompt or _SYSTEM_PROMPT).format(max_tasks=max_tasks)
    user_prompt = ""
    if common_context:
        user_prompt += common_context + "\n\n"
    if cross_pillar_context:
        user_prompt += cross_pillar_context + "\n\n"
    user_prompt += (
        f"Pillar: {LINKEDIN_PILLAR_LABELS.get(pillar_id, pillar_id)}\n"
        f"Context data:\n{pillar_data}\n"
    )

    try:
        raw = llm_text_gen(
            prompt=user_prompt,
            system_prompt=system_text,
            user_id=user_id,
            temperature=0.3,
            max_tokens=1000,
            json_struct=TASK_JSON_SCHEMA,
            flow_type="linkedin_workflow_pillar",
        )
        result = json.loads(raw) if isinstance(raw, str) else raw
        # The schema wraps the array in {"tasks": [...]}
        tasks_list = result.get("tasks", []) if isinstance(result, dict) else []
        if not isinstance(tasks_list, list):
            return []

        validated = []
        for t in tasks_list:
            if not isinstance(t, dict) or not t.get("title"):
                continue
            t["pillarId"] = pillar_id
            t["actionUrl"] = LINKEDIN_PILLAR_ACTION_URLS.get(pillar_id)
            t["priority"] = (
                t["priority"]
                if t.get("priority") in ("high", "medium", "low")
                else "medium"
            )
            t["estimatedTime"] = max(5, min(120, int(t.get("estimatedTime", 15))))
            tool_action = t.pop("tool_action", None)
            roi_score = t.pop("roi_score", None)
            impact_label = t.pop("impact_label", None)
            meta: Dict[str, Any] = {}
            if tool_action and tool_action in ("brainstorm", "watchdog", "weekly_plan", "calendar"):
                meta["tool_action"] = tool_action
            if roi_score is not None:
                try:
                    meta["roi_score"] = max(0, min(100, int(roi_score)))
                except (ValueError, TypeError):
                    pass
            if impact_label and impact_label.strip() in ("High ROI", "Medium ROI", "Low ROI"):
                meta["impact_label"] = impact_label.strip()
            if meta:
                t["metadata"] = meta
            if is_task_redundant(user_id, pillar_id, t["title"]):
                continue
            validated.append(t)
            if len(validated) >= max_tasks:
                break

        return validated
    except Exception:
        logger.exception(
            "LLM task generation failed for pillar {} user {}",
            pillar_id, user_id,
        )
        return []


def is_task_redundant(user_id: str, pillar_id: str, title: str) -> bool:
    """Check if a similar task was completed/dismissed in the last 7 days."""
    try:
        task_hash = hashlib.sha256(
            f"{pillar_id}:{title.strip().lower()}".encode()
        ).hexdigest()
        db = get_session_for_user(user_id)
        if db is None:
            return False
        try:
            recent = (
                db.query(TaskHistory)
                .filter(
                    TaskHistory.user_id == user_id,
                    TaskHistory.task_hash == task_hash,
                    TaskHistory.created_at
                    >= datetime.utcnow() - timedelta(days=7),
                )
                .first()
            )
            return recent is not None
        finally:
            db.close()
    except Exception:
        return False


# ── Data-fetch helpers ────────────────────────────────────────────────────────

async def fetch_watchdog_updates(user_id: str, limit: int = 5) -> List[Dict[str, Any]]:
    try:
        from services.linkedin.watchdog_service import watchdog_service
        updates = watchdog_service.get_updates(user_id)
        if not updates:
            return []
        return [
            {"title": u.title, "category": u.category, "summary": u.summary}
            for u in updates[:limit]
        ]
    except Exception:
        logger.debug("Watchdog unavailable for user {}", user_id)
        return []


async def fetch_brainstorm_ideas(user_id: str, limit: int = 3) -> List[Dict[str, Any]]:
    try:
        from services.brainstorm.personalized_service import gather_personalization_data
        data = await gather_personalization_data(
            user_id,
            include_trending=False,
            remarket_content=False,
            use_persona=False,
        )
        saved = data.get("saved_ideas", [])
        if not saved:
            return []
        return [
            {"prompt": s.get("prompt", ""), "rationale": s.get("rationale", "")}
            for s in saved[:limit]
        ]
    except Exception:
        logger.debug("Brainstorm ideas unavailable for user {}", user_id)
        return []


async def fetch_content_gaps(user_id: str, limit: int = 3) -> List[Dict[str, Any]]:
    try:
        from services.linkedin.growth.content_gap_service import ContentGapService
        svc = ContentGapService()
        result = await svc.analyze(user_id)
        if not result or not result.gaps:
            return []
        return [
            {"topic": g.gap_topic, "why": g.why_gap, "angle": g.suggested_angle}
            for g in result.gaps[:limit]
        ]
    except Exception:
        logger.debug("Content gaps unavailable for user {}", user_id)
        return []


async def fetch_trending_topics(user_id: str, limit: int = 3) -> List[Dict[str, Any]]:
    try:
        from services.linkedin.growth.consolidated_growth_service import (
            ConsolidatedGrowthService,
        )
        svc = ConsolidatedGrowthService()
        result = await svc.analyze_all(user_id)
        if not result or not result.trending or not result.trending.trending_topics:
            return []
        return [
            {
                "topic": t.topic,
                "why_now": t.why_now,
                "hook": t.suggested_hook,
                "confidence": t.confidence,
            }
            for t in result.trending.trending_topics[:limit]
        ]
    except Exception:
        logger.debug("Trending topics unavailable for user {}", user_id)
        return []


async def fetch_brand_scorecard(user_id: str) -> Optional[Dict[str, Any]]:
    try:
        from services.linkedin.growth.brand_scorecard_service import (
            BrandScorecardService,
        )
        svc = BrandScorecardService()
        result = await svc.score(user_id)
        if not result:
            return None
        return {
            "overall_score": result.overall_score,
            "dimensions": [
                {"name": d.dimension, "score": d.score, "feedback": d.feedback}
                for d in (result.dimensions or [])
            ],
            "top_recommendation": result.top_recommendation,
            "generated_at": result.generated_at.isoformat() if result.generated_at else None,
        }
    except Exception:
        logger.debug("Brand scorecard unavailable for user {}", user_id)
        return None


async def fetch_top_posts(user_id: str, limit: int = 3) -> List[Dict[str, Any]]:
    from starlette.concurrency import run_in_threadpool

    def _query():
        db = get_session_for_user(user_id)
        if db is None:
            return []
        try:
            from services.linkedin_post_analytics_service import (
                LinkedInPostAnalyticsService,
            )
            svc = LinkedInPostAnalyticsService(db)
            result = svc.get_stored_analytics(user_id)
            if not result or not result.posts:
                return []
            sorted_posts = sorted(
                result.posts,
                key=lambda p: (
                    p.engagement.engagement_rate if p.engagement else 0
                ),
                reverse=True,
            )
            return [
                {
                    "text": p.text[:100],
                    "engagement_rate": p.engagement.engagement_rate
                    if p.engagement
                    else 0,
                    "reactions": p.engagement.reactions if p.engagement else 0,
                    "comments": p.engagement.comments if p.engagement else 0,
                    "created_at": p.created_at.isoformat() if p.created_at else None,
                }
                for p in sorted_posts[:limit]
            ]
        finally:
            db.close()

    return await run_in_threadpool(_query)


async def fetch_bottom_posts(user_id: str, limit: int = 1) -> List[Dict[str, Any]]:
    from starlette.concurrency import run_in_threadpool

    def _query():
        db = get_session_for_user(user_id)
        if db is None:
            return []
        try:
            from services.linkedin_post_analytics_service import (
                LinkedInPostAnalyticsService,
            )
            svc = LinkedInPostAnalyticsService(db)
            result = svc.get_stored_analytics(user_id)
            if not result or not result.posts:
                return []
            sorted_posts = sorted(
                result.posts,
                key=lambda p: (
                    p.engagement.engagement_rate if p.engagement else 0
                ),
            )
            return [
                {
                    "text": p.text[:100],
                    "engagement_rate": p.engagement.engagement_rate
                    if p.engagement
                    else 0,
                    "created_at": p.created_at.isoformat() if p.created_at else None,
                }
                for p in sorted_posts[:limit]
            ]
        finally:
            db.close()

    return await run_in_threadpool(_query)


async def fetch_engagement_opportunities(
    user_id: str, limit: int = 3
) -> List[Dict[str, Any]]:
    try:
        from services.linkedin.growth.engagement_service import EngagementService
        svc = EngagementService()
        result = await svc.get_engagement_opportunities(user_id)
        if not result or not result.opportunities:
            return []
        return [
            {
                "title": o.title,
                "author": o.author,
                "why_engage": o.why_engage,
            }
            for o in result.opportunities[:limit]
        ]
    except Exception:
        logger.debug("Engagement opportunities unavailable for user {}", user_id)
        return []


async def fetch_network_suggestions(
    user_id: str, limit: int = 2
) -> List[Dict[str, Any]]:
    try:
        from services.linkedin.growth.network_growth_service import (
            NetworkGrowthService,
        )
        svc = NetworkGrowthService()
        result = await svc.get_network_suggestions(user_id)
        if not result or not result.suggestions:
            return []
        return [
            {
                "name": s.name,
                "title": s.title,
                "company": s.company,
                "why_connect": s.why_connect,
            }
            for s in result.suggestions[:limit]
        ]
    except Exception:
        logger.debug("Network suggestions unavailable for user {}", user_id)
        return []


async def fetch_drafts(user_id: str) -> List[Dict[str, Any]]:
    from starlette.concurrency import run_in_threadpool

    def _query():
        db = get_session_for_user(user_id)
        if db is None:
            return []
        try:
            from models.content_asset_models import ContentAsset, AssetSource
            rows = (
                db.query(ContentAsset)
                .filter(
                    ContentAsset.user_id == user_id,
                    ContentAsset.source_module == AssetSource.LINKEDIN_WRITER,
                )
                .order_by(ContentAsset.created_at.desc())
                .limit(10)
                .all()
            )
            return [
                {
                    "title": r.title or "Untitled",
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                    "post_type": (r.asset_metadata or {}).get("post_type", "post"),
                }
                for r in rows
            ]
        except Exception:
            return []
        finally:
            db.close()

    return await run_in_threadpool(_query)


async def fetch_calendar_events(user_id: str, date: str) -> List[Dict[str, Any]]:
    from starlette.concurrency import run_in_threadpool

    def _query():
        db = get_session_for_user(user_id)
        if db is None:
            return []
        try:
            from models.content_planning import CalendarEvent, ContentStrategy
            events = (
                db.query(CalendarEvent)
                .join(
                    ContentStrategy,
                    CalendarEvent.strategy_id == ContentStrategy.id,
                )
                .filter(
                    ContentStrategy.user_id == user_id,
                    CalendarEvent.scheduled_date == date,
                    CalendarEvent.status.in_(["draft", "scheduled"]),
                    CalendarEvent.platform == "linkedin",
                )
                .all()
            )
            return [
                {
                    "title": e.title,
                    "content_type": e.content_type,
                    "status": e.status,
                }
                for e in events[:5]
            ]
        finally:
            db.close()

    return await run_in_threadpool(_query)


async def fetch_engagement_trends(user_id: str) -> Optional[Dict[str, Any]]:
    from starlette.concurrency import run_in_threadpool

    def _query():
        db = get_session_for_user(user_id)
        if db is None:
            return None
        try:
            from services.linkedin_post_analytics_service import (
                LinkedInPostAnalyticsService,
            )
            svc = LinkedInPostAnalyticsService(db)
            result = svc.get_engagement_trends(user_id)
            if not result or not result.summary:
                return None
            return {
                "direction": (
                    "up"
                    if result.summary.avg_engagement_rate_now
                    > result.summary.avg_engagement_rate_before
                    else "down"
                ),
                "avg_engagement_rate_before": result.summary.avg_engagement_rate_before,
                "avg_engagement_rate_now": result.summary.avg_engagement_rate_now,
                "total_posts": result.summary.total_posts,
            }
        finally:
            db.close()

    return await run_in_threadpool(_query)


async def fetch_persona(user_id: str) -> Dict[str, Any]:
    try:
        from services.persona_service import PersonaService
        svc = PersonaService()
        persona = svc.get_persona(user_id, platform="linkedin")
        if persona:
            return {
                "tone": persona.get("tone", ""),
                "topics": persona.get("topics", [])[:5],
                "style_notes": persona.get("style_notes", ""),
            }
        return {}
    except Exception:
        logger.debug("Persona data unavailable for user {}", user_id)
        return {}


# ── Phase 2: personalisation fetchers ─────────────────────────────────────────

async def fetch_user_linkedin_goals(user_id: str) -> List[str]:
    """Read LinkedIn goals from stored persona data, fall back to defaults."""
    try:
        from models.onboarding import OnboardingSession
        db = get_session_for_user(user_id)
        if db is None:
            return ["Engagement", "Thought Leadership"]
        try:
            session = (
                db.query(OnboardingSession)
                .filter(OnboardingSession.user_id == user_id)
                .order_by(OnboardingSession.started_at.desc())
                .first()
            )
            if session and session.persona_data and session.persona_data.platform_personas:
                linkedin = session.persona_data.platform_personas.get("linkedin", {})
                if isinstance(linkedin, dict):
                    goals = (
                        linkedin.get("goals")
                        or linkedin.get("objectives")
                        or []
                    )
                    if goals:
                        return goals if isinstance(goals, list) else [goals]
            return ["Engagement", "Thought Leadership"]
        finally:
            db.close()
    except Exception:
        logger.debug("LinkedIn goals unavailable for user {}", user_id)
        return ["Engagement", "Thought Leadership"]


async def fetch_posting_cadence(user_id: str) -> Dict[str, Any]:
    """Count LinkedIn posts in recent windows and recommend a cadence."""
    from starlette.concurrency import run_in_threadpool

    def _query():
        db = get_session_for_user(user_id)
        if db is None:
            return {
                "posts_last_7d": 0, "posts_last_14d": 0, "posts_last_30d": 0,
                "recommended_cadence": "3-4 per week",
            }
        try:
            from models.linkedin_post_analytics_model import LinkedInPostAnalytics
            now = datetime.utcnow()
            count_7 = db.query(LinkedInPostAnalytics).filter(
                LinkedInPostAnalytics.user_id == user_id,
                LinkedInPostAnalytics.created_at >= now - timedelta(days=7),
            ).count()
            count_14 = db.query(LinkedInPostAnalytics).filter(
                LinkedInPostAnalytics.user_id == user_id,
                LinkedInPostAnalytics.created_at >= now - timedelta(days=14),
            ).count()
            count_30 = db.query(LinkedInPostAnalytics).filter(
                LinkedInPostAnalytics.user_id == user_id,
                LinkedInPostAnalytics.created_at >= now - timedelta(days=30),
            ).count()

            weekly_rate = count_7 or (count_14 / 2 if count_14 else 0)
            if weekly_rate >= 4:
                recommended = "4-5 per week"
            elif weekly_rate >= 2:
                recommended = "3-4 per week"
            elif weekly_rate >= 1:
                recommended = "2-3 per week"
            else:
                recommended = "3-4 per week"

            return {
                "posts_last_7d": count_7,
                "posts_last_14d": count_14,
                "posts_last_30d": count_30,
                "recommended_cadence": recommended,
            }
        finally:
            db.close()

    return await run_in_threadpool(_query)


async def fetch_draft_type_counts(user_id: str) -> Dict[str, int]:
    """Count saved LinkedIn drafts grouped by content format."""
    from starlette.concurrency import run_in_threadpool

    def _query():
        db = get_session_for_user(user_id)
        if db is None:
            return {}
        try:
            from models.content_asset_models import ContentAsset, AssetSource
            rows = (
                db.query(ContentAsset)
                .filter(
                    ContentAsset.user_id == user_id,
                    ContentAsset.source_module == AssetSource.LINKEDIN_WRITER,
                )
                .all()
            )
            counts: Dict[str, int] = {}
            for r in rows:
                post_type = (r.asset_metadata or {}).get("post_type", "post")
                counts[post_type] = counts.get(post_type, 0) + 1
            return counts
        finally:
            db.close()

    return await run_in_threadpool(_query)


# ── Phase 3: cross-pillar awareness fetchers ───────────────────────────────────

async def fetch_recent_task_titles(user_id: str, limit: int = 5) -> List[str]:
    """Fetch titles of the user's most recent DailyWorkflowTask entries."""
    from starlette.concurrency import run_in_threadpool

    def _query():
        db = get_session_for_user(user_id)
        if db is None:
            return []
        try:
            from models.daily_workflow_models import DailyWorkflowTask
            rows = (
                db.query(DailyWorkflowTask)
                .filter(DailyWorkflowTask.user_id == user_id)
                .order_by(DailyWorkflowTask.created_at.desc())
                .limit(limit)
                .all()
            )
            return [r.title for r in rows if r.title]
        finally:
            db.close()

    return await run_in_threadpool(_query)


async def fetch_upcoming_events(user_id: str, days_ahead: int = 3) -> List[Dict[str, Any]]:
    """Fetch calendar events scheduled in the next N days for LinkedIn."""
    from starlette.concurrency import run_in_threadpool

    def _query():
        db = get_session_for_user(user_id)
        if db is None:
            return []
        try:
            from models.content_planning import CalendarEvent, ContentStrategy
            now = datetime.utcnow()
            horizon = now + timedelta(days=days_ahead)
            rows = (
                db.query(CalendarEvent)
                .join(
                    ContentStrategy,
                    CalendarEvent.strategy_id == ContentStrategy.id,
                )
                .filter(
                    ContentStrategy.user_id == user_id,
                    CalendarEvent.platform == "linkedin",
                    CalendarEvent.scheduled_date >= now,
                    CalendarEvent.scheduled_date <= horizon,
                    CalendarEvent.status.in_(["draft", "scheduled"]),
                )
                .order_by(CalendarEvent.scheduled_date.asc())
                .limit(5)
                .all()
            )
            return [
                {
                    "title": e.title,
                    "content_type": e.content_type,
                    "scheduled_date": e.scheduled_date.isoformat() if e.scheduled_date else None,
                    "status": e.status,
                }
                for e in rows
            ]
        finally:
            db.close()

    return await run_in_threadpool(_query)
