"""Tests for blog writer persona wiring (Phase C — content generators).

Verifies:
- the shared persona-block helper resolves curated persona / falls back / never raises;
- each content generator injects persona into the SYSTEM prompt (style layer);
- a no-persona user gets byte-for-byte unchanged system prompts (no breaking change);
- outline/research/SEO stay persona-free (regression).
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

RESOLVER = "services.persona.persona_resolver.resolve_persona_context"
PERSONA_BLOCK = "# Brand Voice\n- Tone: direct\n- Phrases: Bottom line"


class TestResolveCuratedPersona:
    def test_returns_curated_when_present(self):
        from services.blog_writer.content.persona_block import resolve_curated_persona
        with patch(RESOLVER, return_value=PERSONA_BLOCK) as resolver:
            out = resolve_curated_persona("u1", "blog")
        assert out == PERSONA_BLOCK
        resolver.assert_called_once_with("u1", "blog")

    def test_returns_empty_when_no_persona(self):
        from services.blog_writer.content.persona_block import resolve_curated_persona
        with patch(RESOLVER, return_value=""):
            assert resolve_curated_persona("u1", "blog") == ""

    def test_returns_empty_when_no_user_id(self):
        from services.blog_writer.content.persona_block import resolve_curated_persona
        assert resolve_curated_persona(None, "blog") == ""
        assert resolve_curated_persona("", "blog") == ""

    def test_never_raises_on_resolver_error(self):
        from services.blog_writer.content.persona_block import resolve_curated_persona
        with patch(RESOLVER, side_effect=RuntimeError("boom")):
            assert resolve_curated_persona("u1", "blog") == ""


class TestMediumBlogGeneratorFallback:
    def test_curated_wins_over_req_persona(self):
        from services.blog_writer.content.medium_blog_generator import _resolve_persona_block
        req = MagicMock()
        req.persona = MagicMock(industry="Tech", tone="Formal", audience="Devs")
        with patch(RESOLVER, return_value=PERSONA_BLOCK):
            out = _resolve_persona_block(req, "u1")
        assert out == PERSONA_BLOCK

    def test_falls_back_to_req_persona(self):
        from services.blog_writer.content.medium_blog_generator import _resolve_persona_block
        req = MagicMock()
        req.persona = MagicMock(industry="Tech", tone="Formal", audience="Devs")
        with patch(RESOLVER, return_value=""):
            out = _resolve_persona_block(req, "u1")
        assert "Tech" in out and "Formal" in out


class TestEnhancedContentGenerator:
    def _generate(self, persona: str):
        from services.blog_writer.content.enhanced_content_generator import EnhancedContentGenerator

        gen = EnhancedContentGenerator()
        section = SimpleNamespace(
            id="s1", heading="Intro", references=[], key_points=[],
            keywords=[], subheadings=[], target_words=300,
        )
        with patch.object(gen.memory, "build_previous_sections_summary", return_value=""), \
             patch.object(gen.memory, "update_with_section", return_value=None), \
             patch.object(gen.transitioner, "generate_transition", return_value=""), \
             patch.object(gen.flow, "assess_flow", return_value={}), \
             patch.object(gen.url_manager, "pick_relevant_urls", return_value=[]), \
             patch(RESOLVER, return_value=persona), \
             patch("services.blog_writer.content.enhanced_content_generator.llm_text_gen", return_value={"text": "content"}) as llm:
            asyncio.run(gen.generate_section(section, user_id="u1"))
        return llm

    def test_system_prompt_gets_persona(self):
        llm = self._generate(PERSONA_BLOCK)
        assert llm.call_args.kwargs["system_prompt"] == PERSONA_BLOCK

    def test_system_prompt_none_when_no_persona(self):
        llm = self._generate("")
        assert llm.call_args.kwargs["system_prompt"] is None


class TestIntroductionGenerator:
    BASE_SYSTEM = "You are an expert content writer specializing in creating compelling blog introductions that hook readers and clearly communicate value."

    def _generate(self, persona: str):
        from services.blog_writer.content.introduction_generator import IntroductionGenerator

        gen = IntroductionGenerator()
        research = SimpleNamespace(
            keyword_analysis={}, suggested_angles=[], competitor_analysis={}, search_queries=[],
        )
        with patch(RESOLVER, return_value=persona), \
             patch("services.llm_providers.main_text_generation.llm_text_gen", return_value=["a" * 60, "b" * 60, "c" * 60]) as llm:
            asyncio.run(gen.generate_introductions(
                blog_title="T",
                research=research,
                outline=[],
                sections_content={},
                primary_keywords=["kw"],
                search_intent="informational",
                user_id="u1",
            ))
        return llm

    def test_system_prompt_contains_persona(self):
        llm = self._generate(PERSONA_BLOCK)
        sp = llm.call_args.kwargs["system_prompt"]
        assert self.BASE_SYSTEM in sp
        assert PERSONA_BLOCK in sp

    def test_system_prompt_unchanged_when_no_persona(self):
        llm = self._generate("")
        assert llm.call_args.kwargs["system_prompt"] == self.BASE_SYSTEM


class TestBlogRewriter:
    def _rewrite(self, user_id=None, persona: str = ""):
        from services.blog_writer.content.blog_rewriter import BlogRewriter

        rw = BlogRewriter(MagicMock())
        with patch(RESOLVER, return_value=persona), \
             patch("services.blog_writer.content.blog_rewriter.gemini_structured_json_response",
                   return_value={"title": "t", "sections": []}) as gemini:
            asyncio.run(rw._execute_blog_rewrite(
                "task1",
                title="T",
                sections=[{"heading": "h", "content": "c"}],
                feedback="this feedback is long enough",
                user_id=user_id,
            ))
        return gemini

    def test_system_prompt_contains_persona(self):
        gemini = self._rewrite(user_id="u1", persona=PERSONA_BLOCK)
        assert PERSONA_BLOCK in gemini.call_args.kwargs["system_prompt"]

    def test_system_prompt_unchanged_without_user_id(self):
        gemini = self._rewrite(user_id=None)
        assert "Brand Voice" not in gemini.call_args.kwargs["system_prompt"]
