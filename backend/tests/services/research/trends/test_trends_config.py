"""Tests for Google Trends timeout configuration."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[4]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


class TestTrendsConfig:
    def test_default_timeouts(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.delenv("GOOGLE_TRENDS_CONNECT_TIMEOUT", raising=False)
        monkeypatch.delenv("GOOGLE_TRENDS_READ_TIMEOUT", raising=False)

        from services.research.trends.trends_config import get_pytrends_timeout

        assert get_pytrends_timeout() == (20, 60)

    def test_total_timeout_default(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.delenv("GOOGLE_TRENDS_TOTAL_TIMEOUT", raising=False)

        from services.research.trends.trends_config import get_trends_total_timeout

        assert get_trends_total_timeout() == 90.0

    def test_retry_delays_default(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.delenv("GOOGLE_TRENDS_RETRY_DELAYS", raising=False)

        from services.research.trends.trends_config import get_trends_retry_delays

        assert get_trends_retry_delays() == (5, 10, 15)

    def test_env_overrides(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("GOOGLE_TRENDS_CONNECT_TIMEOUT", "25")
        monkeypatch.setenv("GOOGLE_TRENDS_READ_TIMEOUT", "180")

        from services.research.trends.trends_config import get_pytrends_timeout

        assert get_pytrends_timeout() == (25, 120)

    def test_invalid_env_falls_back_to_defaults(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("GOOGLE_TRENDS_CONNECT_TIMEOUT", "not-a-number")
        monkeypatch.setenv("GOOGLE_TRENDS_READ_TIMEOUT", "150")

        from services.research.trends.trends_config import get_pytrends_timeout

        assert get_pytrends_timeout() == (20, 60)

    def test_clamps_extreme_values(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("GOOGLE_TRENDS_CONNECT_TIMEOUT", "1")
        monkeypatch.setenv("GOOGLE_TRENDS_READ_TIMEOUT", "999")

        from services.research.trends.trends_config import get_pytrends_timeout

        assert get_pytrends_timeout() == (5, 120)
