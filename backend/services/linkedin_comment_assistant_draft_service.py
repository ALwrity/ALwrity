"""Comment Assistant Draft with ALwrity — business logic (Issue #188)."""

from __future__ import annotations

import json
import time
from typing import Any, Callable, Optional

from fastapi import HTTPException
from loguru import logger
from sqlalchemy.orm import Session

from models.linkedin_comment_assistant_draft_models import (
    CommentAssistantDraftReplyRequest,
    CommentAssistantDraftReplyResponse,
    CommentAssistantManualDraftReplyRequest,
)
from prompts.linkedin.comment_assistant_draft_prompt import (
    COMMENT_DRAFT_SYSTEM_PROMPT,
    build_comment_assistant_draft_prompt,
)
from services.linkedin_comment_assistant_draft_cache_service import (
    LinkedInCommentAssistantDraftCacheService,
)
from services.llm_providers.main_text_generation import llm_text_gen
from services.persona_data_service import PersonaDataService

_LOG_PREFIX = "[CommentAssistantDraft]"

_DRAFT_RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "reply": {"type": "string"},
        "alternative_replies": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": ["reply"],
}


class CommentAssistantDraftError(Exception):
    """Expected failure during draft generation."""

    def __init__(self, message: str, *, error_code: str) -> None:
        super().__init__(message)
        self.error_code = error_code


class CommentAssistantDraftLLMError(CommentAssistantDraftError):
    """LLM-provider failure during draft generation."""

    def __init__(self, message: str, *, error_code: str = "llm_error") -> None:
        super().__init__(message, error_code=error_code)


def _classify_llm_error(exc: Exception) -> str:
    """Return a safe error category for LLM/provider failures."""
    msg = str(exc).lower()
    if "resource_exhausted" in msg or "quota" in msg or "rate limit" in msg:
        return "subscription_limit"
    if "401" in msg or "403" in msg or "api key" in msg or "authentication" in msg:
        return "auth_error"
    if "timeout" in msg or "timed out" in msg or "deadline" in msg:
        return "timeout"
    if "invalid json" in msg or "json" in msg:
        return "invalid_json"
    if "subscription" in msg or "429" in msg:
        return "subscription_limit"
    return "llm_error"


def _load_persona(user_id: str) -> Optional[dict[str, Any]]:
    """Load the user's LinkedIn persona from the shared persona service.

    `user_id` is a string Clerk ID (OnboardingSession.user_id is a String column),
    so it must be passed to PersonaDataService verbatim — never coerced to int.
    """
    try:
        persona_service = PersonaDataService()
        return persona_service.get_platform_persona(user_id, "linkedin")
    except Exception as exc:
        logger.warning(
            "{} Persona load failed user_id={}: {}",
            _LOG_PREFIX,
            _mask_user_id(user_id),
            exc,
        )
        return None


def _resolve_industry(user_id: str) -> str:
    """Resolve industry from the Brand Brain (canonical_profile.industry).

    The persona (PersonaData) does NOT carry industry — it lives in
    website_analysis/canonical_profile. Defaults to "General" when unavailable.
    """
    try:
        from services.database import get_session_for_user
        from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService

        db = get_session_for_user(user_id)
        if not db:
            return "General"
        try:
            integrated = OnboardingDataIntegrationService().get_integrated_data_sync(user_id, db)
            canonical = integrated.get("canonical_profile") or {}
            industry = canonical.get("industry") or ""
            if isinstance(industry, str) and industry.strip():
                return industry.strip()
        finally:
            db.close()
    except Exception as exc:
        logger.warning(f"{_LOG_PREFIX} industry resolve failed user={_mask_user_id(user_id)}: {exc}")
    return "General"


_DraftLLMFn = Callable[..., Any]


