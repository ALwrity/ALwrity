"""Brand Brain — dashboard aggregate (Phase 1) + unified semantic search (Phase 2).

``GET /api/brand-brain/dashboard`` aggregates the three read surfaces the
Brand Brain page renders in one request:

- ``onboarding`` — canonical SSOT envelope (canonical_profile + its sources,
  data_quality, onboarding_session, processing_timestamp) plus a lightweight
  ``indexing`` health block from the latest ``SIFIndexingTask`` row;
- ``domains.strategy`` — the full strategy SIF status, reused verbatim from
  ``services.intelligence.strategy_sif_status.build_strategy_sif_status_payload``;
- ``domains.calendar`` — the calendar SIF status, mirrored here from
  ``/calendar/sif-status`` so the (dirty, parallel-work) calendar modules stay
  untouched.

``GET /api/brand-brain/semantic-search`` is the honest superset of the three
existing per-domain searches (onboarding white-box, strategy prefix-scoped,
calendar prefix-scoped): one request, one scoped result set, no overlap.

Bucketing (contract locked in ``docs/planning/brand-brain-dashboard.md``):

- ``strategy``  — doc ids ``user:{uid}:strategy_active:current:*``
- ``calendar``  — doc ids ``user:{uid}:calendar_latest:*``
- ``onboarding`` — everything else, labeled from the indexed ``metadata.type``
  (``website_analysis``, ``persona``, ``competitor_analysis``, ``seo_dashboard``,
  ``seo_page_audit``, ``user_content``, ``enhanced_content_strategy``,
  ``enhanced_ai_analysis``, ``content_gap_analysis``, ``market_trends``,
  ``agent_failure_log``).

Guarantees:

- ``scope`` in {all, onboarding, strategy, calendar}; anything else -> 400.
- ``limit`` bounded (1..20, FastAPI 422 outside).
- identical doc ids across raw hits are deduped on the best score.
- embedding failure never fabricates answers: 200 with ``hits: []`` and an
  explicit ``error`` string (mirrors the strategy/calendar search contracts).

Feature gate (Phase 6): both endpoints 404 with
``brand_brain_dashboard_enabled()`` off (env ``BRAND_BRAIN_DASHBOARD_ENABLED``
in the falsy set ``{0, false, no, off}``, default ON), before any DB or
service work — frontend parity is ``brandBrainConfig.ts``.

The label maps below mirror the canonical definitions in
``strategy_wizard_endpoints.STRATEGY_KIND_LABELS`` and
``calendar_generation.KIND_LABELS`` (kept local so this module has no heavy
cross-package imports and the calendar modules stay untouched).
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger

from middleware.auth_middleware import get_current_user
from models.calendar_sif_index_status import CalendarSifIndexStatus
from models.calendar_sif_watermark import CalendarSifWatermark
from services.calendar_sif_source_ids import (
    CALENDAR_KINDS,
    calendar_latest_doc_id,
    calendar_latest_source_id,
)
from services.database import get_session_for_user
from services.intelligence.brand_brain_features import brand_brain_dashboard_enabled
from services.intelligence.sif_strategy_source_ids import active_strategy_source_id

router = APIRouter(prefix="/api/brand-brain", tags=["Brand Brain"])

SCOPE_ALL = "all"
SCOPE_ONBOARDING = "onboarding"
SCOPE_STRATEGY = "strategy"
SCOPE_CALENDAR = "calendar"
VALID_SCOPES = {SCOPE_ALL, SCOPE_ONBOARDING, SCOPE_STRATEGY, SCOPE_CALENDAR}

STRATEGY_KIND_LABELS: Dict[str, str] = {
    "form_summary": "Strategy summary",
    "base_strategy": "Base strategy",
    "strategic_insights": "Strategic insights",
    "competitive_analysis": "Competitive analysis",
    "performance_predictions": "Performance predictions",
    "implementation_roadmap": "Implementation roadmap",
    "risk_assessment": "Risk assessment",
    "user_persona_digest": "User persona",
}

CALENDAR_KIND_LABELS: Dict[str, str] = {
    "calendar_overview": "Calendar overview",
    "daily_schedule": "Daily schedule",
    "weekly_themes": "Weekly themes",
    "content_recommendations": "Content recommendations",
    "performance_predictions": "Performance predictions",
    "ai_insights": "AI insights",
    "strategy_alignment": "Strategy alignment",
    "calendar_events": "Calendar events",
}

ONBOARDING_TYPE_LABELS: Dict[str, str] = {
    "persona": "Persona",
    "market_trends": "Market trends",
    "enhanced_content_strategy": "Content strategy",
    "enhanced_ai_analysis": "Strategy AI analysis",
    "content_gap_analysis": "Content gap analysis",
    "website_analysis": "Website analysis",
    "competitor_analysis": "Competitor analysis",
    "seo_dashboard": "SEO dashboard",
    "seo_page_audit": "SEO page audit",
    "user_content": "User content",
    "agent_failure_log": "Agent failure log",
}
DEFAULT_ONBOARDING_LABEL = "Onboarding"


def get_db(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Per-user workspace DB session (mirrors the wizard utilities)."""
    user_id = str(current_user.get("id"))
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    db = get_session_for_user(user_id)
    if not db:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable")
    try:
        yield db
    finally:
        db.close()


