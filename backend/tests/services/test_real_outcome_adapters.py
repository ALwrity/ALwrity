"""Tests for provider-backed Priority 2 outcome adapters."""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from services.real_outcome_adapters import (
    _gsc_metrics,
    fetch_conversion_outcomes,
    fetch_facebook_outcomes,
    fetch_gsc_outcomes,
    fetch_linkedin_outcomes,
    fetch_published_asset_outcomes,
)


def test_gsc_metrics_are_aggregated_and_ctr_is_weighted():
    result = _gsc_metrics({
        "overall_metrics": {
            "rows": [
                {"clicks": 10, "impressions": 100, "position": 5},
                {"clicks": 20, "impressions": 200, "position": 10},
            ]
        }
    })

    assert result["clicks"] == 30
    assert result["impressions"] == 300
    assert result["ctr"] == 0.1
    assert result["position"] == 25 / 3


@pytest.mark.asyncio
async def test_gsc_adapter_returns_real_provider_metrics(monkeypatch):
    class FakeDashboard:
        def __init__(self, db):
            pass

        async def get_gsc_data(self, user_id, site_url):
            return {
                "overall_metrics": {
                    "rows": [{"clicks": 8, "impressions": 80, "position": 4}]
                },
                "date_range": {"start": "2026-08-01"},
            }

    monkeypatch.setattr("services.seo.dashboard_service.SEODashboardService", FakeDashboard)
    result = await fetch_gsc_outcomes("user-1", object(), "https://acme.com")

    assert result["status"] == "available"
    assert result["source"] == "google_search_console"
    assert result["metrics"]["clicks"] == 8
    assert result["metrics"]["impressions"] == 80
    assert result["metrics"]["ctr"] == 0.1


@pytest.mark.asyncio
async def test_linkedin_adapter_returns_provider_metrics(monkeypatch):
    async def fake_payload(*args, **kwargs):
        return {
            "dateRange": {"label": "Last 7 days"},
            "personal": {
                "accountId": "acct-1",
                "analytics": {"reach": 100, "engagements": 12, "clicks": 4},
                "error": None,
            },
        }

    monkeypatch.setattr(
        "services.integrations.linkedin.unipile_personal_analytics.build_personal_analytics_payload",
        fake_payload,
    )
    monkeypatch.setattr(
        "services.integrations.linkedin.posts_service.get_posts_service",
        lambda: object(),
    )
    result = await fetch_linkedin_outcomes("user-1", object(), days=7)

    assert result["status"] == "available"
    assert result["source"] == "linkedin_unipile"
    assert result["metrics"] == {"reach": 100, "engagements": 12, "clicks": 4}


@pytest.mark.asyncio
async def test_facebook_adapter_marks_missing_configuration_as_coming_soon(monkeypatch):
    monkeypatch.delenv("FACEBOOK_PAGE_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("FACEBOOK_PAGE_ID", raising=False)

    result = await fetch_facebook_outcomes("user-1")

    assert result["status"] == "unavailable"
    assert result["reason_code"] == "coming_soon"


@pytest.mark.asyncio
async def test_facebook_adapter_aggregates_graph_insights(monkeypatch):
    monkeypatch.setenv("FACEBOOK_PAGE_ACCESS_TOKEN", "token")
    monkeypatch.setenv("FACEBOOK_PAGE_ID", "page-1")

    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {
                "data": [
                    {"name": "page_reach", "values": [{"value": 10}, {"value": 20}]},
                    {"name": "page_post_engagements", "values": [{"value": 5}]},
                ]
            }

    class Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def get(self, url, params):
            assert "page-1" in url
            assert params["metric"]
            return Response()

    import httpx

    monkeypatch.setattr(httpx, "AsyncClient", lambda timeout: Client())
    result = await fetch_facebook_outcomes("user-1", days=7)

    assert result["status"] == "available"
    assert result["metrics"]["page_reach"] == 30
    assert result["metrics"]["page_post_engagements"] == 5


def test_conversion_adapter_aggregates_first_party_events():
    class Event:
        def __init__(self, name, value):
            self.event_name = name
            self.value = value

    class Query:
        def filter(self, *args, **kwargs):
            return self

        def all(self):
            return [Event("signup", 0), Event("purchase", 25)]

    class DB:
        def query(self, model):
            return Query()

    result = fetch_conversion_outcomes("user-1", DB(), days=30)

    assert result["status"] == "available"
    assert result["metrics"] == {
        "total_events": 2,
        "valued_events": 2,
        "total_value": 25.0,
    }
    assert result["events_by_name"] == {"signup": 1, "purchase": 1}
    assert result["currency_totals"] == {"UNSPECIFIED": 25.0}


def test_conversion_adapter_reports_lineage_dimensions_and_confidence():
    class Event:
        event_name = "purchase"
        value = 25
        currency = "USD"
        agent_type = "ContentStrategyAgent"
        recommendation_id = "rec-1"
        task_id = 10
        artifact_id = 20
        published_asset_id = 30
        campaign_id = "campaign-1"
        platform = "website"
        metadata_json = {}

    class Query:
        def filter(self, *args, **kwargs):
            return self

        def all(self):
            return [Event()]

    class DB:
        def query(self, model):
            return Query()

    result = fetch_conversion_outcomes("user-1", DB())

    assert result["attribution"]["fully_attributed"] == 1
    assert result["by_dimensions"]["recommendation"]["rec-1"]["count"] == 1
    assert result["by_dimensions"]["platform"]["website"]["value"] == 25.0


def test_published_asset_adapter_counts_real_tags(monkeypatch):
    class FakeAssets:
        tags = ["published"]
        asset_metadata = {"platform": "wordpress"}

    class FakeService:
        def __init__(self, db):
            pass

        def get_user_assets(self, **kwargs):
            return [FakeAssets(), SimpleNamespace(tags=["draft"], asset_metadata={})], 2

    monkeypatch.setattr("services.content_asset_service.ContentAssetService", FakeService)
    result = fetch_published_asset_outcomes("user-1", object())

    assert result["status"] == "available"
    assert result["published_assets"] == 1
    assert result["draft_assets"] == 1