def _call_llm(
    prompt: str,
    user_id: str,
    generate_fn: Optional[_DraftLLMFn] = None,
) -> dict[str, Any]:
    """Call the LLM gateway and parse the structured JSON response."""
    llm_start = time.time()
    try:
        if generate_fn is not None:
            raw = generate_fn(
                prompt=prompt,
                system_prompt=COMMENT_DRAFT_SYSTEM_PROMPT,
                json_struct=_DRAFT_RESPONSE_SCHEMA,
                user_id=user_id,
                flow_type="linkedin_comment_assistant_draft",
            )
        else:
            raw = llm_text_gen(
                prompt=prompt,
                system_prompt=COMMENT_DRAFT_SYSTEM_PROMPT,
                json_struct=_DRAFT_RESPONSE_SCHEMA,
                user_id=user_id,
                flow_type="linkedin_comment_assistant_draft",
                max_tokens=500,
                temperature=0.7,
            )
        logger.info(
            "{} LLM call ok user={} flow_type=linkedin_comment_assistant_draft "
            "duration_ms={}",
            _LOG_PREFIX,
            _mask_user_id(user_id),
            int((time.time() - llm_start) * 1000),
        )
    except HTTPException:
        # Preserve subscription 429 detail (billing message) for the route layer.
        logger.warning(
            "{} LLM HTTPException user={} duration_ms={}",
            _LOG_PREFIX,
            _mask_user_id(user_id),
            int((time.time() - llm_start) * 1000),
        )
        raise
    except Exception as exc:
        error_code = _classify_llm_error(exc)
        logger.error(
            "{} LLM failure user={} error_code={} type={} duration_ms={}",
            _LOG_PREFIX,
            _mask_user_id(user_id),
            error_code,
            type(exc).__name__,
            int((time.time() - llm_start) * 1000),
        )
        raise CommentAssistantDraftLLMError(
            "ALwrity couldn't draft a reply right now. Please try again.",
            error_code=error_code,
        ) from exc

    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            if not isinstance(parsed, dict):
                raise CommentAssistantDraftLLMError(
                    "LLM response was not a JSON object",
                    error_code="invalid_json",
                )
            return parsed
        except json.JSONDecodeError as exc:
            logger.error(
                "{} LLM returned invalid JSON user_id={} raw_len={}",
                _LOG_PREFIX,
                _mask_user_id(user_id),
                len(raw),
            )
            raise CommentAssistantDraftLLMError(
                "ALwrity returned an unreadable response. Please try again.",
                error_code="invalid_json",
            ) from exc

    raise CommentAssistantDraftLLMError(
        f"Unexpected LLM response type: {type(raw).__name__}",
        error_code="invalid_response",
    )


def _parse_draft_result(raw: dict[str, Any]) -> dict[str, Any]:
    """Extract reply and alternatives from the LLM response."""
    reply = raw.get("reply")
    if not isinstance(reply, str) or not reply.strip():
        raise CommentAssistantDraftLLMError(
            "ALwrity did not produce a reply",
            error_code="empty_response",
        )
    alternatives = raw.get("alternative_replies") or []
    if not isinstance(alternatives, list):
        alternatives = []
    cleaned_alternatives = [
        str(a).strip() for a in alternatives if isinstance(a, str) and str(a).strip()
    ]
    return {
        "reply": reply.strip(),
        "alternative_replies": cleaned_alternatives[:2],
    }


def _validate_inputs(
    post_text: Optional[str],
    comment_text: str,
    *,
    require_post: bool = True,
) -> None:
    """Validate inputs before calling the LLM."""
    if require_post and (not post_text or len(post_text.strip()) < 10):
        raise CommentAssistantDraftError(
            "Post text is too short to draft a reply.",
            error_code="validation_error",
        )
    if not comment_text or len(comment_text.strip()) < 3:
        raise CommentAssistantDraftError(
            "Comment text is too short to draft a reply.",
            error_code="validation_error",
        )


def _mask_user_id(user_id: str) -> str:
    """Short masked id for logs (no full tenant identifier)."""
    if not user_id:
        return "(none)"
    return f"{user_id[:8]}…" if len(user_id) > 8 else user_id


def _failure_response(exc: CommentAssistantDraftError) -> CommentAssistantDraftReplyResponse:
    """Build a failed draft response with a stable error_code for the route layer."""
    return CommentAssistantDraftReplyResponse(
        success=False,
        error=str(exc),
        generation_metadata={"error_code": exc.error_code},
    )


