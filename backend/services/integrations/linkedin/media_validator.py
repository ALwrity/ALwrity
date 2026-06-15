"""
LinkedIn media pre-publish validation (H5).

Validates images, videos, and documents against LinkedIn/Zernio specs
before calling the publish API.
"""

from __future__ import annotations

import os
from io import BytesIO
from pathlib import Path
from typing import Optional

from PIL import Image

from services.integrations.linkedin.types import MediaValidationResult

# LinkedIn / issue #675 limits
MAX_IMAGE_BYTES = 8 * 1024 * 1024  # 8MB
MAX_VIDEO_BYTES = 5 * 1024 * 1024 * 1024  # 5GB
MAX_DOCUMENT_BYTES = 100 * 1024 * 1024  # 100MB
MAX_DOCUMENT_PAGES = 300

MIN_IMAGE_WIDTH = 552
MIN_IMAGE_HEIGHT = 276
SUPPORTED_IMAGE_FORMATS = {"PNG", "JPEG", "JPG", "GIF", "WEBP"}
SUPPORTED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi"}
SUPPORTED_DOCUMENT_EXTENSIONS = {".pdf"}

SUITABLE_ASPECT_RATIOS = [
    (0.9, 1.1),
    (1.6, 1.8),
    (0.7, 0.8),
    (1.2, 1.4),
    (1.85, 2.0),
    (0.6, 0.72),
    (0.65, 0.85),
]


def _is_aspect_ratio_suitable(width: int, height: int) -> bool:
    if height == 0:
        return False
    ratio = width / height
    return any(lo <= ratio <= hi for lo, hi in SUITABLE_ASPECT_RATIOS)


def validate_image_bytes(image_data: bytes) -> dict[str, object]:
    """Sync image validation (extracted from LinkedInImageGenerator thresholds)."""
    try:
        image = Image.open(BytesIO(image_data))
        width, height = image.size
        fmt = (image.format or "").upper()
        if fmt == "JPG":
            fmt = "JPEG"
        return {
            "resolution_ok": width >= MIN_IMAGE_WIDTH and height >= MIN_IMAGE_HEIGHT,
            "aspect_ratio_suitable": _is_aspect_ratio_suitable(width, height),
            "file_size_ok": len(image_data) <= MAX_IMAGE_BYTES,
            "format_supported": fmt in SUPPORTED_IMAGE_FORMATS,
            "width": width,
            "height": height,
            "format": fmt,
        }
    except Exception as exc:
        return {
            "resolution_ok": False,
            "aspect_ratio_suitable": False,
            "file_size_ok": False,
            "format_supported": False,
            "error": str(exc),
        }


def infer_media_type(file_path: str) -> str:
    ext = Path(file_path).suffix.lower()
    if ext in {".png", ".jpg", ".jpeg", ".gif", ".webp"}:
        return "image"
    if ext in SUPPORTED_VIDEO_EXTENSIONS:
        return "video"
    if ext in SUPPORTED_DOCUMENT_EXTENSIONS:
        return "document"
    return "unknown"


class LinkedInMediaValidator:
    """Pre-flight media validator for LinkedIn publishing."""

    def validate_for_publish(
        self, file_path: str, media_type: Optional[str] = None
    ) -> MediaValidationResult:
        resolved_type = media_type or infer_media_type(file_path)
        path = Path(file_path)

        if not path.exists():
            return MediaValidationResult(valid=False, errors=[f"File not found: {file_path}"])

        if resolved_type == "image":
            return self._validate_image(path)
        if resolved_type == "video":
            return self._validate_video(path)
        if resolved_type == "document":
            return self._validate_document(path)

        return MediaValidationResult(
            valid=False,
            errors=[f"Unsupported media type for path: {file_path}"],
        )

    def _validate_image(self, path: Path) -> MediaValidationResult:
        errors: list[str] = []
        warnings: list[str] = []

        size = path.stat().st_size
        if size > MAX_IMAGE_BYTES:
            errors.append(
                f"Image exceeds 8MB limit ({size / (1024 * 1024):.1f}MB)"
            )

        with open(path, "rb") as f:
            data = f.read()

        results = validate_image_bytes(data)
        if results.get("error"):
            errors.append(f"Invalid image file: {results['error']}")
        if not results.get("format_supported"):
            errors.append(
                f"Unsupported image format: {results.get('format', 'unknown')}. "
                f"Use PNG, JPEG, GIF, or WebP."
            )
        if not results.get("resolution_ok"):
            errors.append(
                f"Image resolution too small ({results.get('width')}x{results.get('height')}). "
                f"Minimum {MIN_IMAGE_WIDTH}x{MIN_IMAGE_HEIGHT}."
            )
        if not results.get("aspect_ratio_suitable"):
            warnings.append("Image aspect ratio may not be optimal for LinkedIn.")

        return MediaValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
        )

    def _validate_video(self, path: Path) -> MediaValidationResult:
        errors: list[str] = []
        ext = path.suffix.lower()
        if ext not in SUPPORTED_VIDEO_EXTENSIONS:
            errors.append(
                f"Unsupported video format '{ext}'. Use MP4, MOV, or AVI."
            )
        size = path.stat().st_size
        if size > MAX_VIDEO_BYTES:
            errors.append(
                f"Video exceeds 5GB limit ({size / (1024 ** 3):.2f}GB)"
            )
        return MediaValidationResult(valid=len(errors) == 0, errors=errors)

    def _validate_document(self, path: Path) -> MediaValidationResult:
        errors: list[str] = []
        warnings: list[str] = []
        ext = path.suffix.lower()
        if ext not in SUPPORTED_DOCUMENT_EXTENSIONS:
            errors.append("Documents must be PDF format.")
        size = path.stat().st_size
        if size > MAX_DOCUMENT_BYTES:
            errors.append(
                f"Document exceeds 100MB limit ({size / (1024 * 1024):.1f}MB)"
            )

        page_count = self._pdf_page_count(path)
        if page_count is None:
            warnings.append(
                "Could not verify PDF page count (install pypdf for full validation)."
            )
        elif page_count > MAX_DOCUMENT_PAGES:
            errors.append(
                f"PDF has {page_count} pages; maximum is {MAX_DOCUMENT_PAGES}."
            )

        return MediaValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
        )

    def _pdf_page_count(self, path: Path) -> Optional[int]:
        try:
            from pypdf import PdfReader  # type: ignore[import-untyped]

            return len(PdfReader(str(path)).pages)
        except ImportError:
            return None
        except Exception:
            return None
