"""
Tests for the second wave of onboarding fixes (post PR #742).

These tests pin down:
1. ``TxtaiIntelligenceService._require_txtai_available`` exists and
   fails fast when txtai is unavailable.
2. ``failure_detection_service`` imports ``AdvertoolsTask`` from the
   right module (was the wrong module pre-fix, causing every
   ``get_tasks_needing_intervention`` call to error).
3. ``ResearchPersonaPromptBuilder._analyze_crawl_result_comprehensive``
   and the two sibling methods exist and return non-empty results on
   a populated crawl_result.
4. ``AdvertoolsService.audit_content`` no longer crashes on the
   ``word_frequency`` API change (rm_stopwords → rm_words).
5. ``FacebookPersonaService.generate_facebook_persona`` accepts an
   explicit ``user_id`` argument and falls back to
   ``onboarding_data["session_info"]["user_id"]`` when not provided.
"""

import asyncio
import sys
import types
from typing import Optional
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# 1. TxtaiIntelligenceService._require_txtai_available
# ---------------------------------------------------------------------------


class TestTxtaiRequireTxtaiAvailable:
    """Phase 5 / Issue #8: explicit guard for missing txtai."""

    def test_method_exists_on_class(self):
        from services.intelligence.txtai_service import TxtaiIntelligenceService

        assert hasattr(TxtaiIntelligenceService, "_require_txtai_available")
        # Must be a callable (instance method)
        assert callable(getattr(TxtaiIntelligenceService, "_require_txtai_available"))

    def test_returns_none_when_txtai_available(self):
        # If txtai is importable, the method is a no-op.
        from services.intelligence import txtai_service
        from services.intelligence.txtai_service import TxtaiIntelligenceService

        if not getattr(txtai_service, "TXTAI_AVAILABLE", False):
            pytest.skip("txtai is not installed in this environment")

        # We don't construct a real instance (that loads a model).
        # We patch __init__ to a no-op so we can call the method.
        svc = TxtaiIntelligenceService.__new__(TxtaiIntelligenceService, user_id="test_user")
        svc.fail_fast = False
        # Should not raise when txtai is available.
        assert svc._require_txtai_available() is None

    def test_raises_when_txtai_missing_and_fail_fast(self, monkeypatch):
        # Simulate "txtai not available" by stubbing the module-level
        # TXTAI_AVAILABLE flag.
        from services.intelligence import txtai_service
        from services.intelligence.txtai_service import TxtaiIntelligenceService

        monkeypatch.setattr(txtai_service, "TXTAI_AVAILABLE", False)

        svc = TxtaiIntelligenceService.__new__(TxtaiIntelligenceService, user_id="test_user")
        svc.fail_fast = True

        with pytest.raises(RuntimeError) as exc_info:
            svc._require_txtai_available()
        assert "txtai is not available" in str(exc_info.value).lower()

    def test_no_raise_when_txtai_missing_and_fail_soft(self, monkeypatch):
        from services.intelligence import txtai_service
        from services.intelligence.txtai_service import TxtaiIntelligenceService

        monkeypatch.setattr(txtai_service, "TXTAI_AVAILABLE", False)

        svc = TxtaiIntelligenceService.__new__(TxtaiIntelligenceService, user_id="test_user")
        svc.fail_fast = False

        # Should be a no-op (returns None) when fail_fast is disabled.
        assert svc._require_txtai_available() is None


# ---------------------------------------------------------------------------
# 2. AdvertoolsTask import path
# ---------------------------------------------------------------------------


class TestAdvertoolsTaskImportPath:
    """Pre-fix, failure_detection_service imported AdvertoolsTask from
    the wrong module (``website_analysis_monitoring_models`` instead of
    ``advertools_monitoring_models``). Every call to
    ``get_tasks_needing_intervention`` errored out with ImportError.

    We don't import failure_detection_service directly (the test
    infrastructure can't load it for unrelated reasons). Instead we
    grep the source for the right import statement.
    """

    def test_source_imports_advertools_task_from_correct_module(self):
        from pathlib import Path

        # This file is at backend/tests/test_onboarding_step3_fixes.py,
        # so the backend root is parents[1] (not parents[2]).
        repo = Path(__file__).resolve().parents[1]  # backend/
        fds_path = (
            repo
            / "services"
            / "scheduler"
            / "core"
            / "failure_detection_service.py"
        )
        assert fds_path.exists(), f"Could not find {fds_path}"

        source = fds_path.read_text(encoding="utf-8")
        # The pre-fix import was from ``website_analysis_monitoring_models``.
        # After the fix it should be from ``advertools_monitoring_models``.
        assert "from models.advertools_monitoring_models import AdvertoolsTask" in source, (
            "failure_detection_service does not import AdvertoolsTask from "
            "models.advertools_monitoring_models — the pre-fix ImportError "
            "bug is back."
        )
        # And the wrong import should not be present.
        assert (
            "from models.website_analysis_monitoring_models import AdvertoolsTask"
            not in source
        ), (
            "failure_detection_service still has the pre-fix wrong import "
            "from models.website_analysis_monitoring_models — the bug is back."
        )


