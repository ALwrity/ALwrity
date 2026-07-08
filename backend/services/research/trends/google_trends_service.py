"""
Google Trends Service

Provides Google Trends data integration for the Research Engine.
Handles rate limiting, caching, error handling, and data serialization.

Key design decisions:
- Monkey-patches urllib3 Retry to fix method_whitelist→allowed_methods (urllib3 2.x)
- Monkey-patches pytrends related_topics/related_queries to catch IndexError bug
- Uses TrendReq built-in retries (3 retries, 1s backoff) for automatic 429 handling
- Random user-agent rotation per instance to reduce fingerprinting
- 1-second delays between sequential requests to respect rate limits
- 24-hour in-memory cache to avoid redundant API calls

Author: ALwrity Team
Version: 2.0
"""

import asyncio
import random
import time
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from loguru import logger
import pandas as pd

# ---------------------------------------------------------------------------
# Monkey-patches: fix compatibility issues before importing/using pytrends
# ---------------------------------------------------------------------------

# Patch 1: urllib3 2.x renamed Retry's `method_whitelist` to `allowed_methods`.
# pytrends 4.9.2 still uses `method_whitelist`, which crashes with urllib3 2.x.
# We patch Retry.__init__ to accept `method_whitelist` and remap it.
try:
    from urllib3.util.retry import Retry as _OrigRetry

    _orig_retry_init = _OrigRetry.__init__

    def _patched_retry_init(self, *args, **kwargs):
        if 'method_whitelist' in kwargs and 'allowed_methods' not in kwargs:
            kwargs['allowed_methods'] = kwargs.pop('method_whitelist')
        _orig_retry_init(self, *args, **kwargs)

    _OrigRetry.__init__ = _patched_retry_init
    logger.debug("[Trends] Patched urllib3 Retry.__init__ for method_whitelist→allowed_methods")
except Exception as _patch_err:
    logger.warning(f"[Trends] Could not patch urllib3 Retry: {_patch_err}")

# Now safe to import pytrends
try:
    from pytrends.request import TrendReq as _TrendReq
    from pytrends.exceptions import TooManyRequestsError as _TooManyRequestsError
    PYTrends_AVAILABLE = True
except ImportError:
    PYTrends_AVAILABLE = False
    _TooManyRequestsError = None
    _TrendReq = Any
    logger.warning("pytrends not installed. Google Trends features will be unavailable.")

# Patch 2: pytrends related_topics() and related_queries() use keyword[0]
# which raises IndexError on empty lists, but only catch KeyError.
# We fix this by catching (KeyError, IndexError) for the keyword extraction.
if PYTrends_AVAILABLE:
    import json as _json
    import pandas as _pd

    def _fixed_related_topics(self):
        result_dict = {}
        related_payload = {}
        for request_json in self.related_topics_widget_list:
            try:
                kw = request_json['request']['restriction'][
                    'complexKeywordsRestriction']['keyword'][0]['value']
            except (KeyError, IndexError):
                kw = ''
            related_payload['req'] = _json.dumps(request_json['request'])
            related_payload['token'] = request_json['token']
            related_payload['tz'] = self.tz
            req_json = self._get_data(
                url=_TrendReq.RELATED_QUERIES_URL,
                method=_TrendReq.GET_METHOD,
                trim_chars=5,
                params=related_payload,
            )
            try:
                top_list = req_json['default']['rankedList'][0]['rankedKeyword']
                df_top = _pd.json_normalize(top_list, sep='_')
            except (KeyError, IndexError):
                df_top = None
            try:
                rising_list = req_json['default']['rankedList'][1]['rankedKeyword']
                df_rising = _pd.json_normalize(rising_list, sep='_')
            except (KeyError, IndexError):
                df_rising = None
            result_dict[kw] = {'rising': df_rising, 'top': df_top}
        return result_dict

    def _fixed_related_queries(self):
        result_dict = {}
        related_payload = {}
        for request_json in self.related_queries_widget_list:
            try:
                kw = request_json['request']['restriction'][
                    'complexKeywordsRestriction']['keyword'][0]['value']
            except (KeyError, IndexError):
                kw = ''
            related_payload['req'] = _json.dumps(request_json['request'])
            related_payload['token'] = request_json['token']
            related_payload['tz'] = self.tz
            req_json = self._get_data(
                url=_TrendReq.RELATED_QUERIES_URL,
                method=_TrendReq.GET_METHOD,
                trim_chars=5,
                params=related_payload,
            )
            try:
                top_df = _pd.DataFrame(
                    req_json['default']['rankedList'][0]['rankedKeyword'])
                top_df = top_df[['query', 'value']]
            except (KeyError, IndexError):
                top_df = None
            try:
                rising_df = _pd.DataFrame(
                    req_json['default']['rankedList'][1]['rankedKeyword'])
                rising_df = rising_df[['query', 'value']]
            except (KeyError, IndexError):
                rising_df = None
            result_dict[kw] = {'top': top_df, 'rising': rising_df}
        return result_dict

    _TrendReq.related_topics = _fixed_related_topics
    _TrendReq.related_queries = _fixed_related_queries
    logger.debug("[Trends] Patched TrendReq.related_topics/related_queries for IndexError")

