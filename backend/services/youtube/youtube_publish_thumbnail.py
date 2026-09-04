"""YouTube custom thumbnail validation, save, and path resolve."""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any, Dict, Literal, Optional

from loguru import logger

from api.youtube.paths import YOUTUBE_IMAGES_DIR, ensure_youtube_media_dirs

YouTubeThumbnailDuration = Literal["shorts", "medium", "long"]
YouTubeThumbnailAspect = Literal["16:9", "9:16"]

YOUTUBE_THUMBNAIL_MAX_BYTES = 2 * 1024 * 1024
YOUTUBE_THUMBNAIL_MIMES = ("image/jpeg", "image/png")
YOUTUBE_THUMBNAIL_LANDSCAPE = {"ratio": "16:9", "width": 1280, "height": 720}
YOUTUBE_THUMBNAIL_SHORTS = {"ratio": "9:16", "width": 1080, "height": 1920}
YOUTUBE_THUMBNAIL_DURATIONS = ("shorts", "medium", "long")

_RATIO_TOLERANCE = 0.03
_THUMB_SUBDIR = "thumbnails"


def normalize_youtube_thumbnail_mime(
    content_type: Optional[str],
    filename: str = "",
) -> str:
    """Map browser/OS types to the two YouTube-accepted image MIME types."""
    raw = (content_type or "").split(";")[0].strip().lower()
    if raw in ("image/jpg", "image/jpeg"):
        return "image/jpeg"
    if raw == "image/png":
        return "image/png"
    suffix = Path(filename).suffix.lower()
    if suffix in (".jpg", ".jpeg"):
        return "image/jpeg"
    if suffix == ".png":
        return "image/png"
    return raw


def youtube_publish_duration_type(duration_type: Optional[str]) -> str:
    if duration_type in YOUTUBE_THUMBNAIL_DURATIONS:
        return duration_type
    return "medium"


def youtube_thumbnail_aspect_for_duration(
    duration_type: str,
) -> YouTubeThumbnailAspect:
    """Map Creator duration_type to the thumbnail ratio we accept."""
    return "9:16" if duration_type == "shorts" else "16:9"


def youtube_thumbnail_ratio_matches(
    width: int,
    height: int,
    aspect: YouTubeThumbnailAspect,
) -> bool:
    if width <= 0 or height <= 0:
        return False
    expected = 16 / 9 if aspect == "16:9" else 9 / 16
    actual = width / height
    return abs(actual - expected) / expected <= _RATIO_TOLERANCE


def validate_youtube_publish_thumbnail(
    *,
    mime_type: str,
    size_bytes: int,
    width: int,
    height: int,
    duration_type: str,
) -> Dict[str, Any]:
    """Return {ok: True} or {ok: False, error: user-facing copy}."""
    if mime_type not in YOUTUBE_THUMBNAIL_MIMES:
        return {"ok": False, "error": "Please use a JPEG or PNG picture."}
    if size_bytes > YOUTUBE_THUMBNAIL_MAX_BYTES:
        return {"ok": False, "error": "That picture is too large. Keep it under 2 MB."}
    aspect = youtube_thumbnail_aspect_for_duration(duration_type)
    if not youtube_thumbnail_ratio_matches(width, height, aspect):
        error = (
            "Shorts need a tall picture (9:16), like 1080 × 1920."
            if aspect == "9:16"
            else "This video needs a wide picture (16:9), like 1280 × 720."
        )
        return {"ok": False, "error": error}
    return {"ok": True}


def youtube_thumbnail_mimetype_from_path(thumbnail_path: str) -> str:
    suffix = Path(thumbnail_path).suffix.lower()
    if suffix == ".png":
        return "image/png"
    return "image/jpeg"


def youtube_publish_thumbnail_dir() -> Path:
    return (YOUTUBE_IMAGES_DIR / _THUMB_SUBDIR).resolve()


