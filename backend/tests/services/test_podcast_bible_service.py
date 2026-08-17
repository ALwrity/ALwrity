"""Tests for PodcastBibleService.get_or_build_bible (Phase 4 persona consumption).

Verifies the priority order: explicit request bible > podcast persona > preferences
fallback, and that persona seeding produces a serializable, brand-grounded bible.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _request_bible(**overrides) -> dict:
    bible = {
        "project_id": "proj1",
        "host": {"name": "Given Host", "background": "b", "expertise_level": "Expert", "vocal_style": "v"},
        "audience": {"expertise_level": "Intermediate"},
        "brand": {"industry": "Tech", "tone": "Professional", "communication_style": "Conversational"},
        "visual_style": {"environment": "studio"},
        "audio_environment": {},
        "show_rules": {"intro_format": "i", "outro_format": "o"},
    }
    bible.update(overrides)
    return bible


class TestGetOrBuildBible:
    def test_request_bible_wins(self):
        from services.podcast_bible_service import PodcastBibleService

        svc = PodcastBibleService()
        bible, ctx = svc.get_or_build_bible("u1", _request_bible(), "temp")

        assert bible.host.name == "Given Host"
        assert bible.brand.industry == "Tech"
        assert "Given Host" in ctx

    def test_persona_seeds_when_no_request_bible(self):
        from services.podcast_bible_service import PodcastBibleService

        svc = PodcastBibleService()
        persona = {"host": {"name": "Persona Host", "background": "b", "expertise_level": "Expert", "vocal_style": "warm"}}

        with patch("services.persona_data_service.PersonaDataService") as pds:
            pds.return_value.get_platform_persona.return_value = {
                "platform_persona": persona,
                "core_persona": {"identity": {"industry": "Media"}},
            }
            bible, ctx = svc.get_or_build_bible("u1", None, "temp")

        assert bible.host.name == "Persona Host"
        assert bible.brand.industry == "Media"
        assert "Persona Host" in ctx

    def test_generate_bible_fallback_when_no_persona(self):
        from services.podcast_bible_service import PodcastBibleService

        svc = PodcastBibleService()
        default = svc._get_default_bible("temp:u1")

        with patch("services.persona_data_service.PersonaDataService") as pds, \
             patch.object(svc, "generate_bible", return_value=default) as gen:
            pds.return_value.get_platform_persona.return_value = None
            bible, ctx = svc.get_or_build_bible("u1", None, "temp")

        gen.assert_called_once_with("u1", "temp:u1")
        assert bible.host.name == "AI Host"

    def test_persona_load_error_falls_back(self):
        from services.podcast_bible_service import PodcastBibleService

        svc = PodcastBibleService()
        default = svc._get_default_bible("temp:u1")

        with patch("services.persona_data_service.PersonaDataService") as pds, \
             patch.object(svc, "generate_bible", return_value=default) as gen:
            pds.return_value.get_platform_persona.side_effect = RuntimeError("db down")
            bible, _ = svc.get_or_build_bible("u1", None, "temp")

        gen.assert_called_once()
        assert bible.host.name == "AI Host"
