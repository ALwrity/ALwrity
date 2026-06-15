"""
Orchestrate LinkedIn landing-page analytics (rolling 7-day BFF).
"""

from __future__ import annotations

import asyncio
from datetime import date
from typing import Any, Optional

from loguru import logger

from services.integrations.linkedin.analytics_dates import compute_last_7_day_range
from services.integrations.linkedin.analytics_normalizer import (
    ORG_DEFAULT_LANDING_METRICS,
    PERSONAL_DEFAULT_METRICS,
    normalize_org_aggregate,
    normalize_personal_aggregate,
    org_data_delay_note,
)
from services.integrations.linkedin.types import LinkedInAccount, LinkedInNotConnectedError
from services.integrations.linkedin.zernio_client import ZernioAPIError
from services.integrations.linkedin_oauth import LinkedInOAuthService

LOG_PREFIX = "[LinkedInAnalytics]"


def _account_type_lower(account: LinkedInAccount) -> str:
    return (account.account_type or "").lower()


def _find_personal_account(accounts: list[LinkedInAccount]) -> Optional[LinkedInAccount]:
    for account in accounts:
        if _account_type_lower(account) == "personal":
            return account
    for account in accounts:
        if _account_type_lower(account) not in ("organization", "org"):
            return account
    return accounts[0] if accounts else None


def _find_org_account(
    accounts: list[LinkedInAccount],
    *,
    org_account_id: Optional[str],
) -> Optional[LinkedInAccount]:
    if org_account_id:
        for account in accounts:
            if account.account_id == org_account_id:
                return account
        return LinkedInAccount(
            account_id=org_account_id,
            account_type="organization",
            platform="linkedin",
        )
    for account in accounts:
        if _account_type_lower(account) in ("organization", "org"):
            return account
    return None


def _zernio_error_message(exc: BaseException) -> str:
    if isinstance(exc, ZernioAPIError):
        return str(exc)
    return str(exc) or "LinkedIn analytics request failed"


def _http_status_from_error(exc: BaseException) -> Optional[int]:
    if isinstance(exc, ZernioAPIError) and exc.status_code is not None:
        return exc.status_code
    return None


async def _resolve_avatar_url(
    provider: Any,
    user_id: str,
    account: LinkedInAccount,
) -> Optional[str]:
    resolve = getattr(provider, "resolve_account_avatar_url", None)
    if callable(resolve):
        return await resolve(user_id, account)
    return account.avatar_url


async def _fetch_personal_analytics(
    provider: Any,
    user_id: str,
    account_id: str,
    *,
    start_iso: str,
    end_exclusive_iso: str,
) -> dict[str, Any]:
    raw = await provider.get_profile_aggregate_analytics(
        user_id,
        account_id,
        aggregation="TOTAL",
        start_date=start_iso,
        end_date=end_exclusive_iso,
        metrics=list(PERSONAL_DEFAULT_METRICS),
    )
    return normalize_personal_aggregate(raw)


async def _fetch_org_analytics(
    provider: Any,
    user_id: str,
    account_id: str,
    *,
    start_iso: str,
    end_exclusive_iso: str,
) -> tuple[dict[str, Any], Optional[str]]:
    raw = await provider.get_org_aggregate_analytics(
        user_id,
        account_id,
        since=start_iso,
        until=end_exclusive_iso,
        metric_type="total_value",
        metrics=list(ORG_DEFAULT_LANDING_METRICS),
    )
    return normalize_org_aggregate(raw), org_data_delay_note(raw)


