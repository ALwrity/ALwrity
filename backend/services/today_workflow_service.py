import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy import func as sql_func
from sqlalchemy.orm import Session

from models.daily_workflow_models import DailyWorkflowPlan, DailyWorkflowTask
from models.agent_activity_models import AgentAlert
from models.content_planning import CalendarEvent, ContentStrategy
from services.agent_activity_service import AgentActivityService, build_agent_event_payload
from services.llm_providers.main_text_generation import llm_text_gen
from services.database import get_session_for_user
from loguru import logger


_DEFAULT_PILLAR_IDS = ("plan", "generate", "publish", "analyze", "engage", "remarket")
_DEFAULT_PLAN_CONTEXT_THRESHOLD = 0.65


def _load_pillar_ids() -> List[str]:
    """Load the configured pillar ids, falling back to the
    built-in defaults. Override with the
    ``ALWRITY_PILLAR_IDS`` environment variable as a
    comma-separated list.
    """
    raw = os.getenv("ALWRITY_PILLAR_IDS", "").strip()
    if not raw:
        return list(_DEFAULT_PILLAR_IDS)
    parsed = [p.strip().lower() for p in raw.split(",") if p.strip()]
    if not parsed:
        logger.warning(
            "ALWRITY_PILLAR_IDS env var is set but parses to empty list; "
            "falling back to defaults"
        )
        return list(_DEFAULT_PILLAR_IDS)
    logger.info(f"Loaded {len(parsed)} pillar ids from ALWRITY_PILLAR_IDS env var")
    return parsed


def _load_plan_context_threshold() -> float:
    """Load the configured plan contextuality threshold (0.0-1.0).
    Override with the ``ALWRITY_PLAN_CONTEXT_THRESHOLD`` env var.
    """
    raw = os.getenv("ALWRITY_PLAN_CONTEXT_THRESHOLD", "").strip()
    if not raw:
        return _DEFAULT_PLAN_CONTEXT_THRESHOLD
    try:
        value = float(raw)
    except ValueError:
        logger.warning(
            f"ALWRITY_PLAN_CONTEXT_THRESHOLD={raw!r} is not a valid float; "
            f"falling back to default {_DEFAULT_PLAN_CONTEXT_THRESHOLD}"
        )
        return _DEFAULT_PLAN_CONTEXT_THRESHOLD
    if not 0.0 <= value <= 1.0:
        logger.warning(
            f"ALWRITY_PLAN_CONTEXT_THRESHOLD={value} is outside [0.0, 1.0]; "
            f"falling back to default {_DEFAULT_PLAN_CONTEXT_THRESHOLD}"
        )
        return _DEFAULT_PLAN_CONTEXT_THRESHOLD
    return value


PILLAR_IDS = _load_pillar_ids()
MIN_TASK_EVIDENCE_LINKS = 1
PLAN_CONTEXT_THRESHOLD = _load_plan_context_threshold()

# Calendar → Workflow mapping
CALENDAR_CONTENT_PILLAR = "generate"

_PLATFORM_ACTION_URL = {
    "linkedin": "/linkedin-writer",
    "facebook": "/facebook-writer",
    "twitter": "/twitter-writer",
    "instagram": "/instagram-writer",
    "youtube": "/youtube-writer",
    "tiktok": "/tiktok-writer",
}

_CONTENT_ACTION_URL = {
    "blog_post": "/blog-writer",
    "linkedin_post": "/linkedin-writer",
    "facebook_post": "/facebook-writer",
    "seo_page": "/seo-dashboard",
    "video": "/video-writer",
}

_CONTENT_ESTIMATED_TIME = {
    "blog_post": 45, "linkedin_post": 20, "facebook_post": 15,
    "twitter_post": 10, "instagram_post": 15, "seo_page": 30, "video": 60,
}

# Generic fallback URL for any calendar event whose content_type / platform
# does not match a known writer. Prevents the event from being silently
# dropped from the daily plan.
_GENERIC_FALLBACK_ACTION_URL = "/content-planning"


def _resolve_calendar_action_url(content_type: str, platform: str) -> str:
    platform_lower = (platform or "").strip().lower()
    if platform_lower in _PLATFORM_ACTION_URL:
        return _PLATFORM_ACTION_URL[platform_lower]
    ct_lower = (content_type or "").strip().lower()
    if ct_lower in _CONTENT_ACTION_URL:
        return _CONTENT_ACTION_URL[ct_lower]
    logger.warning(
        "No action_url mapping for calendar event content_type={!r} platform={!r} — falling back to {}",
        content_type, platform, _GENERIC_FALLBACK_ACTION_URL,
    )
    return _GENERIC_FALLBACK_ACTION_URL


def _resolve_calendar_estimated_time(content_type: str) -> int:
    return _CONTENT_ESTIMATED_TIME.get((content_type or "").strip().lower(), 30)


def _generate_calendar_event_plan(date: str, grounding: Dict[str, Any]) -> Dict[str, Any]:
    calendar_events = grounding.get("calendar_events_today", [])
    if not calendar_events:
        return {"date": date, "tasks": []}

    tasks = []
    for event in calendar_events:
        action_url = _resolve_calendar_action_url(
            event.get("content_type", ""), event.get("platform", "")
        )

        task = {
            "pillarId": CALENDAR_CONTENT_PILLAR,
            "title": (event.get("title") or "Untitled").strip()[:255],
            "description": (event.get("description") or "").strip(),
            "priority": "high",
            "estimatedTime": _resolve_calendar_estimated_time(event.get("content_type", "")),
            "actionType": "navigate",
            "actionUrl": action_url,
            "enabled": True,
            "dependencies": [],
            "metadata": {
                "source": "calendar_event",
                "source_event_id": event.get("id"),
                "calendar_title": event.get("title"),
                "content_type": event.get("content_type"),
                "platform": event.get("platform"),
            },
        }
        tasks.append(task)

    return {"date": date, "tasks": tasks}


