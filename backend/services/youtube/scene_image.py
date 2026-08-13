"""
YouTube scene image helpers for video rendering.

Resolves scene image bytes as base64 from local storage or the asset library.
"""

from __future__ import annotations

import base64
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from models.content_asset_models import AssetSource, AssetType
from services.youtube.image_storage import find_youtube_image_file
from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.scene_image")


def resolve_scene_image_base64(
    scene_image_url: Optional[str],
    user_id: str,
    db: Optional[Session] = None,
) -> Optional[str]:
    """
    Return base64-encoded scene image for image-to-video, or None when unavailable.
    """
    if not scene_image_url or not str(scene_image_url).strip():
        logger.debug("[YouTubeSceneImage] No scene image URL provided; skipping I2V input")
        return None

    parsed_url = urlparse(scene_image_url)
    image_filename = Path(parsed_url.path).name
    if not image_filename:
        logger.warning(
            f"[YouTubeSceneImage] Could not extract filename from URL: {scene_image_url}"
        )
        return None

    logger.info(
        f"[YouTubeSceneImage] Resolving scene image for user {user_id} "
        f"from URL: {scene_image_url} (filename={image_filename})"
    )

    image_path = find_youtube_image_file(image_filename, user_id=user_id, db=db)
    if image_path and image_path.is_file():
        try:
            image_bytes = image_path.read_bytes()
        except OSError as exc:
            logger.error(
                f"[YouTubeSceneImage] Failed to read image file {image_path}: {exc}",
                exc_info=True,
            )
            image_bytes = None

        if image_bytes:
            logger.info(
                f"[YouTubeSceneImage] Loaded scene image from disk: {image_filename} "
                f"({len(image_bytes)} bytes) at {image_path}"
            )
            return base64.b64encode(image_bytes).decode("utf-8")

    logger.warning(
        f"[YouTubeSceneImage] Image not found on disk for {image_filename}. "
        "Attempting asset library fallback."
    )

    try:
        image_bytes = _load_image_from_asset_library(image_filename, user_id)
        if image_bytes:
            logger.info(
                f"[YouTubeSceneImage] Loaded scene image from asset library: {image_filename} "
                f"({len(image_bytes)} bytes)"
            )
            return base64.b64encode(image_bytes).decode("utf-8")
    except Exception as exc:
        logger.warning(
            f"[YouTubeSceneImage] Asset library fallback failed for {image_filename}: {exc}",
            exc_info=True,
        )

    logger.warning(
        f"[YouTubeSceneImage] Scene image unavailable for {image_filename}; "
        "renderer will fall back to text-to-video"
    )
    return None


def _load_image_from_asset_library(filename: str, user_id: str) -> Optional[bytes]:
    """Load a YouTube Creator image asset by filename from the content asset library."""
    from services.content_asset_service import ContentAssetService
    from services.database import get_session_for_user

    logger.debug(
        f"[YouTubeSceneImage] Querying asset library for image {filename!r} "
        f"(user_id={user_id})"
    )

    db = get_session_for_user(user_id)
    if not db:
        logger.warning(
            f"[YouTubeSceneImage] Database session unavailable for user {user_id}"
        )
        return None

    try:
        asset_service = ContentAssetService(db)
        assets, total = asset_service.get_user_assets(
            user_id=user_id,
            asset_type=AssetType.IMAGE,
            source_module=AssetSource.YOUTUBE_CREATOR,
            limit=100,
        )
        logger.debug(
            f"[YouTubeSceneImage] Asset library returned {len(assets)} image asset(s) "
            f"(total={total}) for user {user_id}"
        )

        for asset in assets:
            if asset.filename != filename or not asset.file_path:
                continue

            asset_path = Path(asset.file_path)
            if not asset_path.exists() or not asset_path.is_file():
                logger.warning(
                    f"[YouTubeSceneImage] Asset library path missing for {filename}: "
                    f"{asset_path}"
                )
                return None

            try:
                return asset_path.read_bytes()
            except OSError as exc:
                logger.error(
                    f"[YouTubeSceneImage] Failed to read asset file {asset_path}: {exc}",
                    exc_info=True,
                )
                return None

        logger.warning(
            f"[YouTubeSceneImage] Image asset not found in library: {filename}"
        )
        return None
    except Exception as exc:
        logger.error(
            f"[YouTubeSceneImage] Asset library lookup failed for {filename}: {exc}",
            exc_info=True,
        )
        raise
    finally:
        db.close()
