"""
YouTube Publish Service

Uploads videos to YouTube via the YouTube Data API v3.
Uses stored OAuth credentials from YouTubeOAuthService.
Supports resumable upload for large files.
"""

import os
import tempfile
import time
from typing import Optional, Dict, Any, List
from pathlib import Path

import httpx
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from loguru import logger

from services.youtube.youtube_oauth_service import YouTubeOAuthService
from services.youtube.youtube_publish_log import (
    user_safe_publish_error,
    youtube_publish_error_log_fields,
    youtube_publish_source_meta,
)
from services.youtube.video_storage import find_youtube_video_file
from services.database import get_session_for_user

_CREATOR_VIDEO_API_PREFIX = "/api/youtube/videos/"


class YouTubePublishService:
    """Upload videos to YouTube using stored OAuth credentials."""

    MAX_RETRIES = 3
    CHUNK_SIZE = 50 * 1024 * 1024  # 50MB chunks for resumable upload
    DOWNLOAD_TIMEOUT = 300  # 5 minutes to download source video

    def __init__(self, oauth_service: YouTubeOAuthService):
        self.oauth_service = oauth_service

    def publish_video(
        self,
        user_id: str,
        token_id: int,
        video_source: str,
        title: str,
        description: str = "",
        tags: Optional[List[str]] = None,
        privacy_status: str = "unlisted",
        category_id: str = "22",
        made_for_kids: bool = False,
        language: str = "en",
        publish_at: Optional[str] = None,
        age_restricted: bool = False,
    ) -> Dict[str, Any]:
        """
        Upload a video to YouTube.

        Args:
            publish_at: Optional ISO-8601 UTC datetime (e.g. 2026-08-20T15:00:00Z).
                When set, privacy_status is forced to private until YouTube goes live.
            age_restricted: When True, sets status.contentRating.ytRating to ytAgeRestricted.
                Incompatible with made_for_kids.
        """
        temp_path = None
        is_temp = False
        try:
            logger.info(
                "[youtube_publish] Entry user_id={} token_id={} title_length={} tag_count={} "
                "privacy={} has_publish_at={} made_for_kids={} age_restricted={} source_kind={}",
                user_id,
                token_id,
                len(title),
                len(tags or []),
                privacy_status,
                bool(publish_at),
                made_for_kids,
                age_restricted,
                youtube_publish_source_meta(video_source)["source_kind"],
            )
            if made_for_kids and age_restricted:
                logger.warning(
                    "[youtube_publish] Audience conflict user_id={} made_for_kids=True age_restricted=True",
                    user_id,
                )
                return {
                    "success": False,
                    "error": "This video cannot be both made for kids and age-restricted.",
                }
            # Validate title length
            if len(title) > 100:
                title = title[:97] + "..."

            # Get valid credentials
            creds = self.oauth_service.get_valid_credentials(user_id, token_id)
            if not creds:
                logger.warning(
                    "[youtube_publish] Auth missing user_id={} token_id={}",
                    user_id,
                    token_id,
                )
                return {
                    "success": False,
                    "error": "YouTube auth failed. Please reconnect your YouTube channel.",
                }

            # Resolve video file path (download if URL)
            source_meta = youtube_publish_source_meta(video_source)
            logger.info(
                "[youtube_publish] Resolve source user_id={} token_id={} source_kind={} source_length={}",
                user_id,
                token_id,
                source_meta["source_kind"],
                source_meta["source_length"],
            )
            video_path, was_downloaded = self._resolve_video_source(
                video_source,
                user_id=user_id,
            )
            if not video_path:
                logger.error(
                    "[youtube_publish] Source not found user_id={} source_kind={} source_length={}",
                    user_id,
                    source_meta["source_kind"],
                    source_meta["source_length"],
                )
                return {"success": False, "error": "Video source file not found or could not be downloaded."}

            temp_path = video_path
            is_temp = was_downloaded

            # Validate file
            file_size = os.path.getsize(video_path)
            if file_size == 0:
                logger.error(
                    "[youtube_publish] Empty video file user_id={} source_kind={}",
                    user_id,
                    source_meta["source_kind"],
                )
                return {"success": False, "error": "Video file is empty."}

            effective_privacy = privacy_status
            if publish_at:
                # YouTube requires private when using publishAt
                effective_privacy = "private"

            logger.info(
                "[youtube_publish] Upload start user_id={} token_id={} size_mb={} privacy={} "
                "has_publish_at={} made_for_kids={} age_restricted={} title_length={} source_kind={}",
                user_id,
                token_id,
                round(file_size / 1024 / 1024, 1),
                effective_privacy,
                bool(publish_at),
                made_for_kids,
                age_restricted,
                len(title),
                source_meta["source_kind"],
            )

            # Build YouTube API client
            youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)

            # Prepare video metadata
            status_body: Dict[str, Any] = {
                "privacyStatus": effective_privacy,
                "selfDeclaredMadeForKids": made_for_kids,
            }
            if age_restricted:
                status_body["contentRating"] = {"ytRating": "ytAgeRestricted"}
            if publish_at:
                status_body["publishAt"] = publish_at
                status_body["privacyStatus"] = "private"

            body = {
                "snippet": {
                    "title": title,
                    "description": description,
                    "tags": tags or [],
                    "categoryId": category_id,
                    "defaultLanguage": language,
                },
                "status": status_body,
            }

            # Upload with resumable media
            media = MediaFileUpload(
                video_path,
                chunksize=self.CHUNK_SIZE,
                resumable=True,
            )

            request = youtube.videos().insert(
                part=",".join(body.keys()),
                body=body,
                media_body=media,
            )

            response = None
            last_error = None

            for attempt in range(self.MAX_RETRIES):
                try:
                    response = request.execute()
                    break
                except Exception as e:
                    last_error = e
                    fields = youtube_publish_error_log_fields(e)
                    logger.warning(
                        "[youtube_publish] Upload attempt failed user_id={} attempt={}/{} "
                        "error_type={} http_status={}",
                        user_id,
                        attempt + 1,
                        self.MAX_RETRIES,
                        fields["error_type"],
                        fields["http_status"],
                    )
                    if attempt < self.MAX_RETRIES - 1:
                        time.sleep(2 ** attempt)

            if not response:
                error_msg = (
                    user_safe_publish_error(last_error)
                    if last_error
                    else "Upload failed after retries."
                )
                fields = (
                    youtube_publish_error_log_fields(last_error)
                    if last_error
                    else {"error_type": None, "http_status": None}
                )
                logger.error(
                    "[youtube_publish] Upload failed after retries user_id={} error_type={} http_status={}",
                    user_id,
                    fields["error_type"],
                    fields["http_status"],
                )
                return {"success": False, "error": error_msg}

            video_id = response.get("id", "")
            video_url = f"https://youtu.be/{video_id}" if video_id else ""

            logger.info(
                "[youtube_publish] Upload complete user_id={} has_video_id={} privacy={}",
                user_id,
                bool(video_id),
                effective_privacy,
            )

            return {
                "success": True,
                "video_id": video_id,
                "video_url": video_url,
                "title": title,
                "privacy_status": effective_privacy,
                "publish_at": publish_at,
            }

        except Exception as e:
            fields = youtube_publish_error_log_fields(e)
            logger.error(
                "[youtube_publish] Unexpected error user_id={} error_type={} http_status={}",
                user_id,
                fields["error_type"],
                fields["http_status"],
            )
            return {"success": False, "error": user_safe_publish_error(e)}

        finally:
            if temp_path and is_temp:
                try:
                    os.unlink(temp_path)
                    logger.info("[youtube_publish] Temp file cleaned up")
                except Exception as cleanup_error:
                    logger.warning(
                        "[youtube_publish] Temp file cleanup failed error_type={}",
                        type(cleanup_error).__name__,
                    )

    def _resolve_video_source(self, video_source: str, user_id: str):
        """
        Resolve video source to a local file path.
        Returns (path, is_temp) tuple. HTTP(S) downloads are temp files.
        Creator ``/api/youtube/videos/<filename>`` paths are looked up on disk
        via ``find_youtube_video_file`` and must not be deleted after upload.
        """
        if video_source.startswith(("http://", "https://", "ftp://")):
            path = self._download_video(video_source)
            return (path, True) if path else (None, False)

        creator_path = self._resolve_creator_api_path(video_source, user_id)
        if creator_path is not None:
            return creator_path

        local_path = Path(video_source)
        meta = youtube_publish_source_meta(video_source)
        if local_path.exists():
            logger.info(
                "[youtube_publish] Resolved local file source_kind={} source_length={}",
                meta["source_kind"],
                meta["source_length"],
            )
            return (str(local_path.resolve()), False)

        logger.error(
            "[youtube_publish] Video source not found source_kind={} source_length={}",
            meta["source_kind"],
            meta["source_length"],
        )
        return (None, False)

    @staticmethod
    def _creator_api_filename(video_source: str) -> Optional[str]:
        """Return a safe filename from a Creator video API path, or None."""
        raw = (video_source or "").split("?")[0].strip()
        if not raw.startswith(_CREATOR_VIDEO_API_PREFIX):
            return None
        filename = raw[len(_CREATOR_VIDEO_API_PREFIX) :]
        if not filename or ".." in filename or "/" in filename or "\\" in filename:
            logger.warning(
                "[youtube_publish] Rejected unsafe creator API filename filename_length={}",
                len(filename) if filename else 0,
            )
            return None
        return filename

    def _resolve_creator_api_path(
        self,
        video_source: str,
        user_id: str,
    ):
        """Look up ``/api/youtube/videos/<file>`` on disk. None if not that prefix."""
        filename = self._creator_api_filename(video_source)
        if filename is None:
            if (video_source or "").split("?")[0].strip().startswith(
                _CREATOR_VIDEO_API_PREFIX
            ):
                return (None, False)
            return None

        db = None
        try:
            try:
                db = get_session_for_user(user_id)
            except Exception as session_error:
                logger.warning(
                    "[youtube_publish] DB session unavailable for creator path "
                    "user_id={} error_type={}",
                    user_id,
                    type(session_error).__name__,
                )
            found = find_youtube_video_file(filename, user_id=user_id, db=db)
            if found is not None and found.is_file():
                logger.info(
                    "[youtube_publish] Resolved creator API path user_id={} filename_length={}",
                    user_id,
                    len(filename),
                )
                return (str(found), False)
            logger.error(
                "[youtube_publish] Creator API file not on disk user_id={} filename_length={}",
                user_id,
                len(filename),
            )
            return (None, False)
        finally:
            if db is not None:
                try:
                    db.close()
                except Exception as close_error:
                    logger.warning(
                        "[youtube_publish] DB session close failed error_type={}",
                        type(close_error).__name__,
                    )

    def _download_video(self, url: str) -> Optional[str]:
        """Download a video from URL to a temporary file."""
        tmp_path = None
        try:
            suffix = self._guess_extension(url) or ".mp4"
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
            tmp_path = tmp.name
            tmp.close()

            meta = youtube_publish_source_meta(url)
            logger.info(
                "[youtube_publish] Download start source_kind={} source_length={}",
                meta["source_kind"],
                meta["source_length"],
            )

            with httpx.Client(timeout=self.DOWNLOAD_TIMEOUT, follow_redirects=True) as client:
                with client.stream("GET", url) as response:
                    response.raise_for_status()
                    with open(tmp_path, "wb") as f:
                        for chunk in response.iter_bytes(chunk_size=8 * 1024 * 1024):
                            f.write(chunk)

            file_size = os.path.getsize(tmp_path)
            logger.info(
                "[youtube_publish] Download complete source_kind={} size_mb={}",
                meta["source_kind"],
                round(file_size / 1024 / 1024, 1),
            )
            return tmp_path

        except Exception as e:
            fields = youtube_publish_error_log_fields(e)
            logger.error(
                "[youtube_publish] Download failed source_kind={} error_type={} http_status={}",
                youtube_publish_source_meta(url)["source_kind"],
                fields["error_type"],
                fields["http_status"],
            )
            if tmp_path:
                try:
                    os.unlink(tmp_path)
                except Exception as cleanup_error:
                    logger.warning(
                        "[youtube_publish] Download temp cleanup failed error_type={}",
                        type(cleanup_error).__name__,
                    )
            return None

    @staticmethod
    def _guess_extension(url: str) -> str:
        """Guess file extension from URL."""
        path = url.split("?")[0]  # Strip query params
        _, ext = os.path.splitext(path)
        if ext.lower() in (".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv", ".wmv"):
            return ext
        return ".mp4"
