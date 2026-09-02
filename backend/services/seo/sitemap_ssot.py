"""Sitemap SSOT (single source of truth) — per-user, stored in the user's own DB.

The discovered sitemap URL and its fetched inventory (URL list, lastmod bounds,
total) are persisted into ``WebsiteAnalysis.crawl_result["sitemap_analysis"]``.
Every consumer (advertools pipeline, crawl budget, SEO audit, SIF indexing,
interactive routes) reads from this SSOT and only re-fetches when the inventory
is older than ``SITEMAP_SSOT_TTL_DAYS``.

Multi-tenancy: every helper takes the caller's per-user SQLAlchemy session
(``get_session_for_user(user_id)``) and only touches that user's rows. There is
no process-global user state here; the only shared cache (``analytics_cache``)
holds public sitemap content keyed by URL, never user data.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from loguru import logger
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

# Align with the advertools task frequency (frequency_days=7).
SITEMAP_SSOT_TTL_DAYS = 7

# Cap the persisted URL list so the JSON column cannot grow unbounded.
MAX_INVENTORY_URLS = 2000


def _load_sitemap_analysis(db: Session, user_id: str) -> Dict[str, Any]:
    """Return the stored ``crawl_result['sitemap_analysis']`` dict (or {})."""
    from models.onboarding import OnboardingSession, WebsiteAnalysis

    session = db.query(OnboardingSession).filter(
        OnboardingSession.user_id == user_id
    ).first()
    if not session:
        return {}

    analysis = db.query(WebsiteAnalysis).filter(
        WebsiteAnalysis.session_id == session.id
    ).first()
    if not analysis:
        return {}

    crawl_result = analysis.crawl_result or {}
    sitemap_analysis = crawl_result.get("sitemap_analysis")
    return sitemap_analysis if isinstance(sitemap_analysis, dict) else {}


def get_stored_sitemap_url(db: Session, user_id: str) -> Optional[str]:
    """Return the SSOT sitemap URL discovered during website analysis, if any."""
    try:
        sitemap_url = _load_sitemap_analysis(db, user_id).get("sitemap_url")
        return str(sitemap_url) if sitemap_url else None
    except Exception as e:
        logger.warning(f"[sitemap_ssot] Could not load stored sitemap url for {user_id}: {e}")
        return None


def is_inventory_fresh(ssot: Dict[str, Any]) -> bool:
    """True when the stored inventory exists and is inside the TTL window."""
    inventory = ssot.get("inventory")
    if not isinstance(inventory, dict):
        return False
    fetched_at = inventory.get("fetched_at")
    if not fetched_at:
        return False
    try:
        fetched = datetime.fromisoformat(str(fetched_at))
    except (TypeError, ValueError):
        return False
    # fetched_at is written with naive-UTC datetime.utcnow(). Comparing it
    # against local ``datetime.now()`` skews the age by the host's UTC offset
    # (e.g. +5:30), making fresh inventories look hours old on non-UTC hosts.
    # Anchor both sides to UTC explicitly.
    if fetched.tzinfo is None:
        fetched = fetched.replace(tzinfo=timezone.utc)
    age = datetime.now(timezone.utc) - fetched
    return age <= timedelta(days=SITEMAP_SSOT_TTL_DAYS)


def get_fresh_inventory(db: Session, user_id: str) -> Optional[Dict[str, Any]]:
    """Return the stored inventory when fresh, else ``None`` (caller may refresh)."""
    try:
        ssot = _load_sitemap_analysis(db, user_id)
    except Exception as e:
        logger.warning(f"[sitemap_ssot] Could not load inventory for {user_id}: {e}")
        return None
    if ssot and is_inventory_fresh(ssot):
        inventory = ssot.get("inventory")
        if isinstance(inventory, dict):
            return inventory
    return None


def save_sitemap_inventory(
    db: Session,
    user_id: str,
    website_url: str,
    sitemap_url: str,
    inventory: Dict[str, Any],
) -> bool:
    """Persist the sitemap inventory into the user's SSOT. Non-raising.

    Writes ``crawl_result['sitemap_analysis'] = {
        'sitemap_url': ..., 'inventory': {total_urls, urls, lastmod_min,
        lastmod_max, fetched_at}}`` and commits the caller's session.
    """
    try:
        from models.onboarding import OnboardingSession, WebsiteAnalysis

        session = db.query(OnboardingSession).filter(
            OnboardingSession.user_id == user_id
        ).first()
        if not session:
            logger.warning(f"[sitemap_ssot] No onboarding session for {user_id}; not saving inventory")
            return False

        analysis = db.query(WebsiteAnalysis).filter(
            WebsiteAnalysis.session_id == session.id
        ).first()
        if not analysis:
            logger.warning(f"[sitemap_ssot] No website analysis for {user_id}; not saving inventory")
            return False

        urls = inventory.get("urls") or []
        if not isinstance(urls, list):
            urls = []
        clean_urls = [u for u in urls if isinstance(u, str) and u.strip()][:MAX_INVENTORY_URLS]

        crawl_result = dict(analysis.crawl_result or {})
        sitemap_analysis = dict(crawl_result.get("sitemap_analysis") or {})
        sitemap_analysis["sitemap_url"] = sitemap_url
        sitemap_analysis["website_url"] = website_url
        sitemap_analysis["inventory"] = {
            "total_urls": inventory.get("total_urls") or len(clean_urls),
            "urls": clean_urls,
            "lastmod_min": inventory.get("lastmod_min"),
            "lastmod_max": inventory.get("lastmod_max"),
            # Preserve the caller's fetch timestamp: it describes when the
            # sitemap was actually fetched, and re-stamping it here would
            # make a stale inventory look fresh forever.
            "fetched_at": inventory.get("fetched_at") or datetime.utcnow().isoformat(),
        }
        crawl_result["sitemap_analysis"] = sitemap_analysis
        analysis.crawl_result = crawl_result
        flag_modified(analysis, "crawl_result")

        db.add(analysis)
        db.commit()
        logger.info(
            f"[sitemap_ssot] Saved sitemap inventory for {user_id} "
            f"(total={sitemap_analysis['inventory']['total_urls']}, url={sitemap_url})"
        )
        return True
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        logger.warning(f"[sitemap_ssot] Non-blocking: failed to save sitemap inventory for {user_id}: {e}")
        return False


def get_inventory_total(db: Session, user_id: str) -> int:
    """Return the fresh SSOT inventory's URL count (0 when absent/stale).

    Used by consumers that only need the sitemap SIZE (e.g. SIF indexing
    progress visibility) without touching the origin.
    """
    inventory = get_fresh_inventory(db, user_id)
    if not inventory:
        return 0
    total = inventory.get("total_urls") or 0
    try:
        return int(total)
    except (TypeError, ValueError):
        return 0


async def get_or_discover_sitemap_url(
    user_id: str,
    website_url: str,
    sitemap_service: Any,
    db: Optional[Session] = None,
) -> Optional[str]:
    """SSOT-first sitemap URL resolution for the user's OWN website.

    Returns the stored SSOT URL when present (no network), otherwise falls
    back to ``sitemap_service.discover_sitemap_url``. When no session is
    supplied (e.g. content_strategy_service has user_id but no db), a
    short-lived per-user session is opened and closed here.

    NOTE: only for the user's own website — competitor discoveries have no
    per-user SSOT and must keep calling discovery directly.
    """
    stored: Optional[str] = None
    own_db: Optional[Session] = None
    try:
        if db is not None:
            stored = get_stored_sitemap_url(db, user_id)
        else:
            from services.database import get_session_for_user

            own_db = get_session_for_user(user_id)
            stored = get_stored_sitemap_url(own_db, user_id) if own_db else None
    except Exception as e:
        logger.warning(f"[sitemap_ssot] SSOT URL read failed for {user_id} (falling back to discovery): {e}")
        stored = None
    finally:
        if own_db is not None:
            try:
                own_db.close()
            except Exception:
                pass

    if stored:
        return stored
    return await sitemap_service.discover_sitemap_url(website_url)
