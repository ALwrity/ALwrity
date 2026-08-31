"""Tests for single-LLM trend synthesis."""
from __future__ import annotations

import pytest

from services.research.trends.trend_provider import TrendItem, TrendPlatform
from services.research.trends.trend_synthesis import synthesize_trends


def _item(title, snippet="", published_date=None):
    return TrendItem(topic=title, title=title, snippet=snippet, published_date=published_date)


class TestSynthesizeTrends:
    @pytest.mark.asyncio
    async def test_empty_items_returns_empty_report(self):
        result = await synthesize_trends([], TrendPlatform.WEB)
        assert result == {"summary": "", "trends": []}

    @pytest.mark.asyncio
    async def test_parses_json_result(self, monkeypatch):
        fake = {"summary": "AI is trending", "trends": [{"topic": "AI", "suggested_angle": "Write about it"}]}

        def fake_llm(prompt=None, json_struct=None, user_id=None, flow_type=None):
            import json
            return json.dumps(fake)

        monkeypatch.setattr("services.research.trends.trend_synthesis.llm_text_gen", fake_llm)
        result = await synthesize_trends([_item("AI")], TrendPlatform.WEB, user_id="u1")
        assert result == fake

    @pytest.mark.asyncio
    async def test_parses_dict_result(self, monkeypatch):
        fake = {"summary": "s", "trends": []}

        def fake_llm(**kwargs):
            return fake

        monkeypatch.setattr("services.research.trends.trend_synthesis.llm_text_gen", fake_llm)
        result = await synthesize_trends([_item("AI")], TrendPlatform.WEB)
        assert result == fake

    @pytest.mark.asyncio
    async def test_llm_failure_returns_empty_report(self, monkeypatch):
        def fake_llm(**kwargs):
            raise RuntimeError("LLM down")

        monkeypatch.setattr("services.research.trends.trend_synthesis.llm_text_gen", fake_llm)
        result = await synthesize_trends([_item("AI")], TrendPlatform.WEB)
        assert result == {"summary": "", "trends": []}

    @pytest.mark.asyncio
    async def test_invalid_json_returns_empty_report(self, monkeypatch):
        def fake_llm(**kwargs):
            return "not json"

        monkeypatch.setattr("services.research.trends.trend_synthesis.llm_text_gen", fake_llm)
        result = await synthesize_trends([_item("AI")], TrendPlatform.WEB)
        assert result == {"summary": "", "trends": []}
