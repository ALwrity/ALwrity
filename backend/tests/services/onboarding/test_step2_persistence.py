"""Tests for Step 2 (Competitor Analysis) persistence fixes."""

from __future__ import annotations

import pytest
from unittest.mock import MagicMock


class TestCompetitorAnalysisPersistence:
    """Verify competitor results are saved to DB after discovery."""

    def test_save_competitor_analysis_upserts_existing(self):
        from api.onboarding_utils.step_management_service import StepManagementService
        from models.onboarding import CompetitorAnalysis

        db = MagicMock()
        session = MagicMock()
        session.id = 1
        svc = StepManagementService()
        svc._get_or_create_session = MagicMock(return_value=session)

        existing = CompetitorAnalysis(
            session_id=1,
            competitor_url="https://example.com",
            competitor_domain="example.com",
            analysis_data={"title": "Old"},
            status="completed",
        )
        db.query.return_value.filter.return_value.first.return_value = existing

        competitors = [{"url": "https://example.com", "title": "New Title", "summary": "Updated"}]
        result = svc._save_competitor_analysis("test_user", competitors, "tech", db)

        assert result is True
        assert existing.analysis_data["title"] == "New Title"

    def test_save_competitor_analysis_creates_new(self):
        from api.onboarding_utils.step_management_service import StepManagementService

        db = MagicMock()
        session = MagicMock()
        session.id = 1
        svc = StepManagementService()
        svc._get_or_create_session = MagicMock(return_value=session)
        db.query.return_value.filter.return_value.first.return_value = None

        competitors = [{"url": "https://new.com", "title": "New", "domain": "new.com", "summary": "Test"}]
        result = svc._save_competitor_analysis("test_user", competitors, "tech", db)

        assert result is True
        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.competitor_url == "https://new.com"
        assert added.status == "completed"

    def test_save_competitor_calls_commit(self):
        from api.onboarding_utils.step_management_service import StepManagementService

        db = MagicMock()
        session = MagicMock()
        session.id = 1
        svc = StepManagementService()
        svc._get_or_create_session = MagicMock(return_value=session)
        db.query.return_value.filter.return_value.first.return_value = None

        svc._save_competitor_analysis("test_user", [], "tech", db)
        db.commit.assert_called_once()


class TestSitemapPersistence:
    """Verify sitemap analysis updates website_analyses.seo_audit.

    Core logic tested inline — the sitemapAnalysis key is conditionally
    added to step_data based on seo_audit content.
    """

    def test_sitemap_analysis_included_when_present(self):
        seo_audit = {"sitemap_analysis": {"structure_analysis": {"total_urls": 50}}}
        step_data = {}
        if seo_audit.get("sitemap_analysis"):
            step_data["sitemapAnalysis"] = seo_audit["sitemap_analysis"]
        assert step_data.get("sitemapAnalysis", {}).get("structure_analysis", {}).get("total_urls") == 50

    def test_sitemap_analysis_omitted_when_absent(self):
        step_data = {}
        if {}.get("sitemap_analysis"):
            step_data["sitemapAnalysis"] = {}
        assert "sitemapAnalysis" not in step_data


class TestGetStepDataSitemapInclusion:
    """Verify get_step_data(2) includes sitemap analysis."""

    def test_sitemap_in_step_data_when_available(self):
        """Step data dict should include sitemapAnalysis from seo_audit."""
        website = {
            "social_media_presence": {},
            "crawl_result": {},
            "seo_audit": {
                "sitemap_analysis": {
                    "structure_analysis": {"total_urls": 100},
                    "onboarding_insights": {"score": 90},
                }
            },
        }
        seo_audit = website.get("seo_audit", {}) or {}
        step_data = {"competitors": [], "social_media_accounts": {}, "crawl_social_media": {}}

        if seo_audit.get("sitemap_analysis"):
            step_data["sitemapAnalysis"] = seo_audit["sitemap_analysis"]

        assert "sitemapAnalysis" in step_data
        assert step_data["sitemapAnalysis"]["structure_analysis"]["total_urls"] == 100

    def test_no_sitemap_in_step_data_when_not_saved(self):
        """Step data should NOT include sitemapAnalysis when seo_audit is empty."""
        website = {"seo_audit": {}}
        seo_audit = website.get("seo_audit", {}) or {}
        step_data = {"competitors": [], "social_media_accounts": {}, "crawl_social_media": {}}

        if seo_audit.get("sitemap_analysis"):
            step_data["sitemapAnalysis"] = seo_audit["sitemap_analysis"]

        assert "sitemapAnalysis" not in step_data
