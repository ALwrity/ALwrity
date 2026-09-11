"""
B2: Step 12 (Final Calendar Assembly) wiring contract tests.

Pins the canonical contracts between the orchestrator's ``step_results``
container, ``FinalCalendarAssemblyStep._extract_all_steps_data``,
``_validate_previous_steps``, the calendar assembly engine, and the
step's ``validate_result``.

Realistic upstream step payload shapes are mirrored here:
- Legacy implementation steps (1-7): flat dict return, wrapped by
  ``base_step.run()`` under ``result`` with a ``status`` field.
- Step 8: wrapper whose payload carries ``results`` (with
  ``daily_content_schedules`` and ``quality_metrics``).
- New-style main steps (9-12): flat result dicts wrapped the same way
  (step 12 alone uses ``{completed, output, metadata}``).
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from services.calendar_generation_datasource_framework.prompt_chaining.steps.phase4.step12_final_calendar_assembly.step12_main import (  # noqa: E402
    FinalCalendarAssemblyStep as MainFinalCalendarAssemblyStep,
)
from services.calendar_generation_datasource_framework.prompt_chaining.steps.phase4.step12_implementation import (  # noqa: E402
    FinalCalendarAssemblyStep,
)


# ============================================================================
# Fixture helpers
# ============================================================================

def _wrap(status: str = "completed", payload=None) -> dict:
    """Wrapped step result as produced by ``base_step.run()``."""
    return {
        "step_name": "Step",
        "step_number": 1,
        "status": status,
        "execution_time": 0.1,
        "quality_score": 0.9,
        "validation_passed": status == "completed",
        "timestamp": "2026-01-01T00:00:00",
        "result": payload or {},
        "insights": [],
        "next_steps": [],
    }


def _normalized(output: dict, completed: bool = True) -> dict:
    """Canonical per-step entry the assembly layer expects."""
    return {
        "completed": completed,
        "output": output,
        "status": "completed" if completed else "failed",
    }


def _legacy_payload(step_num: int) -> dict:
    """Flat payloads matching the legacy implementation steps."""
    payloads = {
        1: {
            "business_goals": ["Grow brand awareness"],
            "target_audience": {"role": "CTO"},
            "content_pillars": ["Thought Leadership"],
            "kpi_targets": {"engagement_rate": 0.05},
            "industry_context": {"sector": "SaaS"},
        },
        2: {
            "content_gaps": ["AI explainer topics"],
            "opportunity_areas": ["Beginner guides"],
            "competitive_insights": {},
            "trend_analysis": {},
        },
        3: {
            "audience_segments": [{"name": "Decision Makers"}],
            "platform_strategies": {"LinkedIn": {"focus": "long-form"}},
            "content_preferences": {},
            "engagement_patterns": {},
        },
        4: {
            "calendar_structure": {"duration_weeks": 12},
            "posting_frequency": {"LinkedIn": 3},
            "content_distribution": {},
            "timeline_coordination": {},
        },
        5: {
            "pillar_distribution": {"Thought Leadership": 0.4},
            "content_balance": {},
            "theme_coordination": {},
        },
        6: {
            "platform_optimizations": {"LinkedIn": {}},
            "content_adaptations": {},
            "posting_schedules": {},
        },
        7: {
            "weekly_themes": [
                {"week_number": 1, "theme": "AI Foundations"},
                {"week_number": 2, "theme": "Scaling AI"},
            ],
            "diversity_metrics": {},
            "alignment_metrics": {},
            "insights": [],
            "num_weeks": 12,
            "theme_count": 2,
        },
        9: {
            "content_recommendations": [{"content_type": "blog", "topic": "AI 101"}],
            "keyword_optimizations": {},
            "gap_analysis": {},
            "performance_predictions": {},
        },
        10: {
            "performance_metrics": {},
            "optimization_recommendations": [],
            "quality_improvements": {},
            "engagement_optimizations": {},
        },
        11: {
            "alignment_scores": {"overall_alignment": 0.9},
            "consistency_validation": {},
            "strategy_drift_analysis": {},
            "confidence_assessment": {},
        },
    }
    return payloads[step_num]


def _step8_payload() -> dict:
    """Step 8 wrapper payload: ``results`` mirrors step8_main output."""
    return {
        "stepNumber": 8,
        "stepName": "Daily Content Planning",
        "status": "completed",
        "qualityScore": 0.9,
        "executionTime": "1.0s",
        "results": {
            "daily_content_schedules": [
                {
                    "date": "2026-01-05",
                    "week_number": 1,
                    "content_pieces": [
                        {"content_type": "blog", "title": "AI 101", "platform": "LinkedIn"}
                    ],
                    "platform_distribution": {"LinkedIn": 1},
                    "quality_metrics": {"overall_score": 0.9},
                    "optimization_notes": [],
                }
            ],
            "quality_metrics": {"overall_quality_score": 0.9},
            "step_summary": {},
            "step_metadata": {},
        },
    }


def _full_context() -> dict:
    """Context holding step_results for steps 1-11 in realistic shapes."""
    step_results = {}
    for num in range(1, 12):
        if num == 8:
            step_results["step_08"] = _wrap(status="completed", payload=_step8_payload())
        else:
            step_results[f"step_{num:02d}"] = _wrap(
                status="completed", payload=_legacy_payload(num)
            )
    return {"step_results": step_results}


def _normalized_steps_data() -> dict:
    """Canonical step entries (as extraction should produce them)."""
    data = {}
    for num in range(1, 12):
        if num == 8:
            data["step_08"] = _normalized(_step8_payload()["results"])
        else:
            data[f"step_{num:02d}"] = _normalized(_legacy_payload(num))
    return data


@pytest.fixture
def step():
    return FinalCalendarAssemblyStep()


# ============================================================================
# _extract_all_steps_data
# ============================================================================

def test_extract_all_steps_data_reads_step_results_container(step):
    """ALL previous steps must be read from ``context["step_results"]``."""
    context = _full_context()
    extracted = step._extract_all_steps_data(context)

    assert set(extracted.keys()) == {f"step_{i:02d}" for i in range(1, 12)}


def test_extract_all_steps_data_normalizes_legacy_flat_output(step):
    """Legacy steps must surface their flat result as ``output``."""
    context = _full_context()
    extracted = step._extract_all_steps_data(context)

    step7 = extracted["step_07"]
    assert step7["completed"] is True
    assert step7["output"]["weekly_themes"][0]["theme"] == "AI Foundations"


def test_extract_all_steps_data_unwraps_step8_results(step):
    """Step 8 output must be its inner ``results`` dict."""
    context = _full_context()
    extracted = step._extract_all_steps_data(context)

    step8 = extracted["step_08"]
    assert step8["completed"] is True
    assert "daily_content_schedules" in step8["output"]
    assert step8["output"]["daily_content_schedules"][0]["date"] == "2026-01-05"


# ============================================================================
# _validate_previous_steps
# ============================================================================

@pytest.mark.asyncio
async def test_validate_previous_steps_passes_with_all_completed(step):
    context = _full_context()
    extracted = step._extract_all_steps_data(context)

    validation = await step._validate_previous_steps(extracted)

    assert validation["valid"] is True
    assert validation["missing_steps"] == []
    assert validation["incomplete_steps"] == []


@pytest.mark.asyncio
async def test_validate_previous_steps_reports_incomplete_steps(step):
    data = _normalized_steps_data()
    data["step_07"] = _normalized({}, completed=False)

    validation = await step._validate_previous_steps(data)

    assert validation["valid"] is False
    assert "step_07" in validation["incomplete_steps"]


# ============================================================================
# validate_result
# ============================================================================

def test_validate_result_accepts_step12_execute_return(step):
    """validate_result must accept the ``{completed, output, metadata}``
    execute() return (the orchestrator passes ``step_result["result"]``)."""
    output = {
        "final_calendar": {"calendar_id": "cal_1"},
        "calendar_summary": {"calendar_id": "cal_1"},
        "quality_metrics": {"overall_quality_score": 0.9},
        "execution_guidance": {"implementation_priority": "High"},
        "step_integration_summary": {"step_01": {"data_available": True}},
    }
    result = {"completed": True, "output": output, "metadata": {}}

    assert step.validate_result(result) is True


def test_validate_result_rejects_incomplete_output(step):
    result = {"completed": True, "output": {"calendar_summary": {}}, "metadata": {}}

    assert step.validate_result(result) is False


# ============================================================================
# execute + run end to end (Step 12 wiring)
# ============================================================================

@pytest.mark.asyncio
async def test_execute_returns_completed_with_final_calendar():
    main_step = MainFinalCalendarAssemblyStep()
    context = _full_context()

    result = await main_step.execute(context, {})

    assert result["completed"] is True
    assert result["output"]["final_calendar"]["total_content_pieces"] > 0


@pytest.mark.asyncio
async def test_run_produces_completed_status():
    """Step 12 as registered by the orchestrator must complete via run()."""
    orchestrator_step = FinalCalendarAssemblyStep()
    context = _full_context()

    step_result = await orchestrator_step.run(context)

    assert step_result["status"] == "completed"
    assert step_result["validation_passed"] is True


# ============================================================================
# Assembly engine key alignment (Step 7 / Step 8 outputs)
# ============================================================================

@pytest.mark.asyncio
async def test_assembled_calendar_integrates_step7_weekly_themes(step):
    data = _normalized_steps_data()

    calendar = await step.calendar_assembly_engine.assemble_final_calendar(_full_context(), data)

    themes = calendar["calendar_structure"]["calendar_framework"]["weekly_themes"]
    assert [t["theme"] for t in themes] == ["AI Foundations", "Scaling AI"]


@pytest.mark.asyncio
async def test_assembled_calendar_integrates_step8_daily_schedules(step):
    data = _normalized_steps_data()

    calendar = await step.calendar_assembly_engine.assemble_final_calendar(_full_context(), data)

    schedule = calendar["calendar_structure"]["content_schedule"]
    assert len(schedule) == 1
    assert schedule[0]["date"] == "2026-01-05"