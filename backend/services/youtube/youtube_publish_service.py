"""
YouTube Publish Service

Uploads videos to YouTube via the YouTube Data API v3.
Uses stored OAuth credentials from YouTubeOAuthService.
Supports resumable upload for large files.
"""

import os
import tempfile
from typing import Optional, Dict, Any, List
from pathlib import Path

import httpx
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.oauth2.credentials import Credentials as GoogleCredentials
from loguru import logger

from services.youtube.youtube_oauth_service import YouTubeOAuthService


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
    ) -> Dict[str, Any]:
        """
        Upload a video to YouTube.

        Args:
            publish_at: Optional ISO-8601 UTC datetime (e.g. 2026-08-20T15:00:00Z).
                When set, privacy_status is forced to private until YouTube goes live.
        """
        temp_path = None
        is_temp = False
        try:
            # Validate title length
            if len(title) > 100:
                title = title[:97] + "..."

            # Get valid credentials
            creds = self.oauth_service.get_valid_credentials(user_id, token_id)
            if not creds:
                return {
                    "success": False,
                    "error": "YouTube auth failed. Please reconnect your YouTube channel.",
                }

            # Resolve video file path (download if URL)
            video_path, was_downloaded = self._resolve_video_source(video_source)
            if not video_path:
                return {"success": False, "error": "Video source file not found or could not be downloaded."}

            temp_path = video_path
            is_temp = was_downloaded

            # Validate file
            file_size = os.path.getsize(video_path)
            if file_size == 0:
                return {"success": False, "error": "Video file is empty."}

            effective_privacy = privacy_status
            if publish_at:
                # YouTube requires private when using publishAt
                effective_privacy = "private"

            logger.info(
                f"YouTube publish: starting upload for user {user_id}, "
                f"title='{title}', size={file_size / 1024 / 1024:.1f}MB, "
                f"privacy={effective_privacy}, publish_at={publish_at or 'now'}"
            )

            # Build YouTube API client
            youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)

            # Prepare video metadata
            status_body: Dict[str, Any] = {
                "privacyStatus": effective_privacy,
                "selfDeclaredMadeForKids": made_for_kids,
            }
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
                    logger.warning(
                        f"YouTube publish upload attempt {attempt + 1}/{self.MAX_RETRIES} "
                        f"failed for user {user_id}: {e}"
                    )
                    if attempt < self.MAX_RETRIES - 1:
                        import time
                        time.sleep(2 ** attempt)

            if not response:
                error_msg = str(last_error or "Upload failed after retries")
                logger.error(f"YouTube publish: upload failed for user {user_id}: {error_msg}")
                return {"success": False, "error": error_msg}

            video_id = response.get("id", "")
            video_url = f"https://youtu.be/{video_id}" if video_id else ""

            logger.info(
                f"YouTube publish: upload complete for user {user_id} — "
                f"video_id={video_id}, url={video_url}"
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
            logger.error(f"YouTube publish: error for user {user_id}: {e}")
            return {"success": False, "error": str(e)}

        finally:
            if temp_path and is_temp:
                try:
                    os.unlink(temp_path)
                except Exception:
                    pass

    def _resolve_video_source(self, video_source: str):
        """
        Resolve video source to a local file path.
        Returns (path, is_temp) tuple. If video_source is a URL, download it to a temp file.
        """
        if video_source.startswith(("http://", "https://", "ftp://")):
            path = self._download_video(video_source)
            return (path, True) if path else (None, False)

        local_path = Path(video_source)
        if local_path.exists():
            return (str(local_path.resolve()), False)

        logger.error(f"YouTube publish: video source not found: {video_source}")
        return (None, False)

    def _download_video(self, url: str) -> Optional[str]:
        """Download a video from URL to a temporary file."""
        try:
            suffix = self._guess_extension(url) or ".mp4"
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
            tmp_path = tmp.name
            tmp.close()

            logger.info(f"YouTube publish: downloading video from {url}")

            with httpx.Client(timeout=self.DOWNLOAD_TIMEOUT, follow_redirects=True) as client:
                with client.stream("GET", url) as response:
                    response.raise_for_status()
                    with open(tmp_path, "wb") as f:
                        for chunk in response.iter_bytes(chunk_size=8 * 1024 * 1024):
                            f.write(chunk)

            file_size = os.path.getsize(tmp_path)
            logger.info(f"YouTube publish: downloaded {file_size / 1024 / 1024:.1f}MB to {tmp_path}")
            return tmp_path

        except Exception as e:
            logger.error(f"YouTube publish: download failed from {url}: {e}")
            if "tmp_path" in locals():
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass
            return None

    @staticmethod
    def _guess_extension(url: str) -> str:
        """Guess file extension from URL."""
        path = url.split("?")[0]  # Strip query params
        _, ext = os.path.splitext(path)
        if ext.lower() in (".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv", ".wmv"):
            return ext
        return ".mp4"
