"""Unit tests for engagement trends period / baseline selection (no DB)."""

from datetime import datetime, timedelta

import pytest

from services.engagement_trends_period import (
    normalize_period_key,
    select_baseline_epoch,
)


def test_normalize_period_key_default_and_valid():
    assert normalize_period_key(None) == "since_joining"
    assert normalize_period_key("7d") == "7d"


def test_normalize_period_key_invalid():
    with pytest.raises(ValueError):
        normalize_period_key("90d")


def test_select_baseline_rejects_too_close_epochs():
    now = datetime(2026, 7, 17, 12, 0, 0)
    epochs = [now - timedelta(minutes=1), now - timedelta(minutes=2)]
    baseline, reason = select_baseline_epoch(epochs, now, "1d")
    assert baseline is None
    assert reason == "baseline_too_close"


def test_select_baseline_7d_picks_near_window_start():
    now = datetime(2026, 7, 17, 12, 0, 0)
    target = now - timedelta(days=7)
    epochs = [
        target - timedelta(hours=2),
        target + timedelta(hours=1),  # after window start — should not win
        now - timedelta(hours=1),  # too close to now
    ]
    baseline, reason = select_baseline_epoch(epochs, now, "7d")
    assert baseline == epochs[0]
    assert "7d" in reason or reason == "min_gap_walkback"


def test_select_baseline_since_joining_uses_earliest_with_gap():
    now = datetime(2026, 7, 17, 12, 0, 0)
    earliest = now - timedelta(days=20)
    epochs = [earliest, now - timedelta(days=3), now - timedelta(hours=1)]
    baseline, reason = select_baseline_epoch(epochs, now, "since_joining")
    assert baseline == earliest
    assert reason == "since_joining_earliest"
