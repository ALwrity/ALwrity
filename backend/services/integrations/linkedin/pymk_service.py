"""LinkedIn People You May Know service."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from loguru import logger

from models.linkedin_pymk_models import PymkListResponse, PymkSuggestionItem
from services.integrations.linkedin.pymk_cohort_resolver import PymkCohortResolver
from services.integrations.linkedin.pymk_parser import parse_pymk_response
from services.integrations.linkedin.pymk_profile_enricher import PymkProfileEnricher
from services.integrations.linkedin.pymk_types import PymkCohort, build_pymk_unipile_request
from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.integrations.linkedin.unipile_client import UnipileAPIError, UnipileClient
from services.integrations.linkedin_oauth import LinkedInOAuthService

_COHORT_ID_ERRORS = {
    PymkCohort.SAME_SCHOOL: (
        "Could not determine your school ID from LinkedIn. "
        "Enter school ID from LinkedIn DevTools (Network tab on My Network)."
    ),
    PymkCohort.SAME_JOB: (
        "Could not determine your job title cohort ID from LinkedIn. "
        "Enter super title ID from LinkedIn DevTools."
    ),
    PymkCohort.SAME_INDUSTRY: (
        "Could not determine your industry from LinkedIn. "
        "Ensure your profile has a current employer, then refresh. "
        "You can also enter an industry ID from LinkedIn DevTools."
    ),
}


class PymkServiceError(RuntimeError):
    """Raised when PYMK fetch or parse fails."""


class PymkService:
    """Fetch and normalize LinkedIn PYMK suggestions via Unipile raw data route."""

    def __init__(
        self,
        oauth_service: Optional[LinkedInOAuthService] = None,
        unipile_client: Optional[UnipileClient] = None,
        cohort_resolver: Optional[PymkCohortResolver] = None,
        profile_enricher: Optional[PymkProfileEnricher] = None,
    ) -> None:
        self._oauth = oauth_service or LinkedInOAuthService()
        self._client = unipile_client or UnipileClient()
        self._cohort_resolver = cohort_resolver or PymkCohortResolver(self._client)
        self._profile_enricher = profile_enricher or PymkProfileEnricher(self._client)

    async def _resolve_account_id(self, user_id: str) -> str:
        connection_status = self._oauth.get_connection_status(user_id)
        if connection_status.get("connected") and connection_status.get("provider") == "unipile":
            if await self._oauth.try_sync_unipile_accounts(user_id):
                connection_status = self._oauth.get_connection_status(user_id)

        if not connection_status.get("connected"):
            raise LinkedInNotConnectedError(
                "LinkedIn account not connected. Connect your personal LinkedIn profile first."
            )

        creds = self._oauth.resolve_credentials(user_id)
        account_id = creds.unipile_account_id
        if not account_id:
            raise LinkedInNotConnectedError(
                "Personal LinkedIn account not found. Reconnect your LinkedIn profile."
            )
        return account_id

    async def get_cohort_defaults(self, user_id: str) -> dict[str, Optional[str]]:
        """Return auto-detected cohort ids from the connected LinkedIn profile."""
        account_id = await self._resolve_account_id(user_id)
        return await self._cohort_resolver.fetch_defaults(account_id)

    async def get_suggestions(
        self,
        user_id: str,
        *,
        cohort: PymkCohort = PymkCohort.RECENT_ACTIVITY,
        page_start: int = 0,
        page_size: int = 10,
        cohort_id: Optional[str] = None,
    ) -> PymkListResponse:
        """Fetch PYMK suggestions for the given cohort."""
        logger.info(
            "[PymkService] get_suggestions user_id={} cohort={} page_start={} page_size={} cohort_id={}",
            user_id,
            cohort.value,
            page_start,
            page_size,
            cohort_id,
        )

        account_id = await self._resolve_account_id(user_id)
        logger.debug("[PymkService] Resolved account_id={} for user_id={}", account_id, user_id)

        resolved_cohort_id = await self._cohort_resolver.resolve(account_id, cohort, cohort_id)
        logger.debug(
            "[PymkService] Resolved cohort_id={} for cohort={}",
            resolved_cohort_id,
            cohort.value,
        )

        if cohort != PymkCohort.RECENT_ACTIVITY and not resolved_cohort_id:
            error_msg = _COHORT_ID_ERRORS.get(cohort, "cohort_id is required for this filter")
            logger.warning(
                "[PymkService] Missing cohort_id for cohort={} user_id={}",
                cohort.value,
                user_id,
            )
            raise ValueError(error_msg)

        request_body = build_pymk_unipile_request(
            account_id,
            cohort,
            page_start=page_start,
            page_size=page_size,
            cohort_id=resolved_cohort_id,
        )
        logger.debug(
            "[PymkService] Unipile request body for cohort={}: {}",
            cohort.value,
            request_body,
        )

        try:
            raw = await self._client.linkedin_raw_data(request_body)
            logger.debug(
                "[PymkService] Unipile response received for cohort={} page_start={}",
                cohort.value,
                page_start,
            )
        except UnipileAPIError as exc:
            logger.error(
                "[PymkService] Unipile API error user_id={} cohort={} status={}: {}",
                user_id,
                cohort.value,
                exc.status_code,
                exc,
            )
            if exc.status_code == 401:
                raise PymkServiceError(
                    "LinkedIn authentication failed. Your session may have expired. "
                    "Please reconnect your LinkedIn account in Settings."
                ) from exc
            if exc.status_code == 404:
                raise PymkServiceError(
                    "LinkedIn did not return suggestions for this cohort. "
                    "Verify the cohort ID or try Recent activity."
                ) from exc
            if exc.status_code == 429:
                raise PymkServiceError(
                    "LinkedIn rate limit reached. Too many requests. "
                    "Please wait a few minutes and try again."
                ) from exc
            raise PymkServiceError(
                f"LinkedIn API error (status {exc.status_code}): {exc}"
            ) from exc

        parsed = parse_pymk_response(
            raw,
            cohort=cohort,
            page_start=page_start,
            page_size=page_size,
        )
        suggestions = parsed["suggestions"]
        logger.info(
            "[PymkService] Parsed {} suggestions from cohort={} page_start={}",
            len(suggestions),
            cohort.value,
            page_start,
        )

        if not suggestions:
            logger.warning(
                "[PymkService] No suggestions found for cohort={} page_start={}. "
                "LinkedIn may have no more results or the response format changed.",
                cohort.value,
                page_start,
            )

        # Log enrichment needs
        missing_photos = sum(1 for s in suggestions if not s.get("photo_url"))
        if missing_photos:
            logger.debug(
                "[PymkService] {} of {} suggestions missing photo_url, enriching...",
                missing_photos,
                len(suggestions),
            )

        await self._profile_enricher.enrich_suggestions(account_id, suggestions)

        # Log post-enrichment status
        still_missing_photos = sum(1 for s in suggestions if not s.get("photo_url"))
        if still_missing_photos:
            logger.warning(
                "[PymkService] {} of {} suggestions still missing photo_url after enrichment",
                still_missing_photos,
                len(suggestions),
            )

        items = [PymkSuggestionItem(**item) for item in suggestions]
        logger.info(
            "[PymkService] Returning {} suggestions cohort={} has_more={}",
            len(items),
            cohort.value,
            parsed["has_more"],
        )

        return PymkListResponse(
            cohort=parsed["cohort"],
            cohort_label=parsed["cohort_label"],
            suggestions=items,
            page_start=parsed["page_start"],
            page_size=parsed["page_size"],
            has_more=parsed["has_more"],
            fetched_at=datetime.now(timezone.utc),
        )


_pymk_service: Optional[PymkService] = None


def get_pymk_service() -> PymkService:
    """Return singleton PymkService instance."""
    global _pymk_service
    if _pymk_service is None:
        _pymk_service = PymkService()
    return _pymk_service
