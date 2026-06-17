"""LinkedIn audio narration services."""

from .linkedin_audio_service import LinkedInAudioService
from .linkedin_audio_storage import LinkedInAudioStorage
from .narration_builder import (
    build_narration_from_video_script,
    build_narration_text,
    estimate_spoken_duration_seconds,
    max_chars_for_duration,
)

__all__ = [
    "LinkedInAudioService",
    "LinkedInAudioStorage",
    "build_narration_text",
    "build_narration_from_video_script",
    "estimate_spoken_duration_seconds",
    "max_chars_for_duration",
]
