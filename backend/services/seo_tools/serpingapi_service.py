"""SerpingApiService — optional Google SERP provider for ALwrity.

Mirrors GoogleSearchService's result contract (list of dicts with
title/link/snippet) so SerpGapService can consume it unchanged, following the
pattern established by SerpBaseService (PR #901). Opt-in via
SERPINGAPI_API_KEY; when the key is unset the service is disabled and callers
raise the same kind of error they already handle for missing CSE keys, so
existing behavior is unchanged.
"""

import os
import json
import asyncio
import aiohttp
from typing import Dict, List, Optional, Any
from loguru import logger

# One session shared across requests (connection pooling; see review on
# PR #901 for why a session per request is a problem under concurrency).
_session: Optional[aiohttp.ClientSession] = None


def _get_session() -> aiohttp.ClientSession:
    global _session
    if _session is None or _session.closed:
        _session = aiohttp.ClientSession()
    return _session


class SerpingApiService:
    """Google SERP results via the Serping API (https://serpingapi.com).

    Only active when SERPINGAPI_API_KEY is set. Returns results shaped like
    GoogleSearchService.perform_search output so downstream code (SerpGapService,
    keyword research) works unchanged.
    """

    # Base URL overridable via env for tests/proxies; defaults to the
    # live endpoint (same convention as SERPBASE_BASE_URL).
    DEFAULT_BASE_URL = os.getenv("SERPINGAPI_BASE_URL", "https://api.serpingapi.com/v1/search")
    # aiohttp's default timeout is 5 minutes — enforce a strict ceiling.
    REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=10)
    # The API accepts num 1–100; keep parity with CSE/SerpBase callers.
    MAX_NUM = 100

    def __init__(self) -> None:
        self.api_key = os.getenv("SERPINGAPI_API_KEY", "")
        self.base_url = self.DEFAULT_BASE_URL
        self.enabled = bool(self.api_key)
        if self.enabled:
            logger.info("Serping API Service initialized (SERPINGAPI_API_KEY set)")
        else:
            logger.info("Serping API Service disabled (SERPINGAPI_API_KEY not set)")

    async def perform_search(
        self, query: str, max_results: int = 10, **overrides: Any
    ) -> List[Dict[str, Any]]:
        """Run a Google search through the Serping API and return items as dicts.

        Accepts and ignores the CSE-specific overrides (dateRestrict, sort)
        so it can be swapped in where GoogleSearchService.perform_search is
        called. Results carry title/link/snippet, plus position when present.
        """
        if not self.enabled:
            raise RuntimeError(
                "Serping API Service is not enabled. Set SERPINGAPI_API_KEY."
            )

        payload: Dict[str, Any] = {
            "q": query,
            "num": max(1, min(max_results, self.MAX_NUM)),
            "hl": overrides.get("hl", "en"),
            "gl": overrides.get("gl", "us"),
        }
        # Optional Serper-style params are forwarded only when given;
        # CSE-only params (dateRestrict/sort/safe/cx/key) are not.
        for key in ("location", "page", "tbs"):
            if overrides.get(key) is not None:
                payload[key] = overrides[key]

        headers = {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json",
        }

        session = _get_session()
        try:
            async with session.post(
                self.base_url, json=payload, headers=headers, timeout=self.REQUEST_TIMEOUT
            ) as response:
                # Non-2xx: the API returns {"error": {"code", "message"}} but a
                # gateway in between may return HTML — read text first and
                # surface it rather than letting response.json() raise.
                if response.status != 200:
                    error_text = await response.text()
                    code = ""
                    try:
                        err = json.loads(error_text).get("error") or {}
                        code = err.get("code") or ""
                    except (ValueError, AttributeError):
                        pass
                    logger.error(
                        f"Serping API error: {response.status} {code} - {error_text[:500]}"
                    )
                    raise RuntimeError(
                        f"Serping API returned status {response.status}"
                        + (f" ({code})" if code else "")
                    )
                try:
                    data = await response.json(content_type=None)
                except (aiohttp.ContentTypeError, json.JSONDecodeError) as e:
                    logger.error(f"Serping API returned non-JSON body: {e}")
                    raise RuntimeError("Serping API returned a non-JSON response")
        except (aiohttp.ClientError, asyncio.TimeoutError) as e:
            logger.warning(f"Serping API request failed: {e}")
            raise

        # Defensive extraction: organic may be absent or null — treat
        # anything falsy as an empty result set instead of crashing.
        results = data.get("organic") or [] if isinstance(data, dict) else []
        items = []
        for idx, r in enumerate(results):
            if not isinstance(r, dict):
                continue
            items.append(
                {
                    "title": r.get("title", ""),
                    "link": r.get("link", ""),
                    "snippet": r.get("snippet", ""),
                    "position": r.get("position", idx + 1),
                }
            )
        return items
