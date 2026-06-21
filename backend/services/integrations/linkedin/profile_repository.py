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


_INTELLIGENCE_HASH_FIELDS: tuple[str, ...] = (
    "professional_identity",
    "primary_expertise",
    "industry",
    "experience_level",
    "knowledge_domains",
    "writing_opportunities",
    "target_audience",
    "communication_style",
    "brand_positioning",
    "summary",
)


def compute_ai_intelligence_hash(intelligence: dict[str, Any]) -> str:
    """
    Return SHA-256 hex digest of canonical ``AIProfileIntelligence`` JSON.

    Strips server ``meta`` and hashes only LLM intelligence fields (Phase 6 cache key).
    """
    if not isinstance(intelligence, dict):
        logger.error(
            "[TopicRecommendation] compute_ai_intelligence_hash invalid type={}",
            type(intelligence).__name__,
        )
        raise TypeError("AI profile intelligence must be a dict")

    payload = {
        key: intelligence[key]
        for key in _INTELLIGENCE_HASH_FIELDS
        if key in intelligence
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    logger.debug(
        "[TopicRecommendation] compute_ai_intelligence_hash hash={} bytes={} fields={}",
        digest[:12],
        len(canonical),
        len(payload),
    )
    return digest


def compute_profile_context_hash(context: dict[str, Any]) -> str:
    """
    Return SHA-256 hex digest of canonical ``LinkedInProfileContext`` JSON.

    Used by Phase 5 to detect when AI profile intelligence must be regenerated
    (e.g. after Phase 4 patches context without changing Phase 1 hash).
    """
    if not isinstance(context, dict):
        logger.error(
            "[ProfileIntelligence] compute_profile_context_hash invalid type={}",
            type(context).__name__,
        )
        raise TypeError("profile context must be a dict")
    canonical = json.dumps(context, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    logger.debug(
        "[ProfileIntelligence] compute_profile_context_hash hash={} bytes={}",
        digest[:12],
        len(canonical),
    )
    return digest


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
        "topic_recommendations_json",
        "profile_context_updated_at",
        "ai_intelligence_updated_at",
        "recommendations_updated_at",
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
                    topic_recommendations_json,
                    profile_context_updated_at, ai_intelligence_updated_at,
                    recommendations_updated_at,
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

    def get_profile_context(
        self,
        user_id: str,
        *,
        row: Optional[dict[str, Any]] = None,
    ) -> Optional[dict[str, Any]]:
        """
        Read cached profile context JSON for ``user_id``.

        Args:
            user_id: ALwrity user ID
            row: Optional pre-loaded analysis row to avoid a second DB read

        Returns:
            Parsed ``LinkedInProfileContext`` dict, or ``None`` when not stored/invalid
        """
        logger.info(
            "[LinkedInProfileContext] ProfileRepository.get_profile_context user_id={}",
            user_id,
        )
        if row is None:
            row = self.get_analysis_row(user_id)
        if not row:
            logger.info(
                "[LinkedInProfileContext] ProfileRepository.get_profile_context "
                "no row user_id={}",
                user_id,
            )
            return None
        raw_json = row.get("profile_context_json")
        if not raw_json:
            logger.info(
                "[LinkedInProfileContext] ProfileRepository.get_profile_context "
                "empty profile_context_json user_id={}",
                user_id,
            )
            return None
        try:
            parsed = json.loads(raw_json)
        except json.JSONDecodeError:
            logger.error(
                "[LinkedInProfileContext] Invalid profile_context_json user_id={}",
                user_id,
            )
            return None
        if not isinstance(parsed, dict):
            logger.error(
                "[LinkedInProfileContext] profile_context_json is not an object "
                "user_id={}",
                user_id,
            )
            return None
        logger.info(
            "[LinkedInProfileContext] ProfileRepository.get_profile_context hit "
            "user_id={}",
            user_id,
        )
        return parsed

    def save_profile_context(
        self,
        user_id: str,
        context: dict[str, Any],
        *,
        content_hash: Optional[str] = None,
    ) -> str:
        """
        Persist Phase 2 profile context JSON and ``profile_context_updated_at``.

        Does not modify ``normalized_profile_json`` or other Phase 1 columns.
        Requires an existing ``linkedin_analysis_context`` row (from Phase 1 acquire).

        Args:
            user_id: ALwrity user ID
            context: Built ``LinkedInProfileContext`` dict
            content_hash: Optional Phase 1 hash to stamp in ``meta`` before save

        Returns:
            ISO timestamp written to ``profile_context_updated_at``

        Raises:
            ValueError: When no analysis row exists for ``user_id``
        """
        logger.info(
            "[LinkedInProfileContext] ProfileRepository.save_profile_context user_id={}",
            user_id,
        )
        if not isinstance(context, dict):
            raise ValueError("profile context must be a dict")

        context_to_save = context
        if content_hash is not None:
            context_to_save = json.loads(
                json.dumps(context, separators=(",", ":"), default=str)
            )
            meta = context_to_save.get("meta")
            if not isinstance(meta, dict):
                meta = {}
                context_to_save["meta"] = meta
            meta["built_from_profile_content_hash"] = content_hash

        context_json = json.dumps(context_to_save, separators=(",", ":"), default=str)
        now = datetime.utcnow().isoformat()
        db_path = self._ensure_db(user_id)

        existing = self.get_analysis_row(user_id)
        if not existing:
            logger.error(
                "[LinkedInProfileContext] save_profile_context no analysis row "
                "user_id={}",
                user_id,
            )
            raise ValueError(
                f"No linkedin_analysis_context row for user_id={user_id!r}; "
                "acquire normalized profile first"
            )

        normalized_before = existing.get("normalized_profile_json")

        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE linkedin_analysis_context
                SET profile_context_json = ?,
                    profile_context_updated_at = ?,
                    updated_at = ?
                WHERE user_id = ?
                """,
                (context_json, now, now, user_id),
            )
            conn.commit()

        row_after = self.get_analysis_row(user_id)
        if row_after and row_after.get("normalized_profile_json") != normalized_before:
            logger.warning(
                "[LinkedInProfileContext] normalized_profile_json changed unexpectedly "
                "during save_profile_context user_id={}",
                user_id,
            )

        logger.info(
            "[LinkedInProfileContext] ProfileRepository.save_profile_context complete "
            "user_id={} profile_context_updated_at={}",
            user_id,
            now,
        )
        return now

    def get_profile_validation(
        self,
        user_id: str,
        *,
        row: Optional[dict[str, Any]] = None,
    ) -> Optional[dict[str, Any]]:
        """
        Read cached profile validation JSON for ``user_id``.

        Args:
            user_id: ALwrity user ID
            row: Optional pre-loaded analysis row to avoid a second DB read

        Returns:
            Parsed Phase 3 validation result dict, or ``None`` when not stored/invalid
        """
        logger.info(
            "[ProfileValidation] ProfileRepository.get_profile_validation user_id={}",
            user_id,
        )
        if row is None:
            row = self.get_analysis_row(user_id)
        if not row:
            logger.info(
                "[ProfileValidation] ProfileRepository.get_profile_validation "
                "no row user_id={}",
                user_id,
            )
            return None
        raw_json = row.get("profile_validation_json")
        if not raw_json:
            logger.info(
                "[ProfileValidation] ProfileRepository.get_profile_validation "
                "empty profile_validation_json user_id={}",
                user_id,
            )
            return None
        try:
            parsed = json.loads(raw_json)
        except json.JSONDecodeError:
            logger.error(
                "[ProfileValidation] Invalid profile_validation_json user_id={}",
                user_id,
            )
            return None
        if not isinstance(parsed, dict):
            logger.error(
                "[ProfileValidation] profile_validation_json is not an object "
                "user_id={}",
                user_id,
            )
            return None
        logger.info(
            "[ProfileValidation] ProfileRepository.get_profile_validation hit "
            "user_id={}",
            user_id,
        )
        return parsed

    def save_profile_validation(
        self,
        user_id: str,
        validation: dict[str, Any],
    ) -> str:
        """
        Persist Phase 3 profile validation JSON.

        Does not modify ``profile_context_json`` or Phase 1 columns.
        Requires an existing ``linkedin_analysis_context`` row.

        Args:
            user_id: ALwrity user ID
            validation: Phase 3 validation result dict

        Returns:
            ISO timestamp written to ``updated_at``

        Raises:
            ValueError: When no analysis row exists or validation is not a dict
        """
        logger.info(
            "[ProfileValidation] ProfileRepository.save_profile_validation user_id={}",
            user_id,
        )
        if not isinstance(validation, dict):
            raise ValueError("profile validation must be a dict")

        validation_json = json.dumps(validation, separators=(",", ":"), default=str)
        now = datetime.utcnow().isoformat()
        db_path = self._ensure_db(user_id)

        existing = self.get_analysis_row(user_id)
        if not existing:
            logger.error(
                "[ProfileValidation] save_profile_validation no analysis row "
                "user_id={}",
                user_id,
            )
            raise ValueError(
                f"No linkedin_analysis_context row for user_id={user_id!r}; "
                "acquire normalized profile first"
            )

        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE linkedin_analysis_context
                SET profile_validation_json = ?,
                    updated_at = ?
                WHERE user_id = ?
                """,
                (validation_json, now, user_id),
            )
            conn.commit()

        logger.info(
            "[ProfileValidation] ProfileRepository.save_profile_validation complete "
            "user_id={} updated_at={}",
            user_id,
            now,
        )
        return now

    def get_user_completion(
        self,
        user_id: str,
        *,
        row: Optional[dict[str, Any]] = None,
    ) -> Optional[dict[str, Any]]:
        """
        Read cached user completion answers for ``user_id``.

        Args:
            user_id: ALwrity user ID
            row: Optional pre-loaded analysis row to avoid a second DB read

        Returns:
            Parsed user completion dict keyed by field, or ``None`` when absent/invalid
        """
        logger.info(
            "[ProfileCompletion] ProfileRepository.get_user_completion user_id={}",
            user_id,
        )
        if row is None:
            row = self.get_analysis_row(user_id)
        if not row:
            logger.info(
                "[ProfileCompletion] ProfileRepository.get_user_completion "
                "no row user_id={}",
                user_id,
            )
            return None
        raw_json = row.get("user_completion_json")
        if not raw_json:
            logger.info(
                "[ProfileCompletion] ProfileRepository.get_user_completion "
                "empty user_completion_json user_id={}",
                user_id,
            )
            return None
        try:
            parsed = json.loads(raw_json)
        except json.JSONDecodeError:
            logger.error(
                "[ProfileCompletion] Invalid user_completion_json user_id={}",
                user_id,
            )
            return None
        if not isinstance(parsed, dict):
            logger.error(
                "[ProfileCompletion] user_completion_json is not an object "
                "user_id={}",
                user_id,
            )
            return None
        logger.info(
            "[ProfileCompletion] ProfileRepository.get_user_completion hit "
            "user_id={} field_count={}",
            user_id,
            len(parsed),
        )
        return parsed

    def save_user_completion(
        self,
        user_id: str,
        answers: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Merge user completion answers into ``user_completion_json``.

        New keys are added; existing keys are overwritten by the latest submit.

        Args:
            user_id: ALwrity user ID
            answers: Field-keyed answers from a completion submit

        Returns:
            Merged completion dict after persist

        Raises:
            ValueError: When no analysis row exists or answers is not a dict
        """
        logger.info(
            "[ProfileCompletion] ProfileRepository.save_user_completion user_id={} "
            "answer_keys={}",
            user_id,
            sorted(answers.keys()) if isinstance(answers, dict) else None,
        )
        if not isinstance(answers, dict):
            raise ValueError("user completion answers must be a dict")

        existing = self.get_analysis_row(user_id)
        if not existing:
            logger.error(
                "[ProfileCompletion] save_user_completion no analysis row "
                "user_id={}",
                user_id,
            )
            raise ValueError(
                f"No linkedin_analysis_context row for user_id={user_id!r}; "
                "acquire normalized profile first"
            )

        merged: dict[str, Any] = {}
        current = self.get_user_completion(user_id, row=existing)
        if current:
            merged.update(current)
        merged.update(answers)

        completion_json = json.dumps(merged, separators=(",", ":"), default=str)
        now = datetime.utcnow().isoformat()
        db_path = self._ensure_db(user_id)

        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE linkedin_analysis_context
                SET user_completion_json = ?,
                    updated_at = ?
                WHERE user_id = ?
                """,
                (completion_json, now, user_id),
            )
            conn.commit()

        logger.info(
            "[ProfileCompletion] ProfileRepository.save_user_completion complete "
            "user_id={} field_count={}",
            user_id,
            len(merged),
        )
        return merged

    def get_ai_profile_intelligence(
        self,
        user_id: str,
        *,
        row: Optional[dict[str, Any]] = None,
    ) -> Optional[dict[str, Any]]:
        """
        Read cached AI profile intelligence JSON for ``user_id``.

        Args:
            user_id: ALwrity user ID
            row: Optional pre-loaded analysis row to avoid a second DB read

        Returns:
            Parsed Phase 5 intelligence dict, or ``None`` when not stored/invalid
        """
        logger.info(
            "[ProfileIntelligence] ProfileRepository.get_ai_profile_intelligence "
            "user_id={}",
            user_id,
        )
        if row is None:
            row = self.get_analysis_row(user_id)
        if not row:
            logger.info(
                "[ProfileIntelligence] ProfileRepository.get_ai_profile_intelligence "
                "no row user_id={}",
                user_id,
            )
            return None
        raw_json = row.get("ai_profile_intelligence_json")
        if not raw_json:
            logger.info(
                "[ProfileIntelligence] ProfileRepository.get_ai_profile_intelligence "
                "empty ai_profile_intelligence_json user_id={}",
                user_id,
            )
            return None
        try:
            parsed = json.loads(raw_json)
        except json.JSONDecodeError as exc:
            logger.exception(
                "[ProfileIntelligence] Invalid ai_profile_intelligence_json "
                "user_id={}: {}",
                user_id,
                exc,
            )
            return None
        if not isinstance(parsed, dict):
            logger.error(
                "[ProfileIntelligence] ai_profile_intelligence_json is not an object "
                "user_id={}",
                user_id,
            )
            return None
        logger.info(
            "[ProfileIntelligence] ProfileRepository.get_ai_profile_intelligence hit "
            "user_id={}",
            user_id,
        )
        return parsed

    def save_ai_profile_intelligence(
        self,
        user_id: str,
        intelligence: dict[str, Any],
        *,
        context_hash: Optional[str] = None,
    ) -> str:
        """
        Persist Phase 5 AI profile intelligence JSON and ``ai_intelligence_updated_at``.

        Does not modify ``profile_context_json`` or upstream columns.
        Requires an existing ``linkedin_analysis_context`` row.

        Args:
            user_id: ALwrity user ID
            intelligence: Validated AI profile intelligence dict
            context_hash: Optional profile context hash to stamp in ``meta``

        Returns:
            ISO timestamp written to ``ai_intelligence_updated_at``

        Raises:
            ValueError: When no analysis row exists or intelligence is not a dict
        """
        logger.info(
            "[ProfileIntelligence] ProfileRepository.save_ai_profile_intelligence "
            "user_id={}",
            user_id,
        )
        if not isinstance(intelligence, dict):
            raise ValueError("AI profile intelligence must be a dict")

        intelligence_to_save = intelligence
        if context_hash is not None:
            intelligence_to_save = json.loads(
                json.dumps(intelligence, separators=(",", ":"), default=str)
            )
            meta = intelligence_to_save.get("meta")
            if not isinstance(meta, dict):
                meta = {}
                intelligence_to_save["meta"] = meta
            meta["built_from_profile_context_hash"] = context_hash

        intelligence_json = json.dumps(
            intelligence_to_save,
            separators=(",", ":"),
            default=str,
        )
        now = datetime.utcnow().isoformat()
        db_path = self._ensure_db(user_id)

        existing = self.get_analysis_row(user_id)
        if not existing:
            logger.error(
                "[ProfileIntelligence] save_ai_profile_intelligence no analysis row "
                "user_id={}",
                user_id,
            )
            raise ValueError(
                f"No linkedin_analysis_context row for user_id={user_id!r}; "
                "acquire normalized profile first"
            )

        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(
                    """
                    UPDATE linkedin_analysis_context
                    SET ai_profile_intelligence_json = ?,
                        ai_intelligence_updated_at = ?,
                        updated_at = ?
                    WHERE user_id = ?
                    """,
                    (intelligence_json, now, now, user_id),
                )
                conn.commit()
            except sqlite3.Error as exc:
                logger.exception(
                    "[ProfileIntelligence] save_ai_profile_intelligence db error "
                    "user_id={}: {}",
                    user_id,
                    exc,
                )
                raise ValueError(
                    "Failed to persist AI profile intelligence"
                ) from exc

        logger.info(
            "[ProfileIntelligence] ProfileRepository.save_ai_profile_intelligence "
            "complete user_id={} ai_intelligence_updated_at={} context_hash={}",
            user_id,
            now,
            context_hash[:12] if context_hash else None,
        )
        self._clear_topic_recommendations(user_id, db_path=db_path, updated_at=now)
        return now

    def get_topic_recommendations(
        self,
        user_id: str,
        *,
        row: Optional[dict[str, Any]] = None,
    ) -> Optional[dict[str, Any]]:
        """
        Read cached topic recommendations JSON for ``user_id``.

        Args:
            user_id: ALwrity user ID
            row: Optional pre-loaded analysis row to avoid a second DB read

        Returns:
            Parsed Phase 6 recommendations dict, or ``None`` when not stored/invalid
        """
        logger.info(
            "[TopicRecommendation] ProfileRepository.get_topic_recommendations user_id={}",
            user_id,
        )
        if row is None:
            row = self.get_analysis_row(user_id)
        if not row:
            logger.info(
                "[TopicRecommendation] ProfileRepository.get_topic_recommendations "
                "no row user_id={}",
                user_id,
            )
            return None
        raw_json = row.get("topic_recommendations_json")
        if not raw_json:
            logger.info(
                "[TopicRecommendation] ProfileRepository.get_topic_recommendations "
                "empty topic_recommendations_json user_id={}",
                user_id,
            )
            return None
        try:
            parsed = json.loads(raw_json)
        except json.JSONDecodeError as exc:
            logger.exception(
                "[TopicRecommendation] Invalid topic_recommendations_json user_id={}: {}",
                user_id,
                exc,
            )
            return None
        if not isinstance(parsed, dict):
            logger.error(
                "[TopicRecommendation] topic_recommendations_json is not an object user_id={}",
                user_id,
            )
            return None
        logger.info(
            "[TopicRecommendation] ProfileRepository.get_topic_recommendations hit user_id={}",
            user_id,
        )
        return parsed

    def save_topic_recommendations(
        self,
        user_id: str,
        recommendations: dict[str, Any],
        *,
        intelligence_hash: Optional[str] = None,
    ) -> str:
        """
        Persist Phase 6 topic recommendations JSON and ``recommendations_updated_at``.

        Requires an existing ``linkedin_analysis_context`` row.

        Args:
            user_id: ALwrity user ID
            recommendations: Validated stored recommendations dict
            intelligence_hash: Optional intelligence hash to stamp in ``meta``

        Returns:
            ISO timestamp written to ``recommendations_updated_at``

        Raises:
            ValueError: When no analysis row exists or recommendations is not a dict
        """
        logger.info(
            "[TopicRecommendation] ProfileRepository.save_topic_recommendations user_id={}",
            user_id,
        )
        if not isinstance(recommendations, dict):
            raise ValueError("Topic recommendations must be a dict")

        recommendations_to_save = recommendations
        if intelligence_hash is not None:
            recommendations_to_save = json.loads(
                json.dumps(recommendations, separators=(",", ":"), default=str)
            )
            meta = recommendations_to_save.get("meta")
            if not isinstance(meta, dict):
                meta = {}
                recommendations_to_save["meta"] = meta
            meta["built_from_intelligence_hash"] = intelligence_hash

        recommendations_json = json.dumps(
            recommendations_to_save,
            separators=(",", ":"),
            default=str,
        )
        now = datetime.utcnow().isoformat()
        db_path = self._ensure_db(user_id)

        existing = self.get_analysis_row(user_id)
        if not existing:
            logger.error(
                "[TopicRecommendation] save_topic_recommendations no analysis row user_id={}",
                user_id,
            )
            raise ValueError(
                f"No linkedin_analysis_context row for user_id={user_id!r}; "
                "acquire normalized profile first"
            )

        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(
                    """
                    UPDATE linkedin_analysis_context
                    SET topic_recommendations_json = ?,
                        recommendations_updated_at = ?,
                        updated_at = ?
                    WHERE user_id = ?
                    """,
                    (recommendations_json, now, now, user_id),
                )
                conn.commit()
            except sqlite3.Error as exc:
                logger.exception(
                    "[TopicRecommendation] save_topic_recommendations db error user_id={}: {}",
                    user_id,
                    exc,
                )
                raise ValueError("Failed to persist topic recommendations") from exc

        logger.info(
            "[TopicRecommendation] ProfileRepository.save_topic_recommendations "
            "complete user_id={} recommendations_updated_at={} intelligence_hash={}",
            user_id,
            now,
            intelligence_hash[:12] if intelligence_hash else None,
        )
        return now

    def _clear_topic_recommendations(
        self,
        user_id: str,
        *,
        db_path: str,
        updated_at: str,
    ) -> None:
        """Clear Phase 6 recommendations when upstream intelligence changes."""
        logger.info(
            "[TopicRecommendation] ProfileRepository._clear_topic_recommendations user_id={}",
            user_id,
        )
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE linkedin_analysis_context
                SET topic_recommendations_json = NULL,
                    recommendations_updated_at = NULL,
                    updated_at = ?
                WHERE user_id = ?
                """,
                (updated_at, user_id),
            )
            conn.commit()
        logger.info(
            "[TopicRecommendation] ProfileRepository._clear_topic_recommendations complete "
            "user_id={}",
            user_id,
        )

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
        Clear Phase 2/3/4/5 derived columns when normalized profile hash changes.

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
                    user_completion_json = NULL,
                    ai_profile_intelligence_json = NULL,
                    topic_recommendations_json = NULL,
                    profile_context_updated_at = NULL,
                    ai_intelligence_updated_at = NULL,
                    recommendations_updated_at = NULL,
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