def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value is not None else None


def _as_int_user_id(user_id: str) -> Optional[int]:
    try:
        return int(user_id)
    except (TypeError, ValueError):
        return None


def _get_calendar_watermark(db, user_id: str, source_id: str):
    """Read the single ``calendar_sif_watermarks`` row (never raises).

    Equivalent to ``CalendarSifWatermark.is_fresh(..., "") or _get_watermark``
    in the calendar endpoint: ``is_fresh`` short-circuits to False on an empty
    hash, so the row query is the value that ends up being used.
    """
    try:
        return (
            db.query(CalendarSifWatermark)
            .filter(
                CalendarSifWatermark.user_id == user_id,
                CalendarSifWatermark.source_id == source_id,
            )
            .one_or_none()
        )
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
        return None


def _onboarding_indexing_payload(db, user_id: str) -> Dict[str, Any]:
    """Lightweight SIF health block from the latest ``SIFIndexingTask`` row.

    Mirrors the ``sif_indexing`` task surface of ``/onboarding/status``
    (phase-based progress, freshness in hours, stale when > 48h) without the
    execution-log enrichment. Never loads txtai and never raises.
    """
    base = {
        "status": None,
        "phase": "not_indexed",
        "progress_pct": None,
        "details": {},
        "last_success": None,
        "index_freshness_hours": None,
        "index_stale": False,
    }
    try:
        from models.website_analysis_monitoring_models import SIFIndexingTask

        task = (
            db.query(SIFIndexingTask)
            .filter(SIFIndexingTask.user_id == user_id)
            .order_by(SIFIndexingTask.updated_at.desc())
            .first()
        )
    except Exception:
        return base
    if task is None:
        return base

    payload = getattr(task, "payload", None) or {}
    last_success = getattr(task, "last_success", None)

    details = {
        key: payload[key]
        for key in (
            "phase", "pages_harvested", "pages_total", "sitemap_total",
            "pages_indexed", "pillars_found", "indexed_pages", "log_messages",
        )
        if payload.get(key) is not None
    }
    details["harvest_source"] = payload.get("harvest_source", "beautifulsoup")

    freshness_hours = None
    if last_success is not None:
        try:
            delta = datetime.utcnow() - last_success
            hours = delta.total_seconds() / 3600
            if hours >= 0:
                freshness_hours = round(hours, 1)
        except Exception:
            freshness_hours = None

    _PHASE_PROGRESS = {
        "harvesting": 10,
        "indexing_metadata": 30,
        "indexing_content": 60,
        "analyzing": 80,
        "complete": 100,
    }
    if last_success is not None:
        status = "completed"
        progress_pct = 100
    elif getattr(task, "failure_reason", None) or getattr(task, "last_failure", None):
        status = "failed"
        progress_pct = None
    else:
        status = getattr(task, "status", None) or "unknown"
        progress_pct = _PHASE_PROGRESS.get(payload.get("phase"))

    return {
        "status": status,
        "phase": payload.get("phase") or (status if last_success is None else "complete"),
        "progress_pct": progress_pct,
        "details": details,
        "last_success": _iso(last_success),
        "index_freshness_hours": freshness_hours,
        "index_stale": freshness_hours is not None and freshness_hours > 48,
    }


