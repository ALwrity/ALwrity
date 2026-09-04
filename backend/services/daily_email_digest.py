"""
Daily Email Digest Service

Sends a daily summary of the agent team's tasks to each user.
Designed per docs/DAILY_EMAIL_DIGEST_DESIGN.md

Responsibilities:
1. build_digest_payload: assembles plan, tasks, alerts, task-memory, transparency data
2. render_email: produces HTML for the email (verbose/production modes)
3. send_digest: checks opt-in, checks ledger, renders, calls Resend, records ledger
4. enqueue_digest: called by meeting completion path (non-blocking)
5. reconcile_missed_digests: reconciler to recover missed sends

Resend integration is stubbed until API is verified.
"""

import logging
import os
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, asdict, field

from sqlalchemy import and_
from sqlalchemy.sql import func

from models.daily_workflow_models import DailyWorkflowPlan, DailyWorkflowTask, TaskHistory
from models.daily_email_ledger import DailyEmailLedger
from models.agent_activity_models import AgentAlert
from models.onboarding import OnboardingSession
# TODO: Import TaskProposalMemory once the model exists
# from models.task_memory_models import TaskProposalMemory
from services.database import get_session_for_user
from services.tool_certification import get_agent_certification_rollup
from services.email_templates import (
    render_standard_digest,
    render_reengagement,
    render_weekly_digest,
)
from utils.logger_utils import get_service_logger

logger = get_service_logger(__name__)

# Persistence-race tolerance: ``finish_meeting`` enqueues the digest in a
# background thread BEFORE the caller persists the plan row, so the first
# payload build can legitimately find no plan yet. Poll briefly instead of
# terminally skipping. (A persisted plan with no tasks is still terminal —
# honest absence needs no email.)
_DIGEST_PLAN_WAIT_ATTEMPTS = 6
_DIGEST_PLAN_WAIT_SECONDS = 5


# =============================================================================
# Data Types
# =============================================================================

@dataclass
class TaskSummary:
    title: str
    pillar_id: str
    priority: str
    estimated_time: int
    status: str
    action_url: str
    source_agent: str
    synthesis_mode: str


@dataclass
class TaskMemorySignal:
    """Signal from task memory for recurring tasks."""
    title: str
    pillar_id: str
    completion_count: int
    last_completed: Optional[str]
    feedback_score: Optional[int]
    signal_text: str  # Human-readable signal


@dataclass
class CertificationInfo:
    """Per-agent certification summary for transparency."""
    agent: str
    state: str  # certified, certified_with_provider_dependency, degraded, not certified
    tools_total: int
    tools_blocked: int
    missing_gates: List[str]


@dataclass
class DigestPayload:
    date: str
    generation_mode: str
    synthesis_mode_breakdown: Dict[str, int]  # {"llm": N, "template_fallback": M, "data_derived": K}
    committee_agent_count: int
    tasks: List[TaskSummary]
    completed_count: int
    not_done_count: int
    completion_percentage: float
    total_estimated_time: int
    alerts: List[Dict[str, Any]]
    task_memory_signals: List[TaskMemorySignal]
    certification_summary: Dict[str, CertificationInfo]
    confidence_estimates: List[str]  # list of "agent: is_estimate" notes
    timezone: str
    # Phase 3b: transparency - what the end user should know about grounding
    limitations: List[str] = field(default_factory=list)
    sif_query_summary: Dict[str, int] = field(default_factory=dict)


@dataclass
class PillarThroughput:
    """Weekly completion per content pillar."""
    pillar_id: str
    proposed: int
    completed: int
    skipped: int
    completion_rate: float


@dataclass
class AgentThroughput:
    """Weekly acceptance per source agent."""
    agent: str
    proposed: int
    completed: int
    acceptance_rate: float


@dataclass
class WeeklySummaryPayload:
    """Aggregated weekly digest payload (design doc Sec 11)."""
    user_id: str
    week_label: str
    end_date: str
    total_tasks: int
    completed: int
    skipped: int
    completion_percentage: float
    pillars: List[PillarThroughput]
    agents: List[AgentThroughput]
    strongest_pillar: Optional[str]
    weakest_pillar: Optional[str]
    timezone: str


