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

    def test_preprocess_strips_speak_at_and_title_prefix(self):
        from services.youtube.youtube_scene_audio_prompts import preprocess_youtube_narration_text

        raw = (
            "Hook. Open with a question. "
            "[Speak at a natural, conversational pace] [speak with energy and excitement]"
        )
        processed = preprocess_youtube_narration_text(raw, scene_title="Hook")

        assert processed == "Open with a question."
        assert "[" not in processed
        assert not processed.startswith("Hook.")

    def test_speech_clock_uses_wan_five_or_ten(self):
        from services.youtube.youtube_scene_audio_prompts import youtube_scene_speech_clock

        twelve_words = "one two three four five six seven eight nine ten eleven twelve"
        clip, spoken = youtube_scene_speech_clock(twelve_words, duration_estimate=5)
        assert clip == 5
        assert spoken == 5

        clip_long, _ = youtube_scene_speech_clock(twelve_words, duration_estimate=8)
        assert clip_long == 10

    def test_speech_clock_does_not_raise_on_bad_duration(self):
        from services.youtube.youtube_scene_audio_prompts import youtube_scene_speech_clock

        clip, spoken = youtube_scene_speech_clock("hello world", duration_estimate="not-a-number")
        assert clip in (5, 10)
        assert spoken >= 0

    def test_preprocess_never_raises(self):
        from services.youtube.youtube_scene_audio_prompts import preprocess_youtube_narration_text

        assert preprocess_youtube_narration_text(None) == ""  # type: ignore[arg-type]

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
