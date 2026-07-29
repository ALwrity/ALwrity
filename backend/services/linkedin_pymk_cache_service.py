"""LinkedIn PYMK cache service — DB persistence mirroring post analytics storage."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from loguru import logger
from sqlalchemy.orm import Session

from models.linkedin_pymk_cache_model import LinkedInPymkCache
from models.linkedin_pymk_models import PymkListResponse


def _normalize_cohort_id(cohort_id: Optional[str]) -> str:
    return (cohort_id or "").strip()


class LinkedInPymkCacheService:
    """Read/write cached PYMK suggestion lists for a workspace user."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_cached(
        self,
        user_id: str,
        cohort: str,
        cohort_id: Optional[str] = None,
    ) -> Optional[PymkListResponse]:
        """Return stored PYMK list for the cohort key, if present."""
        normalized_id = _normalize_cohort_id(cohort_id)
        row: Optional[LinkedInPymkCache] = (
            self.db.query(LinkedInPymkCache)
            .filter(
                LinkedInPymkCache.user_id == user_id,
                LinkedInPymkCache.cohort == cohort,
                LinkedInPymkCache.cohort_id == normalized_id,
            )
            .first()
        )
        if not row:
            return None

        try:
            response = PymkListResponse.model_validate_json(row.response_json)
            logger.info(
                "[PymkCacheService] Cache hit user_id={} cohort={} cohort_id={} suggestions={}",
                user_id,
                cohort,
                normalized_id or "(empty)",
                len(response.suggestions),
            )
            return response
        except Exception as exc:
            logger.warning(
                "[PymkCacheService] Invalid cache payload user_id={} cohort={}: {}",
                user_id,
                cohort,
                exc,
            )
            self.clear(user_id, cohort, normalized_id)
            return None

    def store(
        self,
        user_id: str,
        cohort: str,
        cohort_id: Optional[str],
        response: PymkListResponse,
    ) -> None:
        """Upsert cached PYMK suggestions for the cohort key."""
        normalized_id = _normalize_cohort_id(cohort_id)
        now = datetime.utcnow()
        payload = response.model_dump_json()

        existing: Optional[LinkedInPymkCache] = (
            self.db.query(LinkedInPymkCache)
            .filter(
                LinkedInPymkCache.user_id == user_id,
                LinkedInPymkCache.cohort == cohort,
                LinkedInPymkCache.cohort_id == normalized_id,
            )
            .first()
        )

        if existing:
            existing.response_json = payload
            existing.last_synced_at = now
        else:
            self.db.add(
                LinkedInPymkCache(
                    user_id=user_id,
                    cohort=cohort,
                    cohort_id=normalized_id,
                    response_json=payload,
                    last_synced_at=now,
                    stored_at=now,
                )
            )

        self.db.commit()
        logger.info(
            "[PymkCacheService] Stored cache user_id={} cohort={} cohort_id={} suggestions={}",
            user_id,
            cohort,
            normalized_id or "(empty)",
            len(response.suggestions),
        )

    def clear(
        self,
        user_id: str,
        cohort: Optional[str] = None,
        cohort_id: Optional[str] = None,
    ) -> int:
        """Remove cached PYMK rows for a user (optionally scoped to one cohort key)."""
        query = self.db.query(LinkedInPymkCache).filter(LinkedInPymkCache.user_id == user_id)
        if cohort is not None:
            query = query.filter(LinkedInPymkCache.cohort == cohort)
            query = query.filter(LinkedInPymkCache.cohort_id == _normalize_cohort_id(cohort_id))
        deleted = query.delete()
        self.db.commit()
        if deleted:
            logger.info(
                "[PymkCacheService] Cleared {} cache row(s) user_id={} cohort={}",
                deleted,
                user_id,
                cohort,
            )
        return deleted
