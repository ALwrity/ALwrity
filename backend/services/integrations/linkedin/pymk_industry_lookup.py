"""Resolve LinkedIn numeric industry IDs for PYMK same-industry cohort."""

from __future__ import annotations

import json
import re
from collections import OrderedDict
from typing import Any, Optional
from urllib.parse import quote

from loguru import logger

from services.integrations.linkedin.unipile_client import UnipileAPIError, UnipileClient

_INDUSTRY_URN_PATTERN = re.compile(r"urn:li:industry:(\d+)")
_INDUSTRY_ID_JSON_PATTERN = re.compile(r'"industryId"\s*:\s*"?(\d+)"?')
_CACHE_MAX = 200

_TYPEAHEAD_URL_TEMPLATES = (
    "https://www.linkedin.com/voyager/api/typeahead/hitsV2?keywords={query}&origin=INDUSTRY&q=type",
    "https://www.linkedin.com/voyager/api/typeahead/hits?types=List(INDUSTRY)&q={query}",
)


def _is_current_job(item: dict[str, Any]) -> bool:
    if item.get("current") is True:
        return True
    end = item.get("end")
    return end in (None, "", "null")


def current_work_experience(profile: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Return the member's current (or most recent) work experience entry."""
    items = profile.get("work_experience")
    if not isinstance(items, list):
        return None

    for item in items:
        if isinstance(item, dict) and _is_current_job(item):
            return item

    for item in items:
        if isinstance(item, dict):
            return item
    return None


def company_identifiers_from_job(job: dict[str, Any]) -> list[str]:
    """Build ordered company identifiers for Unipile company profile lookup."""
    identifiers: list[str] = []

    company_id = job.get("company_id")
    if isinstance(company_id, str) and company_id.strip():
        identifiers.append(company_id.strip())

    company_url = job.get("company_url")
    if isinstance(company_url, str) and "/company/" in company_url:
        slug = company_url.rstrip("/").split("/company/")[-1].split("?")[0].strip("/")
        if slug and slug not in identifiers:
            identifiers.append(slug)

    company_name = job.get("company")
    if isinstance(company_name, str) and company_name.strip():
        raw = company_name.strip()
        slug = raw.lower().replace(" ", "-")
        for candidate in (slug, raw):
            if candidate not in identifiers:
                identifiers.append(candidate)

    return identifiers


def industry_name_candidates_from_profile(profile: dict[str, Any]) -> list[str]:
    """Collect human-readable industry labels from a Unipile UserProfile."""
    names: list[str] = []

    for key in ("industry", "industries"):
        value = profile.get(key)
        if isinstance(value, str) and value.strip():
            names.append(value.strip())
        elif isinstance(value, list):
            for entry in value:
                if isinstance(entry, str) and entry.strip():
                    names.append(entry.strip())

    work_items = profile.get("work_experience")
    if isinstance(work_items, list):
        for item in work_items:
            if not isinstance(item, dict):
                continue
            industries = item.get("industry")
            if isinstance(industries, list):
                for entry in industries:
                    if isinstance(entry, str) and entry.strip():
                        names.append(entry.strip())

    deduped: list[str] = []
    seen: set[str] = set()
    for name in names:
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(name)
    return deduped


def extract_industry_ids_from_linkedin_raw(raw: dict[str, Any]) -> list[str]:
    """Parse numeric industry ids from a Unipile LinkedinRawData or JSON payload."""
    if isinstance(raw.get("data"), str):
        blob = raw["data"]
    else:
        blob = json.dumps(raw, default=str)

    ids = _INDUSTRY_URN_PATTERN.findall(blob)
    if ids:
        return ids
    return _INDUSTRY_ID_JSON_PATTERN.findall(blob)


class PymkIndustryIdLookup:
    """
    Resolve LinkedIn PYMK ``industryId`` values for the connected member.

    Strategy:
    1. Use industry labels already present on the UserProfile / work history.
    2. Fetch the current employer company profile via Unipile when needed.
    3. Map the industry label to a numeric id using LinkedIn's industry typeahead.
    """

    def __init__(self, client: UnipileClient) -> None:
        self._client = client
        self._cache: OrderedDict[str, tuple[Optional[str], Optional[str]]] = OrderedDict()

    def _cache_get(self, cache_key: str) -> Optional[tuple[Optional[str], Optional[str]]]:
        value = self._cache.get(cache_key)
        if value is not None:
            self._cache.move_to_end(cache_key)
        return value

    def _cache_set(self, cache_key: str, industry_name: Optional[str], industry_id: Optional[str]) -> None:
        self._cache[cache_key] = (industry_name, industry_id)
        self._cache.move_to_end(cache_key)
        while len(self._cache) > _CACHE_MAX:
            self._cache.popitem(last=False)

    async def resolve_for_profile(
        self,
        account_id: str,
        profile: dict[str, Any],
    ) -> tuple[Optional[str], Optional[str]]:
        """
        Return ``(industry_name, industry_id)`` for PYMK same-industry cohort.

        ``industry_id`` is the numeric LinkedIn id required by the PYMK payload.
        """
        cache_key = f"{account_id}:{profile.get('provider_id') or profile.get('public_identifier') or 'self'}"
        cached = self._cache_get(cache_key)
        if cached is not None:
            return cached

        direct_id, direct_name = await self._industry_from_current_company(account_id, profile)
        if direct_id:
            self._cache_set(cache_key, direct_name, direct_id)
            return direct_name, direct_id

        candidates = industry_name_candidates_from_profile(profile)
        if not candidates:
            candidates = await self._industry_names_from_current_company(account_id, profile)

        industry_id: Optional[str] = None
        resolved_name: Optional[str] = None

        for name in candidates:
            industry_id = await self._lookup_industry_id_by_name(account_id, name)
            if industry_id:
                resolved_name = name
                break

        self._cache_set(cache_key, resolved_name, industry_id)
        logger.info(
            "[PymkIndustryLookup] resolved name={} industry_id={} account_id={}",
            resolved_name,
            industry_id,
            account_id,
        )
        return resolved_name, industry_id

    async def _industry_from_current_company(
        self,
        account_id: str,
        profile: dict[str, Any],
    ) -> tuple[Optional[str], Optional[str]]:
        """Try to read a numeric industry id directly from the current employer company."""
        job = current_work_experience(profile)
        if not job:
            return None, None

        for identifier in company_identifiers_from_job(job):
            try:
                company = await self._client.get_company_profile(account_id, identifier)
            except UnipileAPIError as exc:
                logger.debug(
                    "[PymkIndustryLookup] company profile failed identifier={}: {}",
                    identifier,
                    exc,
                )
                continue

            urn_ids = extract_industry_ids_from_linkedin_raw(company)
            industries = company.get("industry")
            label = None
            if isinstance(industries, list) and industries:
                label = industries[0] if isinstance(industries[0], str) else None

            if urn_ids:
                logger.info(
                    "[PymkIndustryLookup] company={} industry_id_from_urn={}",
                    identifier,
                    urn_ids[0],
                )
                return label, urn_ids[0]

        return None, None

    async def _industry_names_from_current_company(
        self,
        account_id: str,
        profile: dict[str, Any],
    ) -> list[str]:
        job = current_work_experience(profile)
        if not job:
            logger.debug("[PymkIndustryLookup] no work experience on profile")
            return []

        for identifier in company_identifiers_from_job(job):
            try:
                company = await self._client.get_company_profile(account_id, identifier)
            except UnipileAPIError as exc:
                logger.debug(
                    "[PymkIndustryLookup] company profile failed identifier={}: {}",
                    identifier,
                    exc,
                )
                continue

            industries = company.get("industry")
            if isinstance(industries, list):
                names = [entry.strip() for entry in industries if isinstance(entry, str) and entry.strip()]
                if names:
                    logger.info(
                        "[PymkIndustryLookup] company={} industries={}",
                        identifier,
                        names[:3],
                    )
                    return names

        return []

    async def _lookup_industry_id_by_name(self, account_id: str, industry_name: str) -> Optional[str]:
        name_key = industry_name.strip().lower()
        cache_key = f"typeahead:{account_id}:{name_key}"
        cached = self._cache_get(cache_key)
        if cached is not None:
            return cached[1]

        encoded = quote(industry_name.strip())
        for template in _TYPEAHEAD_URL_TEMPLATES:
            request_url = template.format(query=encoded)
            try:
                raw = await self._client.linkedin_raw_data(
                    {
                        "account_id": account_id,
                        "request_url": request_url,
                        "method": "GET",
                        "encoding": False,
                    }
                )
            except UnipileAPIError as exc:
                logger.debug(
                    "[PymkIndustryLookup] typeahead failed name={} url={}: {}",
                    industry_name,
                    request_url[:80],
                    exc,
                )
                continue

            ids = extract_industry_ids_from_linkedin_raw(raw)
            if ids:
                industry_id = ids[0]
                self._cache_set(cache_key, industry_name, industry_id)
                logger.info(
                    "[PymkIndustryLookup] typeahead matched name={} industry_id={}",
                    industry_name,
                    industry_id,
                )
                return industry_id

        self._cache_set(cache_key, industry_name, None)
        return None
