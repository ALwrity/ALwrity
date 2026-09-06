"""Invalidate downstream onboarding data when the Connect Platforms website URL changes."""

from __future__ import annotations

from dataclasses import dataclass

from loguru import logger
from sqlalchemy.orm import Session

from models.onboarding import CompetitorAnalysis, PersonaData, ResearchPreferences

LOG_PREFIX = "[onboarding:website_change]"


@dataclass
class WebsiteAnalysisSaveResult:
    success: bool
    website_url_changed: bool = False
    is_new_analysis: bool = False

    def __bool__(self) -> bool:
        return self.success


def normalize_website_url(url: str) -> str:
    if not url:
        return ""
    normalized = url.strip().lower().rstrip("/")
    if normalized.startswith("https://"):
        normalized = normalized[len("https://") :]
    elif normalized.startswith("http://"):
        normalized = normalized[len("http://") :]
    if normalized.startswith("www."):
        normalized = normalized[4:]
    return normalized


def website_urls_differ(old_url: str, new_url: str) -> bool:
    if not old_url or not new_url:
        return False
    return normalize_website_url(old_url) != normalize_website_url(new_url)


def extract_onboarding_website_url(onboarding_data: dict | None) -> str:
    if not isinstance(onboarding_data, dict):
        return ""
    analysis = onboarding_data.get("websiteAnalysis") or {}
    if isinstance(analysis, dict):
        for key in ("website_url", "url", "website"):
            value = analysis.get(key)
            if value:
                return normalize_website_url(str(value))
    return normalize_website_url(
        str(onboarding_data.get("website") or onboarding_data.get("website_url") or "")
    )


def should_reuse_persona_cache(request_website_url: str, session_website_url: str) -> bool:
    """Reuse persisted persona only when it belongs to the requested website."""
    request_url = normalize_website_url(request_website_url)
    session_url = normalize_website_url(session_website_url)
    if request_url and session_url and request_url != session_url:
        logger.info(
            f"{LOG_PREFIX} Skipping persona cache: request site {request_url} "
            f"!= session site {session_url}"
        )
        return False
    return True


def invalidate_session_downstream_research(session_id: int, db: Session) -> dict[str, int]:
    """Delete stale competitor + research preference rows for a session."""
    counts = {"competitors_deleted": 0, "research_prefs_deleted": 0, "persona_deleted": 0}
    try:
        counts["competitors_deleted"] = (
            db.query(CompetitorAnalysis)
            .filter(CompetitorAnalysis.session_id == session_id)
            .delete(synchronize_session=False)
        )
        counts["research_prefs_deleted"] = (
            db.query(ResearchPreferences)
            .filter(ResearchPreferences.session_id == session_id)
            .delete(synchronize_session=False)
        )
        counts["persona_deleted"] = (
            db.query(PersonaData)
            .filter(PersonaData.session_id == session_id)
            .delete(synchronize_session=False)
        )
        db.commit()
        logger.info(
            f"{LOG_PREFIX} Invalidated downstream research for session {session_id}: {counts}"
        )
        return counts
    except Exception as exc:
        logger.error(
            f"{LOG_PREFIX} Failed to invalidate downstream research for session {session_id}: {exc}"
        )
        db.rollback()
        raise
