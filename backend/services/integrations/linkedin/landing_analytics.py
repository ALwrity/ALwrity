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
from services.integrations.linkedin.types import (
    LinkedInAccount,
    LinkedInNotConnectedError,
    LinkedInOrganization,
)
from services.integrations.linkedin.account_resolution import (
    apply_hint_swap_from_personal_error,
    parse_account_id_from_zernio_error,
    parse_zernio_error_code,
    resolve_account_pair,
)
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
    personal_account = pair.personal
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

    personal_avatar_task = asyncio.create_task(
        _resolve_avatar_url(provider, user_id, personal_account)
    )
    org_avatar_task = (
        asyncio.create_task(
            _resolve_org_tab_avatar(provider, user_id, org_account, primary_managed_org)
        )
        if include_organization
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
    personal_analytics_exc: Optional[BaseException] = None

    async def _run_personal_fetch(target_personal_id: str) -> dict[str, Any]:
        logger.info(
            f"{LOG_PREFIX} fetch personal user_id={user_id} "
            f"account_id={target_personal_id} endpoint=linkedin-aggregate-analytics"
        )
        return await _fetch_personal_analytics(
            provider,
            user_id,
            target_personal_id,
            start_iso=date_range.start_iso,
            end_exclusive_iso=date_range.end_exclusive_iso,
        )

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

    org_task: Optional[asyncio.Task] = None

    if org_analytics_account_id:
        org_task = asyncio.create_task(_run_org_fetch(org_analytics_account_id))
        try:
            personal_result["analytics"] = await _run_personal_fetch(personal_id)
            logger.info(f"{LOG_PREFIX} personal analytics ok user_id={user_id}")
        except Exception as exc:
            personal_analytics_exc = exc
            err_msg = _zernio_error_message(exc)
            personal_result["error"] = err_msg
            status = _http_status_from_error(exc)
            hint_id = parse_account_id_from_zernio_error(err_msg)
            logger.warning(
                f"{LOG_PREFIX} personal analytics failed user_id={user_id} "
                f"status={status} code={parse_zernio_error_code(err_msg)} "
                f"hint_account_id={hint_id}: {exc}"
            )
            new_personal_id, new_org_id, swap_method = apply_hint_swap_from_personal_error(
                err_msg, accounts, personal_id, org_analytics_account_id
            )
            if swap_method and new_org_id:
                if org_task and not org_task.done():
                    org_task.cancel()
                org_analytics_account_id = new_org_id
                personal_id = new_personal_id
                personal_result["accountId"] = personal_id
                org_task = asyncio.create_task(_run_org_fetch(org_analytics_account_id))
                logger.info(
                    f"{LOG_PREFIX} hint swap applied user_id={user_id} "
                    f"personal_id={personal_id} org_id={new_org_id}"
                )
                try:
                    personal_result["analytics"] = await _run_personal_fetch(personal_id)
                    personal_result["error"] = None
                    personal_analytics_exc = None
                    logger.info(
                        f"{LOG_PREFIX} personal analytics ok after hint swap user_id={user_id}"
                    )
                except Exception as retry_exc:
                    personal_analytics_exc = retry_exc
                    personal_result["error"] = _zernio_error_message(retry_exc)
                    logger.warning(
                        f"{LOG_PREFIX} personal analytics failed after hint swap "
                        f"user_id={user_id}: {retry_exc}"
                    )
    else:
        try:
            personal_result["analytics"] = await _run_personal_fetch(personal_id)
            logger.info(f"{LOG_PREFIX} personal analytics ok user_id={user_id}")
        except Exception as exc:
            personal_analytics_exc = exc
            personal_result["error"] = _zernio_error_message(exc)
            status = _http_status_from_error(exc)
            hint_id = parse_account_id_from_zernio_error(_zernio_error_message(exc))
            logger.warning(
                f"{LOG_PREFIX} personal analytics failed user_id={user_id} "
                f"status={status} code={parse_zernio_error_code(_zernio_error_message(exc))} "
                f"hint_account_id={hint_id}: {exc}"
            )
            new_personal_id, new_org_id, swap_method = apply_hint_swap_from_personal_error(
                _zernio_error_message(exc),
                accounts,
                personal_id,
                org_analytics_account_id,
            )
            if swap_method and new_org_id:
                org_analytics_account_id = new_org_id
                personal_id = new_personal_id
                personal_account = next(
                    (a for a in accounts if a.account_id == personal_id),
                    LinkedInAccount(
                        account_id=personal_id,
                        account_type="personal",
                        platform="linkedin",
                    ),
                )
                personal_result["accountId"] = personal_id
                org_account = next(
                    (a for a in accounts if a.account_id == new_org_id),
                    LinkedInAccount(
                        account_id=new_org_id,
                        account_type="organization",
                        platform="linkedin",
                    ),
                )
                logger.info(
                    f"{LOG_PREFIX} hint swap applied user_id={user_id} "
                    f"personal_id={personal_id} org_id={new_org_id}"
                )
                try:
                    personal_result["analytics"] = await _run_personal_fetch(personal_id)
                    personal_result["error"] = None
                    personal_analytics_exc = None
                    logger.info(
                        f"{LOG_PREFIX} personal analytics ok after hint swap user_id={user_id}"
                    )
                except Exception as retry_exc:
                    personal_analytics_exc = retry_exc
                    personal_result["error"] = _zernio_error_message(retry_exc)
                    logger.warning(
                        f"{LOG_PREFIX} personal analytics failed after hint swap "
                        f"user_id={user_id}: {retry_exc}"
                    )
        org_task = None

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
                if org_task is not None:
                    org_analytics, delay_note = await org_task
                else:
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

    personal_result["avatarUrl"] = await personal_avatar_task
    if include_organization and organization_result is not None and org_avatar_task:
        org_avatar_url, org_avatar_source = await org_avatar_task
        organization_result["avatarUrl"] = org_avatar_url
        logger.info(
            f"{LOG_PREFIX} org avatar user_id={user_id} source={org_avatar_source}"
        )

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