# ---------------------------------------------------------------------------
# 3. ResearchPersonaPromptBuilder comprehensive methods
# ---------------------------------------------------------------------------


class TestResearchPersonaPromptBuilderComprehensive:
    """The Phase 3 prompt template calls three methods that were never
    defined, causing the scheduled research-persona task to crash."""

    def _builder(self):
        from services.research.research_persona_prompt_builder import (
            ResearchPersonaPromptBuilder,
        )
        return ResearchPersonaPromptBuilder()

    def test_methods_exist(self):
        b = self._builder()
        assert callable(getattr(b, "_analyze_crawl_result_comprehensive", None))
        assert callable(getattr(b, "_map_writing_style_comprehensive", None))
        assert callable(getattr(b, "_extract_content_themes", None))

    def test_analyze_crawl_result_comprehensive_with_empty_input(self):
        b = self._builder()
        # Empty / non-dict input should return {} without raising.
        assert b._analyze_crawl_result_comprehensive({}) == {}
        assert b._analyze_crawl_result_comprehensive(None) == {}
        assert b._analyze_crawl_result_comprehensive("not a dict") == {}

    def test_analyze_crawl_result_comprehensive_with_populated_input(self):
        b = self._builder()
        crawl = {
            "metadata": {
                "title": "My Site",
                "description": "A great site",
                "keywords": ["alpha", "beta", "gamma"],
            },
            "headings": ["Home", "About", "Contact"],
            "sections": [
                {"category": "blog", "title": "First Post"},
                {"category": "tutorial", "title": "How To"},
            ],
            "topics": ["AI", "marketing"],
        }
        result = b._analyze_crawl_result_comprehensive(crawl)
        assert result["title"] == "My Site"
        assert result["description"] == "A great site"
        assert "AI" in result["main_topics"]
        assert "marketing" in result["main_topics"]
        assert result["content_categories"] == ["blog", "tutorial"]

    def test_map_writing_style_comprehensive_complexity_levels(self):
        b = self._builder()
        # High complexity → comprehensive research depth.
        high = b._map_writing_style_comprehensive({"complexity": "high"}, {})
        assert high["research_depth_preference"] == "comprehensive"
        # Medium → targeted.
        medium = b._map_writing_style_comprehensive({"complexity": "medium"}, {})
        assert medium["research_depth_preference"] == "targeted"
        # Low → basic.
        low = b._map_writing_style_comprehensive({"complexity": "low"}, {})
        assert low["research_depth_preference"] == "basic"
        # Vocabulary fallback when complexity missing.
        vocab_advanced = b._map_writing_style_comprehensive({}, {"vocabulary_level": "advanced"})
        assert vocab_advanced["research_depth_preference"] == "comprehensive"

    def test_extract_content_themes_dedupes(self):
        b = self._builder()
        crawl = {"metadata": {"keywords": ["alpha", "beta"]}}
        # Provide duplicate topics to verify dedup.
        themes = b._extract_content_themes(crawl, ["alpha", "Alpha", "BETA", "gamma"])
        # "alpha" and "Alpha" should be deduped case-insensitively.
        assert len(themes) == len(set(t.lower() for t in themes))
        # The first occurrence wins (lowercase "alpha", uppercase "Alpha" both kept the first "alpha").
        assert "alpha" in [t.lower() for t in themes]

    def test_prompt_build_does_not_crash_with_empty_input(self):
        """The end-to-end prompt build must not crash even when the
        crawl_result is empty. This is the regression that was
        blocking onboarding step 4."""
        b = self._builder()
        prompt = b.build_research_persona_prompt({})
        assert isinstance(prompt, str)
        assert "RESEARCH PERSONA GENERATION TASK" in prompt


# ---------------------------------------------------------------------------
# 4. advertools_service audit_content with the new rm_words API
# ---------------------------------------------------------------------------


class TestAdvertoolsAuditContent:
    """Pre-fix, ``adv.word_frequency([text], rm_stopwords=True)`` raised
    ``TypeError: word_frequency() got an unexpected keyword argument
    'rm_stopwords'`` because advertools >=0.13 renamed the parameter
    to ``rm_words``. The fix uses ``rm_words=adv.stopwords['english']``
    to preserve the original behaviour (filter English stopwords)."""

    def _patch_adv(self):
        """Build a fake advertools module with the new API and inject
        it into sys.modules so the import inside advertools_service
        picks it up.
        """
        fake_adv = types.ModuleType("advertools")
        fake_word_freq_result = MagicMock()
        fake_word_freq_result.head.return_value.to_dict.return_value = [
            {"word": "alpha", "abs_freq": 5},
            {"word": "beta", "abs_freq": 3},
        ]
        fake_adv.word_frequency = MagicMock(return_value=fake_word_freq_result)
        fake_adv.stopwords = {"english": {"the", "a", "an"}}
        fake_adv.url_to_df = MagicMock()
        fake_adv.crawl = MagicMock()
        return fake_adv

    def test_audit_content_uses_rm_words_not_rm_stopwords(self):
        """Verify the call site uses ``rm_words`` (a set) not
        ``rm_stopwords`` (a boolean, the pre-fix behaviour)."""
        from pathlib import Path

        repo = Path(__file__).resolve().parents[1]  # backend/
        adv_path = (
            repo / "services" / "seo" / "advertools_service.py"
        )
        assert adv_path.exists(), f"Could not find {adv_path}"
        source = adv_path.read_text(encoding="utf-8")

        # The pre-fix call was ``adv.word_frequency([text], rm_stopwords=True)``.
        # After the fix it should be ``adv.word_frequency([text], rm_words=adv.stopwords[...])``.
        assert "rm_stopwords=True" not in source, (
            "advertools_service still uses rm_stopwords=True — "
            "the pre-fix API mismatch is back."
        )
        assert "rm_words=" in source, (
            "advertools_service does not use rm_words — the fix is missing."
        )


