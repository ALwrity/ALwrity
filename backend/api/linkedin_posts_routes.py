"""
LinkedIn posts/articles fetch API routes.

Separate from content generation (routers/linkedin.py) and profile routes.
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from middleware.auth_middleware import get_current_user
from services.database import get_db
from services.integrations.linkedin.linkedin_posts_service import (
    fetch_single_post,
    fetch_user_posts,
)
from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.integrations.linkedin.unipile_client import UnipileAPIError

router = APIRouter(prefix="/api/linkedin-social", tags=["LinkedIn Social"])


class LinkedInPostItemResponse(BaseModel):
    unipile_post_id: str
    social_id: str
    content_kind: str
    title: str
    text: str
    share_url: str
    parsed_datetime: str
    is_repost: bool
    reaction_counter: int
    comment_counter: int
    repost_counter: int
    impressions_counter: int
    author_name: str
    author_public_identifier: str
    article_subtitle: str = ""
    article_cover_url: str = ""


class LinkedInPostsListResponse(BaseModel):
    user_id: str
    account_id: str
    identifier: str
    count: int
    cursor: Optional[str] = None
    persisted_asset_ids: list[int] = Field(default_factory=list)
    skipped_social_ids: list[str] = Field(default_factory=list)
    posts: list[LinkedInPostItemResponse]


def _raise_posts_http_error(exc: Exception, *, user_id: str) -> None:
    if isinstance(exc, LinkedInNotConnectedError):
        raise HTTPException(
            status_code=401,
            detail="LinkedIn account not connected",
        ) from exc

    if isinstance(exc, UnipileAPIError):
        status = exc.status_code
        message = str(exc).lower()
        if status == 401 or "disconnected" in message or "reconnect" in message:
            raise HTTPException(status_code=401, detail="Reconnect required") from exc
        if status == 403:
            raise HTTPException(
                status_code=502,
                detail="Unable to fetch LinkedIn posts",
            ) from exc
        raise HTTPException(
            status_code=502,
            detail="Unable to fetch LinkedIn posts",
        ) from exc

    if isinstance(exc, ValueError):
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    logger.exception(
        "[LinkedInPosts] unexpected error user_id={}: {}",
        user_id,
        exc,
    )
    raise HTTPException(
        status_code=500,
        detail="Unable to fetch LinkedIn posts",
    ) from exc


def _result_to_response(result: Any) -> LinkedInPostsListResponse:
    payload = result.to_dict()
    return LinkedInPostsListResponse(**payload)


@router.get("/posts", response_model=LinkedInPostsListResponse)
async def get_linkedin_posts(
    limit: int = Query(20, ge=1, le=100),
    cursor: Optional[str] = Query(None),
    fetch_all: bool = Query(False),
    include_article_body: bool = Query(True),
    persist: bool = Query(False),
    identifier: Optional[str] = Query(
        None,
        description="LinkedIn provider id; defaults to connected user",
    ),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LinkedInPostsListResponse:
    """Fetch LinkedIn posts/articles for the connected user via Unipile."""
    user_id = current_user.get("id") or current_user.get("clerk_user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        result = await fetch_user_posts(
            user_id,
            identifier=identifier,
            limit=limit,
            cursor=cursor,
            fetch_all=fetch_all,
            include_article_body=include_article_body,
            persist=persist,
            db=db if persist else None,
        )
        return _result_to_response(result)
    except HTTPException:
        raise
    except Exception as exc:
        _raise_posts_http_error(exc, user_id=user_id)


@router.get("/posts/{post_id}")
async def get_linkedin_post_detail(
    post_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Fetch a single LinkedIn post by Unipile post id."""
    user_id = current_user.get("id") or current_user.get("clerk_user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        return await fetch_single_post(user_id, post_id)
    except HTTPException:
        raise
    except Exception as exc:
        _raise_posts_http_error(exc, user_id=user_id)