async def _draft_reply_core(
    request: CommentAssistantDraftReplyRequest | CommentAssistantManualDraftReplyRequest,
    user_id: str,
    *,
    log_context: dict[str, Any],
    generate_fn: Optional[_DraftLLMFn] = None,
    require_post: bool = True,
    db: Optional[Session] = None,
    comment_id: Optional[str] = None,
    refresh: bool = False,
) -> CommentAssistantDraftReplyResponse:
    """Shared core for inbox and manual draft generation."""
    start_time = time.time()
    logger.info(
        "{} start user={} refresh={} {}",
        _LOG_PREFIX,
        _mask_user_id(user_id),
        refresh,
        " ".join(f"{k}={v}" for k, v in log_context.items()),
    )

    try:
        _validate_inputs(
            request.post_text,
            request.comment_text,
            require_post=require_post,
        )
    except CommentAssistantDraftError as exc:
        logger.warning(
            "{} validation failed user={} error_code={}",
            _LOG_PREFIX,
            _mask_user_id(user_id),
            exc.error_code,
        )
        return _failure_response(exc)

    cache: Optional[LinkedInCommentAssistantDraftCacheService] = None
    if db is not None and comment_id:
        cache = LinkedInCommentAssistantDraftCacheService(db)
        if not refresh:
            cached = cache.get_draft_fresh(user_id, comment_id)
            if cached:
                reply = str(cached.get("reply") or "").strip()
                alternatives = cached.get("alternative_replies") or []
                if not isinstance(alternatives, list):
                    alternatives = []
                meta = cached.get("generation_metadata") or {}
                if not isinstance(meta, dict):
                    meta = {}
                duration = round(time.time() - start_time, 3)
                logger.info(
                    "{} success user={} reply_length={} from_cache=true duration_ms={}",
                    _LOG_PREFIX,
                    _mask_user_id(user_id),
                    len(reply),
                    int(duration * 1000),
                )
                return CommentAssistantDraftReplyResponse(
                    success=True,
                    reply=reply,
                    alternative_replies=[
                        str(a).strip()
                        for a in alternatives
                        if isinstance(a, str) and str(a).strip()
                    ][:2],
                    from_cache=True,
                    generation_metadata={
                        **meta,
                        "from_cache": True,
                        "generation_time": duration,
                    },
                )

    persona_data = _load_persona(user_id)
    industry = _resolve_industry(user_id)
    logger.info(
        "{} persona loaded user={} has_persona={} industry={}",
        _LOG_PREFIX,
        _mask_user_id(user_id),
        bool(persona_data),
        industry,
    )

    prompt = build_comment_assistant_draft_prompt(request, persona_data, industry)
    try:
        raw = _call_llm(prompt, user_id, generate_fn=generate_fn)
        result = _parse_draft_result(raw)
    except HTTPException:
        raise
    except CommentAssistantDraftError as exc:
        logger.warning(
            "{} failure user={} error_code={} type={}",
            _LOG_PREFIX,
            _mask_user_id(user_id),
            exc.error_code,
            type(exc).__name__,
        )
        return _failure_response(exc)

    duration = round(time.time() - start_time, 3)
    metadata = {
        "model_used": "llm_text_gen",
        "flow_type": "linkedin_comment_assistant_draft",
        "generation_time": duration,
        "industry": industry,
        "has_persona": bool(persona_data),
        "from_cache": False,
    }
    if cache is not None and comment_id:
        try:
            cache.store_draft(
                user_id,
                comment_id,
                reply=result["reply"],
                alternative_replies=result["alternative_replies"],
                generation_metadata=metadata,
            )
        except Exception as exc:
            logger.warning(
                "{} store failed user={} type={} — returning live draft",
                _LOG_PREFIX,
                _mask_user_id(user_id),
                type(exc).__name__,
            )

    logger.info(
        "{} success user={} reply_length={} from_cache=false alternatives={} "
        "duration_ms={}",
        _LOG_PREFIX,
        _mask_user_id(user_id),
        len(result["reply"]),
        len(result["alternative_replies"]),
        int(duration * 1000),
    )
    return CommentAssistantDraftReplyResponse(
        success=True,
        reply=result["reply"],
        alternative_replies=result["alternative_replies"],
        from_cache=False,
        generation_metadata=metadata,
    )


async def draft_comment_reply(
    request: CommentAssistantDraftReplyRequest,
    user_id: str,
    *,
    db: Optional[Session] = None,
    generate_fn: Optional[_DraftLLMFn] = None,
) -> CommentAssistantDraftReplyResponse:
    """Draft a LinkedIn comment reply for an inbox comment (post + comment ids known)."""
    return await _draft_reply_core(
        request,
        user_id,
        log_context={
            "social_id_suffix": request.social_id[-20:] if request.social_id else "(none)",
            "comment_id_suffix": request.comment_id[-20:] if request.comment_id else "(none)",
        },
        generate_fn=generate_fn,
        require_post=True,
        db=db,
        comment_id=request.comment_id,
        refresh=bool(request.refresh),
    )


async def draft_manual_comment_reply(
    request: CommentAssistantManualDraftReplyRequest,
    user_id: str,
    *,
    generate_fn: Optional[_DraftLLMFn] = None,
) -> CommentAssistantDraftReplyResponse:
    """Draft a LinkedIn comment reply from pasted text (Manual tab)."""
    return await _draft_reply_core(
        request,
        user_id,
        log_context={"source": "manual"},
        generate_fn=generate_fn,
        require_post=False,
    )
