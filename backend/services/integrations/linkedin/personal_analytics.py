"""
Personal LinkedIn aggregate analytics BFF (date-range aware).
"""

from __future__ import annotations

from typing import Any, Optional

from loguru import logger

from services.integrations.linkedin.account_resolution import (
    apply_hint_swap_from_personal_error,
    parse_account_id_from_zernio_error,
    parse_zernio_error_code,
    resolve_account_pair,
)
from services.integrations.linkedin.analytics_dates import (
    AnalyticsDateRange,
    date_range_to_response,
)
from services.integrations.linkedin.analytics_normalizer import (
    PERSONAL_DEFAULT_METRICS,
    normalize_personal_aggregate,
)
from services.integrations.linkedin.types import (
    LinkedInAccount,
    LinkedInNotConnectedError,
)
from services.integrations.linkedin.zernio_client import ZernioAPIError
from services.integrations.linkedin_oauth import LinkedInOAuthService

LOG_PREFIX = "[LinkedInAnalytics]"


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


async def fetch_personal_analytics(
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


async def build_personal_analytics_payload(
    user_id: str,
    provider: Any,
    oauth_service: LinkedInOAuthService,
    date_range: AnalyticsDateRange,
) -> dict[str, Any]:
    """Build normalized personal analytics response for a given date range."""
    logger.warning(
        f"{LOG_PREFIX} personal range user_id={user_id} "
        f"start={date_range.start_iso} end_exclusive={date_range.end_exclusive_iso}"
    )

    try:
        oauth_service.resolve_credentials(user_id)
    except LinkedInNotConnectedError as exc:
        raise LinkedInNotConnectedError(str(exc)) from exc

    oauth_service.try_sync_zernio_accounts(user_id)

    accounts = await provider.list_accounts(user_id)
    creds = oauth_service.resolve_credentials(user_id)
    pair = resolve_account_pair(
        accounts,
        stored_personal_id=creds.zernio_account_id,
        stored_org_id=creds.zernio_org_account_id,
    )
    if not pair or not pair.personal_id:
        raise LinkedInNotConnectedError("No LinkedIn personal account found for user")

    personal_id = pair.personal_id
    personal_account = pair.personal
    org_analytics_account_id = pair.org_id

    personal_result: dict[str, Any] = {
        "accountId": personal_id,
        "avatarUrl": None,
        "analytics": {},
        "error": None,
    }
    personal_analytics_exc: Optional[BaseException] = None

    async def _run_fetch(target_personal_id: str) -> dict[str, Any]:
        logger.info(
            f"{LOG_PREFIX} fetch personal user_id={user_id} "
            f"account_id={target_personal_id} endpoint=linkedin-aggregate-analytics"
        )
        return await fetch_personal_analytics(
            provider,
            user_id,
            target_personal_id,
            start_iso=date_range.start_iso,
            end_exclusive_iso=date_range.end_exclusive_iso,
        )

    try:
        personal_result["analytics"] = await _run_fetch(personal_id)
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
            personal_id = new_personal_id
            org_analytics_account_id = new_org_id
            personal_result["accountId"] = personal_id
            personal_account = next(
                (a for a in accounts if a.account_id == personal_id),
                LinkedInAccount(
                    account_id=personal_id,
                    account_type="personal",
                    platform="linkedin",
                ),
            )
            logger.info(
                f"{LOG_PREFIX} hint swap applied user_id={user_id} "
                f"personal_id={personal_id} org_id={new_org_id}"
            )
            try:
                personal_result["analytics"] = await _run_fetch(personal_id)
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

    personal_result["avatarUrl"] = await _resolve_avatar_url(
        provider, user_id, personal_account
    )

    if personal_analytics_exc is not None:
        status = _http_status_from_error(personal_analytics_exc)
        if status in (402, 412, 403):
            raise personal_analytics_exc
        if status == 401:
            raise LinkedInNotConnectedError(_zernio_error_message(personal_analytics_exc))

    return {
        "dateRange": date_range_to_response(date_range),
        "personal": personal_result,
        "orgAnalyticsAccountId": org_analytics_account_id,
        "provider": provider.provider_name,
    }