def resolve_youtube_thumbnail_file(thumbnail_path: Optional[str]) -> Optional[Path]:
    """Return a saved cover file, or None if missing or outside the thumbnails folder."""
    if not thumbnail_path or not str(thumbnail_path).strip():
        return None
    thumbs = youtube_publish_thumbnail_dir()
    raw = Path(thumbnail_path.strip())
    candidate = thumbs / raw.name if not raw.is_absolute() else raw
    try:
        resolved = candidate.resolve()
    except OSError as resolve_error:
        logger.warning(
            "[youtube_publish_thumbnail] Path resolve failed error_type={}",
            type(resolve_error).__name__,
        )
        return None
    if resolved.parent != thumbs:
        logger.warning("[youtube_publish_thumbnail] Rejected path outside thumbnails dir")
        return None
    if not resolved.name.startswith("yt_publish_thumb_"):
        logger.warning("[youtube_publish_thumbnail] Rejected unexpected thumbnail filename")
        return None
    if resolved.is_file():
        return resolved
    logger.warning(
        "[youtube_publish_thumbnail] File missing path_length={}",
        len(str(thumbnail_path)),
    )
    return None


def save_youtube_publish_thumbnail(
    image_bytes: bytes,
    mime_type: str,
    user_id: str,
) -> str:
    """Write the uploaded thumbnail under YouTube media and return the disk path."""
    if mime_type not in YOUTUBE_THUMBNAIL_MIMES:
        raise ValueError("Please use a JPEG or PNG picture.")
    if len(image_bytes) > YOUTUBE_THUMBNAIL_MAX_BYTES:
        raise ValueError("That picture is too large. Keep it under 2 MB.")
    ensure_youtube_media_dirs(user_id)
    folder = YOUTUBE_IMAGES_DIR / _THUMB_SUBDIR
    folder.mkdir(parents=True, exist_ok=True)
    ext = ".png" if mime_type == "image/png" else ".jpg"
    dest = folder / f"yt_publish_thumb_{uuid.uuid4().hex}{ext}"
    try:
        dest.write_bytes(image_bytes)
    except OSError as write_error:
        logger.error(
            "[youtube_publish_thumbnail] Save failed user_id={} error_type={}",
            user_id,
            type(write_error).__name__,
        )
        raise ValueError("We could not save that picture. Try again.") from None
    logger.info(
        "[youtube_publish_thumbnail] Saved user_id={} size_bytes={} mime={}",
        user_id,
        len(image_bytes),
        mime_type,
    )
    return str(dest.resolve())


def youtube_thumbnail_image_size(image_bytes: bytes) -> tuple[int, int]:
    """Read pixel size. Raises ValueError with user-facing copy if unreadable."""
    try:
        from io import BytesIO

        from PIL import Image

        with Image.open(BytesIO(image_bytes)) as image:
            image.load()
            width, height = image.size
    except ValueError:
        raise
    except Exception as read_error:
        logger.warning(
            "[youtube_publish_thumbnail] Could not read image bytes error_type={}",
            type(read_error).__name__,
        )
        raise ValueError("We could not open that picture. Try a JPEG or PNG.") from None
    if width <= 0 or height <= 0:
        raise ValueError("We could not open that picture. Try a JPEG or PNG.")
    return width, height


def process_youtube_publish_thumbnail_upload(
    *,
    image_bytes: bytes,
    content_type: Optional[str],
    filename: str,
    duration_type: str,
    user_id: str,
) -> str:
    """Validate MIME, size, and ratio, then save. Raises ValueError for the client."""
    if duration_type not in YOUTUBE_THUMBNAIL_DURATIONS:
        raise ValueError("This video length is not supported for a cover picture.")
    if not image_bytes:
        raise ValueError("Please choose a JPEG or PNG picture.")
    mime_type = normalize_youtube_thumbnail_mime(content_type, filename)
    width, height = youtube_thumbnail_image_size(image_bytes)
    checked = validate_youtube_publish_thumbnail(
        mime_type=mime_type,
        size_bytes=len(image_bytes),
        width=width,
        height=height,
        duration_type=duration_type,
    )
    if not checked.get("ok"):
        raise ValueError(checked.get("error") or "That picture cannot be used as a cover.")
    return save_youtube_publish_thumbnail(image_bytes, mime_type, user_id)
