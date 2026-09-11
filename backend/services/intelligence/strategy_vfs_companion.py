"""SIF x Strategy integration — Phase SIF-C: VFS companion + dispatch glue.

Writes a human-readable, deterministic markdown mirror of the active
content strategy into the agent-visible VFS (``strategy/active.md`` per
user) and dispatches the async embedding task from the activation hook.

Design (locked in ``docs/planning/sif-strategy-integration.md``):

- The companion uses the *real* flat-store writer
  (``AgentFlatContextStore.save_strategy_active_markdown``) which
  atomically writes with owner-only permissions — NOT
  ``AgentContextVFS.write_context_file`` (a read-only stub).
- Writing happens synchronously in ``dispatch_activation_indexing`` and
  is best-effort: an exception is logged and swallowed so activation is
  never blocked.
- ``dispatch_activation_indexing`` is the single entry point called by
  the ``POST /strategy/activate`` endpoint after commit + cache clear.
  It: (1) respects the feature flag, (2) mirrors the markdown, then
  (3) records a ``pending`` lifecycle row in ``strategy_sif_index_status``
  and (4) schedules ``index_active_strategy_async`` (fire-and-forget).
  The task drives ``pending → running → success|skipped|failed`` so the
  UI always has a truthful status while embedding runs. Every DB/FS
  write is best-effort and never raises.
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict

from loguru import logger

from models.strategy_sif_index_status import STATUS_PENDING
from .sif_strategy_source_ids import (
    STRATEGY_FORM_FIELDS,
    _stringify_value,
    active_strategy_source_id,
)
from .strategy_indexer import (
    _to_iso,
    index_active_strategy_async,
    record_strategy_sif_status,
    strategy_sif_indexing_enabled,
)

STRATEGY_COMPANION_PATH = "strategy/active.md"


def render_active_strategy_markdown(
    strategy_data: Dict[str, Any],
    activation_date: Any,
) -> str:
    """Deterministic markdown mirror of one active strategy snapshot."""
    comprehensive = strategy_data.get("comprehensive_ai_analysis") or {}
    meta = comprehensive.get("strategy_metadata") or {}
    activation_iso = _to_iso(activation_date)

    lines = [
        "# Active Content Strategy",
        "",
        f"- strategy_id: {strategy_data.get('id', '')}",
        f"- activation_date: {activation_iso}",
        f"- version: {meta.get('version') or '2.0'}",
        f"- generated_at: {_to_iso(meta.get('generated_at'))}",
        f"- grounding_status: {meta.get('grounding_status') or 'unknown'}",
        "",
        "## Form Inputs",
    ]
    lines += [
        f"- {label}: {_stringify_value(strategy_data.get(label))}".rstrip()
        for label in STRATEGY_FORM_FIELDS
    ]

    base_strategy = comprehensive.get("base_strategy")
    if base_strategy:
        lines += ["", "## Base Strategy"]
        lines += _render_component(base_strategy)

    for component in (
        "strategic_insights",
        "competitive_analysis",
        "performance_predictions",
        "implementation_roadmap",
        "risk_assessment",
    ):
        value = comprehensive.get(component) or {}
        if value:
            lines += ["", f"## {component.replace('_', ' ').title()}"]
            lines += _render_component(value)

    return "\n".join(lines) + "\n"


def _render_component(component: Any) -> list:
    """Render an analysis component as flat ``- key: value`` bullets."""
    if not isinstance(component, dict):
        return [f"- {component}".rstrip()]
    rendered = []
    for k, v in component.items():
        rendered.append(f"- {k}: {_stringify_value(v)}".rstrip())
    return rendered


def write_vfs_companion(
    user_id: str,
    strategy_data: Dict[str, Any],
    activation_date: Any,
) -> bool:
    """Write the active-strategy markdown mirror. Best-effort, never raises."""
    from services.intelligence.agent_flat_context import AgentFlatContextStore

    try:
        store = AgentFlatContextStore(user_id)
        markdown = render_active_strategy_markdown(strategy_data, activation_date)
        return store.save_strategy_active_markdown(markdown)
    except Exception as exc:
        logger.warning(f"VFS companion write failed for user {user_id}: {exc}")
        return False


def dispatch_activation_indexing(
    db,
    user_id: str,
    strategy_data: Dict[str, Any],
    activation_date: Any,
    sif_service=None,
):
    """Post-activation hook: mirror markdown (sync, best-effort), record a
    ``pending`` lifecycle row, then embed (async fire-and-forget).

    Must be called AFTER ``db.commit()`` and cache clear in the activation
    endpoint. Returns the ``asyncio.Task`` when indexing is dispatched,
    otherwise ``None`` (feature disabled). Never raises. The task itself
    transitions the lifecycle to ``running`` → terminal and yields the
    embedded-doc count when awaited.
    """
    if not strategy_sif_indexing_enabled():
        logger.info("SIF x Strategy indexing disabled via feature flag")
        return None

    try:
        ok = write_vfs_companion(user_id, strategy_data, activation_date)
        if not ok:
            logger.warning(f"VFS companion markdown not written for user {user_id}")
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning(f"VFS companion dispatch error for user {user_id}: {exc}")

    record_strategy_sif_status(
        db, user_id, active_strategy_source_id(user_id), STATUS_PENDING
    )

    return index_active_strategy_async(
        db, user_id, strategy_data, activation_date=activation_date, sif_service=sif_service
    )