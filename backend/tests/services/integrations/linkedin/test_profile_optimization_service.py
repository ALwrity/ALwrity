"""Tests for Phase 7 profile optimization orchestrator."""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest

from services.integrations.linkedin.profile_context_types import default_profile_context
from services.integrations.linkedin.profile_intelligence_validator import (
    build_stored_ai_profile_intelligence,
    validate_ai_profile_intelligence_payload,
)
from services.integrations.linkedin.profile_optimization_service import (
    PROFILE_LOOKS_STRONG_MESSAGE,
    ProfileOptimizationBatchNotReadyError,
    ProfileOptimizationItemNotFoundError,
    advance_profile_optimization_batch,
    get_next_profile_optimization_batch,
    get_or_generate_profile_optimization,
)
from services.integrations.linkedin.profile_optimization_validator import (
    build_stored_profile_optimization,
    validate_profile_optimization_batch_payload,
)
from services.integrations.linkedin.profile_repository import (
    ProfileRepository,
    compute_ai_intelligence_hash,
    compute_profile_context_hash,
)
from services.integrations.linkedin.profile_validator import validate_profile_completeness

_USER_ID = "test-user-phase7-service"
_ACCOUNT_ID = "unipile-acc-phase7"
_MINIMAL_PROFILE = {"name": "Test User", "headline": "Engineer"}


@pytest.fixture
def repo(tmp_path) -> ProfileRepository:
    db_file = tmp_path / "linkedin_profile_optimization_service_test.db"
    return ProfileRepository(db_path=str(db_file))


def _complete_context() -> dict:
    context = default_profile_context()
    context["personal_information"].update(
        {
            "name": "Jane Doe",
            "first_name": "Jane",
            "last_name": "Doe",
            "headline": "Senior Engineer | Cloud | Python",
            "about": "Backend engineer with 8 years of experience building APIs.",
        }
    )
    context["professional_information"].update(
        {
            "job_title": "Senior Engineer",
            "company": "ACME Corp",
            "skills": [{"name": "Python", "endorsement_count": 3}],
            "skills_total_count": 1,
            "experience": [
                {
                    "title": "Senior Engineer",
                    "company": "ACME",
                    "description": "Built APIs serving 1M users.",
                }
            ],
        }
    )
    context["linkedin_information"].update(
        {
            "profile_picture": "https://example.com/photo.jpg",
            "public_identifier": "jane-doe",
            "profile_url": "https://linkedin.com/in/jane-doe",
        }
    )
    return context


def _valid_intelligence() -> dict[str, Any]:
    return {
        "professional_identity": "Senior Backend Engineer",
        "primary_expertise": ["Python", "FastAPI"],
        "industry": "Software Development",
        "experience_level": "Senior",
        "knowledge_domains": ["Backend Development"],
        "writing_opportunities": ["API Design"],
        "target_audience": ["Software Engineers"],
        "communication_style": "Technical",
        "brand_positioning": "Practical engineering insights.",
        "summary": "Backend engineer focused on scalable APIs.",
    }


def _valid_llm_batch() -> dict[str, Any]:
    sections = ["headline", "summary", "experience", "skills", "custom_url"]
    items = []
    for index, section in enumerate(sections, start=1):
        item = {
            "profile_section": section,
            "issue": f"Issue {index}",
            "why_it_matters": f"Why {index}.",
            "current_state_summary": f"Current {index}.",
            "recommended_action": f"Action {index}.",
            "suggested_copy": "",
            "impact": "High",
            "effort": "Low",
            "best_practice_ref": "Enhancement Report §1.2",
            "completion_criteria": f"Done {index}.",
        }
        if section in {"headline", "summary"}:
            item["suggested_copy"] = f"Copy {index}."
        items.append(item)
    return {"recommendations": items}


import json

def _mock_generate_fn_factory(counter: dict[str, int]):
    def mock_generate_fn(**_kwargs: Any) -> str:
        counter["calls"] = counter.get("calls", 0) + 1
        return json.dumps(_valid_llm_batch())

    return mock_generate_fn


