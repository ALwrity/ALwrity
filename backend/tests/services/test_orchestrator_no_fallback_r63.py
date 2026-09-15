"""R6.3 (H5) — NO silent generic fallback calendars.

`orchestrator._get_comprehensive_user_data` previously caught every
exception and returned placeholder inputs (industry "technology", empty
strategy/onboarding) — users got plausible but UNGROUNDED calendars from
infrastructure failures (repo no-mock policy violation).

Contract: a comprehensive-data failure PROPAGATES as an explicit
RuntimeError the orchestration can fail on; no placeholder dict is ever
produced.
"""
from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from services.calendar_generation_datasource_framework.prompt_chaining.orchestrator import (
    PromptChainOrchestrator,
)


def _orchestrator_with_processor(processor):
    orch = PromptChainOrchestrator.__new__(PromptChainOrchestrator)
    orch.comprehensive_user_processor = processor
    orch.context_manager = SimpleNamespace(initialize=AsyncMock())
    return orch


class TestNoSilentGenericFallback:
    @pytest.mark.asyncio
    async def test_data_failure_raises_instead_of_placeholder(self):
        processor = SimpleNamespace(
            get_comprehensive_user_data_cached=AsyncMock(
                side_effect=RuntimeError("cache layer down")
            ),
            get_comprehensive_user_data=AsyncMock(
                side_effect=RuntimeError("db connection refused")
            ),
        )
        orch = _orchestrator_with_processor(processor)

        with pytest.raises(RuntimeError, match="Calendar grounding failed"):
            await orch._get_comprehensive_user_data(1, None)

    @pytest.mark.asyncio
    async def test_no_placeholder_dict_ever_returned(self):
        processor = SimpleNamespace(
            get_comprehensive_user_data_cached=AsyncMock(
                side_effect=KeyError("timeout")
            ),
            get_comprehensive_user_data=AsyncMock(
                side_effect=KeyError("timeout")
            ),
        )
        orch = _orchestrator_with_processor(processor)

        result = None
        raised = False
        try:
            result = await orch._get_comprehensive_user_data(9, None)
        except Exception:
            raised = True
        assert raised, "data-source failure must raise"
        assert result is None, "never a placeholder industry-technology dict"

    @pytest.mark.asyncio
    async def test_initialize_context_propagates_grounding_failure(self):
        processor = SimpleNamespace(
            get_comprehensive_user_data_cached=AsyncMock(
                side_effect=RuntimeError("cache down")
            ),
            get_comprehensive_user_data=AsyncMock(
                side_effect=RuntimeError("db refused")
            ),
        )
        orch = _orchestrator_with_processor(processor)

        with pytest.raises(RuntimeError, match="Calendar grounding failed"):
            await orch._initialize_context(
                user_id=1,
                strategy_id=None,
                calendar_type="monthly",
                industry=None,
                business_size="sme",
            )

    @pytest.mark.asyncio
    async def test_no_placeholder_industry_after_grounding_failure(self):
        """Even through _initialize_context's handler, no context with
        industry 'technology' from FAILED grounding is produced."""
        processor = SimpleNamespace(
            get_comprehensive_user_data_cached=AsyncMock(
                side_effect=RuntimeError("x")
            ),
            get_comprehensive_user_data=AsyncMock(
                side_effect=RuntimeError("x")
            ),
        )
        orch = _orchestrator_with_processor(processor)

        produced = None
        try:
            produced = await orch._initialize_context(
                user_id=1, strategy_id=None, calendar_type="monthly",
                industry=None, business_size="sme",
            )
        except Exception:
            pass
        if produced is not None:
            assert produced.get("industry") != "technology", (
                "placeholder industry must never appear after a grounding failure"
            )
