"""
LinkedIn Social API routes (Growth Engine — connect, analytics).

Separate from routers/linkedin.py (content generation / LinkedIn Writer).
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPAuthorizationCredentials
from loguru import logger
from pydantic import BaseModel

from middleware.auth_middleware import clerk_auth, get_current_user, security
from models.linkedin_social_models import (
    LinkedInAccountsListResponse,
    LinkedInAccountResponse,
    LinkedInAnalyticsResponse,
    LinkedInConnectionStatusResponse,
    LinkedInLandingAnalyticsResponse,
    LinkedInOrganizationResponse,
    LinkedInOrganizationsListResponse,
    LinkedInPersonalAnalyticsResponse,
    LinkedInProfileAcquireResponse,
    LinkedInProfileCompleteRequest,
    LinkedInProfileCompleteResponse,
    LinkedInProfileContextMetaResponse,
    LinkedInProfileMetaResponse,
    AIProfileIntelligenceResponse,
    CompletionQuestionResponse,
    ProfileCompletionResponse,
    ProfileIntelligenceMetaResponse,
    ProfileAnalysisErrorResponse,
    ProfileOptimizationBatchActionResponse,
    ProfileOptimizationCompleteRequest,
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
    ProfileOptimizationBatchNotReadyError,
    ProfileOptimizationError,
    ProfileOptimizationItemNotFoundError,
    ProfileOptimizationLLMError,
    ProfileOptimizationNotStoredError,
    advance_profile_optimization_batch,
    get_next_profile_optimization_batch,
    get_or_generate_profile_optimization,
)
from services.integrations.linkedin.profile_optimization_validator import (
    ProfileOptimizationValidationError,
)
from services.integrations.linkedin.topic_recommendation_llm import TopicRecommendationLLMError
from services.integrations.linkedin.topic_recommendation_service import (
    TopicRecommendationAcquireMeta,
    TopicRecommendationError,
    get_or_generate_topic_recommendations,
)
from services.integrations.linkedin.topic_recommendation_validator import (
    TopicRecommendationValidationError,
)
from services.integrations.linkedin.analytics_dates import (
    InvalidAnalyticsDateRange,
    parse_range_request,
)
from services.integrations.linkedin.factory import get_linkedin_provider
from services.integrations.linkedin.landing_analytics import build_landing_analytics_payload
from services.integrations.linkedin.personal_analytics import build_personal_analytics_payload
from services.integrations.linkedin.profile_context_service import get_or_build_profile_context
from services.integrations.linkedin.profile_context_types import ProfileContextBuildError
from services.integrations.linkedin.profile_completion_questions import build_completion_questions
from services.integrations.linkedin.profile_completion_service import (
    ProfileAlreadyCompleteError,
    ProfileCompletionError,
    ProfileCompletionResult,
    complete_profile,
)
from services.integrations.linkedin.profile_context_patcher import ProfileCompletionPatchError
from services.integrations.linkedin.profile_repository import ProfileRepository
from services.integrations.linkedin.profile_service import get_or_fetch_profile
from services.integrations.linkedin.profile_validation_service import get_or_validate_profile_context
from services.integrations.linkedin.profile_validation_types import ProfileValidationResult
from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.integrations.linkedin.unipile_client import UnipileAPIError
from services.integrations.linkedin.zernio_client import ZernioAPIError
from services.integrations.linkedin_oauth import LinkedInOAuthService
from services.integrations.oauth_callback_utils import (
    build_oauth_callback_html,
    sanitize_error,
)

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

_oauth_service = LinkedInOAuthService()


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


class LinkedInAuthCallbackRequest(BaseModel):
    code: Optional[str] = None
    state: Optional[str] = None


def _user_id(current_user: dict) -> str:
    uid = current_user.get("id") if current_user else None
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return str(uid)


async def _resolve_linkedin_callback_user(
    request: Request,
    alwrity_state: Optional[str] = None,
    state: Optional[str] = None,
    name: Optional[str] = None,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    """Resolve callback user from Clerk session, Unipile name, or validated OAuth state."""
    if credentials and credentials.credentials:
        user = await clerk_auth.verify_token(credentials.credentials)
        if user and user.get("id"):
            return str(user["id"])

    unipile_user_id = (name or request.query_params.get("name") or "").strip()
    if unipile_user_id:
        logger.info(
            f"[LinkedInConnect] Resolved callback user from Unipile name={unipile_user_id}"
        )
        return unipile_user_id

    oauth_state = alwrity_state or state or request.query_params.get("alwrity_state")
    if oauth_state:
        if ":" in oauth_state:
            user_id = _oauth_service.peek_oauth_state_user(oauth_state)
            if user_id:
                return user_id
        if oauth_state.startswith("user_"):
            return oauth_state

    raise HTTPException(status_code=401, detail="Authentication required for LinkedIn callback")


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
    return ProfileValidationResponse(
        is_profile_complete=bool(validation.get("is_profile_complete")),
        completeness_score=int(validation.get("completeness_score") or 0),
        missing_fields=list(validation.get("missing_fields") or []),
        optional_missing_fields=list(validation.get("optional_missing_fields") or []),
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
) -> ProfileOptimizationBatchActionResponse:
    """Build batch action API response from service-layer items and meta."""
    meta_response = _profile_optimization_meta_to_response(meta)
    if meta_response is None:
        raise ValueError("Invalid profile optimization meta from service")
    response_items = [_optimization_dict_to_response(item) for item in items]
    remaining = meta_response.remaining_in_backlog
    show_next_batch_cta = len(response_items) == 0 and remaining > 0
    return ProfileOptimizationBatchActionResponse(
        profile_optimization=response_items,
        profile_optimization_meta=meta_response,
        show_next_batch_cta=show_next_batch_cta,
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


@router.post("/profile/complete", response_model=LinkedInProfileCompleteResponse)
async def complete_linkedin_profile(
    body: LinkedInProfileCompleteRequest,
    current_user: dict = Depends(get_current_user),
) -> LinkedInProfileCompleteResponse:
    """
    Apply user completion answers, patch profile context, and re-validate.

    Returns updated context, validation, and any remaining completion questions.
    """
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
    """
    Mark an active profile optimization recommendation done or skipped.

    Removes the item from the active batch and persists progress without calling the LLM.
    """
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
        response = _batch_action_response_from_items(items, meta)
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
        "active_count={} remaining_in_backlog={} show_next_batch_cta={}",
        recommendation_id,
        user_id,
        len(response.profile_optimization),
        response.profile_optimization_meta.remaining_in_backlog,
        response.show_next_batch_cta,
    )
    return response


@router.post(
    "/profile/optimization/next-batch",
    response_model=ProfileOptimizationBatchActionResponse,
)
async def load_next_profile_optimization_batch(
    current_user: dict = Depends(get_current_user),
) -> ProfileOptimizationBatchActionResponse:
    """
    Promote the next five recommendations from backlog after the active batch is cleared.

    Does not call the LLM when backlog items remain.
    """
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


@router.get("/connection/status", response_model=LinkedInConnectionStatusResponse)
async def get_connection_status(
    current_user: dict = Depends(get_current_user),
) -> LinkedInConnectionStatusResponse:
    """Return LinkedIn connection state for the authenticated user."""
    user_id = _user_id(current_user)
    status = _oauth_service.get_connection_status(user_id)
    if status.get("connected"):
        if status.get("provider") == "zernio":
            _oauth_service.try_sync_zernio_accounts(user_id)
            status = _oauth_service.get_connection_status(user_id)
    elif status.get("provider") == "unipile":
        if await _oauth_service.try_sync_unipile_accounts(user_id):
            status = _oauth_service.get_connection_status(user_id)

    organizations: List[Dict[str, Any]] = []
    if status.get("connected") and status.get("accounts"):
        primary_account = status["accounts"][0].get("account_id")
        if primary_account:
            try:
                provider = get_linkedin_provider()
                orgs = await provider.list_organizations(user_id, primary_account)
                organizations = [
                    {
                        "organization_id": o.organization_id,
                        "name": o.name,
                        "urn": o.urn,
                    }
                    for o in orgs
                ]
            except Exception as e:
                logger.warning(f"Could not load organizations for status: {e}")

    status["organizations"] = organizations
    return LinkedInConnectionStatusResponse(**status)


@router.get("/auth/url")
async def get_authorization_url(
    state: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, str]:
    """Return OAuth authorization URL for Zernio, Unipile, or native LinkedIn connect."""
    user_id = _user_id(current_user)
    logger.info(f"[LinkedInConnect] auth URL requested user_id={user_id}")
    try:
        oauth_state = state or str(uuid.uuid4())
        payload = await _oauth_service.generate_authorization_url(user_id, oauth_state)
        logger.info(
            f"[LinkedInConnect] auth URL generated user_id={user_id} provider={payload.get('provider')}"
        )
        return {
            "authorization_url": payload["auth_url"],
            "state": payload["state"],
            "provider": payload["provider"],
        }
    except ValueError as e:
        error_str = str(e).lower()
        if "zernio_api_key is not configured" in error_str:
            logger.error(f"[LinkedInConnect] missing ZERNIO_API_KEY user_id={user_id}")
        elif "unipile_api_key is not configured" in error_str:
            logger.error(f"[LinkedInConnect] missing UNIPILE_API_KEY user_id={user_id}")
        else:
            logger.warning(f"[LinkedInConnect] configuration error user_id={user_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e)) from e
    except ZernioAPIError as e:
        status = e.status_code or 502
        logger.warning(f"[LinkedInConnect] auth URL Zernio error user_id={user_id}: {e}")
        raise HTTPException(status_code=status, detail=str(e)) from e
    except UnipileAPIError as e:
        status = e.status_code or 502
        logger.warning(f"[LinkedInConnect] auth URL Unipile error user_id={user_id}: {e}")
        raise HTTPException(status_code=status, detail=str(e)) from e
    except Exception as e:
        logger.exception(f"[LinkedInConnect] auth URL failed user_id={user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/sync")
async def sync_linkedin_accounts(
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Refresh personal + organization account IDs from Zernio (no new OAuth)."""
    user_id = _user_id(current_user)
    try:
        accounts = _oauth_service.sync_zernio_accounts(user_id)
        return {"success": True, "accounts": accounts}
    except LinkedInNotConnectedError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception(f"[LinkedInConnect] manual sync failed user_id={user_id}: {e}")
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/callback")
async def handle_oauth_callback_get(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    connected: Optional[str] = None,
    accountId: Optional[str] = None,
    account_id: Optional[str] = None,
    username: Optional[str] = None,
    alwrity_state: Optional[str] = None,
    provider: Optional[str] = Query(None, description="OAuth provider (unipile, zernio, native)"),
    status: Optional[str] = Query(None, description="Connection status (success, error)"),
    message: Optional[str] = Query(None, description="Error message if status is error"),
    name: Optional[str] = Query(None, description="User ID passed to Unipile as 'name' param"),
    user_id: str = Depends(_resolve_linkedin_callback_user),
) -> HTMLResponse:
    """HTML OAuth callback that stores credentials and notifies opener via postMessage.

    Handles callbacks from:
    - Zernio (legacy): connected, accountId, tempToken params
    - Unipile (Phase 2): provider=unipile, status=success|error, account_id, name
    - Native LinkedIn: code, state params
    """
    try:
        resolved_account_id = accountId or account_id
        temp_token = request.query_params.get("tempToken") or request.query_params.get(
            "temp_token"
        )

        # Detect Unipile callback (Phase 2)
        is_unipile_redirect = provider == "unipile"
        if is_unipile_redirect:
            logger.info(
                f"[LinkedInConnect] Unipile callback user_id={user_id} "
                f"status={status} account_id_present={bool(resolved_account_id)}"
            )

            if status == "error":
                error_msg = message or "Unipile authentication failed"
                logger.error(f"[LinkedInConnect] Unipile callback error user_id={user_id}: {error_msg}")
                html = build_oauth_callback_html(
                    payload={
                        "type": "LINKEDIN_OAUTH_ERROR",
                        "success": False,
                        "provider": "unipile",
                        "error": error_msg,
                    },
                    title="LinkedIn Connection Failed",
                    heading="Connection Failed",
                    message=f"LinkedIn connection failed: {error_msg}. You can close this window and try again.",
                )
                return HTMLResponse(content=html)

            # Success case - store credentials (account_id may arrive via notify_url only)
            if resolved_account_id:
                ok = await _oauth_service.handle_unipile_callback(
                    user_id=user_id,
                    account_id=resolved_account_id,
                    status="success",
                )
                if not ok:
                    raise HTTPException(
                        status_code=400, detail="Failed to store Unipile credentials"
                    )
            else:
                logger.warning(
                    f"[LinkedInConnect] Unipile callback missing account_id user_id={user_id}; "
                    "attempting account sync (notify_url may have already stored credentials)"
                )
                await _oauth_service.try_sync_unipile_accounts(user_id)

            status_after = _oauth_service.get_connection_status(user_id)
            if not status_after.get("connected"):
                logger.warning(
                    f"[LinkedInConnect] Unipile browser callback complete but not connected yet "
                    f"user_id={user_id}; client will poll status or wait for webhook"
                )

            logger.info(f"[LinkedInConnect] Unipile callback succeeded user_id={user_id}")
            payload = {
                "type": "LINKEDIN_OAUTH_SUCCESS",
                "success": True,
                "provider": "unipile",
            }
            html = build_oauth_callback_html(
                payload=payload,
                title="LinkedIn Connected",
                heading="Connection Successful",
                message="Your LinkedIn account was connected via Unipile. You can close this window.",
            )
            return HTMLResponse(
                content=html,
                headers={
                    "Cross-Origin-Opener-Policy": "unsafe-none",
                    "Cross-Origin-Embedder-Policy": "unsafe-none",
                },
            )

        # Detect Zernio callback (legacy)
        is_zernio_redirect = (
            connected == "linkedin"
            or bool(resolved_account_id and not provider)
            or bool(temp_token)
        )

        if is_zernio_redirect:
            logger.info(
                f"[LinkedInConnect] Zernio callback user_id={user_id} "
                f"account_id_present={bool(resolved_account_id)} "
                f"headless={bool(temp_token)}"
            )
            query_params = dict(request.query_params)
            ok = _oauth_service.handle_zernio_connect_callback(user_id, query_params)
            if not ok:
                raise HTTPException(status_code=400, detail="Zernio connect callback failed")
            logger.info(f"[LinkedInConnect] Zernio callback succeeded user_id={user_id}")
            payload = {
                "type": "LINKEDIN_OAUTH_SUCCESS",
                "success": True,
                "provider": "zernio",
            }
            html = build_oauth_callback_html(
                payload=payload,
                title="LinkedIn Connected",
                heading="Connection Successful",
                message="Your LinkedIn account was connected. You can close this window.",
            )
            return HTMLResponse(
                content=html,
                headers={
                    "Cross-Origin-Opener-Policy": "unsafe-none",
                    "Cross-Origin-Embedder-Policy": "unsafe-none",
                },
            )

        # Native LinkedIn OAuth
        if not code or not state:
            raise HTTPException(status_code=400, detail="Missing OAuth code or state")

        token_result = _oauth_service.handle_native_oauth_callback(user_id, code, state)
        if not token_result:
            raise HTTPException(status_code=400, detail="LinkedIn OAuth token exchange failed")

        payload = {
            "type": "LINKEDIN_OAUTH_SUCCESS",
            "success": True,
            "provider": "native",
        }
        html = build_oauth_callback_html(
            payload=payload,
            title="LinkedIn Connected",
            heading="Connection Successful",
            message="Your LinkedIn account was connected. You can close this window.",
        )
        return HTMLResponse(
            content=html,
            headers={
                "Cross-Origin-Opener-Policy": "unsafe-none",
                "Cross-Origin-Embedder-Policy": "unsafe-none",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[LinkedInConnect] OAuth GET callback failed user_id={user_id}: {e}")
        html = build_oauth_callback_html(
            payload={
                "type": "LINKEDIN_OAUTH_ERROR",
                "success": False,
                "error": sanitize_error(e),
            },
            title="LinkedIn Connection Failed",
            heading="Connection Failed",
            message="LinkedIn connection failed. You can close this window and try again.",
        )
        return HTMLResponse(content=html)


@router.post("/auth/callback")
async def handle_oauth_callback_post(
    body: LinkedInAuthCallbackRequest,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """SPA fallback for native LinkedIn OAuth code exchange."""
    user_id = _user_id(current_user)
    if not body.code or not body.state:
        raise HTTPException(status_code=400, detail="Missing OAuth code or state")
    token_result = _oauth_service.handle_native_oauth_callback(
        user_id, body.code, body.state
    )
    if not token_result:
        raise HTTPException(status_code=400, detail="LinkedIn OAuth token exchange failed")
    status = _oauth_service.get_connection_status(user_id)
    return {"success": True, "connected": status.get("connected", False)}


@router.post("/disconnect")
async def disconnect_linkedin(
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Disconnect per-user LinkedIn credentials (soft-delete tokens)."""
    user_id = _user_id(current_user)
    logger.info(f"[LinkedInConnect] disconnect requested user_id={user_id}")
    try:
        result = await _oauth_service.disconnect_user(user_id)
        logger.info(
            f"[LinkedInConnect] disconnect completed user_id={user_id} "
            f"revoked={result.get('revoked')} zernio_account_deleted={result.get('zernio_account_deleted')}"
        )
        return {
            "success": result.get("success", False),
            "connected": result.get("connected", False),
            "has_env_fallback": False,
            "message": "LinkedIn account disconnected successfully",
        }
    except Exception as e:
        logger.exception(f"[LinkedInConnect] disconnect failed user_id={user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/accounts", response_model=LinkedInAccountsListResponse)
async def list_accounts(
    current_user: dict = Depends(get_current_user),
) -> LinkedInAccountsListResponse:
    """List LinkedIn accounts available to the user via the configured provider."""
    user_id = _user_id(current_user)
    provider = get_linkedin_provider()
    try:
        accounts = await provider.list_accounts(user_id)
    except LinkedInNotConnectedError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    except Exception as e:
        logger.error(f"list_accounts failed for user {user_id}: {e}")
        raise HTTPException(status_code=502, detail=str(e)) from e

    return LinkedInAccountsListResponse(
        accounts=[
            LinkedInAccountResponse(
                account_id=a.account_id,
                account_type=a.account_type,
                username=a.username,
                avatar_url=a.avatar_url,
                platform=a.platform,
            )
            for a in accounts
        ],
        provider=provider.provider_name,
    )


@router.get("/organizations", response_model=LinkedInOrganizationsListResponse)
async def list_organizations(
    account_id: str = Query(..., description="Zernio LinkedIn account id"),
    current_user: dict = Depends(get_current_user),
) -> LinkedInOrganizationsListResponse:
    """List LinkedIn company pages for an account."""
    user_id = _user_id(current_user)
    provider = get_linkedin_provider()
    try:
        orgs = await provider.list_organizations(user_id, account_id)
    except LinkedInNotConnectedError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    except Exception as e:
        logger.error(f"list_organizations failed for user {user_id}: {e}")
        raise HTTPException(status_code=502, detail=str(e)) from e

    return LinkedInOrganizationsListResponse(
        account_id=account_id,
        organizations=[
            LinkedInOrganizationResponse(
                organization_id=o.organization_id,
                name=o.name,
                urn=o.urn,
            )
            for o in orgs
        ],
    )


@router.get("/analytics/landing", response_model=LinkedInLandingAnalyticsResponse)
async def get_landing_analytics(
    current_user: dict = Depends(get_current_user),
) -> LinkedInLandingAnalyticsResponse:
    """Rolling last-7-day personal + org analytics for the LinkedIn Writer landing page."""
    user_id = _user_id(current_user)
    provider = get_linkedin_provider()
    try:
        payload = await build_landing_analytics_payload(
            user_id, provider, _oauth_service
        )
        return LinkedInLandingAnalyticsResponse(**payload)
    except LinkedInNotConnectedError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    except ZernioAPIError as e:
        status = e.status_code or 502
        if status in (402, 403, 412):
            raise HTTPException(status_code=status, detail=str(e)) from e
        logger.warning(f"[LinkedInAnalytics] landing Zernio error user_id={user_id}: {e}")
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:
        logger.exception(f"[LinkedInAnalytics] landing failed user_id={user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to load LinkedIn analytics") from e


@router.get("/analytics/personal", response_model=LinkedInPersonalAnalyticsResponse)
async def get_personal_analytics(
    preset_days: Optional[int] = Query(
        None,
        alias="presetDays",
        description="Preset window: 7, 14, 28, 90, or 365 days",
    ),
    start_date: Optional[str] = Query(
        None,
        alias="startDate",
        description="Custom range start (YYYY-MM-DD, inclusive)",
    ),
    end_date: Optional[str] = Query(
        None,
        alias="endDate",
        description="Custom range end (YYYY-MM-DD, inclusive in UI)",
    ),
    current_user: dict = Depends(get_current_user),
) -> LinkedInPersonalAnalyticsResponse:
    """Normalized personal profile aggregate analytics for a date range."""
    user_id = _user_id(current_user)
    provider = get_linkedin_provider()
    try:
        if preset_days is not None and preset_days not in (7, 14, 28, 90, 365):
            raise InvalidAnalyticsDateRange(
                "presetDays must be one of 7, 14, 28, 90, or 365."
            )
        date_range = parse_range_request(
            today=date.today(),
            preset_days=preset_days,
            start_date=start_date,
            end_date=end_date,
        )
        if preset_days is not None:
            logger.warning(
                f"[LinkedInAnalytics] personal range user_id={user_id} preset={preset_days}"
            )
        elif start_date and end_date:
            logger.warning(
                f"[LinkedInAnalytics] personal range user_id={user_id} "
                f"custom start={start_date} end={end_date}"
            )
        payload = await build_personal_analytics_payload(
            user_id, provider, _oauth_service, date_range
        )
        return LinkedInPersonalAnalyticsResponse(**payload)
    except InvalidAnalyticsDateRange as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except LinkedInNotConnectedError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    except ZernioAPIError as e:
        status = e.status_code or 502
        if status in (402, 403, 412):
            raise HTTPException(status_code=status, detail=str(e)) from e
        logger.warning(
            f"[LinkedInAnalytics] personal Zernio error user_id={user_id}: {e}"
        )
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:
        logger.exception(
            f"[LinkedInAnalytics] personal failed user_id={user_id}: {e}"
        )
        raise HTTPException(
            status_code=500, detail="Failed to load personal LinkedIn analytics"
        ) from e


@router.get("/analytics/profile", response_model=LinkedInAnalyticsResponse)
async def get_profile_analytics(
    account_id: Optional[str] = Query(None, description="Defaults to connected personal account"),
    aggregation: str = Query("TOTAL", pattern="^(TOTAL|DAILY)$"),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD (exclusive)"),
    metrics: Optional[str] = Query(None, description="Comma-separated metrics"),
    current_user: dict = Depends(get_current_user),
) -> LinkedInAnalyticsResponse:
    """Fetch LinkedIn personal profile aggregate analytics."""
    user_id = _user_id(current_user)
    provider = get_linkedin_provider()
    metric_list = [m.strip().upper() for m in metrics.split(",")] if metrics else None
    try:
        resolved_account = _resolve_user_account_id(user_id, account_id)
    except LinkedInNotConnectedError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    try:
        data = await provider.get_profile_aggregate_analytics(
            user_id,
            resolved_account,
            aggregation=aggregation,  # type: ignore[arg-type]
            start_date=start_date,
            end_date=end_date,
            metrics=metric_list,
        )
    except LinkedInNotConnectedError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    except Exception as e:
        logger.error(f"profile analytics failed for user {user_id}: {e}")
        raise HTTPException(status_code=502, detail=str(e)) from e

    return LinkedInAnalyticsResponse(data=data, provider=provider.provider_name)


@router.get("/analytics/org", response_model=LinkedInAnalyticsResponse)
async def get_org_analytics(
    account_id: Optional[str] = Query(None, description="Defaults to connected org account"),
    since: Optional[str] = Query(None, description="YYYY-MM-DD"),
    until: Optional[str] = Query(None, description="YYYY-MM-DD"),
    metric_type: str = Query("total_value", pattern="^(total_value|time_series)$"),
    metrics: Optional[str] = Query(None, description="Comma-separated org metrics"),
    current_user: dict = Depends(get_current_user),
) -> LinkedInAnalyticsResponse:
    """Fetch LinkedIn organization page aggregate analytics."""
    user_id = _user_id(current_user)
    provider = get_linkedin_provider()
    metric_list = [m.strip().lower() for m in metrics.split(",")] if metrics else None
    try:
        creds = _oauth_service.resolve_credentials(user_id)
        resolved_account = account_id or creds.zernio_org_account_id
        if not resolved_account:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No LinkedIn organization account is connected. "
                    "Connect a company page before requesting org analytics."
                ),
            )
    except LinkedInNotConnectedError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    try:
        data = await provider.get_org_aggregate_analytics(
            user_id,
            resolved_account,
            since=since,
            until=until,
            metric_type=metric_type,  # type: ignore[arg-type]
            metrics=metric_list,
        )
    except LinkedInNotConnectedError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    except Exception as e:
        logger.error(f"org analytics failed for user {user_id}: {e}")
        raise HTTPException(status_code=502, detail=str(e)) from e

    return LinkedInAnalyticsResponse(data=data, provider=provider.provider_name)


@router.get("/analytics/post", response_model=LinkedInAnalyticsResponse)
async def get_post_analytics(
    urn: str = Query(..., description="LinkedIn post URN"),
    account_id: Optional[str] = Query(None, description="Defaults to connected personal account"),
    current_user: dict = Depends(get_current_user),
) -> LinkedInAnalyticsResponse:
    """Fetch analytics for a single LinkedIn post by URN."""
    user_id = _user_id(current_user)
    provider = get_linkedin_provider()
    try:
        resolved_account = _resolve_user_account_id(user_id, account_id)
    except LinkedInNotConnectedError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    try:
        data = await provider.get_post_analytics(user_id, resolved_account, urn)
    except LinkedInNotConnectedError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    except Exception as e:
        logger.error(f"post analytics failed for user {user_id}: {e}")
        raise HTTPException(status_code=502, detail=str(e)) from e

    return LinkedInAnalyticsResponse(data=data, provider=provider.provider_name)
