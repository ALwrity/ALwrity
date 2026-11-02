"""OutcrawlService: optional web search provider for ALwrity.

Mirrors GoogleSearchService's result contract (list of dicts with
title/link/snippet) so SerpGapService can consume it unchanged. Opt-in via
OUTCRAWL_API_KEY; when the key is unset the service is disabled and callers
keep their existing provider, so existing behavior is unchanged.
"""

import os
import json
import asyncio
import aiohttp
from typing import Dict, List, Optional, Any
from loguru import logger

# One session shared across requests: aiohttp.ClientSession() pools
# connections, so creating one per request would destroy pooling and risk
# socket exhaustion under gap-analysis concurrency (same as SerpBaseService).
_session: Optional[aiohttp.ClientSession] = None


def _get_session() -> aiohttp.ClientSession:
    global _session
    if _session is None or _session.closed:
        _session = aiohttp.ClientSession()
    return _session


class OutcrawlService:
    """Web search results via the Outcrawl API (https://outcrawl.ai).

    Only active when OUTCRAWL_API_KEY is set. Returns results shaped like
    GoogleSearchService.perform_search output so downstream code (SerpGapService,
    keyword research) works unchanged.
    """

    # Base URL overridable via env for tests/proxies; defaults to the
    # live Outcrawl search endpoint.
    DEFAULT_BASE_URL = os.getenv(
        "OUTCRAWL_BASE_URL", "https://api.outcrawl.ai/v1/search"
    )
    # aiohttp's default timeout is 5 minutes, which can hang async tasks if
    # the external API stalls, so enforce a strict ceiling.
    REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=30)
    # The search endpoint accepts a limit between 1 and 20.
    MAX_LIMIT = 20

    def __init__(self) -> None:
        self.api_key = os.getenv("OUTCRAWL_API_KEY", "")
        self.base_url = self.DEFAULT_BASE_URL
        self.enabled = bool(self.api_key)
        if self.enabled:
            logger.info("Outcrawl Service initialized (OUTCRAWL_API_KEY set)")
        else:
            logger.info("Outcrawl Service disabled (OUTCRAWL_API_KEY not set)")

    async def perform_search(
        self, query: str, max_results: int = 10, **overrides: Any
    ) -> List[Dict[str, Any]]:
        """Run a web search through Outcrawl and return items as dicts.

        Accepts and ignores the CSE-specific overrides (dateRestrict, sort)
        so it can be swapped in where GoogleSearchService.perform_search is
        called. Results carry title/link/snippet, plus position.
        """
        if not self.enabled:
            raise RuntimeError("Outcrawl Service is not enabled. Set OUTCRAWL_API_KEY.")

        payload: Dict[str, Any] = {
            "query": query,
            "limit": max(1, min(max_results, self.MAX_LIMIT)),
        }
        # CSE-only params (dateRestrict/sort/safe/cx/key) are intentionally
        # not forwarded to Outcrawl.

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        session = _get_session()
        try:
            async with session.post(
                self.base_url,
                json=payload,
                headers=headers,
                timeout=self.REQUEST_TIMEOUT,
            ) as response:
                # Non-2xx may carry an HTML error body (e.g. 502 from a
                # gateway proxy), so read text first and surface it rather than
                # letting response.json() raise an unhandled ContentTypeError.
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(
                        f"Outcrawl API error: {response.status} - {error_text[:500]}"
                    )
                    raise RuntimeError(
                        f"Outcrawl API returned status {response.status}"
                    )
                try:
                    data = await response.json(content_type=None)
                except (aiohttp.ContentTypeError, json.JSONDecodeError) as e:
                    logger.error(f"Outcrawl API returned non-JSON body: {e}")
                    raise RuntimeError("Outcrawl API returned a non-JSON response")
        except (aiohttp.ClientError, asyncio.TimeoutError) as e:
            logger.warning(f"Outcrawl request failed: {e}")
            raise

        # Defensive extraction: hits may be absent or null, so treat
        # anything falsy as an empty result set instead of crashing.
        results = data.get("hits") or [] if isinstance(data, dict) else []
        items = []
        for idx, r in enumerate(results):
            if not isinstance(r, dict):
                continue
            items.append(
                {
                    "title": r.get("title", ""),
                    "link": r.get("url", ""),
                    "snippet": r.get("snippet", ""),
                    "position": r.get("rank", idx + 1),
                }
            )
        return items
