"""TDD tests for the Tavily-backed MarketTrendsExecutor."""
from __future__ import annotations

import pytest

from services.research.trends.trend_provider import TrendItem
from services.scheduler.executors.market_trends_executor import MarketTrendsExecutor


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


def _make_executor(provider):
    executor = object.__new__(MarketTrendsExecutor)
    executor.trend_provider = provider
    return executor


class TestBuildTrendsResult:
    @pytest.mark.asyncio
    async def test_empty_keywords_returns_error_envelope(self):
        executor = _make_executor(_FakeProvider())
        result = await executor._build_trends_result([], "US", "today 12-m", "u1")
        assert result.get("error") == "No keywords available for market trends run"
        assert result["keywords"] == []

    @pytest.mark.asyncio
    async def test_success_envelope(self, monkeypatch):
        items = [TrendItem(topic="AI agents", title="AI agents", snippet="s")]
        provider = _FakeProvider(items=items)
        executor = _make_executor(provider)

        report = {"summary": "s", "trends": [{"topic": "AI agents", "suggested_angle": "x"}]}

        async def fake_synthesize(items, platform, user_id=None, focus=""):
            return report

        monkeypatch.setattr(
            "services.scheduler.executors.market_trends_executor.synthesize_trends", fake_synthesize
        )
        result = await executor._build_trends_result(["AI agents"], "US", "today 12-m", "u1")

        assert result["keywords"] == ["AI agents"]
        assert result["geo"] == "US"
        assert result["timeframe"] == "today 12-m"
        assert result["timestamp"]
        assert result["cached"] is False
        assert result["source"] == "tavily"
        assert len(result["items"]) == 1
        assert result["synthesis"] == report

    @pytest.mark.asyncio
    async def test_passes_keywords_to_provider(self, monkeypatch):
        provider = _FakeProvider(items=[])
        executor = _make_executor(provider)

        async def fake_synthesize(items, platform, user_id=None, focus=""):
            return {"summary": "", "trends": []}

        monkeypatch.setattr(
            "services.scheduler.executors.market_trends_executor.synthesize_trends", fake_synthesize
        )
        await executor._build_trends_result(["AI"], "US", "today 12-m", "u1")
        assert provider.calls[0]["keywords"] == ["AI"]
        assert provider.calls[0]["user_id"] == "u1"

    @pytest.mark.asyncio
    async def test_provider_error_returns_error_envelope(self):
        executor = _make_executor(_FakeProvider(raise_error=True))
        result = await executor._build_trends_result(["AI"], "US", "today 12-m", "u1")
        assert "error" in result
        assert result["keywords"] == ["AI"]

    @pytest.mark.asyncio
    async def test_envelope_compatible_with_sif_index(self, monkeypatch):
        items = [TrendItem(topic="AI", title="AI", snippet="s")]
        provider = _FakeProvider(items=items)
        executor = _make_executor(provider)

        async def fake_synthesize(items, platform, user_id=None, focus=""):
            return {"summary": "", "trends": []}

        monkeypatch.setattr(
            "services.scheduler.executors.market_trends_executor.synthesize_trends", fake_synthesize
        )
        result = await executor._build_trends_result(["AI"], "US", "today 12-m", "u1")

        # Keys that index_market_trends_run reads for its envelope.
        for key in ("keywords", "timestamp", "geo", "timeframe"):
            assert key in result, f"missing {key} for SIF index compatibility"
