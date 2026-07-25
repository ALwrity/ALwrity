"""
Comment Assistant draft-reply cache — reuses inbox cache table rows.

Keys are per (user_id, hashed comment_id) so Unipile ids fit String(50).
TTL is 24h; successful reply clears the draft for that comment.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta
from typing import Any, Optional

from loguru import logger
from sqlalchemy.orm import Session

from models.linkedin_comment_assistant_cache_model import LinkedInCommentAssistantCache
from services.linkedin_comment_assistant_cache_service import mask_user_id

_LOG_PREFIX = "[CommentAssistantDraftCache]"

# Drafts may be reused same day; invalidate on successful reply.
DRAFT_TTL_SECONDS = 24 * 60 * 60


def make_draft_cache_key(comment_id: str) -> str:
    """Stable cache_key within String(50) for a LinkedIn comment id."""
    digest = hashlib.sha256((comment_id or "").encode("utf-8")).hexdigest()[:40]
    return f"d:{digest}"


class LinkedInCommentAssistantDraftCacheService:
    """Read/write Comment Assistant draft replies for a workspace user."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_draft_fresh(
        self,
        user_id: str,
        comment_id: str,
        *,
        ttl_seconds: int = DRAFT_TTL_SECONDS,
    ) -> Optional[dict[str, Any]]:
        """Return cached draft payload when present and within TTL."""
        key = make_draft_cache_key(comment_id)
        row: Optional[LinkedInCommentAssistantCache] = (
            self.db.query(LinkedInCommentAssistantCache)
            .filter(
                LinkedInCommentAssistantCache.user_id == user_id,
                LinkedInCommentAssistantCache.cache_key == key,
            )
            .first()
        )
        if not row:
            logger.info(
                "{} miss user={} comment_id_suffix={} (no row)",
                _LOG_PREFIX,
                mask_user_id(user_id),
                (comment_id or "")[-20:] or "(none)",
            )
            return None

        synced = row.last_synced_at or datetime.utcnow()
        if synced.tzinfo is not None:
            synced = synced.replace(tzinfo=None)
        age = datetime.utcnow() - synced
        age_seconds = int(age.total_seconds())
        if age > timedelta(seconds=ttl_seconds):
            logger.info(
                "{} stale user={} comment_id_suffix={} ttl_age={}",
                _LOG_PREFIX,
                mask_user_id(user_id),
                (comment_id or "")[-20:] or "(none)",
                age_seconds,
            )
            return None

        try:
            payload = json.loads(row.response_json)
            if not isinstance(payload, dict):
                raise ValueError("draft cache payload is not an object")
            reply = payload.get("reply")
            if not isinstance(reply, str) or not reply.strip():
                raise ValueError("draft cache missing reply")
            # Guard against hash collision across comment ids.
            stored_id = payload.get("comment_id")
            if stored_id and stored_id != comment_id:
                logger.warning(
                    "{} comment_id mismatch user={} — treating as miss",
                    _LOG_PREFIX,
                    mask_user_id(user_id),
                )
                return None
            logger.info(
                "{} hit user={} comment_id_suffix={} ttl_age={} reply_len={}",
                _LOG_PREFIX,
                mask_user_id(user_id),
                (comment_id or "")[-20:] or "(none)",
                age_seconds,
                len(reply),
            )
            return payload
        except Exception as exc:
            logger.warning(
                "{} invalid payload user={} comment_id_suffix={}: {}",
                _LOG_PREFIX,
                mask_user_id(user_id),
                (comment_id or "")[-20:] or "(none)",
                type(exc).__name__,
            )
            self.clear_draft(user_id, comment_id)
            return None

    def store_draft(
        self,
        user_id: str,
        comment_id: str,
        *,
        reply: str,
        alternative_replies: Optional[list[str]] = None,
        generation_metadata: Optional[dict[str, Any]] = None,
    ) -> datetime:
        """Upsert draft reply for (user, comment); returns last_synced_at."""
        key = make_draft_cache_key(comment_id)
        now = datetime.utcnow()
        payload = {
            "comment_id": comment_id,
            "reply": reply,
            "alternative_replies": alternative_replies or [],
            "generation_metadata": generation_metadata or {},
        }
        body = json.dumps(payload)

        existing: Optional[LinkedInCommentAssistantCache] = (
            self.db.query(LinkedInCommentAssistantCache)
            .filter(
                LinkedInCommentAssistantCache.user_id == user_id,
                LinkedInCommentAssistantCache.cache_key == key,
            )
            .first()
        )
        if existing:
            existing.response_json = body
            existing.last_synced_at = now
        else:
            self.db.add(
                LinkedInCommentAssistantCache(
                    user_id=user_id,
                    cache_key=key,
                    response_json=body,
                    last_synced_at=now,
                    stored_at=now,
                )
            )
        self.db.commit()
        logger.info(
            "{} stored user={} comment_id_suffix={} reply_len={}",
            _LOG_PREFIX,
            mask_user_id(user_id),
            (comment_id or "")[-20:] or "(none)",
            len(reply),
        )
        return now

    def clear_draft(self, user_id: str, comment_id: str) -> int:
        """Remove draft cache for one comment (e.g. after successful reply)."""
        key = make_draft_cache_key(comment_id)
        deleted = (
            self.db.query(LinkedInCommentAssistantCache)
            .filter(
                LinkedInCommentAssistantCache.user_id == user_id,
                LinkedInCommentAssistantCache.cache_key == key,
            )
            .delete()
        )
        self.db.commit()
        if deleted:
            logger.info(
                "{} cleared user={} comment_id_suffix={} rows={}",
                _LOG_PREFIX,
                mask_user_id(user_id),
                (comment_id or "")[-20:] or "(none)",
                deleted,
            )
        return deleted