def _today_date_str() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _coerce_priority(value: Any) -> str:
    v = str(value or "medium").lower().strip()
    if v in {"high", "medium", "low"}:
        return v
    logger.warning(
        f"Coercing invalid priority value {value!r} -> 'medium' "
        f"(SIF-3 Issue #623 #16: expected one of high|medium|low)"
    )
    return "medium"


def _coerce_status(value: Any) -> str:
    v = str(value or "pending").lower().strip()
    if v in {"pending", "in_progress", "completed", "skipped", "dismissed"}:
        return "skipped" if v == "dismissed" else v
    return "pending"


def _proposal_priority_rank(priority: str) -> int:
    return {"low": 0, "medium": 1, "high": 2}.get(str(priority or "").lower(), 1)


def _proposal_order_key(proposal: Any) -> tuple:
    return (
        str(getattr(proposal, "source_agent", "") or "").lower(),
        str(getattr(proposal, "title", "") or "").lower(),
        str(getattr(proposal, "description", "") or "").lower(),
        str(getattr(proposal, "action_url", "") or "").lower(),
    )



def _is_coverage_guardrail_enabled(grounding: Dict[str, Any]) -> bool:
    workflow_config = grounding.get("workflow_config", {}) if isinstance(grounding, dict) else {}
    if not isinstance(workflow_config, dict):
        return True
    if workflow_config.get("disable_pillar_coverage_guardrail") is True:
        return False
    if workflow_config.get("enforce_pillar_coverage") is False:
        return False
    return True


