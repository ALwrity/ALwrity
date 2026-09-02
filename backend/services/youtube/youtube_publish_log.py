"""Safe metadata and user-facing errors for YouTube publish.

Never log title, full URL, query strings, tokens, or temp file paths.
"""

from __future__ import annotations

from typing import Any, Mapping


def youtube_publish_source_meta(video_source: str | None) -> dict[str, Any]:
    """Return source kind and length only."""
    if not video_source:
        return {"source_kind": "empty", "source_length": 0}
    if video_source.startswith("/api/youtube/videos/"):
        return {
            "source_kind": "youtube_api_path",
            "source_length": len(video_source),
        }
    if video_source.startswith(("http://", "https://")):
        return {"source_kind": "http", "source_length": len(video_source)}
    if video_source.startswith("ftp://"):
        return {"source_kind": "ftp", "source_length": len(video_source)}
    return {"source_kind": "local_or_other", "source_length": len(video_source)}


def youtube_publish_error_status(exc: BaseException) -> int | None:
    """Best-effort HTTP status from a Google API client error."""
    resp = getattr(exc, "resp", None)
    if resp is None:
        return None
    status = getattr(resp, "status", None)
    try:
        return int(status) if status is not None else None
    except (TypeError, ValueError):
        return None


def user_safe_publish_error(exc: BaseException) -> str:
    """Map upload exceptions to a message safe to show the user."""
    status = youtube_publish_error_status(exc)
    if status in (401,):
        return "YouTube auth failed. Please reconnect your YouTube channel."
    if status in (403,):
        return "YouTube rejected the upload. Check channel permissions and try again."
    if status in (400,):
        return "YouTube could not accept this upload. Check title, schedule time, and try again."
    if status in (429, 500, 503):
        return "YouTube is busy. Please try again in a few minutes."
    return "Upload failed after retries."


def youtube_publish_error_log_fields(exc: BaseException) -> Mapping[str, Any]:
    """Fields safe to put in server logs (no URL, no Google body)."""
    return {
        "error_type": type(exc).__name__,
        "http_status": youtube_publish_error_status(exc),
    }
