"""Pillar coverage enforcement and task sanitization.

Extracted from today_workflow_service.py (Phase 2 refactoring).
All public names are re-exported from the original module to preserve
import paths and monkeypatch compatibility.
"""
import json
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from loguru import logger

from services.llm_providers.main_text_generation import llm_text_gen
from services.intelligence.agents.output_contracts import resolve_recommendation_action

# A pillar backfilled within this window is left uncovered for the day
# instead of being re-filled with another near-identical coverage task.
PILLAR_BACKFILL_CADENCE_DAYS = 7

# Task metadata sources produced by the backfill path itself.
_BACKFILL_SOURCES = {"llm_pillar_backfill", "controlled_fallback"}

_VALID_BACKFILL_MODES = {"on", "off", "llm_only"}


def _pillar_backfill_mode() -> str:
    """Operator gate for the pillar-backfill cost path.

    ``off`` (default): no coverage enforcement — uncovered pillars stay
    uncovered (honest absence). If an agent failed to cover a pillar, the
    user sees the failed agent and can retry it instead of receiving a
    generic template or an invented LLM task.
    ``on``: weekly-cadenced LLM backfill with controlled fallback.
    ``llm_only``: LLM generation runs, but a failed generation yields no
    template task.
    Invalid/missing values fall back to ``off`` so a typo can't silently
    enable an invented-coverage cost path.
    """
    raw = str(os.getenv("TODAY_WORKFLOW_PILLAR_BACKFILL", "")).strip().lower()
    return raw if raw in _VALID_BACKFILL_MODES else "off"


def count_template_fallback_tasks(tasks: List[Dict[str, Any]]) -> int:
    """Count tasks whose content came from static fallback synthesis."""
    count = 0
    for task in tasks if isinstance(tasks, list) else []:
        metadata = task.get("metadata") if isinstance(task, dict) else {}
        metadata = metadata if isinstance(metadata, dict) else {}
        if metadata.get("synthesis_mode") == "template_fallback":
            count += 1
    return count


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
    if v in {"pending", "in_progress", "awaiting_approval", "completed", "skipped", "dismissed"}:
        return "skipped" if v == "dismissed" else v
    return "pending"


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

    from services.today_workflow_service import PILLAR_IDS

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
    action_contract = resolve_recommendation_action(sanitized)
    sanitized["actionType"] = action_contract["action_type"]
    metadata = sanitized.get("metadata") if isinstance(sanitized.get("metadata"), dict) else {}
    sanitized["recommendation"] = str(task.get("recommendation") or sanitized["description"]).strip()
    sanitized["nextAction"] = str(
        task.get("nextAction")
        or task.get("next_action")
        or (f"Open {sanitized['actionUrl']}" if sanitized["actionUrl"] else "Review and choose the next action")
    ).strip()
    sanitized["ownerAgent"] = str(
        task.get("ownerAgent") or task.get("owner_agent") or metadata.get("source_agent") or agent_name or "workflow"
    ).strip()
    sanitized["kpi"] = task.get("kpi")
    sanitized["deadline"] = task.get("deadline")
    metadata["action_parameters"] = action_contract["parameters"]
    metadata["action_contract"] = action_contract
    sanitized["metadata"] = metadata
    return sanitized


