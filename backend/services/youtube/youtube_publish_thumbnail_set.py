"""Wait for YouTube processing, then POST the cover as thumbnails.set media."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Callable, Dict, Optional
from urllib.parse import urlencode

from loguru import logger

from services.youtube.youtube_publish_log import youtube_publish_error_status
from services.youtube.youtube_publish_thumbnail import youtube_thumbnail_mimetype_from_path

_THUMBNAIL_SET_RETRY_DELAYS_SEC = (0, 3, 6, 10)
_PROCESSING_POLL_DELAYS_SEC = (0, 5, 10, 20, 30, 45, 60)
_YOUTUBE_THUMBNAILS_SET_UPLOAD = "https://www.googleapis.com/upload/youtube/v3/thumbnails/set"


class YouTubeThumbnailHttpError(Exception):
    """HTTP error from a raw thumbnails.set media POST."""

    def __init__(self, http_status: int, content: bytes = b""):
        super().__init__(f"thumbnail_http_{http_status}")
        self.resp = type("Resp", (), {"status": http_status})()
        self.content = content


def youtube_thumbnails_set_upload_url(video_id: str) -> str:
    """Documented media upload URL. videoId is an opaque YouTube id, not a secret."""
    return f"{_YOUTUBE_THUMBNAILS_SET_UPLOAD}?{urlencode({'videoId': video_id, 'uploadType': 'media'})}"


def youtube_api_error_fields(exc: BaseException) -> Dict[str, Any]:
    """Best-effort HTTP status and YouTube reason from a Google API error."""
    status = youtube_publish_error_status(exc)
    reason = None
    content = getattr(exc, "content", None)
    if content:
        try:
            raw = content.decode() if isinstance(content, bytes) else str(content)
            payload = json.loads(raw)
            errors = (payload.get("error") or {}).get("errors") or []
            if errors:
                reason = errors[0].get("reason")
        except Exception as parse_error:
            logger.debug(
                "[youtube_publish_thumbnail] Could not parse API error body error_type={}",
                type(parse_error).__name__,
            )
    return {"http_status": status, "reason": reason}


def youtube_thumbnail_set_is_retryable(exc: BaseException) -> bool:
    """Retry when YouTube is not ready yet or the call is transient."""
    fields = youtube_api_error_fields(exc)
    status = fields["http_status"]
    reason = fields["reason"]
    if status in (404, 429, 500, 503):
        return True
    if status == 400 and reason in ("mediaBodyRequired", "backendError"):
        return True
    return False


def youtube_thumbnail_set_was_applied(response: Any) -> bool:
    """True when the media POST returns thumbnailSetResponse. Item URLs are not custom-thumb proof."""
    return (
        isinstance(response, dict)
        and response.get("kind") == "youtube#thumbnailSetResponse"
    )


def youtube_video_processing_is_ready(response: Any) -> bool:
    """True only when videos.list processingDetails.processingStatus is succeeded."""
    if not isinstance(response, dict):
        return False
    items = response.get("items")
    if not isinstance(items, list) or not items:
        return False
    first = items[0]
    if not isinstance(first, dict):
        return False
    details = first.get("processingDetails") or {}
    if isinstance(details, dict) and details.get("processingStatus") == "succeeded":
        return True
    return False


def _emit_thumbnail_progress(
    on_progress: Optional[Callable[[str], None]],
    message: str,
) -> None:
    if not on_progress:
        return
    try:
        on_progress(message)
    except Exception as exc:
        logger.warning(
            "[youtube_publish_thumbnail] Progress callback failed error_type={}",
            type(exc).__name__,
        )


def wait_for_youtube_video_processed(
    youtube: Any,
    video_id: str,
    sleeper: Optional[Callable[[float], None]] = None,
    on_progress: Optional[Callable[[str], None]] = None,
) -> bool:
    """Poll videos.list until processing succeeds. Custom thumbs are overwritten if set too early."""
    _emit_thumbnail_progress(
        on_progress, "Waiting for YouTube to finish preparing the video..."
    )
    sleep = sleeper or time.sleep
    for attempt, delay in enumerate(_PROCESSING_POLL_DELAYS_SEC):
        if delay:
            sleep(delay)
        try:
            response = youtube.videos().list(
                part="status,processingDetails",
                id=video_id,
            ).execute()
        except Exception as exc:
            fields = youtube_api_error_fields(exc)
            logger.warning(
                "[youtube_publish_thumbnail] Processing poll failed attempt={}/{} "
                "error_type={} http_status={}",
                attempt + 1,
                len(_PROCESSING_POLL_DELAYS_SEC),
                type(exc).__name__,
                fields["http_status"],
            )
            continue
        if youtube_video_processing_is_ready(response):
            logger.info(
                "[youtube_publish_thumbnail] Video processed attempt={} video_id_present={}",
                attempt + 1,
                bool(video_id),
            )
            return True
        details = {}
        items = response.get("items") if isinstance(response, dict) else None
        if isinstance(items, list) and items and isinstance(items[0], dict):
            details = items[0].get("processingDetails") or {}
        status = details.get("processingStatus") if isinstance(details, dict) else None
        logger.info(
            "[youtube_publish_thumbnail] Video not processed yet attempt={}/{} processing_status={}",
            attempt + 1,
            len(_PROCESSING_POLL_DELAYS_SEC),
            status,
        )
    logger.warning(
        "[youtube_publish_thumbnail] Processing wait timed out video_id_present={}",
        bool(video_id),
    )
    return False


def user_safe_thumbnail_set_error(
    exc: BaseException,
    *,
    duration_type: str = "medium",
) -> str:
    """Cover-picture set failed after the video uploaded. Never leak API text."""
    fields = youtube_api_error_fields(exc)
    status = fields["http_status"]
    reason = fields["reason"]
    if status == 403 or reason == "forbidden":
        return (
            "Your video published, but YouTube would not accept the cover picture. "
            "Verify your channel with a phone number in YouTube Studio, then add "
            "the picture there."
        )
    if status == 404 or reason == "videoNotFound":
        return (
            "Your video published, but the cover picture could not be applied yet. "
            "Open YouTube Studio and upload it from the video details page."
        )
    if reason == "invalidImage":
        return (
            "Your video published, but YouTube rejected that picture. "
            "Try a clear JPEG or PNG at the recommended size and upload it in "
            "YouTube Studio."
        )
    if status == 429 or reason == "uploadRateLimitExceeded":
        return (
            "Your video published, but YouTube is limiting cover picture uploads. "
            "Add the picture from YouTube Studio in a few minutes."
        )
    if duration_type == "shorts":
        return (
            "Your video published, but the cover picture could not be applied. "
            "On Shorts it may not show in the Shorts feed — only on your channel "
            "and when the link is shared. Add it in YouTube Studio if needed."
        )
    return (
        "Your video published, but YouTube could not apply the cover picture. "
        "Add it from YouTube Studio."
    )


def _http_response_status(resp: Any) -> int:
    if resp is None:
        return 0
    status = getattr(resp, "status", None)
    if status is None and isinstance(resp, dict):
        status = resp.get("status")
    try:
        return int(status)
    except (TypeError, ValueError):
        return 0


def execute_youtube_thumbnails_set_media(
    youtube: Any,
    video_id: str,
    thumbnail_path: Path,
) -> Dict[str, Any]:
    """POST raw JPEG/PNG bytes. Discovery thumbnails.set can 200 without applying the file."""
    image_bytes = Path(thumbnail_path).read_bytes()
    mime = youtube_thumbnail_mimetype_from_path(str(thumbnail_path))
    http = getattr(youtube, "_http", None)
    if http is None or not hasattr(http, "request"):
        raise YouTubeThumbnailHttpError(500, b'{"error":{"errors":[{"reason":"backendError"}]}}')
    logger.info(
        "[youtube_publish_thumbnail] Media POST start video_id_present={} size_bytes={} mime={}",
        bool(video_id),
        len(image_bytes),
        mime,
    )
    try:
        resp, content = http.request(
            youtube_thumbnails_set_upload_url(video_id),
            method="POST",
            body=image_bytes,
            headers={"Content-Type": mime},
        )
    except Exception as request_error:
        fields = youtube_api_error_fields(request_error)
        logger.warning(
            "[youtube_publish_thumbnail] Media POST raised error_type={} http_status={}",
            type(request_error).__name__,
            fields["http_status"],
        )
        raise
    status = _http_response_status(resp)
    if isinstance(content, str):
        content_bytes = content.encode()
    elif isinstance(content, bytes):
        content_bytes = content
    else:
        content_bytes = b""
    if status != 200:
        logger.warning(
            "[youtube_publish_thumbnail] Media POST failed http_status={} body_bytes={}",
            status,
            len(content_bytes),
        )
        raise YouTubeThumbnailHttpError(status, content_bytes or b"{}")
    try:
        payload = json.loads(content_bytes.decode() or "{}")
    except Exception as parse_error:
        logger.warning(
            "[youtube_publish_thumbnail] Media POST body was not JSON error_type={}",
            type(parse_error).__name__,
        )
        payload = {}
    if not isinstance(payload, dict):
        payload = {}
    logger.info(
        "[youtube_publish_thumbnail] Media POST ok kind={} video_id_present={}",
        payload.get("kind"),
        bool(video_id),
    )
    return payload


def apply_youtube_publish_thumbnail(
    youtube: Any,
    *,
    video_id: str,
    thumbnail_path: Path,
    duration_type: str = "medium",
    sleeper: Optional[Callable[[float], None]] = None,
    on_progress: Optional[Callable[[str], None]] = None,
) -> Dict[str, Any]:
    """Wait until processing succeeds, then POST the image as uploadType=media."""
    sleep = sleeper or time.sleep
    processed = wait_for_youtube_video_processed(
        youtube, video_id, sleeper=sleep, on_progress=on_progress
    )
    if not processed:
        logger.warning(
            "[youtube_publish_thumbnail] Setting cover after processing wait timeout "
            "video_id_present={}",
            bool(video_id),
        )
    _emit_thumbnail_progress(on_progress, "Adding your cover picture...")
    last_exc: Optional[BaseException] = None
    for attempt, delay in enumerate(_THUMBNAIL_SET_RETRY_DELAYS_SEC):
        if delay:
            sleep(delay)
        try:
            response = execute_youtube_thumbnails_set_media(
                youtube, video_id, thumbnail_path
            )
            if youtube_thumbnail_set_was_applied(response):
                logger.info(
                    "[youtube_publish_thumbnail] Cover applied video_id_present={} "
                    "attempt={} duration_type={}",
                    bool(video_id),
                    attempt + 1,
                    duration_type,
                )
                return {"applied": True, "error": None}
            last_exc = RuntimeError("thumbnail_set_missing_kind")
            logger.warning(
                "[youtube_publish_thumbnail] Media POST missing kind attempt={}/{}",
                attempt + 1,
                len(_THUMBNAIL_SET_RETRY_DELAYS_SEC),
            )
            if attempt < len(_THUMBNAIL_SET_RETRY_DELAYS_SEC) - 1:
                continue
            break
        except Exception as exc:
            last_exc = exc
            fields = youtube_api_error_fields(exc)
            logger.warning(
                "[youtube_publish_thumbnail] Media POST attempt failed attempt={}/{} "
                "error_type={} http_status={} reason={}",
                attempt + 1,
                len(_THUMBNAIL_SET_RETRY_DELAYS_SEC),
                type(exc).__name__,
                fields["http_status"],
                fields["reason"],
            )
            if attempt < len(_THUMBNAIL_SET_RETRY_DELAYS_SEC) - 1 and youtube_thumbnail_set_is_retryable(exc):
                continue
            break
    return {
        "applied": False,
        "error": user_safe_thumbnail_set_error(
            last_exc or RuntimeError("thumbnail_set_failed"),
            duration_type=duration_type,
        ),
    }
