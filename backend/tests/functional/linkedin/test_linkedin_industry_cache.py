"""Tests for LinkedIn industry cache (hybrid autocomplete Phase 2)."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from models.linkedin_search_models import LinkedInIndustryItem, LinkedInSearchParameterItem
from services.integrations.linkedin import linkedin_industry_cache_service as cache_service

pytestmark = [pytest.mark.linkedin, pytest.mark.functional]


class TestIndustryCacheHelpers:
    def test_is_cache_stale_when_missing_synced_at(self):
        assert cache_service.is_cache_stale(None) is True

    def test_is_cache_stale_after_seven_days(self):
        old = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
        assert cache_service.is_cache_stale(old) is True

    def test_is_cache_stale_when_recent(self):
        recent = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        assert cache_service.is_cache_stale(recent) is False

    def test_save_and_get_industries_warm_cache(self, tmp_path, monkeypatch):
        cache_path = tmp_path / "linkedin_industries_cache.json"
        monkeypatch.setenv("LINKEDIN_INDUSTRY_CACHE_PATH", str(cache_path))

        items = [
            LinkedInIndustryItem(id="1", title="Performing Arts"),
            LinkedInIndustryItem(id="2", title="Retail Art Supplies"),
        ]
        cache_service.save_cache(items)

        payload = cache_service.get_industries()
        assert payload["cache_status"] == "warm"
        assert payload["item_count"] == 2
        assert payload["items"][0].title == "Performing Arts"

    def test_get_industries_empty_cache(self, tmp_path, monkeypatch):
        cache_path = tmp_path / "missing.json"
        monkeypatch.setenv("LINKEDIN_INDUSTRY_CACHE_PATH", str(cache_path))
        cache_service.analytics_cache.raw_delete(cache_service.HOT_CACHE_KEY)

        payload = cache_service.get_industries()
        assert payload["cache_status"] == "empty"
        assert payload["items"] == []
        assert payload["item_count"] == 0


def test_sync_dedupes_by_id(monkeypatch, tmp_path):
    cache_path = tmp_path / "linkedin_industries_cache.json"
    monkeypatch.setenv("LINKEDIN_INDUSTRY_CACHE_PATH", str(cache_path))

    async def _fake_get_search_parameters(
        user_id: str,
        parameter_type: str,
        *,
        keywords=None,
        limit: int = 10,
        service: str = "CLASSIC",
        account_id=None,
        oauth=None,
        client=None,
    ):
        assert parameter_type == "INDUSTRY"
        if keywords in (None, "a"):
            return type(
                "Resp",
                (),
                {
                    "items": [
                        LinkedInSearchParameterItem(id="1", title="Performing Arts"),
                        LinkedInSearchParameterItem(id="2", title="Retail Art Supplies"),
                    ]
                },
            )()
        if keywords == "b":
            return type(
                "Resp",
                (),
                {
                    "items": [
                        LinkedInSearchParameterItem(id="1", title="Performing Arts"),
                        LinkedInSearchParameterItem(id="3", title="Biotechnology"),
                    ]
                },
            )()
        return type("Resp", (), {"items": []})()

    monkeypatch.setattr(
        "services.integrations.linkedin.linkedin_search_service.get_search_parameters",
        _fake_get_search_parameters,
    )

    count = asyncio.run(cache_service.sync_industries_from_unipile("user_test"))
    assert count == 3

    payload = cache_service.get_industries()
    titles = {item.title for item in payload["items"]}
    assert titles == {"Performing Arts", "Retail Art Supplies", "Biotechnology"}


def test_get_industries_route_empty(linkedin_client, tmp_path, monkeypatch):
    cache_path = tmp_path / "empty.json"
    monkeypatch.setenv("LINKEDIN_INDUSTRY_CACHE_PATH", str(cache_path))
    cache_service.analytics_cache.raw_delete(cache_service.HOT_CACHE_KEY)

    response = linkedin_client.get("/api/linkedin-social/industries")
    assert response.status_code == 200
    payload = response.json()
    assert payload["cache_status"] == "empty"
    assert payload["items"] == []


def test_get_industries_route_warm(linkedin_client, tmp_path, monkeypatch):
    cache_path = tmp_path / "warm.json"
    monkeypatch.setenv("LINKEDIN_INDUSTRY_CACHE_PATH", str(cache_path))

    cache_service.save_cache(
        [LinkedInIndustryItem(id="10", title="Technology")]
    )

    response = linkedin_client.get("/api/linkedin-social/industries")
    assert response.status_code == 200
    payload = response.json()
    assert payload["cache_status"] == "warm"
    assert payload["item_count"] == 1
    assert payload["items"][0]["title"] == "Technology"


def test_resolve_sync_user_id_none_when_no_accounts(monkeypatch):
    from services.integrations.linkedin import linkedin_industry_sync_job as sync_job

    monkeypatch.setenv("LINKEDIN_INDUSTRY_SYNC_USER_ID", "")
    monkeypatch.setattr(sync_job, "get_all_user_ids", lambda: ["user_a"])

    class _OAuth:
        def resolve_credentials(self, user_id: str):
            from services.integrations.linkedin.types import LinkedInNotConnectedError

            raise LinkedInNotConnectedError("not connected")

    assert sync_job.resolve_sync_user_id(_OAuth()) is None
