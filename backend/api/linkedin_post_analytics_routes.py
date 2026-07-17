"""
LinkedIn Post Analytics API routes.

Serves cached post analytics from the workspace DB, with optional refresh
from the Unipile API.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger
from sqlalchemy.orm import Session

from middleware.auth_middleware import get_current_user
from models.linkedin_posts_models import (
    PostListResponse,
    PostsErrorResponse,
    PostAnalyticsHistoryResponse,
)
from services.database import get_db
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
from services.linkedin_post_analytics_service import LinkedInPostAnalyticsService

router = APIRouter(prefix="/api/linkedin", tags=["LinkedIn Post Analytics"])

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
    if err.status_code == 422:
        return status.HTTP_422_UNPROCESSABLE_ENTITY, "UNIPROCESSABLE", str(err)
    return status.HTTP_502_BAD_GATEWAY, "UNIPILE_ERROR", str(err)


async def _resolve_personal_account_and_identifier(user_id: str) -> tuple[str, str]:
    """Resolve Unipile personal account_id and provider identifier for post fetching."""
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
                "message": "Personal LinkedIn account not connected. Connect your personal LinkedIn profile to fetch posts.",
            },
        )

    identifier = await _get_personal_profile_provider_id(account_id)
    if not identifier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "IDENTIFIER_NOT_FOUND",
                "message": "LinkedIn personal profile provider id not found. Try reconnecting your LinkedIn account.",
            },
        )

    return account_id, identifier


async def _get_personal_profile_provider_id(account_id: str) -> Optional[str]:
    """Get LinkedIn provider internal id via Unipile own-profile lookup."""
    try:
        client = UnipileClient()
        profile = await client.get_own_profile(account_id)
        if isinstance(profile, dict):
            identifier = personal_profile_provider_id_from_owner(profile)
            if identifier:
                return identifier
    except Exception as exc:
        logger.warning(f"[PostAnalyticsRoutes] Could not fetch profile for provider_id: {exc}")

    return None


@router.get(
    "/post-analytics",
    response_model=PostListResponse,
    responses={
        401: {"model": PostsErrorResponse, "description": "Not authenticated or not connected"},
        500: {"model": PostsErrorResponse, "description": "Internal server error"},
    },
    summary="Get cached LinkedIn post analytics",
    description=(
        "Return LinkedIn post analytics from the workspace DB. "
        "Use ?refresh=true to trigger a fresh fetch from the Unipile API first."
    ),
)
async def get_post_analytics(
    refresh: bool = Query(False, description="Fetch fresh data from Unipile before returning"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    posts_service: PostsService = Depends(get_posts_service),
) -> PostListResponse:
    """Return LinkedIn post analytics, refreshing from Unipile when requested."""
    user_id = _user_id(current_user)
    analytics_service = LinkedInPostAnalyticsService(db)

    if refresh:
        try:
            account_id, identifier = await _resolve_personal_account_and_identifier(user_id)
            result = await posts_service.fetch_user_posts(
                account_id=account_id,
                identifier=identifier,
                limit=50,
            )
            analytics_service.store_posts(user_id, result.posts)
        except HTTPException:
            raise
        except PostsServiceError as exc:
            cause = exc.cause
            if isinstance(cause, UnipileAPIError):
                http_status, error_code, message = _map_unipile_error(cause)
                raise HTTPException(
                    status_code=http_status,
                    detail={
                        "error_code": error_code,
                        "message": message,
                        "details": {
                            "unipile_status": cause.status_code,
                            "unipile_error_type": cause.error_type,
                        },
                    },
                ) from exc
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"error_code": "FETCH_ERROR", "message": str(exc)},
            ) from exc
        except Exception as exc:
            logger.exception(f"[PostAnalyticsRoutes] Unexpected error during refresh: {exc}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"error_code": "INTERNAL_ERROR", "message": "An unexpected error occurred while refreshing posts."},
            ) from exc

    # Serve from DB
    try:
        response = analytics_service.get_stored_analytics(user_id)
        return response
    except Exception as exc:
        logger.exception(f"[PostAnalyticsRoutes] Error reading analytics from DB: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "DB_READ_ERROR", "message": "Failed to read post analytics from database."},
        ) from exc


@router.get(
    "/post-analytics/history",
    response_model=PostAnalyticsHistoryResponse,
    responses={
        401: {"model": PostsErrorResponse, "description": "Not authenticated"},
        400: {"model": PostsErrorResponse, "description": "Invalid period"},
        500: {"model": PostsErrorResponse, "description": "Internal server error"},
    },
    summary="Get engagement trends over a period window",
    description=(
        "Compare current post metrics vs a meaningful baseline for the selected period "
        "(1d, 7d, 15d, 30d, or since_joining). Returns Top / Rising / Falling lists."
    ),
)
async def get_engagement_history(
    period: str = Query(
        "since_joining",
        description="Comparison window: 1d | 7d | 15d | 30d | since_joining",
    ),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostAnalyticsHistoryResponse:
    """Return period-aware engagement trends for the authenticated user."""
    user_id = _user_id(current_user)
    from services.engagement_trends_period import mask_user_id_for_log

    logger.info(
        "[PostAnalyticsRoutes] Trends request user={} period={}",
        mask_user_id_for_log(user_id),
        period,
    )
    analytics_service = LinkedInPostAnalyticsService(db)
    try:
        return analytics_service.get_engagement_trends(user_id, period=period)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "INVALID_PERIOD", "message": str(exc)},
        ) from exc
    except Exception as exc:
        logger.exception(
            "[PostAnalyticsRoutes] Trends compute failed user={} period={}",
            mask_user_id_for_log(user_id),
            period,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "TRENDS_ERROR",
                "message": "Failed to compute engagement trends.",
            },
        ) from exc