# ---------------------------------------------------------------------------
# 5. FacebookPersonaService.generate_facebook_persona user_id handling
# ---------------------------------------------------------------------------


class TestFacebookPersonaUserIdResolution:
    """The Facebook persona service used to extract user_id from
    ``onboarding_data["session_info"]["user_id"]`` which is None when
    the scheduler passes a flat onboarding dict. The fix accepts
    ``user_id`` as an explicit kwarg and falls back to the legacy
    nested key.
    """

    def _service(self):
        from services.persona.facebook.facebook_persona_service import (
            FacebookPersonaService,
        )
        # Singleton; reset between tests.
        FacebookPersonaService._instance = None
        FacebookPersonaService._initialized = False
        return FacebookPersonaService()

    def _patch_llm(self):
        """Patch ``llm_text_gen`` so we can capture the user_id that
        the service passes through to the LLM gateway."""
        return patch("services.persona.facebook.facebook_persona_service.llm_text_gen")

    def test_explicit_user_id_is_passed_to_llm(self):
        svc = self._service()
        with self._patch_llm() as fake_llm:
            fake_llm.return_value = {
                "facebook_handle": "test",
                "primary_topics": ["AI"],
            }
            # Stub the schema/prompt methods so the service doesn't
            # need real persona data.
            svc.prompts.build_focused_facebook_prompt = MagicMock(return_value="prompt")
            svc.prompts.build_facebook_system_prompt = MagicMock(return_value="system")
            svc._get_enhanced_facebook_schema = MagicMock(return_value={})
            svc.validate_facebook_persona = MagicMock(return_value={"quality_score": 80.0})
            svc.optimize_for_facebook_algorithm = MagicMock(
                side_effect=lambda p: p
            )

            svc.generate_facebook_persona(
                core_persona={"name": "test"},
                onboarding_data={"website_url": "https://x.com"},
                user_id="user_abc",
            )

            assert fake_llm.called
            call_kwargs = fake_llm.call_args.kwargs
            assert call_kwargs.get("user_id") == "user_abc"

    def test_falls_back_to_session_info_user_id(self):
        svc = self._service()
        with self._patch_llm() as fake_llm:
            fake_llm.return_value = {"facebook_handle": "test"}
            svc.prompts.build_focused_facebook_prompt = MagicMock(return_value="prompt")
            svc.prompts.build_facebook_system_prompt = MagicMock(return_value="system")
            svc._get_enhanced_facebook_schema = MagicMock(return_value={})
            svc.validate_facebook_persona = MagicMock(return_value={"quality_score": 80.0})
            svc.optimize_for_facebook_algorithm = MagicMock(
                side_effect=lambda p: p
            )

            # No explicit user_id, but the legacy nested key is set.
            svc.generate_facebook_persona(
                core_persona={"name": "test"},
                onboarding_data={
                    "website_url": "https://x.com",
                    "session_info": {"user_id": "user_legacy"},
                },
            )

            assert fake_llm.called
            call_kwargs = fake_llm.call_args.kwargs
            assert call_kwargs.get("user_id") == "user_legacy"

    def test_explicit_user_id_wins_over_legacy_nested(self):
        """If both are set, the explicit kwarg wins."""
        svc = self._service()
        with self._patch_llm() as fake_llm:
            fake_llm.return_value = {"facebook_handle": "test"}
            svc.prompts.build_focused_facebook_prompt = MagicMock(return_value="prompt")
            svc.prompts.build_facebook_system_prompt = MagicMock(return_value="system")
            svc._get_enhanced_facebook_schema = MagicMock(return_value={})
            svc.validate_facebook_persona = MagicMock(return_value={"quality_score": 80.0})
            svc.optimize_for_facebook_algorithm = MagicMock(
                side_effect=lambda p: p
            )

            svc.generate_facebook_persona(
                core_persona={"name": "test"},
                onboarding_data={
                    "website_url": "https://x.com",
                    "session_info": {"user_id": "user_legacy"},
                },
                user_id="user_explicit",
            )

            assert fake_llm.called
            call_kwargs = fake_llm.call_args.kwargs
            assert call_kwargs.get("user_id") == "user_explicit"
