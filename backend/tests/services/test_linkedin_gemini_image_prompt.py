"""
Unit tests for LinkedIn Gemini 3 Pro Image prompt enhancements.

Covers only features added for gemini-3-pro-image cover prompts:
- Gemini cover brief path (allows on-image text)
- Photo-model path still uses no-text photography constraints
- Photographic WaveSpeed optimizer is skipped for Gemini only
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from services.linkedin.image_generation.linkedin_image_prompt_builder import (
    GEMINI_COVER_CONSTRAINTS,
    LINKEDIN_FEED_CONSTRAINTS,
    build_linkedin_selection_prompt,
    optimize_linkedin_prompt,
)


def _content_context(**overrides):
    base = {
        "topic": "GSC Brainstorm",
        "industry": "Manufacturing",
        "content": (
            "Stop guessing what your manufacturing peers care about on LinkedIn.\n\n"
            "Leveraging real search queries turns speculation into data-driven LinkedIn ideas."
        ),
        "style": "Auto",
        "content_type": "post",
    }
    base.update(overrides)
    return base


class TestGeminiCoverPromptPath:
    """Gemini model gets a cover/infographic-oriented brief."""

    def test_gemini_prompt_uses_cover_framing_and_post_body(self):
        prompt = build_linkedin_selection_prompt(
            user_prompt="short seed",
            content_context=_content_context(),
            aspect_ratio="1:1",
            style="Auto",
            model="gemini-3-pro-image",
        )

        assert "Create LinkedIn post cover image for below LinkedIn post -" in prompt
        assert "Stop guessing what your manufacturing peers care about" in prompt
        assert "Topic: GSC Brainstorm" in prompt
        assert "Industry: Manufacturing" in prompt
        assert "Aspect ratio: 1:1" in prompt
        for constraint in GEMINI_COVER_CONSTRAINTS:
            assert constraint in prompt

    def test_gemini_prompt_allows_on_image_text_not_photo_ban(self):
        prompt = build_linkedin_selection_prompt(
            user_prompt="seed",
            content_context=_content_context(),
            aspect_ratio="1:1",
            style="Auto",
            model="gemini-3-pro-image",
        )

        assert "Readable on-image headline" in prompt
        assert "No text, no logos, no watermarks" not in prompt
        assert "Professional business photography for LinkedIn feed" not in prompt

    def test_gemini_auto_style_uses_concept_driven_hint(self):
        prompt = build_linkedin_selection_prompt(
            user_prompt="seed",
            content_context=_content_context(),
            aspect_ratio="1:1",
            style="Auto",
            model="gemini-3-pro-image",
        )

        assert "Concept-driven LinkedIn cover" in prompt
        assert "not generic stock photography" in prompt

    def test_gemini_prefers_longer_user_cover_brief(self):
        long_cover = (
            "Create LinkedIn post cover image for below LinkedIn post -\n\n"
            + ("A" * 400)
        )
        prompt = build_linkedin_selection_prompt(
            user_prompt=long_cover,
            content_context=_content_context(content="short content"),
            aspect_ratio="16:9",
            style="Realistic",
            model="gemini-3-pro-image",
        )

        assert "A" * 50 in prompt
        assert "short content" not in prompt or long_cover in prompt


class TestPhotoModelPromptUnchanged:
    """Non-Gemini models keep photography / no-text constraints."""

    @patch(
        "services.linkedin.image_generation.linkedin_image_prompt_builder.get_model_recommendation",
        return_value=None,
    )
    @patch(
        "services.linkedin.image_generation.linkedin_image_prompt_builder.build_visual_summary",
        return_value="visual summary",
    )
    @patch(
        "services.linkedin.image_generation.linkedin_image_prompt_builder.extract_visual_data",
        return_value={},
    )
    def test_flux_keeps_no_text_photography_constraints(
        self, _extract, _summary, _hint
    ):
        prompt = build_linkedin_selection_prompt(
            user_prompt="Visual for LinkedIn post: short seed",
            content_context=_content_context(),
            aspect_ratio="1:1",
            style="Realistic",
            model="flux-kontext-pro",
        )

        assert "No text, no logos, no watermarks" in prompt
        assert "Professional business photography for LinkedIn feed" in prompt
        for constraint in LINKEDIN_FEED_CONSTRAINTS:
            assert constraint in prompt
        assert "Create LinkedIn post cover image for below LinkedIn post -" not in prompt
        assert "Readable on-image headline" not in prompt


class TestOptimizeLinkedInPromptGeminiSkip:
    """Photographic optimizer must not rewrite Gemini cover briefs."""

    @pytest.mark.anyio
    async def test_skips_optimizer_for_gemini(self):
        with patch(
            "services.linkedin.image_generation.linkedin_image_prompt_builder.enhance_image_prompt",
            new_callable=AsyncMock,
        ) as enhance:
            result = await optimize_linkedin_prompt(
                "cover brief",
                user_id="user-1",
                model="gemini-3-pro-image",
            )

        assert result == "cover brief"
        enhance.assert_not_called()

    @pytest.mark.anyio
    async def test_runs_optimizer_for_other_models(self):
        with patch(
            "services.linkedin.image_generation.linkedin_image_prompt_builder.enhance_image_prompt",
            new_callable=AsyncMock,
            return_value="optimized photo prompt",
        ) as enhance:
            result = await optimize_linkedin_prompt(
                "structured photo prompt",
                user_id="user-1",
                model="flux-kontext-pro",
            )

        assert result == "optimized photo prompt"
        enhance.assert_awaited_once()
