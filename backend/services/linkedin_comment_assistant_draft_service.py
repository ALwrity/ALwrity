"""Comment Assistant Draft with ALwrity — business logic (Issue #188)."""

from __future__ import annotations

import json
import time
from typing import Any, Callable, Optional

from loguru import logger

from models.linkedin_comment_assistant_draft_models import (
    CommentAssistantDraftReplyRequest,
    CommentAssistantDraftReplyResponse,
)
from prompts.linkedin.comment_assistant_draft_prompt import (
    COMMENT_DRAFT_SYSTEM_PROMPT,
    build_comment_assistant_draft_prompt,
)
from services.llm_providers.main_text_generation import llm_text_gen
from services.persona_analysis_service import PersonaAnalysisService

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
    """Load the user's LinkedIn persona from the shared persona service."""
    try:
        uid_int = int(user_id)
    except (ValueError, TypeError):
        logger.warning(
            "{} Cannot parse user_id as int for persona lookup user_id={}",
            _LOG_PREFIX,
            user_id[:8] if user_id else "(none)",
        )
        return None

    try:
        persona_service = PersonaAnalysisService()
        return persona_service.get_persona_for_platform(uid_int, "linkedin")
    except Exception as exc:
        logger.warning(
            "{} Persona load failed user_id={}: {}",
            _LOG_PREFIX,
            user_id[:8] if user_id else "(none)",
            exc,
        )
        return None


def _resolve_industry(persona_data: Optional[dict[str, Any]]) -> str:
    """Resolve industry from persona or default to General."""
    if not persona_data:
        return "General"
    core = persona_data.get("core_persona") or {}
    industry = core.get("industry") or core.get("sector") or ""
    if isinstance(industry, str) and industry.strip():
        return industry.strip()
    return "General"


_DraftLLMFn = Callable[..., Any]


def _call_llm(
    prompt: str,
    user_id: str,
    generate_fn: Optional[_DraftLLMFn] = None,
) -> dict[str, Any]:
    """Call the LLM gateway and parse the structured JSON response."""
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
    except Exception as exc:
        error_code = _classify_llm_error(exc)
        logger.error(
            "{} LLM failure user_id={} kind={} type={} message={}",
            _LOG_PREFIX,
            user_id[:8] if user_id else "(none)",
            error_code,
            type(exc).__name__,
            str(exc)[:500],
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
                user_id[:8] if user_id else "(none)",
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


def _validate_request(request: CommentAssistantDraftReplyRequest) -> None:
    """Validate request fields before calling the LLM."""
    if not request.post_text or len(request.post_text.strip()) < 10:
        raise CommentAssistantDraftError(
            "Post text is too short to draft a reply.",
            error_code="validation_error",
        )
    if not request.comment_text or len(request.comment_text.strip()) < 3:
        raise CommentAssistantDraftError(
            "Comment text is too short to draft a reply.",
            error_code="validation_error",
        )


def _mask_user_id(user_id: str) -> str:
    """Short masked id for logs (no full tenant identifier)."""
    if not user_id:
        return "(none)"
    return f"{user_id[:8]}…" if len(user_id) > 8 else user_id


async def draft_comment_reply(
    request: CommentAssistantDraftReplyRequest,
    user_id: str,
    *,
    generate_fn: Optional[_DraftLLMFn] = None,
) -> CommentAssistantDraftReplyResponse:
    """Draft a LinkedIn comment reply using the user's persona and ALwrity LLM stack.

    Args:
        request: Draft inputs (post text, comment text, tone, etc.).
        user_id: Authenticated Clerk user id.
        generate_fn: Optional injectable LLM function for tests.

    Returns:
        CommentAssistantDraftReplyResponse with the drafted reply or a clear error.
    """
    start_time = time.time()
    logger.info(
        "{} start user={} social_id_suffix={} comment_id_suffix={}",
        _LOG_PREFIX,
        _mask_user_id(user_id),
        request.social_id[-20:] if request.social_id else "(none)",
        request.comment_id[-20:] if request.comment_id else "(none)",
    )

    try:
        _validate_request(request)
    except CommentAssistantDraftError as exc:
        logger.warning(
            "{} validation failed user={}: {}",
            _LOG_PREFIX,
            _mask_user_id(user_id),
            exc.error_code,
        )
        return CommentAssistantDraftReplyResponse(
            success=False,
            error=str(exc),
            generation_metadata={"error_code": exc.error_code},
        )

    persona_data = _load_persona(user_id)
    industry = _resolve_industry(persona_data)
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
    except CommentAssistantDraftError as exc:
        logger.warning(
            "{} generation failed user={} code={}: {}",
            _LOG_PREFIX,
            _mask_user_id(user_id),
            exc.error_code,
            str(exc)[:200],
        )
        return CommentAssistantDraftReplyResponse(
            success=False,
            error=str(exc),
            generation_metadata={"error_code": exc.error_code},
        )

    duration = round(time.time() - start_time, 3)
    logger.info(
        "{} success user={} reply_len={} alternatives={} duration_ms={}",
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
        generation_metadata={
            "model_used": "llm_text_gen",
            "flow_type": "linkedin_comment_assistant_draft",
            "generation_time": duration,
            "industry": industry,
            "has_persona": bool(persona_data),
        },
    )
