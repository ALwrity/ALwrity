"""Resolve PYMK cohort IDs (school, job title, industry) from LinkedIn profile data."""

from __future__ import annotations

import json
import re
from typing import Any, Optional

from loguru import logger

from services.integrations.linkedin.pymk_industry_lookup import (
    PymkIndustryIdLookup,
    industry_name_candidates_from_profile,
)
from services.integrations.linkedin.pymk_types import PymkCohort
from services.integrations.linkedin.unipile_client import (
    UnipileAPIError,
    UnipileClient,
    personal_profile_provider_id_from_owner,
)

_INDUSTRY_ID_PATTERN = re.compile(r"urn:li:industry:(\d+)")
_SCHOOL_ID_PATTERN = re.compile(r"urn:li:(?:fsd_)?school:(\d+)")
_SUPER_TITLE_PATTERN = re.compile(r'"superTitleId"\s*:\s*"?(\d+)"?')


def _walk_values(obj: Any):
    """Yield all nested values in a JSON-like structure."""
    if isinstance(obj, dict):
        for key, value in obj.items():
            yield key, value
            yield from _walk_values(value)
    elif isinstance(obj, list):
        for item in obj:
            yield from _walk_values(item)


def _find_key_int(obj: Any, *keys: str) -> Optional[str]:
    """Find first matching integer-like key in nested dicts."""
    if isinstance(obj, dict):
        for key in keys:
            if key in obj and obj[key] is not None:
                raw = obj[key]
                if isinstance(raw, (int, float)):
                    return str(int(raw))
                if isinstance(raw, str) and raw.strip().isdigit():
                    return raw.strip()
        for value in obj.values():
            found = _find_key_int(value, *keys)
            if found:
                return found
    elif isinstance(obj, list):
        for item in obj:
            found = _find_key_int(item, *keys)
            if found:
                return found
    return None


def _find_urn_id(obj: Any, pattern: re.Pattern[str]) -> Optional[str]:
    """Scan nested strings for a LinkedIn URN numeric id."""
    if isinstance(obj, str):
        match = pattern.search(obj)
        return match.group(1) if match else None
    if isinstance(obj, dict):
        for value in obj.values():
            found = _find_urn_id(value, pattern)
            if found:
                return found
    elif isinstance(obj, list):
        for item in obj:
            found = _find_urn_id(item, pattern)
            if found:
                return found
    return None


def extract_cohort_ids_from_profile(profile: dict[str, Any]) -> dict[str, Optional[str]]:
    """Extract PYMK cohort ids from a Unipile UserProfile payload."""
    school_id = _find_key_int(profile, "school_id", "schoolId")
    if not school_id:
        school_id = _find_urn_id(profile, _SCHOOL_ID_PATTERN)

    education = profile.get("education")
    if not school_id and isinstance(education, list):
        for item in education:
            if not isinstance(item, dict):
                continue
            school_id = _find_key_int(item, "school_id", "schoolId") or _find_urn_id(
                item, _SCHOOL_ID_PATTERN
            )
            if not school_id:
                edu_id = item.get("id")
                if isinstance(edu_id, (str, int)) and str(edu_id).strip().isdigit():
                    school_id = str(edu_id).strip()
            if school_id:
                break

    industry_id = _find_key_int(profile, "industry_id", "industryId")
    if not industry_id:
        industry_id = _find_urn_id(profile, _INDUSTRY_ID_PATTERN)

    super_title_id = _find_key_int(profile, "super_title_id", "superTitleId")
    if not super_title_id:
        blob = json.dumps(profile, default=str)
        match = _SUPER_TITLE_PATTERN.search(blob)
        if match:
            super_title_id = match.group(1)

    return {
        "school_id": school_id,
        "industry_id": industry_id,
        "super_title_id": super_title_id,
    }


class PymkCohortResolver:
    """Resolve cohort ids using the connected member's LinkedIn profile."""

    def __init__(self, client: Optional[UnipileClient] = None) -> None:
        self._client = client or UnipileClient()
        self._industry_lookup = PymkIndustryIdLookup(self._client)
        self._defaults_cache: dict[str, dict[str, Optional[str]]] = {}

    async def _load_member_profile(self, account_id: str) -> dict[str, Any]:
        """Fetch the connected member's section-rich UserProfile."""
        try:
            owner = await self._client.get_own_profile(account_id)
        except UnipileAPIError as exc:
            logger.warning("[PymkCohortResolver] get_own_profile failed: {}", exc)
            return {}

        identifier = personal_profile_provider_id_from_owner(owner) or owner.get(
            "public_identifier"
        )
        if not identifier:
            logger.warning("[PymkCohortResolver] no profile identifier on owner profile")
            return owner if isinstance(owner, dict) else {}

        try:
            profile = await self._client.get_user_profile(
                account_id,
                str(identifier),
                linkedin_sections="*",
                notify=False,
            )
            return profile if isinstance(profile, dict) else {}
        except UnipileAPIError as exc:
            logger.warning("[PymkCohortResolver] get_user_profile failed: {}", exc)
            return owner if isinstance(owner, dict) else {}

    async def fetch_defaults(self, account_id: str) -> dict[str, Optional[str]]:
        """Return best-effort cohort ids for school, industry, and job title."""
        cached = self._defaults_cache.get(account_id)
        if cached is not None:
            return dict(cached)

        logger.info("[PymkCohortResolver] fetch_defaults account_id={}", account_id)
        profile = await self._load_member_profile(account_id)
        if not profile:
            return {
                "school_id": None,
                "industry_id": None,
                "industry_name": None,
                "super_title_id": None,
            }

        defaults = extract_cohort_ids_from_profile(profile)
        industry_name: Optional[str] = None

        if not defaults.get("industry_id"):
            industry_name, industry_id = await self._industry_lookup.resolve_for_profile(
                account_id,
                profile,
            )
            if industry_id:
                defaults["industry_id"] = industry_id
        else:
            names = industry_name_candidates_from_profile(profile)
            industry_name = names[0] if names else None

        defaults["industry_name"] = industry_name
        logger.info("[PymkCohortResolver] resolved defaults={}", defaults)
        self._defaults_cache[account_id] = dict(defaults)
        return defaults

    async def resolve(
        self,
        account_id: str,
        cohort: PymkCohort,
        cohort_id: Optional[str],
    ) -> Optional[str]:
        """Return explicit or auto-resolved cohort id."""
        if cohort_id and cohort_id.strip():
            return cohort_id.strip()

        if cohort == PymkCohort.RECENT_ACTIVITY:
            return None

        defaults = await self.fetch_defaults(account_id)
        if cohort == PymkCohort.SAME_SCHOOL:
            return defaults.get("school_id")
        if cohort == PymkCohort.SAME_JOB:
            return defaults.get("super_title_id")
        if cohort == PymkCohort.SAME_INDUSTRY:
            return defaults.get("industry_id")
        return None