def _calendar_status_payload(db, user_id: str) -> Dict[str, Any]:
    """Mirror of ``/calendar/sif-status`` so this module carries its own read.

    Never writes, never loads txtai. The calendar modules stay untouched
    while the parallel content-calendar work is in flight.
    """
    source_id = calendar_latest_source_id(user_id)

    row = CalendarSifIndexStatus.get(db, user_id, source_id)
    if row is not None:
        indexing = {
            "phase": row.status if row.status is not None else "not_indexed",
            "status": row.status,
            "embedding_count": row.embedding_count,
            "error_message": row.error_message,
            "started_at": _iso(row.started_at),
            "finished_at": _iso(row.finished_at),
        }
    else:
        indexing = {
            "phase": "not_indexed",
            "status": None,
            "embedding_count": 0,
            "error_message": None,
            "started_at": None,
            "finished_at": None,
        }

    watermark_row = _get_calendar_watermark(db, user_id, source_id)
    watermark = (
        {
            "embedding_count": watermark_row.embedding_count,
            "indexed_at": _iso(watermark_row.indexed_at),
            "source_hash": watermark_row.source_hash,
        }
        if watermark_row is not None
        else None
    )

    return {
        "indexing": indexing,
        "watermark": watermark,
        "document_kinds": {
            "names": list(CALENDAR_KINDS),
            "doc_ids": [calendar_latest_doc_id(user_id, k) for k in CALENDAR_KINDS],
            "count": len(CALENDAR_KINDS),
        },
    }


