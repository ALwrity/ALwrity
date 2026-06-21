"""
Pre-publish validation orchestrator (H4 + H5).

Runs duplicate detection and media validation before Zernio/native publish.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from services.integrations.linkedin.content_deduplicator import ContentDeduplicator
from services.integrations.linkedin.exceptions import (
    LinkedInDuplicateContentError,
    LinkedInMediaValidationError,
)
from services.integrations.linkedin.media_validator import (
    LinkedInMediaValidator,
    infer_media_type,
)
from services.integrations.linkedin.types import CreatePostRequest


async def run_publish_preflight(
    user_id: str,
    request: CreatePostRequest,
    *,
    db: Optional[Session] = None,
    deduplicator: Optional[ContentDeduplicator] = None,
    media_validator: Optional[LinkedInMediaValidator] = None,
) -> str:
    """
    Run H4/H5 guards before publish.

    Returns content_hash for caller to persist after successful publish.
    Raises LinkedInDuplicateContentError or LinkedInMediaValidationError on failure.
    """
    dedup = deduplicator or ContentDeduplicator()
    validator = media_validator or LinkedInMediaValidator()

    dup_result = dedup.check_duplicate(
        user_id=user_id,
        account_id=request.account_id,
        content=request.content,
        db=db,
    )
    if dup_result.is_duplicate:
        raise LinkedInDuplicateContentError(
            matched_asset_id=dup_result.matched_asset_id,
            content_hash=dup_result.content_hash,
        )

    for media_path in request.media_urls or []:
        media_type = infer_media_type(media_path)
        result = validator.validate_for_publish(media_path, media_type)
        if not result.valid:
            raise LinkedInMediaValidationError(result.errors, file_path=media_path)

    return dup_result.content_hash


async def run_upload_preflight(
    file_path: str,
    media_type: str,
    *,
    media_validator: Optional[LinkedInMediaValidator] = None,
) -> None:
    """Run H5 media validation before upload_media."""
    validator = media_validator or LinkedInMediaValidator()
    result = validator.validate_for_publish(file_path, media_type)
    if not result.valid:
        raise LinkedInMediaValidationError(result.errors, file_path=file_path)
