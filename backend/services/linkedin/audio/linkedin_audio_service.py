"""
LinkedIn Audio Service

Generates LinkedIn-optimized narration audio by composing speakable text and
delegating TTS to the shared audio generation pipeline (WaveSpeed Minimax Speech 02 HD).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import HTTPException
from loguru import logger

from services.llm_providers.main_audio_generation import generate_audio

from .linkedin_audio_storage import LinkedInAudioStorage
from .narration_builder import build_narration_text, estimate_spoken_duration_seconds

# LinkedIn professional narration defaults
_DEFAULT_VOICE_ID = "Wise_Woman"
_DEFAULT_EMOTION = "neutral"
_LINKEDIN_AUDIO_FORMAT = "mp3"

_TONE_EMOTION_MAP = {
    "professional": "neutral",
    "conversational": "happy",
    "authoritative": "neutral",
    "inspirational": "happy",
    "educational": "neutral",
    "friendly": "happy",
}


class LinkedInAudioService:
    """Orchestrates LinkedIn narration text assembly, TTS, and storage."""

    def __init__(self, storage: Optional[LinkedInAudioStorage] = None):
        self.storage = storage or LinkedInAudioStorage()

    async def generate_narration(
        self,
        *,
        user_id: str,
        text: Optional[str] = None,
        video_script: Optional[Any] = None,
        target_duration_seconds: int = 75,
        voice_id: str = _DEFAULT_VOICE_ID,
        custom_voice_id: Optional[str] = None,
        speed: float = 1.0,
        volume: float = 1.0,
        pitch: float = 0.0,
        emotion: Optional[str] = None,
        tone: Optional[str] = None,
        topic: Optional[str] = None,
        industry: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate and store LinkedIn narration audio.

        Provide either `text` or `video_script`. Returns a result dict compatible
        with API response serialization.
        """
        start_time = datetime.now()

        resolved_emotion = emotion or _TONE_EMOTION_MAP.get(
            (tone or "").lower(), _DEFAULT_EMOTION
        )

        logger.info(
            "[LinkedInAudioGen] Starting narration user={} voice={} emotion={} target_duration={}",
            user_id,
            voice_id,
            resolved_emotion,
            target_duration_seconds,
        )

        try:
            narration_text = build_narration_text(
                text=text,
                video_script=video_script,
                target_duration_seconds=target_duration_seconds,
                speed=speed,
            )
        except ValueError as exc:
            logger.warning("[LinkedInAudioGen] Invalid narration input: {}", exc)
            return {"success": False, "error": str(exc)}

        estimated_duration = estimate_spoken_duration_seconds(narration_text, speed)
        preview = narration_text[:200]
        if len(narration_text) > 200:
            preview = f"{preview}..."
        logger.info(
            "[LinkedInAudioGen] Narration text ({} chars, ~{:.1f}s): {}",
            len(narration_text),
            estimated_duration,
            preview,
        )

        logger.info(
            "[LinkedInAudioGen] Delegating to provider voice={}",
            voice_id,
        )

        try:
            audio_result = generate_audio(
                text=narration_text,
                voice_id=voice_id,
                custom_voice_id=custom_voice_id,
                speed=speed,
                volume=volume,
                pitch=pitch,
                emotion=resolved_emotion,
                user_id=user_id,
                format=_LINKEDIN_AUDIO_FORMAT,
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("[LinkedInAudioGen] Provider generation failed: {}", exc, exc_info=True)
            return {"success": False, "error": f"Audio generation failed: {exc}"}

        generation_time = (datetime.now() - start_time).total_seconds()

        storage_result = await self.storage.store_audio(
            audio_data=audio_result.audio_bytes,
            metadata={
                "topic": topic,
                "industry": industry,
                "voice_id": audio_result.voice_id,
                "provider": audio_result.provider,
                "model": audio_result.model,
                "text_length": audio_result.text_length,
                "target_duration_seconds": target_duration_seconds,
                "estimated_duration_seconds": round(estimated_duration, 1),
                "narration_preview": narration_text[:200],
                "generation_time": generation_time,
                "emotion": resolved_emotion,
            },
            user_id=user_id,
            file_extension=_LINKEDIN_AUDIO_FORMAT,
        )

        if not storage_result.get("success"):
            logger.error(
                "[LinkedInAudioGen] Storage failed: {}",
                storage_result.get("error", "unknown"),
            )
            return {
                "success": False,
                "error": storage_result.get("error", "Failed to store audio"),
            }

        audio_id = storage_result["audio_id"]
        logger.info(
            "[LinkedInAudioGen] Complete audio_id={} file_size={} generation_time={:.2f}s",
            audio_id,
            audio_result.file_size,
            generation_time,
        )
        return {
            "success": True,
            "audio_id": audio_id,
            "download_path": f"/api/linkedin/audio/{audio_id}",
            "metadata": {
                "provider": audio_result.provider,
                "model": audio_result.model,
                "voice_id": audio_result.voice_id,
                "text_length": audio_result.text_length,
                "file_size": audio_result.file_size,
                "estimated_duration_seconds": round(estimated_duration, 1),
                "target_duration_seconds": target_duration_seconds,
                "generation_time": generation_time,
                "format": _LINKEDIN_AUDIO_FORMAT,
                "emotion": resolved_emotion,
                "topic": topic,
                "industry": industry,
            },
        }
