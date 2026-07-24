"""Unit tests for anime bible integration in story writer services.

Tests the two pure functions that cross-reference the anime story bible
with scene content — no network, no DB, no LLM calls required.
"""

import pytest

# Install LLM image stubs before any story_writer import.
# The story_writer service chain imports services.llm_providers.main_image_generation
# at module level, which requires generate_image to exist.
from tests.framework.service_stubs import install_llm_image_stubs

install_llm_image_stubs()

from services.story_writer.image_generation_service import StoryImageGenerationService
from services.story_writer.service_components.story_content import _build_bible_context_for_scene


# ---------------------------------------------------------------------------
# Shared test data
# ---------------------------------------------------------------------------

FULL_BIBLE = {
    "visual_style": {
        "style_preset": "cyberpunk noir",
        "camera_style": "dynamic dutch angles",
        "color_mood": "dark and gritty",
        "lighting": "neon backlighting",
        "line_style": "sharp and angular",
        "extra_tags": ["rain", "smoke", "hologram", "glitch"],
    },
    "world": {
        "setting": "Neo-Tokyo 2089",
        "core_rules": [
            "all technology is organic",
            "no sunlight reaches street level",
            "aerial police drones patrol every 5 minutes",
        ],
    },
    "main_cast": [
        {
            "name": "Kai",
            "role": "protagonist",
            "look": "tall, scarred, cybernetic left arm",
            "outfit_palette": "black trench coat, neon-trimmed collar",
            "personality_tags": ["brooding", "determined"],
            "age_range": "late 20s",
        },
        {
            "name": "Mira",
            "role": "deuteragonist",
            "look": "petite, silver hair, augmented optical implants",
            "outfit_palette": "white tactical vest, holographic visor",
            "personality_tags": ["analytical", "sardonic"],
            "age_range": "mid 20s",
        },
        {
            "name": "Zero",
            "role": "antagonist",
            "look": "gaunt, black sclera, full-body synthetic plating",
            "outfit_palette": "matte black armor, red energy conduits",
            "personality_tags": ["cold", "nihilistic"],
            "age_range": "unknown",
        },
    ],
}

MINIMAL_BIBLE = {
    "visual_style": {"style_preset": "watercolor dreamscape"},
}


# ==========================================================================
# _refine_image_prompt_with_bible
# ==========================================================================

class TestRefineImagePromptWithBible:
    """Tests for StoryImageGenerationService._refine_image_prompt_with_bible."""

    @staticmethod
    def _call(  # noqa: D417
        image_prompt: str,
        scene: dict | None = None,
        anime_bible: dict | None = None,
    ) -> str:
        service = StoryImageGenerationService()
        return service._refine_image_prompt_with_bible(  # type: ignore[attr-defined]
            image_prompt,
            scene or {},
            anime_bible,
        )

    # -- guard conditions -------------------------------------------------

    def test_returns_original_when_no_bible(self):
        result = self._call("a cat in a hat", anime_bible=None)
        assert result == "a cat in a hat"

    def test_returns_original_when_bible_is_not_a_dict(self):
        result = self._call("a cat in a hat", anime_bible="not-a-dict")
        assert result == "a cat in a hat"

    def test_returns_original_when_prompt_is_empty_string(self):
        result = self._call("", anime_bible=FULL_BIBLE)
        assert result == ""

    def test_returns_original_when_prompt_is_not_a_string(self):
        result = self._call(42, anime_bible=FULL_BIBLE)  # type: ignore[arg-type]
        assert result == 42

    # -- basic enrichment -------------------------------------------------

    def test_appends_style_preset(self):
        result = self._call(
            "a battle scene",
            anime_bible=FULL_BIBLE,
        )
        assert "cyberpunk noir anime illustration style" in result
        assert result.startswith("a battle scene")

    def test_appends_world_setting(self):
        result = self._call(
            "a battle scene",
            anime_bible=FULL_BIBLE,
        )
        assert "world setting: Neo-Tokyo 2089" in result

    def test_appends_character_consistency_anchor(self):
        result = self._call(
            "a battle scene",
            anime_bible=FULL_BIBLE,
        )
        assert "keep character designs consistent for: Kai, Mira, Zero" in result

    # -- character detail injection ---------------------------------------

    def test_injects_character_details_when_scene_mentions_character(self):
        result = self._call(
            "a battle scene",
            scene={"character_descriptions": ["Kai the hacker confronts his past"]},
            anime_bible=FULL_BIBLE,
        )
        assert "Kai (look: tall, scarred, cybernetic left arm, outfit: black trench coat, neon-trimmed collar)" in result

    def test_does_not_inject_character_without_visual_details(self):
        """If a character has no look/outfit, they should not contribute a per-character part."""
        result = self._call(
            "Mira studies the data feed",
            scene={"character_descriptions": ["Mira is a hacker"]},
            anime_bible={
                "main_cast": [
                    {"name": "Mira", "role": "hacker"},
                ]
            },
        )
        # Mira should NOT appear as a per-character detail because she has no look/outfit
        assert "Mira (look:" not in result

    def test_case_insensitive_character_matching(self):
        result = self._call(
            "a quiet moment",
            scene={"character_descriptions": ["kai watches the rain"]},
            anime_bible=FULL_BIBLE,
        )
        assert "Kai (look:" in result

    # -- minimal bible ----------------------------------------------------

    def test_minimal_bible_only_produces_style(self):
        result = self._call(
            "a dream sequence",
            anime_bible=MINIMAL_BIBLE,
        )
        assert "watercolor dreamscape anime illustration style" in result
        assert "world setting:" not in result
        assert "keep character designs consistent for:" not in result

    # -- no scene characters ----------------------------------------------

    def test_empty_scene_still_enriches_style_and_world(self):
        result = self._call(
            "a landscape shot",
            scene={},
            anime_bible=FULL_BIBLE,
        )
        assert "cyberpunk noir anime illustration style" in result
        assert "world setting: Neo-Tokyo 2089" in result

    # -- existing prompt quality ------------------------------------------

    def test_original_prompt_is_stripped_and_preserved(self):
        result = self._call(
            "  a moody alleyway at night  ",
            anime_bible=FULL_BIBLE,
        )
        # original text is the first thing in the output (not duplicated)
        assert result.startswith("a moody alleyway at night,")