def _sanitize_task(task: Dict[str, Any], agent_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
    if not isinstance(task, dict):
        return None

    pillar_id = str(task.get("pillarId") or "").lower().strip()
    title = str(task.get("title") or "").strip()
    if pillar_id not in PILLAR_IDS or not title:
        reason = "empty title" if not title else f"invalid pillar_id={pillar_id!r}"
        logger.warning(f"Rejected task from agent {agent_name or 'unknown'}: {reason}")
        return None

    sanitized = dict(task)
    sanitized["pillarId"] = pillar_id
    sanitized["title"] = title
    sanitized["description"] = str(task.get("description") or "").strip()
    sanitized["priority"] = _coerce_priority(task.get("priority"))
    sanitized["estimatedTime"] = max(5, int(task.get("estimatedTime") or 15))
    sanitized["actionType"] = str(task.get("actionType") or "navigate").strip() or "navigate"
    sanitized["actionUrl"] = str(task.get("actionUrl") or "").strip() or None
    sanitized["enabled"] = bool(task.get("enabled", True))
    return sanitized


def _derive_onboarding_evidence_links(onboarding_data: Dict[str, Any], limit: int = 2) -> List[str]:
    if not isinstance(onboarding_data, dict):
        return []

    links: List[str] = []
    for key, value in onboarding_data.items():
        if key == "workflow_config":
            continue
        if value in (None, "", [], {}):
            continue
        links.append(f"onboarding:{key}")
        if len(links) >= limit:
            break
    return links


def _valid_evidence_links(evidence_links: Any, grounding: Dict[str, Any]) -> List[str]:
    if not isinstance(evidence_links, list):
        return []

    onboarding_data = grounding.get("onboarding_data", {}) if isinstance(grounding, dict) else {}
    if not isinstance(onboarding_data, dict):
        onboarding_data = {}
    valid_onboarding_keys = {str(k) for k in onboarding_data.keys()}

    recent_alerts = grounding.get("recent_agent_alerts", []) if isinstance(grounding, dict) else []
    valid_alert_ids = {
        str(a.get("alert_id"))
        for a in recent_alerts
        if isinstance(a, dict) and a.get("alert_id") is not None
    }

    valid_links: List[str] = []
    for raw in evidence_links:
        link = str(raw or "").strip()
        if not link:
            continue

        if link.startswith("onboarding:"):
            key = link.split(":", 1)[1].strip()
            if key and key in valid_onboarding_keys:
                valid_links.append(link)
        elif link.startswith("alert:"):
            alert_id = link.split(":", 1)[1].strip()
            if alert_id and alert_id in valid_alert_ids:
                valid_links.append(link)

    return valid_links


def validate_plan_contextuality(plan: Dict[str, Any], grounding: Dict[str, Any]) -> Dict[str, Any]:
    tasks = plan.get("tasks") if isinstance(plan, dict) else None
    if not isinstance(tasks, list) or not tasks:
        return {
            "score": 0.0,
            "threshold": PLAN_CONTEXT_THRESHOLD,
            "is_contextual": False,
            "task_scores": [],
            "tasks_below_min_evidence": 0,
            "min_evidence_links": MIN_TASK_EVIDENCE_LINKS,
        }

    task_scores = []
    below_min_evidence = 0

    for idx, task in enumerate(tasks):
        metadata = task.get("metadata") if isinstance(task, dict) else {}
        metadata = metadata if isinstance(metadata, dict) else {}
        evidence_links = _valid_evidence_links(metadata.get("evidence_links"), grounding)
        has_min_evidence = len(evidence_links) >= MIN_TASK_EVIDENCE_LINKS
        if not has_min_evidence:
            below_min_evidence += 1

        reasoning_text = str(metadata.get("reasoning") or task.get("description") or "").lower()
        onboarding_hits = sum(1 for l in evidence_links if l.startswith("onboarding:"))
        alert_hits = sum(1 for l in evidence_links if l.startswith("alert:"))

        score = 0.0
        if has_min_evidence:
            score += 0.6
        if onboarding_hits > 0:
            score += 0.2
        if alert_hits > 0:
            score += 0.2
        elif "alert" in reasoning_text:
            score += 0.1

        task_scores.append(
            {
                "task_index": idx,
                "pillarId": task.get("pillarId"),
                "title": task.get("title"),
                "score": min(score, 1.0),
                "evidence_links": evidence_links,
                "has_min_evidence": has_min_evidence,
            }
        )

    plan_score = sum(t["score"] for t in task_scores) / len(task_scores)
    is_contextual = plan_score >= PLAN_CONTEXT_THRESHOLD and below_min_evidence == 0
    return {
        "score": round(plan_score, 3),
        "threshold": PLAN_CONTEXT_THRESHOLD,
        "is_contextual": is_contextual,
        "task_scores": task_scores,
        "tasks_below_min_evidence": below_min_evidence,
        "min_evidence_links": MIN_TASK_EVIDENCE_LINKS,
    }


def _build_single_task_for_missing_pillar(
    user_id: str,
    date: str,
    pillar_id: str,
    grounding: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    schema = {
        "type": "object",
        "properties": {
            "pillarId": {"type": "string"},
            "title": {"type": "string"},
            "description": {"type": "string"},
            "priority": {"type": "string"},
            "estimatedTime": {"type": "number"},
            "actionType": {"type": "string"},
            "actionUrl": {"type": "string"},
            "enabled": {"type": "boolean"},
            "metadata": {"type": "object"},
        },
        "required": ["pillarId", "title", "description", "priority", "estimatedTime", "actionType", "enabled"],
    }
    prompt = (
        "Generate exactly one actionable JSON task for today's workflow.\n"
        f"Date: {date}\n"
        f"Required pillarId: {pillar_id}\n"
        "Constraints:\n"
        "- Return a single JSON object only.\n"
        "- Keep title concise and practical.\n"
        "- Task must be completable today.\n"
        "- Use actionType='navigate' and a valid ALwrity route when possible.\n"
        f"User context: {json.dumps(grounding.get('onboarding_data', {}), indent=2)}\n"
    )
    try:
        raw = llm_text_gen(prompt=prompt, json_struct=schema, user_id=user_id)
        candidate = raw if isinstance(raw, dict) else json.loads(raw)
    except Exception as e:
        logger.warning(f"Failed to generate pillar backfill task for {pillar_id}: {e}")
        return None

    candidate = _sanitize_task(candidate)
    if candidate:
        candidate["pillarId"] = pillar_id
        metadata = candidate.get("metadata") if isinstance(candidate.get("metadata"), dict) else {}
        metadata["source"] = "llm_pillar_backfill"
        candidate["metadata"] = metadata
    return candidate


def _ensure_pillar_coverage(
    tasks: List[Dict[str, Any]],
    user_id: str,
    date: str,
    grounding: Dict[str, Any],
) -> List[Dict[str, Any]]:
    sanitized_tasks = [t for t in (_sanitize_task(task) for task in tasks) if t]
    if not _is_coverage_guardrail_enabled(grounding):
        return sanitized_tasks

    covered_pillars = {task["pillarId"] for task in sanitized_tasks}

    for pillar_id in PILLAR_IDS:
        if pillar_id in covered_pillars:
            continue

        generated = _build_single_task_for_missing_pillar(user_id, date, pillar_id, grounding)
        if generated:
            sanitized_tasks.append(generated)
            covered_pillars.add(pillar_id)

    return sanitized_tasks


def build_grounding_context(db: Session, user_id: str, date: str) -> Dict[str, Any]:
    # 1. Fetch unread alerts
    unread_agent_alerts = (
        db.query(AgentAlert)
        .filter(AgentAlert.user_id == user_id, AgentAlert.read_at.is_(None))
        .order_by(AgentAlert.created_at.desc())
        .limit(10)
        .all()
    )

    # 2. Fetch comprehensive onboarding data (SIF)
    onboarding_context = {}
    try:
        from api.content_planning.services.content_strategy.onboarding.data_integration import OnboardingDataIntegrationService

        svc = OnboardingDataIntegrationService()
        integrated = svc.get_integrated_data_sync(user_id, db) or {}

        # Populate key sections
        onboarding_context = integrated
    except Exception as e:
        logger.warning(f"Failed to load full onboarding data for context: {e}")

    # Ensure workflow_config exists
    if "workflow_config" not in onboarding_context:
        onboarding_context["workflow_config"] = {}

    # 3. Fetch calendar events for today
    calendar_events_today = []
    try:
        # Compare on the date portion via SQL func.date() to sidestep the
        # naive-vs-aware TypeError risk. CalendarEvent.scheduled_date may be
        # either depending on how it was written (datetime.utcnow() vs
        # datetime.now(timezone.utc)), and SQL-level date comparison is
        # unambiguous regardless of the stored timezone.
        calendar_events_today = (
            db.query(CalendarEvent)
            .join(ContentStrategy, CalendarEvent.strategy_id == ContentStrategy.id)
            .filter(
                ContentStrategy.user_id == user_id,
                sql_func.date(CalendarEvent.scheduled_date) == date,
                CalendarEvent.status.in_(["draft", "scheduled"]),
            )
            .all()
        )
    except Exception as e:
        logger.warning(f"Failed to fetch calendar events for grounding context: {e}")

    return {
        "recent_agent_alerts": [
            {
                "alert_id": a.id,
                "title": a.title,
                "message": a.message,
                "created_at": a.created_at.isoformat(),
                "alert_type": a.alert_type,
            }
            for a in unread_agent_alerts
        ],
        "onboarding_data": onboarding_context,
        "workflow_config": onboarding_context.get("workflow_config", {}),
        "calendar_events_today": [
            {
                "id": event.id,
                "title": event.title,
                "description": event.description,
                "content_type": event.content_type,
                "platform": event.platform,
                "status": event.status,
                "scheduled_date": event.scheduled_date.isoformat() if event.scheduled_date else None,
            }
            for event in calendar_events_today
        ],
    }


import asyncio
from services.intelligence.agents.agent_orchestrator import AgentOrchestrationService
from services.task_memory_service import TaskMemoryService

# Initialize orchestration service (singleton) with resilient fallback.
# If the constructor fails (e.g., missing AI provider config, import error in
# a transitive dependency), we leave the module usable by setting the singleton
# to None. The agent committee will be skipped, and only the LLM fallback path
# will produce tasks. This prevents a transient init failure from taking down
# the entire scheduler import chain.
try:
    orchestration_service = AgentOrchestrationService()
except Exception as _orch_init_err:
    logger.error(
        f"AgentOrchestrationService init failed at module load; "
        f"agent committee will be disabled: {_orch_init_err}"
    )
    orchestration_service = None

async def generate_agent_enhanced_plan(
    db: Session,
    user_id: str,
    date: str,
    grounding: Optional[Dict[str, Any]] = None,
    strict_contextuality: bool = False,
) -> Dict[str, Any]:
    activity = AgentActivityService(db, user_id)
    grounding = grounding or build_grounding_context(db, user_id, date)
    memory_service = TaskMemoryService(user_id, db)

    # 1. Get Orchestrator
    if orchestration_service is None:
        logger.warning(
            f"OrchestrationService unavailable for user {user_id}; "
            f"agent committee disabled, falling back to LLM path"
        )
        return {"date": date, "tasks": []}
    try:
        orchestrator = await orchestration_service.get_or_create_orchestrator(user_id)
    except Exception as e:
        logger.error(f"Failed to get orchestrator: {e}")
        return {"date": date, "tasks": []}

    # 2. Parallel "Committee" Proposal Gathering
    logger.info(f"Gathering daily task proposals from agent committee for user {user_id}")
    
    agent_tasks = []
    try:
        # Define agents to poll
        agents_to_poll = [
            orchestrator.agents.get('content'),      # ContentStrategyAgent
            orchestrator.agents.get('strategy'),     # StrategyArchitectAgent
            orchestrator.agents.get('seo'),          # SEOOptimizationAgent
            orchestrator.agents.get('social'),       # SocialAmplificationAgent
            orchestrator.agents.get('competitor'),   # CompetitorResponseAgent
            orchestrator.agents.get('content_gap_radar'),  # ContentGapRadarAgent
        ]
        
        # Filter out None agents (disabled/failed init)
        active_agents = [a for a in agents_to_poll if a]
        
        # Execute propose_daily_tasks in parallel
        results = await asyncio.gather(
            *[a.propose_daily_tasks(grounding) for a in active_agents],
            return_exceptions=True
        )
        
        # Collect successful proposals
        raw_proposals = []
        for res in results:
            if isinstance(res, list):
                raw_proposals.extend(res)
            elif isinstance(res, Exception):
                logger.warning(f"Agent proposal failed: {res}")

        # 3. Filter Redundant Proposals (Self-Learning)
        # Note: We need to ensure we don't filter out essential recurring tasks if they were completed long ago
        # But for now, we filter exact duplicates from recent history (last 7 days)
        # We can implement semantic filtering later
        
        # Simple deduplication based on title+pillar
        unique_map = {}
        for p in raw_proposals:
            key = f"{p.pillar_id}:{p.title}"
            if key not in unique_map:
                unique_map[key] = p
                continue

            existing = unique_map[key]
            if _proposal_priority_rank(p.priority) > _proposal_priority_rank(existing.priority):
                unique_map[key] = p
                continue

            # Deterministic tie-breaker for equal priority proposals.
            if (
                _proposal_priority_rank(p.priority) == _proposal_priority_rank(existing.priority)
                and _proposal_order_key(p) < _proposal_order_key(existing)
            ):
                unique_map[key] = p
                
        agent_tasks = list(unique_map.values())
        
        # Phase 3: Check memory for rejections (Semantic Filter)
        agent_tasks = await memory_service.filter_redundant_proposals(agent_tasks)

        # Log committee meeting event for frontend transparency
        try:
            accepted_ids = {f"{p.pillar_id}:{p.title}" for p in agent_tasks}
            proposals_log = []
            for p in raw_proposals:
                valid = p.pillar_id in PILLAR_IDS
                key = f"{p.pillar_id}:{p.title}"
                proposals_log.append({
                    "agent": p.source_agent,
                    "title": p.title,
                    "pillar_id": p.pillar_id,
                    "priority": p.priority,
                    "valid": valid,
                    "accepted": key in accepted_ids,
                    "rejected_reason": None if valid else f"pillar_id '{p.pillar_id}' not in {PILLAR_IDS}",
                    "reasoning": p.reasoning,
                    "estimated_time": p.estimated_time,
                    "action_type": p.action_type,
                })
                if not valid:
                    logger.warning(
                        f"Rejected proposal from agent {p.source_agent}: "
                        f"invalid pillar_id={p.pillar_id!r} (title={p.title!r}). "
                        f"Must be one of {PILLAR_IDS}"
                    )
            activity.log_event(
                event_type="committee_meeting",
                message=f"Committee: {len(agent_tasks)}/{len(raw_proposals)} tasks accepted from {len(active_agents)} agents",
                payload={
                    "agents_polled": len(active_agents),
                    "total_proposals": len(raw_proposals),
                    "accepted_count": len(agent_tasks),
                    "rejected_count": len(raw_proposals) - len(agent_tasks),
                    "proposals": proposals_log,
                },
            )
        except Exception as e:
            logger.warning(f"Failed to log committee meeting event: {e}")

        # --- Committee Watchdog Audit (ContentGuardianAgent) ---
        try:
            guardian_agent = orchestrator.agents.get('guardian')
            if guardian_agent and hasattr(guardian_agent, 'audit_committee'):
                # Build proposals list from committee data (same format as proposals_log above)
                accepted_ids = {f"{p.pillar_id}:{p.title}" for p in agent_tasks}
                audit_input = []
                for p in raw_proposals:
                    key = f"{p.pillar_id}:{p.title}"
                    audit_input.append({
                        "agent": p.source_agent,
                        "title": p.title,
                        "pillar_id": p.pillar_id,
                        "priority": p.priority,
                        "reasoning": p.reasoning or "",
                        "accepted": key in accepted_ids,
                        "valid": p.pillar_id in PILLAR_IDS,
                        "rejected_reason": None if p.pillar_id in PILLAR_IDS else f"pillar_id '{p.pillar_id}' not in {PILLAR_IDS}",
                    })

                audit_report = await guardian_agent.audit_committee(audit_input)

                activity.log_event(
                    event_type="quality_audit",
                    message=f"Committee audit: {audit_report['health_score']}/100 health — {len(audit_report['alerts'])} findings",
                    payload=audit_report,
                )
                logger.info(
                    f"Committee audit: health={audit_report['health_score']}, "
                    f"critiques={len(audit_report['agent_critiques'])}, "
                    f"gaps={len(audit_report['coverage_gaps'])}, "
                    f"overlaps={len(audit_report['overlaps'])}"
                )

                # Create alerts for serious watchdog findings
                for alert in audit_report.get("alerts", []):
                    sev = alert.get("severity", "warning")
                    dedupe_key = f"guardian:{alert['type']}:{alert.get('agent','')}:{alert.get('title','')}"
                    try:
                        activity.create_alert(
                            alert_type=f"guardian_{alert['type']}",
                            title=alert["title"],
                            message=alert["message"],
                            severity="error" if sev == "error" else "warning",
                            cta_path=alert.get("cta_path"),
                            payload={"guardian_agent": alert.get("agent"), "type": alert["type"]},
                            dedupe_key=dedupe_key,
                        )
                    except Exception as ae:
                        logger.warning(f"Failed to create guardian alert: {ae}")
        except Exception as e:
            logger.warning(f"Committee watchdog audit failed: {e}")

        # --- Trend Signals (TrendSurferAgent) ---
        try:
            trend_agent = orchestrator.agents.get('trend')
            if trend_agent and hasattr(trend_agent, 'surf_trends'):
                opportunities = await trend_agent.surf_trends()
                if opportunities:
                    activity.log_event(
                        event_type="trend_signals",
                        message=f"Trend signals: {len(opportunities)} opportunities detected",
                        payload={
                            "opportunities": opportunities[:5],
                            "total_detected": len(opportunities),
                            "scan_timestamp": datetime.utcnow().isoformat(),
                        },
                    )
                    logger.info(f"Logged trend_signals event with {len(opportunities)} opportunities")
        except Exception as e:
            logger.warning(f"Trend signal phase failed: {e}")

    except Exception as e:
        logger.error(f"Committee proposal phase failed: {e}")
        # Continue to fallback or LLM generation if committee fails

    # 4. Final Selection
    # If we have agent tasks, use them. Otherwise fall back to LLM generation.
    if agent_tasks and not strict_contextuality:
        logger.info(f"Generated {len(agent_tasks)} tasks via Agent Committee")
        
        # Convert TaskProposal objects to dicts for frontend
        final_tasks = []
        for prop in agent_tasks:
            final_tasks.append({
                "pillarId": prop.pillar_id,
                "title": prop.title,
                "description": prop.description,
                "priority": prop.priority,
                "estimatedTime": prop.estimated_time,
                "actionType": prop.action_type,
                "actionUrl": prop.action_url,
                "enabled": True,
                "metadata": {
                    "source_agent": prop.source_agent,
                    "reasoning": prop.reasoning,
                    "context_data": prop.context_data,
                    "evidence_links": _derive_onboarding_evidence_links(grounding.get("onboarding_data", {}), limit=2),
                }
            })
            
        final_tasks = _ensure_pillar_coverage(final_tasks, user_id, date, grounding)
        return {
            "date": date,
            "tasks": final_tasks
        }

    # Fallback to original LLM generation if agents returned nothing
    logger.info("Agent committee returned no tasks, falling back to LLM generation")

    schema = {
        "type": "object",
        "properties": {
            "date": {"type": "string"},
            "tasks": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "pillarId": {"type": "string"},
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "priority": {"type": "string"},
                        "estimatedTime": {"type": "number"},
                        "actionType": {"type": "string"},
                        "actionUrl": {"type": "string"},
                        "enabled": {"type": "boolean"},
                        "dependencies": {"type": "array", "items": {"type": "string"}},
                        "metadata": {"type": "object"},
                    },
                },
            },
        },
    }

    calendar_events = grounding.get("calendar_events_today", [])
    prompt = (
        "Generate a personalized Today workflow plan for ALwrity with exactly 6 lifecycle pillars: "
        "plan, generate, publish, analyze, engage, remarket.\n\n"
        "User Context (Onboarding & Strategy):\n"
        f"{json.dumps(grounding.get('onboarding_data', {}), indent=2)}\n\n"
        "Rules:\n"
        "- Produce JSON only that matches the schema.\n"
        "- Include 1-3 tasks per pillar.\n"
        "- Each task must have pillarId in {plan, generate, publish, analyze, engage, remarket}.\n"
        "- Customize tasks based on the user's industry, business type, and content pillars found in User Context.\n"
        "- If competitors are listed, include a task to analyze one of them.\n"
        "- Prefer actionable tasks that can be completed today.\n"
        "- Use these common actionUrl routes when relevant: "
        "/content-planning-dashboard, /blog-writer, /linkedin-writer, /facebook-writer, /seo-dashboard, /scheduler-dashboard.\n"
        "- Keep descriptions concise.\n\n"
        f"Grounding context (Alerts):\n{json.dumps(grounding.get('recent_agent_alerts', []), indent=2)}\n\n"
        f"Calendar events scheduled for today (must inform the 'generate' pillar):\n"
        f"{json.dumps(calendar_events, indent=2)}\n"
    )

    if strict_contextuality:
        prompt += (
            "\nStrict contextuality mode (must follow):\n"
            f"- Every task.metadata must include evidence_links with at least {MIN_TASK_EVIDENCE_LINKS} entries.\n"
            "- evidence_links entries must use either 'onboarding:<field_name>' or 'alert:<alert_id>' format.\n"
            "- Include metadata.reasoning that explains how the evidence applies to the task.\n"
            "- Reject generic tasks without explicit ties to onboarding data or active alerts.\n"
        )

    run = activity.start_run(agent_type="TodayWorkflowGenerator", prompt=prompt[:4000])
    activity.log_event(
        event_type="plan",
        severity="info",
        message="Building grounded daily workflow plan",
        payload=build_agent_event_payload(phase="planning", step="build_grounded_plan", tool_name="llm_text_gen", progress_percent=10, input_summary="Grounding data assembled from onboarding + alerts", output_summary="Preparing daily workflow generation", decision_reason="Need context-aware workflow", evidence_refs=["onboarding_data","recent_agent_alerts"], safe_debug=True, metadata={"grounding": grounding}),
        run_id=run.id,
        agent_type="TodayWorkflowGenerator",
    )

    try:
        raw = llm_text_gen(prompt=prompt, json_struct=schema, user_id=user_id)
        if isinstance(raw, dict):
            result = raw
        else:
            try:
                result = json.loads(raw)
            except Exception:
                result = {"date": date, "tasks": []}
    except Exception as e:
        activity.log_event(
            event_type="warning",
            severity="warning",
            message=str(e)[:2000],
            payload=build_agent_event_payload(phase="generation", step="llm_failed", tool_name="llm_text_gen", progress_percent=70, output_summary="LLM generation failed, returning empty tasks", decision_reason="Exception during workflow generation", safe_debug=False, metadata={"error": str(e)[:200]}),
            run_id=run.id,
            agent_type="TodayWorkflowGenerator",
        )
        result = {"date": date, "tasks": []}

    tasks = result.get("tasks") if isinstance(result, dict) else None
    if not isinstance(tasks, list):
        tasks = []
    result = {
        "date": date,
        "tasks": _ensure_pillar_coverage(tasks, user_id, date, grounding),
    }

    activity.log_event(
        event_type="final_summary",
        severity="info",
        message="Daily workflow plan generated",
        payload=build_agent_event_payload(phase="generation", step="workflow_generated", tool_name="llm_text_gen", progress_percent=100, output_summary=f"Generated {len(result.get('tasks', []))} tasks", decision_reason="Workflow assembled successfully", evidence_refs=[date], safe_debug=True, metadata={"date": date, "task_count": len(result.get("tasks", []))}),
        run_id=run.id,
        agent_type="TodayWorkflowGenerator",
    )
    activity.finish_run(run.id, success=True, result_summary=json.dumps({"date": date, "tasks": result.get("tasks", [])})[:4000])
    return result


