"""Comment Assistant Draft with ALwrity route (Issue #188)."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from sqlalchemy.orm import Session

from middleware.auth_middleware import get_current_user
from models.linkedin_comment_assistant_draft_models import (
    CommentAssistantDraftReplyRequest,
    CommentAssistantDraftReplyResponse,
    CommentAssistantManualDraftReplyRequest,
)
from models.linkedin_posts_models import PostsErrorResponse
from services.database import get_db
from services.linkedin_comment_assistant_cache_service import mask_user_id
from services.linkedin_comment_assistant_draft_service import (
    CommentAssistantDraftError,
    draft_comment_reply,
    draft_manual_comment_reply,
)

router = APIRouter(prefix="/api/linkedin", tags=["LinkedIn Comment Assistant"])

_LOG_PREFIX = "[CommentAssistantDraft]"

_USER_MESSAGES = {
    "validation_error": "We need both your post and the comment to draft a reply.",
    "not_connected": "Connect LinkedIn to use Comment Assistant.",
    "llm_error": "ALwrity couldn't draft a reply right now. Please try again.",
    "unexpected_error": "An unexpected error occurred while drafting the reply.",
}


def _user_id(current_user: dict) -> str:
    uid = current_user.get("id") if current_user else None
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return str(uid)


def _status_for_error_code(error_code: str) -> int:
    mapping = {
        "validation_error": status.HTTP_422_UNPROCESSABLE_ENTITY,
        "not_connected": status.HTTP_403_FORBIDDEN,
        "subscription_limit": status.HTTP_429_TOO_MANY_REQUESTS,
        "llm_error": status.HTTP_502_BAD_GATEWAY,
        "timeout": status.HTTP_502_BAD_GATEWAY,
        "invalid_json": status.HTTP_502_BAD_GATEWAY,
        "invalid_response": status.HTTP_502_BAD_GATEWAY,
        "empty_response": status.HTTP_502_BAD_GATEWAY,
        "auth_error": status.HTTP_502_BAD_GATEWAY,
    }
    return mapping.get(error_code, status.HTTP_500_INTERNAL_SERVER_ERROR)


def _message_for_error_code(error_code: str, fallback: Optional[str] = None) -> str:
    if error_code == "subscription_limit" and fallback:
        return fallback
    if error_code in _USER_MESSAGES:
        return _USER_MESSAGES[error_code]
    if fallback:
        return fallback
    return _USER_MESSAGES["unexpected_error"]


def _raise_draft_http_error(
    *,
    error_code: str,
    message: Optional[str] = None,
) -> None:
    """Raise a structured HTTPException for draft failures."""
    code = (error_code or "unexpected_error").strip().lower()
    raise HTTPException(
        status_code=_status_for_error_code(code),
        detail={
            "error_code": code.upper(),
            "message": _message_for_error_code(code, message),
        },
    )


def _raise_if_draft_failed(result: CommentAssistantDraftReplyResponse) -> None:
    if result.success:
        return
    meta = result.generation_metadata or {}
    error_code = str(meta.get("error_code") or "unexpected_error")
    _raise_draft_http_error(error_code=error_code, message=result.error)


def _http_exception_detail_message(detail: Any) -> Optional[str]:
    if isinstance(detail, dict):
        msg = detail.get("message") or detail.get("error")
        return str(msg) if msg else None
    if isinstance(detail, str) and detail.strip():
        return detail.strip()
    return None


@router.post(
    "/comment-assistant/draft-reply",
    response_model=CommentAssistantDraftReplyResponse,
    responses={
        401: {"model": PostsErrorResponse},
        403: {"model": PostsErrorResponse},
        422: {"model": PostsErrorResponse},
        429: {"model": PostsErrorResponse},
        502: {"model": PostsErrorResponse},
        500: {"model": PostsErrorResponse},
    },
    summary="Draft a reply to a LinkedIn comment with ALwrity",
    description=(
        "Reads the original post and the received comment and drafts a reply "
        "in the user's voice. Pass refresh=true to bypass draft cache (Regenerate)."
    ),
)
async def post_comment_draft_reply(
    body: CommentAssistantDraftReplyRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommentAssistantDraftReplyResponse:
    """Draft a LinkedIn comment reply using ALwrity (Issue #188)."""
    user_id = _user_id(current_user)
    logger.info(
        "{} POST draft-reply user={} social_id_suffix={} comment_id_suffix={} "
        "refresh={}",
        _LOG_PREFIX,
        mask_user_id(user_id),
        body.social_id[-20:] if body.social_id else "(none)",
        body.comment_id[-20:] if body.comment_id else "(none)",
        body.refresh,
    )
    try:
        result = await draft_comment_reply(body, user_id, db=db)
        _raise_if_draft_failed(result)
        logger.info(
            "{} POST draft-reply ok user={} reply_length={} from_cache={}",
            _LOG_PREFIX,
            mask_user_id(user_id),
            len(result.reply or ""),
            result.from_cache,
        )
        return result
    except HTTPException as exc:
        if exc.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
            # Preserve billing message from llm_text_gen.
            msg = _http_exception_detail_message(exc.detail)
            logger.warning(
                "{} POST draft-reply subscription_limit user={}",
                _LOG_PREFIX,
                mask_user_id(user_id),
            )
            base = exc.detail if isinstance(exc.detail, dict) else {}
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    **base,
                    "error_code": "SUBSCRIPTION_LIMIT",
                    "message": msg
                    or "You have reached your AI usage limit. Please upgrade your plan.",
                },
            ) from exc
        if isinstance(exc.detail, dict) and exc.detail.get("error_code"):
            raise
        raise
    except CommentAssistantDraftError as exc:
        logger.warning(
            "{} POST draft-reply error user={} error_code={} type={}",
            _LOG_PREFIX,
            mask_user_id(user_id),
            exc.error_code,
            type(exc).__name__,
        )
        _raise_draft_http_error(error_code=exc.error_code, message=str(exc))
    except Exception as exc:
        logger.exception(
            "{} POST draft-reply unexpected_error user={} type={}",
            _LOG_PREFIX,
            mask_user_id(user_id),
            type(exc).__name__,
        )
        _raise_draft_http_error(error_code="unexpected_error")


