"""
Agent Committee orchestration for Today's Workflow.

Extracted from today_workflow_service.py for better modularity.
Contains generate_agent_enhanced_plan() - the main agent committee orchestration.
"""
import asyncio
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session
from loguru import logger

from models.agent_activity_models import AgentAlert

# Shared dependencies are imported from today_workflow_service so that there is
# a single source of truth and monkeypatching in tests (which targets
# today_workflow_service) keeps reaching this module.
from services.today_workflow_service import (
    _NoopActivity,
    _get_orchestration_service,
    orchestration_service,
    _resolve_recommendation_action_type,
    _recommendation_id,
    _stamp_synthesis_mode,
    _derive_onboarding_evidence_links,
    _ensure_pillar_coverage,
    PILLAR_IDS,
    MIN_TASK_EVIDENCE_LINKS,
    AgentActivityService,
    build_agent_event_payload,
    TaskMemoryService,
    start_daily_meeting,
    finish_daily_meeting,
    run_daily_meeting_preflight,
    build_agent_evidence,
    evaluate_agent_schedule,
    review_proposals,
    prioritize_proposals,
    AGENT_TEAM_CATALOG,
    resolve_recommendation_action,
    llm_text_gen,
)
from services import today_workflow_service as _today_svc


def _record_committee_shared_note(
    user_id: str,
    *,
    agents_polled_count: int,
    accepted_count: int,
    total_proposals: int,
    guardian_health: Any = None,
    healed: bool = False,
    fallback_used: bool = False,
) -> None:
    """Append the committee outcome to the VFS shared scratchpad.

    Writes a collaboration note + a ``committee_run_completed`` activity-log
    entry so agents and operators can see prior-run observations (the
    cross-agent coordination substrate). Failures are logged and swallowed —
    the note is observability, never a correctness dependency.
    """
    summary_bits = [
        f"committee run completed: polled={agents_polled_count} agents",
        f"accepted={accepted_count}/{total_proposals} proposals",
    ]
    if guardian_health is not None:
        summary_bits.append(f"guardian_health={guardian_health}")
    if healed:
        summary_bits.append("sif_index_self_healed=true")
    if fallback_used:
        summary_bits.append("committee_returned_no_tasks=true (LLM fallback used)")
    note = "; ".join(summary_bits)
    try:
        from services.intelligence.agent_context_vfs import AgentContextVFS

        vfs = AgentContextVFS(user_id)
        vfs.write_shared_note(note, agent_id="today_workflow_committee")
        vfs.append_activity_log(
            event_type="committee_run_completed",
            actor="today_workflow_committee",
            details={
                "agents_polled": agents_polled_count,
                "accepted_tasks": accepted_count,
                "total_proposals": total_proposals,
                "guardian_health": guardian_health,
                "sif_healed": healed,
                "fallback_used": fallback_used,
            },
        )
    except Exception as exc:
        logger.debug(f"[today_workflow_agents] Shared note write failed for {user_id}: {exc}")


def _proposal_field(proposal, key: str, default=None):
    """Read a field from a TaskProposal object or a dict-shaped proposal.

    Some agents return dict-shaped LLM output instead of ``TaskProposal``
    instances, so every consumer must tolerate both shapes. Dict-shaped
    proposals may carry ``pillar`` as an alias for ``pillar_id``.
    """
    if isinstance(proposal, dict):
        aliases = ("pillar_id", "pillar") if key == "pillar_id" else (key,)
        for alias in aliases:
            if proposal.get(alias) is not None:
                return proposal.get(alias)
        return default
    return getattr(proposal, key, default)