def _seed_repo(
    repository: ProfileRepository,
    context: dict,
) -> tuple[dict, dict]:
    repository.save_normalized_profile(_USER_ID, _ACCOUNT_ID, _MINIMAL_PROFILE)
    repository.save_profile_context(_USER_ID, context)
    validation = validate_profile_completeness(context)
    repository.save_profile_validation(_USER_ID, validation)
    intelligence = build_stored_ai_profile_intelligence(
        validate_ai_profile_intelligence_payload(_valid_intelligence()),
        context_hash="ctx-hash",
    )
    repository.save_ai_profile_intelligence(_USER_ID, intelligence, context_hash="ctx-hash")
    return validation, intelligence


def test_incomplete_profile_skips_llm_and_returns_none(repo: ProfileRepository) -> None:
    context = _complete_context()
    context["personal_information"]["about"] = ""
    repo.save_normalized_profile(_USER_ID, _ACCOUNT_ID, _MINIMAL_PROFILE)
    repo.save_profile_context(_USER_ID, context)
    validation = validate_profile_completeness(context)
    intelligence = _valid_intelligence()
    counter: dict[str, int] = {}

    recommendations, meta = get_or_generate_profile_optimization(
        _USER_ID,
        context,
        validation,
        intelligence,
        repository=repo,
        generate_fn=_mock_generate_fn_factory(counter),
    )

    assert recommendations is None
    assert meta.get("profile_optimization_updated_at") is None
    assert "source" not in meta
    assert counter.get("calls", 0) == 0


def test_missing_intelligence_skips_llm(repo: ProfileRepository) -> None:
    context = _complete_context()
    validation = validate_profile_completeness(context)
    counter: dict[str, int] = {}

    recommendations, meta = get_or_generate_profile_optimization(
        _USER_ID,
        context,
        validation,
        {},
        repository=repo,
        generate_fn=_mock_generate_fn_factory(counter),
    )

    assert recommendations is None
    assert counter.get("calls", 0) == 0


@patch(
    "services.integrations.linkedin.profile_optimization_service.detect_profile_optimization_gaps",
    return_value=[],
)
def test_no_gaps_skips_llm_returns_friendly_message(
    _mock_gaps: Any,
    repo: ProfileRepository,
) -> None:
    context = _complete_context()
    validation, intelligence = _seed_repo(repo, context)
    counter: dict[str, int] = {}

    recommendations, meta = get_or_generate_profile_optimization(
        _USER_ID,
        context,
        validation,
        intelligence,
        repository=repo,
        generate_fn=_mock_generate_fn_factory(counter),
    )

    assert recommendations == []
    assert meta["source"] == "no_gaps"
    assert meta["message"] == PROFILE_LOOKS_STRONG_MESSAGE
    assert counter.get("calls", 0) == 0
    assert repo.get_profile_optimization(_USER_ID) is None


def test_mock_llm_persists_and_returns_five_items(repo: ProfileRepository) -> None:
    context = _complete_context()
    validation, intelligence = _seed_repo(repo, context)
    counter: dict[str, int] = {}

    recommendations, meta = get_or_generate_profile_optimization(
        _USER_ID,
        context,
        validation,
        intelligence,
        repository=repo,
        generate_fn=_mock_generate_fn_factory(counter),
    )

    assert counter["calls"] == 1
    assert meta["source"] == "generated"
    assert recommendations is not None
    assert len(recommendations) == 5
    assert all(item.get("id") for item in recommendations)
    stored = repo.get_profile_optimization(_USER_ID)
    assert stored is not None
    assert stored["meta"]["built_from_profile_context_hash"] == compute_profile_context_hash(
        context
    )
    assert stored["meta"]["built_from_intelligence_hash"] == compute_ai_intelligence_hash(
        intelligence
    )


def test_cache_hit_does_not_call_llm_twice(repo: ProfileRepository) -> None:
    context = _complete_context()
    validation, intelligence = _seed_repo(repo, context)
    counter: dict[str, int] = {}
    mock_fn = _mock_generate_fn_factory(counter)

    first, first_meta = get_or_generate_profile_optimization(
        _USER_ID,
        context,
        validation,
        intelligence,
        repository=repo,
        generate_fn=mock_fn,
    )
    second, second_meta = get_or_generate_profile_optimization(
        _USER_ID,
        context,
        validation,
        intelligence,
        repository=repo,
        generate_fn=mock_fn,
    )

    assert counter["calls"] == 1
    assert first_meta["source"] == "generated"
    assert second_meta["source"] == "cache"
    assert first == second
    assert len(first) == 5


