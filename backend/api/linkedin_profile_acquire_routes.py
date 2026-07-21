"""
LinkedIn profile acquire routes — GET /api/linkedin-social/profile.

Split out of the original linkedin_social_routes.py monolith.
Edit routes (POST /profile/complete, POST /profile/optimization/*) live in
linkedin_profile_edit_routes.py. Aggregate analytics live in
linkedin_analytics_routes.py. Separate from routers/linkedin.py (content
generation / LinkedIn Writer).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger

from middleware.auth_middleware import get_current_user
from models.linkedin_social_models import (
    LinkedInProfileAcquireResponse,
    LinkedInProfileCompleteResponse,
    LinkedInProfileContextMetaResponse,
    LinkedInProfileMetaResponse,
    AIProfileIntelligenceResponse,
    CompletionQuestionResponse,
    ProfileCompletionResponse,
    ProfileIntelligenceMetaResponse,
    ProfileAnalysisErrorResponse,
    ProfileOptimizationBatchActionResponse,
    ProfileOptimizationDebugResponse,
    ProfileOptimizationMetaResponse,
    ProfileOptimizationResponse,
    ProfileValidationResponse,
    TopicRecommendationResponse,
    TopicRecommendationsMetaResponse,
)
from services.integrations.linkedin.profile_intelligence_llm import ProfileIntelligenceLLMError
from services.integrations.linkedin.profile_intelligence_service import (
    ProfileIntelligenceAcquireMeta,
    ProfileIntelligenceError,
    get_or_generate_profile_intelligence,
)
from services.integrations.linkedin.profile_intelligence_validator import (
    ProfileIntelligenceValidationError,
)
from services.integrations.linkedin.profile_optimization_rubric import (
    ProfileOptimizationRubricError,
    detect_profile_optimization_gaps,
)
from services.integrations.linkedin.profile_optimization_service import (
    ProfileOptimizationAcquireMeta,
    ProfileOptimizationError,
    ProfileOptimizationLLMError,
    get_or_generate_profile_optimization,
)
from services.integrations.linkedin.profile_optimization_validator import (
    ProfileOptimizationValidationError,
)
from services.integrations.linkedin.topic_recommendation_service import (
    TopicRecommendationAcquireMeta,
    TopicRecommendationLLMError,
    TopicRecommendationError,
    get_or_generate_topic_recommendations,
)
from services.integrations.linkedin.topic_recommendation_validator import (
    TopicRecommendationValidationError,
)
from services.integrations.linkedin.profile_context_service import get_or_build_profile_context
from services.integrations.linkedin.profile_context_types import ProfileContextBuildError
from services.integrations.linkedin.profile_completion_questions import build_completion_questions
from services.integrations.linkedin.profile_completion_service import (
    ProfileAlreadyCompleteError,
    ProfileCompletionError,
    ProfileCompletionResult,
)
from services.integrations.linkedin.profile_context_patcher import ProfileCompletionPatchError
from services.integrations.linkedin.profile_repository import ProfileRepository
from services.integrations.linkedin.profile_service import get_or_fetch_profile
from services.integrations.linkedin.profile_validation_service import (
    get_or_validate_profile_context,
)
from services.integrations.linkedin.profile_validation_types import ProfileValidationResult
from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.integrations.linkedin.exceptions import LinkedInDuplicateContentError
from services.integrations.linkedin.unipile_client import UnipileAPIError
from api.linkedin_oauth_connection_routes import _oauth_service

router = APIRouter(prefix="/api/linkedin-social", tags=["LinkedIn Social"])

_RECOMMENDATIONS_USER_ERROR = (
    "We couldn't load content suggestions right now. Please try again."
)

_PROFILE_OPTIMIZATION_USER_ERROR = (
    "We couldn't load profile suggestions right now. Please try again."
)

_ANALYSIS_PHASE_LABELS: Dict[int, str] = {
    1: "Acquire Profile Data",
    2: "Build Profile Context",
    3: "Validate Profile",
    4: "Profile Completion",
    5: "AI Profile Intelligence",
    6: "Topic Recommendations",
    7: "Profile Optimization",
}

def _make_analysis_error(
    phase: int,
    error_code: str,
    user_message: str,
    exc: Optional[Exception] = None,
    *,
    user_id: str = "",
) -> ProfileAnalysisErrorResponse:
    """Build a structured analysis error and log safe diagnostics."""
    phase_label = _ANALYSIS_PHASE_LABELS.get(phase, f"Phase {phase}")
    debug_message = str(exc)[:500] if exc else None
    logger.error(
        "[LinkedInAnalysis] phase={} ({}) code={} user_id={} user_message={} debug={}",
        phase,
        phase_label,
        error_code,
        user_id,
        user_message,
        debug_message,
    )
    return ProfileAnalysisErrorResponse(
        failed_phase=phase,
        phase_label=phase_label,
        error_code=error_code,
        user_message=user_message,
        debug_message=debug_message,
    )


def _user_id(current_user: dict) -> str:
    uid = current_user.get("id") if current_user else None
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return str(uid)


def _resolve_user_account_id(user_id: str, account_id: Optional[str]) -> str:
    if account_id:
        return account_id
    creds = _oauth_service.resolve_credentials(user_id)
    resolved = creds.primary_account_id
    if not resolved:
        raise HTTPException(
            status_code=400,
            detail="account_id query param is required when no default LinkedIn account is stored",
        )
    return resolved


def _raise_profile_acquire_http_error(exc: Exception, *, user_id: str) -> None:
    """Map profile acquire failures to Phase 1 HTTP status codes."""
    if isinstance(exc, LinkedInNotConnectedError):
        logger.warning(
            "[LinkedInProfile] GET /profile not connected user_id={}: {}",
            user_id,
            exc,
        )
        raise HTTPException(
            status_code=401,
            detail="LinkedIn account not connected",
        ) from exc

    if isinstance(exc, UnipileAPIError):
        status = exc.status_code
        message = str(exc).lower()
        if status == 401 or "disconnected" in message or "reconnect" in message:
            logger.warning(
                "[LinkedInProfile] GET /profile Unipile disconnected user_id={}: {}",
                user_id,
                exc,
            )
            raise HTTPException(status_code=401, detail="Reconnect required") from exc
        if status == 403:
            logger.warning(
                "[LinkedInProfile] GET /profile Unipile forbidden user_id={}: {}",
                user_id,
                exc,
            )
            raise HTTPException(
                status_code=502,
                detail="Unable to fetch LinkedIn profile",
            ) from exc
        logger.warning(
            "[LinkedInProfile] GET /profile Unipile error user_id={}: {}",
            user_id,
            exc,
        )
        raise HTTPException(
            status_code=502,
            detail="Unable to fetch LinkedIn profile",
        ) from exc

    logger.exception(
        "[LinkedInProfile] GET /profile unexpected error user_id={}: {}",
        user_id,
        exc,
    )
    raise HTTPException(
        status_code=500,
        detail="Unable to fetch LinkedIn profile",
    ) from exc


def _raise_profile_context_http_error(exc: Exception, *, user_id: str) -> None:
    """Map profile context build failures to Phase 2 HTTP status codes."""
    if isinstance(exc, ProfileContextBuildError):
        logger.exception(
            "[LinkedInProfileContext] GET /profile context build failed user_id={}: {}",
            user_id,
            exc,
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to build LinkedIn profile context.",
        ) from exc

    if isinstance(exc, ValueError):
        logger.error(
            "[LinkedInProfileContext] GET /profile context persistence error user_id={}: {}",
            user_id,
            exc,
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to build LinkedIn profile context.",
        ) from exc

    logger.exception(
        "[LinkedInProfileContext] GET /profile unexpected context error user_id={}: {}",
        user_id,
        exc,
    )
    raise HTTPException(
        status_code=500,
        detail="Unable to build LinkedIn profile context.",
    ) from exc


def _validation_result_to_response(
    validation: ProfileValidationResult,
) -> ProfileValidationResponse:
    """Map Phase 3 validation dict to API response model."""
    raw_section_scores = validation.get("section_scores")
    section_scores: Optional[Dict[str, int]] = None
    if isinstance(raw_section_scores, dict):
        section_scores = {
            str(key): int(value)
            for key, value in raw_section_scores.items()
            if isinstance(value, (int, float))
        }
    return ProfileValidationResponse(
        is_profile_complete=bool(validation.get("is_profile_complete")),
        completeness_score=int(validation.get("completeness_score") or 0),
        missing_fields=list(validation.get("missing_fields") or []),
        optional_missing_fields=list(validation.get("optional_missing_fields") or []),
        optimization_score=(
            int(validation["optimization_score"])
            if validation.get("optimization_score") is not None
            else None
        ),
        optimization_gaps_count=(
            int(validation["optimization_gaps_count"])
            if validation.get("optimization_gaps_count") is not None
            else None
        ),
        section_scores=section_scores,
        score_basis=validation.get("score_basis"),
    )


def _completion_result_to_response(
    result: ProfileCompletionResult,
    *,
    ai_profile_intelligence: Optional[AIProfileIntelligenceResponse] = None,
    ai_profile_intelligence_meta: Optional[ProfileIntelligenceMetaResponse] = None,
) -> LinkedInProfileCompleteResponse:
    """Map completion service result to POST /profile/complete response."""
    return LinkedInProfileCompleteResponse(
        profile_context=result.profile_context,
        profile_validation=_validation_result_to_response(result.profile_validation),
        profile_completion=ProfileCompletionResponse(
            questions=[
                CompletionQuestionResponse(
                    field_key=question["field_key"],
                    label=question["label"],
                    input_type=question["input_type"],
                    required=question["required"],
                )
                for question in result.questions
            ]
        ),
        ai_profile_intelligence=ai_profile_intelligence,
        ai_profile_intelligence_meta=ai_profile_intelligence_meta,
    )


def _stored_intelligence_to_response(
    stored: dict[str, Any],
) -> AIProfileIntelligenceResponse:
    """Map persisted intelligence dict to API response (exclude server ``meta``)."""
    payload = {key: value for key, value in stored.items() if key != "meta"}
    return AIProfileIntelligenceResponse.model_validate(payload)


def _intelligence_meta_to_response(
    meta: ProfileIntelligenceAcquireMeta,
) -> Optional[ProfileIntelligenceMetaResponse]:
    """Map orchestrator meta to API response when intelligence was acquired."""
    source = meta.get("source")
    if source not in ("cache", "generated"):
        return None
    return ProfileIntelligenceMetaResponse(
        source=source,  # type: ignore[arg-type]
        ai_intelligence_updated_at=meta.get("ai_intelligence_updated_at"),
    )


def _load_profile_intelligence_for_response(
    user_id: str,
    profile_context: dict[str, Any],
    profile_validation: ProfileValidationResult,
    repository: ProfileRepository,
    *,
    force_regenerate: bool = False,
) -> tuple[
    Optional[AIProfileIntelligenceResponse],
    Optional[ProfileIntelligenceMetaResponse],
    Optional[ProfileAnalysisErrorResponse],
]:
    """
    Generate or load AI profile intelligence for API responses.

    Returns ``(None, None, analysis_error)`` on failure instead of raising HTTP errors.
    """
    if not profile_validation.get("is_profile_complete"):
        logger.info(
            "[ProfileIntelligence] API skip — profile incomplete user_id={} "
            "missing_fields={}",
            user_id,
            profile_validation.get("missing_fields"),
        )
        return None, None, None

    logger.info(
        "[LinkedInAnalysis] Phase 5 start user_id={} force_regenerate={}",
        user_id,
        force_regenerate,
    )
    try:
        stored, meta = get_or_generate_profile_intelligence(
            user_id,
            profile_context,
            profile_validation=profile_validation,
            repository=repository,
            force_regenerate=force_regenerate,
        )
    except ProfileIntelligenceLLMError as exc:
        error_kind = getattr(exc, "error_kind", "llm_error")
        logger.exception(
            "[ProfileIntelligence] LLM failure user_id={} kind={}: {}",
            user_id,
            error_kind,
            exc,
        )
        return (
            None,
            None,
            _make_analysis_error(
                5,
                error_kind,
                "We couldn't analyze your LinkedIn profile right now. Please try again.",
                exc,
                user_id=user_id,
            ),
        )
    except ProfileIntelligenceValidationError as exc:
        validation_code = getattr(exc, "validation_code", "validation_failed")
        logger.exception(
            "[ProfileIntelligence] validation failure user_id={} code={}: {}",
            user_id,
            validation_code,
            exc,
        )
        return (
            None,
            None,
            _make_analysis_error(
                5,
                validation_code,
                "Profile analysis returned invalid data from AI. Please try again.",
                exc,
                user_id=user_id,
            ),
        )
    except (ProfileIntelligenceError, ValueError) as exc:
        logger.exception(
            "[ProfileIntelligence] orchestration failure user_id={}: {}",
            user_id,
            exc,
        )
        return (
            None,
            None,
            _make_analysis_error(
                5,
                "orchestration_error",
                "We couldn't analyze your LinkedIn profile right now. Please try again.",
                exc,
                user_id=user_id,
            ),
        )
    except Exception as exc:
        logger.exception(
            "[ProfileIntelligence] unexpected failure user_id={}: {}",
            user_id,
            exc,
        )
        return (
            None,
            None,
            _make_analysis_error(
                5,
                "unexpected_error",
                "We couldn't analyze your LinkedIn profile right now. Please try again.",
                exc,
                user_id=user_id,
            ),
        )

    if not stored:
        logger.warning(
            "[ProfileIntelligence] API load returned empty intelligence user_id={}",
            user_id,
        )
        return (
            None,
            None,
            _make_analysis_error(
                5,
                "empty_result",
                "Profile analysis did not return any results. Please try again.",
                user_id=user_id,
            ),
        )

    logger.info(
        "[LinkedInAnalysis] Phase 5 complete user_id={} source={}",
        user_id,
        meta.get("source"),
    )
    return _stored_intelligence_to_response(stored), _intelligence_meta_to_response(meta), None


def _recommendation_dict_to_response(item: dict[str, Any]) -> TopicRecommendationResponse:
    """Map a single recommendation dict to API response model."""
    return TopicRecommendationResponse.model_validate(item)


def _recommendations_meta_to_response(
    meta: TopicRecommendationAcquireMeta,
) -> Optional[TopicRecommendationsMetaResponse]:
    """Map orchestrator meta to API response when recommendations were acquired."""
    source = meta.get("source")
    if source not in ("cache", "generated"):
        return None
    return TopicRecommendationsMetaResponse(
        source=source,  # type: ignore[arg-type]
        recommendations_updated_at=meta.get("recommendations_updated_at"),
    )


def _build_profile_optimization_debug_response(
    user_id: str,
    profile_context: dict[str, Any],
    profile_validation: ProfileValidationResult,
) -> ProfileOptimizationDebugResponse:
    """
    Run Phase 7 rubric for dev/manual testing (no LLM).

    Returns empty summary when profile context is unavailable.
    """
    logger.info(
        "[ProfileOptimization] debug rubric start user_id={} is_profile_complete={}",
        user_id,
        profile_validation.get("is_profile_complete"),
    )
    try:
        gaps = detect_profile_optimization_gaps(profile_context, profile_validation)
    except ProfileOptimizationRubricError as exc:
        logger.exception(
            "[ProfileOptimization] debug rubric failed user_id={}: {}",
            user_id,
            exc,
        )
        return ProfileOptimizationDebugResponse(detected_gaps_count=0, rule_ids=[])
    except Exception as exc:
        logger.exception(
            "[ProfileOptimization] debug rubric unexpected error user_id={}: {}",
            user_id,
            exc,
        )
        return ProfileOptimizationDebugResponse(detected_gaps_count=0, rule_ids=[])

    rule_ids = [gap.rule_id for gap in gaps]
    logger.info(
        "[ProfileOptimization] debug rubric complete user_id={} count={} top_rule_ids={}",
        user_id,
        len(gaps),
        rule_ids[:3],
    )
    return ProfileOptimizationDebugResponse(
        detected_gaps_count=len(gaps),
        rule_ids=rule_ids,
    )


def _load_topic_recommendations_for_response(
    user_id: str,
    ai_profile_intelligence: dict[str, Any],
    profile_validation: ProfileValidationResult,
    repository: ProfileRepository,
    *,
    force_regenerate: bool = False,
) -> tuple[
    Optional[List[TopicRecommendationResponse]],
    Optional[TopicRecommendationsMetaResponse],
    Optional[str],
    Optional[ProfileAnalysisErrorResponse],
]:
    """
    Generate or load topic recommendations for API responses.

    Returns user-facing ``recommendations_error`` string plus structured ``analysis_error``.
    """
    if not profile_validation.get("is_profile_complete"):
        logger.info(
            "[TopicRecommendation] API skip — profile incomplete user_id={} missing_fields={}",
            user_id,
            profile_validation.get("missing_fields"),
        )
        return None, None, None, None

    if not isinstance(ai_profile_intelligence, dict) or not ai_profile_intelligence:
        logger.info(
            "[TopicRecommendation] API skip — intelligence missing user_id={}",
            user_id,
        )
        return (
            None,
            None,
            None,
            _make_analysis_error(
                6,
                "missing_intelligence",
                "Complete profile analysis before generating topic suggestions.",
                user_id=user_id,
            ),
        )

    logger.info(
        "[LinkedInAnalysis] Phase 6 start user_id={} force_regenerate={}",
        user_id,
        force_regenerate,
    )
    try:
        recommendations, meta = get_or_generate_topic_recommendations(
            user_id,
            ai_profile_intelligence,
            profile_validation=profile_validation,
            repository=repository,
            force_regenerate=force_regenerate,
        )
    except TopicRecommendationLLMError as exc:
        error_kind = getattr(exc, "error_kind", "llm_failure")
        logger.exception(
            "[TopicRecommendation] LLM failure user_id={} kind={}: {}",
            user_id,
            error_kind,
            exc,
        )
        analysis_error = _make_analysis_error(
            6,
            error_kind,
            _RECOMMENDATIONS_USER_ERROR,
            exc,
            user_id=user_id,
        )
        return None, None, _RECOMMENDATIONS_USER_ERROR, analysis_error
    except TopicRecommendationValidationError as exc:
        validation_code = getattr(exc, "validation_code", "validation_failed")
        logger.exception(
            "[TopicRecommendation] validation failure user_id={} code={}: {}",
            user_id,
            validation_code,
            exc,
        )
        analysis_error = _make_analysis_error(
            6,
            validation_code,
            _RECOMMENDATIONS_USER_ERROR,
            exc,
            user_id=user_id,
        )
        return None, None, _RECOMMENDATIONS_USER_ERROR, analysis_error
    except (TopicRecommendationError, ValueError) as exc:
        logger.exception(
            "[TopicRecommendation] orchestration failure user_id={}: {}",
            user_id,
            exc,
        )
        analysis_error = _make_analysis_error(
            6,
            "orchestration_failed",
            _RECOMMENDATIONS_USER_ERROR,
            exc,
            user_id=user_id,
        )
        return None, None, _RECOMMENDATIONS_USER_ERROR, analysis_error
    except Exception as exc:
        logger.exception(
            "[TopicRecommendation] unexpected failure user_id={}: {}",
            user_id,
            exc,
        )
        analysis_error = _make_analysis_error(
            6,
            "unexpected_error",
            _RECOMMENDATIONS_USER_ERROR,
            exc,
            user_id=user_id,
        )
        return None, None, _RECOMMENDATIONS_USER_ERROR, analysis_error

    if not recommendations:
        logger.warning(
            "[TopicRecommendation] API load returned empty recommendations user_id={}",
            user_id,
        )
        analysis_error = _make_analysis_error(
            6,
            "empty_response",
            _RECOMMENDATIONS_USER_ERROR,
            user_id=user_id,
        )
        return None, None, _RECOMMENDATIONS_USER_ERROR, analysis_error

    try:
        response_items = [
            _recommendation_dict_to_response(item) for item in recommendations
        ]
    except Exception as exc:
        logger.exception(
            "[TopicRecommendation] response mapping failure user_id={}: {}",
            user_id,
            exc,
        )
        analysis_error = _make_analysis_error(
            6,
            "response_mapping_failed",
            _RECOMMENDATIONS_USER_ERROR,
            exc,
            user_id=user_id,
        )
        return None, None, _RECOMMENDATIONS_USER_ERROR, analysis_error

    logger.info(
        "[LinkedInAnalysis] Phase 6 complete user_id={} source={} count={}",
        user_id,
        meta.get("source"),
        len(response_items),
    )
    return response_items, _recommendations_meta_to_response(meta), None, None


def _optimization_dict_to_response(item: dict[str, Any]) -> ProfileOptimizationResponse:
    """Map a single profile optimization dict to API response model."""
    return ProfileOptimizationResponse.model_validate(item)


def _profile_optimization_meta_to_response(
    meta: ProfileOptimizationAcquireMeta,
) -> Optional[ProfileOptimizationMetaResponse]:
    """Map orchestrator meta to API response when optimization was acquired."""
    source = meta.get("source")
    if source not in ("cache", "generated", "no_gaps", "batch_advanced"):
        return None
    return ProfileOptimizationMetaResponse(
        source=source,  # type: ignore[arg-type]
        profile_optimization_updated_at=meta.get("profile_optimization_updated_at"),
        active_batch_index=int(meta.get("active_batch_index") or 0),
        remaining_in_backlog=int(meta.get("remaining_in_backlog") or 0),
        message=meta.get("message"),
    )


def _batch_action_response_from_items(
    items: list[dict[str, Any]],
    meta: ProfileOptimizationAcquireMeta,
    *,
    profile_validation: ProfileValidationResult | None = None,
) -> ProfileOptimizationBatchActionResponse:
    """Build batch action API response from service-layer items and meta."""
    meta_response = _profile_optimization_meta_to_response(meta)
    if meta_response is None:
        raise ValueError("Invalid profile optimization meta from service")
    response_items = [_optimization_dict_to_response(item) for item in items]
    remaining = meta_response.remaining_in_backlog
    show_next_batch_cta = len(response_items) == 0 and remaining > 0
    validation_response = (
        _validation_result_to_response(profile_validation)
        if profile_validation
        else None
    )
    return ProfileOptimizationBatchActionResponse(
        profile_optimization=response_items,
        profile_optimization_meta=meta_response,
        show_next_batch_cta=show_next_batch_cta,
        profile_validation=validation_response,
    )


def _load_profile_optimization_for_response(
    user_id: str,
    profile_context: dict[str, Any],
    profile_validation: ProfileValidationResult,
    ai_profile_intelligence: dict[str, Any],
    repository: ProfileRepository,
    *,
    force_regenerate: bool = False,
) -> tuple[
    Optional[List[ProfileOptimizationResponse]],
    Optional[ProfileOptimizationMetaResponse],
    Optional[str],
    Optional[ProfileAnalysisErrorResponse],
]:
    """
    Generate or load profile optimization recommendations for API responses.

    Returns user-facing ``profile_optimization_error`` plus structured ``analysis_error``.
    """
    if not profile_validation.get("is_profile_complete"):
        logger.info(
            "[ProfileOptimization] API skip — profile incomplete user_id={} missing_fields={}",
            user_id,
            profile_validation.get("missing_fields"),
        )
        return None, None, None, None

    if not isinstance(ai_profile_intelligence, dict) or not ai_profile_intelligence:
        logger.info(
            "[ProfileOptimization] API skip — intelligence missing user_id={}",
            user_id,
        )
        return (
            None,
            None,
            None,
            _make_analysis_error(
                7,
                "missing_intelligence",
                "Complete profile analysis before generating profile suggestions.",
                user_id=user_id,
            ),
        )

    logger.info(
        "[LinkedInAnalysis] Phase 7 start user_id={} force_regenerate={}",
        user_id,
        force_regenerate,
    )
    try:
        recommendations, meta = get_or_generate_profile_optimization(
            user_id,
            profile_context,
            profile_validation,
            ai_profile_intelligence,
            repository=repository,
            force_regenerate=force_regenerate,
        )
    except ProfileOptimizationLLMError as exc:
        error_kind = getattr(exc, "error_kind", "llm_failure")
        logger.exception(
            "[ProfileOptimization] LLM failure user_id={} kind={}: {}",
            user_id,
            error_kind,
            exc,
        )
        analysis_error = _make_analysis_error(
            7,
            error_kind,
            _PROFILE_OPTIMIZATION_USER_ERROR,
            exc,
            user_id=user_id,
        )
        return None, None, _PROFILE_OPTIMIZATION_USER_ERROR, analysis_error
    except ProfileOptimizationValidationError as exc:
        validation_code = getattr(exc, "validation_code", "validation_failed")
        logger.exception(
            "[ProfileOptimization] validation failure user_id={} code={}: {}",
            user_id,
            validation_code,
            exc,
        )
        analysis_error = _make_analysis_error(
            7,
            validation_code,
            _PROFILE_OPTIMIZATION_USER_ERROR,
            exc,
            user_id=user_id,
        )
        return None, None, _PROFILE_OPTIMIZATION_USER_ERROR, analysis_error
    except (ProfileOptimizationError, ValueError) as exc:
        logger.exception(
            "[ProfileOptimization] orchestration failure user_id={}: {}",
            user_id,
            exc,
        )
        analysis_error = _make_analysis_error(
            7,
            "orchestration_failed",
            _PROFILE_OPTIMIZATION_USER_ERROR,
            exc,
            user_id=user_id,
        )
        return None, None, _PROFILE_OPTIMIZATION_USER_ERROR, analysis_error
    except Exception as exc:
        logger.exception(
            "[ProfileOptimization] unexpected failure user_id={}: {}",
            user_id,
            exc,
        )
        analysis_error = _make_analysis_error(
            7,
            "unexpected_error",
            _PROFILE_OPTIMIZATION_USER_ERROR,
            exc,
            user_id=user_id,
        )
        return None, None, _PROFILE_OPTIMIZATION_USER_ERROR, analysis_error

    meta_response = _profile_optimization_meta_to_response(meta)
    if meta.get("source") == "no_gaps":
        logger.info(
            "[LinkedInAnalysis] Phase 7 complete user_id={} source=no_gaps count=0",
            user_id,
        )
        return [], meta_response, None, None

    if recommendations is None:
        logger.info(
            "[ProfileOptimization] API load returned None recommendations user_id={}",
            user_id,
        )
        return None, None, None, None

    if not recommendations:
        logger.warning(
            "[ProfileOptimization] API load returned empty recommendations user_id={}",
            user_id,
        )
        analysis_error = _make_analysis_error(
            7,
            "empty_response",
            _PROFILE_OPTIMIZATION_USER_ERROR,
            user_id=user_id,
        )
        return None, None, _PROFILE_OPTIMIZATION_USER_ERROR, analysis_error

    try:
        response_items = [
            _optimization_dict_to_response(item) for item in recommendations
        ]
    except Exception as exc:
        logger.exception(
            "[ProfileOptimization] response mapping failure user_id={}: {}",
            user_id,
            exc,
        )
        analysis_error = _make_analysis_error(
            7,
            "response_mapping_failed",
            _PROFILE_OPTIMIZATION_USER_ERROR,
            exc,
            user_id=user_id,
        )
        return None, None, _PROFILE_OPTIMIZATION_USER_ERROR, analysis_error

    logger.info(
        "[LinkedInAnalysis] Phase 7 complete user_id={} source={} count={}",
        user_id,
        meta.get("source"),
        len(response_items),
    )
    return response_items, meta_response, None, None


def _build_profile_completion_payload(
    validation: ProfileValidationResult,
) -> ProfileCompletionResponse:
    """Build completion questions when profile is incomplete."""
    if validation.get("is_profile_complete"):
        return ProfileCompletionResponse(questions=[])

    questions = build_completion_questions(list(validation.get("missing_fields") or []))
    return ProfileCompletionResponse(
        questions=[
            CompletionQuestionResponse(
                field_key=question["field_key"],
                label=question["label"],
                input_type=question["input_type"],
                required=question["required"],
            )
            for question in questions
        ]
    )


def _raise_profile_validation_http_error(exc: Exception, *, user_id: str) -> None:
    """Map profile validation failures to HTTP status codes."""
    if isinstance(exc, ValueError):
        logger.error(
            "[ProfileValidation] GET /profile validation error user_id={}: {}",
            user_id,
            exc,
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to validate LinkedIn profile.",
        ) from exc

    logger.exception(
        "[ProfileValidation] GET /profile unexpected validation error user_id={}: {}",
        user_id,
        exc,
    )
    raise HTTPException(
        status_code=500,
        detail="Unable to validate LinkedIn profile.",
    ) from exc


def _raise_profile_completion_http_error(exc: Exception, *, user_id: str) -> None:
    """Map profile completion failures to HTTP status codes."""
    if isinstance(exc, ProfileAlreadyCompleteError):
        logger.info(
            "[ProfileCompletion] POST /profile/complete already complete user_id={}",
            user_id,
        )
        raise HTTPException(
            status_code=409,
            detail="Profile is already complete.",
        ) from exc

    if isinstance(exc, ProfileCompletionError):
        logger.warning(
            "[ProfileCompletion] POST /profile/complete bad request user_id={}: {}",
            user_id,
            exc,
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if isinstance(exc, ProfileCompletionPatchError):
        logger.exception(
            "[ProfileCompletion] POST /profile/complete patch failed user_id={}: {}",
            user_id,
            exc,
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to complete LinkedIn profile.",
        ) from exc

    if isinstance(exc, ValueError):
        logger.error(
            "[ProfileCompletion] POST /profile/complete persistence error user_id={}: {}",
            user_id,
            exc,
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to complete LinkedIn profile.",
        ) from exc

    logger.exception(
        "[ProfileCompletion] POST /profile/complete unexpected error user_id={}: {}",
        user_id,
        exc,
    )
    raise HTTPException(
        status_code=500,
        detail="Unable to complete LinkedIn profile.",
    ) from exc


@router.get("/profile", response_model=LinkedInProfileAcquireResponse)
async def get_linkedin_profile(
    refresh: bool = Query(
        False,
        description="Force Unipile fetch, update DB, and invalidate downstream on hash change",
    ),
    refresh_intelligence: bool = Query(
        False,
        description="Force regeneration of AI profile intelligence (Phase 5)",
    ),
    refresh_recommendations: bool = Query(
        False,
        description="Force regeneration of topic recommendations (Phase 6)",
    ),
    include_recommendations: bool = Query(
        False,
        description="Load topic recommendations from cache or generate on miss (Phase 6)",
    ),
    include_profile_optimization: bool = Query(
        False,
        description="Load profile optimization recommendations from cache or generate on miss (Phase 7)",
    ),
    refresh_profile_optimization: bool = Query(
        False,
        description="Force regeneration of profile optimization (Phase 7)",
    ),
    debug_profile_optimization_gaps: bool = Query(
        False,
        description="Run Phase 7 rubric only and return detected gap summary (dev testing)",
    ),
    current_user: dict = Depends(get_current_user),
) -> LinkedInProfileAcquireResponse:
    """
    Return the connected user's normalized LinkedIn profile and profile context.

    Phase 1: cache-first normalized profile from ``linkedin_analysis_context``.
    Phase 2: cache-first ``profile_context`` built from the normalized profile.
    Phase 3/4: ``profile_validation`` and completion questions when incomplete.
    Phase 5: ``ai_profile_intelligence`` when profile is complete (cache-first).
    Phase 6: ``recommendations`` only when ``include_recommendations`` or
    ``refresh_recommendations`` is true.
    Phase 7: ``profile_optimization`` only when ``include_profile_optimization`` or
    ``refresh_profile_optimization`` is true.
    """
    user_id = _user_id(current_user)
    logger.info(
        "[LinkedInAnalysis] pipeline start user_id={} refresh={} refresh_intelligence={} "
        "refresh_recommendations={} include_recommendations={} "
        "include_profile_optimization={} refresh_profile_optimization={} "
        "debug_profile_optimization_gaps={}",
        user_id,
        refresh,
        refresh_intelligence,
        refresh_recommendations,
        include_recommendations,
        include_profile_optimization,
        refresh_profile_optimization,
        debug_profile_optimization_gaps,
    )

    last_completed_phase = 0
    analysis_error: Optional[ProfileAnalysisErrorResponse] = None

    logger.info("[LinkedInAnalysis] Phase 1 start user_id={}", user_id)
    try:
        profile, meta = await get_or_fetch_profile(
            user_id,
            refresh=refresh,
            oauth=_oauth_service,
        )
    except (LinkedInNotConnectedError, UnipileAPIError) as exc:
        _raise_profile_acquire_http_error(exc, user_id=user_id)
    except Exception as exc:
        _raise_profile_acquire_http_error(exc, user_id=user_id)
    last_completed_phase = 1
    logger.info(
        "[LinkedInAnalysis] Phase 1 complete user_id={} source={}",
        user_id,
        meta.get("source"),
    )

    repository = ProfileRepository(oauth=_oauth_service)
    logger.info("[LinkedInAnalysis] Phase 2 start user_id={}", user_id)
    try:
        profile_context, context_meta = get_or_build_profile_context(
            user_id,
            profile,
            profile_content_hash=meta.get("profile_content_hash"),
            repository=repository,
        )
    except (ProfileContextBuildError, ValueError) as exc:
        _raise_profile_context_http_error(exc, user_id=user_id)
    except Exception as exc:
        _raise_profile_context_http_error(exc, user_id=user_id)
    last_completed_phase = 2
    logger.info(
        "[LinkedInAnalysis] Phase 2 complete user_id={} source={}",
        user_id,
        context_meta.get("source"),
    )

    logger.info("[LinkedInAnalysis] Phase 3 start user_id={}", user_id)
    try:
        profile_validation, _validation_meta = get_or_validate_profile_context(
            user_id,
            profile_context,
            repository=repository,
        )
        profile_completion = _build_profile_completion_payload(profile_validation)
    except ValueError as exc:
        _raise_profile_validation_http_error(exc, user_id=user_id)
    except Exception as exc:
        _raise_profile_validation_http_error(exc, user_id=user_id)
    last_completed_phase = 3
    if not profile_validation.get("is_profile_complete"):
        last_completed_phase = 4
        logger.info(
            "[LinkedInAnalysis] Phase 4 required user_id={} missing_fields={}",
            user_id,
            profile_validation.get("missing_fields"),
        )
    else:
        logger.info("[LinkedInAnalysis] Phase 3 complete user_id={} profile_complete=true", user_id)

    ai_profile_intelligence: Optional[AIProfileIntelligenceResponse] = None
    ai_profile_intelligence_meta: Optional[ProfileIntelligenceMetaResponse] = None
    intelligence_error: Optional[ProfileAnalysisErrorResponse] = None
    if profile_validation.get("is_profile_complete"):
        (
            ai_profile_intelligence,
            ai_profile_intelligence_meta,
            intelligence_error,
        ) = _load_profile_intelligence_for_response(
            user_id,
            profile_context,
            profile_validation,
            repository,
            force_regenerate=refresh_intelligence,
        )
        if intelligence_error:
            analysis_error = intelligence_error
        elif ai_profile_intelligence is not None:
            last_completed_phase = 5
    else:
        logger.info(
            "[ProfileIntelligence] GET /profile skipping intelligence — incomplete "
            "user_id={} missing_fields={}",
            user_id,
            profile_validation.get("missing_fields"),
        )

    recommendations: Optional[List[TopicRecommendationResponse]] = None
    recommendations_meta: Optional[TopicRecommendationsMetaResponse] = None
    recommendations_error: Optional[str] = None
    profile_optimization: Optional[List[ProfileOptimizationResponse]] = None
    profile_optimization_meta: Optional[ProfileOptimizationMetaResponse] = None
    profile_optimization_error: Optional[str] = None
    should_load_recommendations = refresh_recommendations or include_recommendations
    should_load_profile_optimization = (
        refresh_profile_optimization or include_profile_optimization
    )
    if ai_profile_intelligence is not None and should_load_recommendations:
        intelligence_dict = ai_profile_intelligence.model_dump()
        (
            recommendations,
            recommendations_meta,
            recommendations_error,
            recommendations_analysis_error,
        ) = _load_topic_recommendations_for_response(
            user_id,
            intelligence_dict,
            profile_validation,
            repository,
            force_regenerate=refresh_recommendations,
        )
        if recommendations_analysis_error:
            analysis_error = recommendations_analysis_error
        elif recommendations:
            last_completed_phase = 6
    elif ai_profile_intelligence is not None and not should_load_recommendations:
        logger.info(
            "[TopicRecommendation] GET /profile skipping recommendations — not requested "
            "user_id={} include_recommendations={} refresh_recommendations={}",
            user_id,
            include_recommendations,
            refresh_recommendations,
        )
    elif profile_validation.get("is_profile_complete") and intelligence_error is None:
        logger.info(
            "[TopicRecommendation] GET /profile skipping recommendations — no intelligence "
            "user_id={}",
            user_id,
        )

    if ai_profile_intelligence is not None and should_load_profile_optimization:
        intelligence_dict = ai_profile_intelligence.model_dump()
        (
            profile_optimization,
            profile_optimization_meta,
            profile_optimization_error,
            optimization_analysis_error,
        ) = _load_profile_optimization_for_response(
            user_id,
            profile_context,
            profile_validation,
            intelligence_dict,
            repository,
            force_regenerate=refresh_profile_optimization,
        )
        if optimization_analysis_error:
            analysis_error = optimization_analysis_error
        elif profile_optimization is not None or (
            profile_optimization_meta is not None
            and profile_optimization_meta.source == "no_gaps"
        ):
            last_completed_phase = 7
    elif should_load_profile_optimization:
        logger.info(
            "[ProfileOptimization] GET /profile skipping optimization — no intelligence "
            "user_id={}",
            user_id,
        )

    logger.info(
        "[LinkedInAnalysis] pipeline complete user_id={} last_completed_phase={} "
        "profile_source={} context_source={} is_profile_complete={} "
        "intelligence_source={} recommendations_source={} recommendations_count={} "
        "recommendations_error={} profile_optimization_source={} "
        "profile_optimization_count={} profile_optimization_error={} analysis_error_phase={}",
        user_id,
        last_completed_phase,
        meta.get("source"),
        context_meta.get("source"),
        profile_validation.get("is_profile_complete"),
        (
            ai_profile_intelligence_meta.source
            if ai_profile_intelligence_meta
            else None
        ),
        recommendations_meta.source if recommendations_meta else None,
        len(recommendations) if recommendations else 0,
        bool(recommendations_error),
        profile_optimization_meta.source if profile_optimization_meta else None,
        len(profile_optimization) if profile_optimization else 0,
        bool(profile_optimization_error),
        analysis_error.failed_phase if analysis_error else None,
    )

    profile_optimization_debug: Optional[ProfileOptimizationDebugResponse] = None
    if debug_profile_optimization_gaps:
        profile_optimization_debug = _build_profile_optimization_debug_response(
            user_id,
            profile_context,
            profile_validation,
        )

    return LinkedInProfileAcquireResponse(
        profile=profile,
        meta=LinkedInProfileMetaResponse(
            source=meta["source"],  # type: ignore[arg-type]
            fetched_at=meta.get("fetched_at"),
            profile_content_hash=meta.get("profile_content_hash"),
        ),
        profile_context=profile_context,
        profile_context_meta=LinkedInProfileContextMetaResponse(
            source=context_meta["source"],  # type: ignore[arg-type]
            profile_context_updated_at=context_meta.get("profile_context_updated_at"),
        ),
        profile_validation=_validation_result_to_response(profile_validation),
        profile_completion=profile_completion,
        ai_profile_intelligence=ai_profile_intelligence,
        ai_profile_intelligence_meta=ai_profile_intelligence_meta,
        recommendations=recommendations,
        recommendations_meta=recommendations_meta,
        recommendations_error=recommendations_error,
        profile_optimization=profile_optimization,
        profile_optimization_meta=profile_optimization_meta,
        profile_optimization_error=profile_optimization_error,
        last_completed_phase=last_completed_phase or None,
        analysis_error=analysis_error,
        profile_optimization_debug=profile_optimization_debug,
    )

