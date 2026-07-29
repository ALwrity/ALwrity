"""
LinkedIn Classic search service — proxies Unipile search and parameter lookup.

Resolves the user's connected Unipile account, validates v1 categories,
and normalizes responses for the LinkedIn Studio frontend.
"""

from __future__ import annotations

import os
from typing import Any, Optional

from loguru import logger

from models.linkedin_search_models import (
    LinkedInSearchParameterItem,
    LinkedInSearchParametersPagingResponse,
    LinkedInSearchParametersResponse,
    LinkedInSearchPagingResponse,
    LinkedInSearchRequest,
    LinkedInSearchResponse,
)
from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.integrations.linkedin.unipile_client import UnipileClient
from services.integrations.linkedin_oauth import LinkedInOAuthService


SUPPORTED_SEARCH_CATEGORIES = frozenset({"posts", "jobs", "people", "companies"})

SUPPORTED_PARAMETER_TYPES = frozenset(
    {
        "LOCATION",
        "PEOPLE",
        "CONNECTIONS",
        "COMPANY",
        "SCHOOL",
        "INDUSTRY",
        "SERVICE",
        "JOB_FUNCTION",
        "JOB_TITLE",
        "EMPLOYMENT_TYPE",
        "SKILL",
    }
)


class LinkedInSearchNotAvailableError(RuntimeError):
    """Raised when LinkedIn search requires Unipile but another provider is active."""


class LinkedInSearchValidationError(ValueError):
    """Raised when search request parameters are invalid."""


def _ensure_unipile_provider() -> None:
    """Require LINKEDIN_PROVIDER=unipile for search operations."""
    mode = os.getenv("LINKEDIN_PROVIDER", "unipile").lower()
    if mode != "unipile":
        logger.warning(
            "[LinkedInSearch] unavailable provider_mode={} (requires unipile)",
            mode,
        )
        raise LinkedInSearchNotAvailableError(
            "LinkedIn search is only available when LINKEDIN_PROVIDER=unipile."
        )


def _validate_category(category: str) -> str:
    """Allow only v1 Unipile Classic search categories."""
    normalized = (category or "").strip().lower()
    if normalized not in SUPPORTED_SEARCH_CATEGORIES:
        raise LinkedInSearchValidationError(
            f"Unsupported search category '{category}'. "
            f"Supported: {', '.join(sorted(SUPPORTED_SEARCH_CATEGORIES))}."
        )
    return normalized


def _validate_parameter_type(parameter_type: str) -> str:
    """Validate Unipile search parameter type."""
    normalized = (parameter_type or "").strip().upper()
    if normalized not in SUPPORTED_PARAMETER_TYPES:
        raise LinkedInSearchValidationError(
            f"Unsupported parameter type '{parameter_type}'. "
            f"Supported: {', '.join(sorted(SUPPORTED_PARAMETER_TYPES))}."
        )
    return normalized


def _resolve_account_id(
    user_id: str,
    *,
    account_id: Optional[str],
    oauth: LinkedInOAuthService,
) -> str:
    """Resolve Unipile account id for the authenticated user."""
    if account_id:
        return account_id

    creds = oauth.resolve_credentials(user_id)
    resolved = creds.unipile_account_id or creds.primary_account_id
    if not resolved:
        raise LinkedInNotConnectedError(
            "No Unipile LinkedIn account connected. "
            "Connect via hosted OAuth before searching LinkedIn."
        )
    return resolved


def _build_unipile_payload(request: LinkedInSearchRequest) -> dict[str, Any]:
    """Map ALwrity search request to Unipile POST body."""
    category = _validate_category(request.category)
    payload: dict[str, Any] = {
        "api": request.api,
        "category": category,
        "keywords": request.keywords.strip(),
    }

    filters = request.filters
    filter_mapping: list[tuple[str, Any]] = [
        ("location", filters.location),
        ("industry", filters.industry),
        ("company", filters.company),
        ("past_company", filters.past_company),
        ("school", filters.school),
        ("service", filters.service),
        ("network_distance", filters.network_distance),
    ]
    for key, value in filter_mapping:
        if value:
            payload[key] = value

    if filters.sort_by:
        payload["sort_by"] = filters.sort_by
    if filters.date_posted:
        payload["date_posted"] = filters.date_posted

    return payload


def _normalize_search_response(
    raw: dict[str, Any],
    *,
    active_category: str,
) -> LinkedInSearchResponse:
    """Normalize raw Unipile LinkedinSearch payload for API consumers."""
    items = raw.get("items")
    if not isinstance(items, list):
        items = []

    paging_raw = raw.get("paging")
    paging = LinkedInSearchPagingResponse()
    if isinstance(paging_raw, dict):
        paging = LinkedInSearchPagingResponse(
            start=paging_raw.get("start"),
            page_count=paging_raw.get("page_count"),
            total_count=paging_raw.get("total_count"),
        )

    cursor = raw.get("cursor")
    if isinstance(cursor, str) and not cursor.strip():
        cursor = None

    return LinkedInSearchResponse(
        success=True,
        object=str(raw.get("object") or "LinkedinSearch"),
        items=[item for item in items if isinstance(item, dict)],
        paging=paging,
        cursor=cursor if isinstance(cursor, str) else None,
        active_category=active_category,  # type: ignore[arg-type]
        provider="unipile",
    )


