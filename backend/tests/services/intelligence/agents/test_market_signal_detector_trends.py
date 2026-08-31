"""TDD tests for Tavily-backed trending topics in MarketSignalDetector."""
from __future__ import annotations

import pytest

from services.intelligence.agents.market_signal_detector import MarketSignalDetector
from services.research.trends.trend_provider import TrendItem


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


def _make_detector(provider, keywords):
    detector = object.__new__(MarketSignalDetector)
    detector.user_id = "u1"
    detector.trend_provider = provider
    detector._extract_trend_keywords = lambda integrated: keywords
    return detector


class TestLoadTrendingTopics:
    @pytest.mark.asyncio
    async def test_returns_empty_when_no_keywords(self):
        detector = _make_detector(_FakeProvider(), [])
        assert await detector._load_trending_topics({}) == []

    @pytest.mark.asyncio
    async def test_maps_tavily_items_to_topics_sorted_by_score(self):
        items = [
            TrendItem(topic="AI agents", title="AI agents", score=0.9),
            TrendItem(topic="SEO", title="SEO", score=0.4),
        ]
        provider = _FakeProvider(items=items)
        detector = _make_detector(provider, ["AI agents", "SEO"])
        topics = await detector._load_trending_topics({})
        assert len(topics) == 2
        assert topics[0]["topic"] == "AI agents"
        assert topics[0]["trend_score"] == 0.9
        assert topics[0]["platforms"] == ["tavily"]

    @pytest.mark.asyncio
    async def test_topic_shape_consumed_by_social_signals(self):
        items = [TrendItem(topic="AI", title="AI", score=0.7)]
        provider = _FakeProvider(items=items)
        detector = _make_detector(provider, ["AI"])
        topics = await detector._load_trending_topics({})
        topic = topics[0]
        for key in ("topic", "trend_score", "interest_level", "sample_points", "platforms"):
            assert key in topic, f"missing {key} for social-signal consumption"

    @pytest.mark.asyncio
    async def test_returns_empty_on_provider_error(self):
        provider = _FakeProvider(raise_error=True)
        detector = _make_detector(provider, ["AI"])
        assert await detector._load_trending_topics({}) == []

    @pytest.mark.asyncio
    async def test_passes_keywords_and_user(self):
        provider = _FakeProvider(items=[])
        detector = _make_detector(provider, ["AI", "SEO"])
        await detector._load_trending_topics({})
        call = provider.calls[0]
        assert call["keywords"] == ["AI", "SEO"]
        assert call["user_id"] == "u1"
