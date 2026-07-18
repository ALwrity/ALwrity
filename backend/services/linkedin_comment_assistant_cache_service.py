"""
Comment Assistant inbox cache — mirrors PYMK / post-analytics workspace storage.

Stores one unfiltered inbox snapshot per user. TTL gates Unipile fan-out;
Like patches the blob; Reply invalidates so the next read rebuilds.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from loguru import logger
from sqlalchemy.orm import Session

from models.linkedin_comment_assistant_cache_model import LinkedInCommentAssistantCache
from models.linkedin_comment_assistant_models import CommentAssistantInboxResponse

CACHE_KEY = "inbox"
# Phase 4 plan: 3–5 minutes; use 5 min.
DEFAULT_TTL_SECONDS = 300


def mask_user_id(user_id: str) -> str:
    """Short masked id for logs (no full tenant identifier)."""
    if not user_id:
        return "(none)"
    return f"{user_id[:8]}…" if len(user_id) > 8 else user_id


class LinkedInCommentAssistantCacheService:
    """Read/write Comment Assistant inbox snapshots for a workspace user."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_cached(
        self, user_id: str
    ) -> Optional[tuple[CommentAssistantInboxResponse, datetime]]:
        """Return stored inbox snapshot and last_synced_at, if present."""
        row: Optional[LinkedInCommentAssistantCache] = (
            self.db.query(LinkedInCommentAssistantCache)
            .filter(
                LinkedInCommentAssistantCache.user_id == user_id,
                LinkedInCommentAssistantCache.cache_key == CACHE_KEY,
            )
            .first()
        )
        if not row:
            return None

        try:
            response = CommentAssistantInboxResponse.model_validate_json(row.response_json)
            synced = row.last_synced_at or datetime.utcnow()
            logger.info(
                "[CommentAssistantCache] hit user={} groups={} posts_considered={}",
                mask_user_id(user_id),
                len(response.groups),
                response.posts_considered,
            )
            return response, synced
        except Exception as exc:
            logger.warning(
                "[CommentAssistantCache] invalid payload user={}: {}",
                mask_user_id(user_id),
                exc,
            )
            self.clear(user_id)
            return None

    def is_fresh(
        self,
        last_synced_at: datetime,
        *,
        ttl_seconds: int = DEFAULT_TTL_SECONDS,
    ) -> bool:
        """True when cache age is within TTL."""
        synced = last_synced_at
        if synced.tzinfo is not None:
            synced = synced.replace(tzinfo=None)
        age = datetime.utcnow() - synced
        return age <= timedelta(seconds=ttl_seconds)

    def get_fresh(
        self,
        user_id: str,
        *,
        ttl_seconds: int = DEFAULT_TTL_SECONDS,
    ) -> Optional[tuple[CommentAssistantInboxResponse, datetime]]:
        """Return cache only when present and within TTL."""
        cached = self.get_cached(user_id)
        if not cached:
            logger.info(
                "[CommentAssistantCache] miss user={} (no row)",
                mask_user_id(user_id),
            )
            return None
        response, synced = cached
        if not self.is_fresh(synced, ttl_seconds=ttl_seconds):
            logger.info(
                "[CommentAssistantCache] stale user={} last_synced_at={}",
                mask_user_id(user_id),
                synced.isoformat(),
            )
            return None
        return response, synced

    def store(self, user_id: str, response: CommentAssistantInboxResponse) -> datetime:
        """Upsert full inbox snapshot; returns last_synced_at."""
        now = datetime.utcnow()
        # Persist unfiltered snapshot; priority is applied on read.
        to_store = response.model_copy(
            update={
                "priority": "all",
                "last_synced_at": now.isoformat() + "Z",
                "from_cache": False,
            }
        )
        payload = to_store.model_dump_json()

        existing: Optional[LinkedInCommentAssistantCache] = (
            self.db.query(LinkedInCommentAssistantCache)
            .filter(
                LinkedInCommentAssistantCache.user_id == user_id,
                LinkedInCommentAssistantCache.cache_key == CACHE_KEY,
            )
            .first()
        )
        if existing:
            existing.response_json = payload
            existing.last_synced_at = now
        else:
            self.db.add(
                LinkedInCommentAssistantCache(
                    user_id=user_id,
                    cache_key=CACHE_KEY,
                    response_json=payload,
                    last_synced_at=now,
                    stored_at=now,
                )
            )
        self.db.commit()
        logger.info(
            "[CommentAssistantCache] stored user={} groups={} counts={}",
            mask_user_id(user_id),
            len(response.groups),
            response.counts,
        )
        return now

    def clear(self, user_id: str) -> int:
        """Remove inbox cache for a user (e.g. after reply)."""
        deleted = (
            self.db.query(LinkedInCommentAssistantCache)
            .filter(
                LinkedInCommentAssistantCache.user_id == user_id,
                LinkedInCommentAssistantCache.cache_key == CACHE_KEY,
            )
            .delete()
        )
        self.db.commit()
        if deleted:
            logger.info(
                "[CommentAssistantCache] cleared user={} rows={}",
                mask_user_id(user_id),
                deleted,
            )
        return deleted

    def patch_reaction(
        self,
        user_id: str,
        comment_id: str,
        reaction_type: str,
    ) -> bool:
        """
        Patch user_reacted / reaction_count on a comment or nested reply in cache.
        Returns True if a matching comment was found and saved.
        """
        cached = self.get_cached(user_id)
        if not cached:
            return False

        response, _synced = cached
        target = (comment_id or "").strip()
        if not target:
            return False

        updated = False
        for group in response.groups:
            for comment in group.comments:
                if comment.id == target:
                    had = bool(comment.user_reacted)
                    comment.user_reacted = reaction_type
                    if not had:
                        comment.reaction_count = int(comment.reaction_count or 0) + 1
                    updated = True
                    break
                for reply in comment.my_replies:
                    if reply.id == target:
                        had = bool(reply.user_reacted)
                        reply.user_reacted = reaction_type
                        if not had:
                            reply.reaction_count = int(reply.reaction_count or 0) + 1
                        updated = True
                        break
                if updated:
                    break
            if updated:
                break

        if not updated:
            logger.info(
                "[CommentAssistantCache] patch_reaction miss user={} comment_id={}",
                mask_user_id(user_id),
                target,
            )
            return False

        row: Optional[LinkedInCommentAssistantCache] = (
            self.db.query(LinkedInCommentAssistantCache)
            .filter(
                LinkedInCommentAssistantCache.user_id == user_id,
                LinkedInCommentAssistantCache.cache_key == CACHE_KEY,
            )
            .first()
        )
        if not row:
            return False

        # Keep last_synced_at — reaction patch is not a LinkedIn inbox refetch.
        row.response_json = response.model_dump_json()
        self.db.commit()
        logger.info(
            "[CommentAssistantCache] patch_reaction ok user={} comment_id={} type={}",
            mask_user_id(user_id),
            target,
            reaction_type,
        )
        return True
