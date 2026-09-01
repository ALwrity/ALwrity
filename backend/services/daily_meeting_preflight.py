"""Data preflight and evidence envelopes for daily committee meetings."""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional


def _check(status: str, detail: str, **metadata: Any) -> Dict[str, Any]:
    return {"status": status, "detail": detail, **metadata}


def _freshness_status(onboarding: Dict[str, Any]) -> Dict[str, Any]:
    quality = onboarding.get("data_quality") if isinstance(onboarding, dict) else {}
    score = quality.get("freshness") if isinstance(quality, dict) else None
    sources: Dict[str, Any] = {}
    for name, value in onboarding.items():
        if not isinstance(value, dict):
            continue
        source_score = value.get("data_freshness", value.get("freshness"))
        updated_at = value.get("updated_at") or value.get("created_at")
        if source_score is None and updated_at:
            try:
                timestamp = datetime.fromisoformat(str(updated_at).replace("Z", "+00:00"))
                if timestamp.tzinfo is None:
                    timestamp = timestamp.replace(tzinfo=timezone.utc)
                age_hours = max(0.0, (datetime.now(timezone.utc) - timestamp).total_seconds() / 3600)
                source_score = max(0.0, min(1.0, 1.0 - (age_hours / (24 * 30))))
            except (TypeError, ValueError):
                source_score = None
        if source_score is not None:
            try:
                sources[name] = {"score": round(float(source_score), 4), "updated_at": updated_at}
            except (TypeError, ValueError):
                sources[name] = {"score": None, "updated_at": updated_at}
    if score is None:
        return _check("unknown", "freshness score is unavailable", sources=sources)
    try:
        score = float(score)
    except (TypeError, ValueError):
        return _check("unknown", "freshness score is invalid", sources=sources)
    return _check("available" if score >= 0.5 else "stale", f"freshness score {score:.2f}", score=score, sources=sources)


