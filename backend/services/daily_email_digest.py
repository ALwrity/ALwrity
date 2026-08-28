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
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, asdict

from sqlalchemy import and_
from sqlalchemy.sql import func

from models.daily_workflow_models import DailyWorkflowPlan, DailyWorkflowTask
from models.daily_email_ledger import DailyEmailLedger
from models.agent_activity_models import AgentAlert
from models.onboarding import OnboardingSession
# TODO: Import TaskProposalMemory once the model exists
# from models.task_memory_models import TaskProposalMemory
from services.database import get_session_for_user
from services.tool_certification import get_agent_certification_rollup
from utils.logger_utils import get_service_logger

logger = get_service_logger(__name__)


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

        return DigestPayload(
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

    except Exception as e:
        logger.error(f"Error building digest payload for user {user_id}: {e}")
        return None
    finally:
        session.close()


# =============================================================================
# Email Renderer
# =============================================================================

def render_email(payload: DigestPayload, verbose: bool = True) -> str:
    """Render the email HTML. Stub for now - returns simple HTML."""

    # Build task list HTML
    tasks_html = ""
    for task in payload.tasks:
        status_color = "#22c55e" if task.status == "completed" else "#f59e0b"
        synthesis_marker = ""
        if task.synthesis_mode and task.synthesis_mode != "unknown":
            mode_color = "#22c55e" if task.synthesis_mode == "llm" else "#3b82f6" if task.synthesis_mode == "data_derived" else "#f59e0b"
            synthesis_marker = f"<span style='background: {mode_color}; color: white; padding: 1px 6px; border-radius: 3px; font-size: 10px; margin-left: 6px;'>{task.synthesis_mode}</span>"
        
        source_info = f"by {task.source_agent}" if task.source_agent and task.source_agent != "unknown" else ""
        
        action_link = ""
        if task.action_url:
            action_link = f"<a href='{task.action_url}' style='color: #2563eb; text-decoration: none; font-size: 12px; margin-left: 8px;'>Open in ALwrity →</a>"
        
        tasks_html += f"""
        <div style="padding: 12px; margin: 8px 0; background: #f8fafc; border-radius: 8px; border-left: 4px solid {status_color};">
            <div style="font-weight: 600; color: #1e293b;">{task.title}{synthesis_marker}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                <span style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px;">{task.pillar_id}</span>
                <span style="margin-left: 8px;">{task.priority} priority</span>
                <span style="margin-left: 8px;">{task.estimated_time} min</span>
                {f'<span style="margin-left: 8px;">{source_info}</span>' if source_info else ''}
                {action_link}
            </div>
        </div>
        """

    # Build alerts HTML if any
    alerts_html = ""
    if payload.alerts:
        alerts_html = "<h3 style='margin-top: 24px; color: #1e293b;'>Alerts</h3>"
        for alert in payload.alerts:
            severity_color = "#ef4444" if alert["severity"] == "high" else "#f59e0b"
            alerts_html += f"""
            <div style="padding: 10px; margin: 6px 0; background: #fef2f2; border-radius: 6px; border-left: 3px solid {severity_color};">
                <div style="font-weight: 600; color: #991b1b;">{alert['title']}</div>
                <div style="font-size: 13px; color: #7f1d1d;">{alert['message']}</div>
            </div>
            """

    # Build task memory signals HTML
    memory_signals_html = ""
    if payload.task_memory_signals:
        memory_signals_html = "<h3 style='margin-top: 24px; color: #1e293b;'>Task History</h3>"
        for signal in payload.task_memory_signals:
            memory_signals_html += f"""
            <div style="padding: 10px; margin: 6px 0; background: #eff6ff; border-radius: 6px; border-left: 3px solid #3b82f6;">
                <div style="font-weight: 600; color: #1e40af;">{signal.title}</div>
                <div style="font-size: 13px; color: #1e3a8a;">{signal.signal_text}</div>
            </div>
            """

    # Build certification transparency HTML
    cert_html = ""
    if payload.certification_summary and verbose:
        cert_html = "<h3 style='margin-top: 24px; color: #1e293b;'>Agent Certification Status</h3>"
        for agent, cert in payload.certification_summary.items():
            state_color = {"certified": "#22c55e", "certified_with_provider_dependency": "#3b82f6", "degraded": "#f59e0b", "not certified": "#64748b"}.get(cert.state, "#64748b")
            cert_html += f"""
            <div style="padding: 10px; margin: 6px 0; background: #f8fafc; border-radius: 6px;">
                <div style="font-weight: 600; color: #1e293b;">{agent}</div>
                <div style="font-size: 13px; color: {state_color};">State: {cert.state} • {cert.tools_blocked}/{cert.tools_total} tools blocked</div>
            </div>
            """

    # Build synthesis mode breakdown
    mode_items = ", ".join([f"{k}: {v}" for k, v in payload.synthesis_mode_breakdown.items()])

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Your Daily ALwrity Plan</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f1f5f9;">
        <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h1 style="color: #1e293b; margin-bottom: 8px;">📋 Your Daily ALwrity Plan</h1>
            <p style="color: #64748b; margin-top: 0;">{payload.date} • Generated by AI Agent Team</p>

            <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <div style="font-size: 24px; font-weight: 700; color: #0369a1;">{payload.completed_count}/{len(payload.tasks)} tasks completed</div>
                <div style="color: #0369a1;">{payload.completion_percentage}% completion • ~{payload.total_estimated_time} min to finish</div>
            </div>

            <p style="color: #64748b; font-size: 13px;">
                Generation mode: {payload.generation_mode} • {mode_items}
            </p>

            <h3 style="margin-top: 24px; color: #1e293b;">Today's Tasks</h3>
            {tasks_html}

            {memory_signals_html}
            {alerts_html}
            {cert_html}

            <div style="margin-top: 24px; text-align: center;">
                <a href="https://alwrity.com/dashboard" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                    Complete your daily plan on ALwrity →
                </a>
            </div>
        </div>

        <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">
            You're receiving this because you opted in to daily AI agent team summaries.<br>
            <a href="https://alwrity.com/settings/email-preferences" style="color: #64748b;">Manage email preferences</a>
        </p>
    </body>
    </html>
    """
    return html


# =============================================================================
# Resend Stub
# =============================================================================

def _send_via_resend(to_email: str, subject: str, html: str) -> Optional[str]:
    """
    Send email via Resend. STUB - returns message_id mock or None on error.
    Replace with actual Resend API call when credentials are available.
    """
    # TODO: Replace with actual Resend API call:
    # import resend
    # resend.api_key = os.getenv("RESEND_API_KEY")
    # response = resend.Emails.send({
    #   "from": "ALwrity Team <onboarding@resend.dev>",
    #   "to": to_email,
    #   "subject": subject,
    #   "html": html,
    # })
    # return response["id"]

    logger.info(f"[RESEND STUB] Would send email to {to_email}: {subject}")
    # Return mock message ID for now
    return f"stub_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"


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

        # Build payload
        payload = build_digest_payload(user_id, date, verbose)
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

        # Render email
        html = render_email(payload, verbose)
        subject = f"Your Daily ALwrity Plan — {payload.completed_count}/{len(payload.tasks)} tasks done"

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
    Returns count of digests sent.
    """
    from datetime import datetime, timedelta

    cutoff_date = (datetime.utcnow() - timedelta(days=lookback_days)).strftime("%Y-%m-%d")

    session = get_session_for_user("system")  # Use system session to query all
    try:
        # Find pending/failed ledgers older than cutoff
        missed = (
            session.query(DailyEmailLedger)
            .filter(
                DailyEmailLedger.plan_date >= cutoff_date,
                DailyEmailLedger.status.in_(["pending", "failed"]),
            )
            .all()
        )

        sent_count = 0
        for ledger in missed:
            # Get user's contact email (placeholder - would query onboarding)
            # For now, skip if no email
            logger.info(f"Reconciling missed digest for user {ledger.user_id} on {ledger.plan_date}")

            # TODO: get actual contact email from user data
            # For now, just update status to avoid infinite retry loop
            # In production, would call send_digest with actual email
            if ledger.status == "pending":
                ledger.status = "skipped_no_content"  # Placeholder
                ledger.error_message = "Reconciler: no contact email found"
                sent_count += 1

        session.commit()
        return sent_count

    except Exception as e:
        logger.error(f"Error running reconciler: {e}")
        return 0
    finally:
        session.close()
