"""Speech text preprocessing and transparency metadata for YouTube scene audio."""

from __future__ import annotations

import re
from typing import Any, Dict, Optional, Tuple

from services.youtube.planner_config import SPOKEN_WORDS_PER_MINUTE
from services.youtube.youtube_scene_video_prompts import resolve_youtube_scene_video_duration
from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.scene_audio_prompts")

# Any [bracket] stage direction is not spoken (title/pacing hints from older clients).
_BRACKET_STAGE_DIRECTION = re.compile(r"\[[^\]]*\]")
_DEFAULT_CLIP_SECONDS = 5


def strip_youtube_scene_title_prefix(text: str, scene_title: Optional[str]) -> str:
    """Remove a leading 'Title. ' prefix if the client still prepends the card title."""
    try:
        spoken = (text or "").strip()
        title = (scene_title or "").strip()
        if not spoken or not title:
            return spoken
        prefix = f"{title}."
        if spoken.lower().startswith(prefix.lower()):
            stripped = spoken[len(prefix) :].strip()
            logger.debug(
                "[YouTubeSceneAudio] Stripped title prefix title_len={} remaining_len={}",
                len(title),
                len(stripped),
            )
            return stripped
        return spoken
    except Exception:
        logger.exception("[YouTubeSceneAudio] Title prefix strip failed; keeping original text")
        return (text or "").strip()


def preprocess_youtube_narration_text(
    text: str,
    scene_title: Optional[str] = None,
) -> str:
    """Keep script words only: drop [bracket] hints and optional title prefix."""
    original = text or ""
    try:
        processed_text = original.strip()
        processed_text = _BRACKET_STAGE_DIRECTION.sub("", processed_text)
        processed_text = re.sub(r"\s+", " ", processed_text).strip()
        processed_text = strip_youtube_scene_title_prefix(processed_text, scene_title)
        logger.info(
            "[YouTubeSceneAudio] Preprocessed narration input_len={} output_len={} stripped={}",
            len(original),
            len(processed_text),
            original.strip() != processed_text,
        )
        return processed_text
    except Exception:
        logger.exception(
            "[YouTubeSceneAudio] Preprocess failed; using trimmed original input_len={}",
            len(original),
        )
        return original.strip()


def estimate_youtube_speech_seconds(speech_text: str) -> int:
    """Spoken seconds at 150 WPM. Empty speech is 0."""
    try:
        words = [w for w in (speech_text or "").split() if w]
        if not words:
            return 0
        return max(1, round(len(words) * 60 / SPOKEN_WORDS_PER_MINUTE))
    except Exception:
        logger.exception("[YouTubeSceneAudio] Speech-second estimate failed")
        return 0


def youtube_scene_speech_clock(
    speech_text: str,
    duration_estimate: Any = None,
) -> Tuple[int, int]:
    """Return (WAN clip seconds, estimated speech seconds) and log a mismatch."""
    try:
        clip_seconds = resolve_youtube_scene_video_duration(duration_estimate)
        speech_seconds = estimate_youtube_speech_seconds(speech_text)
        word_count = len((speech_text or "").split())
        if speech_seconds > clip_seconds:
            logger.warning(
                "[YouTubeSceneAudio] Speech longer than WAN clip; "
                "attached audio will be truncated to the first clip seconds "
                "clip_seconds={} speech_seconds={} word_count={}",
                clip_seconds,
                speech_seconds,
                word_count,
            )
        else:
            logger.info(
                "[YouTubeSceneAudio] Speech clock ok clip_seconds={} speech_seconds={} word_count={}",
                clip_seconds,
                speech_seconds,
                word_count,
            )
        return clip_seconds, speech_seconds
    except Exception:
        logger.exception(
            "[YouTubeSceneAudio] Speech clock failed; defaulting clip_seconds={}",
            _DEFAULT_CLIP_SECONDS,
        )
        return _DEFAULT_CLIP_SECONDS, 0


def build_youtube_scene_audio_generation_metadata(
    *,
    input_text: str,
    speech_text: str,
    voice_id: str,
    emotion: str,
    language_boost: str,
    provider: str,
    model: str,
    target_clip_seconds: Optional[int] = None,
    estimated_speech_seconds: Optional[int] = None,
) -> Dict[str, Any]:
    """Return additive generation metadata for the scene audio API response."""
    try:
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
            "target_clip_seconds": target_clip_seconds,
            "estimated_speech_seconds": estimated_speech_seconds,
        }
        logger.info(
            "[YouTubeSceneAudio] Generation metadata built voice_id={} emotion={} "
            "language_boost={} input_len={} speech_len={} instructions_stripped={} "
            "clip_seconds={} speech_seconds={}",
            voice_id,
            emotion,
            language_boost,
            len(metadata["input_text"]),
            len(metadata["speech_text"]),
            metadata["instructions_stripped"],
            target_clip_seconds,
            estimated_speech_seconds,
        )
        return metadata
    except Exception:
        logger.exception("[YouTubeSceneAudio] Generation metadata build failed")
        return {
            "gateway": "wavespeed_minimax_speech",
            "provider": provider or "wavespeed",
            "model": model or "minimax/speech-02-hd",
            "input_text": input_text or "",
            "speech_text": speech_text or "",
            "voice_id": voice_id or "",
            "emotion": emotion or "",
            "language_boost": language_boost or "",
            "instructions_stripped": False,
            "target_clip_seconds": target_clip_seconds,
            "estimated_speech_seconds": estimated_speech_seconds,
        }
