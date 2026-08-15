"""Tests for Google Trends keyword normalization."""

from __future__ import annotations

import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[4]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


class TestNormalizeTrendsKeywords:
    def test_short_phrase_unchanged(self):
        from services.research.trends.trends_keyword_utils import normalize_trends_keywords

        assert normalize_trends_keywords(["Bali travel"]) == ["Bali travel"]

    def test_long_idea_becomes_short_terms(self):
        from services.research.trends.trends_keyword_utils import normalize_trends_keywords

        result = normalize_trends_keywords(
            ["Budget Travel Guide for Bali targeting young professionals."]
        )

        assert len(result) <= 5
        assert any("Bali" in keyword for keyword in result)
        assert all(len(keyword) <= 50 for keyword in result)
        assert all(len(keyword.split()) <= 4 or len(keyword.split()) == 1 for keyword in result)

    def test_comma_separated_inputs(self):
        from services.research.trends.trends_keyword_utils import normalize_trends_keywords

        result = normalize_trends_keywords(["AI tutorials", "machine learning basics"])
        assert "AI tutorials" in result
        assert "machine learning basics" in result
