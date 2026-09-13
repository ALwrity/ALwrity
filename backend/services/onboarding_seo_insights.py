"""
Phase 12 (plan Phase C) — SEO-informed onboarding.

Backend persistence + prefill for the onboarding→SEO feedback loop:

- C1: the Step-0 on-page audit result (previously volatile in the wizard UI)
  is persisted into ``website_analyses.seo_audit['on_page_audit']`` under the
  per-user seo_audit lock, so later steps and the SEO dashboard can consume it.
- C2: a post-GSC-connect snapshot (striking-distance + low-CTR keywords from
  REAL stored GSC rows) is persisted into ``seo_audit['gsc_snapshot']``.
- C3: ``build_seo_prefill`` exposes onboarding content pillars + the site URL
  so the dashboard meta-description tool can prefill from real onboarding data.

All writes merge (never clobber siblings) and are honest: empty inputs yield
empty results, never fabricated keywords/metrics.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime

from loguru import logger
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from models.onboarding import WebsiteAnalysis, OnboardingSession, ResearchPreferences
from services.seo_audit_lock import get_seo_audit_lock


def compact_on_page_audit(audit_result: Any, website_url: str) -> Dict[str, Any]:
    """Reduce an on-page audit payload to the SEO SSOT-relevant fields."""
    audit = audit_result if isinstance(audit_result, dict) else {}
    issues = audit.get("issues") or []
    return {
        "website_url": website_url,
        "overall_score": audit.get("overall_score"),
        "meta": audit.get("meta"),
        "technical": audit.get("technical"),
        "content_health": audit.get("content_health"),
        "issue_count": len(issues) if isinstance(issues, list) else 0,
        "data_source": audit.get("data_source", "on_page_service"),
    }


def summarize_gsc_rows(rows: Optional[List[Dict[str, Any]]]) -> Dict[str, Any]:
    """Derive striking-distance and low-CTR highlights from REAL GSC rows.

    GSC row shape: {'keys': [query], 'clicks', 'impressions', 'ctr'
    (fraction), 'position'}. Thresholds: striking = position 4-10 with >=50
    impressions; low CTR = ctr < 2% with >=100 impressions.
    """
    striking: List[Dict[str, Any]] = []
    low_ctr: List[Dict[str, Any]] = []
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        keys = row.get("keys") or []
        keyword = keys[0] if keys else None
        if not keyword:
            continue
        position = row.get("position")
        ctr = row.get("ctr")
        impressions = row.get("impressions", 0) or 0
        entry = {
            "keyword": keyword,
            "position": round(float(position), 1) if position is not None else None,
            "impressions": impressions,
            "ctr": round(float(ctr) * 100, 2) if ctr is not None else None,
        }
        if position is not None and 4 <= float(position) <= 10 and impressions >= 50:
            striking.append(entry)
        if ctr is not None and float(ctr) < 0.02 and impressions >= 100:
            low_ctr.append(entry)

    striking.sort(key=lambda e: e["impressions"], reverse=True)
    low_ctr.sort(key=lambda e: e["impressions"], reverse=True)
    return {
        "striking_distance": striking[:10],
        "low_ctr": low_ctr[:10],
        "totals": {
            "keywords_analyzed": len([r for r in (rows or []) if isinstance(r, dict)]),
            "striking_distance": len(striking),
            "low_ctr": len(low_ctr),
        },
    }


def _load_analysis(db: Session, user_id: str):
    session = (
        db.query(OnboardingSession)
        .filter(OnboardingSession.user_id == user_id)
        .first()
    )
    if not session:
        return None, None
    analysis = (
        db.query(WebsiteAnalysis)
        .filter(WebsiteAnalysis.session_id == session.id)
        .first()
    )
    return session, analysis


async def persist_on_page_audit(
    user_id: str,
    website_url: str,
    audit_result: Any,
    db: Session,
) -> Dict[str, Any]:
    """Persist the Step-0 on-page audit into the SEO SSOT (merge under lock)."""

    async def _do() -> Dict[str, Any]:
        session, analysis = _load_analysis(db, user_id)
        if not session or not analysis:
            raise ValueError("No onboarding session/website analysis for user")

        seo_audit = dict(analysis.seo_audit or {})
        compact = compact_on_page_audit(audit_result, website_url)
        seo_audit["on_page_audit"] = compact
        seo_audit["last_on_page_audit_at"] = datetime.utcnow().isoformat()
        analysis.seo_audit = seo_audit
        flag_modified(analysis, "seo_audit")
        db.commit()
        logger.info(f"Persisted on-page audit for user {user_id} into seo_audit")
        return compact

    lock = await get_seo_audit_lock(user_id)
    async with lock:
        return await _do()


async def persist_gsc_snapshot(
    user_id: str,
    site_url: str,
    snapshot: Dict[str, Any],
    db: Session,
) -> Dict[str, Any]:
    """Persist the post-GSC-connect snapshot into the SEO SSOT (merge under lock)."""

    async def _do() -> Dict[str, Any]:
        session, analysis = _load_analysis(db, user_id)
        if not session or not analysis:
            raise ValueError("No onboarding session/website analysis for user")

        seo_audit = dict(analysis.seo_audit or {})
        stored = dict(snapshot or {})
        stored["site_url"] = site_url
        seo_audit["gsc_snapshot"] = stored
        seo_audit["last_gsc_snapshot_at"] = datetime.utcnow().isoformat()
        analysis.seo_audit = seo_audit
        flag_modified(analysis, "seo_audit")
        db.commit()
        logger.info(f"Persisted GSC snapshot for user {user_id} into seo_audit")
        return stored

    lock = await get_seo_audit_lock(user_id)
    async with lock:
        return await _do()


def build_seo_prefill(user_id: str, db: Session) -> Dict[str, Any]:
    """C3: onboarding-derived prefill for the dashboard meta tool.

    Returns the real site URL and the content pillars discovered in onboarding
    (deduped, order-preserving). Empty when onboarding has no data yet — the
    caller must not fabricate keywords.
    """
    session, analysis = _load_analysis(db, user_id)
    if not session or not analysis:
        return {"website_url": "", "keywords": [], "source": "onboarding"}

    prefs = (
        db.query(ResearchPreferences)
        .filter(ResearchPreferences.session_id == session.id)
        .first()
    )
    pillars = (prefs.content_pillars if prefs else None) or []
    keywords = [
        p.strip()
        for p in pillars
        if isinstance(p, str) and p.strip()
    ]
    # Dedupe, order-preserving.
    keywords = list(dict.fromkeys(keywords))

    return {
        "website_url": getattr(analysis, "website_url", None) or "",
        "keywords": keywords,
        "source": "onboarding",
    }
