"""Enrich PYMK suggestions with avatars from Unipile UserProfile API."""

from __future__ import annotations

import asyncio
from collections import OrderedDict
from typing import Any, Optional

from loguru import logger

from services.integrations.linkedin.unipile_client import (
    UnipileAPIError,
    UnipileClient,
    avatar_url_from_user_profile,
)

_CACHE_MAX_ENTRIES = 500
_DEFAULT_CONCURRENCY = 4


def public_identifier_from_profile_url(profile_url: str) -> Optional[str]:
    """Extract LinkedIn vanity slug from a profile URL."""
    if not profile_url:
        return None
    cleaned = profile_url.strip().rstrip("/")
    marker = "/in/"
    if marker not in cleaned:
        return None
    slug = cleaned.split(marker, 1)[-1].split("?")[0].strip("/")
    return slug or None


def profile_lookup_identifiers(item: dict[str, Any]) -> list[str]:
    """
    Build ordered Unipile user identifiers to try for ``GET /users/{id}``.

    Provider id (ACo...) is tried first, then the public vanity slug.
    """
    identifiers: list[str] = []
    profile_id = item.get("profile_id")
    if isinstance(profile_id, str) and profile_id.strip():
        identifiers.append(profile_id.strip())

    profile_url = item.get("profile_url")
    slug = public_identifier_from_profile_url(profile_url if isinstance(profile_url, str) else "")
    if slug and slug not in identifiers:
        identifiers.append(slug)

    return identifiers


def _needs_enrichment(item: dict[str, Any]) -> bool:
    """Return True when the profile photo is still missing after SDUI parse."""
    return not item.get("photo_url")


class PymkProfileEnricher:
    """
    Fill missing PYMK avatars (and headlines) via Unipile ``get_user_profile``.

    Uses ``notify=False`` to avoid profile-view notifications. Results are cached
    in-memory per process to limit repeat lookups across pagination and refresh.
    """

    def __init__(
        self,
        client: UnipileClient,
        *,
        max_concurrent: int = _DEFAULT_CONCURRENCY,
        cache_max_entries: int = _CACHE_MAX_ENTRIES,
    ) -> None:
        self._client = client
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._cache_max = cache_max_entries
        self._cache: OrderedDict[str, dict[str, Optional[str]]] = OrderedDict()

    def _cache_get(self, profile_id: str) -> Optional[dict[str, Optional[str]]]:
        cached = self._cache.get(profile_id)
        if cached is not None:
            self._cache.move_to_end(profile_id)
        return cached

    def _cache_set(self, profile_id: str, entry: dict[str, Optional[str]]) -> None:
        self._cache[profile_id] = entry
        self._cache.move_to_end(profile_id)
        while len(self._cache) > self._cache_max:
            self._cache.popitem(last=False)

    @staticmethod
    def _apply_profile_fields(
        item: dict[str, Any],
        *,
        photo_url: Optional[str],
        headline: Optional[str],
    ) -> None:
        if photo_url and not item.get("photo_url"):
            item["photo_url"] = photo_url
        if headline and not item.get("headline"):
            item["headline"] = headline

    async def enrich_suggestions(
        self,
        account_id: str,
        suggestions: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Enrich suggestions missing profile photos."""
        targets = [item for item in suggestions if _needs_enrichment(item)]
        if not targets:
            logger.debug("[PymkEnricher] all suggestions already have photo and headline")
            return suggestions

        logger.info(
            "[PymkEnricher] enriching {} of {} suggestions account_id={}",
            len(targets),
            len(suggestions),
            account_id,
        )

        await asyncio.gather(
            *(self._enrich_one(account_id, item) for item in targets),
            return_exceptions=True,
        )
        return suggestions

    async def _enrich_one(self, account_id: str, item: dict[str, Any]) -> None:
        profile_id = str(item.get("profile_id") or "")
        if not profile_id:
            return

        cached = self._cache_get(profile_id)
        if cached:
            self._apply_profile_fields(
                item,
                photo_url=cached.get("photo_url"),
                headline=cached.get("headline"),
            )
            if not _needs_enrichment(item):
                return

        identifiers = profile_lookup_identifiers(item)
        if not identifiers:
            logger.debug("[PymkEnricher] no lookup identifiers profile_id={}", profile_id)
            return

        async with self._semaphore:
            for identifier in identifiers:
                try:
                    profile = await self._client.get_user_profile(
                        account_id,
                        identifier,
                        notify=False,
                    )
                except UnipileAPIError as exc:
                    logger.debug(
                        "[PymkEnricher] get_user_profile failed profile_id={} identifier={}: {}",
                        profile_id,
                        identifier,
                        exc,
                    )
                    continue

                if not isinstance(profile, dict):
                    continue

                photo_url = avatar_url_from_user_profile(profile)
                headline_raw = profile.get("headline")
                headline = headline_raw.strip() if isinstance(headline_raw, str) else None

                if not photo_url and not headline:
                    continue

                entry = {
                    "photo_url": photo_url,
                    "headline": headline,
                }
                self._cache_set(profile_id, entry)
                self._apply_profile_fields(item, photo_url=photo_url, headline=headline)

                logger.info(
                    "[PymkEnricher] enriched profile_id={} identifier={} photo={} headline={}",
                    profile_id,
                    identifier,
                    bool(photo_url),
                    bool(headline),
                )
                return

        logger.debug("[PymkEnricher] no UserProfile data for profile_id={}", profile_id)
