"""
GSC Brainstorm Cache Service — read/write brainstorm results from the
per-user workspace SQLite DB. Provides transparent cache layer that
the main brainstorm service and API route can call without modifying
the core brainstorm logic.
"""

import hashlib
import json
import re
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

from sqlalchemy import select, delete
from loguru import logger

from services.database.sessions import get_session_for_user
from models.gsc_brainstorm_cache_models import GSCBrainstormCache

CACHE_TTL_HOURS = 24


def _normalize_keywords(keywords: str) -> str:
    return re.sub(r'\s+', ' ', keywords.strip().lower())[:500]


def _keywords_hash(keywords: str, site_url: Optional[str] = None) -> str:
    raw = f"{_normalize_keywords(keywords)}|{site_url or ''}"
    return hashlib.sha256(raw.encode()).hexdigest()


def get_cached_result(
    user_id: str,
    keywords: str,
    site_url: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Return cached brainstorm result if it exists and hasn't expired."""
    try:
        session = get_session_for_user(user_id)
        if not session:
            logger.warning(f"[GSC-Cache] No session for user={user_id}")
            return None
        try:
            kh = _keywords_hash(keywords, site_url)
            stmt = (
                select(GSCBrainstormCache)
                .where(
                    GSCBrainstormCache.user_id == user_id,
                    GSCBrainstormCache.keywords_hash == kh,
                    GSCBrainstormCache.expires_at > datetime.utcnow(),
                )
                .order_by(GSCBrainstormCache.created_at.desc())
                .limit(1)
            )
            row = session.execute(stmt).scalar_one_or_none()
            if row and row.result_json:
                logger.info(f"[GSC-Cache] HIT for user={user_id}, keywords='{keywords[:60]}...'")
                return json.loads(row.result_json)
            logger.info(f"[GSC-Cache] MISS for user={user_id}, keywords='{keywords[:60]}...'")
            return None
        finally:
            session.close()
    except Exception as e:
        logger.warning(f"[GSC-Cache] Read failed (falling through to live fetch): {e}")
        return None


def save_cached_result(
    user_id: str,
    keywords: str,
    result: Dict[str, Any],
    site_url: Optional[str] = None,
    ttl_hours: int = CACHE_TTL_HOURS,
) -> None:
    """Persist brainstorm result to the user's workspace DB."""
    try:
        session = get_session_for_user(user_id)
        if not session:
            logger.warning(f"[GSC-Cache] No session for user={user_id}, cache skipped")
            return
        try:
            kh = _keywords_hash(keywords, site_url)
            # Delete any existing entry for this key
            del_stmt = delete(GSCBrainstormCache).where(
                GSCBrainstormCache.user_id == user_id,
                GSCBrainstormCache.keywords_hash == kh,
            )
            session.execute(del_stmt)

            # Insert fresh cache entry
            entry = GSCBrainstormCache(
                id=str(uuid.uuid4()),
                user_id=user_id,
                keywords_hash=kh,
                keywords=keywords.strip()[:500],
                site_url=site_url[:500] if site_url else None,
                result_json=json.dumps(result, default=str),
                created_at=datetime.utcnow(),
                expires_at=datetime.utcnow() + timedelta(hours=ttl_hours),
            )
            session.add(entry)
            session.commit()
            logger.info(f"[GSC-Cache] SAVED for user={user_id}, keywords='{keywords[:60]}...'")
        finally:
            session.close()
    except Exception as e:
        logger.warning(f"[GSC-Cache] Write failed (cache skipped): {e}")


def get_last_keywords(user_id: str) -> Optional[str]:
    """Return the most recently brainstormed keywords for auto-restore."""
    try:
        session = get_session_for_user(user_id)
        if not session:
            return None
        try:
            stmt = (
                select(GSCBrainstormCache.keywords)
                .where(GSCBrainstormCache.user_id == user_id)
                .order_by(GSCBrainstormCache.created_at.desc())
                .limit(1)
            )
            row = session.execute(stmt).scalar_one_or_none()
            return row if row else None
        finally:
            session.close()
    except Exception as e:
        logger.warning(f"[GSC-Cache] get_last_keywords failed: {e}")
        return None
