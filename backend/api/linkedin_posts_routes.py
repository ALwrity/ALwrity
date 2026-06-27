"""
LinkedIn Posts API routes.

Provides endpoints for fetching user's LinkedIn posts with engagement metrics.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from loguru import logger

from middleware.auth_middleware import get_current_user
from models.linkedin_posts_models import (
    PostListResponse,
    PostsErrorResponse,
)
from services.integrations.linkedin.posts_service import (
    PostsService,
    PostsServiceError,
    get_posts_service,
)
from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.integrations.linkedin.unipile_client import (
    UnipileAPIError,
    UnipileClient,
    personal_profile_provider_id_from_owner,
)
from services.integrations.linkedin_oauth import LinkedInOAuthService

router = APIRouter(prefix="/api/linkedin", tags=["LinkedIn Posts"])

_oauth_service = LinkedInOAuthService()


def _user_id(current_user: dict) -> str:
    uid = current_user.get("id") if current_user else None
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return str(uid)


def _map_unipile_error(err: UnipileAPIError) -> tuple[int, str, str]:
    """Map Unipile API errors to HTTP status, error_code, and user-facing message."""
    if err.status_code == 429:
        return status.HTTP_429_TOO_MANY_REQUESTS, "RATE_LIMITED", str(err)
    if err.status_code == 401:
        return status.HTTP_401_UNAUTHORIZED, "UNIPILE_AUTH", str(err)
    if err.status_code == 403:
        return status.HTTP_403_FORBIDDEN, "UNIPILE_FORBIDDEN", str(err)
    if err.status_code == 422 and err.error_type == "errors/invalid_recipient":
        return (
            status.HTTP_502_BAD_GATEWAY,
            "LINKEDIN_RECIPIENT_UNREACHABLE",
            (
                "Could not fetch posts: LinkedIn profile identifier is invalid or "
                "unreachable. Try reconnecting your personal LinkedIn account."
            ),
        )
    if err.status_code == 422:
        return status.HTTP_422_UNPROCESSABLE_ENTITY, "UNIPROCESSABLE", str(err)
    return status.HTTP_502_BAD_GATEWAY, "UNIPILE_ERROR", str(err)


async def _resolve_personal_account_and_identifier(user_id: str) -> tuple[str, str]:
    """
    Resolve Unipile personal account_id and provider id for post list fetch.

    Uses the connected end user's LinkedIn personal profile only (not company pages).
    """
    connection_status = _oauth_service.get_connection_status(user_id)
    if connection_status.get("connected") and connection_status.get("provider") == "unipile":
        if await _oauth_service.try_sync_unipile_accounts(user_id):
            connection_status = _oauth_service.get_connection_status(user_id)

    if not connection_status.get("connected"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error_code": "NOT_CONNECTED",
                "message": "LinkedIn account not connected. Please connect your LinkedIn account first.",
            },
        )

    try:
        creds = _oauth_service.resolve_credentials(user_id)
    except LinkedInNotConnectedError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error_code": "NOT_CONNECTED",
                "message": "LinkedIn account not connected. Please connect your LinkedIn account first.",
            },
        ) from exc

    account_id = creds.unipile_account_id
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "PERSONAL_ACCOUNT_NOT_FOUND",
                "message": (
                    "Personal LinkedIn account not connected. "
                    "Connect your personal LinkedIn profile to fetch posts."
                ),
            },
        )

    identifier = await _get_personal_profile_provider_id(account_id)
    if not identifier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "IDENTIFIER_NOT_FOUND",
                "message": (
                    "LinkedIn personal profile provider id not found. "
                    "Try reconnecting your LinkedIn account."
                ),
            },
        )

    return account_id, identifier


async def _get_personal_profile_provider_id(account_id: str) -> Optional[str]:
    """
    Get LinkedIn provider internal id for Unipile GET /api/v1/users/{identifier}/posts.

    Uses provider_id (ACo/ADo...) from the connected personal profile, not vanity slug.
    """
    try:
        client = UnipileClient()
        profile = await client.get_own_profile(account_id)
        if isinstance(profile, dict):
            identifier = personal_profile_provider_id_from_owner(profile)
            if identifier:
                logger.debug(
                    f"[PostsRoutes] Resolved personal provider_id={identifier} "
                    f"account_id={account_id}"
                )
                return identifier
            logger.warning(
                f"[PostsRoutes] Own profile missing provider_id account_id={account_id} "
                f"keys={list(profile.keys())}"
            )
    except Exception as exc:
        logger.warning(
            f"[PostsRoutes] Could not fetch profile for provider_id "
            f"account_id={account_id}: {exc}"
        )

    return None


@router.get(
    "/posts",
    response_model=PostListResponse,
    responses={
        401: {"model": PostsErrorResponse, "description": "Not authenticated or not connected"},
        404: {"model": PostsErrorResponse, "description": "Account or identifier not found"},
        429: {"model": PostsErrorResponse, "description": "Rate limit exceeded"},
        500: {"model": PostsErrorResponse, "description": "Internal server error"},
    },
    summary="Fetch user's LinkedIn posts",
    description=(
        "Fetch the authenticated user's LinkedIn posts with engagement metrics. "
        "Supports pagination via cursor. Returns 20 posts by default."
    ),
)
async def get_linkedin_posts(
    request: Request,
    cursor: Optional[str] = Query(None, description="Pagination cursor for next page"),
    limit: int = Query(20, ge=1, le=100, description="Number of posts to fetch (max 100)"),
    current_user: dict = Depends(get_current_user),
    posts_service: PostsService = Depends(get_posts_service),
) -> PostListResponse:
    """Fetch LinkedIn posts for the authenticated user."""
    user_id = _user_id(current_user)
    logger.info(
        f"[PostsRoutes] Fetching posts for user={user_id} limit={limit} "
        f"cursor={'set' if cursor else 'none'}"
    )

    try:
        account_id, identifier = await _resolve_personal_account_and_identifier(user_id)
        logger.info(
            f"[PostsRoutes] Using personal account_id={account_id} "
            f"provider_id={identifier}"
        )

        result = await posts_service.fetch_user_posts(
            account_id=account_id,
            identifier=identifier,
            cursor=cursor,
            limit=limit,
        )

        logger.info(
            f"[PostsRoutes] Successfully fetched {len(result.posts)} posts for user={user_id}"
        )
        return result

    except HTTPException:
        raise

    except PostsServiceError as exc:
        logger.error(f"[PostsRoutes] Posts service error: {exc}")

        cause = exc.cause
        if isinstance(cause, UnipileAPIError):
            status_code, error_code, message = _map_unipile_error(cause)
            raise HTTPException(
                status_code=status_code,
                detail={
                    "error_code": error_code,
                    "message": message,
                    "details": {
                        "unipile_status": cause.status_code,
                        "unipile_error_type": cause.error_type,
                    },
                },
            ) from exc

        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        error_code = "FETCH_ERROR"
        message = str(exc)

        error_str = str(exc).lower()
        if "rate limit" in error_str or "429" in error_str:
            status_code = status.HTTP_429_TOO_MANY_REQUESTS
            error_code = "RATE_LIMITED"
        elif "not found" in error_str:
            status_code = status.HTTP_404_NOT_FOUND
            error_code = "NOT_FOUND"

        raise HTTPException(
            status_code=status_code,
            detail={
                "error_code": error_code,
                "message": message,
                "details": {"cause": str(exc.cause)} if exc.cause else None,
            },
        ) from exc

    except Exception as exc:
        logger.exception(f"[PostsRoutes] Unexpected error fetching posts: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred while fetching posts.",
            },
        ) from exc
