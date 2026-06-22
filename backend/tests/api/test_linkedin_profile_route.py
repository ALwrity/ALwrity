"""
Step 2.5 / Phase 5 Step 6 — GET /api/linkedin-social/profile API tests.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from contextlib import ExitStack
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _load_linkedin_social_routes():
    """Load route module without importing ``api`` package ``__init__``."""
    module_name = "_linkedin_social_routes_under_test"
    if module_name in sys.modules:
        return sys.modules[module_name]
    routes_path = _BACKEND_ROOT / "api" / "linkedin_social_routes.py"
    spec = importlib.util.spec_from_file_location(module_name, routes_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load route module from {routes_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


_routes = _load_linkedin_social_routes()
get_linkedin_profile = _routes.get_linkedin_profile


def _mock_intelligence_payload() -> dict:
    return {
        "meta": {
            "built_from_profile_content_hash": "ctx-hash",
            "schema_version": 1,
            "model": "gemini-2.5-flash",
        },
        "professional_identity": "Senior Backend Engineer",
        "primary_expertise": ["Python"],
        "industry": "Software Development",
        "experience_level": "Senior",
        "knowledge_domains": ["Backend Development"],
        "writing_opportunities": ["API Design"],
        "target_audience": ["Engineers"],
        "communication_style": "Technical",
        "brand_positioning": "Practical insights.",
        "summary": "Backend engineer.",
    }


def _mock_recommendations_list() -> list[dict]:
    return [
        {
            "id": f"rec-{index}",
            "title": f"Topic {index}",
            "why_this_fits": f"Fits because {index}.",
            "recommended_format": "LinkedIn Post",
            "target_audience": ["Software Engineers"],
            "growth_impact": "High",
        }
        for index in range(1, 6)
    ]


def _mock_profile_optimization_list() -> list[dict]:
    return [
        {
            "id": f"opt-{index}",
            "profile_section": "headline" if index == 1 else "experience",
            "issue": f"Issue {index}",
            "why_it_matters": f"Why {index}.",
            "current_state_summary": f"Current {index}.",
            "recommended_action": f"Action {index}.",
            "suggested_copy": "Copy." if index == 1 else "",
            "impact": "High",
            "effort": "Low",
            "best_practice_ref": "Enhancement Report §1.2",
            "completion_criteria": f"Done {index}.",
        }
        for index in range(1, 6)
    ]


def _profile_patches(
    *,
    is_profile_complete: bool = True,
    intelligence_source: str = "generated",
    recommendations_source: str = "generated",
    include_recommendations: bool = True,
    include_profile_optimization: bool = False,
    optimization_source: str = "generated",
):
    profile = {"name": "Jane Doe", "headline": "Engineer"}
    acquire_meta = {
        "source": "cache",
        "fetched_at": "2026-06-19T08:00:00",
        "profile_content_hash": "abc123",
    }
    context = {
        "personal_information": {"name": "Jane Doe", "headline": "Engineer"},
        "professional_information": {},
        "linkedin_information": {},
        "meta": {"built_from_profile_content_hash": "abc123", "schema_version": 1},
    }
    context_meta = {
        "source": "built",
        "profile_context_updated_at": "2026-06-19T08:01:00",
    }
    validation = {
        "is_profile_complete": is_profile_complete,
        "completeness_score": 100 if is_profile_complete else 67,
        "missing_fields": [] if is_profile_complete else ["about"],
        "optional_missing_fields": [],
    }

    intelligence_return = (
        (
            _mock_intelligence_payload(),
            {
                "source": intelligence_source,
                "ai_intelligence_updated_at": "2026-06-19T08:02:00",
            },
        )
        if is_profile_complete
        else (None, {"ai_intelligence_updated_at": None})
    )

    intelligence_patch = patch.object(
        _routes,
        "get_or_generate_profile_intelligence",
        return_value=intelligence_return,
    )

    recommendations_return = (
        (
            _mock_recommendations_list(),
            {
                "source": recommendations_source,
                "recommendations_updated_at": "2026-06-19T08:03:00",
            },
        )
        if is_profile_complete and include_recommendations
        else (None, {"recommendations_updated_at": None})
    )

    recommendations_patch = patch.object(
        _routes,
        "get_or_generate_topic_recommendations",
        return_value=recommendations_return,
    )

    optimization_return = (
        (
            _mock_profile_optimization_list(),
            {
                "source": optimization_source,
                "profile_optimization_updated_at": "2026-06-19T08:04:00",
                "remaining_in_backlog": 0,
            },
        )
        if is_profile_complete and include_profile_optimization
        else (None, {"profile_optimization_updated_at": None})
    )

    optimization_patch = patch.object(
        _routes,
        "get_or_generate_profile_optimization",
        return_value=optimization_return,
    )

    return (
        profile,
        acquire_meta,
        context,
        context_meta,
        validation,
        patch.object(
            _routes,
            "get_or_fetch_profile",
            new_callable=AsyncMock,
            return_value=(profile, acquire_meta),
        ),
        patch.object(
            _routes,
            "get_or_build_profile_context",
            return_value=(context, context_meta),
        ),
        patch.object(
            _routes,
            "get_or_validate_profile_context",
            return_value=(validation, {"source": "validated"}),
        ),
        intelligence_patch,
        recommendations_patch,
        optimization_patch,
    )


def _enter_profile_patches(**kwargs):
    """Return ExitStack context with standard GET /profile patches applied."""
    stack = ExitStack()
    patches = _profile_patches(**kwargs)[5:]
    for item in patches:
        stack.enter_context(item)
    return stack


def _call_get_profile(**kwargs):
    defaults = {
        "refresh": False,
        "refresh_intelligence": False,
        "refresh_recommendations": False,
        "include_recommendations": False,
        "include_profile_optimization": False,
        "refresh_profile_optimization": False,
        "debug_profile_optimization_gaps": False,
        "current_user": {"id": "user_test"},
    }
    defaults.update(kwargs)
    return get_linkedin_profile(**defaults)


@pytest.mark.asyncio
async def test_get_linkedin_profile_includes_profile_context_fields() -> None:
    (
        profile,
        _acquire_meta,
        context,
        context_meta,
        _validation,
        fetch_patch,
        context_patch,
        validation_patch,
        intelligence_patch,
        recommendations_patch,
        _optimization_patch,
    ) = _profile_patches(is_profile_complete=True)

    with fetch_patch, context_patch, validation_patch, intelligence_patch, recommendations_patch:
        response = await _call_get_profile(include_recommendations=True)

    assert response.profile == profile
    assert response.meta.source == "cache"
    assert response.profile_context == context
    assert response.profile_context_meta.source == "built"
    assert response.profile_context_meta.profile_context_updated_at == "2026-06-19T08:01:00"
    assert response.profile_validation is not None
    assert response.profile_validation.is_profile_complete is True
    assert response.ai_profile_intelligence is not None
    assert response.ai_profile_intelligence.professional_identity == "Senior Backend Engineer"
    assert response.ai_profile_intelligence_meta is not None
    assert response.ai_profile_intelligence_meta.source == "generated"
    assert response.recommendations is not None
    assert len(response.recommendations) == 5
    assert response.recommendations[0].title == "Topic 1"
    assert response.recommendations_meta is not None
    assert response.recommendations_meta.source == "generated"
    assert response.recommendations_error is None


@pytest.mark.asyncio
async def test_get_linkedin_profile_omits_intelligence_when_incomplete() -> None:
    with _enter_profile_patches(is_profile_complete=False):
        response = await _call_get_profile()

    assert response.profile_validation is not None
    assert response.profile_validation.is_profile_complete is False
    assert response.ai_profile_intelligence is None
    assert response.ai_profile_intelligence_meta is None
    assert response.recommendations is None
    assert response.recommendations_meta is None
    assert response.recommendations_error is None


@pytest.mark.asyncio
async def test_get_linkedin_profile_intelligence_cache_meta() -> None:
    with _enter_profile_patches(is_profile_complete=True, intelligence_source="cache"):
        response = await _call_get_profile(include_recommendations=True)

    assert response.ai_profile_intelligence_meta is not None
    assert response.ai_profile_intelligence_meta.source == "cache"
    assert response.ai_profile_intelligence_meta.ai_intelligence_updated_at == (
        "2026-06-19T08:02:00"
    )


@pytest.mark.asyncio
async def test_get_linkedin_profile_passes_refresh_intelligence_flag() -> None:
    (
        _profile,
        _acquire_meta,
        _context,
        _context_meta,
        _validation,
        fetch_patch,
        context_patch,
        validation_patch,
        intelligence_patch,
        recommendations_patch,
        _optimization_patch,
    ) = _profile_patches(is_profile_complete=True)

    with (
        fetch_patch,
        context_patch,
        validation_patch,
        intelligence_patch as intelligence_mock,
        recommendations_patch,
    ):
        await _call_get_profile(refresh_intelligence=True)
        intelligence_mock.assert_called_once()
        assert intelligence_mock.call_args.kwargs["force_regenerate"] is True


@pytest.mark.asyncio
async def test_get_linkedin_profile_includes_recommendations_cache_meta() -> None:
    with _enter_profile_patches(
        is_profile_complete=True,
        recommendations_source="cache",
    ):
        response = await _call_get_profile(include_recommendations=True)

    assert response.recommendations_meta is not None
    assert response.recommendations_meta.source == "cache"
    assert response.recommendations_meta.recommendations_updated_at == "2026-06-19T08:03:00"


@pytest.mark.asyncio
async def test_get_linkedin_profile_passes_refresh_recommendations_flag() -> None:
    (
        _profile,
        _acquire_meta,
        _context,
        _context_meta,
        _validation,
        fetch_patch,
        context_patch,
        validation_patch,
        intelligence_patch,
        recommendations_patch,
        _optimization_patch,
    ) = _profile_patches(is_profile_complete=True)

    with (
        fetch_patch,
        context_patch,
        validation_patch,
        intelligence_patch,
        recommendations_patch as recommendations_mock,
    ):
        await _call_get_profile(refresh_recommendations=True)
        recommendations_mock.assert_called_once()
        assert recommendations_mock.call_args.kwargs["force_regenerate"] is True


@pytest.mark.asyncio
async def test_get_linkedin_profile_recommendations_llm_error_returns_graceful_error() -> None:
    from services.integrations.linkedin.topic_recommendation_service import (
        TopicRecommendationLLMError,
    )

    (
        _profile,
        _acquire_meta,
        _context,
        _context_meta,
        _validation,
        fetch_patch,
        context_patch,
        validation_patch,
        intelligence_patch,
        _recommendations_patch,
        _optimization_patch,
    ) = _profile_patches(is_profile_complete=True)

    with (
        fetch_patch,
        context_patch,
        validation_patch,
        intelligence_patch,
        patch.object(
            _routes,
            "get_or_generate_topic_recommendations",
            side_effect=TopicRecommendationLLMError("provider down"),
        ),
    ):
        response = await _call_get_profile(include_recommendations=True)

    assert response.ai_profile_intelligence is not None
    assert response.recommendations is None
    assert response.recommendations_meta is None
    assert response.recommendations_error == (
        "We couldn't load content suggestions right now. Please try again."
    )


@pytest.mark.asyncio
async def test_get_linkedin_profile_intelligence_llm_error_returns_analysis_error() -> None:
    from services.integrations.linkedin.profile_intelligence_llm import (
        ProfileIntelligenceLLMError,
    )

    (
        _profile,
        _acquire_meta,
        _context,
        _context_meta,
        _validation,
        fetch_patch,
        context_patch,
        validation_patch,
        _intelligence_patch,
        _recommendations_patch,
        _optimization_patch,
    ) = _profile_patches(is_profile_complete=True)

    with (
        fetch_patch,
        context_patch,
        validation_patch,
        patch.object(
            _routes,
            "get_or_generate_profile_intelligence",
            side_effect=ProfileIntelligenceLLMError("provider down", error_kind="provider_error"),
        ),
    ):
        response = await _call_get_profile()

    assert response.ai_profile_intelligence is None
    assert response.ai_profile_intelligence_meta is None
    assert response.analysis_error is not None
    assert response.analysis_error.failed_phase == 5
    assert response.analysis_error.error_code == "provider_error"
    assert response.last_completed_phase == 3


@pytest.mark.asyncio
async def test_get_linkedin_profile_context_build_error_returns_500() -> None:
    from services.integrations.linkedin.profile_context_types import ProfileContextBuildError

    with (
        patch.object(
            _routes,
            "get_or_fetch_profile",
            new_callable=AsyncMock,
            return_value=({"name": "Jane"}, {"source": "cache", "profile_content_hash": "x"}),
        ),
        patch.object(
            _routes,
            "get_or_build_profile_context",
            side_effect=ProfileContextBuildError("build failed"),
        ),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await _call_get_profile()

    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "Unable to build LinkedIn profile context."


@pytest.mark.asyncio
async def test_get_linkedin_profile_default_does_not_invoke_phase_7() -> None:
    with _enter_profile_patches(is_profile_complete=True) as stack:
        optimization_mock = stack.enter_context(
            patch.object(_routes, "get_or_generate_profile_optimization")
        )
        response = await _call_get_profile()

    optimization_mock.assert_not_called()
    assert response.profile_optimization is None
    assert response.profile_optimization_meta is None


@pytest.mark.asyncio
async def test_get_linkedin_profile_includes_profile_optimization_when_flag_set() -> None:
    with _enter_profile_patches(
        is_profile_complete=True,
        include_profile_optimization=True,
        optimization_source="generated",
    ):
        response = await _call_get_profile(include_profile_optimization=True)

    assert response.profile_optimization is not None
    assert len(response.profile_optimization) == 5
    assert response.profile_optimization[0].profile_section == "headline"
    assert response.profile_optimization_meta is not None
    assert response.profile_optimization_meta.source == "generated"
    assert response.profile_optimization_error is None
    assert response.last_completed_phase == 7


@pytest.mark.asyncio
async def test_get_linkedin_profile_passes_refresh_profile_optimization_flag() -> None:
    (
        _profile,
        _acquire_meta,
        _context,
        _context_meta,
        _validation,
        fetch_patch,
        context_patch,
        validation_patch,
        intelligence_patch,
        recommendations_patch,
        optimization_patch,
    ) = _profile_patches(is_profile_complete=True, include_profile_optimization=True)

    with (
        fetch_patch,
        context_patch,
        validation_patch,
        intelligence_patch,
        recommendations_patch,
        optimization_patch as optimization_mock,
    ):
        await _call_get_profile(
            include_profile_optimization=True,
            refresh_profile_optimization=True,
        )
        optimization_mock.assert_called_once()
        assert optimization_mock.call_args.kwargs["force_regenerate"] is True
