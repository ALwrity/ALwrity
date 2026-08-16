"""Tests for the podcast persona service."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

MOD = "services.persona.podcast.podcast_persona_service"


class TestPodcastSchema:
    def test_schema_has_required_fields(self):
        from services.persona.podcast.podcast_persona_service import PodcastPersonaService

        schema = PodcastPersonaService()._get_podcast_schema()
        assert schema["type"] == "object"
        assert set(schema["required"]) >= {
            "persona_name", "archetype", "host", "visual_style", "audio_environment", "show_rules", "prompt_defaults",
        }
        props = schema["properties"]
        assert "prompt_defaults" in props
        pd = props["prompt_defaults"]["properties"]
        assert set(pd.keys()) == {"host_image_prompt", "studio_prompt", "negative_prompt"}
        assert "host" in props
        assert "vocal_style" in props["host"]["properties"]
        assert "audio_environment" in props


class TestToPodcastBible:
    def test_invalid_input_returns_none(self):
        from services.persona.podcast.podcast_persona_service import PodcastPersonaService

        assert PodcastPersonaService.to_podcast_bible(None) is None
        assert PodcastPersonaService.to_podcast_bible({}) is None
        assert PodcastPersonaService.to_podcast_bible("not-a-dict") is None

    def test_maps_full_persona(self):
        from services.persona.podcast.podcast_persona_service import PodcastPersonaService

        persona = {
            "persona_name": "The Warm Host",
            "host": {
                "name": "Alex",
                "background": "20 years in SaaS",
                "expertise_level": "Expert",
                "vocal_style": "warm and authoritative",
                "personality_traits": ["curious", "direct"],
                "look": "business-casual",
                "catchphrases": ["Let's dig in"],
            },
            "visual_style": {
                "style_preset": "Cinematic",
                "environment": "modern studio",
                "lighting": "soft",
                "color_palette": ["#111", "#222"],
                "camera_style": "mid-shot",
            },
            "audio_environment": {"soundscape": "quiet", "music_mood": "upbeat", "sfx_style": "minimal"},
            "show_rules": {
                "intro_format": "hook first",
                "outro_format": "summary",
                "interaction_tone": "conversational",
                "constraints": ["no jargon"],
            },
            "audience": {"expertise_level": "Intermediate", "interests": ["AI"], "pain_points": ["complexity"]},
            "brand": {"tone": "Professional", "communication_style": "Storytelling", "key_messages": ["clarity"]},
        }

        bible = PodcastPersonaService.to_podcast_bible(
            persona, project_id="p1", core_persona={"identity": {"industry": "B2B SaaS"}}
        )

        assert bible is not None
        assert bible.project_id == "p1"
        assert bible.host.name == "Alex"
        assert bible.host.vocal_style == "warm and authoritative"
        assert bible.host.catchphrases == ["Let's dig in"]
        assert bible.visual_style.style_preset == "Cinematic"
        assert bible.visual_style.color_palette == ["#111", "#222"]
        assert bible.audio_environment.music_mood == "upbeat"
        assert bible.show_rules.constraints == ["no jargon"]
        assert bible.audience.expertise_level == "Intermediate"
        assert bible.brand.tone == "Professional"
        assert bible.brand.industry == "B2B SaaS"

    def test_industry_falls_back_when_missing(self):
        from services.persona.podcast.podcast_persona_service import PodcastPersonaService

        bible = PodcastPersonaService.to_podcast_bible({"host": {}}, project_id="p")
        assert bible.brand.industry == "General Business"

    def test_missing_fields_default(self):
        from services.persona.podcast.podcast_persona_service import PodcastPersonaService

        bible = PodcastPersonaService.to_podcast_bible({"host": {}}, project_id="p")
        assert bible.host.name == "AI Host"
        assert bible.host.expertise_level == "Expert"
        assert bible.host.vocal_style == "Authoritative"
        assert bible.visual_style.style_preset == "Professional Studio"


class TestGeneratePodcastPersona:
    def test_success_returns_persona(self):
        from services.persona.podcast.podcast_persona_service import PodcastPersonaService

        fake = {"persona_name": "X", "archetype": "Y", "host": {"name": "Alex"}, "prompt_defaults": {"host_image_prompt": "brand"}}
        with patch(f"{MOD}.llm_text_gen", return_value=fake) as gen:
            result = PodcastPersonaService().generate_podcast_persona({"identity": {}}, {"session_info": {"user_id": "u1"}})

        assert result == fake
        gen.assert_called_once()
        kwargs = gen.call_args.kwargs
        assert kwargs["flow_type"] == "podcast_persona_generation"
        assert kwargs["user_id"] == "u1"

    def test_llm_error_returns_error_dict(self):
        from services.persona.podcast.podcast_persona_service import PodcastPersonaService

        with patch(f"{MOD}.llm_text_gen", return_value={"error": "boom"}):
            result = PodcastPersonaService().generate_podcast_persona({"identity": {}}, {})

        assert "error" in result

    def test_exception_returns_error_dict(self):
        from services.persona.podcast.podcast_persona_service import PodcastPersonaService

        with patch(f"{MOD}.llm_text_gen", side_effect=RuntimeError("network")):
            result = PodcastPersonaService().generate_podcast_persona({"identity": {}}, {})

        assert "error" in result
