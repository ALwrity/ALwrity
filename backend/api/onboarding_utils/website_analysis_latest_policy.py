"""Latest-only website analysis lookup helpers for onboarding Connect Platforms."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from loguru import logger
from sqlalchemy.orm import Session

from api.onboarding_utils.website_change_invalidation import normalize_website_url
from models.onboarding import WebsiteAnalysis

LOG_PREFIX = "[onboarding:website_analysis_latest]"


def url_matches_normalized(stored_url: str, normalized_target: str) -> bool:
    if not normalized_target:
        return False
    return normalize_website_url(stored_url) == normalized_target


def resolve_last_analyzed_at(analysis: WebsiteAnalysis) -> datetime | None:
    """Return the timestamp users should see as 'last analyzed'."""
    if getattr(analysis, "updated_at", None):
        return analysis.updated_at
    if getattr(analysis, "analysis_date", None):
        return analysis.analysis_date
    return None


def find_latest_completed_analysis(
    db: Session,
    session_id: int,
    website_url: str,
) -> WebsiteAnalysis | None:
    """Find the newest completed analysis row for a normalized site within a session."""
    normalized = normalize_website_url(website_url)
    if not normalized:
        logger.warning(f"{LOG_PREFIX} Cannot resolve latest analysis without a URL")
        return None

    rows = (
        db.query(WebsiteAnalysis)
        .filter_by(session_id=session_id, status="completed")
        .order_by(WebsiteAnalysis.updated_at.desc(), WebsiteAnalysis.id.desc())
        .all()
    )

    for row in rows:
        if url_matches_normalized(row.website_url, normalized):
            return row
    return None


def purge_superseded_analyses(
    db: Session,
    session_id: int,
    website_url: str,
    keep_id: int,
) -> int:
    """Delete older duplicate rows for the same normalized site, keeping keep_id."""
    normalized = normalize_website_url(website_url)
    if not normalized:
        return 0

    rows = db.query(WebsiteAnalysis).filter_by(session_id=session_id).all()
    deleted = 0
    for row in rows:
        if row.id == keep_id:
            continue
        if url_matches_normalized(row.website_url, normalized):
            logger.info(
                f"{LOG_PREFIX} Purging superseded analysis id={row.id} "
                f"for session={session_id} site={normalized}"
            )
            db.delete(row)
            deleted += 1

    if deleted:
        db.commit()
    return deleted


def build_check_existing_payload(analysis: WebsiteAnalysis) -> dict[str, Any]:
    last_analyzed = resolve_last_analyzed_at(analysis)
    return {
        "exists": True,
        "analysis_id": analysis.id,
        "analysis_date": analysis.analysis_date.isoformat() if analysis.analysis_date else None,
        "updated_at": analysis.updated_at.isoformat() if analysis.updated_at else None,
        "last_analyzed_at": last_analyzed.isoformat() if last_analyzed else None,
        "summary": {
            "writing_style": analysis.writing_style,
            "target_audience": analysis.target_audience,
            "content_type": analysis.content_type,
        },
    }
