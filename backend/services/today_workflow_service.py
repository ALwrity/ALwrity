import json
import os
import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy import func as sql_func
from sqlalchemy.orm import Session

from models.daily_workflow_models import DailyWorkflowPlan, DailyWorkflowTask
from models.agent_activity_models import AgentAlert
from models.content_planning import CalendarEvent, ContentStrategy
from services.agent_activity_service import AgentActivityService, build_agent_event_payload
from services.daily_meeting_persistence import attach_daily_meeting_tasks, finish_daily_meeting, start_daily_meeting
from services.task_memory_service import TaskMemoryService
from services.agent_schedule_service import evaluate_agent_schedule
from services.daily_meeting_preflight import build_agent_evidence, run_daily_meeting_preflight
from services.daily_meeting_review import prioritize_proposals, review_proposals
from services.intelligence.agents.team_catalog import AGENT_TEAM_CATALOG


class _NoopActivity:
    """Activity sink used by lightweight planning calls without a tenant DB."""

    def start_run(self, *args, **kwargs):
        return type("Run", (), {"id": None})()

    def log_event(self, *args, **kwargs):
        return None

    def finish_run(self, *args, **kwargs):
        return None
from services.llm_providers.main_text_generation import llm_text_gen
from services.database import get_session_for_user
from services.intelligence.agents.output_contracts import resolve_recommendation_action
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

# --- Calendar utilities (implementation in today_workflow_calendar.py) ---
from services.today_workflow_calendar import (  # noqa: E402
    _CALENDAR_CONTENT_PILLAR,
    _CALENDAR_PLATFORM_PILLAR,
    CALENDAR_DEFAULT_PILLAR,
    _PLATFORM_ACTION_URL,
    _CONTENT_ACTION_URL,
    _CONTENT_ESTIMATED_TIME,
    _GENERIC_FALLBACK_ACTION_URL,
    _resolve_calendar_pillar,
    _resolve_calendar_action_url,
    _resolve_calendar_estimated_time,
    _generate_calendar_event_plan,
)

# Kept for backwards-compat callers that read this constant.
# New code should use _resolve_calendar_pillar() instead.
CALENDAR_CONTENT_PILLAR = CALENDAR_DEFAULT_PILLAR


def _resolve_recommendation_action_type(proposal):
    "Assign an explicit, user-triggered action to executable recommendations."
    return str(resolve_recommendation_action(proposal)["action_type"])


def _recommendation_id(proposal, date):
    import hashlib
    source = str(getattr(proposal, "source_agent", "") or "workflow")
    pillar = str(getattr(proposal, "pillar_id", "") or "")
    title = str(getattr(proposal, "title", "") or "")
    digest = hashlib.sha256(f"{date}|{source}|{pillar}|{title}".encode()).hexdigest()
    return f"rec-{digest[:24]}"


def _stamp_synthesis_mode(tasks: List[Dict[str, Any]], mode: str) -> List[Dict[str, Any]]:
    """Tag task dicts that lack a synthesis_mode with the producing path's mode.

    Existing per-task values are never overwritten; only anonymous dicts
    (e.g. raw LLM-generated tasks) get stamped.
    """
    for task in tasks or []:
        if not isinstance(task, dict):
            continue
        metadata = task.get("metadata") if isinstance(task.get("metadata"), dict) else {}
        if not metadata.get("synthesis_mode"):
            metadata["synthesis_mode"] = mode
        task["metadata"] = metadata
    return tasks


def _today_date_str() -> str:
    return datetime.now(timezone.utc).date().isoformat()

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
                "owner_agent": event.owner_agent,
                "recommendation_id": event.recommendation_id,
                "task_id": event.task_id,
                "meeting_id": event.meeting_id,
                "kpi": event.kpi,
                "deadline": event.deadline,
                "action_type": event.action_type,
                "action_parameters": event.action_parameters,
                "evidence": event.evidence,
                "expected_outcome": event.expected_outcome,
                "user_approval_state": event.user_approval_state,
                "user_timezone": event.user_timezone,
            }
            for event in calendar_events_today
        ],
    }