# ==========================================================================
# _build_bible_context_for_scene
# ==========================================================================

class TestBuildBibleContextForScene:
    """Tests for the module-level _build_bible_context_for_scene."""

    # -- guard conditions -------------------------------------------------

    def test_returns_empty_string_when_no_bible(self):
        result = _build_bible_context_for_scene(
            ["Kai is a lone wolf"], None,
        )
        assert result == ""

    def test_returns_empty_string_when_no_descriptions(self):
        result = _build_bible_context_for_scene(
            [], FULL_BIBLE,
        )
        assert result == ""

    def test_returns_empty_string_when_bible_has_no_cast(self):
        result = _build_bible_context_for_scene(
            ["someone appears"], {"main_cast": []},
        )
        assert result == ""

    # -- matched characters -----------------------------------------------

    def test_matched_character_includes_full_bible_entry(self):
        descs = ["Kai steps into the neon rain"]
        result = _build_bible_context_for_scene(descs, FULL_BIBLE)
        assert "• Scene description: Kai steps into the neon rain" in result
        assert "Bible entry for Kai:" in result
        assert "- Role: protagonist" in result
        assert "- Look: tall, scarred, cybernetic left arm" in result
        assert "- Outfit palette: black trench coat, neon-trimmed collar" in result
        assert "- Personality: brooding, determined" in result
        assert "- Age: late 20s" in result

    def test_case_insensitive_name_matching(self):
        descs = ["kai walks home"]
        result = _build_bible_context_for_scene(descs, FULL_BIBLE)
        assert "Bible entry for Kai:" in result

    def test_unmatched_description_passed_through(self):
        descs = ["an unknown stranger watches from the shadows"]
        result = _build_bible_context_for_scene(descs, FULL_BIBLE)
        assert "• an unknown stranger watches from the shadows" in result
        assert "Bible entry for" not in result

    def test_mixed_matched_and_unmatched(self):
        descs = ["Kai draws his weapon", "a mysterious figure retreats"]
        result = _build_bible_context_for_scene(descs, FULL_BIBLE)
        fragments = result.split("\n\n")
        assert len(fragments) == 2
        assert "Bible entry for Kai:" in fragments[0]
        assert "Bible entry for" not in fragments[1]

    # -- partial bible entries --------------------------------------------

    def test_character_with_minimal_entry(self):
        descs = ["Vex challenges the council"]
        bible = {
            "main_cast": [
                {"name": "Vex", "role": "council head"},
            ]
        }
        result = _build_bible_context_for_scene(descs, bible)
        assert "Bible entry for Vex:" in result
        assert "- Role: council head" in result
        assert "- Look:" not in result
        assert "- Age:" not in result

    # -- multiple characters ----------------------------------------------

    def test_first_matching_cast_member_wins(self):
        """If two cast members share a substring in their name, only the
        first match is used (short-circuit on break)."""
        bible = {
            "main_cast": [
                {"name": "Alex", "look": "first match", "role": "a"},
                {"name": "Alexa", "look": "second match", "role": "b"},
            ]
        }
        descs = ["Alexa enters the room"]
        result = _build_bible_context_for_scene(descs, bible)
        # "Alex" matches "Alexa" (substring) and comes first in the list
        assert "Bible entry for Alex:" in result
        assert "- Look: first match" in result
