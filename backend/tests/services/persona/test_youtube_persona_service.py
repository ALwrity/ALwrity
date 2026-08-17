"""Tests for the YouTube persona service."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

MOD = "services.persona.youtube.youtube_persona_service"


class TestYouTubeSchema:
    def test_schema_has_required_fields(self):
        from services.persona.youtube.youtube_persona_service import YouTubePersonaService

        schema = YouTubePersonaService()._get_youtube_schema()
        assert schema["type"] == "object"
        assert set(schema["required"]) >= {
            "persona_name", "archetype", "tone_and_pacing", "script_structure", "visual_style", "prompt_defaults",
        }
        props = schema["properties"]
        assert "prompt_defaults" in props
        pd = props["prompt_defaults"]["properties"]
        assert set(pd.keys()) == {"image_base_prompt", "video_base_prompt", "negative_prompt"}
        assert "visual_style" in props
        assert "color_palette" in props["visual_style"]["properties"]


class TestBuildPromptContext:
    def test_empty_inputs(self):
        from services.persona.youtube.youtube_persona_service import YouTubePersonaService

        assert YouTubePersonaService.build_prompt_context(None) == ""
        assert YouTubePersonaService.build_prompt_context({}) == ""
        assert YouTubePersonaService.build_prompt_context("not-a-dict") == ""

    def test_renders_all_schema_sections(self):
        from services.persona.youtube.youtube_persona_service import YouTubePersonaService

        persona = {
            "persona_name": "The Fast Explainer",
            "archetype": "Educator",
            "core_belief": "Clarity first",
            "tone_and_pacing": {
                "default_tone": "energetic",
                "pace": "fast",
                "energy_level": "high",
                "delivery_style": "direct-to-camera",
            },
            "script_structure": {
                "hook_style": "bold claim",
                "intro_format": "promise",
                "body_structure": "3 steps",
                "cta_style": "subscribe",
            },
            "visual_style": {
                "color_palette": ["#fff", "#000"],
                "thumbnail_style": "bold text",
                "on_screen_text": "minimal",
                "b_roll": "stock",
                "camera_framing": "close-up",
            },
            "title_description": {
                "title_strategy": "curiosity",
                "description_strategy": "SEO",
                "seo_keywords": ["tips", "howto"],
            },
            "target_audience": {
                "expertise_level": "beginner",
                "interests": ["tech"],
                "pain_points": ["confusion"],
            },
            "engagement": {
                "call_to_action": "like & subscribe",
                "engagement_prompts": ["comment"],
            },
            "prompt_defaults": {
                "image_base_prompt": "brand colors",
                "video_base_prompt": "brand motion",
                "negative_prompt": "no text",
            },
        }

        out = YouTubePersonaService.build_prompt_context(persona)

        assert "The Fast Explainer" in out
        assert "energetic" in out
        assert "bold claim" in out
        assert "#fff" in out
        assert "curiosity" in out
        assert "beginner" in out
        assert "like & subscribe" in out
        assert "brand colors" in out
        assert "Image base prompt" in out
        assert "Negative prompt" in out

    def test_partial_persona_no_crash(self):
        from services.persona.youtube.youtube_persona_service import YouTubePersonaService

        out = YouTubePersonaService.build_prompt_context({"persona_name": "Only a name"})
        assert "Only a name" in out
        assert "Persona Context" in out


class TestGenerateYouTubePersona:
    def test_success_returns_persona(self):
        from services.persona.youtube.youtube_persona_service import YouTubePersonaService

        fake = {"persona_name": "X", "archetype": "Y", "prompt_defaults": {"image_base_prompt": "brand colors"}}
        with patch(f"{MOD}.llm_text_gen", return_value=fake) as gen:
            result = YouTubePersonaService().generate_youtube_persona({"identity": {}}, {"session_info": {"user_id": "u1"}})

        assert result == fake
        gen.assert_called_once()
        kwargs = gen.call_args.kwargs
        assert kwargs["flow_type"] == "youtube_persona_generation"
        assert kwargs["user_id"] == "u1"

    def test_llm_error_returns_error_dict(self):
        from services.persona.youtube.youtube_persona_service import YouTubePersonaService

        with patch(f"{MOD}.llm_text_gen", return_value={"error": "boom"}):
            result = YouTubePersonaService().generate_youtube_persona({"identity": {}}, {})

        assert "error" in result

    def test_exception_returns_error_dict(self):
        from services.persona.youtube.youtube_persona_service import YouTubePersonaService

        with patch(f"{MOD}.llm_text_gen", side_effect=RuntimeError("network")):
            result = YouTubePersonaService().generate_youtube_persona({"identity": {}}, {})

        assert "error" in result
