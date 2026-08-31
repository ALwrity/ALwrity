"""TDD tests for the Tavily-backed podcast trends endpoint helpers."""
from __future__ import annotations

import pytest

from api.podcast.handlers.trends import _fetch_podcast_trends, _map_source_to_platform
from services.research.trends.trend_provider import TrendItem, TrendPlatform


class TestMapSourceToPlatform:
    def test_web_sources_map_to_web(self):
        assert _map_source_to_platform("web") == TrendPlatform.WEB
        assert _map_source_to_platform("") == TrendPlatform.WEB

    def test_podcast_maps_to_podcast(self):
        assert _map_source_to_platform("podcast") == TrendPlatform.PODCAST

    def test_news_images_shopping(self):
        assert _map_source_to_platform("news") == TrendPlatform.NEWS
        assert _map_source_to_platform("images") == TrendPlatform.IMAGES
        assert _map_source_to_platform("shopping") == TrendPlatform.SHOPPING

    def test_unknown_defaults_to_web(self):
        assert _map_source_to_platform("garbage") == TrendPlatform.WEB


class _FakeProvider:
    def __init__(self, items=None, raise_error=False):
        self._items = items or []
        self.raise_error = raise_error
        self.calls = []

    async def fetch_trends(self, platform, industry="", keywords=None, max_results=10, user_id=None):
        self.calls.append(
            {"platform": platform, "industry": industry, "keywords": keywords, "user_id": user_id}
        )
        if self.raise_error:
            raise RuntimeError("provider down")
        return self._items


class TestFetchPodcastTrends:
    @pytest.mark.asyncio
    async def test_returns_new_shape(self, monkeypatch):
        items = [TrendItem(topic="AI podcasts", title="AI podcasts", snippet="s")]
        provider = _FakeProvider(items=items)
        report = {
            "summary": "s",
            "trends": [{"topic": "AI podcasts", "momentum": "rising", "suggested_angle": "x"}],
        }

        async def fake_synthesize(items, platform, user_id=None, focus=""):
            return report

        monkeypatch.setattr("api.podcast.handlers.trends.synthesize_trends", fake_synthesize)
        result = await _fetch_podcast_trends(
            provider, ["AI podcasts"], "podcast", "today 12-m", "US", "u1"
        )

        assert result["keywords"] == ["AI podcasts"]
        assert result["source"] == "podcast"
        assert result["platform"] == "podcast"
        assert result["trends"] == report["trends"]
        assert result["summary"] == "s"
        assert len(result["items"]) == 1
        # no legacy time-series keys
        assert "interest_over_time" not in result

    @pytest.mark.asyncio
    async def test_passes_platform_to_provider(self, monkeypatch):
        provider = _FakeProvider(items=[])

        async def fake_synthesize(items, platform, user_id=None, focus=""):
            return {"summary": "", "trends": []}

        monkeypatch.setattr("api.podcast.handlers.trends.synthesize_trends", fake_synthesize)
        await _fetch_podcast_trends(provider, ["AI"], "podcast", "today 12-m", "US", "u1")
        assert provider.calls[0]["platform"] == TrendPlatform.PODCAST

    @pytest.mark.asyncio
    async def test_no_items_returns_empty_trends(self, monkeypatch):
        provider = _FakeProvider(items=[])

        async def fake_synthesize(items, platform, user_id=None, focus=""):
            return {"summary": "", "trends": []}

        monkeypatch.setattr("api.podcast.handlers.trends.synthesize_trends", fake_synthesize)
        result = await _fetch_podcast_trends(provider, ["AI"], "web", "today 12-m", "US", "u1")
        assert result["trends"] == []
        assert result["items"] == []
