"""
API Endpoints for ALwrity Autonomous Agent Orchestration System
Provides REST API access to agent orchestration functionality
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool
from typing import Dict, List, Any, Optional
import asyncio
import os
from datetime import datetime
import json

from middleware.auth_middleware import get_current_user, get_current_user_with_query_token
from utils.logger_utils import get_service_logger
from services.intelligence.agents.agent_orchestrator import (
    execute_agent_action,
    execute_marketing_strategy,
    get_agent_system_status,
    process_market_signals_for_user,
)
from services.intelligence.agents.core_agent_framework import AgentAction
from services.intelligence.agents.market_signal_detector import MarketSignal
from services.intelligence.agents.performance_monitor import PerformanceMetric, AgentStatus
from services.database import get_db, get_session_for_user
from services.agent_activity_service import AgentActivityService
from services.agent_activity_serializers import (
    DETAIL_TIER_DEBUG,
    DETAIL_TIER_SUMMARY,
    normalize_detail_tier,
    serialize_alert,
    serialize_approval,
    serialize_event,
    serialize_run,
)
from sqlalchemy.orm import Session
from models.agent_activity_models import AgentProfile, AgentRun, AgentEvent, AgentAlert, AgentApprovalRequest
from models.daily_workflow_models import DailyWorkflowTask
from models.workflow_execution_models import WorkflowTaskExecution
from services.intelligence.agents.team_catalog import AGENT_TEAM_CATALOG, get_agent_catalog_entry
from services.intelligence.agents.prompt_context import (
    build_prompt_context,
    comma_join_context,
    select_agent_context,
    format_context,
)

logger = get_service_logger(__name__)

router = APIRouter(prefix="/api/agents", tags=["Autonomous Agents"])


def _build_context_emphasis(agent_key: str, ctx: Dict[str, Any]) -> str:
    """Build a data-grounded emphasis for an agent, naming the user's actual
    onboarding data (competitors, pillars, voice, audience, platforms) so the
    LLM personalizes around the real brand rather than a generic role hint.
    """
    def _names(items: Any, limit: int = 5) -> str:
        if not isinstance(items, list):
            return ""
        flat = [str(i).strip() for i in items if i and str(i).strip()]
        if not flat:
            return ""
        if len(flat) > limit:
            return ", ".join(flat[:limit]) + f" (and {len(flat) - limit} more)"
        return ", ".join(flat)

    persona = ctx.get("persona") or {}
    brand_voice = ctx.get("brand_voice") or persona.get("brand_voice_description") or ""
    audience = ctx.get("target_audience") or ""
    website = ctx.get("website_url") or ""
    pillars = _names(ctx.get("content_pillars"))
    competitors = _names(ctx.get("competitors"))
    content_types = _names(ctx.get("content_types"))
    cadence = ctx.get("posting_cadence") or ""
    avoid_words = _names(ctx.get("avoid_words") or persona.get("avoid_words"), limit=8)
    forbidden_tones = _names(ctx.get("forbidden_tones") or persona.get("forbidden_tones"), limit=8)

    if agent_key == "competitor_analyst":
        bits = []
        if competitors:
            bits.append(f"track competitors {competitors}")
        if audience:
            bits.append(f"position responses for their audience ({audience})")
        if pillars:
            bits.append(f"find gaps against their pillars ({pillars})")
        return ("Personalize this agent to " + "; ".join(bits) + ".") if bits else \
            "Personalize this agent around the user's competitors and content gaps."

    if agent_key == "content_strategist":
        bits = []
        if pillars:
            bits.append(f"anchor recommendations to pillars: {pillars}")
        if brand_voice:
            bits.append(f"write in the brand voice \"{brand_voice}\"")
        if audience:
            bits.append(f"speak to the audience {audience}")
        return ("Personalize this agent to " + "; ".join(bits) + ".") if bits else \
            "Personalize this agent around the user's pillars, voice, and audience."

    if agent_key == "seo_specialist":
        bits = []
        if website:
            bits.append(f"optimize the site {website}")
        if pillars:
            bits.append(f"serve pillars: {pillars}")
        if audience:
            bits.append(f"stay aligned to the audience {audience}")
        return ("Personalize this agent to " + "; ".join(bits) + ".") if bits else \
            "Personalize this agent around the user's website and SEO goals."

    if agent_key == "social_media_manager":
        bits = []
        if content_types:
            bits.append(f"distribute their content types ({content_types})")
        if cadence:
            bits.append(f"respect their posting cadence ({cadence})")
        if brand_voice:
            bits.append(f"keep every post in the brand voice \"{brand_voice}\"")
        return ("Personalize this agent to " + "; ".join(bits) + ".") if bits else \
            "Personalize this agent around the user's platforms, cadence, and content types."

    if agent_key == "content_guardian":
        bits = []
        if brand_voice:
            bits.append(f"protect the brand voice \"{brand_voice}\"")
        if forbidden_tones:
            bits.append(f"reject forbidden tones ({forbidden_tones})")
        if avoid_words:
            bits.append(f"flag avoid-words ({avoid_words})")
        return ("Personalize this agent to " + "; ".join(bits) + ".") if bits else \
            "Personalize this agent around the user's brand voice and quality rules."

    if agent_key in ("strategy_orchestrator", "strategy_architect"):
        bits = []
        if pillars:
            bits.append(f"coordinate around pillars {pillars}")
        if competitors:
            bits.append(f"factor in competitors {competitors}")
        if audience:
            bits.append(f"keep delegations aligned to the audience {audience}")
        return ("Personalize this agent to " + "; ".join(bits) + ".") if bits else \
            "Personalize this agent around the user's business goals and content pillars."

    return "Personalize this agent using the user's onboarding context."


def _can_access_advanced_activity(current_user: Dict[str, Any]) -> bool:
    role = str(current_user.get("role") or "").lower().strip()
    metadata = current_user.get("public_metadata")
    if isinstance(metadata, dict):
        role = str(metadata.get("role") or role).lower().strip()

    feature_flags = current_user.get("feature_flags")
    if not feature_flags and isinstance(metadata, dict):
        feature_flags = metadata.get("feature_flags") or metadata.get("features")

    has_flag = False
    if isinstance(feature_flags, list):
        has_flag = any(str(flag).strip().lower() in {"agent_activity_detailed", "agents_activity_detailed"} for flag in feature_flags)
    elif isinstance(feature_flags, dict):       
        has_flag = bool(feature_flags.get("agent_activity_detailed") or feature_flags.get("agents_activity_detailed"))

    if os.getenv("DISABLE_AUTH", "false").lower() == "true":
        return True

    return role in {"admin", "internal"} or has_flag


def _resolve_detail_tier(requested_tier: str, current_user: Dict[str, Any]) -> str:
    tier = normalize_detail_tier(requested_tier)
    if tier == DETAIL_TIER_DEBUG and not _can_access_advanced_activity(current_user):
        return DETAIL_TIER_SUMMARY
    return tier


def _build_huddle_snapshot(
    db: Session,
    user_id: str,
    since_run_id: int = 0,
    since_event_id: int = 0,
    since_alert_id: int = 0,
    since_approval_id: int = 0,
    limit: int = 50,
    detail_tier: str = DETAIL_TIER_SUMMARY,
) -> Dict[str, Any]:
    runs_query = db.query(AgentRun).filter(AgentRun.user_id == user_id)
    events_query = db.query(AgentEvent).filter(AgentEvent.user_id == user_id)
    alerts_query = db.query(AgentAlert).filter(AgentAlert.user_id == user_id)
    approvals_query = db.query(AgentApprovalRequest).filter(AgentApprovalRequest.user_id == user_id)

    if since_run_id > 0:
        runs_query = runs_query.filter(AgentRun.id > since_run_id)
    if since_event_id > 0:
        events_query = events_query.filter(AgentEvent.id > since_event_id)
    if since_alert_id > 0:
        alerts_query = alerts_query.filter(AgentAlert.id > since_alert_id)
    if since_approval_id > 0:
        approvals_query = approvals_query.filter(AgentApprovalRequest.id > since_approval_id)

    runs = runs_query.order_by(AgentRun.id.desc()).limit(limit).all()
    events = events_query.order_by(AgentEvent.id.desc()).limit(limit * 2).all()
    alerts = alerts_query.order_by(AgentAlert.id.desc()).limit(limit).all()
    approvals = approvals_query.order_by(AgentApprovalRequest.id.desc()).limit(limit).all()

    runs_sorted = list(reversed(runs))
    events_sorted = list(reversed(events))
    alerts_sorted = list(reversed(alerts))
    approvals_sorted = list(reversed(approvals))

    return {
        "runs": [serialize_run(r, detail_tier) for r in runs_sorted],
        "events": [serialize_event(e, detail_tier) for e in events_sorted],
        "alerts": [serialize_alert(a, detail_tier) for a in alerts_sorted],
        "approvals": [serialize_approval(a, detail_tier) for a in approvals_sorted],
        "cursor": {
            "run_id": max([since_run_id] + [r.id for r in runs_sorted]),
            "event_id": max([since_event_id] + [e.id for e in events_sorted]),
            "alert_id": max([since_alert_id] + [a.id for a in alerts_sorted]),
            "approval_id": max([since_approval_id] + [a.id for a in approvals_sorted]),
        },
    }

@router.get("/team")
async def get_agent_team_endpoint(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    try:
        user_id = str(current_user.get("id"))
        profiles = (
            db.query(AgentProfile)
            .filter(AgentProfile.user_id == user_id)
            .all()
        )
        profile_by_key = {p.agent_key: p for p in profiles if p and p.agent_key}

        agents = []
        for entry in AGENT_TEAM_CATALOG:
            agent_key = entry.get("agent_key")
            # Shallow copy so the rendered fields we add below never mutate the
            # module-level catalog (which is shared across requests/users).
            defaults = dict(entry.get("defaults") or {})
            profile = profile_by_key.get(agent_key)

            # Hidden agents are internal system agents — not shown in UI.
            if entry.get("hidden"):
                continue

            agents.append(
                {
                    "agent_key": agent_key,
                    "agent_type": entry.get("agent_type"),
                    "role": entry.get("role"),
                    "responsibilities": entry.get("responsibilities") or [],
                    "tools": entry.get("tools") or [],
                    "defaults": defaults,
                    "profile": {
                        "display_name": (profile.display_name if profile and profile.display_name else None),
                        "enabled": (bool(profile.enabled) if profile else bool(defaults.get("enabled", True))),
                        "schedule": (profile.schedule if profile and profile.schedule is not None else defaults.get("schedule")),
                        "notification_prefs": (profile.notification_prefs if profile and profile.notification_prefs is not None else None),
                        "tone": (profile.tone if profile and profile.tone is not None else None),
                        "system_prompt": (profile.system_prompt if profile and profile.system_prompt is not None else None),
                        "task_prompt_template": (profile.task_prompt_template if profile and profile.task_prompt_template is not None else None),
                        "reporting_prefs": (profile.reporting_prefs if profile and profile.reporting_prefs is not None else None),
                        "updated_at": (profile.updated_at.isoformat() if profile and profile.updated_at else None),
                    },
                }
            )

        # Single source-of-truth context summary derived from canonical onboarding data.
        context_summary = {}
        render_context: Dict[str, str] = comma_join_context(build_prompt_context({}))
        try:
            from api.content_planning.services.content_strategy.onboarding.data_integration import (
                OnboardingDataIntegrationService,
            )

            svc = OnboardingDataIntegrationService()
            integrated = svc.get_integrated_data_sync(user_id, db) or {}
            linkedin_profile = integrated.get("linkedin_profile") or {}

            # Single authoritative structured context (from prompt_context builder).
            structured = build_prompt_context(integrated)

            context_summary = {
                "website_name": structured.get("website_name") or "",
                "website_url": structured.get("website_url") or "",
                "profile_name": linkedin_profile.get("name") or "",
                "industry": structured.get("industry") or "",
                "brand_voice": structured.get("brand_voice") or "",
                "target_audience": structured.get("target_audience") or "",
                "content_pillars": structured.get("content_pillars") or [],
                "competitors": structured.get("competitors") or [],
                "research_depth": structured.get("research_depth") or "",
                "content_types": structured.get("content_types") or [],
                "connected_platforms": structured.get("connected_platforms") or [],
                "posting_cadence": structured.get("posting_cadence") or "",
                "business_goals": structured.get("business_goals") or [],
            }

            # Flattened variant for {placeholder} template rendering.
            render_context = comma_join_context(structured)
        except Exception as ctx_err:
            logger.warning(f"Could not build context_summary for agent team (user {user_id}): {ctx_err}")

        # Render the catalog prompt templates with the user's context so the UI
        # shows resolved values instead of raw {placeholders}.
        def _render_template(text: Any) -> str:
            value = str(text or "")
            for key, val in render_context.items():
                value = value.replace("{" + key + "}", str(val))
            return value

        for agent in agents:
            defaults = agent.get("defaults") or {}
            defaults["rendered_system_prompt"] = _render_template(defaults.get("system_prompt_template"))
            defaults["rendered_task_prompt_template"] = _render_template(defaults.get("task_prompt_template"))
            agent["defaults"] = defaults

        return {
            "success": True,
            "data": {"agents": agents, "context_summary": context_summary},
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
        }
    except Exception as e:
        logger.error(f"Error getting agent team for user {current_user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/team/{agent_key}")
async def upsert_agent_profile_endpoint(
    agent_key: str,
    body: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    try:
        user_id = str(current_user.get("id"))
        entry = get_agent_catalog_entry(agent_key)
        if not entry:
            raise HTTPException(status_code=404, detail="Unknown agent_key")

        allowed_fields = {
            "display_name",
            "enabled",
            "schedule",
            "notification_prefs",
            "tone",
            "system_prompt",
            "task_prompt_template",
            "reporting_prefs",
        }
        payload = {k: body.get(k) for k in allowed_fields if k in body}

        display_name = payload.get("display_name")
        if display_name is not None:
            display_name = str(display_name).strip()
            if len(display_name) > 255:
                raise HTTPException(status_code=400, detail="display_name too long")
            payload["display_name"] = display_name

        for text_field in ("system_prompt", "task_prompt_template"):
            if payload.get(text_field) is not None:
                value = str(payload.get(text_field))
                if len(value) > 20000:
                    raise HTTPException(status_code=400, detail=f"{text_field} too long")
                payload[text_field] = value

        schedule = payload.get("schedule")
        if "schedule" in payload and schedule is not None and not isinstance(schedule, dict):
            raise HTTPException(status_code=400, detail="schedule must be an object")

        profile = (
            db.query(AgentProfile)
            .filter(AgentProfile.user_id == user_id, AgentProfile.agent_key == agent_key)
            .first()
        )

        now = datetime.utcnow()
        if not profile:
            profile = AgentProfile(
                user_id=user_id,
                agent_key=agent_key,
                agent_type=entry.get("agent_type"),
                created_at=now,
                updated_at=now,
            )
            db.add(profile)

        if "enabled" in payload:
            profile.enabled = bool(payload.get("enabled"))
        if "display_name" in payload:
            profile.display_name = payload.get("display_name")
        if "schedule" in payload:
            profile.schedule = payload.get("schedule")
        if "notification_prefs" in payload:
            profile.notification_prefs = payload.get("notification_prefs")
        if "tone" in payload:
            profile.tone = payload.get("tone")
        if "system_prompt" in payload:
            profile.system_prompt = payload.get("system_prompt")
        if "task_prompt_template" in payload:
            profile.task_prompt_template = payload.get("task_prompt_template")
        if "reporting_prefs" in payload:
            profile.reporting_prefs = payload.get("reporting_prefs")

        profile.updated_at = now

        db.commit()
        db.refresh(profile)
        try:
            from services.intelligence.agents.core_agent_framework import BaseALwrityAgent
            BaseALwrityAgent._profile_cache.pop(f"{user_id}:{agent_key}", None)
        except Exception:
            pass

        return {
            "success": True,
            "data": {
                "profile": {
                    "id": profile.id,
                    "agent_key": profile.agent_key,
                    "agent_type": profile.agent_type,
                    "display_name": profile.display_name,
                    "enabled": bool(profile.enabled),
                    "schedule": profile.schedule,
                    "notification_prefs": profile.notification_prefs,
                    "tone": profile.tone,
                    "system_prompt": profile.system_prompt,
                    "task_prompt_template": profile.task_prompt_template,
                    "reporting_prefs": profile.reporting_prefs,
                    "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
                }
            },
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving agent profile for user {current_user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/team/{agent_key}/ai-optimize")
async def ai_optimize_agent_profile_endpoint(
    agent_key: str,
    body: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    try:
        user_id = str(current_user.get("id"))
        entry = get_agent_catalog_entry(agent_key)
        if not entry:
            raise HTTPException(status_code=404, detail="Unknown agent_key")

        context_card = body.get("context_card") or {}
        if context_card is not None and not isinstance(context_card, dict):
            raise HTTPException(status_code=400, detail="context_card must be an object")

        scope = str(body.get("scope") or "agent").strip().lower()
        if scope not in {"agent", "system_prompt", "task_prompt_template"}:
            scope = "agent"

        profile = (
            db.query(AgentProfile)
            .filter(AgentProfile.user_id == user_id, AgentProfile.agent_key == agent_key)
            .first()
        )

        defaults = entry.get("defaults") or {}
        current_state = {
            "agent_key": entry.get("agent_key"),
            "agent_type": entry.get("agent_type"),
            "role": entry.get("role"),
            "responsibilities": entry.get("responsibilities") or [],
            "tools": entry.get("tools") or [],
            "display_name": (profile.display_name if profile and profile.display_name else None),
            "enabled": (bool(profile.enabled) if profile else bool(defaults.get("enabled", True))),
            "schedule": (profile.schedule if profile and profile.schedule is not None else defaults.get("schedule")),
            "notification_prefs": (profile.notification_prefs if profile and profile.notification_prefs is not None else None),
            "tone": (profile.tone if profile and profile.tone is not None else None),
            "system_prompt": (profile.system_prompt if profile and profile.system_prompt is not None else None),
            "task_prompt_template": (profile.task_prompt_template if profile and profile.task_prompt_template is not None else None),
            "reporting_prefs": (profile.reporting_prefs if profile and profile.reporting_prefs is not None else None),
        }

        def _truncate(value: Any, max_len: int) -> str:
            text = str(value or "").strip()
            if len(text) <= max_len:
                return text
            return text[: max_len - 20] + " …(truncated)"

        # Build the authoritative context server-side from the full integrated
        # data, then select only the role-relevant fields for this agent.
        # The frontend card is kept as a thin overlay for LinkedIn-specific
        # fields (growth_summary, preferred_formats, …) not in the raw data.
        from api.content_planning.services.content_strategy.onboarding.data_integration import (
            OnboardingDataIntegrationService,
        )
        integrated = OnboardingDataIntegrationService().get_integrated_data_sync(user_id, db) or {}
        full_context = {**context_card}
        for key, value in build_prompt_context(integrated).items():
            if value:
                full_context[key] = value
        selected_context = select_agent_context(agent_key, full_context)

        from services.llm_providers.main_text_generation import llm_text_gen

        json_schema = {
            "type": "object",
            "properties": {
                "display_name": {"type": "string"},
                "enabled": {"type": "boolean"},
                "schedule": {"type": "object"},
                "notification_prefs": {"type": "object"},
                "tone": {"type": "object"},
                "system_prompt": {"type": "string"},
                "task_prompt_template": {"type": "string"},
                "reporting_prefs": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "string"}},
                "rationale": {"type": "string"},
            },
            "required": ["warnings", "rationale"],
        }
        if scope in {"agent", "system_prompt"}:
            json_schema["required"].append("system_prompt")
        if scope in {"agent", "task_prompt_template"}:
            json_schema["required"].append("task_prompt_template")

        prompt = f"""
