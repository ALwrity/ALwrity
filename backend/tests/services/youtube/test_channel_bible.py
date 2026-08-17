"""Tests for YouTube Channel Bible seed, serialize, and plan-input apply."""

from __future__ import annotations

import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


class TestSeedFromPreferences:
    def test_empty_prefs_returns_empty_strings_not_mock_niche(self):
        from services.youtube.channel_bible import seed_from_preferences

        profile = seed_from_preferences(None)
        assert profile.niche == ""
        assert profile.target_audience == ""
        assert profile.brand_style == ""
        assert profile.default_cta == ""
        assert profile.default_video_goal == ""
        assert profile.default_avatar_url is None
        assert "youtube" not in profile.niche.lower()
        assert "millennial" not in profile.niche.lower()

        profile_empty = seed_from_preferences({})
        assert profile_empty.niche == ""

    def test_industry_maps_to_niche(self):
        from services.youtube.channel_bible import seed_from_preferences

        profile = seed_from_preferences(
            {
                "industry": "Sustainable travel",
                "target_audience": {
                    "interests": ["budget trips"],
                    "demographics": ["25-40"],
                },
                "writing_style": {"tone": "warm"},
                "style_preferences": {"aesthetic": "cinematic"},
                "brand_values": ["Travel lighter"],
            }
        )
        assert profile.niche == "Sustainable travel"
        assert "budget trips" in profile.target_audience
        assert "25-40" in profile.target_audience
        assert profile.tone == "warm"
        assert profile.brand_style == "cinematic"
        assert profile.default_cta == "Travel lighter"


class TestSerializeForPrompt:
    def test_empty_profile_returns_empty_string(self):
        from services.youtube.channel_bible import empty_bible, serialize_for_prompt

        assert serialize_for_prompt(empty_bible()) == ""
        assert serialize_for_prompt(None) == ""

    def test_niche_profile_includes_bible_block(self):
        from services.youtube.channel_bible import YouTubeChannelBible, serialize_for_prompt

        prompt = serialize_for_prompt(
            YouTubeChannelBible(niche="Budget travel", target_audience="", brand_style="", default_cta="")
        )
        assert "<youtube_channel_bible>" in prompt
        assert "</youtube_channel_bible>" in prompt
        assert "Budget travel" in prompt


class TestApplyToPlanInputs:
    def test_does_not_override_nonempty_audience(self):
        from services.youtube.channel_bible import YouTubeChannelBible, apply_to_plan_inputs

        profile = YouTubeChannelBible(target_audience="Bible audience", default_video_goal="Subscribe")
        filled = apply_to_plan_inputs(
            profile,
            target_audience="Typed in this session",
            video_goal="",
            brand_style=None,
            reference_image_description=None,
        )
        assert filled["target_audience"] == "Typed in this session"
        assert filled["video_goal"] == "Subscribe"