# =============================================================================
# Payload Builder
# =============================================================================

def _fetch_task_memory_signals(session, user_id: str, tasks: List[DailyWorkflowTask]) -> List[TaskMemorySignal]:
    """Fetch task memory signals for recurring tasks from TaskHistory."""
    from models.daily_workflow_models import TaskHistory
    
    signals = []
    task_titles = {t.title: t.pillar_id for t in tasks}
    if not task_titles:
        return signals
    
    try:
        memories = (
            session.query(TaskHistory)
            .filter(
                TaskHistory.user_id == user_id,
                TaskHistory.title.in_(list(task_titles.keys())),
                TaskHistory.status.in_(["completed", "dismissed", "rejected"]),
            )
            .order_by(TaskHistory.last_completed_at.desc())
            .limit(10)
            .all()
        )
        
        for mem in memories:
            signal_text = ""
            if mem.completion_count > 0:
                signal_text = f"Completed {mem.completion_count} time(s). "
                if mem.last_completed_at:
                    from datetime import timedelta
                    days_ago = (datetime.utcnow() - mem.last_completed_at).days
                    if days_ago == 0:
                        signal_text += "Last completed today."
                    elif days_ago == 1:
                        signal_text += "Last completed yesterday."
                    else:
                        signal_text += f"Last completed {days_ago} days ago."
            
            if mem.feedback_score is not None:
                if mem.feedback_score > 0:
                    signal_text += " User feedback: positive."
                elif mem.feedback_score < 0:
                    signal_text += " User feedback: negative."
            
            signals.append(TaskMemorySignal(
                title=mem.title,
                pillar_id=mem.pillar_id,
                completion_count=mem.completion_count,
                last_completed=mem.last_completed_at.isoformat() if mem.last_completed_at else None,
                feedback_score=mem.feedback_score,
                signal_text=signal_text.strip() or "No recent activity",
            ))
        
    except Exception as e:
        logger.warning(f"Could not fetch task memory signals: {e}")
    
    return signals


def _fetch_certification_summary(user_id: str) -> Dict[str, CertificationInfo]:
    """Fetch certification summary for transparency."""
    try:
        rollup = get_agent_certification_rollup()
        result = {}
        for agent, data in (rollup.get("agents") or {}).items():
            result[agent] = CertificationInfo(
                agent=agent,
                state=data.get("state", "unknown"),
                tools_total=data.get("tools_total", 0),
                tools_blocked=data.get("tools_blocked", 0),
                missing_gates=data.get("missing_gates", []),
            )
        return result
    except Exception as e:
        logger.warning(f"Could not fetch certification summary: {e}")
        return {}


