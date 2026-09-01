"""Map Search filters FEATURES ids onto documented Search.list video params.

Requires type=video:

- live             → eventType=live
- hd               → videoDefinition=high
- subtitles        → videoCaption=closedCaption
- creative_commons → videoLicense=creativeCommon
- 3d               → videoDimension=3d

Do not invent params for 4K, 360°, VR180, HDR, Location, or Purchased.
360° is not videoDimension=3d.

Channel and playlist Search.list cannot take video feature filters.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from loguru import logger

_VIDEO_FEATURES: Dict[str, Dict[str, str]] = {
    "live": {"eventType": "live"},
    "hd": {"videoDefinition": "high"},
    "subtitles": {"videoCaption": "closedCaption"},
    "creative_commons": {"videoLicense": "creativeCommon"},
    "3d": {"videoDimension": "3d"},
}

_CHANNEL_PLAYLIST_TYPES = frozenset({"channel", "playlist"})

_VIDEO_ONLY_SEARCH_LIST_KEYS = (
    "videoDuration",
    "videoType",
    "eventType",
    "videoDefinition",
    "videoCaption",
    "videoLicense",
    "videoDimension",
)


def strip_youtube_search_video_only_params(list_kwargs: Dict[str, Any]) -> None:
    """Remove Search.list params that are invalid unless type=video."""
    for key in _VIDEO_ONLY_SEARCH_LIST_KEYS:
        list_kwargs.pop(key, None)


def apply_youtube_search_video_feature(
    list_kwargs: Dict[str, Any],
    video_feature: Optional[str],
    search_type: Optional[str],
    user_id: str,
) -> None:
    """Apply a FEATURES id, or skip when type is channel/playlist / unknown."""
    if not video_feature:
        return
    if search_type in _CHANNEL_PLAYLIST_TYPES:
        logger.info(
            "YouTube search stripping video_feature for non-video type "
            "user_id={} video_feature={} search_type={}",
            user_id,
            video_feature,
            search_type,
        )
        return
    mapping = _VIDEO_FEATURES.get(video_feature)
    if not mapping:
        logger.warning(
            "YouTube search ignoring unsupported video_feature={} user_id={}",
            video_feature,
            user_id,
        )
        return
    list_kwargs["type"] = "video"
    list_kwargs.update(mapping)
    logger.info(
        "YouTube search video_feature mapped user_id={} video_feature={} "
        "search_list_keys={}",
        user_id,
        video_feature,
        sorted(mapping.keys()),
    )