async def get_or_create_daily_workflow_plan(
    db: Session,
    user_id: str,
    date: Optional[str] = None,
    creation_source: str = "manual",
) -> tuple[DailyWorkflowPlan, bool]:
    from starlette.concurrency import run_in_threadpool

    date_str = date or _today_date_str()

    # H5: SQLAlchemy Sessions are not thread-safe. The threadpool helpers
    # below would otherwise mutate the caller's `db` Session from a different
    # thread. We give them their own Session bound to the same per-user
    # engine and ensure it is closed on every exit path.
    def _get_existing():
        from services.database import get_session_for_user
        thread_db = get_session_for_user(user_id)
        if thread_db is None:
            return None
        try:
            return (
                thread_db.query(DailyWorkflowPlan)
                .filter(DailyWorkflowPlan.user_id == user_id, DailyWorkflowPlan.date == date_str)
                .first()
            )
        finally:
            thread_db.close()

    existing = await run_in_threadpool(_get_existing)
    
    if existing:
        return existing, False

    grounding = build_grounding_context(db, user_id, date_str)

    # Step 1: Calendar events → generate pillar (SSOT for content creation)
    calendar_plan = _generate_calendar_event_plan(date_str, grounding)
    calendar_task_titles = {t.get("title") for t in calendar_plan.get("tasks", []) if t.get("title")}

    # Step 2: Agent committee → proposals for plan + analyze + engage + publish + remarket
    agent_plan_data = await generate_agent_enhanced_plan(db, user_id, date_str, grounding=grounding, strict_contextuality=False)

    # Filter agent proposals: keep only non-generate pillars, dedup by title
    committee_pillars = {"plan", "analyze", "engage", "publish", "remarket"}
    filtered_agent_tasks = []
    for t in agent_plan_data.get("tasks", []):
        pillar_id = t.get("pillarId")
        if pillar_id not in committee_pillars:
            # 'generate' is owned by calendar events; anything outside PILLAR_IDS
            # is invalid and we log a warning so the agent is debuggable.
            if pillar_id not in PILLAR_IDS:
                agent = None
                metadata = t.get("metadata")
                if isinstance(metadata, dict):
                    agent = metadata.get("source_agent")
                logger.warning(
                    f"Dropping agent task with invalid pillar_id={pillar_id!r} "
                    f"from agent {agent or 'unknown'}: title={t.get('title', '')!r}"
                )
            continue
        if t.get("title") in calendar_task_titles:
            continue
        filtered_agent_tasks.append(t)

    # Step 3: Merge — calendar wins for generate, agents fill other pillars
    all_tasks = calendar_plan.get("tasks", []) + filtered_agent_tasks
    calendar_source = bool(calendar_plan.get("tasks"))

    # Step 4: Pillar coverage — LLM backfill for any pillar still uncovered
    all_tasks = _ensure_pillar_coverage(all_tasks, user_id, date_str, grounding)

    # Step 5: Validation
    plan_data = {**agent_plan_data, "tasks": all_tasks}
    validation = validate_plan_contextuality(plan_data, grounding)

    plan_data["quality_status"] = (
        "calendar_driven" if calendar_source
        else "contextual" if validation.get("is_contextual")
        else "low_context"
    )
    plan_data["contextuality_validation"] = validation
    tasks = plan_data.get("tasks", [])

    def _create_plan():
        # H5: own Session for the threadpool worker (callers' `db` is async-thread only).
        from services.database import get_session_for_user
        thread_db = get_session_for_user(user_id)
        if thread_db is None:
            raise RuntimeError(f"Failed to open DB session for user {user_id}")
        try:
            plan = DailyWorkflowPlan(
                user_id=user_id,
                date=date_str,
                source=creation_source,
                generation_mode="calendar_driven" if calendar_source else _derive_generation_mode(plan_data),
                committee_agent_count=_count_committee_agents(tasks),
                fallback_used=False,
                plan_json=plan_data,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            thread_db.add(plan)
            try:
                thread_db.commit()
            except IntegrityError:
                # Race condition: another concurrent call created the same (user_id, date) plan.
                # Roll back and re-fetch the existing plan so the caller sees a coherent state.
                thread_db.rollback()
                existing = (
                    thread_db.query(DailyWorkflowPlan)
                    .filter(DailyWorkflowPlan.user_id == user_id, DailyWorkflowPlan.date == date_str)
                    .first()
                )
                if existing is None:
                    # Extremely unlikely: the other transaction also rolled back.
                    raise
                logger.info(
                    "DailyWorkflowPlan race resolved: re-fetched existing plan for user_id={} date={}",
                    user_id, date_str,
                )
                return existing, False
            thread_db.refresh(plan)

            for t in tasks:
                pillar_id = str(t.get("pillarId") or "").lower().strip()
                if pillar_id not in PILLAR_IDS:
                    agent = None
                    metadata = t.get("metadata")
                    if isinstance(metadata, dict):
                        agent = metadata.get("source_agent")
                    logger.warning(f"Skipping task persistence for invalid pillar_id={pillar_id!r} "
                                   f"from agent {agent or 'unknown'}: title={t.get('title', '')}")
                    continue
                task = DailyWorkflowTask(
                    plan_id=plan.id,
                    user_id=user_id,
                    pillar_id=pillar_id,
                    title=str(t.get("title") or "Task").strip()[:255],
                    description=str(t.get("description") or "").strip(),
                    status=_coerce_status(t.get("status")),
                    priority=_coerce_priority(t.get("priority")),
                    estimated_time=int(t.get("estimatedTime") or 15),
                    action_type=str(t.get("actionType") or "navigate").strip()[:20],
                    action_url=str(t.get("actionUrl") or "").strip(),
                    dependencies=json.dumps(t.get("dependencies") or []),
                    metadata_json=t.get("metadata") or {},
                    enabled=bool(t.get("enabled", True)),
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                thread_db.add(task)

            thread_db.commit()
            return plan, True
        finally:
            thread_db.close()

    plan, created = await run_in_threadpool(_create_plan)
    return plan, created


def _derive_generation_mode(plan_data: Dict[str, Any]) -> str:
    tasks = plan_data.get("tasks", []) if isinstance(plan_data, dict) else []
    source_modes = set()
    for task in tasks:
        metadata = task.get("metadata") if isinstance(task, dict) else {}
        metadata = metadata if isinstance(metadata, dict) else {}
        source_agent = str(metadata.get("source_agent") or "").strip()
        source = str(metadata.get("source") or "").strip()
        if source == "calendar_event":
            return "calendar_driven"
        if source_agent:
            source_modes.add("agent_committee")
        elif source in {"llm_pillar_backfill"}:
            source_modes.add(source)

    if "calendar_driven" in source_modes:
        return "calendar_driven"
    if "agent_committee" in source_modes:
        return "agent_committee"
    if "llm_pillar_backfill" in source_modes:
        return "llm_pillar_backfill"
    return "llm_generation"


def _count_committee_agents(tasks: List[Dict[str, Any]]) -> int:
    agents = set()
    for task in tasks:
        metadata = task.get("metadata") if isinstance(task, dict) else {}
        metadata = metadata if isinstance(metadata, dict) else {}
        source_agent = str(metadata.get("source_agent") or "").strip()
        if source_agent:
            agents.add(source_agent)
    return len(agents)


def _plan_uses_fallback(tasks: List[Dict[str, Any]]) -> bool:
    for task in tasks:
        metadata = task.get("metadata") if isinstance(task, dict) else {}
        metadata = metadata if isinstance(metadata, dict) else {}
        source = str(metadata.get("source") or "").strip()
        if source in {"controlled_fallback", "llm_pillar_backfill"}:
            return True
    return False


def sync_workflow_tasks_from_calendar_event(
    db: Session,
    user_id: str,
    calendar_event: CalendarEvent,
) -> int:
    """Reverse-sync a CalendarEvent change to any DailyWorkflowTask that references it.

    Called by the calendar CRUD endpoints after a create/update/delete. Maps
    calendar status transitions to workflow task status transitions so the
    today-workflow view reflects calendar changes in (near) real time.

    Status mapping:
      - calendar "published" → task "completed" (only for tasks not yet decided)
      - calendar "cancelled" → task "dismissed" (only for tasks not yet decided)
      - calendar "scheduled"/"draft" → no change (workflow already reflects this)

    Returns the number of workflow tasks updated.
    """
    target_task_status = None
    if calendar_event.status == "published":
        target_task_status = "completed"
    elif calendar_event.status == "cancelled":
        target_task_status = "dismissed"
    else:
        return 0

    try:
        # Find non-decided workflow tasks sourced from this calendar event.
        # task.metadata_json -> {"source": "calendar_event", "source_event_id": <id>}
        tasks = (
            db.query(DailyWorkflowTask)
            .filter(
                DailyWorkflowTask.user_id == user_id,
                DailyWorkflowTask.status.in_(["pending", "in_progress"]),
            )
            .all()
        )
        updated = 0
        for task in tasks:
            metadata = task.metadata_json if isinstance(task.metadata_json, dict) else {}
            if (
                metadata.get("source") == "calendar_event"
                and metadata.get("source_event_id") == calendar_event.id
            ):
                task.status = target_task_status
                task.decided_at = datetime.utcnow()
                task.completion_notes = (
                    f"Auto-updated from calendar event status={calendar_event.status}"
                )
                db.add(task)
                updated += 1
        if updated:
            db.commit()
            logger.info(
                f"Reverse-synced {updated} workflow task(s) for user {user_id} "
                f"from calendar_event id={calendar_event.id} status={calendar_event.status}"
            )
        return updated
    except Exception as e:
        db.rollback()
        logger.error(
            f"Failed to reverse-sync workflow tasks for user {user_id} "
            f"from calendar_event id={calendar_event.id}: {e}"
        )
        return 0


def update_task_status(
    db: Session,
    user_id: str,
    task_id: int,
    status: str,
    completion_notes: Optional[str] = None,
) -> Optional[DailyWorkflowTask]:
    task = db.query(DailyWorkflowTask).filter(DailyWorkflowTask.id == task_id, DailyWorkflowTask.user_id == user_id).first()
    if not task:
        return None
    task.status = _coerce_status(status)
    task.decided_at = datetime.utcnow()
    if completion_notes is not None:
        task.completion_notes = completion_notes[:4000]
    db.add(task)
    db.commit()
    db.refresh(task)

    # If a calendar-sourced task is completed, mark the calendar event as published
    if status == "completed" and task.metadata_json:
        source = task.metadata_json.get("source")
        source_event_id = task.metadata_json.get("source_event_id")
        if source == "calendar_event" and source_event_id:
            try:
                cal_event = (
                    db.query(CalendarEvent)
                    .join(ContentStrategy, CalendarEvent.strategy_id == ContentStrategy.id)
                    .filter(
                        CalendarEvent.id == source_event_id,
                        ContentStrategy.user_id == user_id,
                    )
                    .first()
                )
                if cal_event and cal_event.status != "published":
                    cal_event.status = "published"
                    cal_event.updated_at = datetime.utcnow()
                    db.add(cal_event)
                    db.commit()
            except Exception as e:
                logger.warning(f"Failed to update calendar event {source_event_id} on task completion: {e}")

    return task
