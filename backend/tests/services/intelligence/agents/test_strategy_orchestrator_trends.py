"""TDD tests for Tavily-backed _google_trends_fetcher_tool in StrategyOrchestratorAgent."""
from __future__ import annotations

import pytest

from services.intelligence.agents.core_agent_framework import (
    StrategyOrchestratorAgent,
    _build_market_trends_envelope,
)
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


class _FakeIntelligence:
    instances = []

    def __init__(self, user_id):
        self.user_id = user_id
        self.indexed = []
        _FakeIntelligence.instances.append(self)

    async def index_content(self, items):
        self.indexed.extend(items)
        return len(items)


def _make_agent(provider):
    agent = object.__new__(StrategyOrchestratorAgent)
    agent.user_id = "u1"
    agent.trend_provider = provider
    return agent


class TestBuildMarketTrendsEnvelope:
    def test_builds_envelope(self):
        items = [TrendItem(topic="AI", title="AI")]
        report = {"summary": "s", "trends": []}
        env = _build_market_trends_envelope(
            ["AI"], "today 12-m", "US", items, report, now="2026-08-31T00:00:00Z"
        )
        assert env["keywords"] == ["AI"]
        assert env["geo"] == "US"
        assert env["timeframe"] == "today 12-m"
        assert env["timestamp"] == "2026-08-31T00:00:00Z"
        assert env["cached"] is False
        assert env["source"] == "tavily"
        assert len(env["items"]) == 1
        assert env["synthesis"] == report


class TestGoogleTrendsFetcherTool:
    @pytest.mark.asyncio
    async def test_fetches_synthesizes_and_indexes(self, monkeypatch):
        _FakeIntelligence.instances = []
        items = [TrendItem(topic="AI agents", title="AI agents", snippet="s")]
        provider = _FakeProvider(items=items)
        agent = _make_agent(provider)

        report = {"summary": "s", "trends": [{"topic": "AI agents", "suggested_angle": "x"}]}

        async def fake_synthesize(items, platform, user_id=None, focus=""):
            return report

        monkeypatch.setattr(
            "services.intelligence.agents.core_agent_framework.synthesize_trends", fake_synthesize
        )
        monkeypatch.setattr(
            "services.intelligence.txtai_service.TxtaiIntelligenceService", _FakeIntelligence
        )

        result = await agent._google_trends_fetcher_tool({"keywords": ["AI agents"]})

        assert result["success"] is True
        assert result["keywords"] == ["AI agents"]
        assert len(_FakeIntelligence.instances) == 1
        assert len(_FakeIntelligence.instances[0].indexed) == 2  # latest + run docs

    @pytest.mark.asyncio
    async def test_missing_keywords_returns_error(self):
        agent = _make_agent(_FakeProvider())
        result = await agent._google_trends_fetcher_tool({"keywords": []})
        assert result["success"] is False
        assert "keywords is required" in result["error"]

    @pytest.mark.asyncio
    async def test_provider_error_returns_error(self):
        agent = _make_agent(_FakeProvider(raise_error=True))
        result = await agent._google_trends_fetcher_tool({"keywords": ["AI"]})
        assert result["success"] is False
