import pytest

from services.intelligence.agents.specialized.content_strategy import ContentStrategyAgent
from services.intelligence.agents.tool_contracts import tool_result


def make_agent():
    agent = object.__new__(ContentStrategyAgent)
    agent.user_id = "user-1"
    agent.sif_service = None
    return agent


def test_gsc_low_ctr_queries_returns_rows_as_evidence():
    agent = make_agent()
    agent._gsc_result = lambda context: tool_result(
        "success",
        "gsc",
        data={"metrics": {"top_queries": [
            {"query": "low ctr", "ctr": 1.2},
            {"query": "healthy", "ctr": 5.0},
        ]}},
    )

    result = agent._cs_gsc_low_ctr_queries_tool_sync({"limit": 1})

    assert result["status"] == "success"
    assert result["data"]["items"] == [{"query": "low ctr", "ctr": 1.2}]
    assert result["evidence"] == result["data"]["items"]


def test_content_analyzer_combines_gsc_sif_and_asset_evidence():
    agent = make_agent()
    agent._gsc_result = lambda context: tool_result(
        "success",
        "gsc",
        data={"metrics": {"top_pages": [{"page": "/guide", "ctr": 1.0}]}},
        freshness={"date_range": {"start": "2026-01-01"}},
    )
    agent._content_asset_evidence = lambda context: tool_result(
        "success",
        "content_asset_library",
        data={"total_text_assets": 2, "published_assets": 1},
        evidence=[{"id": "asset-1"}],
    )
    intelligence = type("Intelligence", (), {"search": lambda self, *args, **kwargs: object()})()
    agent.sif_service = type("SIF", (), {"intelligence_service": intelligence})()
    agent._run_async_tool = lambda coroutine: [{"id": "topic-1", "text": "missing topic", "score": 0.8}]

    result = agent._content_analyzer_tool_sync({"target_url": "https://example.com/guide"})

    assert result["status"] == "success"
    assert result["data"]["content_inventory"]["published_assets"] == 1
    assert result["data"]["identified_gaps"] == [{"text": "missing topic", "score": 0.8}]
    assert result["data"]["strategic_recommendations"]
    assert result["evidence"]


def test_content_analyzer_reports_unavailable_without_any_source():
    agent = make_agent()
    agent._gsc_result = lambda context: {"status": "unavailable", "limitations": ["GSC not connected"]}
    agent._content_asset_evidence = lambda context: {"status": "unavailable", "limitations": ["database unavailable"]}

    result = agent._content_analyzer_tool_sync({})

    assert result["status"] == "unavailable"


def test_content_optimizer_requires_content(monkeypatch):
    agent = make_agent()

    result = agent._content_optimizer_tool_sync({"optimization_goal": "increase CTR"})

    assert result["status"] == "unavailable"
    assert "content is required" in result["limitations"]


def test_content_optimizer_returns_generated_content_and_quality_decision(monkeypatch):
    agent = make_agent()
    monkeypatch.setattr(
        "services.intelligence.agents.specialized.content_strategy.llm_text_gen",
        lambda **kwargs: "A substantially improved article with clear search intent.",
    )

    result = agent._content_optimizer_tool_sync({"content": "Original", "target_url": "/guide"})

    assert result["status"] == "success"
    assert result["data"]["optimized_content"].startswith("A substantially")
    assert result["data"]["quality_decision"]["passed"] is True


@pytest.mark.parametrize(
    "method_name,metrics_key",
    [
        ("_cs_gsc_striking_distance_tool_sync", "top_queries"),
        ("_cs_gsc_declining_queries_tool_sync", "declining_queries"),
        ("_cs_gsc_low_ctr_pages_tool_sync", "top_pages"),
        ("_cs_gsc_cannibalization_candidates_tool_sync", "cannibalization"),
    ],
)
def test_gsc_tools_return_no_data_when_provider_has_empty_metrics(method_name, metrics_key):
    agent = make_agent()
    agent._gsc_result = lambda context: tool_result("success", "gsc", data={"metrics": {metrics_key: []}})

    result = getattr(agent, method_name)({})

    assert result["status"] == "success"
    assert result["data"]["items"] == []
    assert result["evidence"] == []