You are ALwrity's Agent Personalization Assistant.

Goal: Propose edits to this agent profile to maximize success for the end user. The user is non-technical, so instructions must be clear and practical.

Non-negotiables:
- Tools are non-editable. Do not add, remove, or rename tools.
- Responsibilities are non-editable. Do not change responsibilities.
- You may edit: display name, schedule, tone, system_prompt, task_prompt_template, notification_prefs, reporting_prefs.
- Do not include secrets. Do not ask for API keys. Do not suggest unsafe or spammy behavior.
- Prefer deterministic schedules and crisp outputs. Keep prompts concise and structured.

Scope: {scope}

Agent (locked):
role: {current_state.get('role')}
responsibilities: {current_state.get('responsibilities')}
tools: {current_state.get('tools')}

Current editable state:
{{
  "display_name": {current_state.get('display_name')},
  "enabled": {current_state.get('enabled')},
  "schedule": {current_state.get('schedule')},
  "tone": {current_state.get('tone')},
  "system_prompt": {(_truncate(current_state.get('system_prompt'), 3000) if current_state.get('system_prompt') else "")},
  "task_prompt_template": {(_truncate(current_state.get('task_prompt_template'), 3000) if current_state.get('task_prompt_template') else "")}
}}

Relevant context for this agent:
{format_context(selected_context)}

