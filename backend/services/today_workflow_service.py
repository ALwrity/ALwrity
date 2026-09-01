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

# Pillars owned by the agent committee (as opposed to calendar-driven
# 'generate'). Retried agent proposals are confined to these pillars so a
# retry never clobbers calendar-sourced content tasks.
_COMMITTEE_PILLARS = {"plan", "analyze", "engage", "publish", "remarket"}


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
    retry_agents: Optional[List[str]] = None,
    skip_meeting_lifecycle: bool = False,
) -> Dict[str, Any]:
    """Generate today's plan using the agent committee.

    The orchestration logic now lives in today_workflow_agents.py for
    modularity; this wrapper preserves the public API and defers the import
    to avoid a circular dependency with the extracted module.
    """
    from services.today_workflow_agents import generate_agent_enhanced_plan as _impl

    return await _impl(
        db=db,
        user_id=user_id,
        date=date,
        grounding=grounding,
        strict_contextuality=strict_contextuality,
        allow_preview=allow_preview,
        manual_override=manual_override,
        retry_agents=retry_agents,
        skip_meeting_lifecycle=skip_meeting_lifecycle,
    )


def _record_retry_shared_note(user_id: str, agent_key: str, added: int, replaced: int) -> None:
    """Append a per-agent retry outcome to the VFS shared scratchpad.

    Collaboration note + ``agent_retry_completed`` activity-log entry so
    agents and operators can see prior retry outcomes (cross-agent
    coordination substrate). Failures are swallowed: the note is
    observability, never a correctness dependency.
    """
    try:
        from services.intelligence.agent_context_vfs import AgentContextVFS

        vfs = AgentContextVFS(user_id)
        vfs.write_shared_note(
            f"agent retry completed: {agent_key} added={added} replaced={replaced}",
            agent_id="today_workflow_committee",
        )
        vfs.append_activity_log(
            event_type="agent_retry_completed",
            actor="today_workflow_committee",
            details={"agent": agent_key, "added": added, "replaced": replaced},
        )
    except Exception as exc:
        logger.debug(f"[today_workflow_service] Retry note write failed for {user_id}: {exc}")


