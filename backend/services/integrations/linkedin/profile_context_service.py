"""
Phase 2 — Profile context orchestration (cache-first build).

Invoked after Phase 1 acquire; never calls Unipile.
"""

from __future__ import annotations

from typing import Any, Optional

from loguru import logger

from services.integrations.linkedin.profile_context_builder import build_profile_context
from services.integrations.linkedin.profile_context_types import (
    ProfileContextAcquireMeta,
    ProfileContextBuildError,
)
from services.integrations.linkedin.profile_repository import ProfileRepository

_LOG_PREFIX = "[LinkedInProfileContext]"


def _context_hash_matches(
    cached_context: dict[str, Any],
    profile_content_hash: Optional[str],
) -> bool:
    """Return True when cached context meta matches the current profile hash."""
    if not profile_content_hash:
        return False
    meta = cached_context.get("meta")
    if not isinstance(meta, dict):
        return False
    stored_hash = meta.get("built_from_profile_content_hash")
    return isinstance(stored_hash, str) and stored_hash == profile_content_hash


def get_or_build_profile_context(
    user_id: str,
    normalized_profile: dict[str, Any],
    *,
    profile_content_hash: Optional[str] = None,
    repository: Optional[ProfileRepository] = None,
    force_rebuild: bool = False,
) -> tuple[dict[str, Any], ProfileContextAcquireMeta]:
    """
    Cache-first orchestrator: return profile context and acquisition metadata.

    Serves from ``profile_context_json`` when present and ``profile_content_hash``
    matches the stored snapshot. Otherwise builds from ``normalized_profile``,
    persists, and returns ``meta.source = "built"``.

    Args:
        user_id: ALwrity user ID (Clerk)
        normalized_profile: Phase 1 normalized profile dict
        profile_content_hash: Current normalized profile hash from Phase 1 meta
        repository: Optional ``ProfileRepository`` (for testing)
        force_rebuild: Skip cache and rebuild context

    Returns:
        Tuple of (profile context dict, acquire meta with source cache|built)

    Raises:
        ProfileContextBuildError: When context cannot be built
        ValueError: When persistence fails (e.g. missing analysis row)
    """
    logger.info(
        "{} get_or_build_profile_context user_id={} force_rebuild={} hash={}",
        _LOG_PREFIX,
        user_id,
        force_rebuild,
        profile_content_hash[:12] if profile_content_hash else None,
    )
    repo = repository or ProfileRepository()

    if not force_rebuild:
        row = repo.get_analysis_row(user_id)
        cached = repo.get_profile_context(user_id, row=row) if row else None
        row_hash = row.get("profile_content_hash") if row else None
        if (
            cached
            and profile_content_hash
            and row_hash == profile_content_hash
            and _context_hash_matches(cached, profile_content_hash)
        ):
            meta: ProfileContextAcquireMeta = {
                "source": "cache",
                "profile_context_updated_at": (
                    row.get("profile_context_updated_at") if row else None
                ),
            }
            logger.info(
                "{} get_or_build_profile_context source=cache user_id={}",
                _LOG_PREFIX,
                user_id,
            )
            return cached, meta

        if cached and profile_content_hash and row_hash != profile_content_hash:
            logger.info(
                "{} profile_content_hash mismatch — rebuilding context user_id={}",
                _LOG_PREFIX,
                user_id,
            )
        elif row and not cached:
            logger.info(
                "{} profile_context_json empty — building context user_id={}",
                _LOG_PREFIX,
                user_id,
            )

    try:
        context = build_profile_context(
            normalized_profile,
            content_hash=profile_content_hash or "",
        )
        updated_at = repo.save_profile_context(
            user_id,
            context,
            content_hash=profile_content_hash,
        )
    except ProfileContextBuildError:
        logger.exception(
            "{} get_or_build_profile_context build failed user_id={}",
            _LOG_PREFIX,
            user_id,
        )
        raise
    except Exception as exc:
        logger.exception(
            "{} get_or_build_profile_context unexpected error user_id={}: {}",
            _LOG_PREFIX,
            user_id,
            exc,
        )
        raise ProfileContextBuildError(
            "Unable to build LinkedIn profile context"
        ) from exc

    built_meta: ProfileContextAcquireMeta = {
        "source": "built",
        "profile_context_updated_at": updated_at,
    }
    logger.info(
        "{} get_or_build_profile_context source=built user_id={} updated_at={}",
        _LOG_PREFIX,
        user_id,
        updated_at,
    )
    return context, built_meta
