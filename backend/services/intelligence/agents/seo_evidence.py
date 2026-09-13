"""
Phase 13 (plan Phase D, slice 1) — real SEO evidence for agent grounding.

The daily-workflow committee already receives monitoring/strategy evidence. This
module adds the SEO equivalent so the SEO specialist (and every other agent)
proposes tasks from ACTUAL persisted signals instead of a single summary
string:

- on-page audit health (website_analyses.seo_audit['on_page_audit'])
- GSC snapshot highlights (striking distance / low CTR)
- sitemap/content-audit trend (last_content_audit_trend)
- per-page audit aggregates (seo_page_audits)

Honest-by-construction: no data -> status 'no_data' with empty lists; any
failure -> {'status': 'error', 'limitations': [...]} and never raises, matching
the strategy_monitoring/strategy_context grounding contract.
"""

from typing import Any, Dict, List

from loguru import logger

NONE_SCORE_FIX_THRESHOLD = 70


def _empty(status: str = "no_data", limitation: str = "") -> Dict[str, Any]:
    return {
        "status": status,
        "health_score": None,
        "pages_audited": 0,
        "pages_needing_fix": 0,
        "avg_page_score": None,
        "striking_distance": [],
        "low_ctr": [],
        "content_trend": None,
        "last_audit_at": None,
        "limitations": [limitation] if limitation else [],
    }


def build_seo_evidence(db, user_id: str) -> Dict[str, Any]:
    """Compose the persisted SEO signals into a compact grounding block."""
    try:
        from models.onboarding import OnboardingSession, SEOPageAudit, WebsiteAnalysis

        session = (
            db.query(OnboardingSession)
            .filter(OnboardingSession.user_id == user_id)
            .first()
        )
        analysis = None
        if session:
            analysis = (
                db.query(WebsiteAnalysis)
                .filter(WebsiteAnalysis.session_id == session.id)
                .first()
            )

        seo_audit = dict(getattr(analysis, "seo_audit", None) or {}) if analysis else {}
        on_page = seo_audit.get("on_page_audit") or {}
        gsc_snapshot = seo_audit.get("gsc_snapshot") or {}
        content_trend = seo_audit.get("last_content_audit_trend") or None

        audits: List[Any] = []
        try:
            audits = (
                db.query(SEOPageAudit)
                .filter(SEOPageAudit.user_id == user_id)
                .all()
            ) or []
        except Exception:
            audits = []

        scores = [
            float(a.overall_score)
            for a in audits
            if getattr(a, "overall_score", None) is not None
        ]

        has_data = bool(seo_audit) or bool(audits)
        evidence = {
            "status": "ok" if has_data else "no_data",
            "health_score": on_page.get("overall_score"),
            "pages_audited": len(audits),
            "pages_needing_fix": len(
                [s for s in scores if s < NONE_SCORE_FIX_THRESHOLD]
            ),
            "avg_page_score": round(sum(scores) / len(scores), 1) if scores else None,
            "striking_distance": (gsc_snapshot.get("striking_distance") or [])[:10],
            "low_ctr": (gsc_snapshot.get("low_ctr") or [])[:10],
            "content_trend": content_trend,
            "last_audit_at": seo_audit.get("last_on_page_audit_at"),
            "limitations": [],
        }
        if not has_data:
            evidence["limitations"].append(
                "No persisted SEO audit data yet for this user."
            )
        return evidence

    except Exception as exc:
        logger.warning(f"Failed to build SEO evidence for user {user_id}: {exc}")
        return _empty("error", f"SEO evidence could not be loaded: {exc}")
