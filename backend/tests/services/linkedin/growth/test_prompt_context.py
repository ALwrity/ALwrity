"""Unit tests for LinkedIn growth prompt date context helpers."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from services.linkedin.growth.prompt_context import (
    build_temporal_llm_prompts,
    current_search_year,
    format_date_context_block,
    format_industry_search_queries,
    get_current_date_context,
    sanitize_llm_text,
)


FIXED_NOW = datetime(2026, 8, 3, 12, 0, tzinfo=timezone.utc)


def test_get_current_date_context_returns_expected_fields():
    ctx = get_current_date_context(FIXED_NOW)
    assert ctx["today_iso"] == "2026-08-03"
    assert ctx["today_human"] == "03 August 2026"
    assert ctx["year"] == 2026
    assert ctx["month"] == "August"


def test_current_search_year_matches_context():
    assert current_search_year(FIXED_NOW) == 2026


def test_format_date_context_block_uses_dynamic_stale_example():
    block = format_date_context_block(FIXED_NOW)
    assert "2026" in block
    assert "03 August 2026" in block
    assert "2024" in block  # current_year - 2 example


def test_build_temporal_llm_prompts_injects_date_into_user_and_system():
    user, system = build_temporal_llm_prompts(
        "Industry: SaaS",
        "You are a strategist.",
        FIXED_NOW,
    )
    assert "## CURRENT DATE" in user
    assert "Industry: SaaS" in user
    assert "TEMPORAL AWARENESS" in system
    assert "You are a strategist." in system


def test_format_industry_search_queries_substitutes_tokens():
    queries = format_industry_search_queries(
        ["{industry} trends {year}", "hot topics {industry} {title}"],
        industry="Marketing",
        title="CMO",
        now=FIXED_NOW,
    )
    assert queries == [
        "Marketing trends 2026",
        "hot topics Marketing CMO",
    ]


def test_format_industry_search_queries_raises_on_invalid_template():
    with pytest.raises(ValueError, match="Invalid search query template"):
        format_industry_search_queries(["{unknown}"], industry="Tech")


@pytest.mark.parametrize(
    "raw,expected",
    [
        ('"Hook line here"', "Hook line here"),
        ("  multiple   spaces  ", "multiple spaces"),
        (None, ""),
        ("", ""),
    ],
)
def test_sanitize_llm_text(raw, expected):
    assert sanitize_llm_text(raw) == expected
