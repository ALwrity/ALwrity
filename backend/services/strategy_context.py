"""Strategy-context digest for agent meetings (Phase 1).

Builds a COMPACT, DB-derived digest of the user's ACTIVE content strategy so
the daily committee gets the "what are we trying to achieve" layer
(KPI targets, roadmap milestones, risks, positioning) without a raw AI-JSON
dump overflowing the prompt.

Design contract:
    - One active strategy per user (via ``strategy_common.resolve_active_strategy``).
    - Pure, decoupled flattener of ``ai_recommendations`` (dict or JSON-string)
      with hard caps per section so the digest stays within a token budget.
    - Fail-fast on DB errors: return ``{status: 'error'}` with a limitation +
      structured logging — never raise into the meeting flow.
    - Only REAL stored fields; empty sections are returned as ``[]`` / ``""``
      (truthful absence, nothing fabricated).

Digest envelope:
    {
      "status": "inactive" | "error" | "available",
      "strategy_id": int | None,
      "name": str,
      "created_at": str | None,     # ISO of the strategy's creation (roadmap window reference)
      "summary": str,
      "positioning": str,
      "goals": [str],               # business_objectives / base_strategy
      "kpi_targets": [ {metric, target, period} ],   # capped
      "roadmap": [ {phase, milestone, timeline, status} ],  # capped
      "risks": [ {title, severity, mitigation} ],    # capped
      "generated_at": str,
      "limitations": [str],
    }
"""

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from models.enhanced_strategy_models import EnhancedContentStrategy
from services.strategy_common import resolve_active_strategy
from utils.logger_utils import get_service_logger

logger = get_service_logger("strategy_context")

# Per-section caps keep the digest bounded (serialized ~<= 3000 chars).
_MAX_KPIS = 8
_MAX_ROADMAP = 8
_MAX_RISKS = 5
_MAX_GOALS = 6
_MAX_POSITIONING_CHARS = 300
_MAX_SUMMARY_CHARS = 300
_MAX_MILESTONE_CHARS = 160
_MAX_KPI_STRING = 200
_MAX_RISK_STRING = 300

# Hard bound for the rendered strategy block used in LLM fallback prompts.
_STRATEGY_BLOCK_BUDGET = 1500


def format_strategy_block(strategy_context: Optional[Dict[str, Any]]) -> str:
    """Render a compact, bounded "Strategy focus" block for LLM prompts.

    Only renders when ``status == 'available'`` AND there is at least one
    actionable section (kpi_targets, roadmap, goals, positioning, summary).
    The output stays <= ``_STRATEGY_BLOCK_BUDGET`` chars so the strategy
    shapes the prompt without drowning it. Empty/inactive/error -> "".
    """
    if not isinstance(strategy_context, dict):
        return ""
    if strategy_context.get("status") != "available":
        return ""
    name = _str(strategy_context.get("name"))
    summary = _str(strategy_context.get("summary"))
    goals = [_textify(g) for g in (strategy_context.get("goals") or []) if _textify(g)]
    kpis = [k for k in (strategy_context.get("kpi_targets") or []) if isinstance(k, dict)]
    roadmap = [m for m in (strategy_context.get("roadmap") or []) if isinstance(m, dict)]
    positioning = _str(strategy_context.get("positioning"))

    sections = []
    if summary:
        sections.append(f"Overview: {summary}")
    if goals:
        sections.append("Goals: " + "; ".join(goals))
    if positioning:
        sections.append(f"Positioning: {positioning}")
    if kpis:
        parts = []
        for kpi in kpis:
            metric = _str(kpi.get("metric"))
            target = _textify(kpi.get("target"))
            parts.append(f"{metric} -> {target}" if metric and target else (metric or target))
        if parts:
            sections.append("KPI targets: " + "; ".join(parts))
    if roadmap:
        parts = []
        for milestone in roadmap:
            m = _str(milestone.get("milestone") or milestone.get("phase"))
            if not m:
                continue
            ctx = " · ".join(
                p for p in (
                    _str(milestone.get("phase")),
                    _str(milestone.get("timeline")),
                    _str(milestone.get("status")),
                ) if p
            )
            parts.append(f"{m}" + (f" ({ctx})" if ctx else ""))
        if parts:
            sections.append("Roadmap: " + "; ".join(parts))

    if not sections:
        return ""
    header = f"Strategy focus ({name}):" if name else "Strategy focus:"
    block = "\n".join([header] + sections)
    if len(block) > _STRATEGY_BLOCK_BUDGET:
        block = block[: _STRATEGY_BLOCK_BUDGET - 1] + "…"
    return block


