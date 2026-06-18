"""LinkedIn audio narration services."""

from __future__ import annotations

from typing import TYPE_CHECKING

__all__ = [
    "LinkedInAudioService",
    "LinkedInAudioStorage",
    "build_narration_text",
    "build_narration_from_video_script",
    "estimate_spoken_duration_seconds",
    "max_chars_for_duration",
]

if TYPE_CHECKING:
    from .linkedin_audio_service import LinkedInAudioService
    from .linkedin_audio_storage import LinkedInAudioStorage
    from .narration_builder import (
        build_narration_from_video_script,
        build_narration_text,
        estimate_spoken_duration_seconds,
        max_chars_for_duration,
    )


def __getattr__(name: str):
    if name == "LinkedInAudioService":
        from .linkedin_audio_service import LinkedInAudioService

        return LinkedInAudioService
    if name == "LinkedInAudioStorage":
        from .linkedin_audio_storage import LinkedInAudioStorage

        return LinkedInAudioStorage
    if name == "build_narration_text":
        from .narration_builder import build_narration_text

        return build_narration_text
    if name == "build_narration_from_video_script":
        from .narration_builder import build_narration_from_video_script

        return build_narration_from_video_script
    if name == "estimate_spoken_duration_seconds":
        from .narration_builder import estimate_spoken_duration_seconds

        return estimate_spoken_duration_seconds
    if name == "max_chars_for_duration":
        from .narration_builder import max_chars_for_duration

        return max_chars_for_duration
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
