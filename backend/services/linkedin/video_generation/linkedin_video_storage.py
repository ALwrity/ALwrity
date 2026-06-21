"""
LinkedIn Video Storage Service

Handles storage, retrieval, and management for LinkedIn generated videos.
"""

import hashlib
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from loguru import logger

from ...onboarding.api_key_manager import APIKeyManager


class LinkedInVideoStorage:
    """Filesystem storage for LinkedIn generated videos."""

    def __init__(
        self,
        storage_path: Optional[str] = None,
        api_key_manager: Optional[APIKeyManager] = None,
    ):
        self.api_key_manager = api_key_manager or APIKeyManager()

        if storage_path:
            self.base_storage_path = Path(storage_path)
        else:
            root_dir = Path(__file__).parent.parent.parent.parent.parent
            self.base_storage_path = root_dir / "data" / "media" / "linkedin_videos"

        self.videos_path = self.base_storage_path / "videos"
        self.metadata_path = self.base_storage_path / "metadata"
        self._uuid_pattern = re.compile(r"^[a-f0-9]{16}$")
        self.max_video_size_mb = 500

        self.videos_path.mkdir(parents=True, exist_ok=True)
        self.metadata_path.mkdir(parents=True, exist_ok=True)
        logger.info(
            "[LinkedInVideoGen] Storage initialized at {}",
            self.base_storage_path,
        )

    def _generate_video_id(self, video_data: bytes, metadata: Dict[str, Any]) -> str:
        hash_input = (
            f"{video_data[:1000]}"
            f"{metadata.get('topic', '')}"
            f"{metadata.get('industry', '')}"
            f"{datetime.now().isoformat()}"
        )
        return hashlib.sha256(hash_input.encode()).hexdigest()[:16]

    def _validate_video_id(self, video_id: str) -> bool:
        return bool(self._uuid_pattern.match(video_id))

    def _get_video_path(self, video_id: str, user_id: Optional[str] = None) -> Path:
        if user_id:
            return self.videos_path / user_id / f"{video_id}.mp4"
        return self.videos_path / f"{video_id}.mp4"

    def _get_metadata_path(self, video_id: str, user_id: Optional[str] = None) -> Path:
        if user_id:
            return self.metadata_path / user_id / f"{video_id}.json"
        return self.metadata_path / f"{video_id}.json"

    async def store_video(
        self,
        video_data: bytes,
        metadata: Dict[str, Any],
        content_type: str = "post",
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            if len(video_data) > self.max_video_size_mb * 1024 * 1024:
                return {
                    "success": False,
                    "error": f"Video exceeds maximum size of {self.max_video_size_mb}MB",
                }

            video_id = self._generate_video_id(video_data, metadata)
            video_path = self._get_video_path(video_id, user_id)
            video_path.parent.mkdir(parents=True, exist_ok=True)

            with open(video_path, "wb") as f:
                f.write(video_data)

            meta = {
                **metadata,
                "video_id": video_id,
                "content_type": content_type,
                "stored_at": datetime.now().isoformat(),
                "file_size": len(video_data),
                "user_id": user_id,
            }
            metadata_path = self._get_metadata_path(video_id, user_id)
            metadata_path.parent.mkdir(parents=True, exist_ok=True)
            with open(metadata_path, "w", encoding="utf-8") as f:
                json.dump(meta, f, indent=2)

            logger.info(
                "[LinkedInVideoGen] Stored video_id={} path={} size={} bytes",
                video_id,
                video_path,
                len(video_data),
            )
            return {
                "success": True,
                "video_id": video_id,
                "storage_path": str(video_path),
                "file_url": f"/api/linkedin/videos/{video_id}",
            }
        except Exception as e:
            logger.error("[LinkedInVideoGen] Error storing video: {}", e)
            return {"success": False, "error": f"Video storage failed: {e}"}

    async def retrieve_video(
        self, video_id: str, user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        try:
            if not self._validate_video_id(video_id):
                return {"success": False, "error": f"Invalid video ID: {video_id}"}

            video_path = self._get_video_path(video_id, user_id)
            if not video_path.exists() and user_id:
                video_path = self._get_video_path(video_id, None)
            if not video_path.exists():
                for candidate in self.videos_path.rglob(f"{video_id}.mp4"):
                    video_path = candidate
                    break

            if not video_path.exists():
                return {"success": False, "error": f"Video not found: {video_id}"}

            metadata_path = self._get_metadata_path(video_id, user_id)
            metadata: Dict[str, Any] = {}
            if metadata_path.exists():
                with open(metadata_path, "r", encoding="utf-8") as f:
                    metadata = json.load(f)

            return {
                "success": True,
                "video_path": str(video_path),
                "metadata": metadata,
            }
        except Exception as e:
            logger.error("[LinkedInVideoGen] Error retrieving video {}: {}", video_id, e)
            return {"success": False, "error": f"Video retrieval failed: {e}"}

    async def get_storage_stats(self) -> Dict[str, Any]:
        try:
            video_files = list(self.videos_path.rglob("*.mp4"))
            total_size = sum(f.stat().st_size for f in video_files)
            return {
                "success": True,
                "total_files": len(video_files),
                "total_size_gb": round(total_size / (1024 ** 3), 4),
                "storage_limit_gb": 10,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