@router.post(
    "/comment-assistant/draft-reply-manual",
    response_model=CommentAssistantDraftReplyResponse,
    responses={
        401: {"model": PostsErrorResponse},
        403: {"model": PostsErrorResponse},
        422: {"model": PostsErrorResponse},
        429: {"model": PostsErrorResponse},
        502: {"model": PostsErrorResponse},
        500: {"model": PostsErrorResponse},
    },
    summary="Draft a reply from pasted comment text (Manual tab)",
    description=(
        "Manual paste flow: draft a reply to a comment using optional post context. "
        "No LinkedIn ids are required."
    ),
)
async def post_comment_manual_draft_reply(
    body: CommentAssistantManualDraftReplyRequest,
    current_user: dict = Depends(get_current_user),
) -> CommentAssistantDraftReplyResponse:
    """Draft a LinkedIn comment reply from pasted text (Manual tab)."""
    user_id = _user_id(current_user)
    logger.info(
        "{} POST draft-reply-manual user={}",
        _LOG_PREFIX,
        mask_user_id(user_id),
    )
    try:
        result = await draft_manual_comment_reply(body, user_id)
        _raise_if_draft_failed(result)
        logger.info(
            "{} POST draft-reply-manual ok user={} reply_length={} from_cache={}",
            _LOG_PREFIX,
            mask_user_id(user_id),
            len(result.reply or ""),
            result.from_cache,
        )
        return result
    except HTTPException as exc:
        if exc.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
            msg = _http_exception_detail_message(exc.detail)
            logger.warning(
                "{} POST draft-reply-manual subscription_limit user={}",
                _LOG_PREFIX,
                mask_user_id(user_id),
            )
            base = exc.detail if isinstance(exc.detail, dict) else {}
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    **base,
                    "error_code": "SUBSCRIPTION_LIMIT",
                    "message": msg
                    or "You have reached your AI usage limit. Please upgrade your plan.",
                },
            ) from exc
        if isinstance(exc.detail, dict) and exc.detail.get("error_code"):
            raise
        raise
    except CommentAssistantDraftError as exc:
        logger.warning(
            "{} POST draft-reply-manual error user={} error_code={} type={}",
            _LOG_PREFIX,
            mask_user_id(user_id),
            exc.error_code,
            type(exc).__name__,
        )
        _raise_draft_http_error(error_code=exc.error_code, message=str(exc))
    except Exception as exc:
        logger.exception(
            "{} POST draft-reply-manual unexpected_error user={} type={}",
            _LOG_PREFIX,
            mask_user_id(user_id),
            type(exc).__name__,
        )
        _raise_draft_http_error(error_code="unexpected_error")