def build_digest_payload(user_id: str, date: str, verbose: bool = True) -> Optional[DigestPayload]:
    """Assemble the daily digest payload from all data sources."""
    session = get_session_for_user(user_id)
    try:
        # Get today's plan
        plan = (
            session.query(DailyWorkflowPlan)
            .filter(
                DailyWorkflowPlan.user_id == user_id,
                DailyWorkflowPlan.date == date,
            )
            .first()
        )

        if not plan:
            logger.info(f"No plan found for user {user_id} on {date}")
            return None

        # Get tasks for this plan
        tasks = (
            session.query(DailyWorkflowTask)
            .filter(
                DailyWorkflowTask.plan_id == plan.id,
                DailyWorkflowTask.user_id == user_id,
            )
            .all()
        )

        # Build task summaries
        task_summaries: List[TaskSummary] = []
        completed_count = 0
        not_done_count = 0
        total_estimated_time = 0
        synthesis_mode_breakdown: Dict[str, int] = {"llm": 0, "template_fallback": 0, "data_derived": 0}

        for task in tasks:
            metadata = task.metadata_json or {}
            synthesis_mode = metadata.get("synthesis_mode", "unknown")
            if synthesis_mode in synthesis_mode_breakdown:
                synthesis_mode_breakdown[synthesis_mode] += 1
            else:
                synthesis_mode_breakdown["template_fallback"] += 1  # default fallback

            task_summary = TaskSummary(
                title=task.title,
                pillar_id=task.pillar_id,
                priority=task.priority,
                estimated_time=task.estimated_time,
                status=task.status,
                action_url=task.action_url or "",
                source_agent=metadata.get("source_agent", "unknown"),
                synthesis_mode=synthesis_mode,
            )
            task_summaries.append(task_summary)

            if task.status == "completed":
                completed_count += 1
            else:
                not_done_count += 1
            total_estimated_time += task.estimated_time

        # Get task memory signals (recurring tasks, feedback)
        task_memory_signals = _fetch_task_memory_signals(session, user_id, tasks)

        # Get alerts (filtered by severity for production mode)
        alerts_query = (
            session.query(AgentAlert)
            .filter(AgentAlert.user_id == user_id)
            .order_by(AgentAlert.created_at.desc())
            .limit(50 if verbose else 10)
            .all()
        )

        alerts = []
        for alert in alerts_query:
            if verbose or alert.severity in ("high", "error"):
                alerts.append({
                    "title": alert.title,
                    "message": alert.message,
                    "severity": alert.severity,
                    "alert_type": alert.alert_type,
                    "cta_path": alert.cta_path,
                })

        # Get user timezone from onboarding session
        onboarding = (
            session.query(OnboardingSession)
            .filter(OnboardingSession.user_id == user_id)
            .first()
        )
        user_timezone = onboarding.timezone if onboarding and onboarding.timezone else "UTC"

        # Get certification summary for transparency
        certification_summary = _fetch_certification_summary(user_id)

        completion_percentage = (
            (completed_count / len(tasks) * 100) if tasks else 0.0
        )

        # Phase 3b: extract transparency data from the plan's evidence
        plan_json = plan.plan_json if isinstance(plan.plan_json, dict) else {}
        limitations = [str(l) for l in (plan_json.get("limitations") or []) if l]
        sif_qs = {"total": 0, "success": 0, "miss": 0, "miss_healed": 0, "error": 0}
        for ev in (plan_json.get("agent_evidence") or []):
            for q in (ev.get("sif_queries") or []):
                if isinstance(q, dict):
                    sif_qs["total"] += 1
                    outcome = q.get("outcome", "unknown")
                    if outcome in sif_qs:
                        sif_qs[outcome] += 1

        result = DigestPayload(
            date=date,
            generation_mode=plan.generation_mode or "unknown",
            synthesis_mode_breakdown=synthesis_mode_breakdown,
            committee_agent_count=plan.committee_agent_count or 0,
            tasks=task_summaries,
            completed_count=completed_count,
            not_done_count=not_done_count,
            completion_percentage=round(completion_percentage, 1),
            total_estimated_time=total_estimated_time,
            alerts=alerts,
            task_memory_signals=task_memory_signals,
            certification_summary=certification_summary,
            confidence_estimates=[],  # Could wire from market_signal metadata if available
            timezone=user_timezone,
        )

        result.limitations = limitations
        result.sif_query_summary = sif_qs
        return result

    except Exception as e:
        logger.error(f"Error building digest payload for user {user_id}: {e}")
        return None
    finally:
        session.close()


# =============================================================================
# Weekly summary payload builder
# =============================================================================

