"""Phase 1 honesty fixes: signal confidences must be derived, never fabricated.

Covers:
1. ``compute_signal_confidence`` derives confidence from measurable factors
   and returns ``None`` (do-not-emit) for weak inputs.
2. An empty signal context yields zero signals from every detector.
3. A grep guard asserts no literal confidence/impact constants remain in the
   detection paths.
4. ``expected_impact=None`` recommendations sort without crashing.
"""
from __future__ import annotations

import asyncio
import re
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from services.intelligence.agents.market_signal_detector import (  # noqa: E402
    MarketSignalDetector,
    SignalContext,
    compute_signal_confidence,
)
from services.intelligence.agents.performance_monitor import (  # noqa: E402
    AgentPerformanceSnapshot,
    AgentStatus,
    PerformanceMonitor,
    PerformanceMetric,
    PerformanceTrend,
)


# ---------------------------------------------------------------------------
# 1. compute_signal_confidence behavior
# ---------------------------------------------------------------------------

def test_confidence_rejects_zero_samples():
    confidence, basis, is_estimate = compute_signal_confidence(
        sample_count=0, change_ratio=5.0, data_age_hours=0.0
    )
    assert confidence is None
    assert "insufficient" in basis
    assert is_estimate is True


def test_confidence_rejects_stale_data():
    confidence, basis, _ = compute_signal_confidence(
        sample_count=10, change_ratio=3.0, data_age_hours=200.0
    )
    assert confidence is None
    assert "stale" in basis


def test_confidence_full_strength_inputs():
    confidence, basis, is_estimate = compute_signal_confidence(
        sample_count=4, change_ratio=2.0, data_age_hours=0.0
    )
    assert confidence == pytest.approx(1.0)
    assert is_estimate is False
    assert basis.startswith("derived:")


def test_confidence_increases_with_magnitude():
    low, _, _ = compute_signal_confidence(sample_count=4, change_ratio=0.6, data_age_hours=0.0)
    high, _, _ = compute_signal_confidence(sample_count=4, change_ratio=1.8, data_age_hours=0.0)
    assert high > low


def test_confidence_unknown_age_is_labeled_estimate():
    confidence, basis, is_estimate = compute_signal_confidence(
        sample_count=4, change_ratio=2.0, data_age_hours=None
    )
    assert confidence is not None
    assert is_estimate is True
    assert "estimate" in basis
    # Neutral freshness factor caps confidence below full strength.
    assert confidence < 1.0


# ---------------------------------------------------------------------------
# 2. Empty context -> no signals (honest emptiness, not invented ones)
# ---------------------------------------------------------------------------

def _empty_context() -> SignalContext:
    return SignalContext(
        user_id="test-user",
        competitor_data={},
        semantic_health={},
        seo_performance={},
        content_analysis={},
        historical_data={},
    )


def _bare_detector() -> MarketSignalDetector:
    detector = MarketSignalDetector.__new__(MarketSignalDetector)
    detector.user_id = "test-user"
    detector.thresholds = {
        "competitor_change_threshold": 0.3,
        "serp_fluctuation_threshold": 0.2,
        "social_trend_threshold": 0.15,
        "performance_change_threshold": 0.25,
        "content_gap_threshold": 0.4,
        "seo_opportunity_threshold": 0.3,
    }
    return detector


@pytest.mark.parametrize(
    "method_name",
    [
        "_detect_competitor_signals",
        "_detect_serp_signals",
        "_detect_social_signals",
        "_detect_industry_signals",
        "_detect_performance_signals",
        "_detect_content_gap_signals",
        "_detect_seo_opportunity_signals",
    ],
)
def test_empty_context_yields_no_signals(method_name):
    detector = _bare_detector()
    signals = asyncio.run(getattr(detector, method_name)(_empty_context()))
    assert signals == []