What matters most for this agent:
{_build_context_emphasis(agent_key, selected_context)}

Return ONLY a JSON object that matches the schema.
"""

        result = llm_text_gen(prompt=prompt, json_struct=json_schema, user_id=user_id)

        return {
            "success": True,
            "data": {
                "agent_key": agent_key,
                "scope": scope,
                "suggestion": result,
            },
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
        }
    except HTTPException:
        raise
    except RuntimeError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except Exception as e:
        logger.error(f"Error AI-optimizing agent profile for user {current_user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/team/{agent_key}/preview")
async def preview_agent_profile_endpoint(
    agent_key: str,
    body: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    try:
        user_id = str(current_user.get("id"))
        entry = get_agent_catalog_entry(agent_key)
        if not entry:
            raise HTTPException(status_code=404, detail="Unknown agent_key")

        context_card = body.get("context_card") or {}
        if context_card is not None and not isinstance(context_card, dict):
            raise HTTPException(status_code=400, detail="context_card must be an object")

        # Build the authoritative context server-side, then select only the
        # role-relevant fields for this agent.
        from api.content_planning.services.content_strategy.onboarding.data_integration import (
            OnboardingDataIntegrationService,
        )
        integrated = OnboardingDataIntegrationService().get_integrated_data_sync(user_id, db) or {}
        full_context = {**context_card}
        for key, value in build_prompt_context(integrated).items():
            if value:
                full_context[key] = value
        selected_context = select_agent_context(agent_key, full_context)

        profile = (
            db.query(AgentProfile)
            .filter(AgentProfile.user_id == user_id, AgentProfile.agent_key == agent_key)
            .first()
        )
        defaults = entry.get("defaults") or {}

        # Prefer unsaved draft prompts sent by the frontend, so Preview reflects
        # the user's current edits (not just the last-saved profile). Fall back
        # to the saved profile when no draft is provided.
        draft_system_prompt = body.get("system_prompt")
        draft_task_prompt = body.get("task_prompt_template")
        system_prompt = (
            draft_system_prompt
            if draft_system_prompt is not None
            else (profile.system_prompt if profile and profile.system_prompt else "")
        )
        task_prompt_template = (
            draft_task_prompt
            if draft_task_prompt is not None
            else (profile.task_prompt_template if profile and profile.task_prompt_template else "")
        )

        display_name_template = (defaults.get("display_name_template") or entry.get("role") or agent_key)
        website_name = str(full_context.get("website_name") or "Your").strip()
        display_name = (profile.display_name if profile and profile.display_name else display_name_template.replace("{website_name}", website_name))

        from services.llm_providers.main_text_generation import llm_text_gen

        schema = {
            "type": "object",
            "properties": {
                "sample_output": {"type": "string"},
                "next_actions": {"type": "array", "items": {"type": "string"}},
                "assumptions": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["sample_output"],
        }

        prompt = f"""