async def build_landing_analytics_payload(
    user_id: str,
    provider: Any,
    oauth_service: LinkedInOAuthService,
    *,
    today: Optional[date] = None,
) -> dict[str, Any]:
    """
    Build landing analytics response dict (rolling last 7 days as of ``today``).
    """
    logger.info(f"{LOG_PREFIX} landing request user_id={user_id}")

    try:
        oauth_service.resolve_credentials(user_id)
    except LinkedInNotConnectedError as exc:
        raise LinkedInNotConnectedError(str(exc)) from exc

    date_range = compute_last_7_day_range(today or date.today())
    logger.info(
        f"{LOG_PREFIX} date range user_id={user_id} "
        f"start={date_range.start_iso} end_exclusive={date_range.end_exclusive_iso} "
        f"label={date_range.label!r}"
    )

    accounts = await provider.list_accounts(user_id)
    personal_account = _find_personal_account(accounts)

    creds = oauth_service.resolve_credentials(user_id)
    org_account_id = creds.zernio_org_account_id
    org_account = _find_org_account(accounts, org_account_id=org_account_id)

    if not personal_account or not personal_account.account_id:
        raise LinkedInNotConnectedError("No LinkedIn personal account found for user")

    personal_id = personal_account.account_id
    org_id: Optional[str] = org_account.account_id if org_account else None

    org_meta_id: Optional[str] = None
    if org_id and personal_id:
        try:
            orgs = await provider.list_organizations(user_id, personal_id)
            if orgs:
                org_meta_id = orgs[0].organization_id
        except Exception as exc:
            logger.warning(
                f"{LOG_PREFIX} org metadata load failed user_id={user_id}: {exc}"
            )

    personal_avatar_task = asyncio.create_task(
        _resolve_avatar_url(provider, user_id, personal_account)
    )
    org_avatar_task = (
        asyncio.create_task(_resolve_avatar_url(provider, user_id, org_account))
        if org_account
        else None
    )

    personal_result: dict[str, Any] = {
        "accountId": personal_id,
        "avatarUrl": None,
        "analytics": {},
        "error": None,
    }
    organization_result: Optional[dict[str, Any]] = None
    data_delay_note: Optional[str] = None

    personal_task = asyncio.create_task(
        _fetch_personal_analytics(
            provider,
            user_id,
            personal_id,
            start_iso=date_range.start_iso,
            end_exclusive_iso=date_range.end_exclusive_iso,
        )
    )
    org_task = (
        asyncio.create_task(
            _fetch_org_analytics(
                provider,
                user_id,
                org_id,
                start_iso=date_range.start_iso,
                end_exclusive_iso=date_range.end_exclusive_iso,
            )
        )
        if org_id
        else None
    )

    personal_analytics_exc: Optional[BaseException] = None
    org_analytics_exc: Optional[BaseException] = None

    try:
        personal_analytics = await personal_task
        personal_result["analytics"] = personal_analytics
        logger.info(f"{LOG_PREFIX} personal analytics ok user_id={user_id}")
    except Exception as exc:
        personal_analytics_exc = exc
        personal_result["error"] = _zernio_error_message(exc)
        status = _http_status_from_error(exc)
        logger.warning(
            f"{LOG_PREFIX} personal analytics failed user_id={user_id} "
            f"status={status}: {exc}"
        )

    if org_task is not None and org_id:
        organization_result = {
            "accountId": org_id,
            "orgId": org_meta_id,
            "avatarUrl": None,
            "analytics": {},
            "error": None,
        }
        try:
            org_analytics, delay_note = await org_task
            organization_result["analytics"] = org_analytics
            if delay_note:
                data_delay_note = delay_note
            logger.info(f"{LOG_PREFIX} org analytics ok user_id={user_id}")
        except Exception as exc:
            org_analytics_exc = exc
            organization_result["error"] = _zernio_error_message(exc)
            status = _http_status_from_error(exc)
            logger.warning(
                f"{LOG_PREFIX} org analytics failed user_id={user_id} "
                f"status={status}: {exc}"
            )

    personal_result["avatarUrl"] = await personal_avatar_task
    if org_avatar_task and organization_result is not None:
        organization_result["avatarUrl"] = await org_avatar_task

    if personal_analytics_exc is not None:
        status = _http_status_from_error(personal_analytics_exc)
        if status in (402, 412, 403):
            raise personal_analytics_exc
        if status == 401:
            raise LinkedInNotConnectedError(_zernio_error_message(personal_analytics_exc))

    return {
        "dateRange": {
            "start": date_range.start_iso,
            "endExclusive": date_range.end_exclusive_iso,
            "label": date_range.label,
            "dataLagDays": date_range.data_lag_days,
        },
        "personal": personal_result,
        "organization": organization_result,
        "dataDelayNote": data_delay_note,
        "provider": provider.provider_name,
    }