def test_insufficient_evidence_suppresses_signal():
    """A competitor snapshot below threshold evidence must not emit a signal."""
    detector = _bare_detector()
    context = SignalContext(
        user_id="test-user",
        competitor_data={
            "competitors": [
                {
                    "competitor_name": "Rival",
                    "content_volume": 1,          # too few samples
                    "previous_content_volume": 100,
                    "last_updated": None,
                }
            ]
        },
        semantic_health={},
        seo_performance={},
        content_analysis={},
        historical_data={},
    )
    signals = asyncio.run(detector._detect_competitor_signals(context))
    assert signals == []


# ---------------------------------------------------------------------------
# 3. Grep guard: no literal constants in detection paths
# ---------------------------------------------------------------------------

_LITERALS = re.compile(r"(confidence_score|expected_impact)\s*=\s*0\.\d")


@pytest.mark.parametrize(
    "relative_path",
    [
        "services/intelligence/agents/market_signal_detector.py",
        "services/intelligence/agents/trend_surfer_agent.py",
        "services/intelligence/agents/performance_monitor.py",
    ],
)
def test_no_fabricated_constants(relative_path):
    source = (BACKEND_DIR / relative_path).read_text(encoding="utf-8")
    matches = _LITERALS.findall(source)
    assert not matches, f"Fabricated constant found in {relative_path}: {matches}"


# ---------------------------------------------------------------------------
# 4. expected_impact=None sorts safely
# ---------------------------------------------------------------------------

def _healthy_snapshot(agent_id: str) -> AgentPerformanceSnapshot:
    return AgentPerformanceSnapshot(
        agent_id=agent_id,
        user_id="test-user",
        timestamp=None,
        status=AgentStatus.ACTIVE,
        total_actions=10,
        successful_actions=9,
        failed_actions=1,
        average_response_time=1.0,
        success_rate=0.9,
        efficiency_score=0.85,
        resource_usage={"cpu": 0.2},
        market_impact_score=0.75,
        last_action_at=None,
    )


def _bare_monitor() -> PerformanceMonitor:
    monitor = PerformanceMonitor.__new__(PerformanceMonitor)
    monitor.user_id = "test-user"
    monitor.performance_targets = {
        "success_rate": 0.85,
        "response_time": 2.0,
        "efficiency_score": 0.8,
        "market_impact": 0.7,
    }
    monitor.alert_thresholds = {
        "success_rate": 0.7,
        "response_time": 5.0,
    }
    monitor.agent_snapshots = {}
    monitor.recommendations = []
    return monitor


def _declining_trend(change_rate) -> PerformanceTrend:
    return PerformanceTrend(
        metric_type=PerformanceMetric.SUCCESS_RATE,
        trend_direction="declining",
        trend_strength=0.9,
        change_rate=change_rate,
        confidence=0.95,
        period_start="2026-08-24T00:00:00",
        period_end="2026-08-24T01:00:00",
    )


def test_trend_recommendation_derives_expected_impact(monkeypatch):
    monitor = _bare_monitor()
    monitor.agent_snapshots["agent-1"] = _healthy_snapshot("agent-1")

    async def fake_trends(agent_id):
        return [_declining_trend(-45.0)]

    monkeypatch.setattr(monitor, "analyze_performance_trends", fake_trends)

    recs = asyncio.run(monitor.generate_optimization_recommendations("agent-1"))
    trend_recs = [r for r in recs if r.recommendation_type == "trend_reversal"]
    assert len(trend_recs) == 1
    # Derived from measured |change_rate| / 100, capped at 1.0.
    assert trend_recs[0].expected_impact == pytest.approx(0.45)


def test_none_change_rate_sorts_without_crash(monkeypatch):
    monitor = _bare_monitor()
    monitor.agent_snapshots["agent-1"] = _healthy_snapshot("agent-1")

    async def fake_trends(agent_id):
        return [_declining_trend(None)]

    monkeypatch.setattr(monitor, "analyze_performance_trends", fake_trends)

    recs = asyncio.run(monitor.generate_optimization_recommendations("agent-1"))
    trend_recs = [r for r in recs if r.recommendation_type == "trend_reversal"]
    assert len(trend_recs) == 1
    assert trend_recs[0].expected_impact is None