def _merge_retried_agent_tasks(
    db: Session,
    plan: DailyWorkflowPlan,
    agent_key: str,
    retried_tasks: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Replace a single agent's persisted tasks with the retried proposals.

    Deletes the agent's existing ``DailyWorkflowTask`` rows (matched by
    ``metadata.source_agent``) and inserts the fresh proposals, leaving all
    other agents' rows untouched. Returns counts for reporting.
    """
    removed = 0
    old_rows = (
        db.query(DailyWorkflowTask)
        .filter(DailyWorkflowTask.plan_id == plan.id, DailyWorkflowTask.user_id == plan.user_id)
        .all()
    )
    for row in old_rows:
        meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
        if meta.get("source_agent") == agent_key:
            db.delete(row)
            removed += 1

    added = 0
    for t in retried_tasks:
        pillar_id = str(t.get("pillarId") or "").lower().strip()
        if pillar_id not in PILLAR_IDS:
            continue
        db.add(DailyWorkflowTask(
            plan_id=plan.id,
            user_id=plan.user_id,
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
        ))
        added += 1
    return {"removed": removed, "added": added}


async def retry_agent_proposals(
    db: Session,
    user_id: str,
    agent_key: str,
    date: Optional[str] = None,
) -> Dict[str, Any]:
    """Re-run a single failed committee agent and merge its fresh proposals.

    Scopes ``generate_agent_enhanced_plan`` to ``agent_key`` with
    ``skip_meeting_lifecycle=True`` (so it neither creates a new meeting nor
    re-fires the digest email), injecting the current meeting context (other
    agents' accepted tasks + the prior failure) so the retried agent
    complements rather than duplicates.

    Merge semantics: the retried agent's persisted tasks are *replaced* by
    whatever the fresh run accepts (possibly zero). Other agents' tasks,
    the plan's digest outcome, and any calendar-sourced tasks are untouched.
    """
    date_str = date or _today_date_str()

    plan = (
        db.query(DailyWorkflowPlan)
        .filter(DailyWorkflowPlan.user_id == user_id, DailyWorkflowPlan.date == date_str)
        .first()
    )
    if plan is None:
        return {
            "success": False,
            "agent": agent_key,
            "error": f"No plan found for user {user_id} on {date_str}",
        }

    known_keys = {entry["agent_key"] for entry in AGENT_TEAM_CATALOG}
    if agent_key not in known_keys:
        return {"success": False, "agent": agent_key, "error": f"Unknown agent '{agent_key}'"}

    plan_json = plan.plan_json if isinstance(plan.plan_json, dict) else {}

    # Gather the current meeting context from *other* agents' persisted tasks so
    # the retried agent can complement them instead of producing duplicates.
    existing_rows = (
        db.query(DailyWorkflowTask)
        .filter(DailyWorkflowTask.plan_id == plan.id, DailyWorkflowTask.user_id == user_id)
        .all()
    )
    teammate_tasks = []
    prior_failure = None
    for row in existing_rows:
        meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
        source = meta.get("source_agent")
        if source == agent_key:
            continue
        teammate_tasks.append({
            "pillarId": row.pillar_id,
            "title": row.title,
            "description": row.description,
            "source_agent": source,
            "actionType": row.action_type,
        })

    for ev in plan_json.get("agent_evidence", []):
        if isinstance(ev, dict) and ev.get("agent") == agent_key and ev.get("error"):
            prior_failure = {"state": "error", "message": ev.get("error")}
            break

    grounding = build_grounding_context(db, user_id, date_str)
    grounding["retry"] = {
        "agent": agent_key,
        "prior_error": prior_failure,
        "meeting_context": teammate_tasks,
    }

    retry_data = await generate_agent_enhanced_plan(
        db,
        user_id,
        date_str,
        grounding=grounding,
        strict_contextuality=False,
        retry_agents=[agent_key],
        skip_meeting_lifecycle=True,
    )

    retried_tasks = [
        t for t in retry_data.get("tasks", [])
        if (t.get("pillarId") or "").lower().strip() in _COMMITTEE_PILLARS
    ]

    merge = _merge_retried_agent_tasks(db, plan, agent_key, retried_tasks)

    # Refresh the agent's evidence in plan_json (replace old entry for the agent).
    fresh_evidence = [
        ev for ev in retry_data.get("agent_evidence", [])
        if isinstance(ev, dict) and ev.get("agent") == agent_key
    ]
    agent_evidence = [
        ev for ev in plan_json.get("agent_evidence", [])
        if not (isinstance(ev, dict) and ev.get("agent") == agent_key)
    ]
    agent_evidence.extend(fresh_evidence)
    plan_json["agent_evidence"] = agent_evidence

    # Rebuild the task list in plan_json so downstream consumers that read
    # plan_json["tasks"] see the merged state (retried agent's tasks replaced,
    # others preserved in order).
    preserved_tasks = [
        t for t in plan_json.get("tasks", [])
        if (t.get("pillarId") or "").lower().strip() in _COMMITTEE_PILLARS
    ]
    replaced_titles = {
        t["title"] for t in preserved_tasks
        if (t.get("metadata") or {}).get("source_agent") == agent_key
    }
    kept_tasks = [t for t in preserved_tasks if t.get("title") not in replaced_titles]
    for t in retried_tasks:
        kept_tasks = [kt for kt in kept_tasks if kt.get("title") != t.get("title")]
        kept_tasks.append(t)
    plan_json["tasks"] = kept_tasks

    plan.plan_json = plan_json
    plan.updated_at = datetime.utcnow()
    plan.fallback_used = bool(plan_json.get("fallback_used", False))
    db.add(plan)
    db.commit()

    _record_retry_shared_note(user_id, agent_key, merge["added"], merge["removed"])

    return {
        "success": True,
        "agent": agent_key,
        "added_count": merge["added"],
        "replaced_count": merge["removed"],
        "tasks": retried_tasks,
        "digest": plan_json.get("digest"),
        "agent_evidence": agent_evidence,
    }


def _persist_workflow_tasks(
    thread_db: Session,
    plan_id: int,
    user_id: str,
    tasks: List[Dict[str, Any]],
) -> int:
    """Persist plan tasks as ``DailyWorkflowTask`` rows on ``thread_db``.

    Tasks whose ``pillarId`` is not a valid pillar are skipped with a
    warning (bad agent output stays debuggable). Returns the number of
    rows persisted. Shared by the create and forced-re-run paths so both
    keep identical persistence semantics.
    """
    persisted = 0
    for t in tasks:
        pillar_id = str(t.get("pillarId") or "").lower().strip()
        if pillar_id not in PILLAR_IDS:
            agent = None
            metadata = t.get("metadata")
            if isinstance(metadata, dict):
                agent = metadata.get("source_agent")
            logger.warning(
                f"Skipping task persistence for invalid pillar_id={pillar_id!r} "
                f"from agent {agent or 'unknown'}: title={t.get('title', '')}"
            )
            continue
        task = DailyWorkflowTask(
            plan_id=plan_id,
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
        persisted += 1
    return persisted


async def get_or_create_daily_workflow_plan(
    db: Session,
    user_id: str,
    date: Optional[str] = None,
    creation_source: str = "manual",
    allow_preview: bool = False,
    manual_override: Optional[bool] = None,
    force_rerun: bool = False,
) -> tuple[DailyWorkflowPlan, bool]:
    """Return today's persisted plan, creating it via the committee when absent.

    ``force_rerun`` re-runs the full committee even when a plan already exists
    for the date (the "Re-run preview" path): the existing plan row is kept
    (same id, same digest, same meeting linkage) but its tasks and
    ``plan_json`` are replaced with fresh committee output. The re-run uses
    ``skip_meeting_lifecycle=True`` so it never creates a second meeting
    record or re-fires the digest email.
    """
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

    # The short-circuit only applies when the caller did not ask for a
    # re-run; otherwise fall through to full regeneration below.
    if existing and not force_rerun:
        return existing, False
    # ``rerunning`` is True exactly when an existing plan is being replaced.
    rerunning = existing is not None

    grounding = build_grounding_context(db, user_id, date_str)

    # Step 1: Calendar events → generate pillar (SSOT for content creation)
    calendar_plan = _generate_calendar_event_plan(date_str, grounding)
    calendar_task_titles = {t.get("title") for t in calendar_plan.get("tasks", []) if t.get("title")}

    # Step 2: Agent committee → proposals for plan + analyze + engage + publish + remarket
    # A forced re-run replaces an existing plan's content, so it must not
    # create a second meeting record or re-fire the digest email — same
    # lifecycle-skipping semantics as the per-agent retry path.
    agent_plan_data = await generate_agent_enhanced_plan(
        db, user_id, date_str, grounding=grounding, strict_contextuality=False,
        allow_preview=allow_preview,
        manual_override=(creation_source in {"manual", "preview"}) if manual_override is None else manual_override,
        skip_meeting_lifecycle=rerunning,
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
    # Surface the digest outcome (enqueued / skipped_* / failed) that the
    # committee recorded, so downstream consumers and the API can report
    # why an email did or didn't fire instead of hiding it.
    plan_data["digest"] = agent_plan_data.get("digest", {"status": "skipped", "reason": "not_attempted"})
    tasks = plan_data.get("tasks", [])

    def _create_plan():
        # H5: own Session for the threadpool worker (callers' `db` is async-thread only).
        from services.database import get_session_for_user
        thread_db = get_session_for_user(user_id)
        if thread_db is None:
            raise RuntimeError(f"Failed to open DB session for user {user_id}")
        # Keep column attributes loaded after commit so the returned ``plan``
        # (and its ``plan_json``/counts) remain readable once this session is
        # closed — otherwise the caller hits "Instance is not bound to a Session".
        thread_db.expire_on_commit = False
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

            _persist_workflow_tasks(thread_db, plan.id, user_id, tasks)
            thread_db.commit()
            return plan, True
        finally:
            thread_db.close()

    def _replace_plan():
        """Replace an existing plan's content with fresh committee output.

        Keeps the plan row itself (same id — dashboard links, meeting
        linkage and digest history stay intact), swaps in the new
        ``plan_json`` and deletes + re-inserts every task row. The first
        run's digest and meeting id are preserved so a re-run never
        re-fires the digest email or orphans the meeting record.
        """
        from services.database import get_session_for_user
        thread_db = get_session_for_user(user_id)
        if thread_db is None:
            raise RuntimeError(f"Failed to open DB session for user {user_id}")
        thread_db.expire_on_commit = False
        try:
            plan_row = (
                thread_db.query(DailyWorkflowPlan)
                .filter(DailyWorkflowPlan.user_id == user_id, DailyWorkflowPlan.date == date_str)
                .first()
            )
            if plan_row is None:
                # The plan vanished between the short-circuit read and the
                # replace (a concurrent delete); surface it honestly.
                raise RuntimeError(
                    f"Plan for user {user_id} on {date_str} disappeared during re-run"
                )
            old_json = plan_row.plan_json if isinstance(plan_row.plan_json, dict) else {}
            if old_json.get("digest"):
                plan_data["digest"] = old_json["digest"]
            if old_json.get("meeting_id") and not plan_data.get("meeting_id"):
                plan_data["meeting_id"] = old_json["meeting_id"]

            plan_row.generation_mode = (
                "calendar_driven" if calendar_source else _derive_generation_mode(plan_data)
            )
            plan_row.committee_agent_count = (
                committee_polled_count or _count_committee_agents(tasks)
            )
            plan_row.fallback_used = bool(plan_data.get("fallback_used", False))
            plan_row.plan_json = plan_data
            plan_row.updated_at = datetime.utcnow()

            thread_db.query(DailyWorkflowTask).filter(
                DailyWorkflowTask.plan_id == plan_row.id,
                DailyWorkflowTask.user_id == user_id,
            ).delete(synchronize_session=False)
            _persist_workflow_tasks(thread_db, plan_row.id, user_id, tasks)
            thread_db.commit()
            thread_db.refresh(plan_row)
            return plan_row
        finally:
            thread_db.close()

    if rerunning:
        plan = await run_in_threadpool(_replace_plan)
        return plan, False
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


