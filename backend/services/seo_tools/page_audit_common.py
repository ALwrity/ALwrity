"""Shared page-fetch seam for single-page SEO audits (Phase 2B dedupe).

OnPageSEOService and TechnicalSEOService previously each opened raw
aiohttp sessions with slightly different headers/timeouts. All fetching
now funnels through here; scoring and output shapes stay in each service
(verified by golden tests), so callers see zero behavior change.

Fail-fast: transport errors and non-200 statuses are returned explicitly
as (html=None, status, load_time) — never swallowed, never mocked.
"""

import time
from typing import Optional, Tuple

import aiohttp
from loguru import logger

SHARED_USER_AGENT = "Mozilla/5.0 (compatible; ALwritySEO/1.0; +https://alwrity.com)"


def normalize_url(url: str) -> str:
    """Ensure a URL carries a scheme. Raises ValueError on empty input."""
    if not url or not url.strip():
        raise ValueError("URL is required for page audit")
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


async def fetch_page(url: str, timeout: int = 10) -> Tuple[Optional[str], int, float]:
    """Fetch a page, returning (html_or_None, http_status, load_seconds).

    Never raises for transport/HTTP issues — callers map (None, status)
    to their own error shapes. Programming errors (bad URL) raise fast.
    """
    url = normalize_url(url)
    start = time.time()
    try:
        async with aiohttp.ClientSession(
            headers={"User-Agent": SHARED_USER_AGENT}
        ) as session:
            async with session.get(url, timeout=timeout) as response:
                load_time = time.time() - start
                if response.status == 200:
                    return await response.text(), 200, load_time
                logger.warning(f"Page fetch non-200: {url} -> {response.status}")
                return None, response.status, load_time
    except Exception as e:
        load_time = time.time() - start
        logger.error(f"Page fetch failed: {url}: {e}")
        return None, 500, load_time
