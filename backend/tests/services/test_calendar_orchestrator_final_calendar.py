"""
B3: Orchestrator final-calendar projection contract tests.

Pins the contract between ``PromptChainOrchestrator._generate_final_calendar``
and the ``CalendarGenerationResponse`` response model produced by the
``/generate-calendar`` route.

The fixtures mirror the REAL wrapped shapes the orchestrator stores in
``context["step_results"]`` (the return of ``base_step.run()``):
- Steps 1-4, 8: executed payloads that carry their data under a ``results``
  key (``result["results"]``).
- Steps 5-7, 9-11: flat executed payloads under ``result``.
- Step 12: ``{completed, output, metadata}`` under ``result``.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from services.calendar_generation_datasource_framework.prompt_chaining.orchestrator import (  # noqa: E402
    PromptChainOrchestrator,
)
from api.content_planning.api.models.responses import (  # noqa: E402
    CalendarGenerationResponse,
)


# ============================================================================
# Fixture helpers
# ============================================================================

def _wrap(payload: dict) -> dict:
    """Wrapped step result as produced by ``base_step.run()``."""
    return {
        "step_name": "Step",
        "step_number": 1,
        "status": "completed",
        "execution_time": 0.1,
        "quality_score": 0.9,
        "validation_passed": True,
        "timestamp": "2026-01-01T00:00:00",
        "result": payload,
        "insights": [],
        "next_steps": [],
    }


def _phase1_payload(step_number: int, results: dict) -> dict:
    """Executed payload shape of the phase-1 steps (data under ``results``)."""
    return {
        "status": "completed",
        "step_number": step_number,
        "step_name": "Step",
        "results": results,
        "quality_score": 0.9,
        "execution_time": time.time(),
        "data_sources_used": [],
        "insights": [],
        "recommendations": [],
    }


def _step4_payload(results: dict) -> dict:
    return {
        "stepNumber": 4,
        "stepName": "Calendar Framework & Timeline",
        "results": results,
        "qualityScore": 0.9,
        "executionTime": "0.1s",
        "dataSourcesUsed": [],
        "insights": [],
        "recommendations": [],
    }


def _step8_payload(results: dict) -> dict:
    return {
        "stepNumber": 8,
        "stepName": "Daily Content Planning",
        "status": "completed",
        "results": results,
        "qualityScore": 0.9,
        "executionTime": "0.1s",
    }


def _final_calendar_fixture() -> dict:
    return {
        "calendar_id": "calendar_test",
        "assembly_timestamp": "2026-01-10T00:00:00",
        "calendar_duration_weeks": 1,
        "total_content_pieces": 3,
        "quality_score": 0.87,
        "strategy_alignment_score": 0.9,
        "calendar_structure": {
            "content_schedule": [
                {
                    "date": "2026-01-05",
                    "week_number": 1,
                    "theme": "AI Foundations",
                    "content_pieces": [
                        {
                            "title": "AI 101",
                            "description": "Foundational explainer",
                            "content_type": "blog",
                            "target_platform": "LinkedIn",
                            "key_message": "k1",
                        },
                        {
                            "title": "Short clip",
                            "description": "Vertical video",
                            "content_type": "short_video",
                            "target_platform": "Instagram",
                            "key_message": "k2",
                        },
                    ],
                    "platform_distribution": {"LinkedIn": 1, "Instagram": 1},
                    "quality_metrics": {},
                    "optimization_notes": [],
                },
                {
                    "date": "2026-01-06",
                    "week_number": 1,
                    "theme": "AI Foundations",
                    "content_pieces": [
                        {
                            "title": "Podcast",
                            "description": "Interview",
                            "content_type": "podcast",
                            "target_platform": "YouTube",
                            "key_message": "k3",
                        },
                    ],
                    "platform_distribution": {"YouTube": 1},
                    "quality_metrics": {},
                    "optimization_notes": [],
                },
            ],
            "calendar_framework": {
                "start_date": "2026-01-05",
                "end_date": "2026-01-12",
                "total_weeks": 1,
                "platforms": ["LinkedIn", "Instagram", "YouTube"],
                "content_pillars": {"Thought Leadership": 0.5, "Community": 0.5},
                "posting_frequency": {},
                "weekly_themes": [
                    {"week_number": 1, "theme": "AI Foundations"},
                ],
            },
            "integration_metadata": {
                "platforms_covered": ["LinkedIn", "Instagram", "YouTube"],
                "themes_covered": ["AI Foundations"],
            },
        },
        "assembly_metadata": {
            "assembly_confidence": 0.92,
            "overall_quality_score": 0.87,
        },
    }


def _full_step_results() -> dict:
    fc = _final_calendar_fixture()
    return {
        "step_01": _wrap(_phase1_payload(1, {
            "content_pillars": ["Thought Leadership", "Community"],
            "business_goals": ["Grow brand awareness"],
            "target_audience": {"role": "CTO"},
            "market_positioning": "Category leader",
            "strategic_insights": ["Lead with founder story", "Invest in short video"],
            "competitive_landscape": {"top_competitor": "Acme"},
            "goal_alignment_score": 0.9,
            "strategy_coherence": 0.85,
            "kpi_mapping": {"engagement_rate": 0.05},
            "quality_indicators": {},
        })),
        "step_02": _wrap(_phase1_payload(2, {
            "content_gaps": ["Beginner AI guides"],
            "keyword_opportunities": ["ai-for-ctos"],
            "competitor_insights": {"acme_gaps": ["no explainers"]},
            "recommendations": ["Publish beginner guides"],
        })),
        "step_03": _wrap(_phase1_payload(3, {
            "behavior_patterns": {},
            "content_preferences": {},
            "platform_performance": {},
            "optimal_timing": ["09:00", "17:00"],
            "content_mix": {"blog": 0.4, "short_video": 0.4, "podcast": 0.2},
            "platform_strategies": {
                "LinkedIn": {"focus": "long-form", "frequency": 3},
                "Instagram": {"focus": "reels"},
                "YouTube": {"focus": "podcasts"},
            },
            "engagement_strategy": {},
            "performance_optimization": {},
        })),
        "step_04": _wrap(_step4_payload({
            "calendarStructure": {"duration_weeks": 4, "format": "monthly"},
            "timelineConfiguration": {"total_weeks": 4},
            "durationControl": {"accuracy_score": 0.95},
            "strategicAlignment": {"alignment_score": 0.9},
        })),
        "step_05": _wrap({
            "pillarMapping": {"distribution_balance": 0.8, "content_pillars": ["Thought Leadership", "Community"]},
            "themeDevelopment": {"variety_score": 0.8, "unique_themes": 4},
            "strategicValidation": {"alignment_score": 0.85},
            "diversityAssurance": {"diversity_score": 0.9},
            "quality_score": 0.85,
            "insights": [],
            "recommendations": [],
        }),
        "step_06": _wrap({
            "platformOptimization": {
                "optimization_score": 0.9,
                "strategies": {"LinkedIn": {"frequency": 3}},
            },
            "contentAdaptation": {"adaptation_score": 0.8},
            "crossPlatformCoordination": {"coordination_score": 0.9},
            "uniquenessValidation": {"uniqueness_score": 0.95},
            "quality_score": 0.9,
            "insights": [],
            "recommendations": [],
        }),
        "step_07": _wrap({
            "weekly_themes": [
                {"week_number": 1, "theme": "AI Foundations"},
                {"week_number": 2, "theme": "Scaling AI"},
            ],
            "diversity_metrics": {},
            "alignment_metrics": {},
            "insights": [],
            "num_weeks": 4,
            "theme_count": 2,
        }),
        "step_08": _wrap(_step8_payload({
            "daily_content_schedules": [
                {
                    "date": "2026-01-05",
                    "week_number": 1,
                    "content_pieces": fc["calendar_structure"]["content_schedule"][0]["content_pieces"],
                    "platform_distribution": {"LinkedIn": 1, "Instagram": 1},
                    "quality_metrics": {},
                    "optimization_notes": [],
                },
            ],
            "quality_metrics": {},
            "status": "completed",
        })),
        "step_09": _wrap({
            "content_recommendations": [
                {"content_type": "blog", "topic": "AI 101"},
                {"content_type": "short_video", "topic": "Teaser"},
            ],
            "keyword_optimizations": {},
            "gap_analysis": {},
            "performance_predictions": {"blog": {"reach": 1000}},
            "quality_metrics": {},
            "comprehensive_quality_score": 0.9,
            "final_recommendations": [
                {"title": "AI 101", "content_type": "blog", "priority": "high"},
                {"title": "Teaser", "content_type": "short_video", "priority": "medium"},
                {"title": "Podcast", "content_type": "podcast", "priority": "low"},
            ],
            "step_metadata": {"step_number": 9},
        }),
        "step_10": _wrap({
            "performance_metrics": {"overall_performance_score": 0.85},
            "quality_metrics": {"overall_quality_score": 0.87},
            "engagement_metrics": {"overall_engagement_score": 0.8},
            "roi_metrics": {"overall_roi_score": 0.7},
            "prediction_metrics": {
                "overall_performance_score": 0.86,
                "prediction_confidence": 0.91,
                "optimization_validation": {},
                "risk_assessment": {},
            },
        }),
        "step_11": _wrap({
            "step_11": {
                "step_name": "Strategy Alignment Validation",
                "step_number": 11,
                "overall_quality_score": 0.88,
                "strategy_alignment_validation": {},
                "consistency_validation": {},
                "combined_validation_results": {"combined_validation_score": 0.88},
                "comprehensive_validation_report": {},
                "quality_metrics": {},
                "status": "completed",
            }
        }),
        "step_12": _wrap({
            "completed": True,
            "output": {
                "final_calendar": fc,
                "quality_metrics": {"overall_quality_score": 0.87},
                "calendar_summary": {"total_content_pieces": 3},
            },
            "metadata": {"quality_score": 0.87, "confidence_level": 0.92},
        }),
    }


def _make_orchestrator(step_results: dict) -> PromptChainOrchestrator:
    """Build an orchestrator instance without running any steps."""
    orch = object.__new__(PromptChainOrchestrator)
    orch.steps = {f"step_{i:02d}": None for i in range(1, 13)}
    orch._context = {
        "user_id": "user-123",
        "strategy_id": 42,
        "calendar_type": "monthly",
        "industry": "saas",
        "business_size": "sme",
        "user_data": {
            "onboarding_data": {"industry": "saas", "platforms": ["LinkedIn"]},
        },
        "strategy_digest": {"pillars": ["Thought Leadership"]},
        "quality_scores": {f"step_{i:02d}": 0.9 for i in range(1, 13)},
        "step_results": step_results,
    }
    return orch


@pytest.fixture
def context():
    orch = _make_orchestrator(_full_step_results())
    return orch._context


@pytest.fixture
def orchestrator():
    return _make_orchestrator(_full_step_results())


# ============================================================================
# Tests
# ============================================================================

@pytest.mark.asyncio
async def test_final_calendar_identity_fields(orchestrator):
    calendar = await orchestrator._generate_final_calendar(orchestrator._context)
    assert calendar["user_id"] == "user-123"
    assert calendar["strategy_id"] == 42
    assert calendar["calendar_type"] == "monthly"
    assert calendar["industry"] == "saas"
    assert calendar["business_size"] == "sme"
    assert calendar["generated_at"] is not None


@pytest.mark.asyncio
async def test_final_calendar_daily_schedule_populated(orchestrator):
    calendar = await orchestrator._generate_final_calendar(orchestrator._context)
    assert len(calendar["daily_schedule"]) == 2

    first_day = calendar["daily_schedule"][0]
    assert first_day["date"] == "2026-01-05"
    assert first_day["theme"] == "AI Foundations"
    assert len(first_day["content_items"]) == 2
    assert first_day["content_items"][0]["title"] == "AI 101"
    assert first_day["content_items"][0]["content_type"] == "blog"
    assert first_day["content_items"][0]["target_platform"] == "LinkedIn"


@pytest.mark.asyncio
async def test_final_calendar_weekly_themes_populated(orchestrator):
    calendar = await orchestrator._generate_final_calendar(orchestrator._context)
    assert calendar["weekly_themes"] == [{"week_number": 1, "theme": "AI Foundations"}]


@pytest.mark.asyncio
async def test_final_calendar_strategy_fields_populated(orchestrator):
    calendar = await orchestrator._generate_final_calendar(orchestrator._context)
    assert calendar["content_pillars"] == ["Thought Leadership", "Community"]
    assert calendar["platform_strategies"]["LinkedIn"]["frequency"] == 3
    assert isinstance(calendar["content_mix"], dict)
    assert len(calendar["content_mix"]) > 0
    assert all(isinstance(v, float) for v in calendar["content_mix"].values())
    assert len(calendar["content_recommendations"]) == 3
    assert calendar["optimal_timing"]["optimal_times"] == ["09:00", "17:00"]
    assert calendar["performance_predictions"]["prediction_confidence"] == 0.91


@pytest.mark.asyncio
async def test_final_calendar_insight_fields_populated(orchestrator):
    calendar = await orchestrator._generate_final_calendar(orchestrator._context)
    assert len(calendar["ai_insights"]) == 2
    assert all(isinstance(i, dict) for i in calendar["ai_insights"])
    assert calendar["competitor_analysis"]["acme_gaps"] == ["no explainers"]
    assert calendar["competitor_analysis"]["top_competitor"] == "Acme"
    assert calendar["gap_analysis_insights"]["content_gaps"] == ["Beginner AI guides"]
    assert calendar["strategy_insights"]["business_goals"] == ["Grow brand awareness"]


@pytest.mark.asyncio
async def test_final_calendar_onboarding_and_confidence(orchestrator):
    calendar = await orchestrator._generate_final_calendar(orchestrator._context)
    assert calendar["onboarding_insights"]["platforms"] == ["LinkedIn"]
    assert calendar["ai_confidence"] == pytest.approx(0.87)
    assert calendar["quality_score"] == pytest.approx(0.9)
    assert calendar["step_results_summary"]
    assert calendar["step_results_summary"]["step_01"]["status"] == "completed"


@pytest.mark.asyncio
async def test_final_calendar_strategy_digest_echoed(orchestrator):
    calendar = await orchestrator._generate_final_calendar(orchestrator._context)
    assert calendar["strategy_digest"]["pillars"] == ["Thought Leadership"]


@pytest.mark.asyncio
async def test_final_calendar_builds_response_model(orchestrator):
    calendar = await orchestrator._generate_final_calendar(orchestrator._context)
    calendar["processing_time"] = 12.5
    model = CalendarGenerationResponse(**calendar)
    assert model.user_id == "user-123"
    assert len(model.daily_schedule) == 2