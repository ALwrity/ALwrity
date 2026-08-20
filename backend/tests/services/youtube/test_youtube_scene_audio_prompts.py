"""Tests for YouTube scene audio prompt preprocessing and metadata."""

from __future__ import annotations

import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


class TestYoutubeSceneAudioPrompts:
    def test_preprocess_strips_instruction_markers(self):
        from services.youtube.youtube_scene_audio_prompts import preprocess_youtube_narration_text

        raw = "Hello world [Pacing: slow, energetic] more text"
        processed = preprocess_youtube_narration_text(raw)

        assert "[Pacing:" not in processed
        assert "Hello world" in processed
        assert "more text" in processed

    def test_build_generation_metadata(self):
        from services.youtube.youtube_scene_audio_prompts import (
            build_youtube_scene_audio_generation_metadata,
        )

        metadata = build_youtube_scene_audio_generation_metadata(
            input_text="Hello [Pacing: slow]",
            speech_text="Hello",
            voice_id="Casual_Guy",
            emotion="happy",
            language_boost="English",
            provider="wavespeed",
            model="minimax/speech-02-hd",
        )

        assert metadata["speech_text"] == "Hello"
        assert metadata["voice_id"] == "Casual_Guy"
        assert metadata["instructions_stripped"] is True
