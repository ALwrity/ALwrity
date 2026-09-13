"""Phase 3C: strategy block surfaces in the LLM fallback prompt (TDD)."""
from unittest.mock import patch

from services.today_workflow_agents import _format_strategy_block_for_prompt


def test_helper_returns_block_when_available():
    block = _format_strategy_block_for_prompt({
        "strategy_context": {
            "status": "available", "name": "DocuTech",
            "summary": "Grow organic visibility.",
            "kpi_targets": [{"metric": "visibility_score", "target": "70"}],
            "roadmap": [], "goals": [], "positioning": "",
        },
    })
    assert "Strategy focus (DocuTech)" in block
    assert "visibility_score" in block


def test_helper_blank_when_inactive_or_missing():
    assert _format_strategy_block_for_prompt(
        {"strategy_context": {"status": "inactive"}}) == ""
    assert _format_strategy_block_for_prompt({}) == ""
    assert _format_strategy_block_for_prompt(
        {"strategy_context": {"status": "error"}}) == ""


def test_helper_degrades_not_crashes_on_render_failure():
    with patch(
        "services.strategy_context.format_strategy_block",
        side_effect=RuntimeError("boom"),
    ):
        assert _format_strategy_block_for_prompt(
            {"strategy_context": {"status": "available"}}) == ""