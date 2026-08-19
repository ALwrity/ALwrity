"""Tests for YouTube plan generation metadata (prompt transparency)."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import patch

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def test_configured_text_provider_uses_first_gpt_provider():
    from services.youtube.planner_generation import configured_text_provider

    with patch.dict(os.environ, {"GPT_PROVIDER": "wavespeed,google"}):
        assert configured_text_provider() == "wavespeed"


def test_configured_text_provider_when_unset():
    from services.youtube.planner_generation import configured_text_provider

    env = {k: v for k, v in os.environ.items() if k != "GPT_PROVIDER"}
    with patch.dict(os.environ, env, clear=True):
        assert configured_text_provider() == "llm_text_gen"


def test_attach_generation_metadata_flags_research():
    from services.youtube.planner_generation import attach_plan_generation_metadata

    plan = {"video_summary": "x"}
    with patch.dict(os.environ, {"GPT_PROVIDER": "google"}):
        out = attach_plan_generation_metadata(
            plan,
            system_prompt="SYS",
            user_prompt="USER **Research & Current Information:** hello",
            research_enabled=True,
            research_context="hello",
        )

    gen = out["generation"]
    assert gen["text_gateway"] == "llm_text_gen"
    assert gen["configured_provider"] == "google"
    assert gen["system_prompt"] == "SYS"
    assert "hello" in gen["user_prompt"]
    assert gen["research_enabled"] is True
    assert gen["research_injected"] is True
    assert gen["json_schema_applied"] is True


def test_attach_generation_metadata_non_dict_returns_empty():
    from services.youtube.planner_generation import attach_plan_generation_metadata

    out = attach_plan_generation_metadata(
        None,  # type: ignore[arg-type]
        system_prompt="SYS",
        user_prompt="USER",
        research_enabled=False,
        research_context="",
    )
    assert out == {}


def test_attach_generation_metadata_research_off():
    from services.youtube.planner_generation import attach_plan_generation_metadata

    out = attach_plan_generation_metadata(
        {},
        system_prompt="SYS",
        user_prompt="USER",
        research_enabled=False,
        research_context="",
    )
    assert out["generation"]["research_injected"] is False
    assert out["generation"]["research_enabled"] is False
