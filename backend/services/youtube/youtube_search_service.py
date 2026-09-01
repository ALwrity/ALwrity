"""YouTube Data API v3 keyword search (Google searchByKeyword sample).

Mirrors:
https://developers.google.com/youtube/v3/docs/search/list

    YouTube.Search.list('id,snippet', {q: 'dogs', maxResults: 25})
    item.id.videoId, item.snippet.title

HTTP: GET https://www.googleapis.com/youtube/v3/search
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from loguru import logger

from services.youtube.youtube_oauth_service import YouTubeOAuthService
from services.youtube.youtube_search_upload_date import (
    _youtube_search_utc_now,
    published_after_for_upload_date,
)

# Search.list maxResults documented range is 0–50; sample uses 25.
_YOUTUBE_SEARCH_MAX_RESULTS = 50
_DEFAULT_MAX_RESULTS = 25
# Documented Search.list videoDuration values (requires type=video).
_SEARCH_LIST_VIDEO_DURATIONS = frozenset({"short", "medium", "long"})

# Documented Search.list 400 badRequest reasons (YouTube Data API v3).
_SEARCH_LIST_BAD_REQUEST = {
    "invalidChannelId": "The channelId parameter specified an invalid channel ID.",
    "invalidLocation": (
        "The location and/or locationRadius parameter value was formatted incorrectly."
    ),
    "invalidRelevanceLanguage": (
        "The relevanceLanguage parameter value was formatted incorrectly."
    ),
    "invalidSearchFilter": (
        "The request contains an invalid combination of search filters and/or "
        "restrictions. Set the type parameter to video if you set forContentOwner "
        "or forMine to true, or if you set eventType, videoCaption, videoCategoryId, "
        "videoDefinition, videoDimension, videoDuration, videoEmbeddable, "
        "videoLicense, videoSyndicated, or videoType."
    ),
}


def _parse_search_list_http_error(exc: HttpError) -> Tuple[int, Optional[str], str]:
    """Return (http_status, google_reason, api_message) from a Search.list HttpError."""
    status = int(getattr(getattr(exc, "resp", None), "status", 0) or 0)
    raw = getattr(exc, "content", b"") or b""
    text = raw.decode("utf-8", errors="replace") if isinstance(raw, bytes) else str(raw)
    reason: Optional[str] = None
    api_message = str(exc)
    try:
        payload = json.loads(text) if text else {}
        error = payload.get("error") if isinstance(payload, dict) else None
        if isinstance(error, dict):
            api_message = error.get("message") or api_message
            errors = error.get("errors") or []
            if errors and isinstance(errors[0], dict):
                reason = errors[0].get("reason")
    except (json.JSONDecodeError, TypeError, ValueError) as parse_exc:
        logger.warning(
            "YouTube search HttpError body was not JSON http_status={} parse_error={}",
            status,
            parse_exc,
        )
    if not reason:
        details = getattr(exc, "error_details", None)
        if isinstance(details, list) and details and isinstance(details[0], dict):
            reason = details[0].get("reason")
    return status, reason, api_message


def _snippet_title(item: Dict[str, Any]) -> str:
    raw_snippet = item.get("snippet")
    if isinstance(raw_snippet, dict):
        return raw_snippet.get("title") or ""
    return ""


def _apply_search_type(list_kwargs: Dict[str, Any], search_type: Optional[str], user_id: str) -> None:
    """Map TYPE filter ids onto documented Search.list type / videoType / duration."""
    if not search_type:
        return
    if search_type == "videos":
        list_kwargs["type"] = "video"
        list_kwargs.pop("videoType", None)
        return
    if search_type == "shorts":
        list_kwargs["type"] = "video"
        list_kwargs["videoDuration"] = "short"
        list_kwargs.pop("videoType", None)
        return
    if search_type == "channel":
        list_kwargs["type"] = "channel"
        list_kwargs.pop("videoDuration", None)
        list_kwargs.pop("videoType", None)
        list_kwargs.pop("eventType", None)
        return
    if search_type == "playlist":
        list_kwargs["type"] = "playlist"
        list_kwargs.pop("videoDuration", None)
        list_kwargs.pop("videoType", None)
        list_kwargs.pop("eventType", None)
        return
    if search_type == "movie":
        list_kwargs["type"] = "video"
        list_kwargs["videoType"] = "movie"
        return
    logger.warning(
        "YouTube search_by_keyword ignoring unsupported search_type={} user_id={}",
        search_type,
        user_id,
    )


def _map_search_list_item(
    item: Dict[str, Any], search_type: Optional[str]
) -> Optional[Dict[str, str]]:
    raw_id = item.get("id")
    if not isinstance(raw_id, dict):
        return None
    title = _snippet_title(item)
    if search_type == "channel":
        channel_id = raw_id.get("channelId")
        if not channel_id:
            return None
        return {"channel_id": channel_id, "title": title}
    if search_type == "playlist":
        playlist_id = raw_id.get("playlistId")
        if not playlist_id:
            return None
        return {"playlist_id": playlist_id, "title": title}
    video_id = raw_id.get("videoId")
    if not video_id:
        return None
    return {"video_id": video_id, "title": title}


class YouTubeSearchService:
    """Keyword search via authenticated YouTube Data API v3 Search.list."""

    def __init__(self, oauth_service: YouTubeOAuthService):
        self.oauth_service = oauth_service

    def search_by_keyword(
        self,
        user_id: str,
        query: str,
        max_results: int = _DEFAULT_MAX_RESULTS,
        page_token: Optional[str] = None,
        token_id: Optional[int] = None,
        order: Optional[str] = None,
        event_type: Optional[str] = None,
        video_duration: Optional[str] = None,
        search_type: Optional[str] = None,
        upload_date: Optional[str] = None,
        time_zone: Optional[str] = None,
    ) -> Dict[str, Any]:
        logger.info(
            "YouTube search_by_keyword start user_id={} query_length={} max_results={} "
            "has_page_token={} token_id_set={} order={} event_type={} "
            "video_duration={} search_type={} upload_date={} time_zone={}",
            user_id,
            len((query or "").strip()),
            max_results,
            bool(page_token),
            token_id is not None,
            order,
            event_type,
            video_duration,
            search_type,
            upload_date,
            time_zone,
        )
        stripped = (query or "").strip()
        if not stripped:
            logger.warning(
                "YouTube search_by_keyword rejected blank query user_id={}", user_id
            )
            return {
                "success": False,
                "error_code": "invalid_query",
                "message": "Enter a search keyword.",
                "items": [],
            }

        try:
            creds = self.oauth_service.get_valid_credentials(user_id, token_id)
            if not creds:
                logger.warning(
                    "YouTube search_by_keyword not_connected user_id={}", user_id
                )
                return {
                    "success": False,
                    "error_code": "not_connected",
                    "message": "Connect YouTube to search videos.",
                    "items": [],
                }

            youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)
            list_kwargs: Dict[str, Any] = {
                "part": "id,snippet",
                "q": stripped,
                "type": "video",
                "maxResults": min(max(max_results, 1), _YOUTUBE_SEARCH_MAX_RESULTS),
            }
            if page_token:
                list_kwargs["pageToken"] = page_token
            if order == "date":
                list_kwargs["order"] = "date"
            elif order:
                logger.warning(
                    "YouTube search_by_keyword ignoring unsupported order={} user_id={}",
                    order,
                    user_id,
                )
            if event_type == "live":
                list_kwargs["eventType"] = "live"
            elif event_type:
                logger.warning(
                    "YouTube search_by_keyword ignoring unsupported event_type={} user_id={}",
                    event_type,
                    user_id,
                )
            if video_duration in _SEARCH_LIST_VIDEO_DURATIONS:
                list_kwargs["videoDuration"] = video_duration
            elif video_duration:
                logger.warning(
                    "YouTube search_by_keyword ignoring unsupported video_duration={} user_id={}",
                    video_duration,
                    user_id,
                )
            published_after = None
            try:
                published_after = published_after_for_upload_date(
                    upload_date,
                    _youtube_search_utc_now(),
                    time_zone,
                )
            except Exception:
                logger.exception(
                    "YouTube search_by_keyword upload_date mapping failed "
                    "user_id={} upload_date={} time_zone={}",
                    user_id,
                    upload_date,
                    time_zone,
                )
            if published_after:
                list_kwargs["publishedAfter"] = published_after
            _apply_search_type(list_kwargs, search_type, user_id)

            logger.info(
                "YouTube Search.list request user_id={} part={} type={} maxResults={} "
                "has_page_token={} order={} event_type={} video_duration={} video_type={} "
                "published_after={}",
                user_id,
                list_kwargs["part"],
                list_kwargs["type"],
                list_kwargs["maxResults"],
                bool(page_token),
                list_kwargs.get("order"),
                list_kwargs.get("eventType"),
                list_kwargs.get("videoDuration"),
                list_kwargs.get("videoType"),
                list_kwargs.get("publishedAfter"),
            )
            results = youtube.search().list(**list_kwargs).execute()
            items: List[Dict[str, str]] = []
            for item in results.get("items") or []:
                if not isinstance(item, dict):
                    logger.warning(
                        "YouTube Search.list skipped non-object item user_id={}",
                        user_id,
                    )
                    continue
                mapped = _map_search_list_item(item, search_type)
                if mapped:
                    items.append(mapped)

            next_page_token = results.get("nextPageToken") or None
            logger.info(
                "YouTube search_by_keyword complete user_id={} item_count={} "
                "google_item_count={} has_next_page={}",
                user_id,
                len(items),
                len(results.get("items") or []),
                bool(next_page_token),
            )
            return {
                "success": True,
                "items": items,
                "next_page_token": next_page_token,
            }
        except HttpError as exc:
            return self._http_error_payload(user_id, exc)
        except Exception:
            logger.exception("YouTube search_by_keyword failed user_id={}", user_id)
            return {
                "success": False,
                "error_code": "search_failed",
                "message": "YouTube search failed.",
                "items": [],
            }

    def _http_error_payload(self, user_id: str, exc: HttpError) -> Dict[str, Any]:
        status, reason, api_message = _parse_search_list_http_error(exc)
        documented = _SEARCH_LIST_BAD_REQUEST.get(reason or "")
        if documented:
            logger.warning(
                "YouTube Search.list documented 400 user_id={} http_status={} reason={}",
                user_id,
                status,
                reason,
            )
            return {
                "success": False,
                "error_code": reason,
                "message": documented,
                "items": [],
            }

        logger.error(
            "YouTube Search.list unmapped HttpError user_id={} http_status={} "
            "reason={} detail={}",
            user_id,
            status,
            reason,
            api_message,
        )
        return {
            "success": False,
            "error_code": "search_failed",
            "message": api_message,
            "items": [],
        }
