"""TDD tests for the Tavily-backed research trends helper."""
from __future__ import annotations

import pytest

from api.research.utils import _fetch_research_trends
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


class TestFetchResearchTrends:
    @pytest.mark.asyncio
    async def test_returns_new_shape(self, monkeypatch):
        items = [TrendItem(topic="AI", title="AI", snippet="s")]
        report = {
            "summary": "s",
            "trends": [{"topic": "AI", "momentum": "rising", "suggested_angle": "x"}],
        }

        async def fake_synthesize(items, platform, user_id=None, focus=""):
            return report

        monkeypatch.setattr("api.research.utils.synthesize_trends", fake_synthesize)
        result = await _fetch_research_trends(
            ["AI"], "today 12-m", "US", "u1", provider=_FakeProvider(items=items)
        )

        assert result["keywords"] == ["AI"]
        assert result["timeframe"] == "today 12-m"
        assert result["geo"] == "US"
        assert result["summary"] == "s"
        assert result["trends"] == report["trends"]
        assert len(result["items"]) == 1
        assert "interest_over_time" not in result

    @pytest.mark.asyncio
    async def test_passes_keywords_and_user(self, monkeypatch):
        provider = _FakeProvider(items=[])

        async def fake_synthesize(items, platform, user_id=None, focus=""):
            return {"summary": "", "trends": []}

        monkeypatch.setattr("api.research.utils.synthesize_trends", fake_synthesize)
        await _fetch_research_trends(["AI"], "today 12-m", "US", "u1", provider=provider)
        assert provider.calls[0]["keywords"] == ["AI"]
        assert provider.calls[0]["user_id"] == "u1"

    @pytest.mark.asyncio
    async def test_no_items_returns_empty(self, monkeypatch):
        async def fake_synthesize(items, platform, user_id=None, focus=""):
            return {"summary": "", "trends": []}

        monkeypatch.setattr("api.research.utils.synthesize_trends", fake_synthesize)
        result = await _fetch_research_trends(["AI"], "today 12-m", "US", "u1", provider=_FakeProvider(items=[]))
        assert result["trends"] == []
        assert result["items"] == []
