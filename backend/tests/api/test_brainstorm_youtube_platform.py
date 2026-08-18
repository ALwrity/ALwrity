"""Tests for brainstorm /ideas platform prompt paths (Phase 5 / #382).

Verifies LinkedIn default prompts stay LinkedIn-shaped and YouTube platform
uses video-idea language without LinkedIn post angles.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


class TestIdeasPromptBuilders:
    def test_linkedin_prompt_contains_linkedin_language(self):
        from services.brainstorm.ideas_prompt_builders import build_linkedin_ideas_prompts

        sys_prompt, user_prompt = build_linkedin_ideas_prompts(
            seed="AI leadership",
            count=5,
            sources_block="1. Example source",
        )
        assert "LinkedIn" in sys_prompt
        assert "LinkedIn post angles" in user_prompt
        assert "YouTube video ideas" not in user_prompt

    def test_youtube_prompt_contains_video_language_not_linkedin_posts(self):
        from services.brainstorm.ideas_prompt_builders import build_youtube_ideas_prompts

        sys_prompt, user_prompt = build_youtube_ideas_prompts(
            seed="Budget travel Japan",
            count=5,
            sources_block="1. Example source",
            channel_bible_context="<youtube_channel_bible>\n- Niche: travel\n</youtube_channel_bible>",
        )
        assert "YouTube" in sys_prompt
        assert "YouTube video ideas" in user_prompt
        assert "Generate exactly 5 LinkedIn post angles" not in user_prompt
        assert "CHANNEL BIBLE CONTEXT" in user_prompt
        assert "travel" in user_prompt

    def test_youtube_prompt_omits_bible_block_when_empty(self):
        from services.brainstorm.ideas_prompt_builders import build_youtube_ideas_prompts

        _, user_prompt = build_youtube_ideas_prompts(
            seed="Cooking tips",
            count=3,
            sources_block="(no web sources found)",
            channel_bible_context="   ",
        )
        assert "CHANNEL BIBLE CONTEXT" not in user_prompt

    def test_youtube_prompt_includes_optional_context_blocks(self):
        from services.brainstorm.ideas_prompt_builders import build_youtube_ideas_prompts

        _, user_prompt = build_youtube_ideas_prompts(
            seed="Cooking tips",
            count=3,
            sources_block="1. Example",
            trending_context="YOUTUBE TRENDING SIGNALS:\n- Rising query: pasta",
            repurpose_context="SAVED YOUTUBE IDEAS:\n- Old idea",
        )
        assert "YOUTUBE TRENDING SIGNALS" in user_prompt
        assert "SAVED YOUTUBE IDEAS" in user_prompt

    def test_normalize_platform_defaults_to_linkedin(self):
        from services.brainstorm.ideas_prompt_builders import normalize_platform

        assert normalize_platform(None) == "linkedin"
        assert normalize_platform("") == "linkedin"
        assert normalize_platform("  YouTube ") == "youtube"


class TestBrainstormIdeasPlatformRoute:
    @pytest.mark.asyncio
    async def test_invalid_platform_returns_400(self):
        from api.brainstorm import IdeasRequest, generate_brainstorm_ideas

        req = IdeasRequest(seed="test topic", platform="tiktok", count=5)
        with pytest.raises(HTTPException) as exc_info:
            await generate_brainstorm_ideas(req, current_user=None)
        assert exc_info.value.status_code == 400
        assert "Invalid platform" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_default_platform_uses_linkedin_prompt_builder(self):
        from api.brainstorm import IdeaItem, IdeasRequest, generate_brainstorm_ideas

        fake_ideas = [
            IdeaItem(prompt="Angle 1", rationale="r", evidence=None),
            IdeaItem(prompt="Angle 2", rationale="r", evidence=None),
            IdeaItem(prompt="Angle 3", rationale="r", evidence=None),
        ]

        with patch("api.brainstorm.search_exa", new_callable=AsyncMock) as search, \
             patch("api.brainstorm.llm_text_gen", return_value={"ideas": []}) as llm, \
             patch("api.brainstorm._parse_llm_ideas", return_value=fake_ideas), \
             patch("api.brainstorm.build_linkedin_ideas_prompts") as linkedin_builder, \
             patch("api.brainstorm.build_youtube_ideas_prompts") as youtube_builder:
            search.return_value = ([{"title": "t", "url": "https://x", "snippet": "s"}], "1. t")
            linkedin_builder.return_value = ("sys", "Generate LinkedIn post angles")
            req = IdeasRequest(seed="leadership", count=5)
            result = await generate_brainstorm_ideas(req, current_user={"id": "u1"})
            linkedin_builder.assert_called_once()
            youtube_builder.assert_not_called()
            llm.assert_called_once()
            assert len(result.ideas) == 3

    @pytest.mark.asyncio
    async def test_youtube_platform_uses_youtube_prompt_builder(self):
        from api.brainstorm import IdeaItem, IdeasRequest, generate_brainstorm_ideas

        fake_ideas = [
            IdeaItem(prompt="Video idea 1", rationale="r", evidence=None),
            IdeaItem(prompt="Video idea 2", rationale="r", evidence=None),
            IdeaItem(prompt="Video idea 3", rationale="r", evidence=None),
        ]
        bible = "<youtube_channel_bible>\n- Niche: cooking\n</youtube_channel_bible>"

        with patch("api.brainstorm.search_exa", new_callable=AsyncMock) as search, \
             patch("api.brainstorm.llm_text_gen", return_value={"ideas": []}) as llm, \
             patch("api.brainstorm._parse_llm_ideas", return_value=fake_ideas), \
             patch("api.brainstorm.build_linkedin_ideas_prompts") as linkedin_builder, \
             patch("api.brainstorm.build_youtube_ideas_prompts") as youtube_builder:
            search.return_value = ([], "")
            youtube_builder.return_value = ("sys", "Generate YouTube video ideas")
            req = IdeasRequest(
                seed="pasta tips",
                count=5,
                platform="youtube",
                channel_bible_context=bible,
            )
            result = await generate_brainstorm_ideas(req, current_user={"id": "u1"})
            youtube_builder.assert_called_once()
            kwargs = youtube_builder.call_args.kwargs
            assert kwargs.get("channel_bible_context") == bible
            linkedin_builder.assert_not_called()
            assert llm.call_args.kwargs["system_prompt"] == "sys"
            assert "YouTube video ideas" in llm.call_args.kwargs["prompt"]
            assert len(result.ideas) == 3

    @pytest.mark.asyncio
    async def test_youtube_platform_passes_trending_and_repurpose_flags(self):
        from api.brainstorm import IdeaItem, IdeasRequest, generate_brainstorm_ideas

        fake_ideas = [
            IdeaItem(prompt="Video idea 1", rationale="r", evidence=None),
            IdeaItem(prompt="Video idea 2", rationale="r", evidence=None),
            IdeaItem(prompt="Video idea 3", rationale="r", evidence=None),
        ]

        with patch("api.brainstorm.search_exa", new_callable=AsyncMock) as search, \
             patch("api.brainstorm.llm_text_gen", return_value={"ideas": []}), \
             patch("api.brainstorm._parse_llm_ideas", return_value=fake_ideas), \
             patch("api.brainstorm.fetch_youtube_trends_context", new_callable=AsyncMock) as trends, \
             patch("api.brainstorm.fetch_youtube_saved_ideas_context") as repurpose, \
             patch("api.brainstorm.build_youtube_ideas_prompts") as youtube_builder:
            search.return_value = ([], "")
            trends.return_value = "YOUTUBE TRENDING SIGNALS:\n- Rising query: travel"
            repurpose.return_value = "SAVED YOUTUBE IDEAS:\n- Saved angle"
            youtube_builder.return_value = ("sys", "prompt")

            req = IdeasRequest(
                seed="travel tips",
                count=5,
                platform="youtube",
                include_trending=True,
                include_repurpose=True,
            )
            await generate_brainstorm_ideas(req, current_user={"id": "u1"})

            trends.assert_awaited_once()
            repurpose.assert_called_once()
            kwargs = youtube_builder.call_args.kwargs
            assert "YOUTUBE TRENDING SIGNALS" in kwargs.get("trending_context", "")
            assert "SAVED YOUTUBE IDEAS" in kwargs.get("repurpose_context", "")