from .rate_limiter import RateLimiter


class GoogleTrendsService:
    """
    Service for fetching and analyzing Google Trends data.

    Uses TrendReq with no retries (fail-fast) to avoid hitting CAPTCHA on blocks.
    429 retry handling (1s, 2s, 4s backoff). Random user-agent is set
    per instance to reduce fingerprinting.

    Rate limiter is shared across all instances to enforce global rate limiting.
    """

    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
    ]

    # Class-level shared resources (shared across all instances)
    _shared_rate_limiter = None
    _shared_cache = None
    _cache_ttl = timedelta(hours=24)
    _last_429_time = 0  # Timestamp of last 429 error (Unix epoch)
    _429_cooldown_period = 1800  # 30 minutes cooldown after 429

    def __init__(self):
        if not PYTrends_AVAILABLE:
            raise RuntimeError("pytrends library is required. Install with: pip install pytrends")

        # Initialize shared rate limiter at class level (lazy init)
        if self.__class__._shared_rate_limiter is None:
            self.__class__._shared_rate_limiter = RateLimiter(max_calls=1, period=3.0)  # 1 call per 3 seconds
        if self.__class__._shared_cache is None:
            self.__class__._shared_cache = {}

        self.rate_limiter = self.__class__._shared_rate_limiter
        self.cache = self.__class__._shared_cache
        self.cache_ttl = self._cache_ttl

        logger.info("GoogleTrendsService initialized (pytrends 4.9.2, shared rate limiter, 3s period, shared cache, 30min 429 cooldown)")

    # -----------------------------------------------------------------------
    # Public API
    # -----------------------------------------------------------------------

    async def analyze_trends(
        self,
        keywords: List[str],
        timeframe: str = "today 12-m",
        geo: str = "US",
        gprop: str = "",
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Comprehensive trends analysis with retry logic for 429 errors.

        Args:
            keywords: List of keywords to analyze (1-5)
            timeframe: Timeframe (e.g., "today 12-m", "today 3-m", "today 5-y")
            geo: Country code (e.g., "US", "GB", "IN")
            gprop: Google property filter - '' for web, 'youtube' for YouTube, 'news', 'images', 'froogle'
            user_id: Optional user ID for tracking

        Fetches: interest over time, interest by region, related topics,
        and related queries using a single TrendReq session.
        """
        if not keywords:
            raise ValueError("Keywords list cannot be empty")

        if len(keywords) > 5:
            logger.warning(f"Too many keywords ({len(keywords)}), using first 5")
            keywords = keywords[:5]

        cache_key = self._build_cache_key(keywords, timeframe, geo)

        # Check if we're in a 429 cooldown period
        now = time.time()
        if now - self.__class__._last_429_time < self.__class__._429_cooldown_period:
            remaining_cooldown = int(self.__class__._429_cooldown_period - (now - self.__class__._last_429_time))
            logger.warning(
                f"[Trends] In 429 cooldown period. {remaining_cooldown}s remaining. "
                f"Returning cached data if available."
            )
            cached_data = self._get_from_cache(cache_key, ignore_ttl=True)  # Use stale cache
            if cached_data:
                logger.info(f"[Trends] Returning stale cached data for {keywords} during cooldown")
                return {**cached_data, "cached": True, "cooldown_active": True}
            return self._create_fallback_response(
                keywords, timeframe, geo, gprop,
                f"Rate limited by Google. Cooldown active for {remaining_cooldown}s. Try again later."
            )

        # Check fresh cache
        cached_data = self._get_from_cache(cache_key)
        if cached_data:
            logger.info(f"Returning cached trends data for: {keywords}")
            return {**cached_data, "cached": True}

        # Retry logic for 429 errors
        max_retries = 3
        retry_delays = [30, 60, 120]  # Longer delays: 30s, 60s, 120s

        for attempt in range(max_retries + 1):
            try:
                return await self._do_analyze_trends(
                    keywords, timeframe, geo, gprop, cache_key, attempt, max_retries
                )
            except Exception as e:
                # Check if this is a 429 error (pytrends raises TooManyRequestsError)
                is_429 = False
                if _TooManyRequestsError and isinstance(e, _TooManyRequestsError):
                    is_429 = True
                else:
                    error_str = str(e).lower()
                    is_429 = "429" in error_str or "rate limit" in error_str or "too many requests" in error_str

                if is_429:
                    # Update the last 429 time for cooldown
                    self.__class__._last_429_time = time.time()

                    if attempt < max_retries:
                        delay = retry_delays[attempt]
                        logger.warning(
                            f"[Trends] 429 rate limit hit (attempt {attempt + 1}/{max_retries + 1}), "
                            f"retrying in {delay}s..."
                        )
                        await asyncio.sleep(delay)
                        continue
                    else:
                        # Out of retries - enter cooldown
                        logger.error(
                            f"[Trends] 429 rate limit persisted after {max_retries + 1} attempts. "
                            f"Entering {self.__class__._429_cooldown_period}s cooldown period."
                        )
                        # Try to return stale cache
                        stale_cache = self._get_from_cache(cache_key, ignore_ttl=True)
                        if stale_cache:
                            logger.info(f"[Trends] Returning stale cache after 429 exhaustion for {keywords}")
                            result = {**stale_cache}
                            result["cached"] = True
                            result["cooldown_active"] = True
                            return result
                        return self._create_fallback_response(
                            keywords, timeframe, geo, gprop,
                            f"Google is rate limiting requests. Cooldown active for {self.__class__._429_cooldown_period}s. Try again later."
                        )
                else:
                    # Non-429 error
                    logger.error(f"Google Trends analysis failed after {attempt + 1} attempts: {e}")
                    return self._create_fallback_response(keywords, timeframe, geo, gprop, str(e))

        # Should not reach here, but just in case
        return self._create_fallback_response(keywords, timeframe, geo, gprop, "Max retries exceeded")

    async def _do_analyze_trends(
        self,
        keywords: List[str],
        timeframe: str,
        geo: str,
        gprop: str,
        cache_key: str,
        attempt: int,
        max_retries: int,
    ) -> Dict[str, Any]:
        """Internal method to perform the actual trends analysis."""
        await self.rate_limiter.acquire()

        total_start = time.monotonic()

        interest_over_time: List[Dict[str, Any]] = []
        interest_by_region: List[Dict[str, Any]] = []
        related_topics: Dict[str, List[Dict[str, Any]]] = {"top": [], "rising": []}
        related_queries: Dict[str, List[Dict[str, Any]]] = {"top": [], "rising": []}

        logger.info(
            f"[Trends] ===== START analyze_trends (attempt {attempt + 1}/{max_retries + 1}) ===== "
            f"keywords={keywords} timeframe={timeframe} geo={geo}"
        )

        # Initialize TrendReq with gprop (youtube for video/podcast relevance)
        init_start = time.monotonic()
        pytrends = await asyncio.to_thread(
            self._create_pytrends,
            keywords,
            timeframe,
            geo,
            gprop,
        )
        init_ms = int((time.monotonic() - init_start) * 1000)
        logger.info(f"[Trends] TrendReq init + build_payload took {init_ms}ms")

        # --- Interest Over Time ONLY (skip others to avoid 429) ---
        await self.rate_limiter.acquire()  # Rate limit check BEFORE each request
        iot_start = time.monotonic()
        interest_over_time = await asyncio.to_thread(
            lambda: self._fetch_interest_over_time(pytrends)
        )
        iot_ms = int((time.monotonic() - iot_start) * 1000)
        logger.info(f"[Trends] interest_over_time took {iot_ms}ms, returned {len(interest_over_time)} points")

        # Skip other requests to avoid 429 - only fetch interest_over_time for now
        logger.info(f"[Trends] Skipping other requests to avoid 429 (interest_by_region, related_topics, related_queries)")

        total_ms = int((time.monotonic() - total_start) * 1000)
        logger.info(
            f"[Trends] ===== DONE analyze_trends ===== total={total_ms}ms "
            f"iot={len(interest_over_time)} ibr={len(interest_by_region)} "
            f"rt_top={len(related_topics.get('top', []))} rq_top={len(related_queries.get('top', []))}"
        )

        result = {
            "interest_over_time": interest_over_time,
            "interest_by_region": interest_by_region,
            "related_topics": related_topics,
            "related_queries": related_queries,
            "timeframe": timeframe,
            "geo": geo,
            "keywords": keywords,
            "source": "web" if gprop == "" else "podcast" if gprop == "youtube" else gprop,
            "timestamp": datetime.utcnow().isoformat(),
            "cached": False,
        }

        self._save_to_cache(cache_key, result)

        logger.info(
            f"Google Trends data fetched successfully: "
            f"{len(interest_over_time)} time points, {len(interest_by_region)} regions"
        )

        return result

    # -----------------------------------------------------------------------
    # TrendReq factory
    # -----------------------------------------------------------------------

    def _create_pytrends(
        self,
        keywords: List[str],
        timeframe: str,
        geo: str,
        gprop: str = "",
    ) -> _TrendReq:
        """Create TrendReq with optional gprop (e.g., 'youtube' for video trends)."""
        start = time.monotonic()
        ua = random.choice(self.USER_AGENTS)
        logger.info(f"[Trends] Creating TrendReq (fail-fast, gprop='{gprop}', UA={ua[:40]}...)")
        pytrends = _TrendReq(
            hl='en-US',
            tz=360,
            timeout=(10, 30),
            retries=0,
            backoff_factor=0,
            requests_args={'headers': {'User-Agent': ua}},
        )
        # gprop: '' = web, 'youtube' = YouTube, 'news', 'images', 'froogle'
        pytrends.build_payload(kw_list=keywords, timeframe=timeframe, geo=geo, gprop=gprop)
        elapsed = int((time.monotonic() - start) * 1000)
        logger.info(f"[Trends] TrendReq init + build_payload completed in {elapsed}ms (gprop={gprop})")
        return pytrends

    # -----------------------------------------------------------------------
    # Data fetchers — each catches all exceptions and returns defaults
    # -----------------------------------------------------------------------

    def _fetch_interest_over_time(self, pytrends: _TrendReq, keywords: List[str] = None) -> List[Dict[str, Any]]:
        """Fetch interest over time data."""
        start = time.monotonic()
        try:
            df = pytrends.interest_over_time()
            elapsed = int((time.monotonic() - start) * 1000)
            if df is None or (hasattr(df, 'empty') and df.empty):
                logger.info(f"[Trends] interest_over_time returned empty in {elapsed}ms")
                return []
            # Use pytrends.kw_list if keywords not provided
            kw = keywords or pytrends.kw_list
            result = self._format_dataframe(df.reset_index(), kw)
            logger.info(f"[Trends] interest_over_time returned {len(result)} points in {elapsed}ms")
            return result
        except Exception as e:
            elapsed = int((time.monotonic() - start) * 1000)
            # Re-raise 429 errors so retry logic can handle them
            if _TooManyRequestsError and isinstance(e, _TooManyRequestsError):
                raise
            error_str = str(e).lower()
            if "429" in error_str or "rate limit" in error_str or "too many requests" in error_str:
                raise
            logger.error(f"[Trends] interest_over_time failed in {elapsed}ms: {e}")
            return []

    def _fetch_interest_by_region(self, pytrends: _TrendReq, keywords: List[str] = None) -> List[Dict[str, Any]]:
        """Fetch interest by region data."""
        start = time.monotonic()
        try:
            df = pytrends.interest_by_region(resolution='COUNTRY', inc_low_vol=True, inc_geo_code=False)
            elapsed = int((time.monotonic() - start) * 1000)
            if df is None or (hasattr(df, 'empty') and df.empty):
                logger.info(f"[Trends] interest_by_region returned empty in {elapsed}ms")
                return []
            result = self._format_dataframe(df.reset_index(), keywords or pytrends.kw_list)
            logger.info(f"[Trends] interest_by_region returned {len(result)} regions in {elapsed}ms")
            return result
        except Exception as e:
            elapsed = int((time.monotonic() - start) * 1000)
            # Re-raise 429 errors so retry logic can handle them
            if _TooManyRequestsError and isinstance(e, _TooManyRequestsError):
                raise
            error_str = str(e).lower()
            if "429" in error_str or "rate limit" in error_str or "too many requests" in error_str:
                raise
            logger.error(f"[Trends] interest_by_region failed in {elapsed}ms: {e}")
            return []

    def _fetch_related_topics(self, pytrends: _TrendReq) -> Dict[str, List[Dict[str, Any]]]:
        """Fetch related topics. Patches catch IndexError from pytrends bug."""
        start = time.monotonic()
        result = {"top": [], "rising": []}
        try:
            topics_data = pytrends.related_topics()
            elapsed = int((time.monotonic() - start) * 1000)

            if topics_data is None:
                logger.info(f"[Trends] related_topics returned None in {elapsed}ms")
                return result

            if not isinstance(topics_data, dict):
                logger.info(f"[Trends] related_topics returned {type(topics_data).__name__}, expected dict")
                return result

            for key, keyword_data in topics_data.items():
                if keyword_data is None or not isinstance(keyword_data, dict):
                    continue

                for section in ["top", "rising"]:
                    section_df = keyword_data.get(section)
                    if section_df is None:
                        continue
                    if hasattr(section_df, 'empty') and section_df.empty:
                        continue
                    if not hasattr(section_df, 'to_dict'):
                        continue

                    try:
                        if "topic_title" in section_df.columns and "value" in section_df.columns:
                            data = section_df[["topic_title", "value"]].to_dict('records')
                        else:
                            data = section_df.to_dict('records')
                        result[section].extend(data)
                    except Exception as e:
                        logger.debug(f"Error parsing {section} topics for key '{key}': {e}")
                        continue

            logger.info(f"[Trends] related_topics completed in {elapsed}ms, top={len(result['top'])} rising={len(result['rising'])}")
            return result
        except Exception as e:
            elapsed = int((time.monotonic() - start) * 1000)
            # Re-raise 429 errors so retry logic can handle them
            if _TooManyRequestsError and isinstance(e, _TooManyRequestsError):
                raise
            error_str = str(e).lower()
            if "429" in error_str or "rate limit" in error_str or "too many requests" in error_str:
                raise
            logger.error(f"[Trends] related_topics failed in {elapsed}ms: {e}")
            return result

    def _fetch_related_queries(self, pytrends: _TrendReq) -> Dict[str, List[Dict[str, Any]]]:
        """Fetch related queries. Patches catch IndexError from pytrends bug."""
        start = time.monotonic()
        result = {"top": [], "rising": []}
        try:
            queries_data = pytrends.related_queries()
            elapsed = int((time.monotonic() - start) * 1000)

            if queries_data is None:
                logger.info(f"[Trends] related_queries returned None in {elapsed}ms")
                return result

            if not isinstance(queries_data, dict):
                logger.info(f"[Trends] related_queries returned {type(queries_data).__name__}, expected dict")
                return result

            for key, keyword_data in queries_data.items():
                if keyword_data is None or not isinstance(keyword_data, dict):
                    continue

                for section in ["top", "rising"]:
                    section_df = keyword_data.get(section)
                    if section_df is None:
                        continue
                    if hasattr(section_df, 'empty') and section_df.empty:
                        continue
                    if not hasattr(section_df, 'to_dict'):
                        continue

                    try:
                        data = section_df.to_dict('records')
                        result[section].extend(data)
                    except Exception as e:
                        logger.debug(f"Error parsing {section} queries for key '{key}': {e}")
                        continue

            logger.info(f"[Trends] related_queries completed in {elapsed}ms, top={len(result['top'])} rising={len(result['rising'])}")
            return result
        except Exception as e:
            elapsed = int((time.monotonic() - start) * 1000)
            # Re-raise 429 errors so retry logic can handle them
            if _TooManyRequestsError and isinstance(e, _TooManyRequestsError):
                raise
            error_str = str(e).lower()
            if "429" in error_str or "rate limit" in error_str or "too many requests" in error_str:
                raise
            logger.error(f"[Trends] related_queries failed in {elapsed}ms: {e}")
            return result

    # -----------------------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------------------

    def _format_dataframe(self, df: pd.DataFrame, keywords: List[str] = None) -> List[Dict[str, Any]]:
        """Convert DataFrame to list of dicts. Handles both pytrends and SerpAPI formats."""
        if df.empty:
            return []
        
        # Try to detect and handle SerpAPI-style nested data
        # Check if the dataframe has 'date' column and 'values' array column
        records = df.to_dict('records')
        
        # Check first record for nested values pattern (SerpAPI format)
        if records and 'values' in records[0] and isinstance(records[0]['values'], list):
            # SerpAPI-style: need to flatten
            flat_records = []
            for record in records:
                date_str = record.get('date', '')
                timestamp = record.get('timestamp', '')
                is_partial = record.get('partial_data', False)
                
                # Extract values from nested array
                for val_entry in record['values']:
                    keyword_name = val_entry.get('query', '')
                    value = val_entry.get('value', val_entry.get('extracted_value', 0))
                    flat_record = {
                        'date': date_str,
                        'timestamp': timestamp,
                        keyword_name: int(value) if value else 0,
                    }
                    if is_partial:
                        flat_record['isPartial'] = True
                    flat_records.append(flat_record)
            records = flat_records
        
        # Convert datetime columns to strings
        for record in records:
            for key, value in record.items():
                if hasattr(value, 'year'):  # datetime-like
                    record[key] = str(value)
        
        return records

    def _build_cache_key(self, keywords: List[str], timeframe: str, geo: str) -> str:
        keywords_str = ":".join(sorted(keywords))
        return f"google_trends:{keywords_str}:{timeframe}:{geo}"

    def _get_from_cache(self, cache_key: str, ignore_ttl: bool = False) -> Optional[Dict[str, Any]]:
        """Get cached data. If ignore_ttl=True, return stale data too (for 429 cooldown)."""
        if cache_key not in self.cache:
            return None
        cached_entry = self.cache[cache_key]

        if not ignore_ttl:
            cached_time = datetime.fromisoformat(cached_entry.get("timestamp", ""))
            if datetime.utcnow() - cached_time > self.cache_ttl:
                del self.cache[cache_key]
                return None

        result = {**cached_entry}
        result.pop("cached", None)
        return result

    def _save_to_cache(self, cache_key: str, data: Dict[str, Any]):
        cache_entry = {**data, "cached_at": datetime.utcnow().isoformat()}
        self.cache[cache_key] = cache_entry
        if len(self.cache) > 100:
            self._cleanup_cache()

    def _cleanup_cache(self):
        now = datetime.utcnow()
        expired_keys = []
        for key, entry in self.cache.items():
            cached_time = datetime.fromisoformat(entry.get("cached_at", entry.get("timestamp", "")))
            if now - cached_time > self.cache_ttl:
                expired_keys.append(key)
        for key in expired_keys:
            del self.cache[key]
        logger.debug(f"Cleaned up {len(expired_keys)} expired cache entries")

    def _create_fallback_response(
        self,
        keywords: List[str],
        timeframe: str,
        geo: str,
        gprop: str = "",
        error_message: str = "",
    ) -> Dict[str, Any]:
        source = "web" if gprop == "" else "podcast" if gprop == "youtube" else gprop
        return {
            "interest_over_time": [],
            "interest_by_region": [],
            "related_topics": {"top": [], "rising": []},
            "related_queries": {"top": [], "rising": []},
            "timeframe": timeframe,
            "geo": geo,
            "keywords": keywords,
            "source": source,
            "timestamp": datetime.utcnow().isoformat(),
            "cached": False,
            "error": error_message,
        }

    async def get_trending_searches(
        self,
        country: str = "united_states",
        user_id: Optional[str] = None,
    ) -> List[str]:
        await self.rate_limiter.acquire()

        try:
            ua = random.choice(self.USER_AGENTS)
            pytrends = _TrendReq(
                hl='en-US',
                tz=360,
                timeout=(10, 30),
                retries=0,
                backoff_factor=0,
                requests_args={'headers': {'User-Agent': ua}},
            )
            trending_df = await asyncio.to_thread(
                lambda: pytrends.trending_searches(pn=country)
            )

            if trending_df is None or (hasattr(trending_df, 'empty') and trending_df.empty):
                return []

            return trending_df[0].tolist() if len(trending_df.columns) > 0 else []

        except Exception as e:
            logger.error(f"Error fetching trending searches: {e}")
            return []