def _empty_envelope(status: str, limitation: Optional[str] = None) -> Dict[str, Any]:
    envelope: Dict[str, Any] = {
        "status": status,
        "strategy_id": None,
        "name": "",
        "created_at": None,
        "summary": "",
        "positioning": "",
        "goals": [],
        "kpi_targets": [],
        "roadmap": [],
        "risks": [],
        "generated_at": datetime.utcnow().isoformat(),
    }
    envelope["limitations"] = [limitation] if limitation else []
    return envelope


def _load_ai(ai: Any) -> Dict[str, Any]:
    """Normalize ai_recommendations (JSON string or dict) to a dict."""
    if isinstance(ai, str):
        try:
            parsed = json.loads(ai)
        except (TypeError, ValueError):
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return ai if isinstance(ai, dict) else {}


def _str(value: Any) -> str:
    return str(value or "").strip()


def _textify(value: Any) -> str:
    """Render a scalar/list/dict as a short human string."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (list, tuple)):
        parts = [_str(v) for v in value]
        return ", ".join(p for p in parts if p)
    if isinstance(value, dict):
        # Flatten dict keys that read as prose (drop TS objects/nested dicts).
        parts = []
        for k, v in value.items():
            if k in ("type", "id", "key", "order"):
                continue
            if isinstance(v, (str, int, float)):
                parts.append(f"{k}: {v}")
        return ", ".join(parts)
    return _str(value)


def _digest(
    strategy_id: int, name: str, ai: Dict[str, Any], now: datetime,
    created_at: Any = None,
) -> Dict[str, Any]:
    base = ai.get("base_strategy") or {}
    insights = ai.get("strategic_insights") or {}
    roadmap = ai.get("implementation_roadmap") or {}
    risks = ai.get("risk_assessment") or {}
    predictions = ai.get("performance_predictions") or {}
    competitors = ai.get("competitive_analysis") or {}

    if not isinstance(base, dict):
        base = {}
    if not isinstance(insights, dict):
        insights = {}
    if not isinstance(roadmap, dict):
        roadmap = {}
    if not isinstance(risks, dict):
        risks = {}
    if not isinstance(predictions, dict):
        predictions = {}
    if not isinstance(competitors, dict):
        competitors = {}

    # KPIs: prefer target_metrics (dict of metric->target), fall back to
    # performance_predictions predicted values, else content_roi_targets.
    target_metrics = base.get("target_metrics") or {}
    kpis: List[Dict[str, Any]] = []
    if isinstance(target_metrics, dict):
        for metric, target in list(target_metrics.items()):
            if isinstance(target, (str, int, float)):
                kpis.append({
                    "metric": _str(metric)[:_MAX_KPI_STRING],
                    "target": _textify(target)[:_MAX_KPI_STRING],
                    "period": _str(predictions.get(f"{metric}_window") or ""),
                })
    if not kpis and isinstance(predictions, dict):
        predicted = predictions.get("predicted_trend") or {}
        if isinstance(predicted, dict):
            for metric, url in list(predicted.items())[:_MAX_KPIS]:
                kpis.append({"metric": _str(metric)[:_MAX_KPI_STRING],
                             "target": _textify(url)[:_MAX_KPI_STRING],
                             "period": ""})
    kpis = kpis[:_MAX_KPIS]

    # Roadmap milestones from implementation_roadmap.phases.
    milestones: List[Dict[str, Any]] = []
    phases = roadmap.get("phases") or []
    if isinstance(phases, list):
        for phase in phases:
            if not isinstance(phase, dict):
                continue
            milestone = _str(phase.get("milestone") or phase.get("title"))
            if not milestone:
                continue
            milestones.append({
                "phase": _str(phase.get("phase") or "")[:_MAX_MILESTONE_CHARS],
                "milestone": milestone[:_MAX_MILESTONE_CHARS],
                "timeline": _str(phase.get("timeline") or phase.get("timeframe") or "")[:_MAX_MILESTONE_CHARS],
                "status": _str(phase.get("status") or "planned"),
            })
    # Fallback: free-form roadmap dict keyed by phase.
    if not milestones and isinstance(roadmap, dict):
        for key, value in list(roadmap.items())[:_MAX_ROADMAP]:
            if key == "phases":
                continue
            milestones.append({
                "phase": _str(key)[:_MAX_MILESTONE_CHARS],
                "milestone": _textify(value)[:_MAX_MILESTONE_CHARS],
                "timeline": "",
                "status": "planned",
            })
    milestones = milestones[:_MAX_ROADMAP]

    # Risks from risk_assessment.risks.
    risk_items: List[Dict[str, Any]] = []
    risk_list = risks.get("risks") or []
    if isinstance(risk_list, list):
        for risk in risk_list:
            if not isinstance(risk, dict):
                continue
            risk_items.append({
                "title": _str(risk.get("title") or risk.get("risk") or "")[:_MAX_RISK_STRING],
                "severity": _str(risk.get("severity") or "medium"),
                "mitigation": _str(risk.get("mitigation")
                                   or risk.get("mitigation_strategy") or "")[:_MAX_RISK_STRING],
            })
    if not risk_items and isinstance(risks, dict):
        for key, value in list(risks.items())[:_MAX_RISKS]:
            if key == "risks":
                continue
            risk_items.append({"title": _str(key)[:_MAX_RISK_STRING],
                               "severity": "medium",
                               "mitigation": _textify(value)[:_MAX_RISK_STRING]})
    risk_items = risk_items[:_MAX_RISKS]

    positioning_src = (
        insights.get("market_positioning")
        or competitors.get("positioning")
        or ""
    )
    leaders = competitors.get("leaders") or competitors.get("top_competitors") or []
    if isinstance(leaders, list):
        leaders_txt = ", ".join(_str(c) for c in leaders[:5])
        positioning = f"{_textify(positioning_src)} | Leaders: {leaders_txt}".strip(" |")
    else:
        positioning = _textify(positioning_src)
    positioning = positioning[:_MAX_POSITIONING_CHARS]

    goals_src = (
        base.get("business_objectives")
        or base.get("goals")
        or []
    )
    goals: List[str] = []
    if isinstance(goals_src, list):
        goals = [_textify(g)[:_MAX_KPI_STRING] for g in goals_src]
    elif isinstance(goals_src, dict):
        goals = [_textify(v)[:_MAX_KPI_STRING]
                 for v in goals_src.values() if _textify(v)]
    goals = goals[:_MAX_GOALS]

    summary = _textify(
        ai.get("summary") or insights.get("summary") or roadmap.get("summary") or ""
    )[:_MAX_SUMMARY_CHARS]

    return {
        "status": "available",
        "strategy_id": strategy_id,
        "name": _str(name)[:200],
        "created_at": created_at.isoformat() if created_at is not None else None,
        "summary": summary,
        "positioning": positioning,
        "goals": goals,
        "kpi_targets": kpis,
        "roadmap": milestones,
        "risks": risk_items,
        "generated_at": now.isoformat(),
        "limitations": [],
    }


def build_strategy_context(db: Any, user_id: str) -> Dict[str, Any]:
    """Build the compact strategy-context digest for a user's active strategy.

    Args:
        db: SQLAlchemy session (meeting's own session — bounded reads).
        user_id: Scoped user id (Clerk string).

    Returns:
        Digest envelope. Never raises: DB errors degrade to ``{status:'error'}`
        with a structured log + limitation.
    """
    now = datetime.utcnow()
    try:
        strategy_id = resolve_active_strategy(db, user_id)
        if strategy_id is None:
            logger.info(
                f"[strategy_context] user_id={user_id} strategy=inactive"
            )
            return _empty_envelope("inactive")

        strategy = db.query(EnhancedContentStrategy).filter(
            EnhancedContentStrategy.id == strategy_id
        ).first()
        if strategy is None:
            logger.warning(
                f"[strategy_context] user_id={user_id} strategy_id={strategy_id} row_missing"
            )
            return _empty_envelope("error", "Active strategy row could not be loaded.")

        ai = _load_ai(getattr(strategy, "ai_recommendations", None))
        digest = _digest(
            strategy_id,
            getattr(strategy, "name", ""),
            ai,
            now,
            created_at=getattr(strategy, "created_at", None),
        )
        logger.info(
            f"[strategy_context] user_id={user_id} strategy_id={strategy_id} "
            f"kpis={len(digest['kpi_targets'])} roadmap={len(digest['roadmap'])} "
            f"risks={len(digest['risks'])}"
        )
        return digest
    except Exception as exc:
        logger.error(
            f"[strategy_context] user_id={user_id} db_error={exc!r}",
            exc_info=True,
        )
        return _empty_envelope("error", f"Strategy context could not be loaded: {exc}")