You are generating a SAFE PREVIEW for an ALwrity agent so a non-technical user can understand what it will do.

Rules:
- Do not claim you executed tools or changed anything.
- Only show what you would propose as a plan or recommendations.
- Be concrete and helpful, but keep it short.

Agent name: {display_name}
Role: {entry.get('role')}
Responsibilities (locked): {entry.get('responsibilities')}
Tools (locked): {entry.get('tools')}

System prompt (editable):
{system_prompt}

Task prompt template (editable):
{task_prompt_template}

Relevant context for this agent:
{format_context(selected_context)}

What matters most for this agent:
{_build_context_emphasis(agent_key, selected_context)}

Return ONLY a JSON object that matches the schema.
"""

        result = llm_text_gen(prompt=prompt, json_struct=schema, user_id=user_id)

        return {
            "success": True,
            "data": {
                "agent_key": agent_key,
                "display_name": display_name,
                "preview": result,
            },
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
        }
    except HTTPException:
        raise
    except RuntimeError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating agent preview for user {current_user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts")
async def get_agent_alerts_endpoint(
    unread_only: bool = True,
    limit: int = 50,
    detail_tier: str = DETAIL_TIER_SUMMARY,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    try:
        user_id = str(current_user.get("id"))
        resolved_tier = _resolve_detail_tier(detail_tier, current_user)
        service = AgentActivityService(db, user_id)
        alerts = service.list_alerts(unread_only=unread_only, limit=limit)
        return {
            "success": True,
            "data": {
                "alerts": [serialize_alert(a, resolved_tier) for a in alerts],
                "total": len(alerts),
                "detail_tier": resolved_tier,
            },
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
        }
    except Exception as e:
        logger.error(f"Error getting agent alerts for user {current_user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/huddle/feed")
async def get_agent_huddle_feed_endpoint(
    since: Optional[str] = None,
    cursor: Optional[str] = None,
    runs_limit: int = 20,
    events_limit: int = 50,
    alerts_limit: int = 20,
    approvals_limit: int = 20,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    try:
        user_id = str(current_user.get("id"))
        service = AgentActivityService(db, user_id)
        
        # Use run_in_threadpool to execute the blocking service call in a separate thread
        feed = await run_in_threadpool(
            service.get_huddle_feed,
            since=since,
            cursor=cursor,
            runs_limit=runs_limit,
            events_limit=events_limit,
            alerts_limit=alerts_limit,
            approvals_limit=approvals_limit,
        )
        return {
            "success": True,
            "data": feed,
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
        }
    except Exception as e:
        logger.error(f"Error getting huddle feed for user {current_user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts/{alert_id}/mark-read")
async def mark_agent_alert_read_endpoint(
    alert_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    try:
        user_id = str(current_user.get("id"))
        service = AgentActivityService(db, user_id)
        ok = service.mark_alert_read(alert_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Alert not found")
        return {"success": True, "timestamp": datetime.utcnow().isoformat(), "user_id": user_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking agent alert read for user {current_user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/runs")
async def get_agent_runs_endpoint(
    limit: int = 30,
    detail_tier: str = DETAIL_TIER_SUMMARY,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    try:
        user_id = str(current_user.get("id"))
        resolved_tier = _resolve_detail_tier(detail_tier, current_user)
        service = AgentActivityService(db, user_id)
        runs = service.list_runs(limit=limit)
        return {
            "success": True,
            "data": {
                "runs": [serialize_run(r, resolved_tier) for r in runs],
                "detail_tier": resolved_tier,
            },
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
        }
    except Exception as e:
        logger.error(f"Error getting agent runs for user {current_user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/runs/{run_id}/events")
async def get_agent_run_events_endpoint(
    run_id: int,
    limit: int = 200,
    detail_tier: str = DETAIL_TIER_SUMMARY,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    try:
        user_id = str(current_user.get("id"))
        resolved_tier = _resolve_detail_tier(detail_tier, current_user)
        service = AgentActivityService(db, user_id)
        events = service.list_events(run_id=run_id, limit=limit)
        return {
            "success": True,
            "data": {
                "events": [serialize_event(e, resolved_tier) for e in events],
                "detail_tier": resolved_tier,
            },
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
        }
    except Exception as e:
        logger.error(f"Error getting agent events for user {current_user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/approvals")
async def get_agent_approvals_endpoint(
    status: str = "pending",
    limit: int = 50,
    detail_tier: str = DETAIL_TIER_SUMMARY,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    try:
        user_id = str(current_user.get("id"))
        resolved_tier = _resolve_detail_tier(detail_tier, current_user)
        service = AgentActivityService(db, user_id)
        approvals = service.list_approval_requests(status=status, limit=limit)
        return {
            "success": True,
            "data": {
                "approvals": [serialize_approval(a, resolved_tier) for a in approvals],
                "detail_tier": resolved_tier,
            },
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
        }
    except Exception as e:
        logger.error(f"Error getting approvals for user {current_user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/huddle/stream")
async def stream_agent_huddle_endpoint(
    detail_tier: str = DETAIL_TIER_SUMMARY,
    current_user: dict = Depends(get_current_user_with_query_token),
):
    user_id = str(current_user.get("id"))
    resolved_tier = _resolve_detail_tier(detail_tier, current_user)

    # Helper function to get a snapshot safely within a threadpool
    # Manages its own short-lived DB session to avoid blocking the pool
    def _fetch_snapshot_safe(user_id: str, limit: int, **kwargs):
        session = get_session_for_user(user_id)
        if not session:
            # Should not happen if user_id is valid, but handle gracefully
            return {"runs": [], "events": [], "alerts": [], "approvals": [], "cursor": {}}
        try:
            return _build_huddle_snapshot(
                db=session,
                user_id=user_id,
                limit=limit,
                **kwargs
            )
        finally:
            session.close()

    async def event_generator():
        cursor = {"run_id": 0, "event_id": 0, "alert_id": 0, "approval_id": 0}
        run_signatures: Dict[int, str] = {}

        initial_snapshot = await run_in_threadpool(
            _fetch_snapshot_safe,
            user_id=user_id, 
            limit=50, 
            detail_tier=resolved_tier
        )
        cursor.update(initial_snapshot.get("cursor") or {})
        for run in initial_snapshot.get("runs", []):
            run_signatures[int(run.get("id") or 0)] = json.dumps(
                {
                    "status": run.get("status"),
                    "success": run.get("success"),
                    "finished_at": run.get("finished_at"),
                    "error_message": run.get("error_message"),
                },
                sort_keys=True,
            )

        yield f"event: snapshot\ndata: {json.dumps(initial_snapshot)}\n\n"

        while True:
            try:
                # Use threadpool for delta snapshot with fresh session
                delta = await run_in_threadpool(
                    _fetch_snapshot_safe,
                    user_id=user_id,
                    since_run_id=int(cursor.get("run_id", 0)),
                    since_event_id=int(cursor.get("event_id", 0)),
                    since_alert_id=int(cursor.get("alert_id", 0)),
                    since_approval_id=int(cursor.get("approval_id", 0)),
                    limit=50,
                    detail_tier=resolved_tier,
                )

                # Helper for fetching recent runs in threadpool
                def _fetch_recent_runs_safe():
                    session = get_session_for_user(user_id)
                    if not session:
                        return []
                    try:
                        return (
                            session.query(AgentRun)
                            .filter(AgentRun.user_id == user_id)
                            .order_by(AgentRun.id.desc())
                            .limit(100)
                            .all()
                        )
                    finally:
                        session.close()

                recent_runs = await run_in_threadpool(_fetch_recent_runs_safe)
                
                lifecycle_updates: List[Dict[str, Any]] = []
                for run in recent_runs:
                    signature = json.dumps(
                        {
                            "status": run.status,
                            "success": run.success,
                            "finished_at": run.finished_at.isoformat() if run.finished_at else None,
                            "error_message": run.error_message,
                        },
                        sort_keys=True,
                    )
                    previous = run_signatures.get(run.id)
                    if previous != signature:
                        lifecycle_updates.append(serialize_run(run, resolved_tier))
                        run_signatures[run.id] = signature

                if len(run_signatures) > 300:
                    keep_ids = {r.id for r in recent_runs}
                    run_signatures = {k: v for k, v in run_signatures.items() if k in keep_ids}

                has_changes = bool(
                    delta.get("events")
                    or delta.get("alerts")
                    or delta.get("approvals")
                    or lifecycle_updates
                )

                if has_changes:
                    if delta.get("cursor"):
                        cursor.update(delta["cursor"])
                    event_payload = {
                        "runs": lifecycle_updates,
                        "events": delta.get("events", []),
                        "alerts": delta.get("alerts", []),
                        "approvals": delta.get("approvals", []),
                        "cursor": cursor,
                        "ts": datetime.utcnow().isoformat(),
                    }
                    yield f"event: delta\ndata: {json.dumps(event_payload)}\n\n"
                else:
                    yield f"event: heartbeat\ndata: {json.dumps({'ts': datetime.utcnow().isoformat()})}\n\n"

                await asyncio.sleep(2.5)
            except asyncio.CancelledError:
                break
            except Exception as stream_error:
                logger.warning(f"Huddle stream loop error for user {user_id}: {stream_error}")
                error_payload = {"message": "stream_error", "ts": datetime.utcnow().isoformat()}
                yield f"event: error\ndata: {json.dumps(error_payload)}\n\n"
                await asyncio.sleep(3)

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_generator(), media_type="text/event-stream", headers=headers)


@router.post("/approvals/{approval_id}/decision")
async def decide_agent_approval_endpoint(
    approval_id: int,
    body: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    try:
        user_id = str(current_user.get("id"))
        decision = body.get("decision")
        if not decision:
            raise HTTPException(status_code=400, detail="decision is required")
        user_comments = body.get("user_comments") or ""
        existing_req = (
            db.query(AgentApprovalRequest)
            .filter(
                AgentApprovalRequest.id == approval_id,
                AgentApprovalRequest.user_id == user_id,
            )
            .first()
        )
        was_pending = bool(existing_req and existing_req.status == "pending")
        service = AgentActivityService(db, user_id)
        req = service.decide_approval_request(approval_id, decision=decision, user_comments=user_comments)
        if not req:
            raise HTTPException(status_code=404, detail="Approval request not found")

        execution = None
        if was_pending and req.status == "approved":
            payload = req.payload if isinstance(req.payload, dict) else {}
            required_action_fields = {
                "action_id",
                "agent_type",
                "action_type",
                "target_resource",
                "parameters",
                "expected_outcome",
                "risk_level",
            }
            if required_action_fields <= payload.keys():
                approved_parameters = dict(payload["parameters"]) if isinstance(payload["parameters"], dict) else {}
                approved_parameters.update(
                    {
                        "approval_recorded": True,
                        "approval_id": req.id,
                        "quality_override_approved": payload.get("parameters", {}).get("quality_override_requested") is True,
                    }
                )
                approved_action = AgentAction(
                    action_id=str(payload["action_id"]),
                    agent_type=str(payload["agent_type"]),
                    action_type=str(payload["action_type"]),
                    target_resource=str(payload["target_resource"]),
                    parameters=approved_parameters,
                    expected_outcome=str(payload["expected_outcome"]),
                    risk_level=float(payload["risk_level"]),
                    # The user has already approved this exact action. Safety
                    # validation still runs, but it must not create a second
                    # approval request.
                    requires_approval=False,
                )
                execution = await execute_agent_action(
                    user_id, approved_action.agent_type, approved_action
                )
            else:
                execution = {
                    "success": False,
                    "error": "Approval payload is not executable",
                }

                task_id = payload.get("parameters", {}).get("task_id") if isinstance(payload.get("parameters"), dict) else None
                execution_id = payload.get("parameters", {}).get("execution_id") if isinstance(payload.get("parameters"), dict) else None
                if task_id is not None and isinstance(execution, dict) and not execution.get("requires_approval"):
                    workflow_task = (
                        db.query(DailyWorkflowTask)
                        .filter(
                            DailyWorkflowTask.id == task_id,
                            DailyWorkflowTask.user_id == user_id,
                        )
                        .first()
                    )
                    if workflow_task:
                        workflow_task.status = "completed" if execution.get("success") else "pending"
                        workflow_task.completion_notes = (
                            "Approved action executed successfully."
                            if execution.get("success")
                            else str(execution.get("error") or "Approved action failed")[:4000]
                        )
                        workflow_task.updated_at = datetime.utcnow()
                        db.add(workflow_task)
                        db.commit()
                if execution_id is not None and isinstance(execution, dict) and not execution.get("requires_approval"):
                    workflow_execution = (
                        db.query(WorkflowTaskExecution)
                        .filter(
                            WorkflowTaskExecution.id == execution_id,
                            WorkflowTaskExecution.user_id == user_id,
                        )
                        .first()
                    )
                    if workflow_execution:
                        workflow_execution.status = "succeeded" if execution.get("success") else "failed"
                        workflow_execution.result_json = execution
                        workflow_execution.error_message = None if execution.get("success") else str(execution.get("error") or "")[:4000]
                        workflow_execution.completed_at = datetime.utcnow()
                        db.add(workflow_execution)
                        db.commit()
        service.create_alert(
            alert_type="approval_decision",
            title=f"Approval {req.status}",
            message=f"{req.action_type} was {req.status}",
            severity="info",
            payload={"approval_id": req.id, "decision": req.decision},
            cta_path="/approvals",
            dedupe_key=f"approval_decision:{req.id}",
        )
        return {
            "success": True,
            "data": {
                "approval": {"id": req.id, "status": req.status, "decision": req.decision},
                "execution": execution,
            },
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deciding approval for user {current_user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/orchestrate/strategy")
async def execute_marketing_strategy_endpoint(
    market_context: Dict[str, Any],
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Execute coordinated marketing strategy using autonomous agents.
    
    This endpoint triggers the complete agent team to analyze market conditions
    and execute coordinated marketing strategies autonomously.
    
    Args:
        market_context: Market context data including competitor info, trends, etc.
        
    Returns:
        Strategy execution results with agent actions and outcomes
    """
    try:
        user_id = str(current_user.get('id'))
        logger.info(f"Executing marketing strategy for user {user_id}")
        
        # Execute strategy in background for better performance
        result = await execute_marketing_strategy(user_id, market_context)
        
        if not result.get("success", False):
            raise HTTPException(status_code=500, detail=result.get("error", "Strategy execution failed"))
        
        logger.info(f"Marketing strategy executed successfully for user {user_id}")
        
        return {
            "success": True,
            "data": result,
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id
        }
        
    except Exception as e:
        logger.error(f"Error executing marketing strategy for user {current_user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def get_agent_status_endpoint(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get current status of all autonomous agents for the user.
    
    Returns:
        Agent statuses, performance metrics, and system health
    """
    try:
        user_id = str(current_user.get('id'))
        logger.info(f"Getting agent status for user {user_id}")
        
        status = await get_agent_system_status(user_id)
        
        if not status.get("success", False) and "error" in status:
            raise HTTPException(status_code=500, detail=status["error"])
        
        logger.info(f"Agent status retrieved successfully for user {user_id}")
        
        return {
            "success": True,
            "data": status,
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id
        }
        
    except Exception as e:
        logger.error(f"Error getting agent status for user {current_user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/market-signals")
async def get_market_signals_endpoint(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get current market signals detected by autonomous agents.
    
    Returns:
        List of market signals with analysis and recommendations
    """
    try:
        user_id = str(current_user.get('id'))
        logger.info(f"Getting market signals for user {user_id}")
        
        signals = await process_market_signals_for_user(user_id)
        
        # Convert MarketSignal objects to dicts
        signals_data = []
        for signal in signals:
            signals_data.append({
                "signal_id": signal.signal_id,
                "signal_type": signal.signal_type.value,
                "source": signal.source,
                "description": signal.description,
                "impact_score": signal.impact_score,
                "urgency_level": signal.urgency_level.value,
                "confidence_score": signal.confidence_score,
                "related_topics": signal.related_topics,
                "suggested_actions": signal.suggested_actions,
                "metadata": signal.metadata,
                "detected_at": signal.detected_at,
                "expires_at": signal.expires_at
            })
        
        logger.info(f"Retrieved {len(signals_data)} market signals for user {user_id}")
        
        return {
            "success": True,
            "data": {
                "signals": signals_data,
                "total_signals": len(signals_data),
                "high_priority_signals": len([s for s in signals_data if s["urgency_level"] in ["high", "critical"]]),
                "analysis_timestamp": datetime.utcnow().isoformat()
            },
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id
        }
        
    except Exception as e:
        logger.error(f"Error getting market signals for user {current_user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/execute-action")
async def execute_agent_action_endpoint(
    action: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Execute a specific action through an autonomous agent.
    
    Args:
        action: Action details including agent type, parameters, etc.
        
    Returns:
        Action execution result with success status and details
    """
    try:
        user_id = str(current_user.get('id'))
        logger.info(f"Executing agent action for user {user_id}: {action.get('action_type', 'unknown')}")
        
        # Validate action data
        required_fields = ["agent_type", "action_type", "target_resource", "parameters"]
        for field in required_fields:
            if field not in action:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        # Create AgentAction object
        action_type = str(action["action_type"]).strip().lower()
        requires_approval = bool(action.get("requires_approval", False)) or action_type in {
            "publish",
            "post",
            "send",
            "schedule",
        }
        agent_action = AgentAction(
            action_id=f"manual_{action.get('action_type')}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            agent_type=action["agent_type"],
            action_type=action_type,
            target_resource=action["target_resource"],
            parameters=action["parameters"],
            expected_outcome=action.get("expected_outcome", "Manual action execution"),
            risk_level=action.get("risk_level", 0.5),
            requires_approval=requires_approval
        )
        agent_action.parameters.setdefault(
            "idempotency_key",
            str(action.get("idempotency_key") or agent_action.action_id),
        )
        
        # Execute action through the user's cached agent system.
        result = await execute_agent_action(user_id, action["agent_type"], agent_action)
        
        if not result.get("success", False):
            raise HTTPException(status_code=500, detail=result.get("error", "Action execution failed"))
        
        logger.info(f"Agent action executed successfully for user {user_id}: {agent_action.action_id}")
        
        return {
            "success": True,
            "data": result,
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing agent action for user {current_user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/performance")
async def get_agent_performance_endpoint(
    agent_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get performance metrics for autonomous agents.
    
    Args:
        agent_id: Optional specific agent ID to get performance for
        
    Returns:
        Performance metrics, trends, and optimization recommendations
    """
    try:
        user_id = str(current_user.get('id'))
        logger.info(f"Getting agent performance for user {user_id}, agent: {agent_id or 'all'}")
        
        from services.intelligence.agents.performance_monitor import get_agent_performance_summary, get_all_agents_performance_summary
        
        if agent_id:
            performance = await get_agent_performance_summary(user_id, agent_id)
        else:
            performance = await get_all_agents_performance_summary(user_id)
        
        logger.info(f"Agent performance retrieved successfully for user {user_id}")
        
        return {
            "success": True,
            "data": performance,
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id
        }
        
    except Exception as e:
        logger.error(f"Error getting agent performance for user {current_user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/performance/record")
async def record_performance_metric_endpoint(
    metric_data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Record a performance metric for an agent.
    
    Args:
        metric_data: Performance metric data including agent_id, metric_type, value, context
        
    Returns:
        Recording confirmation and updated metrics
    """
    try:
        user_id = str(current_user.get('id'))
        logger.info(f"Recording performance metric for user {user_id}")
        
        # Validate metric data
        required_fields = ["agent_id", "metric_type", "value"]
        for field in required_fields:
            if field not in metric_data:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        # Convert metric type to enum
        try:
            metric_type = PerformanceMetric(metric_data["metric_type"])
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid metric type: {metric_data['metric_type']}")
        
        # Record performance metric
        from services.intelligence.agents.performance_monitor import record_agent_performance
        success = await record_agent_performance(
            user_id=user_id,
            agent_id=metric_data["agent_id"],
            metric_type=metric_type,
            value=metric_data["value"],
            context=metric_data.get("context", {})
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to record performance metric")
        
        logger.info(f"Performance metric recorded successfully for user {user_id}")
        
        return {
            "success": True,
            "data": {
                "metric_recorded": True,
                "agent_id": metric_data["agent_id"],
                "metric_type": metric_data["metric_type"],
                "value": metric_data["value"],
                "timestamp": datetime.utcnow().isoformat()
            },
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id
        }
        
    except Exception as e:
        logger.error(f"Error recording performance metric for user {current_user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/safety/constraints")
async def get_safety_constraints_endpoint(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get current safety constraints for autonomous agents.
    
    Returns:
        Safety constraints, validation rules, and approval requirements
    """
    try:
        user_id = str(current_user.get('id'))
        logger.info(f"Getting safety constraints for user {user_id}")
        
        from services.intelligence.agents.safety_framework import get_safety_framework
        
        safety_framework = get_safety_framework(user_id)
        constraints = safety_framework["constraint_manager"].get_constraints()
        
        # Convert constraints to serializable format
        constraints_data = {}
        for constraint_id, constraint in constraints.items():
            constraints_data[constraint_id] = {
                "constraint_id": constraint.constraint_id,
                "name": constraint.name,
                "description": constraint.description,
                "action_categories": [cat.value for cat in constraint.action_categories],
                "risk_threshold": constraint.risk_threshold,
                "approval_required": constraint.approval_required,
                "auto_approval_threshold": constraint.auto_approval_threshold,
                "daily_limit": constraint.daily_limit,
                "hourly_limit": constraint.hourly_limit,
                "created_at": constraint.created_at
            }
        
        logger.info(f"Safety constraints retrieved successfully for user {user_id}")
        
        return {
            "success": True,
            "data": {
                "constraints": constraints_data,
                "total_constraints": len(constraints_data),
                "safety_enabled": True,
                "last_updated": datetime.utcnow().isoformat()
            },
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id
        }
        
    except Exception as e:
        logger.error(f"Error getting safety constraints for user {current_user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/safety/validate-action")
async def validate_agent_action_endpoint(
    action_data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Validate an agent action against safety constraints.
    
    Args:
        action_data: Action details to validate
        
    Returns:
        Validation result with safety assessment and recommendations
    """
    try:
        user_id = str(current_user.get('id'))
        logger.info(f"Validating agent action for user {user_id}: {action_data.get('action_type', 'unknown')}")
        
        from services.intelligence.agents.safety_framework import validate_agent_action
        
        validation_result = await validate_agent_action(user_id, action_data)
        
        logger.info(f"Agent action validation completed for user {user_id}: {validation_result.is_valid}")
        
        return {
            "success": True,
            "data": {
                "is_valid": validation_result.is_valid,
                "risk_level": validation_result.risk_level.value,
                "violations": validation_result.violations,
                "recommendations": validation_result.recommendations,
                "requires_approval": validation_result.requires_approval,
                "confidence_score": validation_result.confidence_score,
                "validation_timestamp": validation_result.validation_timestamp
            },
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id
        }
        
    except Exception as e:
        logger.error(f"Error validating agent action for user {current_user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def get_agent_health_endpoint() -> Dict[str, Any]:
    """
    Get health status of the autonomous agent system.
    
    Returns:
        System health status and availability information
    """
    try:
        logger.info("Getting agent system health")
        
        # Check if agent services are available
        from services.intelligence.agents.core_agent_framework import agent_service
        from services.intelligence.agents.market_signal_detector import market_signal_service
        from services.intelligence.agents.performance_monitor import performance_service
        from services.intelligence.agents.agent_orchestrator import orchestration_service
        
        health_status = {
            "core_agent_service": hasattr(agent_service, 'agents'),
            "market_signal_service": hasattr(market_signal_service, 'detectors'),
            "performance_service": hasattr(performance_service, 'monitors'),
            "orchestration_service": hasattr(orchestration_service, 'orchestrators'),
            "overall_status": "healthy"
        }
        
        # Determine overall status
        if all(health_status.values()):
            health_status["overall_status"] = "healthy"
        elif any(health_status.values()):
            health_status["overall_status"] = "degraded"
        else:
            health_status["overall_status"] = "unhealthy"
        
        logger.info(f"Agent system health check completed: {health_status['overall_status']}")
        
        return {
            "success": True,
            "data": {
                "status": health_status["overall_status"],
                "services": health_status,
                "last_check": datetime.utcnow().isoformat()
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting agent system health: {e}")
        return {
            "success": False,
            "data": {
                "status": "unhealthy",
                "error": str(e),
                "last_check": datetime.utcnow().isoformat()
            },
            "timestamp": datetime.utcnow().isoformat()
        }
