"""Speech text preprocessing and transparency metadata for YouTube scene audio."""

from __future__ import annotations

import re
from typing import Any, Dict

from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.scene_audio_prompts")

_INSTRUCTIONAL_PATTERNS = (
    r"\[Pacing:\s*[^\]]+\]",
    r"\[Instructions?:\s*[^\]]+\]",
    r"\[Timing:\s*[^\]]+\]",
    r"\[Note:\s*[^\]]+\]",
    r"\[Internal:\s*[^\]]+\]",
)


def preprocess_youtube_narration_text(text: str) -> str:
    """Remove non-spoken instructional markers before TTS."""
    processed_text = (text or "").strip()
    for pattern in _INSTRUCTIONAL_PATTERNS:
        processed_text = re.sub(pattern, "", processed_text, flags=re.IGNORECASE)
    processed_text = re.sub(r"\s+", " ", processed_text).strip()
    logger.debug(
        "[YouTubeSceneAudio] Preprocessed narration input_len=%s output_len=%s",
        len(text or ""),
        len(processed_text),
    )
    return processed_text


def build_youtube_scene_audio_generation_metadata(
    *,
    input_text: str,
    speech_text: str,
    voice_id: str,
    emotion: str,
    language_boost: str,
    provider: str,
    model: str,
) -> Dict[str, Any]:
    """Return additive generation metadata for the scene audio API response."""
    metadata = {
        "gateway": "wavespeed_minimax_speech",
        "provider": provider or "wavespeed",
        "model": model or "minimax/speech-02-hd",
        "input_text": input_text or "",
        "speech_text": speech_text or "",
        "voice_id": voice_id or "",
        "emotion": emotion or "",
        "language_boost": language_boost or "",
        "instructions_stripped": (input_text or "") != (speech_text or ""),
    }
    logger.info(
        "[YouTubeSceneAudio] Generation metadata built voice_id=%s emotion=%s "
        "language_boost=%s input_len=%s speech_len=%s instructions_stripped=%s",
        voice_id,
        emotion,
        language_boost,
        len(metadata["input_text"]),
        len(metadata["speech_text"]),
        metadata["instructions_stripped"],
    )
    return metadata