def run_daily_meeting_preflight(
    user_id: str,
    db: Any,
    grounding: Optional[Dict[str, Any]],
    meeting_date: str,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Collect preflight facts without creating recommendations."""
    grounding = grounding if isinstance(grounding, dict) else {}
    onboarding = grounding.get("onboarding_data") if isinstance(grounding.get("onboarding_data"), dict) else {}
    checks: Dict[str, Dict[str, Any]] = {}
    limitations: List[str] = []
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)

    website = onboarding.get("website_analysis")
    session = onboarding.get("onboarding_session")
    complete = bool(website and session and (
        website.get("website_url") or website.get("domain")
    ))
    checks["onboarding"] = _check("available" if complete else "missing", "required onboarding context is present" if complete else "website and onboarding context are incomplete")
    if not complete:
        limitations.append("Required onboarding context is incomplete; no fallback task generation was used.")

    integrations = onboarding.get("platform_integrations")
    api_keys = onboarding.get("api_keys_data")
    provider_count = len(integrations) if isinstance(integrations, (list, dict)) else 0
    provider_health = onboarding.get("provider_health") or grounding.get("provider_health")
    if provider_count == 0 and not api_keys:
        checks["providers"] = _check("unavailable", "no configured provider integrations were found")
        limitations.append("No provider integrations are available; provider-dependent evidence may be missing.")
    else:
        verification_status = "configuration_only"
        if isinstance(provider_health, dict):
            verification_status = "verified" if any(
                str(value).lower() in {"available", "healthy", "success", "connected"}
                or (isinstance(value, dict) and str(value.get("status", "")).lower() in {"available", "healthy", "success", "connected"})
                for value in provider_health.values()
            ) else "provider_errors"
        checks["providers"] = _check(
            "available" if verification_status != "provider_errors" else "degraded",
            "provider state evaluated",
            count=provider_count,
            verification_status=verification_status,
            health=provider_health or {},
        )
        if verification_status == "configuration_only":
            limitations.append("Provider availability is configured but not live-verified for this meeting.")
        elif verification_status == "provider_errors":
            limitations.append("One or more configured providers reported an error during preflight.")

    checks["freshness"] = _freshness_status(onboarding)
    if checks["freshness"]["status"] in {"unknown", "stale"}:
        limitations.append(f"Data freshness is {checks['freshness']['status']}; recommendations may be incomplete.")

    checks["recent_tasks"] = _check("unavailable", "database is unavailable")
    checks["pending_approvals"] = _check("unavailable", "database is unavailable")
    checks["active_campaigns"] = _check("unavailable", "database is unavailable")
    checks["calendar_conflicts"] = _check("unavailable", "database is unavailable")
    checks["agent_health"] = _check("unavailable", "database is unavailable")

    if db is not None:
        try:
            from models.daily_workflow_models import DailyWorkflowTask
            recent_cutoff = current.replace(tzinfo=None) - timedelta(days=7)
            rows = (db.query(DailyWorkflowTask)
                    .filter(DailyWorkflowTask.user_id == user_id, DailyWorkflowTask.created_at >= recent_cutoff)
                    .all())
            checks["recent_tasks"] = _check("available", "recent task history loaded", count=len(rows), statuses=dict(Counter(row.status for row in rows)))
        except Exception as exc:
            checks["recent_tasks"] = _check("error", f"recent task history failed: {exc}")
            limitations.append("Recent task history could not be loaded.")

        try:
            from models.agent_activity_models import AgentApprovalRequest
            pending = (db.query(AgentApprovalRequest)
                       .filter(AgentApprovalRequest.user_id == user_id, AgentApprovalRequest.status == "pending")
                       .count())
            checks["pending_approvals"] = _check("available", "pending approvals loaded", count=pending)
        except Exception as exc:
            checks["pending_approvals"] = _check("error", f"pending approvals failed: {exc}")
            limitations.append("Pending approvals could not be loaded.")

        try:
            from models.product_marketing_models import Campaign
            active_statuses = {"generating", "ready", "published"}
            campaigns = (db.query(Campaign)
                         .filter(Campaign.user_id == user_id, Campaign.status.in_(active_statuses))
                         .all())
            checks["active_campaigns"] = _check("available", "active campaigns loaded", count=len(campaigns), ids=[c.campaign_id for c in campaigns])
        except Exception as exc:
            checks["active_campaigns"] = _check("error", f"active campaigns failed: {exc}")
            limitations.append("Active campaigns could not be loaded.")

        try:
            from models.content_planning import CalendarEvent
            events = (db.query(CalendarEvent)
                      .filter(CalendarEvent.user_id == user_id, CalendarEvent.status.in_(["draft", "scheduled"]))
                      .all())
            same_day = [event for event in events if event.scheduled_date and event.scheduled_date.date().isoformat() == meeting_date]
            by_platform = Counter((event.platform or "").lower() for event in same_day)
            by_content_type = Counter((event.content_type or "").lower() for event in same_day)
            exact_slots = Counter(event.scheduled_date.isoformat() for event in same_day)
            conflicts = []
            conflicts.extend({"type": "platform_day", "platform": key, "count": count} for key, count in by_platform.items() if key and count > 1)
            conflicts.extend({"type": "content_type_day", "content_type": key, "count": count} for key, count in by_content_type.items() if key and count > 1)
            conflicts.extend({"type": "exact_slot", "scheduled_date": key, "count": count} for key, count in exact_slots.items() if count > 1)
            checks["calendar_conflicts"] = _check("available", "calendar conflicts evaluated", count=len(conflicts), conflicts=conflicts, events_considered=len(same_day))
        except Exception as exc:
            checks["calendar_conflicts"] = _check("error", f"calendar conflict check failed: {exc}")
            limitations.append("Calendar conflicts could not be evaluated.")

        try:
            from models.agent_activity_models import AgentProfile, AgentRun
            profiles = db.query(AgentProfile).filter(AgentProfile.user_id == user_id).all()
            health_cutoff = current.replace(tzinfo=None) - timedelta(hours=24)
            failed_runs = (db.query(AgentRun)
                           .filter(AgentRun.user_id == user_id, AgentRun.started_at >= health_cutoff, AgentRun.status == "failed")
                           .count())
            checks["agent_health"] = _check("available", "agent profiles and recent runs loaded", profile_count=len(profiles), failed_runs=failed_runs)
        except Exception as exc:
            checks["agent_health"] = _check("error", f"agent health check failed: {exc}")
            limitations.append("Agent health could not be evaluated.")

    return {
        "meeting_date": meeting_date,
        "checked_at": current.isoformat(),
        "checks": checks,
        "limitations": limitations,
        "blocking": not complete and db is not None,
    }


def _proposal_field(obj: Any, key: str, default: Any = None) -> Any:
    """Read a field from a TaskProposal object or a dict-shaped proposal.

    Agents may return dict-shaped LLM output instead of TaskProposal
    instances; dict shapes may carry ``pillar`` as an alias for
    ``pillar_id``. Direct attribute access on a dict would raise
    AttributeError and abort the whole committee evidence phase.
    """
    if isinstance(obj, dict):
        aliases = ("pillar_id", "pillar") if key == "pillar_id" else (key,)
        for alias in aliases:
            if obj.get(alias) is not None:
                return obj.get(alias)
        return default
    return getattr(obj, key, default)


def build_agent_evidence(agent_key: str, result: Any) -> Dict[str, Any]:
    """Wrap one eligible agent's proposals in the Phase 5 evidence envelope."""
    proposals = result if isinstance(result, list) else []
    proposed_tasks = []
    evidence: List[Any] = []
    analyses: List[str] = []
    confidences: List[float] = []
    for proposal in proposals:
        context = _proposal_field(proposal, "context_data", None) or {}
        proposal_evidence = _proposal_field(proposal, "evidence", None)
        if proposal_evidence:
            evidence.append(proposal_evidence)
        reasoning = _proposal_field(proposal, "reasoning", None)
        if reasoning:
            analyses.append(reasoning)
        try:
            confidences.append(float(context.get("confidence", context.get("confidence_score", 0.0))))
        except (TypeError, ValueError):
            confidences.append(0.0)
        proposed_tasks.append({
            "title": _proposal_field(proposal, "title", ""),
            "description": _proposal_field(proposal, "description", ""),
            "pillar": _proposal_field(proposal, "pillar_id", ""),
            "priority": _proposal_field(proposal, "priority", ""),
            "expected_impact": _proposal_field(proposal, "expected_impact", ""),
            "effort": _proposal_field(proposal, "effort", ""),
            "kpi": _proposal_field(proposal, "kpi", ""),
            "deadline": _proposal_field(proposal, "deadline", ""),
            "action_type": _proposal_field(proposal, "action_type", "navigate"),
            "action_parameters": _proposal_field(proposal, "action_parameters", None) or {},
        })
    return {
        "agent": agent_key,
        "evidence": evidence,
        "analysis": " ".join(analyses),
        "proposed_tasks": proposed_tasks,
        "confidence": sum(confidences) / len(confidences) if confidences else 0.0,
        "expected_impact": [task["expected_impact"] for task in proposed_tasks if task["expected_impact"]],
        "effort": [task["effort"] for task in proposed_tasks if task["effort"]],
        "kpi": [task["kpi"] for task in proposed_tasks if task["kpi"]],
        "required_action_parameters": [task["action_parameters"] for task in proposed_tasks if task["action_parameters"]],
    }