def build_weekly_payload(user_id: str, end_date: Optional[str] = None) -> Optional[WeeklySummaryPayload]:
    """Aggregate the last 7 days of tasks into a weekly summary (design Sec 11).

    ``end_date`` defaults to today (YYYY-MM-DD); the window is the 7 days ending
    on it. Returns None when the user has no task rows in the window.
    """
    if not end_date:
        end_date = datetime.utcnow().strftime("%Y-%m-%d")

    session = get_session_for_user(user_id)
    try:
        start_dt = datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=6)
        start_date = start_dt.strftime("%Y-%m-%d")

        plan_rows = (
            session.query(DailyWorkflowPlan)
            .filter(
                DailyWorkflowPlan.user_id == user_id,
                DailyWorkflowPlan.date >= start_date,
                DailyWorkflowPlan.date <= end_date,
            )
            .all()
        )
        plan_ids = [p.id for p in plan_rows]
        if not plan_ids:
            return None

        tasks = (
            session.query(DailyWorkflowTask)
            .filter(
                DailyWorkflowTask.plan_id.in_(plan_ids),
                DailyWorkflowTask.user_id == user_id,
            )
            .all()
        )
        if not tasks:
            return None

        completed = 0
        skipped = 0
        total = len(tasks)
        pillar_stats: Dict[str, List[int]] = {}  # pillar -> [proposed, completed]
        agent_stats: Dict[str, List[int]] = {}   # agent -> [proposed, completed]

        for task in tasks:
            meta = task.metadata_json or {}
            agent = meta.get("source_agent", "unknown")
            agent_stats.setdefault(agent, [0, 0])[0] += 1
            pillar_stats.setdefault(task.pillar_id, [0, 0])[0] += 1

            if task.status == "completed":
                completed += 1
                agent_stats[agent][1] += 1
                pillar_stats[task.pillar_id][1] += 1
            elif task.status in ("dismissed", "rejected", "skipped"):
                skipped += 1

        pillars = sorted(
            (
                PillarThroughput(
                    pillar_id=p,
                    proposed=s[0],
                    completed=s[1],
                    skipped=s[0] - s[1],
                    completion_rate=(s[1] / s[0] * 100) if s[0] else 0.0,
                )
                for p, s in pillar_stats.items()
            ),
            key=lambda x: x.pillar_id or "",
        )
        agents = sorted(
            (
                AgentThroughput(
                    agent=a,
                    proposed=s[0],
                    completed=s[1],
                    acceptance_rate=(s[1] / s[0] * 100) if s[0] else 0.0,
                )
                for a, s in agent_stats.items()
            ),
            key=lambda x: (x.acceptance_rate, x.agent or ""),
            reverse=True,
        )

        strongest = max(pillars, key=lambda x: x.completion_rate).pillar_id if pillars else None
        weakest = min(pillars, key=lambda x: x.completion_rate).pillar_id if pillars else None

        onboarding = (
            session.query(OnboardingSession)
            .filter(OnboardingSession.user_id == user_id)
            .first()
        )
        tz = onboarding.timezone if onboarding and onboarding.timezone else "UTC"

        return WeeklySummaryPayload(
            user_id=user_id,
            week_label=f"7 days ending {end_date}",
            end_date=end_date,
            total_tasks=total,
            completed=completed,
            skipped=skipped,
            completion_percentage=round(completed / total * 100, 1),
            pillars=pillars,
            agents=agents,
            strongest_pillar=strongest,
            weakest_pillar=weakest,
            timezone=tz,
        )

    except Exception as e:
        logger.error(f"Error building weekly payload for user {user_id}: {e}")
        return None
    finally:
        session.close()


# =============================================================================
# Re-engagement idle detection
# =============================================================================

def _should_reengage(session, user_id: str, idle_days: Optional[int] = None) -> bool:
    """Return True when the user has zero completed tasks in the idle window.

    Implements the design doc's re-engagement hook (Sec 10): when the user has
    had no task completion for ``idle_days`` (default 3, configurable via the
    ``REENGAGEMENT_IDLE_DAYS`` env var), the digest flips to the bold
    re-engagement variant and a themed subject.
    """
    if idle_days is None:
        idle_days = int(os.environ.get("REENGAGEMENT_IDLE_DAYS", "3"))
    if idle_days <= 0:
        return False

    cutoff = datetime.utcnow() - timedelta(days=idle_days)
    try:
        completed_count = (
            session.query(func.count(TaskHistory.id))
            .filter(
                TaskHistory.user_id == user_id,
                TaskHistory.status == "completed",
                TaskHistory.last_completed_at >= cutoff,
            )
            .scalar()
            or 0
        )
        return completed_count == 0
    except Exception as e:
        # Fail-open to the standard digest on any query failure; never block a send.
        logger.warning(f"Re-engagement check failed for {user_id}: {e}")
        return False


# =============================================================================
# Email Renderer
# =============================================================================

