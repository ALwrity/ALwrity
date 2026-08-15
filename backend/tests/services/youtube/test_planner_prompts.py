"""Tests for YouTube planner prompt source-article injection."""

from __future__ import annotations

import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _base_kwargs(**overrides):
    from services.youtube.planner_config import get_duration_context

    kwargs = {
        "user_idea": "Budget travel",
        "duration_type": "shorts",
        "video_type": None,
        "video_type_config": {},
        "duration_context": get_duration_context("shorts"),
        "default_audience": "Travelers",
        "default_goal": "Educate",
        "default_tone": "Friendly",
        "default_visual_style": "Clean",
        "brand_style": None,
        "target_audience": None,
        "video_goal": None,
        "persona_context": "",
        "persona_data": None,
        "source_content_id": None,
        "source_content_type": None,
        "reference_image_description": None,
        "research_context": "",
        "include_scenes": False,
    }
    kwargs.update(overrides)
    return kwargs


class TestSourceArticlePrompt:
    def test_no_article_fields_omits_source_article_block(self):
        from services.youtube.planner_prompts import build_planning_prompt

        prompt = build_planning_prompt(**_base_kwargs())
        assert "**Source Article:**" not in prompt

    def test_url_and_summary_are_included(self):
        from services.youtube.planner_prompts import build_planning_prompt

        prompt = build_planning_prompt(
            **_base_kwargs(
                source_article_url="https://example.com/bali-guide",
                source_article_title="Bali Guide",
                source_article_summary="Pack light and book early.",
            )
        )
        assert "**Source Article:**" in prompt
        assert "https://example.com/bali-guide" in prompt
        assert "Pack light and book early." in prompt
        assert "Plan the video from this article" in prompt

    def test_summary_longer_than_4000_is_truncated(self):
        from services.youtube.planner_prompts import build_planning_prompt

        long_summary = "A" * 4500
        prompt = build_planning_prompt(
            **_base_kwargs(
                source_article_url="https://example.com/long",
                source_article_summary=long_summary,
            )
        )
        assert "A" * 4000 in prompt
        assert "A" * 4001 not in prompt
