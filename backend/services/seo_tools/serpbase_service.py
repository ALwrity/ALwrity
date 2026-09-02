"""SerpBaseService — optional Google SERP provider for ALwrity.

Mirrors GoogleSearchService's result contract (list of dicts with
title/link/snippet) so SerpGapService can consume it unchanged. Opt-in via
SERPBASE_API_KEY; when the key is unset the service is disabled and callers
raise the same kind of error they already handle for missing CSE keys, so
existing behavior is unchanged.
"""

import os
import json
import asyncio
import aiohttp
from typing import Dict, List, Optional, Any
from loguru import logger

# One session shared across requests: aiohttp.ClientSession() pools
# connections, so creating one per request would destroy pooling and risk
# socket exhaustion under gap-analysis concurrency (see review on PR #901).
_session: Optional[aiohttp.ClientSession] = None


def _get_session() -> aiohttp.ClientSession:
    global _session
    if _session is None or _session.closed:
        _session = aiohttp.ClientSession()
    return _session


class SerpBaseService:
    """Google SERP results via the SerpBase API (https://serpbase.dev).

    Only active when SERPBASE_API_KEY is set. Returns results shaped like
    GoogleSearchService.perform_search output so downstream code (SerpGapService,
    keyword research) works unchanged.
    """

    # Base URL overridable via env for tests/proxies; defaults to the
    # live SerpBase endpoint (review feedback on PR #901).
    DEFAULT_BASE_URL = os.getenv("SERPBASE_BASE_URL", "https://api.serpbase.dev/google/search")
    # aiohttp's default timeout is 5 minutes, which can hang async tasks if
    # the external API stalls — enforce a strict ceiling.
    REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=10)

    def __init__(self) -> None:
        self.api_key = os.getenv("SERPBASE_API_KEY", "")
        self.base_url = self.DEFAULT_BASE_URL
        self.enabled = bool(self.api_key)
        if self.enabled:
            logger.info("SerpBase Service initialized (SERPBASE_API_KEY set)")
        else:
            logger.info("SerpBase Service disabled (SERPBASE_API_KEY not set)")

    async def perform_search(
        self, query: str, max_results: int = 10, **overrides: Any
    ) -> List[Dict[str, Any]]:
        """Run a Google search through SerpBase and return items as dicts.

        Accepts and ignores the CSE-specific overrides (dateRestrict, sort)
        so it can be swapped in where GoogleSearchService.perform_search is
        called. Results carry title/link/snippet, plus position when present.
        """
        if not self.enabled:
            raise RuntimeError(
                "SerpBase Service is not enabled. Set SERPBASE_API_KEY."
            )

        payload: Dict[str, Any] = {
            "q": query,
            "num": min(max_results, 10),
            "hl": overrides.get("hl", "en"),
            "gl": overrides.get("gl", "us"),
        }
        # CSE-only params (dateRestrict/sort/safe/cx/key) are intentionally
        # not forwarded to SerpBase.

        headers = {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json",
        }

        session = _get_session()
        try:
            async with session.post(
                self.base_url, json=payload, headers=headers, timeout=self.REQUEST_TIMEOUT
            ) as response:
                # Non-2xx may carry an HTML error body (e.g. 502 from a
                # gateway proxy) — read text first and surface it rather than
                # letting response.json() raise an unhandled ContentTypeError.
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(
                        f"SerpBase API error: {response.status} - {error_text[:500]}"
                    )
                    raise RuntimeError(
                        f"SerpBase API returned status {response.status}"
                    )
                try:
                    data = await response.json(content_type=None)
                except (aiohttp.ContentTypeError, json.JSONDecodeError) as e:
                    logger.error(f"SerpBase API returned non-JSON body: {e}")
                    raise RuntimeError("SerpBase API returned a non-JSON response")
        except (aiohttp.ClientError, asyncio.TimeoutError) as e:
            logger.warning(f"SerpBase request failed: {e}")
            raise

        # Envelope: HTTP 200 with status != 0 means a business error.
        if isinstance(data, dict) and data.get("status", 0) != 0:
            logger.error(f"SerpBase API business error: {data}")
            raise RuntimeError(
                f"SerpBase API error: {data.get('message', 'unknown')}"
            )

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
                    "link": r.get("link") or r.get("url", ""),
                    "snippet": r.get("snippet", ""),
                    "position": r.get("position", idx + 1),
                }
            )
        return items