def render_email(payload: DigestPayload, verbose: bool = True, reengage: bool = False) -> str:
    """Render the email HTML.

    Dispatches to the data-driven production templates in ``email_templates``:
    the two-column standard digest by default, or the bold re-engagement
    variant when ``reengage`` is True.
    """
    if reengage:
        return render_reengagement(payload, verbose)
    html = render_standard_digest(payload, verbose)

    # Phase 3b: transparency footer - show the plan's grounding quality
    transparency_parts = []
    if getattr(payload, "limitations", None):
        lim_items = "".join(f"<li style='margin:4px 0'>{l}</li>" for l in payload.limitations)
        transparency_parts.append(
            f"<div style='margin:8px 0'><strong>Limitations this run:</strong>"
            f"<ul style='margin:4px 0;padding-left:20px'>{lim_items}</ul></div>"
        )
    sif_qs = getattr(payload, "sif_query_summary", None)
    if sif_qs and sif_qs.get("total", 0) > 0:
        transparency_parts.append(
            f"<div style='margin:8px 0'><strong>SIF searches:</strong> "
            f"{sif_qs['total']} queries ({sif_qs.get('success', 0)} found, "
            f"{sif_qs.get('miss', 0)} empty)</div>"
        )
    if transparency_parts:
        footer = (
            "<div style='border-top:1px solid #e0e0e0;margin-top:16px;padding-top:12px;"
            "font-size:0.85em;color:#666'>"
            "<strong>Plan transparency</strong><br/>"
            + "".join(transparency_parts)
            + "</div>"
        )
        html = html + footer

    return html


# =============================================================================
# Resend Integration
# =============================================================================

def _send_via_resend(to_email: str, subject: str, html: str) -> Optional[str]:
    """
    Send email via Resend SDK.
    Returns message_id on success, None on failure.
    """
    import os
    import resend
    from resend.exceptions import ResendError, RateLimitError, ValidationError

    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        logger.error("RESEND_API_KEY not configured")
        return None

    resend.api_key = api_key

    from_address = os.environ.get("RESEND_FROM_ADDRESS", "ALwrity <digest@alwrity.ai>")

    params: resend.Emails.SendParams = {
        "from": from_address,
        "to": [to_email],
        "subject": subject,
        "html": html,
        "tags": [
            {"name": "type", "value": "daily_digest"},
        ],
    }

    try:
        response = resend.Emails.send(params)
        message_id = response.get("id")
        if message_id:
            logger.info(f"Email sent successfully to {to_email}, message_id: {message_id}")
            return message_id
        else:
            logger.error(f"Resend response missing id: {response}")
            return None
    except RateLimitError as e:
        logger.warning(f"Resend rate limit exceeded: {e}")
        return None
    except ValidationError as e:
        logger.error(f"Resend validation error: {e}")
        return None
    except ResendError as e:
        logger.error(f"Resend error: {e.code} - {e.message}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error sending email: {e}")
        return None


# =============================================================================
# Send Logic
# =============================================================================

