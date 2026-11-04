"""
Tests for the optional Serping API SERP provider.

SerpingApiService mirrors the GoogleSearchService.perform_search result
contract (title/link/snippet/position) and is opt-in via SERPINGAPI_API_KEY.
All HTTP is mocked — no network, no real key.
"""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.seo_tools import serpingapi_service
from services.seo_tools.serpingapi_service import SerpingApiService


def _fake_session(status=200, body=None, text=None):
    """Build a session whose post() yields an async-context response."""
    response = MagicMock()
    response.status = status
    response.json = AsyncMock(return_value=body)
    response.text = AsyncMock(return_value=text if text is not None else json.dumps(body))

    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=response)
    ctx.__aexit__ = AsyncMock(return_value=False)

    session = MagicMock()
    session.post = MagicMock(return_value=ctx)
    return session


class TestSerpingApiServiceDisabled:
    def test_disabled_without_key(self, monkeypatch):
        monkeypatch.delenv("SERPINGAPI_API_KEY", raising=False)
        service = SerpingApiService()
        assert service.enabled is False

    def test_perform_search_raises_when_disabled(self, monkeypatch):
        monkeypatch.delenv("SERPINGAPI_API_KEY", raising=False)
        service = SerpingApiService()
        with pytest.raises(RuntimeError, match="SERPINGAPI_API_KEY"):
            asyncio.run(service.perform_search("site:example.com topic"))


class TestSerpingApiServiceSearch:
    @pytest.fixture
    def service(self, monkeypatch):
        monkeypatch.setenv("SERPINGAPI_API_KEY", "sk_test")
        return SerpingApiService()

    def test_maps_organic_results_to_perform_search_contract(self, service):
        body = {
            "searchParameters": {"q": "site:example.com topic"},
            "organic": [
                {
                    "title": "Example page",
                    "link": "https://example.com/page",
                    "snippet": "About the topic",
                    "position": 1,
                },
                {"title": "No position", "link": "https://example.com/2", "snippet": ""},
                "not-a-dict",
            ],
        }
        session = _fake_session(body=body)
        with patch.object(serpingapi_service, "_get_session", return_value=session):
            items = asyncio.run(service.perform_search("site:example.com topic", 5))

        assert items == [
            {
                "title": "Example page",
                "link": "https://example.com/page",
                "snippet": "About the topic",
                "position": 1,
            },
            {"title": "No position", "link": "https://example.com/2", "snippet": "", "position": 2},
        ]

        # Request shape: POST JSON body with X-API-Key header, CSE-only
        # overrides never forwarded.
        _, kwargs = session.post.call_args
        assert kwargs["headers"]["X-API-Key"] == "sk_test"
        assert kwargs["json"] == {"q": "site:example.com topic", "num": 5, "hl": "en", "gl": "us"}

    def test_ignores_cse_overrides_and_forwards_optional_params(self, service):
        session = _fake_session(body={"organic": []})
        with patch.object(serpingapi_service, "_get_session", return_value=session):
            asyncio.run(
                service.perform_search(
                    "q", 10, dateRestrict=None, sort=None, gl="de", hl="de", tbs="qdr:m"
                )
            )
        _, kwargs = session.post.call_args
        assert kwargs["json"] == {"q": "q", "num": 10, "hl": "de", "gl": "de", "tbs": "qdr:m"}
        assert "dateRestrict" not in kwargs["json"]

    def test_missing_or_null_organic_yields_empty_list(self, service):
        for body in ({}, {"organic": None}, {"answerBox": {"answer": "x"}}):
            session = _fake_session(body=body)
            with patch.object(serpingapi_service, "_get_session", return_value=session):
                assert asyncio.run(service.perform_search("q")) == []

    def test_non_200_raises_runtime_error_with_api_code(self, service):
        body = {"error": {"code": "quota_exceeded", "message": "Monthly quota reached."}}
        session = _fake_session(status=429, body=body)
        with patch.object(serpingapi_service, "_get_session", return_value=session):
            with pytest.raises(RuntimeError, match="429 \\(quota_exceeded\\)"):
                asyncio.run(service.perform_search("q"))

    def test_non_json_error_body_is_handled(self, service):
        session = _fake_session(status=502, body=None, text="<html>Bad gateway</html>")
        with patch.object(serpingapi_service, "_get_session", return_value=session):
            with pytest.raises(RuntimeError, match="502"):
                asyncio.run(service.perform_search("q"))


class TestSerpGapServiceProviderSelection:
    def test_serpingapi_used_when_only_its_key_is_set(self, monkeypatch):
        monkeypatch.delenv("SERPBASE_API_KEY", raising=False)
        monkeypatch.setenv("SERPINGAPI_API_KEY", "sk_test")
        from services.seo_tools.serp_gap_service import SerpGapService

        gap = SerpGapService(google_search_service=MagicMock())
        assert gap.serpbase.enabled is False
        assert gap.serpingapi.enabled is True

        gap.serpingapi.perform_search = AsyncMock(
            return_value=[{"title": "t", "link": "https://c.com/a", "snippet": "s", "position": 1}]
        )
        result = asyncio.run(gap._analyze_single_topic("topic", ["c.com"], 5))
        gap.serpingapi.perform_search.assert_awaited_once_with("site:c.com topic", 5)
        assert result["competitor_count"] == 1
        assert result["domains_with_content"] == ["c.com"]
        gap.gcs.perform_search.assert_not_called()

    def test_cse_used_when_no_provider_key(self, monkeypatch):
        monkeypatch.delenv("SERPBASE_API_KEY", raising=False)
        monkeypatch.delenv("SERPINGAPI_API_KEY", raising=False)
        from services.seo_tools.serp_gap_service import SerpGapService

        gcs = MagicMock()
        gcs.perform_search = AsyncMock(return_value=[])
        gap = SerpGapService(google_search_service=gcs)
        asyncio.run(gap._analyze_single_topic("topic", ["c.com"], 5))
        gcs.perform_search.assert_awaited_once()
