"""Fetch snippet titles for comment inbox video ids (YouTube Data API videos.list).

https://developers.google.com/youtube/v3/docs/videos/list

Never invents titles. Title lookup failures leave comments intact with a short id.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from loguru import logger

from services.youtube.youtube_comments_insert_errors import youtube_comment_http_error_reason
from services.youtube.youtube_publish_log import youtube_publish_error_log_fields

YOUTUBE_VIDEOS_LIST_MAX_IDS = 50
YOUTUBE_VIDEOS_LIST_QUOTA_COST = 1
YOUTUBE_COMMENT_VIDEO_ID_SHORT_LEN = 8


def short_youtube_video_id(video_id: Optional[str]) -> str:
    """First eight characters of a video id, or empty when missing."""
    raw = (video_id or "").strip()
    if not raw:
        return ""
    return raw[:YOUTUBE_COMMENT_VIDEO_ID_SHORT_LEN]


def _title_or_short_id(video_id: str, titles: Dict[str, str]) -> str:
    title = (titles.get(video_id) or "").strip()
    if title:
        return title
    return short_youtube_video_id(video_id)


def attach_youtube_comment_video_titles(
    youtube: Any,
    comments: List[Dict[str, Any]],
    *,
    user_id: str,
) -> None:
    """Mutate comments in place: set video_title from videos.list or a short id."""
    unique_ids: List[str] = []
    seen = set()
    for comment in comments:
        video_id = (comment.get("video_id") or "").strip()
        if not video_id or video_id in seen:
            continue
        seen.add(video_id)
        unique_ids.append(video_id)

    logger.info(
        "[youtube_comments] Video titles start user_id={} unique_video_id_count={}",
        user_id,
        len(unique_ids),
    )
    if not unique_ids:
        for comment in comments:
            comment["video_title"] = None
        return

    titles: Dict[str, str] = {}
    list_calls = 0
    try:
        for offset in range(0, len(unique_ids), YOUTUBE_VIDEOS_LIST_MAX_IDS):
            chunk = unique_ids[offset : offset + YOUTUBE_VIDEOS_LIST_MAX_IDS]
            list_calls += 1
            logger.info(
                "[youtube_comments] videos.list start user_id={} id_count={} "
                "quota_cost={} call_index={}",
                user_id,
                len(chunk),
                YOUTUBE_VIDEOS_LIST_QUOTA_COST,
                list_calls,
            )
            response = youtube.videos().list(
                part="snippet",
                id=",".join(chunk),
            ).execute()
            items = response.get("items") if isinstance(response, dict) else None
            if not isinstance(items, list):
                items = []
            for item in items:
                if not isinstance(item, dict):
                    continue
                video_id = (item.get("id") or "").strip()
                snippet = item.get("snippet") if isinstance(item.get("snippet"), dict) else {}
                snippet_title = (snippet.get("title") or "").strip()
                if video_id and snippet_title:
                    titles[video_id] = snippet_title
            logger.info(
                "[youtube_comments] videos.list complete user_id={} returned_count={}",
                user_id,
                len(items),
            )
    except Exception as exc:
        fields = youtube_publish_error_log_fields(exc)
        status, youtube_reason = youtube_comment_http_error_reason(exc)
        logger.error(
            "[youtube_comments] videos.list failed user_id={} error_type={} "
            "http_status={} youtube_reason={} list_calls={}",
            user_id,
            fields["error_type"],
            status if status is not None else fields["http_status"],
            youtube_reason,
            list_calls,
        )

    for comment in comments:
        video_id = (comment.get("video_id") or "").strip()
        if not video_id:
            comment["video_title"] = None
            continue
        comment["video_title"] = _title_or_short_id(video_id, titles)

    logger.info(
        "[youtube_comments] Video titles complete user_id={} unique_video_id_count={} "
        "list_calls={}",
        user_id,
        len(unique_ids),
        list_calls,
    )