def build_grounding_context(db, user_id, date):
    """Late-bound delegate to the service's grounding builder.

    Tests monkeypatch ``today_workflow_service.build_grounding_context`` (the
    service/indexed convention) OR ``today_workflow_agents.build_grounding_context``
    (this module's own name). Delegating here keeps both styles working
    regardless of which module was imported first, matching the note above
    about monkeypatching reaching this module.

    The service module is resolved from ``sys.modules`` at call time so the
    call always reaches whatever module object the caller monkeypatched, even
    if ``services.today_workflow_service`` was re-imported mid-process (e.g.
    by env-override test fixtures such as ``test_sif3_quick_wins_round2``).
    Binding the module at import time (``_today_svc`` above) would freeze the
    reference to this module's first import and miss later patches once the
    service is re-loaded under a new module object.
    """
    import sys as _sys

    _mod = _sys.modules.get("services.today_workflow_service")
    if _mod is None:
        from services import today_workflow_service as _mod
    return _mod.build_grounding_context(db, user_id, date)


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
    # A retry is a scoped, transient re-run: it must NOT create a fresh
    # meeting record or enqueue another digest email. Skipping the lifecycle
    # means ``meeting`` stays None and ``finish_meeting`` stays a no-op for
    # meeting persistence (it still returns the transient result dict).
    meeting = None
    if not skip_meeting_lifecycle:
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

        # Enqueue daily digest email (non-blocking). Never let a digest
        # failure break the meeting flow, but surface the *outcome* on the
        # result so callers/UI can see why an email did or didn't fire.
        # Import here to avoid circular imports
        digest = {"status": "skipped", "reason": "not_attempted"}
        if skip_meeting_lifecycle:
            # A retry is a transient re-run: never re-fire the digest email.
            digest = {"status": "skipped", "reason": "retry"}
        else:
            try:
                from services.daily_email_digest import enqueue_digest
                from models.onboarding import OnboardingSession

                # Get user's contact email and timezone from onboarding
                onboarding = db.query(OnboardingSession).filter(
                    OnboardingSession.user_id == user_id
                ).first()
                contact_email = onboarding.contact_email if onboarding and onboarding.contact_email else None

                if onboarding is None:
                    digest = {"status": "skipped", "reason": "no_onboarding_session"}
                    logger.debug(f"No onboarding session for user {user_id}, skipping digest")
                elif not onboarding.email_digest_opt_in:
                    digest = {"status": "skipped", "reason": "opted_out"}
                    logger.debug(f"User {user_id} has opted out of email digest")
                elif not contact_email:
                    digest = {"status": "skipped", "reason": "no_contact_email"}
                    logger.debug(f"No contact email for user {user_id}, skipping digest")
                else:
                    # Enqueue asynchronously (non-blocking)
                    enqueue_digest(user_id, date, contact_email)
                    digest = {"status": "enqueued", "reason": None, "contact_email": contact_email}
                    logger.info(f"Enqueued daily digest for user {user_id} to {contact_email}")
            except Exception as e:
                # Never fail the meeting flow if digest fails
                logger.warning(f"Failed to enqueue digest for user {user_id}: {e}")
                digest = {"status": "failed", "reason": str(e)}
        result["digest"] = digest

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
        if retry_agents:
            # A retry is a scoped re-run: only the explicitly listed agents
            # participate so we surface just their fresh outcome.
            retry_set = set(retry_agents)
            candidate_agents = [
                (key, agent) for (key, agent) in candidate_agents if key in retry_set
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
        # A retry must force participation for the scoped agent(s) regardless
        # of their schedule, so a disabled/timed-out agent still runs on demand.
        effective_manual_override = manual_override or db is None or bool(retry_agents)
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
            from services.intelligence.agents.core_agent_framework import (
                AgentDeclined,
                AGENT_DECLINE_MESSAGE,
            )
            if isinstance(res, AgentDeclined):
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
                    "declined": True,
                    "message": str(res) or AGENT_DECLINE_MESSAGE,
                })
                logger.info(f"Agent {agent_key} declined: {res}")
                continue
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
                (proposal.get("title") if isinstance(proposal, dict) else proposal.title,
                 proposal.get("description") if isinstance(proposal, dict) else proposal.description,
                 proposal.get("pillar") or proposal.get("pillar_id") if isinstance(proposal, dict) else proposal.pillar_id),
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
            # Handle both dicts and objects for backward compatibility
            accepted_ids = set()
            for p in agent_tasks:
                if isinstance(p, dict):
                    pid = p.get("pillar_id") or p.get("pillar", "")
                    title = p.get("title", "")
                else:
                    pid = p.pillar_id
                    title = p.title
                accepted_ids.add(f"{pid}:{title}")
            proposals_log = []
            normalized_count = len(proposal_review.get("normalized_proposals", []))
            for index, p in enumerate(raw_proposals):
                pillar_id = _proposal_field(p, "pillar_id")
                title = _proposal_field(p, "title")
                valid = pillar_id in PILLAR_IDS
                reviewed = proposal_review.get("normalized_proposals", [])[index] if index < normalized_count else {}
                participates = (
                    reviewed.get("status") == "accepted"
                    and reviewed.get("guardian_outcome") in {None, "approved", "approved_with_warning"}
                )
                proposals_log.append({
                    "recommendation_id": reviewed.get("recommendation_id"),
                    "agent": reviewed.get("agent") or _proposal_field(p, "source_agent"),
                    "title": title,
                    "pillar_id": pillar_id,
                    "priority": _proposal_field(p, "priority"),
                    "valid": valid,
                    "accepted": participates,
                    "review_status": reviewed.get("status", "rejected"),
                    "review_reasons": reviewed.get("review_reasons", []),
                    "guardian_outcome": reviewed.get("guardian_outcome"),
                    "guardian_reasons": reviewed.get("guardian_reasons", []),
                    "selection_score": reviewed.get("selection_score"),
                    "selection_factors": reviewed.get("selection_factors", {}),
                    "rejected_reason": None if valid and participates else (
                        f"pillar_id '{pillar_id}' not in {PILLAR_IDS}"
                        if not valid else (reviewed.get("review_reasons") or ["proposal was not accepted"])[0]
                    ),
                    "reasoning": _proposal_field(p, "reasoning"),
                    "estimated_time": _proposal_field(p, "estimated_time"),
                    "action_type": _resolve_recommendation_action_type(p),
                    "synthesis_mode": (
                        p.get("synthesis_mode") if isinstance(p, dict)
                        else getattr(p, "synthesis_mode", None)
                    ),
                })
                if not valid:
                    logger.warning(
                        f"Rejected proposal from agent {_proposal_field(p, 'source_agent')}: "
                        f"invalid pillar_id={pillar_id!r} (title={title!r}). "
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
                # Build proposals list from committee data (same format as
                # proposals_log above). Raw proposals may be TaskProposal
                # objects or dict-shaped LLM output, so read fields through
                # _proposal_field in both loops.
                accepted_ids = {
                    f"{_proposal_field(p, 'pillar_id')}:{_proposal_field(p, 'title')}"
                    for p in agent_tasks
                }
                audit_input = []
                for p in raw_proposals:
                    pillar_id = _proposal_field(p, "pillar_id")
                    key = f"{pillar_id}:{_proposal_field(p, 'title')}"
                    audit_input.append({
                        "agent": _proposal_field(p, "source_agent"),
                        "title": _proposal_field(p, "title"),
                        "pillar_id": pillar_id,
                        "priority": _proposal_field(p, "priority"),
                        "reasoning": _proposal_field(p, "reasoning") or "",
                        "accepted": key in accepted_ids,
                        "valid": pillar_id in PILLAR_IDS,
                        "rejected_reason": None if pillar_id in PILLAR_IDS else f"pillar_id '{pillar_id}' not in {PILLAR_IDS}",
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

    # Surface any SIF self-heal that happened during this run so the
    # plan records that its evidence base was repaired from local
    # onboarding context (transparency for operators and the user).
    # Computed before final selection so BOTH the committee-success and
    # the LLM-fallback paths can include it.
    heal_limitations = []
    for polled_agent in active_agents:
        heal = getattr(polled_agent, "last_sif_heal", None)
        if isinstance(heal, dict) and heal.get("healed"):
            heal_limitations.append(
                "SIF index was self-healed from local onboarding context before this run "
                f"(+{int(heal.get('bootstrap_indexed') or 0)} docs, "
                f"+{int(heal.get('website_sync_new') or 0)} synced pages)"
            )

    # Cross-agent coordination substrate: record the committee outcome in
    # the VFS shared scratchpad (collaboration note + activity log) so
    # agents and operators can see prior-run observations. Never fatal.
    _record_committee_shared_note(
        user_id,
        agents_polled_count=agents_polled_count,
        accepted_count=len(agent_tasks) if agent_tasks else 0,
        total_proposals=len(raw_proposals) if raw_proposals else 0,
        guardian_health=(guardian_review.get("summary", {}) or {}).get("health_score")
        if isinstance(guardian_review, dict) else None,
        healed=bool(heal_limitations),
        fallback_used=not bool(agent_tasks),
    )

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
            is_dict = isinstance(prop, dict)
            prop_title = prop.get("title", "") if is_dict else prop.title
            prop_desc = prop.get("description", "") if is_dict else prop.description
            prop_pillar = prop.get("pillar") or prop.get("pillar_id", "") if is_dict else prop.pillar_id

            action_contract = resolve_recommendation_action(prop)
            resolved_action_type = action_contract["action_type"]
            recommendation_id = review_ids.get(
                (prop_title, prop_desc, prop_pillar),
                _recommendation_id(prop, date),
            )
            selected_review = next(
                (
                    item for item in proposal_review.get("normalized_proposals", [])
                    if (item.get("title"), item.get("description"), item.get("pillar"))
                    == (prop_title, prop_desc, prop_pillar)
                ),
                {},
            )
            final_tasks.append({
                "pillarId": prop_pillar,
                "title": prop_title,
                "description": prop_desc,
                "recommendation": (prop.get("recommendation") or prop_desc) if is_dict else (prop.recommendation or prop_desc),
                "nextAction": (prop.get("next_action") or (f"Open {prop.get('action_url')}" if prop.get('action_url') else "Review and choose the next action")) if is_dict else (prop.next_action or (f"Open {prop.action_url}" if prop.action_url else "Review and choose the next action")),
                "ownerAgent": (prop.get("owner_agent") or prop.get("source_agent")) if is_dict else (prop.owner_agent or prop.source_agent),
                "kpi": prop.get("kpi") if is_dict else prop.kpi,
                "deadline": prop.get("deadline") if is_dict else prop.deadline,
                "priority": prop.get("priority") if is_dict else prop.priority,
                "estimatedTime": prop.get("estimated_time") if is_dict else prop.estimated_time,
                    "actionType": resolved_action_type,
                    "actionUrl": prop.get("action_url") if is_dict else prop.action_url,
                    "evidence": prop.get("evidence") if is_dict else prop.evidence,
                    "expectedImpact": prop.get("expected_impact") if is_dict else prop.expected_impact,
                    "effort": prop.get("effort") if is_dict else prop.effort,
                    "riskLevel": prop.get("risk_level") if is_dict else prop.risk_level,
                    "measurement": prop.get("measurement") if is_dict else prop.measurement,
                    "enabled": True,
                "metadata": {
                    "recommendation_id": recommendation_id,
                    "source_agent": prop.get("source_agent") if is_dict else prop.source_agent,
                    "reasoning": prop.get("reasoning") if is_dict else prop.reasoning,
                    "context_data": prop.get("context_data") if is_dict else prop.context_data,
                    "action_parameters": action_contract["parameters"],
                    "action_contract": action_contract,
                    "selection_score": selected_review.get("selection_score"),
                    "selection_factors": selected_review.get("selection_factors", {}),
                    "selection_reason": selected_review.get("selection_reason", []),
                    "confidence": selected_review.get("confidence", 0.0),
                    "required_action": (prop.get("next_action") or prop.get("action_url")) if is_dict else (prop.next_action or prop.action_url),
                    "evidence_links": _derive_onboarding_evidence_links(grounding.get("onboarding_data", {}), limit=2),
                    "synthesis_mode": prop.get("synthesis_mode") if is_dict else getattr(prop, "synthesis_mode", None),
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
            "limitations": [*meeting_preflight["limitations"], *heal_limitations],
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
        "limitations": [*meeting_preflight["limitations"], *heal_limitations],
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