def test_hash_mismatch_regenerates_optimization(repo: ProfileRepository) -> None:
    context = _complete_context()
    validation, intelligence = _seed_repo(repo, context)
    stale_payload = validate_profile_optimization_batch_payload(_valid_llm_batch())
    stale = build_stored_profile_optimization(
        stale_payload,
        profile_context_hash="stale-context-hash",
        intelligence_hash=compute_ai_intelligence_hash(intelligence),
    )
    repo.save_profile_optimization(
        _USER_ID,
        stale,
        profile_context_hash="stale-context-hash",
        intelligence_hash=compute_ai_intelligence_hash(intelligence),
    )

    counter: dict[str, int] = {}
    recommendations, meta = get_or_generate_profile_optimization(
        _USER_ID,
        context,
        validation,
        intelligence,
        repository=repo,
        generate_fn=_mock_generate_fn_factory(counter),
    )

    assert counter["calls"] == 1
    assert meta["source"] == "generated"
    assert recommendations is not None
    stored = repo.get_profile_optimization(_USER_ID)
    assert stored is not None
    assert stored["meta"]["built_from_profile_context_hash"] == compute_profile_context_hash(
        context
    )


def test_force_regenerate_bypasses_cache(repo: ProfileRepository) -> None:
    context = _complete_context()
    validation, intelligence = _seed_repo(repo, context)
    counter: dict[str, int] = {}
    mock_fn = _mock_generate_fn_factory(counter)

    get_or_generate_profile_optimization(
        _USER_ID,
        context,
        validation,
        intelligence,
        repository=repo,
        generate_fn=mock_fn,
    )
    get_or_generate_profile_optimization(
        _USER_ID,
        context,
        validation,
        intelligence,
        repository=repo,
        force_regenerate=True,
        generate_fn=mock_fn,
    )

    assert counter["calls"] == 2


def _optimization_item(index: int, section: str, item_id: str) -> dict[str, Any]:
    return {
        "id": item_id,
        "profile_section": section,
        "issue": f"Issue {index}",
        "why_it_matters": f"Why {index}.",
        "current_state_summary": f"Current {index}.",
        "recommended_action": f"Action {index}.",
        "suggested_copy": "",
        "impact": "High",
        "effort": "Low",
        "best_practice_ref": "Enhancement Report §1.2",
        "completion_criteria": f"Done {index}.",
    }


def _seed_stored_with_backlog(
    repository: ProfileRepository,
    context: dict,
    intelligence: dict[str, Any],
    *,
    active_ids: list[str],
    backlog_ids: list[str],
) -> None:
    context_hash = compute_profile_context_hash(context)
    intelligence_hash = compute_ai_intelligence_hash(intelligence)
    sections = [
        "headline",
        "summary",
        "experience",
        "skills",
        "custom_url",
        "certifications",
        "education",
        "featured",
        "recommendations",
        "profile_photo",
    ]
    active = [
        _optimization_item(index + 1, sections[index], item_id)
        for index, item_id in enumerate(active_ids)
    ]
    backlog = [
        _optimization_item(index + 6, sections[index + 5], item_id)
        for index, item_id in enumerate(backlog_ids)
    ]
    stored = {
        "meta": {
            "built_from_profile_context_hash": context_hash,
            "built_from_intelligence_hash": intelligence_hash,
            "schema_version": 1,
            "model": "gemini-2.5-flash",
            "active_batch_index": 0,
            "completed_ids": [],
        },
        "recommendations": active,
        "backlog": backlog,
    }
    repository.save_profile_optimization(
        _USER_ID,
        stored,
        profile_context_hash=context_hash,
        intelligence_hash=intelligence_hash,
    )


