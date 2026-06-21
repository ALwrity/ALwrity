"""
LinkedIn duplicate content detection (H4).

Hashes normalized post text and compares against recent ContentAsset rows
to avoid LinkedIn 422 duplicate-content rejections.
"""

from __future__ import annotations

import hashlib
import re
from datetime import datetime, timedelta
from typing import Optional

from loguru import logger
from sqlalchemy.orm import Session

from models.content_asset_models import AssetSource, AssetType, ContentAsset
from services.content_asset_service import ContentAssetService
from services.integrations.linkedin.types import DuplicateCheckResult

DEFAULT_LOOKBACK_DAYS = 30
_URL_PATTERN = re.compile(r"https?://\S+", re.IGNORECASE)
_HASHTAG_TRAIL_PATTERN = re.compile(r"(?:\s*#[\w]+\s*)+$", re.UNICODE)


def normalize_content(text: str) -> str:
    """Normalize post text for duplicate comparison."""
    if not text:
        return ""
    normalized = text.strip().lower()
    normalized = _URL_PATTERN.sub("", normalized)
    normalized = _HASHTAG_TRAIL_PATTERN.sub("", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def content_hash(text: str) -> str:
    """SHA-256 hash of normalized content."""
    normalized = normalize_content(text)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


class ContentDeduplicator:
    """Checks publish content against recent LinkedIn post hashes."""

    def __init__(self, lookback_days: int = DEFAULT_LOOKBACK_DAYS):
        self.lookback_days = lookback_days

    def check_duplicate(
        self,
        user_id: str,
        account_id: str,
        content: str,
        db: Optional[Session] = None,
    ) -> DuplicateCheckResult:
        candidate_hash = content_hash(content)

        if db is None:
            logger.debug(
                "LinkedIn dedup skipped: no DB session (user=%s, account=%s)",
                user_id,
                account_id,
            )
            return DuplicateCheckResult(
                is_duplicate=False,
                content_hash=candidate_hash,
            )

        try:
            service = ContentAssetService(db)
            date_from = datetime.utcnow() - timedelta(days=self.lookback_days)
            assets, _ = service.get_user_assets(
                user_id=user_id,
                asset_type=AssetType.TEXT,
                source_module=AssetSource.LINKEDIN_WRITER,
                date_from=date_from,
                limit=200,
            )

            for asset in assets:
                stored_hash = None
                metadata = asset.asset_metadata or {}
                if isinstance(metadata, dict):
                    stored_hash = metadata.get("linkedin_content_hash")
                    stored_account = metadata.get("linkedin_publish_account_id")
                    if stored_account and stored_account != account_id:
                        continue

                if not stored_hash and asset.description:
                    stored_hash = content_hash(asset.description)

                if stored_hash and stored_hash == candidate_hash:
                    return DuplicateCheckResult(
                        is_duplicate=True,
                        content_hash=candidate_hash,
                        matched_asset_id=asset.id,
                        reason="Content matches a recent LinkedIn post in your library.",
                    )

            return DuplicateCheckResult(
                is_duplicate=False,
                content_hash=candidate_hash,
            )
        except Exception as exc:
            logger.warning(f"LinkedIn dedup check failed for user {user_id}: {exc}")
            return DuplicateCheckResult(
                is_duplicate=False,
                content_hash=candidate_hash,
                reason=f"dedup_check_skipped: {exc}",
            )

    def record_publish_hash(
        self,
        db: Session,
        asset_id: int,
        user_id: str,
        account_id: str,
        publish_hash: str,
        post_urn: Optional[str] = None,
    ) -> bool:
        """Persist content hash after successful publish (future batch)."""
        try:
            service = ContentAssetService(db)
            asset = service.get_asset_by_id(asset_id, user_id)
            if not asset:
                return False
            metadata = dict(asset.asset_metadata or {})
            metadata["linkedin_content_hash"] = publish_hash
            metadata["linkedin_publish_account_id"] = account_id
            if post_urn:
                metadata["linkedin_post_urn"] = post_urn
            metadata["linkedin_published_at"] = datetime.utcnow().isoformat()
            service.update_asset(asset_id, user_id, asset_metadata=metadata)
            return True
        except Exception as exc:
            logger.error(f"Failed to record LinkedIn publish hash: {exc}")
            return False
