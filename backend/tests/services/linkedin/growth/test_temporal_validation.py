"""Unit tests for stale-year detection in growth insight copy."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from services.linkedin.growth.temporal_validation import (
    collect_stale_fields,
    find_stale_years,
    should_exclude_for_stale_years,
    text_has_stale_year_reference,
)

FIXED_NOW = datetime(2026, 8, 3, tzinfo=timezone.utc)


def test_find_stale_years_flags_more_than_one_year_behind():
    assert find_stale_years("May 2024 Core Update", 2026) == [2024]
    assert find_stale_years("Trends in 2025", 2026) == []
    assert find_stale_years("No dates here", 2026) == []


def test_text_has_stale_year_reference_detects_outdated_copy():
    assert text_has_stale_year_reference(
        "Google's May 2024 Core Update changed SEO.",
        FIXED_NOW,
    )


def test_text_has_stale_year_reference_allows_historical_framing():
    assert not text_has_stale_year_reference(
        "Since the 2024 launch, adoption has doubled.",
        FIXED_NOW,
    )
    assert not text_has_stale_year_reference(
        "Looking back at 2024, the market shifted.",
        FIXED_NOW,
    )


def test_collect_stale_fields_returns_matching_field_names():
    stale = collect_stale_fields(
        [
            ("why_now", "Q3 2024 survey shows growth."),
            ("hook", "AI saves 10 hours per week."),
        ],
        FIXED_NOW,
    )
    assert stale == ["why_now"]


def test_should_exclude_for_stale_years_true_for_stale_insight():
    assert should_exclude_for_stale_years(
        "ConsolidatedGrowth",
        "trending",
        "AI Automation",
        {
            "why_now": "Posts rose 42% in Q3 2024.",
            "suggested_hook": "AI is rewriting content workflows.",
        },
        FIXED_NOW,
    )


def test_should_exclude_for_stale_years_false_for_current_copy():
    assert not should_exclude_for_stale_years(
        "ConsolidatedGrowth",
        "trending",
        "AI Automation",
        {
            "why_now": "Posts rose 42% in Q2 2026.",
            "suggested_hook": "AI is rewriting content workflows in 2026.",
        },
        FIXED_NOW,
    )


def test_should_exclude_for_stale_years_fails_open_on_bad_input():
    assert not should_exclude_for_stale_years(
        "ConsolidatedGrowth",
        "trending",
        "Broken",
        {"why_now": object()},  # type: ignore[dict-item]
        FIXED_NOW,
    )
