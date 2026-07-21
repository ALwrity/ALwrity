"""
LinkedIn profile edit routes — POST /profile/complete, POST /profile/optimization/*.

Split out of the original linkedin_social_routes.py monolith.
Acquire routes (GET /profile) live in linkedin_profile_acquire_routes.py.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger

from middleware.auth_middleware import get_current_user
from models.linkedin_social_models import (
    AIProfileIntelligenceResponse,
    LinkedInProfileCompleteRequest,
    LinkedInProfileCompleteResponse,
    ProfileIntelligenceMetaResponse,
    ProfileOptimizationBatchActionResponse,
    ProfileOptimizationCompleteRequest,
    ProfileOptimizationMetaResponse,
    ProfileOptimizationResponse,
    ProfileValidationResponse,
)
from services.integrations.linkedin.profile_completion_service import (
    ProfileAlreadyCompleteError,
    ProfileCompletionError,
    complete_profile,
)
from services.integrations.linkedin.profile_context_patcher import ProfileCompletionPatchError
from services.integrations.linkedin.profile_optimization_service import (
    ProfileOptimizationBatchNotReadyError,
    ProfileOptimizationError,
    ProfileOptimizationItemNotFoundError,
    ProfileOptimizationNotStoredError,
    advance_profile_optimization_batch,
    get_next_profile_optimization_batch,
)
from services.integrations.linkedin.profile_repository import ProfileRepository
from services.integrations.linkedin.profile_validation_service import (
    refresh_validation_with_optimization_progress,
)

from api.linkedin_oauth_connection_routes import _oauth_service
from api.linkedin_profile_acquire_routes import (
    _batch_action_response_from_items,
    _completion_result_to_response,
    _load_profile_intelligence_for_response,
    _raise_profile_completion_http_error,
)

router = APIRouter(prefix="/api/linkedin-social", tags=["LinkedIn Social"])


def _user_id(current_user: dict) -> str:
    return str(current_user.get("uid", ""))


@router.post("/profile/complete", response_model=LinkedInProfileCompleteResponse)
async def complete_linkedin_profile(
    body: LinkedInProfileCompleteRequest,
    current_user: dict = Depends(get_current_user),
) -> LinkedInProfileCompleteResponse:
    user_id = _user_id(current_user)
    logger.info(
        "[ProfileCompletion] POST /profile/complete user_id={} answer_keys={}",
        user_id,
        sorted(body.answers.keys()),
    )

    if not body.answers:
        logger.warning(
            "[ProfileCompletion] POST /profile/complete empty answers user_id={}",
            user_id,
        )
        raise HTTPException(status_code=400, detail="No completion answers provided.")

    repository = ProfileRepository(oauth=_oauth_service)
    try:
        result = complete_profile(
            user_id,
            body.answers,
            repository=repository,
        )
    except (ProfileAlreadyCompleteError, ProfileCompletionError) as exc:
        _raise_profile_completion_http_error(exc, user_id=user_id)
    except (ProfileCompletionPatchError, ValueError) as exc:
        _raise_profile_completion_http_error(exc, user_id=user_id)
    except Exception as exc:
        _raise_profile_completion_http_error(exc, user_id=user_id)

    logger.info(
        "[ProfileCompletion] POST /profile/complete success user_id={} "
        "is_profile_complete={}",
        user_id,
        result.profile_validation.get("is_profile_complete"),
    )

    ai_profile_intelligence: Optional[AIProfileIntelligenceResponse] = None
    ai_profile_intelligence_meta: Optional[ProfileIntelligenceMetaResponse] = None
    if result.profile_validation.get("is_profile_complete"):
        (
            ai_profile_intelligence,
            ai_profile_intelligence_meta,
            _intelligence_error,
        ) = _load_profile_intelligence_for_response(
            user_id,
            result.profile_context,
            result.profile_validation,
            repository,
        )
        if _intelligence_error:
            logger.warning(
                "[ProfileCompletion] POST /profile/complete intelligence failed user_id={} "
                "phase={} code={}",
                user_id,
                _intelligence_error.failed_phase,
                _intelligence_error.error_code,
            )

    return _completion_result_to_response(
        result,
        ai_profile_intelligence=ai_profile_intelligence,
        ai_profile_intelligence_meta=ai_profile_intelligence_meta,
    )


@router.post(
    "/profile/optimization/{recommendation_id}/complete",
    response_model=ProfileOptimizationBatchActionResponse,
)
async def complete_profile_optimization_recommendation(
    recommendation_id: str,
    body: ProfileOptimizationCompleteRequest,
    current_user: dict = Depends(get_current_user),
) -> ProfileOptimizationBatchActionResponse:
    user_id = _user_id(current_user)
    logger.info(
        "[ProfileOptimization] POST /profile/optimization/{}/complete user_id={} status={}",
        recommendation_id,
        user_id,
        body.status,
    )
    repository = ProfileRepository(oauth=_oauth_service)
    try:
        items, meta = advance_profile_optimization_batch(
            user_id,
            recommendation_id,
            body.status,
            repository=repository,
        )
    except ProfileOptimizationNotStoredError as exc:
        logger.warning(
            "[ProfileOptimization] complete not stored user_id={} recommendation_id={}: {}",
            user_id,
            recommendation_id,
            exc,
        )
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ProfileOptimizationItemNotFoundError as exc:
        logger.warning(
            "[ProfileOptimization] complete item not found user_id={} recommendation_id={}: {}",
            user_id,
            recommendation_id,
            exc,
        )
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ProfileOptimizationError as exc:
        logger.exception(
            "[ProfileOptimization] complete failed user_id={} recommendation_id={}: {}",
            user_id,
            recommendation_id,
            exc,
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to update profile optimization progress.",
        ) from exc

    try:
        stored = repository.get_profile_optimization(user_id)
        completed_ids: list[str] = []
        if stored and isinstance(stored.get("meta"), dict):
            raw_completed = stored["meta"].get("completed_ids")
            if isinstance(raw_completed, list):
                completed_ids = [str(item) for item in raw_completed if item]

        updated_validation = refresh_validation_with_optimization_progress(
            user_id,
            completed_ids,
            repository=repository,
        )
        response = _batch_action_response_from_items(
            items,
            meta,
            profile_validation=updated_validation,
        )
    except Exception as exc:
        logger.exception(
            "[ProfileOptimization] complete response mapping failed user_id={}: {}",
            user_id,
            exc,
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to format profile optimization response.",
        ) from exc

    logger.info(
        "[ProfileOptimization] POST /profile/optimization/{}/complete success user_id={} "
        "active_count={} remaining_in_backlog={} show_next_batch_cta={} optimization_score={}",
        recommendation_id,
        user_id,
        len(response.profile_optimization),
        response.profile_optimization_meta.remaining_in_backlog,
        response.show_next_batch_cta,
        (
            response.profile_validation.optimization_score
            if response.profile_validation
            else None
        ),
    )
    return response


@router.post(
    "/profile/optimization/next-batch",
    response_model=ProfileOptimizationBatchActionResponse,
)
async def load_next_profile_optimization_batch(
    current_user: dict = Depends(get_current_user),
) -> ProfileOptimizationBatchActionResponse:
    user_id = _user_id(current_user)
    logger.info(
        "[ProfileOptimization] POST /profile/optimization/next-batch user_id={}",
        user_id,
    )
    repository = ProfileRepository(oauth=_oauth_service)
    try:
        items, meta = get_next_profile_optimization_batch(
            user_id,
            repository=repository,
        )
    except ProfileOptimizationNotStoredError as exc:
        logger.warning(
            "[ProfileOptimization] next-batch not stored user_id={}: {}",
            user_id,
            exc,
        )
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ProfileOptimizationBatchNotReadyError as exc:
        logger.warning(
            "[ProfileOptimization] next-batch not ready user_id={}: {}",
            user_id,
            exc,
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ProfileOptimizationError as exc:
        logger.exception(
            "[ProfileOptimization] next-batch failed user_id={}: {}",
            user_id,
            exc,
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to load the next profile optimization batch.",
        ) from exc

    try:
        response = _batch_action_response_from_items(items, meta)
    except Exception as exc:
        logger.exception(
            "[ProfileOptimization] next-batch response mapping failed user_id={}: {}",
            user_id,
            exc,
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to format profile optimization response.",
        ) from exc

    logger.info(
        "[ProfileOptimization] POST /profile/optimization/next-batch success user_id={} "
        "active_count={} remaining_in_backlog={}",
        user_id,
        len(response.profile_optimization),
        response.profile_optimization_meta.remaining_in_backlog,
    )
    return response