def send_digest(
    user_id: str,
    date: str,
    contact_email: str,
    email_type: str = "daily",
    verbose: bool = True,
) -> bool:
    """
    Send the daily digest to a user.
    Returns True if sent (or skipped appropriately), False on error.
    """
    session = get_session_for_user(user_id)
    try:
        # Check ledger for existing send
        existing = (
            session.query(DailyEmailLedger)
            .filter(
                and_(
                    DailyEmailLedger.user_id == user_id,
                    DailyEmailLedger.plan_date == date,
                    DailyEmailLedger.email_type == email_type,
                )
            )
            .first()
        )

        if existing:
            if existing.status == "sent":
                logger.info(f"Digest already sent for user {user_id} on {date}")
                return True
            if existing.status == "skipped_opted_out":
                logger.info(f"User {user_id} has opted out")
                return True

        # Check opt-in status from onboarding
        onboarding = (
            session.query(OnboardingSession)
            .filter(OnboardingSession.user_id == user_id)
            .first()
        )
        user_opted_in = onboarding.email_digest_opt_in if onboarding else False

        if not user_opted_in:
            # Record skipped
            if existing:
                existing.status = "skipped_opted_out"
                existing.updated_at = func.now()
            else:
                ledger = DailyEmailLedger(
                    user_id=user_id,
                    plan_date=date,
                    email_type=email_type,
                    status="skipped_opted_out",
                )
                session.add(ledger)
            session.commit()
            logger.info(f"User {user_id} has opted out of email digest")
            return True

        # Build payload. The plan row is persisted by the CALLER after the
        # committee returns, while this digest runs in a background thread —
        # so the plan may not exist yet when we start. Poll briefly for the
        # plan instead of racing it. (A persisted plan with no tasks is
        # still terminal: honest absence needs no email.)
        payload = None
        for attempt in range(_DIGEST_PLAN_WAIT_ATTEMPTS):
            payload = build_digest_payload(user_id, date, verbose)
            if payload is not None:
                break
            if attempt < _DIGEST_PLAN_WAIT_ATTEMPTS - 1:
                logger.info(
                    f"Plan not persisted yet for user {user_id} on {date} "
                    f"(attempt {attempt + 1}/{_DIGEST_PLAN_WAIT_ATTEMPTS}); "
                    f"waiting {_DIGEST_PLAN_WAIT_SECONDS}s"
                )
                time.sleep(_DIGEST_PLAN_WAIT_SECONDS)
        if not payload or not payload.tasks:
            if existing:
                existing.status = "skipped_no_content"
                existing.updated_at = func.now()
            else:
                ledger = DailyEmailLedger(
                    user_id=user_id,
                    plan_date=date,
                    email_type=email_type,
                    status="skipped_no_content",
                )
                session.add(ledger)
            session.commit()
            logger.info(f"No sendable content for user {user_id} on {date}")
            return True

        # Re-engagement trigger (design doc Sec 10): zero completed tasks in the
        # idle window flips the subject and leads with the bold variant.
        reengage = _should_reengage(session, user_id)
        if reengage:
            pending = [t for t in payload.tasks if t.status != "completed"]
            subject = f"You have {len(pending)} pending tasks — here's the quickest one"
            logger.info(f"Re-engagement digest selected for user {user_id} on {date}")
        else:
            subject = f"Your Daily ALwrity Plan — {payload.completed_count}/{len(payload.tasks)} tasks done"

        # Render email
        html = render_email(payload, verbose, reengage=reengage)

        # Send via Resend (stubbed)
        message_id = _send_via_resend(contact_email, subject, html)

        if message_id:
            # Record success
            if existing:
                existing.status = "sent"
                existing.sent_at = func.now()
                existing.resend_message_id = message_id
                existing.updated_at = func.now()
            else:
                ledger = DailyEmailLedger(
                    user_id=user_id,
                    plan_date=date,
                    email_type=email_type,
                    status="sent",
                    sent_at=func.now(),
                    resend_message_id=message_id,
                )
                session.add(ledger)
            session.commit()
            logger.info(f"Digest sent to {contact_email} (msg_id: {message_id})")
            return True
        else:
            # Record failure
            if existing:
                existing.status = "failed"
                existing.error_message = "Resend API returned no message_id"
                existing.updated_at = func.now()
            else:
                ledger = DailyEmailLedger(
                    user_id=user_id,
                    plan_date=date,
                    email_type=email_type,
                    status="failed",
                    error_message="Resend API returned no message_id",
                )
                session.add(ledger)
            session.commit()
            return False

    except Exception as e:
        logger.error(f"Error sending digest to user {user_id}: {e}")
        # Record failure
        try:
            existing = (
                session.query(DailyEmailLedger)
                .filter(
                    and_(
                        DailyEmailLedger.user_id == user_id,
                        DailyEmailLedger.plan_date == date,
                        DailyEmailLedger.email_type == email_type,
                    )
                )
                .first()
            )
            if existing:
                existing.status = "failed"
                existing.error_message = str(e)[:500]
                existing.updated_at = func.now()
            else:
                ledger = DailyEmailLedger(
                    user_id=user_id,
                    plan_date=date,
                    email_type=email_type,
                    status="failed",
                    error_message=str(e)[:500],
                )
                session.add(ledger)
            session.commit()
        except Exception:
            pass
        return False
    finally:
        session.close()


