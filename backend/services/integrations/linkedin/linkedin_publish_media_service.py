"""
Resolve and validate LinkedIn publish media before Unipile posting.

Handles AI-generated image IDs (LinkedInImageStorage) and multipart upload bytes.
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from loguru import logger

from services.integrations.linkedin.exceptions import LinkedInMediaValidationError
from services.integrations.linkedin.media_validator import (
    LinkedInMediaValidator,
    infer_media_type,
)
from services.linkedin.image_generation.linkedin_image_storage import LinkedInImageStorage

MAX_IMAGES_PER_POST = 1
_ALLOWED_UPLOAD_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
_FILENAME_UNSAFE = re.compile(r"[^a-zA-Z0-9._-]")
_IMAGE_ID_PATTERN = re.compile(r"^[a-f0-9]{16}$")


@dataclass
class PublishMediaResolution:
    """Resolved filesystem paths ready for preflight and Unipile upload."""

    media_paths: list[str] = field(default_factory=list)
    temp_paths_to_cleanup: list[str] = field(default_factory=list)
    has_media: bool = False


class LinkedInPublishMediaService:
    """Resolve publish media from stored image IDs or raw upload bytes."""

    def __init__(
        self,
        storage: Optional[LinkedInImageStorage] = None,
        media_validator: Optional[LinkedInMediaValidator] = None,
        upload_base: Optional[Path] = None,
    ) -> None:
        self._storage = storage or LinkedInImageStorage()
        self._validator = media_validator or LinkedInMediaValidator()
        root = Path(__file__).resolve().parents[3]
        self._upload_base = upload_base or (root / "data" / "media" / "linkedin_publish_uploads")

    async def resolve_for_publish(
        self,
        user_id: str,
        *,
        image_ids: Optional[list[str]] = None,
        upload_bytes: Optional[bytes] = None,
        upload_filename: Optional[str] = None,
    ) -> PublishMediaResolution:
        """Resolve media paths and validate before publish."""
        ids = [item.strip() for item in (image_ids or []) if item and item.strip()]

        if len(ids) > MAX_IMAGES_PER_POST:
            raise ValueError(f"Maximum {MAX_IMAGES_PER_POST} image allowed per post")

        if upload_bytes and ids:
            raise ValueError("Provide either image_ids or an uploaded file, not both")

        resolution = PublishMediaResolution()

        if ids:
            for image_id in ids:
                path = await self._resolve_ai_image_path(user_id, image_id)
                resolution.media_paths.append(path)
        elif upload_bytes:
            path = self.persist_uploaded_image(
                user_id,
                upload_bytes,
                upload_filename or "upload.png",
            )
            resolution.temp_paths_to_cleanup.append(path)
            resolution.media_paths.append(path)

        for media_path in resolution.media_paths:
            self._validate_media_path(media_path)

        resolution.has_media = bool(resolution.media_paths)
        logger.info(
            "[LinkedInPublishMedia] resolved user_id={} paths={} temp_cleanup={}",
            user_id,
            len(resolution.media_paths),
            len(resolution.temp_paths_to_cleanup),
        )
        return resolution

    async def _resolve_ai_image_path(self, user_id: str, image_id: str) -> str:
        if not _IMAGE_ID_PATTERN.match(image_id):
            raise ValueError(f"Invalid image ID format: {image_id}")

        stored = await self._storage.retrieve_image(image_id, user_id)
        if not stored.get("success"):
            error = stored.get("error", f"Image not found: {image_id}")
            raise ValueError(str(error))

        image_path = stored.get("image_path")
        if not image_path:
            raise ValueError(f"Image path missing for ID: {image_id}")

        path = Path(str(image_path))
        if not path.exists():
            raise ValueError(f"Image file not found for ID: {image_id}")

        logger.info(
            "[LinkedInPublishMedia] resolved AI image user_id={} image_id={} path={}",
            user_id,
            image_id,
            path.name,
        )
        return str(path)

    def persist_uploaded_image(
        self,
        user_id: str,
        file_bytes: bytes,
        filename: str,
    ) -> str:
        """Persist multipart upload bytes to a temp publish folder."""
        if not file_bytes:
            raise ValueError("Uploaded file is empty")

        safe_name = self._safe_upload_filename(filename)
        user_dir = self._upload_base / self._safe_user_segment(user_id)
        user_dir.mkdir(parents=True, exist_ok=True)

        dest = user_dir / safe_name
        dest.write_bytes(file_bytes)

        logger.info(
            "[LinkedInPublishMedia] persisted upload user_id={} filename={} bytes={}",
            user_id,
            safe_name,
            len(file_bytes),
        )
        return str(dest)

    def cleanup(self, resolution: PublishMediaResolution) -> None:
        """Remove temp upload files created for this publish attempt."""
        for path_str in resolution.temp_paths_to_cleanup:
            path = Path(path_str)
            try:
                if path.exists():
                    path.unlink()
                    logger.info("[LinkedInPublishMedia] cleaned temp file {}", path.name)
            except Exception as exc:
                logger.warning(
                    "[LinkedInPublishMedia] failed to clean temp file {}: {}",
                    path,
                    exc,
                )

    def _validate_media_path(self, file_path: str) -> None:
        media_type = infer_media_type(file_path)
        result = self._validator.validate_for_publish(file_path, media_type)
        if not result.valid:
            raise LinkedInMediaValidationError(result.errors, file_path=file_path)

    @staticmethod
    def _safe_user_segment(user_id: str) -> str:
        cleaned = _FILENAME_UNSAFE.sub("_", user_id.strip())
        return cleaned or "anonymous"

    @staticmethod
    def _safe_upload_filename(filename: str) -> str:
        base = Path(filename).name
        ext = Path(base).suffix.lower()
        if ext not in _ALLOWED_UPLOAD_EXTENSIONS:
            ext = ".png"
        stem = _FILENAME_UNSAFE.sub("_", Path(base).stem)[:80] or "upload"
        return f"{stem}_{uuid.uuid4().hex[:12]}{ext}"
