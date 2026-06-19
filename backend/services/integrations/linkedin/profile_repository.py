"""
LinkedIn analysis context repository — Phase 1 persistence (SQLite).

Stores normalized profile snapshots in ``linkedin_analysis_context`` per user,
co-located with ``linkedin_oauth_tokens`` in the per-user SQLite database.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Any, Optional

from loguru import logger

from services.integrations.linkedin_oauth import LinkedInOAuthService


def compute_profile_content_hash(profile: dict[str, Any]) -> str:
    """Return SHA-256 hex digest of canonical normalized profile JSON."""
    canonical = json.dumps(profile, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class ProfileRepository:
    """Read/write ``linkedin_analysis_context`` rows for a single user."""

    _ROW_COLUMNS: tuple[str, ...] = (
        "id",
        "user_id",
        "unipile_account_id",
        "normalized_profile_json",
        "raw_userprofile_json",
        "profile_content_hash",
        "fetched_at",
        "profile_context_json",
        "profile_validation_json",
        "user_completion_json",
        "ai_profile_intelligence_json",
        "profile_context_updated_at",
        "ai_intelligence_updated_at",
        "created_at",
        "updated_at",
    )

    def __init__(
        self,
        db_path: Optional[str] = None,
        oauth: Optional[LinkedInOAuthService] = None,
    ) -> None:
        self._oauth = oauth or LinkedInOAuthService(db_path=db_path)

    def _ensure_db(self, user_id: str) -> str:
        """Ensure OAuth + analysis tables exist; return SQLite path."""
        self._oauth._init_db(user_id)
        return self._oauth._get_db_path(user_id)

    def _row_to_dict(self, row: tuple[Any, ...]) -> dict[str, Any]:
        return dict(zip(self._ROW_COLUMNS, row))

    def get_analysis_row(self, user_id: str) -> Optional[dict[str, Any]]:
        """
        Load the full analysis row for ``user_id``, or ``None`` when absent.

        Args:
            user_id: ALwrity user ID (Clerk)

        Returns:
            Row dict with all ``linkedin_analysis_context`` columns, or ``None``
        """
        logger.info("[LinkedInProfile] ProfileRepository.get_analysis_row user_id={}", user_id)
        db_path = self._ensure_db(user_id)
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT
                    id, user_id, unipile_account_id,
                    normalized_profile_json, raw_userprofile_json,
                    profile_content_hash, fetched_at,
                    profile_context_json, profile_validation_json,
                    user_completion_json, ai_profile_intelligence_json,
                    profile_context_updated_at, ai_intelligence_updated_at,
                    created_at, updated_at
                FROM linkedin_analysis_context
                WHERE user_id = ?
                """,
                (user_id,),
            )
            row = cursor.fetchone()
        if not row:
            logger.info(
                "[LinkedInProfile] ProfileRepository.get_analysis_row no row user_id={}",
                user_id,
            )
            return None
        return self._row_to_dict(row)

    def get_normalized_profile(
        self,
        user_id: str,
        *,
        row: Optional[dict[str, Any]] = None,
    ) -> Optional[dict[str, Any]]:
        """
        Read cached normalized profile JSON for ``user_id``.

        Args:
            user_id: ALwrity user ID
            row: Optional pre-loaded analysis row to avoid a second DB read

        Returns:
            Parsed normalized profile dict, or ``None`` when not stored
        """
        if row is None:
            row = self.get_analysis_row(user_id)
        if not row:
            return None
        raw_json = row.get("normalized_profile_json")
        if not raw_json:
            return None
        try:
            parsed = json.loads(raw_json)
        except json.JSONDecodeError:
            logger.error(
                "[LinkedInProfile] Invalid normalized_profile_json for user_id={}",
                user_id,
            )
            return None
        if not isinstance(parsed, dict):
            logger.error(
                "[LinkedInProfile] normalized_profile_json is not an object user_id={}",
                user_id,
            )
            return None
        return parsed

    def has_fresh_profile(
        self,
        user_id: str,
        *,
        max_age_hours: int = 168,
    ) -> bool:
        """
        Return True when a cached profile exists and ``fetched_at`` is within TTL.

        Args:
            user_id: ALwrity user ID
            max_age_hours: Maximum cache age in hours (default 7 days)

        Returns:
            True when cached profile is present and not expired
        """
        row = self.get_analysis_row(user_id)
        if not row or not row.get("normalized_profile_json") or not row.get("fetched_at"):
            return False
        fetched_at = row["fetched_at"]
        try:
            if isinstance(fetched_at, str):
                fetched_dt = datetime.fromisoformat(fetched_at.replace("Z", "+00:00"))
            else:
                fetched_dt = fetched_at
            if fetched_dt.tzinfo is not None:
                fetched_dt = fetched_dt.replace(tzinfo=None)
            age = datetime.utcnow() - fetched_dt
            fresh = age <= timedelta(hours=max_age_hours)
            logger.info(
                "[LinkedInProfile] has_fresh_profile user_id={} fresh={} age_hours={:.1f}",
                user_id,
                fresh,
                age.total_seconds() / 3600,
            )
            return fresh
        except (TypeError, ValueError) as exc:
            logger.warning(
                "[LinkedInProfile] has_fresh_profile parse error user_id={}: {}",
                user_id,
                exc,
            )
            return False

    def invalidate_downstream(self, user_id: str) -> None:
        """
        Clear Phase 2/3/5 derived columns when normalized profile hash changes.

        Args:
            user_id: ALwrity user ID
        """
        logger.info(
            "[LinkedInProfile] ProfileRepository.invalidate_downstream user_id={}",
            user_id,
        )
        db_path = self._ensure_db(user_id)
        now = datetime.utcnow().isoformat()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE linkedin_analysis_context
                SET profile_context_json = NULL,
                    profile_validation_json = NULL,
                    ai_profile_intelligence_json = NULL,
                    profile_context_updated_at = NULL,
                    ai_intelligence_updated_at = NULL,
                    updated_at = ?
                WHERE user_id = ?
                """,
                (now, user_id),
            )
            conn.commit()
        logger.info(
            "[LinkedInProfile] ProfileRepository.invalidate_downstream complete user_id={}",
            user_id,
        )

    def save_normalized_profile(
        self,
        user_id: str,
        unipile_account_id: str,
        profile: dict[str, Any],
        *,
        raw: Optional[dict[str, Any]] = None,
    ) -> str:
        """
        Upsert Phase 1 normalized profile snapshot with hash and ``fetched_at``.

        When ``profile_content_hash`` changes, derived downstream columns are cleared.

        Args:
            user_id: ALwrity user ID
            unipile_account_id: Connected Unipile account ID
            profile: Normalized ALwrity profile dict
            raw: Optional raw Unipile UserProfile (stored internally only)

        Returns:
            New ``profile_content_hash`` value
        """
        logger.info(
            "[LinkedInProfile] ProfileRepository.save_normalized_profile user_id={} "
            "unipile_account_id={}",
            user_id,
            unipile_account_id,
        )
        db_path = self._ensure_db(user_id)
        profile_json = json.dumps(profile, separators=(",", ":"), default=str)
        raw_json = json.dumps(raw, separators=(",", ":"), default=str) if raw else None
        content_hash = compute_profile_content_hash(profile)
        now = datetime.utcnow().isoformat()

        existing = self.get_analysis_row(user_id)
        hash_changed = bool(
            existing
            and existing.get("profile_content_hash")
            and existing["profile_content_hash"] != content_hash
        )

        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            if existing:
                cursor.execute(
                    """
                    UPDATE linkedin_analysis_context
                    SET unipile_account_id = ?,
                        normalized_profile_json = ?,
                        raw_userprofile_json = ?,
                        profile_content_hash = ?,
                        fetched_at = ?,
                        updated_at = ?
                    WHERE user_id = ?
                    """,
                    (
                        unipile_account_id,
                        profile_json,
                        raw_json,
                        content_hash,
                        now,
                        now,
                        user_id,
                    ),
                )
            else:
                cursor.execute(
                    """
                    INSERT INTO linkedin_analysis_context (
                        user_id,
                        unipile_account_id,
                        normalized_profile_json,
                        raw_userprofile_json,
                        profile_content_hash,
                        fetched_at,
                        created_at,
                        updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        user_id,
                        unipile_account_id,
                        profile_json,
                        raw_json,
                        content_hash,
                        now,
                        now,
                        now,
                    ),
                )
            conn.commit()

        if hash_changed:
            logger.info(
                "[LinkedInProfile] profile_content_hash changed — invalidating downstream "
                "user_id={}",
                user_id,
            )
            self.invalidate_downstream(user_id)

        logger.info(
            "[LinkedInProfile] ProfileRepository.save_normalized_profile complete "
            "user_id={} hash={} hash_changed={}",
            user_id,
            content_hash[:12],
            hash_changed,
        )
        return content_hash
