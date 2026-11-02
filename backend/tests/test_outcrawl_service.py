"""
Tests for the optional Outcrawl search provider.

OutcrawlService must return results in the GoogleSearchService.perform_search
shape (title/link/snippet/position) so SerpGapService can use it unchanged, and
SerpGapService must only pick it when OUTCRAWL_API_KEY is set and SerpBase is not.
No network: the shared aiohttp session is replaced with a fake.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from services.seo_tools import outcrawl_service
from services.seo_tools.outcrawl_service import OutcrawlService
from services.seo_tools.serp_gap_service import SerpGapService


class _FakeResponse:
    def __init__(self, status=200, payload=None, text=""):
        self.status = status
        self._payload = payload
        self._text = text

    async def json(self, content_type=None):
        return self._payload

    async def text(self):
        return self._text

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class _FakeSession:
    def __init__(self, response):
        self.response = response
        self.calls = []
        self.closed = False

    def post(self, url, json=None, headers=None, timeout=None):
        self.calls.append({"url": url, "json": json, "headers": headers})
        return self.response


@pytest.fixture
def fake_session(monkeypatch):
    def install(response):
        session = _FakeSession(response)
        monkeypatch.setattr(outcrawl_service, "_session", session)
        return session

    return install


@pytest.fixture
def enabled(monkeypatch):
    monkeypatch.setenv("OUTCRAWL_API_KEY", "oc-test-key")
    return OutcrawlService()


class TestOutcrawlService:
    def test_disabled_without_key(self, monkeypatch):
        monkeypatch.delenv("OUTCRAWL_API_KEY", raising=False)
        service = OutcrawlService()
        assert service.enabled is False
        with pytest.raises(RuntimeError, match="OUTCRAWL_API_KEY"):
            asyncio.run(service.perform_search("site:example.com seo"))

    def test_maps_hits_to_cse_shape(self, enabled, fake_session):
        payload = {
            "hits": [
                {
                    "url": "https://example.com/a",
                    "title": "A",
                    "snippet": "first",
                    "rank": 1,
                },
                {"url": "https://example.com/b", "title": "B", "snippet": "second"},
                "not-a-dict",
            ],
            "usage": {"credits": "0.5"},
        }
        fake_session(_FakeResponse(payload=payload))
        items = asyncio.run(enabled.perform_search("site:example.com seo", 5))
        assert items == [
            {
                "title": "A",
                "link": "https://example.com/a",
                "snippet": "first",
                "position": 1,
            },
            {
                "title": "B",
                "link": "https://example.com/b",
                "snippet": "second",
                "position": 2,
            },
        ]

    def test_request_shape_and_ignored_cse_overrides(self, enabled, fake_session):
        session = fake_session(_FakeResponse(payload={"hits": []}))
        asyncio.run(
            enabled.perform_search(
                "site:example.com seo", 10, dateRestrict=None, sort=None
            )
        )
        call = session.calls[0]
        assert call["url"] == "https://api.outcrawl.ai/v1/search"
        assert call["json"] == {"query": "site:example.com seo", "limit": 10}
        assert call["headers"]["Authorization"] == "Bearer oc-test-key"

    @pytest.mark.parametrize("requested,sent", [(50, 20), (0, 1), (7, 7)])
    def test_limit_is_clamped(self, enabled, fake_session, requested, sent):
        session = fake_session(_FakeResponse(payload={"hits": []}))
        asyncio.run(enabled.perform_search("q", requested))
        assert session.calls[0]["json"]["limit"] == sent

    def test_null_hits_is_empty(self, enabled, fake_session):
        fake_session(_FakeResponse(payload={"hits": None}))
        assert asyncio.run(enabled.perform_search("q")) == []

    def test_non_200_raises(self, enabled, fake_session):
        fake_session(_FakeResponse(status=402, text="<html>out of credits</html>"))
        with pytest.raises(RuntimeError, match="status 402"):
            asyncio.run(enabled.perform_search("q"))


class TestSerpGapProviderSelection:
    def _service(self, monkeypatch, serpbase_key, outcrawl_key):
        for name, value in (
            ("SERPBASE_API_KEY", serpbase_key),
            ("OUTCRAWL_API_KEY", outcrawl_key),
        ):
            if value:
                monkeypatch.setenv(name, value)
            else:
                monkeypatch.delenv(name, raising=False)
        gcs = MagicMock()
        gcs.perform_search = AsyncMock(return_value=[])
        service = SerpGapService(google_search_service=gcs)
        service.serpbase.perform_search = AsyncMock(return_value=[])
        service.outcrawl.perform_search = AsyncMock(
            return_value=[
                {"title": "A", "link": "https://example.com/a", "snippet": "s"}
            ]
        )
        return service, gcs

    def test_outcrawl_used_when_only_its_key_is_set(self, monkeypatch):
        service, gcs = self._service(monkeypatch, None, "oc-test-key")
        result = asyncio.run(service._analyze_single_topic("seo", ["example.com"], 5))
        service.outcrawl.perform_search.assert_awaited_once_with(
            "site:example.com seo", 5
        )
        gcs.perform_search.assert_not_awaited()
        assert result["competitor_count"] == 1
        assert result["competitors_found"][0]["url"] == "https://example.com/a"

    def test_serpbase_keeps_priority(self, monkeypatch):
        service, gcs = self._service(monkeypatch, "sb-test-key", "oc-test-key")
        asyncio.run(service._analyze_single_topic("seo", ["example.com"], 5))
        service.serpbase.perform_search.assert_awaited_once()
        service.outcrawl.perform_search.assert_not_awaited()

    def test_cse_default_without_keys(self, monkeypatch):
        service, gcs = self._service(monkeypatch, None, None)
        asyncio.run(service._analyze_single_topic("seo", ["example.com"], 5))
        gcs.perform_search.assert_awaited_once()
        service.outcrawl.perform_search.assert_not_awaited()