def _resolve_backfill_provider(user_id: str) -> tuple:
    """Resolve the (provider, model) the user's tenant config prefers.

    The pillar backfill runs after the agent committee, so it should
    use the same provider+model the rest of the workflow uses. This
    is a thin wrapper around the same config the LLM committee
    functions consult; if the config can't be resolved (e.g. tenant
    provider not configured), returns ``(None, None)`` so the
    underlying ``llm_text_gen`` falls back to its default selection.

    Returning a tuple rather than an opaque dict keeps the call site
    small and matches the ``llm_text_gen`` parameter shape.
    """
    try:
        from services.llm_providers.tenant_provider_config import (
            tenant_provider_config_resolver,
        )
        provider_cfg = tenant_provider_config_resolver.resolve(user_id)
        provider = None
        if provider_cfg.selected_providers:
            first = provider_cfg.selected_providers[0]
            if first in ("google", "gemini"):
                provider = "google"
            elif first in ("huggingface", "hf_response_api", "hf"):
                provider = "huggingface"
            elif first in ("wavespeed", "wave"):
                provider = "wavespeed"
            elif first in ("openai", "gpt"):
                provider = "openai"
        model = provider_cfg.model_policy.get("default_model") if provider_cfg.model_policy else None
        return provider, model
    except Exception as e:
        logger.debug(
            f"Could not resolve tenant provider config for user {user_id}: {e}"
        )
        return None, None


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
    # Resolve the (provider, model) the tenant's LLM committee uses,
    # so backfill tasks don't silently use a different (possibly
    # inferior) model than the rest of the workflow.
    preferred_provider, preferred_model = _resolve_backfill_provider(user_id)
    try:
        raw = llm_text_gen(
            prompt=prompt,
            json_struct=schema,
            user_id=user_id,
            preferred_provider=preferred_provider,
            model=preferred_model,
        )
        candidate = raw if isinstance(raw, dict) else json.loads(raw)
    except Exception as e:
        logger.warning(f"Failed to generate pillar backfill task for {pillar_id}: {e}")
        return _controlled_pillar_fallback(pillar_id, str(e))

    candidate = _sanitize_task(candidate)
    if candidate:
        candidate["pillarId"] = pillar_id
        metadata = candidate.get("metadata") if isinstance(candidate.get("metadata"), dict) else {}
        metadata["source"] = "llm_pillar_backfill"
        # Personalized LLM generation for lifecycle coverage.
        metadata["synthesis_mode"] = "llm"
        # Mark the backfill as coming from the same provider the
        # committee uses, for transparency in operator dashboards.
        if preferred_provider or preferred_model:
            metadata["backfill_provider"] = preferred_provider
            metadata["backfill_model"] = preferred_model
        candidate["metadata"] = metadata
    return candidate or _controlled_pillar_fallback(pillar_id, "LLM returned an invalid task")


def _controlled_pillar_fallback(pillar_id: str, error: str = "") -> Dict[str, Any]:
    """Preserve lifecycle coverage without inventing an LLM recommendation."""
    fallback = {
        "plan": ("Review marketing goals", "/content-planning-dashboard"),
        "generate": ("Create a content brief", "/blog-writer"),
        "publish": ("Review the publishing queue", "/scheduler-dashboard"),
        "analyze": ("Review marketing performance", "/analytics-dashboard"),
        "engage": ("Plan audience engagement", "/linkedin-studio"),
        "remarket": ("Review remarketing opportunities", "/remarketing-dashboard"),
    }
    title, action_url = fallback.get(
        pillar_id,
        (f"Review {pillar_id} workflow", "/content-planning-dashboard"),
    )
    return {
        "pillarId": pillar_id,
        "title": title,
        "description": "Open the relevant workflow and define the next concrete action.",
        "priority": "medium",
        "estimatedTime": 15,
        "actionType": "navigate",
        "actionUrl": action_url,
        "enabled": True,
        "metadata": {
            "source": "controlled_fallback",
            "reasoning": "Pillar coverage was preserved without inventing an LLM recommendation.",
            "generation_error": error[:300] if error else None,
            "synthesis_mode": "template_fallback",
        },
    }


def _is_backfill_due(
    last_backfill_iso: Optional[str],
    now: datetime,
    cadence_days: int = PILLAR_BACKFILL_CADENCE_DAYS,
) -> bool:
    """A pillar is due for backfill when never backfilled, on an
    unparseable timestamp, or when the last backfill is at least
    ``cadence_days`` old. Unknown state fails open to generation so a
    broken cadence lookup can never silently starve coverage forever.
    """
    if not last_backfill_iso:
        return True
    try:
        last = datetime.fromisoformat(str(last_backfill_iso))
    except (TypeError, ValueError):
        return True
    return (now - last).total_seconds() >= cadence_days * 86400


