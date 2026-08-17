"""Tests for the persona platform registry (single source of truth)."""

from __future__ import annotations

import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from services.persona.platform_registry import (
    PERSONA_PLATFORMS,
    PLATFORM_CONSTRAINTS,
    get_platform_constraints,
    get_enabled_platforms,
    get_scheduled_platforms,
    get_platforms_payload,
)


class TestRegistryStructure:
    def test_nine_platforms(self):
        assert len(PERSONA_PLATFORMS) == 9

    def test_ids_unique(self):
        ids = [p["id"] for p in PERSONA_PLATFORMS]
        assert len(ids) == len(set(ids))

    def test_all_entries_have_required_fields(self):
        for p in PERSONA_PLATFORMS:
            assert set(p.keys()) == {"id", "name", "description", "enabled", "scheduled"}

    def test_seven_enabled(self):
        assert len(get_enabled_platforms()) == 7

    def test_enabled_ids(self):
        assert {p["id"] for p in get_enabled_platforms()} == {
            "linkedin", "blog", "facebook", "twitter", "instagram", "youtube", "podcast",
        }

    def test_five_scheduled(self):
        assert len(get_scheduled_platforms()) == 5

    def test_scheduled_ids(self):
        assert {p["id"] for p in get_scheduled_platforms()} == {
            "facebook", "twitter", "instagram", "youtube", "podcast",
        }

    def test_medium_and_substack_disabled(self):
        by_id = {p["id"]: p for p in PERSONA_PLATFORMS}
        assert by_id["medium"]["enabled"] is False
        assert by_id["substack"]["enabled"] is False
        assert by_id["medium"]["scheduled"] is False
        assert by_id["substack"]["scheduled"] is False


class TestConstraints:
    def test_static_constraints_cover_static_platforms(self):
        assert set(PLATFORM_CONSTRAINTS.keys()) == {
            "twitter", "instagram", "blog", "youtube", "podcast", "medium", "substack",
        }

    def test_service_platforms_not_in_static_table(self):
        assert "linkedin" not in PLATFORM_CONSTRAINTS
        assert "facebook" not in PLATFORM_CONSTRAINTS

    def test_twitter_constraints(self):
        assert get_platform_constraints("twitter")["character_limit"] == 280

    def test_youtube_constraints(self):
        assert get_platform_constraints("youtube")["script_structure"] == "Hook-Intro-Body-CTA"

    def test_podcast_constraints(self):
        c = get_platform_constraints("podcast")
        assert "episode_structure" in c
        assert "audio_optimization" in c
        assert "video_optimization" in c

    def test_unknown_platform_returns_empty(self):
        assert get_platform_constraints("unknown") == {}

    def test_linkedin_delegates_to_service(self):
        c = get_platform_constraints("linkedin")
        assert isinstance(c, dict)
        assert len(c) > 0

    def test_facebook_delegates_to_service(self):
        c = get_platform_constraints("facebook")
        assert isinstance(c, dict)
        assert len(c) > 0


class TestPayload:
    def test_payload_has_nine_entries(self):
        assert len(get_platforms_payload()) == 9

    def test_payload_shape(self):
        for entry in get_platforms_payload():
            assert set(entry.keys()) == {"id", "name", "description", "enabled", "scheduled"}
