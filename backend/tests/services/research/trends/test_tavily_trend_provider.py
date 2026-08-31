"""Tests for the Tavily-backed TrendProvider."""
from __future__ import annotations

import pytest

from services.research.trends.trend_provider import TrendItem, TrendPlatform
from services.research.trends.tavily_trend_provider import TavilyTrendProvider


class _FakeTavilyService:
    def __init__(self, enabled: bool, results_by_query=None):
        self.enabled = enabled
        self.api_key = "test-key" if enabled else None
        self._results_by_query = results_by_query or {}
        self.calls = []

    async def search(self, query, **kwargs):
        self.calls.append({"query": query, **kwargs})
        results = self._results_by_query.get(query, [])
        return {"success": True, "results": results}


def _result(title, url="", score=0.5, published_date=None, content=""):
    return {
        "title": title,
        "url": url,
        "domain": "example.com",
        "score": score,
        "relevance_score": score,
        "published_date": published_date,
        "content": content,
    }


class TestAvailability:
    @pytest.mark.asyncio
    async def test_returns_empty_when_key_missing(self):
        provider = TavilyTrendProvider(service=_FakeTavilyService(enabled=False))
        items = await provider.fetch_trends(TrendPlatform.WEB, industry="SaaS")
        assert items == []


class TestFetchTrends:
    @pytest.mark.asyncio
    async def test_maps_results_to_trend_items(self):
        service = _FakeTavilyService(
            enabled=True,
            results_by_query={
                "SaaS trends": [_result("AI agents reshape SaaS", score=0.9, published_date="2026-08-30")]
            },
        )
        provider = TavilyTrendProvider(service=service)
        items = await provider.fetch_trends(TrendPlatform.WEB, industry="SaaS")
        assert len(items) == 1
        item = items[0]
        assert isinstance(item, TrendItem)
        assert item.topic == "AI agents reshape SaaS"
        assert item.platform == TrendPlatform.WEB.value
        assert item.source == "tavily"

    @pytest.mark.asyncio
    async def test_dedupes_and_sorts_by_score(self):
        service = _FakeTavilyService(
            enabled=True,
            results_by_query={
                "a trends": [
                    _result("Low", url="http://a.com/low", score=0.3),
                    _result("High", url="http://a.com/high", score=0.9),
                    _result("High", url="http://a.com/high", score=0.9),
                ]
            },
        )
        provider = TavilyTrendProvider(service=service)
        items = await provider.fetch_trends(TrendPlatform.WEB, keywords=["a"])
        assert [i.title for i in items] == ["High", "Low"]
        assert len(items) == 2

    @pytest.mark.asyncio
    async def test_youtube_targets_youtube_domain(self):
        service = _FakeTavilyService(enabled=True)
        provider = TavilyTrendProvider(service=service)
        await provider.fetch_trends(TrendPlatform.YOUTUBE, keywords=["coding"])
        call = service.calls[0]
        assert call["include_domains"] == ["youtube.com"]
        assert call["topic"] == "news"
        assert "youtube" in call["query"]

    @pytest.mark.asyncio
    async def test_news_platform_uses_news_topic_and_week_range(self):
        service = _FakeTavilyService(enabled=True)
        provider = TavilyTrendProvider(service=service)
        await provider.fetch_trends(TrendPlatform.NEWS, keywords=["ai"])
        call = service.calls[0]
        assert call["topic"] == "news"
        assert call["time_range"] == "week"

    @pytest.mark.asyncio
    async def test_caps_number_of_searches(self):
        service = _FakeTavilyService(enabled=True)
        provider = TavilyTrendProvider(service=service)
        await provider.fetch_trends(TrendPlatform.WEB, keywords=["a", "b", "c", "d", "e"])
        assert len(service.calls) <= 3

    @pytest.mark.asyncio
    async def test_search_failure_is_ignored(self):
        service = _FakeTavilyService(enabled=True)

        async def failing_search(query, **kwargs):
            service.calls.append({"query": query, **kwargs})
            return {"success": False, "error": "boom"}

        service.search = failing_search
        provider = TavilyTrendProvider(service=service)
        items = await provider.fetch_trends(TrendPlatform.WEB, keywords=["a"])
        assert items == []