def test_advance_profile_optimization_batch_removes_item(repo: ProfileRepository) -> None:
    context = _complete_context()
    validation, intelligence = _seed_repo(repo, context)
    active_ids = [f"active-{index}" for index in range(1, 6)]
    backlog_ids = [f"backlog-{index}" for index in range(1, 6)]
    _seed_stored_with_backlog(
        repo, context, intelligence, active_ids=active_ids, backlog_ids=backlog_ids
    )

    items, meta = advance_profile_optimization_batch(
        _USER_ID,
        active_ids[0],
        "done",
        repository=repo,
    )

    assert len(items) == 4
    assert all(item["id"] != active_ids[0] for item in items)
    assert meta["source"] == "batch_advanced"
    assert meta["remaining_in_backlog"] == 5
    stored = repo.get_profile_optimization(_USER_ID)
    assert stored is not None
    assert active_ids[0] in stored["meta"]["completed_ids"]


def test_get_next_profile_optimization_batch_without_llm(repo: ProfileRepository) -> None:
    context = _complete_context()
    _, intelligence = _seed_repo(repo, context)
    active_ids = [f"active-{index}" for index in range(1, 6)]
    backlog_ids = [f"backlog-{index}" for index in range(1, 6)]
    _seed_stored_with_backlog(
        repo, context, intelligence, active_ids=active_ids, backlog_ids=backlog_ids
    )
    counter: dict[str, int] = {}

    for item_id in active_ids:
        advance_profile_optimization_batch(
            _USER_ID,
            item_id,
            "done",
            repository=repo,
        )

    items, meta = get_next_profile_optimization_batch(_USER_ID, repository=repo)

    assert counter.get("calls", 0) == 0
    assert len(items) == 5
    assert items[0]["id"] == backlog_ids[0]
    assert meta["source"] == "batch_advanced"
    assert meta["remaining_in_backlog"] == 0
    assert meta["active_batch_index"] == 1


def test_get_next_profile_optimization_batch_rejects_when_active_not_cleared(
    repo: ProfileRepository,
) -> None:
    context = _complete_context()
    _, intelligence = _seed_repo(repo, context)
    active_ids = [f"active-{index}" for index in range(1, 6)]
    backlog_ids = [f"backlog-{index}" for index in range(1, 6)]
    _seed_stored_with_backlog(
        repo, context, intelligence, active_ids=active_ids, backlog_ids=backlog_ids
    )

    with pytest.raises(ProfileOptimizationBatchNotReadyError):
        get_next_profile_optimization_batch(_USER_ID, repository=repo)


def test_advance_profile_optimization_batch_item_not_found(repo: ProfileRepository) -> None:
    context = _complete_context()
    _, intelligence = _seed_repo(repo, context)
    active_ids = [f"active-{index}" for index in range(1, 6)]
    backlog_ids = [f"backlog-{index}" for index in range(1, 6)]
    _seed_stored_with_backlog(
        repo, context, intelligence, active_ids=active_ids, backlog_ids=backlog_ids
    )

    with pytest.raises(ProfileOptimizationItemNotFoundError):
        advance_profile_optimization_batch(
            _USER_ID,
            "missing-id",
            "done",
            repository=repo,
        )


def test_cache_hit_with_empty_active_batch_and_backlog(repo: ProfileRepository) -> None:
    context = _complete_context()
    validation, intelligence = _seed_repo(repo, context)
    active_ids = [f"active-{index}" for index in range(1, 6)]
    backlog_ids = [f"backlog-{index}" for index in range(1, 6)]
    _seed_stored_with_backlog(
        repo, context, intelligence, active_ids=active_ids, backlog_ids=backlog_ids
    )
    for item_id in active_ids:
        advance_profile_optimization_batch(
            _USER_ID,
            item_id,
            "done",
            repository=repo,
        )
    counter: dict[str, int] = {}

    recommendations, meta = get_or_generate_profile_optimization(
        _USER_ID,
        context,
        validation,
        intelligence,
        repository=repo,
        generate_fn=_mock_generate_fn_factory(counter),
    )

    assert counter.get("calls", 0) == 0
    assert recommendations == []
    assert meta["source"] == "cache"
    assert meta["remaining_in_backlog"] == 5