async def _get_last_backfill_dates(
    user_id: str,
    cadence_days: int = PILLAR_BACKFILL_CADENCE_DAYS,
) -> Dict[str, str]:
    """Map ``pillar_id -> ISO timestamp`` of the newest persisted backfill
    task per pillar, looked back over twice the cadence window.

    Reads from persisted DailyWorkflowTask rows (metadata.source marks the
    backfill path). Returns an empty dict on any failure — callers then see
    every pillar as due, preserving today's behavior rather than inventing
    coverage state.
    """
    from starlette.concurrency import run_in_threadpool

    from models.daily_workflow_models import DailyWorkflowTask
    from services.database import get_session_for_user

    def _query() -> Dict[str, str]:
        session = get_session_for_user(user_id)
        try:
            since = datetime.utcnow() - timedelta(days=max(1, cadence_days) * 2)
            rows = (
                session.query(
                    DailyWorkflowTask.pillar_id,
                    DailyWorkflowTask.created_at,
                    DailyWorkflowTask.metadata_json,
                )
                .filter(
                    DailyWorkflowTask.user_id == user_id,
                    DailyWorkflowTask.created_at >= since,
                )
                .all()
            )
            latest: Dict[str, datetime] = {}
            for pillar_id, created_at, metadata_json in rows:
                if not pillar_id:
                    continue
                meta = metadata_json if isinstance(metadata_json, dict) else {}
                if str(meta.get("source") or "") not in _BACKFILL_SOURCES:
                    continue
                prev = latest.get(pillar_id)
                if created_at is not None and (prev is None or created_at > prev):
                    latest[pillar_id] = created_at
            return {pillar: ts.isoformat() for pillar, ts in latest.items()}
        finally:
            session.close()

    try:
        return await run_in_threadpool(_query)
    except Exception as exc:
        logger.warning(f"Backfill cadence lookup unavailable for user {user_id}: {exc}")
        return {}


async def _ensure_pillar_coverage(
    tasks: List[Dict[str, Any]],
    user_id: str,
    date: str,
    grounding: Dict[str, Any],
) -> List[Dict[str, Any]]:
    sanitized_tasks = [t for t in (_sanitize_task(task) for task in tasks) if t]
    if not _is_coverage_guardrail_enabled(grounding):
        return sanitized_tasks

    backfill_mode = _pillar_backfill_mode()
    if backfill_mode == "off":
        logger.info("Pillar backfill disabled via TODAY_WORKFLOW_PILLAR_BACKFILL=off")
        return sanitized_tasks

    from services.today_workflow_service import PILLAR_IDS

    covered_pillars = {task["pillarId"] for task in sanitized_tasks}
    last_backfills = await _get_last_backfill_dates(user_id)
    now = datetime.utcnow()

    for pillar_id in PILLAR_IDS:
        if pillar_id in covered_pillars:
            continue
        if not _is_backfill_due(last_backfills.get(pillar_id), now):
            logger.info(
                f"Pillar {pillar_id}: backfill skipped — a backfill task exists "
                f"within the last {PILLAR_BACKFILL_CADENCE_DAYS} days"
            )
            continue

        generated = _build_single_task_for_missing_pillar(user_id, date, pillar_id, grounding)
        if not generated:
            continue
        if (
            backfill_mode == "llm_only"
            and str((generated.get("metadata") or {}).get("source")) == "controlled_fallback"
        ):
            logger.info(
                f"Pillar {pillar_id}: template task suppressed "
                f"(TODAY_WORKFLOW_PILLAR_BACKFILL=llm_only)"
            )
            continue
        sanitized_tasks.append(generated)
        covered_pillars.add(pillar_id)

    return sanitized_tasks