def enqueue_digest(user_id: str, date: str, contact_email: str) -> None:
    """
    Non-blocking entry point called by the meeting completion path.
    For now, just calls send_digest directly (in production, would enqueue to a job queue).
    """
    # In production: would add to a job queue (e.g., Redis/Bull, or Celery)
    # For now, spawn async to not block the meeting completion
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(asyncio.to_thread(send_digest, user_id, date, contact_email))
        else:
            loop.run_until_complete(asyncio.to_thread(send_digest, user_id, date, contact_email))
    except Exception as e:
        logger.error(f"Failed to enqueue digest for user {user_id}: {e}")


def reconcile_missed_digests(lookback_days: int = 3) -> int:
    """
    Reconciler to find and send missed digests.

    Pulls pending/failed ledger rows within the lookback window, resolves each
    user's contact email + opt-in from onboarding, and re-sends inline using
    the real render + Resend path so the ledger status stays the source of truth.

    Returns count of digests actually sent (status == "sent").
    """
    cutoff_date = (datetime.utcnow() - timedelta(days=lookback_days)).strftime("%Y-%m-%d")

    session = get_session_for_user("system")  # System session to query all users
    try:
        missed = (
            session.query(DailyEmailLedger)
            .filter(
                DailyEmailLedger.plan_date >= cutoff_date,
                DailyEmailLedger.status.in_(["pending", "failed"]),
            )
            .all()
        )

        sent = 0
        for ledger in missed:
            onboarding = (
                session.query(OnboardingSession)
                .filter(OnboardingSession.user_id == ledger.user_id)
                .first()
            )
            contact_email = onboarding.contact_email if onboarding and onboarding.contact_email else None
            opted_in = bool(onboarding and onboarding.email_digest_opt_in)

            if not opted_in:
                ledger.status = "skipped_opted_out"
                ledger.updated_at = func.now()
                logger.info(f"Reconciler: user {ledger.user_id} opted out; skipping digest")
                continue

            if not contact_email:
                ledger.status = "failed"
                ledger.error_message = "Reconciler: no contact email found"
                ledger.updated_at = func.now()
                logger.info(f"Reconciler: no contact email for user {ledger.user_id}")
                continue

            # Build payload via the same builder the live path uses (with the
            # persistence-race tolerance). It opens its own session.
            payload = build_digest_payload(ledger.user_id, ledger.plan_date, verbose=True)
            if not payload or not payload.tasks:
                ledger.status = "skipped_no_content"
                ledger.error_message = "Reconciler: no sendable content"
                ledger.updated_at = func.now()
                logger.info(f"Reconciler: no content for user {ledger.user_id} on {ledger.plan_date}")
                continue

            # Re-engagement subject flip (same logic as send_digest).
            reengage = _should_reengage(session, ledger.user_id)
            pending = [t for t in payload.tasks if t.status != "completed"]
            if reengage:
                subject = f"You have {len(pending)} pending tasks — here's the quickest one"
            else:
                subject = f"Your Daily ALwrity Plan — {payload.completed_count}/{len(payload.tasks)} tasks done"

            html = render_email(payload, verbose=True, reengage=reengage)
            message_id = _send_via_resend(contact_email, subject, html)

            if message_id:
                ledger.status = "sent"
                ledger.sent_at = func.now()
                ledger.resend_message_id = message_id
                ledger.updated_at = func.now()
                sent += 1
                logger.info(f"Reconciler sent digest to {contact_email} (msg_id: {message_id})")
            else:
                ledger.status = "failed"
                ledger.error_message = "Reconciler: Resend returned no message_id"
                ledger.updated_at = func.now()
                logger.warning(f"Reconciler: send failed for user {ledger.user_id}")

        session.commit()
        logger.info(f"Reconciler sent {sent} missed digest(s)")
        return sent

    except Exception as e:
        logger.error(f"Error running reconciler: {e}")
        return 0
    finally:
        try:
            session.close()
        except Exception:
            pass