class _LazyOrchestrationService:
    """Compatibility facade that defers heavy orchestrator imports until use."""

    def __init__(self):
        self._target = None

    def _load(self):
        if self._target is None:
            from services.intelligence.agents.agent_orchestrator import AgentOrchestrationService

            self._target = AgentOrchestrationService()
        return self._target

    async def get_or_create_orchestrator(self, *args, **kwargs):
        return await self._load().get_or_create_orchestrator(*args, **kwargs)

    def __getattr__(self, name):
        return getattr(self._load(), name)


# Kept as a public compatibility seam for existing tests and integrations.
orchestration_service = _LazyOrchestrationService()


def _get_orchestration_service():
    """Return the lazy facade without initializing SIF/SEO dependencies."""
    return orchestration_service


async def generate_agent_enhanced_plan(
    db: Session,
    user_id: str,
    date: str,
    grounding: Optional[Dict[str, Any]] = None,
    strict_contextuality: bool = False,
    allow_preview: bool = False,
    manual_override: bool = False,
) -> Dict[str, Any]:
    import asyncio

    activity = AgentActivityService(db, user_id) if db is not None else _NoopActivity()
    grounding = grounding or build_grounding_context(db, user_id, date)
    memory_service = TaskMemoryService(user_id, db)
    proposal_review = {"normalized_proposals": [], "summary": {}}
    guardian_review = {"status": "not_run", "decisions": [], "summary": {}}
    workflow_config = grounding.get("workflow_config", {}) if isinstance(grounding, dict) else {}
    onboarding = grounding.get("onboarding_data", {}) if isinstance(grounding, dict) else {}
    tenant_timezone = (
        workflow_config.get("timezone") or workflow_config.get("time_zone") or
        onboarding.get("timezone") or onboarding.get("time_zone") or "UTC"
    ) if isinstance(workflow_config, dict) and isinstance(onboarding, dict) else "UTC"
    meeting = start_daily_meeting(
        db,
        user_id,
        date,
        source="manual" if manual_override else "scheduled",
        tenant_timezone=tenant_timezone,
    )
    meeting_id = meeting.meeting_id if meeting else None

    def finish_meeting(result: Dict[str, Any], status: str = "completed", error_message: Optional[str] = None) -> Dict[str, Any]:
        result = dict(result)
        result["meeting_id"] = meeting_id
        result["meeting_status"] = status
        finish_daily_meeting(db, meeting, status, result, error_message=error_message)
        return result

    meeting_preflight = run_daily_meeting_preflight(user_id, db, grounding, date)
    activity.log_event(
        event_type="meeting_preflight",
        severity="warning" if meeting_preflight["limitations"] else "info",
        message="Daily meeting data preflight completed",
        payload=meeting_preflight,
    )
    if meeting_preflight["blocking"]:
        return finish_meeting({
            "date": date,
            "tasks": [],
            "committee_agent_count": 0,
            "agent_evidence": [],
                    "proposal_review": proposal_review,
                    "guardian_review": guardian_review,
                    "meeting_preflight": meeting_preflight,
            "limitations": meeting_preflight["limitations"],
        }, status="limited")

    # 1. Get Orchestrator
    orchestration_service = _get_orchestration_service()
    if orchestration_service is None:
        logger.warning(
            f"OrchestrationService unavailable for user {user_id}; "
            f"agent committee disabled, falling back to LLM path"
        )
        # Signal the fallback explicitly so the caller can mark
        # ``fallback_used=True`` on the plan and the dashboard can
        # render the "AI-Assisted" provenance label. Returning an
        # empty tasks list with no flag would silently hide the
        # committee outage from operators.
        return finish_meeting({
            "date": date,
            "tasks": [],
            "fallback_used": True,
            "agent_evidence": [],
            "proposal_review": proposal_review,
            "meeting_preflight": meeting_preflight,
            "limitations": [*meeting_preflight["limitations"], "Agent orchestrator is unavailable."],
        }, status="failed", error_message="Agent orchestrator unavailable")
    try:
        if allow_preview:
            orchestrator = await orchestration_service.get_or_create_orchestrator(
                user_id, allow_preview_init=True
            )
        else:
            # Preserve the original one-argument call shape for lightweight
            # integrations and existing orchestration implementations.
            orchestrator = await orchestration_service.get_or_create_orchestrator(user_id)
    except Exception as e:
        logger.error(f"Failed to get orchestrator: {e}")
        # Same fallback flag — the orchestrator raised. Downstream
        # ``_ensure_pillar_coverage`` will LLM-backfill empty pillars
        # so the user still gets a usable plan.
        return finish_meeting({
            "date": date,
            "tasks": [],
            "fallback_used": True,
            "agent_evidence": [],
            "proposal_review": proposal_review,
            "meeting_preflight": meeting_preflight,
            "limitations": [*meeting_preflight["limitations"], "Agent orchestrator failed to initialize."],
        }, status="failed", error_message=str(e))

    # 2. Parallel "Committee" Proposal Gathering
    logger.info(f"Gathering daily task proposals from agent committee for user {user_id}")
    # Track how many agents actually participated in the committee,
    # regardless of how many of their proposals survived dedup. This
    # is the right number to surface as ``committee_agent_count`` on
    # the plan; counting only surviving tasks under-reports when
    # most proposals are filtered.
    agents_polled_count: int = 0
    
    agent_tasks = []
    agent_evidence = []
    try:
        # Define agents to poll
        candidate_agents = [
            ("content_strategist", orchestrator.agents.get('content')),
            ("strategy_architect", orchestrator.agents.get('strategy')),
            ("seo_specialist", orchestrator.agents.get('seo')),
            ("social_media_manager", orchestrator.agents.get('social')),
            ("competitor_analyst", orchestrator.agents.get('competitor')),
            ("content_gap_radar", orchestrator.agents.get('content_gap_radar')),
        ]
        profiles_by_key = {}
        try:
            from models.agent_activity_models import AgentProfile
            profiles_by_key = {
                profile.agent_key: {
                    "enabled": profile.enabled,
                    "schedule": profile.schedule,
                }
                for profile in db.query(AgentProfile).filter(AgentProfile.user_id == user_id).all()
            } if db is not None else {}
        except Exception as exc:
            logger.warning("Could not load agent schedule profiles for user_id={} error={}", user_id, exc)

        catalog_by_key = {entry["agent_key"]: entry for entry in AGENT_TEAM_CATALOG}
        workflow_config = grounding.get("workflow_config", {}) if isinstance(grounding, dict) else {}
        onboarding = grounding.get("onboarding_data", {}) if isinstance(grounding, dict) else {}
        tenant_timezone = (
            workflow_config.get("timezone") or workflow_config.get("time_zone") or
            onboarding.get("timezone") or onboarding.get("time_zone") or "UTC"
        ) if isinstance(workflow_config, dict) and isinstance(onboarding, dict) else "UTC"
        tenant_pause = workflow_config if isinstance(workflow_config, dict) else {}
        schedule_now = datetime.now(timezone.utc)
        schedule_decisions = []
        active_agents = []
        effective_manual_override = manual_override or db is None
        for agent_key, agent in candidate_agents:
            catalog = catalog_by_key.get(agent_key, {})
            decision = evaluate_agent_schedule(
                agent_key,
                profile=profiles_by_key.get(agent_key),
                defaults=catalog.get("defaults", {}),
                tenant_timezone=tenant_timezone,
                now=schedule_now,
                manual_override=effective_manual_override,
                tenant_pause=tenant_pause,
            )
            decision["agent_available"] = agent is not None
            if agent is None and decision["eligible"]:
                decision["eligible"] = False
                decision["reason"] = "agent unavailable or failed initialization"
            decision["participates"] = bool(decision["eligible"] and agent is not None)
            schedule_decisions.append(decision)
            if decision["participates"]:
                active_agents.append(agent)

        agents_polled_count = len(active_agents)
        
        # Execute propose_daily_tasks in parallel
        results = await asyncio.gather(
            *[a.propose_daily_tasks(grounding) for a in active_agents],
            return_exceptions=True
        )
        
        # Collect successful proposals
        raw_proposals = []
        raw_agent_keys = []
        active_pairs = [
            (agent_key, agent)
            for (agent_key, agent), decision in zip(candidate_agents, schedule_decisions)
            if decision["participates"]
        ]
        for (agent_key, _agent), res in zip(active_pairs, results):
            if isinstance(res, Exception):
                agent_evidence.append({
                    "agent": agent_key,
                    "evidence": [],
                    "analysis": "",
                    "proposed_tasks": [],
                    "confidence": 0.0,
                    "expected_impact": [],
                    "effort": [],
                    "kpi": [],
                    "required_action_parameters": [],
                    "error": str(res),
                })
                logger.warning(f"Agent proposal failed: {res}")
                continue
            agent_evidence.append(build_agent_evidence(agent_key, res))
            if isinstance(res, list):
                raw_proposals.extend(res)
                raw_agent_keys.extend([agent_key] * len(res))

        # 3. Normalize and review proposals without silently discarding any.
        proposal_review = await review_proposals(
            raw_proposals,
            memory_service=memory_service,
            capacity_minutes=(workflow_config.get("daily_capacity_minutes", 240)
                              if isinstance(workflow_config, dict) else 240),
            agent_keys=raw_agent_keys,
        )
        agent_tasks = proposal_review["accepted_proposals"]
        guardian_agent = orchestrator.agents.get("guardian")
        accepted_normalized = [
            decision for decision in proposal_review["normalized_proposals"]
            if decision.get("status") == "accepted"
        ]
        if guardian_agent and hasattr(guardian_agent, "review_normalized_proposals"):
            try:
                guardian_review = await guardian_agent.review_normalized_proposals(accepted_normalized)
                guardian_by_id = {
                    decision["recommendation_id"]: decision
                    for decision in guardian_review.get("decisions", [])
                }
                for decision in proposal_review["normalized_proposals"]:
                    guardian_decision = guardian_by_id.get(decision["recommendation_id"])
                    if guardian_decision:
                        decision["guardian_outcome"] = guardian_decision["guardian_outcome"]
                        decision["guardian_reasons"] = guardian_decision["guardian_reasons"]
                approved_ids = {
                    decision["recommendation_id"]
                    for decision in guardian_review.get("decisions", [])
                    if decision.get("guardian_outcome") in {"approved", "approved_with_warning"}
                }
                agent_tasks = [
                    proposal for proposal, decision in zip(agent_tasks, accepted_normalized)
                    if decision["recommendation_id"] in approved_ids
                ]
            except Exception as exc:
                guardian_review = {
                    "status": "error",
                    "decisions": [],
                    "summary": {},
                    "limitations": [f"Guardian review failed; proposals were not released: {exc}"],
                }
                agent_tasks = []
        elif db is not None:
            guardian_review = {
                "status": "unavailable",
                "decisions": [],
                "summary": {},
                "limitations": ["Guardian review was unavailable; proposals were not released for execution."],
            }
            agent_tasks = []
        approved_for_selection = [
            decision for decision in proposal_review.get("normalized_proposals", [])
            if decision.get("status") == "accepted"
            and decision.get("guardian_outcome") in {None, "approved", "approved_with_warning"}
        ]
        prioritized = prioritize_proposals(approved_for_selection, grounding, meeting_preflight)
        prioritized_by_key = {
            (item.get("title"), item.get("description"), item.get("pillar")): item
            for item in prioritized
        }
        for decision in proposal_review.get("normalized_proposals", []):
            selected = prioritized_by_key.get(
                (decision.get("title"), decision.get("description"), decision.get("pillar"))
            )
            if selected:
                decision["selection_score"] = selected["selection_score"]
                decision["selection_factors"] = selected["selection_factors"]
        agent_tasks = sorted(
            agent_tasks,
            key=lambda proposal: -prioritized_by_key.get(
                (proposal.title, proposal.description, proposal.pillar_id),
                {"selection_score": 0.0},
            )["selection_score"],
        )
        # Persist accepted proposal timing after filtering. This records the
        # first/last proposal timestamps without making the current proposal
        # look like an already-seen duplicate during this pass.
        for proposal in agent_tasks:
            await memory_service.record_task_proposal(proposal)

        # Log committee meeting event for frontend transparency
        try:
            accepted_ids = {f"{p.pillar_id}:{p.title}" for p in agent_tasks}
            proposals_log = []
            for index, p in enumerate(raw_proposals):
                valid = p.pillar_id in PILLAR_IDS
                key = f"{p.pillar_id}:{p.title}"
                reviewed = proposal_review.get("normalized_proposals", [])[index] if index < len(proposal_review.get("normalized_proposals", [])) else {}
                participates = (
                    reviewed.get("status") == "accepted"
                    and reviewed.get("guardian_outcome") in {None, "approved", "approved_with_warning"}
                )
                proposals_log.append({
                    "recommendation_id": reviewed.get("recommendation_id"),
                    "agent": reviewed.get("agent") or p.source_agent,
                    "title": p.title,
                    "pillar_id": p.pillar_id,
                    "priority": p.priority,
                    "valid": valid,
                    "accepted": participates,
                    "review_status": reviewed.get("status", "rejected"),
                    "review_reasons": reviewed.get("review_reasons", []),
                    "guardian_outcome": reviewed.get("guardian_outcome"),
                    "guardian_reasons": reviewed.get("guardian_reasons", []),
                    "selection_score": reviewed.get("selection_score"),
                    "selection_factors": reviewed.get("selection_factors", {}),
                    "rejected_reason": None if valid and participates else (
                        f"pillar_id '{p.pillar_id}' not in {PILLAR_IDS}"
                        if not valid else (reviewed.get("review_reasons") or ["proposal was not accepted"])[0]
                    ),
                    "reasoning": p.reasoning,
                    "estimated_time": p.estimated_time,
                    "action_type": _resolve_recommendation_action_type(p),
                    "synthesis_mode": getattr(p, "synthesis_mode", None),
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
                    "proposal_review": proposal_review,
                    "guardian_review": guardian_review,
                    "meeting_preflight": meeting_preflight,
                    "agent_evidence": agent_evidence,
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
    # Use grounded committee tasks; tenant-backed empty meetings stay limited.
    if agent_tasks and not strict_contextuality:
        logger.info(f"Generated {len(agent_tasks)} tasks via Agent Committee")
        
        # Convert TaskProposal objects to dicts for frontend
        final_tasks = []
        review_ids = {
            (item.get("title"), item.get("description"), item.get("pillar")): item.get("recommendation_id")
            for item in proposal_review.get("normalized_proposals", [])
            if item.get("recommendation_id")
        }
        for prop in agent_tasks:
            action_contract = resolve_recommendation_action(prop)
            resolved_action_type = action_contract["action_type"]
            recommendation_id = review_ids.get(
                (prop.title, prop.description, prop.pillar_id),
                _recommendation_id(prop, date),
            )
            selected_review = next(
                (
                    item for item in proposal_review.get("normalized_proposals", [])
                    if (item.get("title"), item.get("description"), item.get("pillar"))
                    == (prop.title, prop.description, prop.pillar_id)
                ),
                {},
            )
            final_tasks.append({
                "pillarId": prop.pillar_id,
                "title": prop.title,
                "description": prop.description,
                "recommendation": prop.recommendation or prop.description,
                "nextAction": prop.next_action or (
                    f"Open {prop.action_url}" if prop.action_url else "Review and choose the next action"
                ),
                "ownerAgent": prop.owner_agent or prop.source_agent,
                "kpi": prop.kpi,
                "deadline": prop.deadline,
                "priority": prop.priority,
                "estimatedTime": prop.estimated_time,
                    "actionType": resolved_action_type,
                    "actionUrl": prop.action_url,
                    "evidence": prop.evidence,
                    "expectedImpact": prop.expected_impact,
                    "effort": prop.effort,
                    "riskLevel": prop.risk_level,
                    "measurement": prop.measurement,
                    "enabled": True,
                "metadata": {
                    "recommendation_id": recommendation_id,
                    "source_agent": prop.source_agent,
                    "reasoning": prop.reasoning,
                    "context_data": prop.context_data,
                    "action_parameters": action_contract["parameters"],
                    "action_contract": action_contract,
                    "selection_score": selected_review.get("selection_score"),
                    "selection_factors": selected_review.get("selection_factors", {}),
                    "selection_reason": selected_review.get("selection_reason", []),
                    "confidence": selected_review.get("confidence", 0.0),
                    "required_action": prop.next_action or prop.action_url,
                    "evidence_links": _derive_onboarding_evidence_links(grounding.get("onboarding_data", {}), limit=2),
                    "synthesis_mode": getattr(prop, "synthesis_mode", None),
                }
            })
            
        final_tasks = await _ensure_pillar_coverage(final_tasks, user_id, date, grounding)
        return finish_meeting({
            "date": date,
            "tasks": final_tasks,
            # The actual count of agents that participated, not the
            # count of distinct source_agent values on surviving tasks.
            "committee_agent_count": agents_polled_count,
            "schedule_decisions": schedule_decisions,
            "meeting_preflight": meeting_preflight,
            "agent_evidence": agent_evidence,
            "proposal_review": proposal_review,
            "guardian_review": guardian_review,
            "limitations": meeting_preflight["limitations"],
        })

    if db is not None:
        limitation = (
            "No eligible agent produced a proposal; the meeting recorded evidence and limitations "
            "instead of generating an ungrounded fallback task."
        )
        meeting_preflight["limitations"] = [*meeting_preflight["limitations"], limitation]
        activity.log_event(
            event_type="meeting_limited",
            severity="warning",
            message="Daily meeting produced no grounded proposals",
            payload={
                "meeting_preflight": meeting_preflight,
                "agent_evidence": agent_evidence,
                "proposal_review": proposal_review,
                "guardian_review": guardian_review,
                "limitations": meeting_preflight["limitations"],
            },
        )
        return finish_meeting({
            "date": date,
            "tasks": [],
            "committee_agent_count": agents_polled_count,
            "schedule_decisions": schedule_decisions,
            "meeting_preflight": meeting_preflight,
            "agent_evidence": agent_evidence,
            "proposal_review": proposal_review,
            "guardian_review": guardian_review,
            "limitations": meeting_preflight["limitations"],
        })

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
        "/content-planning-dashboard, /blog-writer, /linkedin-studio, /facebook-writer, /seo-dashboard, /scheduler-dashboard.\n"
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
    covered_tasks = await _ensure_pillar_coverage(
        _stamp_synthesis_mode(tasks, "llm"), user_id, date, grounding
    )
    result = {
        "date": date,
        "tasks": covered_tasks,
        # LLM-only fallback path: zero agents participated. The plan
        # row will see this and render "AI Personalized Guide" instead
        # of "Personalized by Agents".
        "committee_agent_count": 0,
        "meeting_preflight": meeting_preflight,
        "agent_evidence": agent_evidence,
        "limitations": meeting_preflight["limitations"],
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
    return finish_meeting(result)


async def get_or_create_daily_workflow_plan(
    db: Session,
    user_id: str,
    date: Optional[str] = None,
    creation_source: str = "manual",
    allow_preview: bool = False,
    manual_override: Optional[bool] = None,
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
    agent_plan_data = await generate_agent_enhanced_plan(
        db, user_id, date_str, grounding=grounding, strict_contextuality=False,
        allow_preview=allow_preview,
        manual_override=(creation_source in {"manual", "preview"}) if manual_override is None else manual_override,
    )
    # ``fallback_used`` is set by the committee function when the
    # orchestrator raises or is uninitialised. Surface it here so
    # the plan row reflects the degraded path even if a later step
    # (e.g. pillar backfill) restores task count.
    committee_fallback_used = bool(agent_plan_data.get("fallback_used", False))
    # Polled-agent count: the committee function records how many
    # agents actually participated (not how many of their
    # proposals survived dedup). Pass it through to the plan row.
    committee_polled_count = int(agent_plan_data.get("committee_agent_count", 0) or 0)

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
    all_tasks = await _ensure_pillar_coverage(all_tasks, user_id, date_str, grounding)

    # Step 5: Validation
    plan_data = {**agent_plan_data, "tasks": all_tasks}
    # Carry the polled-agent count through the plan_data dict so it
    # ends up in plan_json for downstream consumers (and so the
    # call to _count_committee_agents can see it on the merged
    # data if it ever walks plan_data instead of tasks).
    plan_data["committee_agent_count"] = committee_polled_count
    validation = validate_plan_contextuality(plan_data, grounding)

    plan_data["quality_status"] = (
        "calendar_driven" if calendar_source
        else "contextual" if validation.get("is_contextual")
        else "low_context"
    )
    plan_data["contextuality_validation"] = validation
    # Roll up fallback_used from any source. The committee flag
    # (orchestrator failure) is the primary signal; the per-task
    # helper detects llm_pillar_backfill and controlled_fallback
    # sources as secondary signals.
    plan_data["fallback_used"] = committee_fallback_used or _plan_uses_fallback(all_tasks)
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
                # Prefer the polled count from the committee call
                # over the distinct-source-agent walk. Falls back to
                # the walk only if the committee didn't run.
                committee_agent_count=committee_polled_count
                or _count_committee_agents(tasks),
                fallback_used=bool(plan_data.get("fallback_used", False)),
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
    if created:
        attach_daily_meeting_tasks(
            db,
            plan_data.get("meeting_id"),
            plan.id,
        )
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
    """Count distinct agents that participated in the committee.

    The plan row's ``committee_agent_count`` is the operator-visible
    signal of "how many AI teammates worked on this plan". The
    pre-fix implementation counted only distinct ``source_agent``
    values on surviving tasks, which under-reports when most
    proposals are filtered by dedup or self-learning memory. A
    plan with 6 polled agents and 1 surviving task used to show
    ``committee_agent_count=1``; with the fix it shows 6.

    This function falls back to the source-walk only when the
    committee call didn't run (no polled count captured), so the
    behavior is monotonic across the old and new call sites.
    """
    agents = set()
    polled_count: Optional[int] = None
    for task in tasks:
        # The first pass sets the polled count from any task that
        # carries it via its metadata. New committee runs stamp the
        # count on a synthetic metadata entry; older plans without
        # that entry fall back to the distinct-source-agent walk.
        metadata = task.get("metadata") if isinstance(task, dict) else {}
        metadata = metadata if isinstance(metadata, dict) else {}
        source_agent = str(metadata.get("source_agent") or "").strip()
        if source_agent:
            agents.add(source_agent)
        # New: explicit polled count from the committee call.
        polled_raw = metadata.get("committee_polled_count")
        if isinstance(polled_raw, int):
            polled_count = polled_raw
    if polled_count is not None:
        return max(polled_count, len(agents))
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
            metadata = dict(task.metadata_json) if isinstance(task.metadata_json, dict) else {}
            linked = (
                metadata.get("source") == "calendar_event"
                and metadata.get("source_event_id") == calendar_event.id
            ) or metadata.get("calendar_event_id") == calendar_event.id or calendar_event.task_id == task.id
            if linked:
                metadata["calendar_status"] = calendar_event.status
                metadata["calendar_scheduled_date"] = calendar_event.scheduled_date.isoformat() if calendar_event.scheduled_date else None
                task.metadata_json = dict(metadata)
                if target_task_status:
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

# --- Pillar coverage utilities (implementation in today_workflow_pillar.py) ---
from services.today_workflow_pillar import (  # noqa: E402
    _coerce_priority,
    _coerce_status,
    _is_coverage_guardrail_enabled,
    _sanitize_task,
    _resolve_backfill_provider,
    _build_single_task_for_missing_pillar,
    _controlled_pillar_fallback,
    _ensure_pillar_coverage,
)


