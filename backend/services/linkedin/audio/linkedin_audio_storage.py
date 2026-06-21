"""
LinkedIn Audio Storage Service

Persists generated narration audio files and metadata for LinkedIn content.
"""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from loguru import logger

from ...onboarding.api_key_manager import APIKeyManager


class LinkedInAudioStorage:
    """Store and retrieve LinkedIn narration audio files."""

    _UUID_PATTERN = re.compile(r"^[a-f0-9]{16}$")

    def __init__(self, storage_path: Optional[str] = None, api_key_manager: Optional[APIKeyManager] = None):
        self.api_key_manager = api_key_manager or APIKeyManager()

        if storage_path:
            self.base_storage_path = Path(storage_path)
        else:
            root_dir = Path(__file__).parent.parent.parent.parent.parent
            self.base_storage_path = root_dir / "data" / "media" / "linkedin_audio"

        self.audio_path = self.base_storage_path / "files"
        self.metadata_path = self.base_storage_path / "metadata"
        self._create_storage_directories()

        self.max_file_size_mb = 15
        self.max_files_per_user = 50
        logger.info(
            "[LinkedInAudioGen] Storage initialized at {}",
            self.base_storage_path,
        )

    def _create_storage_directories(self) -> None:
        self.audio_path.mkdir(parents=True, exist_ok=True)
        self.metadata_path.mkdir(parents=True, exist_ok=True)

    def _generate_audio_id(self, audio_data: bytes, metadata: Dict[str, Any]) -> str:
        digest = hashlib.md5(
            audio_data + json.dumps(metadata, sort_keys=True, default=str).encode("utf-8")
        ).hexdigest()
        return digest[:16]

    def _validate_audio_id(self, audio_id: str) -> bool:
        return bool(self._UUID_PATTERN.match(audio_id or ""))

    def _metadata_file(self, audio_id: str) -> Path:
        return self.metadata_path / f"{audio_id}.json"

    def _find_audio_file(self, audio_id: str, user_id: Optional[str] = None) -> Optional[Path]:
        candidates = []
        if user_id:
            candidates.append(self.audio_path / user_id / f"{audio_id}.mp3")
        candidates.append(self.audio_path / f"{audio_id}.mp3")

        for path in candidates:
            if path.exists():
                return path

        for path in self.audio_path.rglob(f"{audio_id}.mp3"):
            return path
        return None

    async def store_audio(
        self,
        audio_data: bytes,
        metadata: Dict[str, Any],
        user_id: Optional[str] = None,
        file_extension: str = "mp3",
    ) -> Dict[str, Any]:
        """Persist audio bytes and sidecar metadata."""
        try:
            if len(audio_data) > self.max_file_size_mb * 1024 * 1024:
                return {
                    "success": False,
                    "error": f"Audio file exceeds {self.max_file_size_mb}MB limit",
                }

            audio_id = self._generate_audio_id(audio_data, metadata)
            if user_id:
                target_dir = self.audio_path / user_id
            else:
                target_dir = self.audio_path
            target_dir.mkdir(parents=True, exist_ok=True)

            file_path = target_dir / f"{audio_id}.{file_extension}"
            file_path.write_bytes(audio_data)

            record = {
                "audio_id": audio_id,
                "stored_at": datetime.now().isoformat(),
                "file_path": str(file_path),
                "file_size": len(audio_data),
                "file_extension": file_extension,
                "user_id": user_id,
                **metadata,
            }
            self._metadata_file(audio_id).write_text(
                json.dumps(record, indent=2, default=str),
                encoding="utf-8",
            )

            logger.info(
                "[LinkedInAudioGen] Stored audio_id={} path={} size={} bytes",
                audio_id,
                file_path,
                len(audio_data),
            )

            return {
                "success": True,
                "audio_id": audio_id,
                "storage_path": str(file_path),
                "metadata": record,
            }
        except Exception as exc:
            logger.error("[LinkedInAudioGen] Error storing audio: {}", exc)
            return {"success": False, "error": f"Audio storage failed: {exc}"}

    async def get_metadata(self, audio_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        if not self._validate_audio_id(audio_id):
            return None

        meta_path = self._metadata_file(audio_id)
        if not meta_path.exists():
            return None

        record = json.loads(meta_path.read_text(encoding="utf-8"))
        if user_id and record.get("user_id") and record.get("user_id") != user_id:
            return None
        return record

    async def retrieve_audio(self, audio_id: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        if not self._validate_audio_id(audio_id):
            return {"success": False, "error": f"Invalid audio ID format: {audio_id}"}

        file_path = self._find_audio_file(audio_id, user_id)
        if not file_path:
            return {"success": False, "error": "Audio file not found"}

        metadata = await self.get_metadata(audio_id, user_id)
        if metadata and user_id and metadata.get("user_id") and metadata.get("user_id") != user_id:
            return {"success": False, "error": "Audio not found"}

        return {
            "success": True,
            "audio_data": file_path.read_bytes(),
            "audio_path": str(file_path),
            "metadata": metadata or {},
        }

    async def delete_audio(self, audio_id: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        result = await self.retrieve_audio(audio_id, user_id)
        if not result.get("success"):
            return result

        try:
            Path(result["audio_path"]).unlink(missing_ok=True)
            self._metadata_file(audio_id).unlink(missing_ok=True)
            logger.info("[LinkedInAudioGen] Deleted audio_id={}", audio_id)
            return {"success": True, "message": "Audio deleted successfully"}
        except Exception as exc:
            logger.error("[LinkedInAudioGen] Error deleting audio {}: {}", audio_id, exc)
            return {"success": False, "error": str(exc)}