# =============================================================================
# Weekly summary send
# =============================================================================

def send_weekly_digest(user_id: str, contact_email: str, end_date: Optional[str] = None) -> bool:
    """Send a single user's weekly summary (design doc Sec 11).

    Records on the ``weekly`` ledger row so it does not count against the daily
    limit and stays idempotent per week. Returns True if sent (or terminally
    skipped), False on Rerror.
    """
    session = get_session_for_user(user_id)
    try:
        if not end_date:
            end_date = datetime.utcnow().strftime("%Y-%m-%d")
        email_type = "weekly"

        existing = (
            session.query(DailyEmailLedger)
            .filter(
                and_(
                    DailyEmailLedger.user_id == user_id,
                    DailyEmailLedger.plan_date == end_date,
                    DailyEmailLedger.email_type == email_type,
                )
            )
            .first()
        )
        if existing and existing.status == "sent":
            return True

        onboarding = (
            session.query(OnboardingSession)
            .filter(OnboardingSession.user_id == user_id)
            .first()
        )
        if not (onboarding and onboarding.email_digest_opt_in):
            if not existing:
                session.add(DailyEmailLedger(
                    user_id=user_id, plan_date=end_date, email_type=email_type,
                    status="skipped_opted_out",
                ))
                session.commit()
            return True

        payload = build_weekly_payload(user_id, end_date)
        if not payload or payload.total_tasks == 0:
            if not existing:
                session.add(DailyEmailLedger(
                    user_id=user_id, plan_date=end_date, email_type=email_type,
                    status="skipped_no_content",
                ))
                session.commit()
            return True

        html = render_weekly_digest(payload, verbose=True)
        subject = f"Your Weekly ALwrity Summary — {payload.completed}/{payload.total_tasks} tasks done"
        message_id = _send_via_resend(contact_email, subject, html)

        if message_id:
            if existing:
                existing.status = "sent"
                existing.sent_at = func.now()
                existing.resend_message_id = message_id
                existing.updated_at = func.now()
            else:
                session.add(DailyEmailLedger(
                    user_id=user_id, plan_date=end_date, email_type=email_type,
                    status="sent", sent_at=func.now(), resend_message_id=message_id,
                ))
            session.commit()
            logger.info(f"Weekly digest sent to {contact_email} (msg_id: {message_id})")
            return True

        if not existing:
            session.add(DailyEmailLedger(
                user_id=user_id, plan_date=end_date, email_type=email_type,
                status="failed", error_message="Resend API returned no message_id",
            ))
            session.commit()
        return False

    except Exception as e:
        logger.error(f"Error sending weekly digest to {user_id}: {e}")
        return False
    finally:
        session.close()


def _iter_opted_in_users(session):
    """Yield (user_id, contact_email) for every opted-in onboarding session."""
    rows = session.query(OnboardingSession).filter(
        OnboardingSession.email_digest_opt_in.is_(True)
    ).all()
    for row in rows:
        if row.contact_email:
            yield row.user_id, row.contact_email


def send_weekly_summaries(end_date: Optional[str] = None) -> int:
    """Batch-send weekly summaries to all opted-in users (cron entry point)."""
    if not end_date:
        end_date = datetime.utcnow().strftime("%Y-%m-%d")

    session = get_session_for_user("system")
    sent = 0
    try:
        for user_id, contact_email in _iter_opted_in_users(session):
            try:
                if send_weekly_digest(user_id, contact_email, end_date):
                    # Count only actual sends; a skip also returns True.
                    row = (
                        session.query(DailyEmailLedger)
                        .filter(
                            and_(
                                DailyEmailLedger.user_id == user_id,
                                DailyEmailLedger.plan_date == end_date,
                                DailyEmailLedger.email_type == "weekly",
                            )
                        )
                        .first()
                    )
                    if row and row.status == "sent":
                        sent += 1
            except Exception as e:
                logger.error(f"Weekly digest error for {user_id}: {e}")
        return sent
    except Exception as e:
        logger.error(f"Error running weekly summary batch: {e}")
        return sent
    finally:
        session.close()
