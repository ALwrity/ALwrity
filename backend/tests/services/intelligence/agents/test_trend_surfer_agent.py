"""TDD tests for the Tavily-backed TrendSurferAgent."""
from __future__ import annotations

import pytest

from services.intelligence.agents.trend_surfer_agent import (
    TrendSurferAgent,
    _momentum_to_impact,
    _momentum_to_urgency,
    build_trend_opportunities,
)
from services.research.trends.trend_provider import TrendItem


class TestMomentumHelpers:
    def test_momentum_to_urgency(self):
        assert _momentum_to_urgency("rising") == "high"
        assert _momentum_to_urgency("stable") == "medium"
        assert _momentum_to_urgency("declining") == "low"
        assert _momentum_to_urgency("") == "medium"
        assert _momentum_to_urgency(None) == "medium"

    def test_momentum_to_impact(self):
        assert _momentum_to_impact("rising") == 0.8
        assert _momentum_to_impact("stable") == 0.5
        assert _momentum_to_impact("declining") == 0.3
        assert _momentum_to_impact("") == 0.5


class TestBuildTrendOpportunities:
    def test_maps_report_to_opportunities(self):
        report = {
            "summary": "s",
            "trends": [
                {
                    "topic": "AI agents",
                    "momentum": "rising",
                    "why_it_matters": "reshapes SaaS",
                    "suggested_angle": "Write about AI agents",
                }
            ],
        }
        opps = build_trend_opportunities(report, [], now="2026-08-31T00:00:00Z")
        assert len(opps) == 1
        opp = opps[0]
        assert opp["topic"] == "AI agents"
        assert opp["suggested_angle"] == "Write about AI agents"
        assert opp["why_it_matters"] == "reshapes SaaS"
        assert opp["urgency"] == "high"
        assert opp["impact_score"] == 0.8
        assert opp["source"] == "tavily"
        assert opp["detected_at"] == "2026-08-31T00:00:00Z"

    def test_skips_empty_topics(self):
        report = {
            "trends": [
                {"topic": "", "suggested_angle": "skip"},
                {"topic": "Valid", "suggested_angle": "keep"},
            ]
        }
        opps = build_trend_opportunities(report, [])
        assert [o["topic"] for o in opps] == ["Valid"]

    def test_handles_missing_trends_key(self):
        assert build_trend_opportunities({"summary": "s"}, []) == []
        assert build_trend_opportunities({}, []) == []


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


class TestSurfTrends:
    def _make_agent(self, provider):
        agent = object.__new__(TrendSurferAgent)
        agent.user_id = "u1"
        agent.trend_provider = provider
        agent._trend_context = lambda: ("SaaS", ["AI agents"])
        return agent

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_items(self):
        provider = _FakeProvider(items=[])
        agent = self._make_agent(provider)
        assert await agent.surf_trends() == []

    @pytest.mark.asyncio
    async def test_passes_context_to_provider(self, monkeypatch):
        provider = _FakeProvider(items=[])
        agent = self._make_agent(provider)

        async def fake_synthesize(*args, **kwargs):
            return {"summary": "", "trends": []}

        monkeypatch.setattr(
            "services.intelligence.agents.trend_surfer_agent.synthesize_trends", fake_synthesize
        )
        await agent.surf_trends()
        call = provider.calls[0]
        assert call["industry"] == "SaaS"
        assert call["keywords"] == ["AI agents"]
        assert call["user_id"] == "u1"

    @pytest.mark.asyncio
    async def test_returns_opportunities_from_synthesis(self, monkeypatch):
        items = [TrendItem(topic="AI agents", title="AI agents", snippet="s")]
        provider = _FakeProvider(items=items)
        agent = self._make_agent(provider)

        report = {
            "summary": "s",
            "trends": [
                {
                    "topic": "AI agents",
                    "momentum": "rising",
                    "why_it_matters": "x",
                    "suggested_angle": "Write about it",
                }
            ],
        }

        async def fake_synthesize(items, platform, user_id=None, focus=""):
            return report

        monkeypatch.setattr(
            "services.intelligence.agents.trend_surfer_agent.synthesize_trends", fake_synthesize
        )
        result = await agent.surf_trends()
        assert len(result) == 1
        assert result[0]["topic"] == "AI agents"
        assert result[0]["suggested_angle"] == "Write about it"

    @pytest.mark.asyncio
    async def test_returns_empty_on_provider_error(self):
        provider = _FakeProvider(raise_error=True)
        agent = self._make_agent(provider)
        assert await agent.surf_trends() == []
