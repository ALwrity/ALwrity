"""Tests for downstream invalidation when Connect Platforms website URL changes."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from api.onboarding_utils.website_change_invalidation import (
    WebsiteAnalysisSaveResult,
    invalidate_session_downstream_research,
    normalize_website_url,
    website_urls_differ,
)


class TestWebsiteUrlNormalization:
    def test_normalize_treats_equivalent_urls_as_same(self):
        assert normalize_website_url("https://www.Example.com/") == normalize_website_url(
            "http://example.com"
        )

    def test_website_urls_differ_detects_site_change(self):
        assert website_urls_differ("https://site-a.com", "https://site-b.com") is True

    def test_website_urls_differ_false_for_same_site(self):
        assert website_urls_differ("https://site-a.com", "http://www.site-a.com/") is False

    def test_website_urls_differ_false_when_either_missing(self):
        assert website_urls_differ("", "https://site-a.com") is False


class TestPersonaCacheReuse:
    def test_does_not_reuse_persona_for_a_different_website(self):
        from api.onboarding_utils.website_change_invalidation import (
            extract_onboarding_website_url,
            should_reuse_persona_cache,
        )

        request_url = extract_onboarding_website_url(
            {"website": "https://www.alwrity.com", "websiteAnalysis": {"website_url": "https://www.alwrity.com"}}
        )
        assert should_reuse_persona_cache(request_url, "https://www.hexaurum.com") is False

    def test_reuses_persona_for_the_same_website(self):
        from api.onboarding_utils.website_change_invalidation import should_reuse_persona_cache

        assert (
            should_reuse_persona_cache("https://alwrity.com", "https://www.alwrity.com/")
            is True
        )


class TestInvalidateSessionDownstreamResearch:
    def test_deletes_competitors_and_research_preferences(self):
        from models.onboarding import CompetitorAnalysis, PersonaData, ResearchPreferences

        db = MagicMock()
        competitor_query = MagicMock()
        prefs_query = MagicMock()
        persona_query = MagicMock()
        competitor_query.delete.return_value = 2
        prefs_query.delete.return_value = 1
        persona_query.delete.return_value = 1

        def query_side_effect(model):
            if model is CompetitorAnalysis:
                return MagicMock(filter=MagicMock(return_value=competitor_query))
            if model is ResearchPreferences:
                return MagicMock(filter=MagicMock(return_value=prefs_query))
            if model is PersonaData:
                return MagicMock(filter=MagicMock(return_value=persona_query))
            return MagicMock()

        db.query.side_effect = query_side_effect

        result = invalidate_session_downstream_research(session_id=42, db=db)

        assert result == {
            "competitors_deleted": 2,
            "research_prefs_deleted": 1,
            "persona_deleted": 1,
        }
        db.commit.assert_called_once()


class TestSaveWebsiteAnalysisUrlChange:
    def test_invalidates_downstream_when_website_url_changes(self):
        from api.onboarding_utils.step_management_service import StepManagementService
        from models.onboarding import WebsiteAnalysis

        db = MagicMock()
        session = MagicMock()
        session.id = 7

        existing = WebsiteAnalysis(session_id=7, website_url="https://old-site.com")
        svc = StepManagementService()
        svc._get_or_create_session = MagicMock(return_value=session)

        db.query.return_value.filter.return_value.first.return_value = existing

        invalidate_mock = MagicMock(return_value={"competitors_deleted": 1, "research_prefs_deleted": 1})
        svc._invalidate_downstream_for_website_change = invalidate_mock

        result = svc._save_website_analysis(
            "user_1",
            {"website": "https://new-site.com", "analysis": {"id": 2}},
            db,
        )

        assert isinstance(result, WebsiteAnalysisSaveResult)
        assert result.success is True
        assert result.website_url_changed is True
        assert result.is_new_analysis is False
        invalidate_mock.assert_called_once_with(session.id, db)

    def test_does_not_invalidate_when_website_url_is_unchanged(self):
        from api.onboarding_utils.step_management_service import StepManagementService
        from models.onboarding import WebsiteAnalysis

        db = MagicMock()
        session = MagicMock()
        session.id = 7

        existing = WebsiteAnalysis(session_id=7, website_url="https://same-site.com")
        svc = StepManagementService()
        svc._get_or_create_session = MagicMock(return_value=session)
        db.query.return_value.filter.return_value.first.return_value = existing

        invalidate_mock = MagicMock()
        svc._invalidate_downstream_for_website_change = invalidate_mock

        result = svc._save_website_analysis(
            "user_1",
            {"website": "https://www.same-site.com/", "analysis": {"id": 9}},
            db,
        )

        assert result.website_url_changed is False
        invalidate_mock.assert_not_called()

    def test_new_analysis_does_not_invalidate_downstream(self):
        from api.onboarding_utils.step_management_service import StepManagementService

        db = MagicMock()
        session = MagicMock()
        session.id = 3

        svc = StepManagementService()
        svc._get_or_create_session = MagicMock(return_value=session)
        db.query.return_value.filter.return_value.first.return_value = None

        invalidate_mock = MagicMock()
        svc._invalidate_downstream_for_website_change = invalidate_mock

        result = svc._save_website_analysis(
            "user_1",
            {"website": "https://first-site.com", "analysis": {"id": 1}},
            db,
        )

        assert result.is_new_analysis is True
        assert result.website_url_changed is False
        invalidate_mock.assert_not_called()


class TestWebsiteStrategyTaskScheduling:
    def test_schedules_tasks_on_first_save(self):
        from api.onboarding_utils.platform_strategies.website_strategy import (
            WebsiteOnboardingStrategy,
        )
        from api.onboarding_utils.website_change_invalidation import WebsiteAnalysisSaveResult

        strategy = WebsiteOnboardingStrategy()
        svc = MagicMock()
        db = MagicMock()

        svc._save_website_analysis.return_value = WebsiteAnalysisSaveResult(
            success=True,
            website_url_changed=False,
            is_new_analysis=True,
        )
        svc._get_or_create_session.return_value = MagicMock(payload={})

        schedule_mock = MagicMock()

        with pytest.MonkeyPatch.context() as mp:
            mp.setattr(
                "api.onboarding_utils.onboarding_task_scheduler.schedule_step2_tasks",
                schedule_mock,
            )
            strategy._complete_website_step2(
                svc,
                "user_1",
                {"website": "https://new.com"},
                db,
            )

        schedule_mock.assert_called_once()

    def test_skips_reschedule_when_url_unchanged(self):
        from api.onboarding_utils.platform_strategies.website_strategy import (
            WebsiteOnboardingStrategy,
        )
        from api.onboarding_utils.website_change_invalidation import WebsiteAnalysisSaveResult

        strategy = WebsiteOnboardingStrategy()
        svc = MagicMock()
        db = MagicMock()

        svc._save_website_analysis.return_value = WebsiteAnalysisSaveResult(
            success=True,
            website_url_changed=False,
            is_new_analysis=False,
        )
        svc._get_or_create_session.return_value = MagicMock(payload={})

        schedule_mock = MagicMock()

        with pytest.MonkeyPatch.context() as mp:
            mp.setattr(
                "api.onboarding_utils.onboarding_task_scheduler.schedule_step2_tasks",
                schedule_mock,
            )
            strategy._complete_website_step2(
                svc,
                "user_1",
                {"website": "https://same.com"},
                db,
            )

        schedule_mock.assert_not_called()

    def test_schedules_tasks_when_url_changed(self):
        from api.onboarding_utils.platform_strategies.website_strategy import (
            WebsiteOnboardingStrategy,
        )
        from api.onboarding_utils.website_change_invalidation import WebsiteAnalysisSaveResult

        strategy = WebsiteOnboardingStrategy()
        svc = MagicMock()
        db = MagicMock()

        svc._save_website_analysis.return_value = WebsiteAnalysisSaveResult(
            success=True,
            website_url_changed=True,
            is_new_analysis=False,
        )
        svc._get_or_create_session.return_value = MagicMock(payload={})

        schedule_mock = MagicMock()

        with pytest.MonkeyPatch.context() as mp:
            mp.setattr(
                "api.onboarding_utils.onboarding_task_scheduler.schedule_step2_tasks",
                schedule_mock,
            )
            strategy._complete_website_step2(
                svc,
                "user_1",
                {"website": "https://changed.com"},
                db,
            )

        schedule_mock.assert_called_once()
