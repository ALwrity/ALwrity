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
    normalize_org_aggregate,
    org_data_delay_note,
)
from services.integrations.linkedin.personal_analytics import build_personal_analytics_payload
from services.integrations.linkedin.types import (
    LinkedInAccount,
    LinkedInNotConnectedError,
    LinkedInOrganization,
)
from services.integrations.linkedin.account_resolution import resolve_account_pair
from services.integrations.linkedin.zernio_client import ZernioAPIError
from services.integrations.linkedin_oauth import LinkedInOAuthService

LOG_PREFIX = "[LinkedInAnalytics]"

ORG_CONNECTION_REQUIRED_MSG = (
    "Company page analytics is not available yet. "
    "Ensure your company page is connected in Zernio, then refresh this page."
)


def _friendly_org_analytics_error(exc: BaseException) -> str:
    msg = _zernio_error_message(exc)
    lower = msg.lower()
    if "personal_account_not_supported" in lower or (
        "organization accounts" in lower and "personal" in lower
    ):
        return ORG_CONNECTION_REQUIRED_MSG
    return msg


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


async def _resolve_org_tab_avatar(
    provider: Any,
    user_id: str,
    org_account: Optional[LinkedInAccount],
    primary_managed_org: Optional[LinkedInOrganization],
) -> tuple[Optional[str], str]:
    """Resolve org tab image: Zernio org account first, then managed-page logo."""
    if org_account:
        url = await _resolve_avatar_url(provider, user_id, org_account)
        if url:
            return url, "account"
    if primary_managed_org and primary_managed_org.logo_url:
        return primary_managed_org.logo_url, "org_list"
    return None, "none"


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

    oauth_service.try_sync_zernio_accounts(user_id)

    date_range = compute_last_7_day_range(today or date.today())
    logger.info(
        f"{LOG_PREFIX} date range user_id={user_id} "
        f"start={date_range.start_iso} end_exclusive={date_range.end_exclusive_iso} "
        f"label={date_range.label!r}"
    )

    accounts = await provider.list_accounts(user_id)
    creds = oauth_service.resolve_credentials(user_id)
    logger.warning(
        f"{LOG_PREFIX} creds after sync user_id={user_id} "
        f"personal_id={creds.zernio_account_id} org_id={creds.zernio_org_account_id} "
        f"profile_id={creds.zernio_profile_id}"
    )

    pair = resolve_account_pair(
        accounts,
        stored_personal_id=creds.zernio_account_id,
        stored_org_id=creds.zernio_org_account_id,
    )
    if not pair or not pair.personal_id:
        raise LinkedInNotConnectedError("No LinkedIn personal account found for user")

    personal_id = pair.personal_id
    org_analytics_account_id = pair.org_id
    org_account = pair.org

    managed_orgs: list[LinkedInOrganization] = []
    try:
        logger.info(
            f"{LOG_PREFIX} fetch org metadata user_id={user_id} "
            f"personal_id={personal_id} endpoint=linkedin-organizations"
        )
        managed_orgs = await provider.list_organizations(user_id, personal_id)
    except Exception as exc:
        logger.warning(
            f"{LOG_PREFIX} org metadata load failed user_id={user_id}: {exc}"
        )

    primary_managed_org = managed_orgs[0] if managed_orgs else None
    has_managed_orgs = primary_managed_org is not None
    include_organization = org_account is not None or has_managed_orgs

    org_meta_id = primary_managed_org.organization_id if primary_managed_org else None
    org_name = primary_managed_org.name if primary_managed_org else None

    logger.warning(
        f"{LOG_PREFIX} resolved ids user_id={user_id} "
        f"personal_id={personal_id} "
        f"org_analytics_account_id={org_analytics_account_id} "
        f"resolve_method={pair.method} "
        f"org_meta_id={org_meta_id} "
        f"has_managed_orgs={has_managed_orgs}"
    )

    personal_task = asyncio.create_task(
        build_personal_analytics_payload(user_id, provider, oauth_service, date_range)
    )

    org_avatar_task = (
        asyncio.create_task(
            _resolve_org_tab_avatar(provider, user_id, org_account, primary_managed_org)
        )
        if include_organization
        else None
    )

    organization_result: Optional[dict[str, Any]] = None
    data_delay_note: Optional[str] = None

    async def _run_org_fetch(target_org_id: str) -> tuple[dict[str, Any], Optional[str]]:
        logger.info(
            f"{LOG_PREFIX} fetch org user_id={user_id} "
            f"account_id={target_org_id} endpoint=org-aggregate-analytics"
        )
        return await _fetch_org_analytics(
            provider,
            user_id,
            target_org_id,
            start_iso=date_range.start_iso,
            end_exclusive_iso=date_range.end_exclusive_iso,
        )

    personal_payload = await personal_task
    personal_result = personal_payload["personal"]
    org_analytics_account_id = (
        personal_payload.get("orgAnalyticsAccountId") or org_analytics_account_id
    )

    if include_organization:
        organization_result = {
            "accountId": org_analytics_account_id,
            "orgId": org_meta_id,
            "orgName": org_name,
            "avatarUrl": None,
            "analytics": {},
            "error": None,
        }
        if org_analytics_account_id:
            try:
                org_analytics, delay_note = await _run_org_fetch(org_analytics_account_id)
                organization_result["analytics"] = org_analytics
                organization_result["accountId"] = org_analytics_account_id
                if delay_note:
                    data_delay_note = delay_note
                logger.warning(f"{LOG_PREFIX} org analytics ok user_id={user_id}")
            except Exception as exc:
                organization_result["error"] = _friendly_org_analytics_error(exc)
                status = _http_status_from_error(exc)
                logger.warning(
                    f"{LOG_PREFIX} org analytics failed user_id={user_id} "
                    f"status={status}: {exc}"
                )
        else:
            organization_result["error"] = ORG_CONNECTION_REQUIRED_MSG
            logger.warning(
                f"{LOG_PREFIX} org analytics skipped user_id={user_id} "
                f"reason=no_org_social_account has_managed_orgs={has_managed_orgs}"
            )

    if include_organization and organization_result is not None and org_avatar_task:
        org_avatar_url, org_avatar_source = await org_avatar_task
        organization_result["avatarUrl"] = org_avatar_url
        logger.info(
            f"{LOG_PREFIX} org avatar user_id={user_id} source={org_avatar_source}"
        )

    return {
        "dateRange": personal_payload["dateRange"],
        "personal": personal_result,
        "organization": organization_result,
        "dataDelayNote": data_delay_note,
        "provider": provider.provider_name,
    }