@router.get("/dashboard")
async def get_brand_brain_dashboard(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Any = Depends(get_db),
) -> Dict[str, Any]:
    """Aggregate the Brand Brain dashboard (identity + both indexed domains).

    Read-only: the canonical envelope is served from the cached integration
    result (``get_integrated_data_sync`` never rebuilds), strategy status is
    the existing ``build_strategy_sif_status_payload``, and calendar status is
    the local read-only mirror. Django-style aggregate, no writes, no txtai.
    """
    if not brand_brain_dashboard_enabled():
        raise HTTPException(status_code=404, detail="Brand Brain dashboard is disabled")
    try:
        user_id = str(current_user.get("id"))

        from api.content_planning.services.content_strategy.onboarding import (
            OnboardingDataIntegrationService,
        )
        from services.intelligence.strategy_sif_status import (
            build_strategy_sif_status_payload,
        )

        integrated = OnboardingDataIntegrationService().get_integrated_data_sync(user_id, db)

        onboarding_session = integrated.get("onboarding_session") or {}
        canonical_profile = integrated.get("canonical_profile") or {}
        ready = bool(onboarding_session and canonical_profile)

        onboarding = None
        if ready:
            onboarding = {
                "canonical_profile": canonical_profile,
                "sources": canonical_profile.get("sources", {}),
                "data_quality": integrated.get("data_quality") or {},
                "onboarding_session": onboarding_session,
                "processing_timestamp": integrated.get("processing_timestamp"),
                "indexing": _onboarding_indexing_payload(db, user_id),
            }

        strategy_status = build_strategy_sif_status_payload(
            db, user_id, _as_int_user_id(user_id)
        )
        calendar_status = _calendar_status_payload(db, user_id)

        payload = {
            "onboarding": onboarding,
            "domains": {
                "strategy": strategy_status,
                "calendar": calendar_status,
            },
        }
        logger.info(f"🧠 Brand Brain dashboard served for user {user_id}")
        from api.content_planning.utils.response_builders import ResponseBuilder

        return ResponseBuilder.create_success_response(
            message="Brand Brain dashboard retrieved",
            data=payload,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Brand Brain dashboard failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve Brand Brain dashboard")


def _normalize_hit(result: Any) -> Optional[Tuple[str, float, str]]:
    """Extract ``(doc_id, score, text)`` from a raw txtai hit.

    Txtai returns dicts (``{"id", "score", "text", ...}``) or tuples
    ``(id, score)`` depending on the search path; bare values are dropped.
    """
    if isinstance(result, dict):
        doc_id = result.get("id")
        score = result.get("score") or 0
        text = result.get("text") or ""
    elif isinstance(result, (list, tuple)):
        doc_id = result[0] if len(result) > 0 else None
        score = result[1] if len(result) > 1 else 0
        text = ""
    else:
        return None
    doc_id = str(doc_id) if doc_id is not None else ""
    if not doc_id:
        return None
    return doc_id, float(score), text


def classify_hit(
    doc_id: str,
    strategy_prefix: str,
    calendar_prefix: str,
    onboarding_type: Optional[str],
) -> Dict[str, str]:
    """Bucket a doc id into a domain + kind + human kind label (pure).

    Strategy/calendar kinds are the trailing segment of the doc id; the
    onboarding "kind" is the indexed ``metadata.type`` (may be empty for old
    docs, in which case the label falls back to "Onboarding").
    """
    if doc_id.startswith(strategy_prefix):
        kind = doc_id.rsplit(":", 1)[-1]
        return {
            "domain": SCOPE_STRATEGY,
            "kind": kind,
            "kind_label": STRATEGY_KIND_LABELS.get(kind, kind),
        }
    if doc_id.startswith(calendar_prefix):
        kind = doc_id.rsplit(":", 1)[-1]
        return {
            "domain": SCOPE_CALENDAR,
            "kind": kind,
            "kind_label": CALENDAR_KIND_LABELS.get(kind, kind),
        }
    kind = onboarding_type or ""
    return {
        "domain": SCOPE_ONBOARDING,
        "kind": kind,
        "kind_label": ONBOARDING_TYPE_LABELS.get(kind, DEFAULT_ONBOARDING_LABEL),
    }


def _metadata_type(raw_metadata: Any) -> Optional[str]:
    """Read ``metadata.type`` from an indexed object (str JSON / dict / None)."""
    if raw_metadata is None:
        return None
    if isinstance(raw_metadata, str):
        try:
            raw_metadata = json.loads(raw_metadata)
        except (ValueError, TypeError):
            return None
    if isinstance(raw_metadata, dict):
        value = raw_metadata.get("type")
        return str(value) if value is not None else None
    return None


@router.get("/semantic-search")
async def search_brand_brain(
    query: str = "",
    scope: str = SCOPE_ALL,
    limit: int = Query(4, ge=1, le=20),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Unified scoped semantic search over the user's Brand Brain (SIF index)."""
    if not brand_brain_dashboard_enabled():
        raise HTTPException(status_code=404, detail="Brand Brain dashboard is disabled")
    try:
        if scope not in VALID_SCOPES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid scope '{scope}'. Expected one of: all, onboarding, strategy, calendar.",
            )

        user_id = str(current_user.get("id"))
        strategy_prefix = f"{active_strategy_source_id(user_id)}:"
        calendar_prefix = f"{calendar_latest_source_id(user_id)}:"

        from services.intelligence.txtai_service import TxtaiIntelligenceService

        svc = TxtaiIntelligenceService(user_id)
        raw = await svc.search(query, limit=max(limit * 4, 12))

        best_by_id: Dict[str, Dict[str, Any]] = {}
        for result in raw or []:
            normalized = _normalize_hit(result)
            if normalized is None:
                continue
            doc_id, score, text = normalized

            is_onboarding = not (
                doc_id.startswith(strategy_prefix) or doc_id.startswith(calendar_prefix)
            )
            metadata_type = None
            if is_onboarding:
                metadata_type = _metadata_type(svc.get_document_metadata(doc_id))
            classified = classify_hit(doc_id, strategy_prefix, calendar_prefix, metadata_type)

            if scope != SCOPE_ALL and classified["domain"] != scope:
                continue

            existing = best_by_id.get(doc_id)
            if existing is not None and existing["score"] >= score:
                continue

            if not text or text == doc_id:
                try:
                    text = svc.get_document_text(doc_id)
                except Exception:
                    text = ""
            best_by_id[doc_id] = {
                "id": doc_id,
                "domain": classified["domain"],
                "kind": classified["kind"],
                "kind_label": classified["kind_label"],
                "score": score,
                "text": text,
            }

        hits = sorted(best_by_id.values(), key=lambda h: h["score"], reverse=True)[:limit]
        logger.info(
            f"🧠 Brand Brain semantic search '{query}' scope={scope} -> {len(hits)} hits for user {user_id}"
        )
        return {
            "status": "success",
            "data": {"query": query, "scope": scope, "hits": hits},
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Brand Brain semantic search failed: {str(e)}")
        return {
            "status": "success",
            "data": {"query": query, "scope": scope, "hits": [], "error": str(e)},
        }