def _normalize_parameters_response(raw: dict[str, Any]) -> LinkedInSearchParametersResponse:
    """Normalize raw Unipile LinkedinSearchParametersList payload."""
    items_raw = raw.get("items")
    items: list[LinkedInSearchParameterItem] = []
    if isinstance(items_raw, list):
        for entry in items_raw:
            if not isinstance(entry, dict):
                continue
            param_id = entry.get("id")
            title = entry.get("title")
            if not param_id or not title:
                continue
            additional = entry.get("additional_data")
            items.append(
                LinkedInSearchParameterItem(
                    id=str(param_id),
                    title=str(title),
                    picture_url=entry.get("picture_url"),
                    additional_data=additional if isinstance(additional, dict) else {},
                )
            )

    paging_raw = raw.get("paging")
    paging = LinkedInSearchParametersPagingResponse()
    if isinstance(paging_raw, dict):
        paging = LinkedInSearchParametersPagingResponse(
            page_count=paging_raw.get("page_count"),
        )

    return LinkedInSearchParametersResponse(
        success=True,
        object=str(raw.get("object") or "LinkedinSearchParametersList"),
        items=items,
        paging=paging,
        provider="unipile",
    )


async def perform_search(
    user_id: str,
    request: LinkedInSearchRequest,
    *,
    oauth: Optional[LinkedInOAuthService] = None,
    client: Optional[UnipileClient] = None,
) -> LinkedInSearchResponse:
    """
    Perform a LinkedIn Classic search for the authenticated user.

    Args:
        user_id: ALwrity user id (Clerk)
        request: Validated search request
        oauth: Optional OAuth service (testing)
        client: Optional Unipile client (testing)

    Returns:
        Normalized search response

    Raises:
        LinkedInSearchNotAvailableError: Provider is not Unipile
        LinkedInNotConnectedError: No connected account
        LinkedInSearchValidationError: Invalid category or payload
    """
    _ensure_unipile_provider()
    oauth_service = oauth or LinkedInOAuthService()
    unipile = client or UnipileClient()

    category = _validate_category(request.category)
    account_id = _resolve_account_id(
        user_id,
        account_id=request.account_id,
        oauth=oauth_service,
    )
    payload = _build_unipile_payload(request)

    logger.info(
        "[LinkedInSearch] perform_search user_id={} account_id={} category={} "
        "keywords={!r} limit={} cursor={}",
        user_id,
        account_id,
        category,
        request.keywords.strip(),
        request.limit,
        "set" if request.cursor else "none",
    )

    raw = await unipile.linkedin_search(
        account_id,
        payload,
        cursor=request.cursor,
        limit=request.limit,
    )

    if not isinstance(raw, dict):
        raise TypeError(f"Expected dict from Unipile search, got {type(raw).__name__}")

    response = _normalize_search_response(raw, active_category=category)
    logger.info(
        "[LinkedInSearch] perform_search complete user_id={} category={} "
        "items={} total_count={}",
        user_id,
        category,
        len(response.items),
        response.paging.total_count,
    )
    return response


async def get_search_parameters(
    user_id: str,
    parameter_type: str,
    *,
    keywords: Optional[str] = None,
    limit: int = 10,
    service: str = "CLASSIC",
    account_id: Optional[str] = None,
    oauth: Optional[LinkedInOAuthService] = None,
    client: Optional[UnipileClient] = None,
) -> LinkedInSearchParametersResponse:
    """
    Retrieve LinkedIn search parameter IDs for filter autocomplete.

    Args:
        user_id: ALwrity user id (Clerk)
        parameter_type: Unipile parameter type (e.g. LOCATION)
        keywords: Optional lookup keywords
        limit: Max parameters to return
        service: CLASSIC, RECRUITER, or SALES_NAVIGATOR
        account_id: Optional explicit Unipile account id
        oauth: Optional OAuth service (testing)
        client: Optional Unipile client (testing)

    Returns:
        Normalized parameters list response
    """
    _ensure_unipile_provider()
    oauth_service = oauth or LinkedInOAuthService()
    unipile = client or UnipileClient()

    normalized_type = _validate_parameter_type(parameter_type)
    resolved_account_id = _resolve_account_id(
        user_id,
        account_id=account_id,
        oauth=oauth_service,
    )

    logger.info(
        "[LinkedInSearch] get_search_parameters user_id={} account_id={} type={} "
        "keywords={!r} limit={}",
        user_id,
        resolved_account_id,
        normalized_type,
        keywords,
        limit,
    )

    raw = await unipile.get_linkedin_search_parameters(
        resolved_account_id,
        normalized_type,
        keywords=keywords,
        limit=limit,
        service=service,
    )

    if not isinstance(raw, dict):
        raise TypeError(
            f"Expected dict from Unipile search parameters, got {type(raw).__name__}"
        )

    response = _normalize_parameters_response(raw)
    logger.info(
        "[LinkedInSearch] get_search_parameters complete user_id={} type={} items={}",
        user_id,
        normalized_type,
        len(response.items),
    )
    return response
