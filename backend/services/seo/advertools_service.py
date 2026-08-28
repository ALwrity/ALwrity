import advertools as adv
import pandas as pd
import asyncio
import time as _time
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from loguru import logger
import json
import os
import tempfile
from urllib.parse import urlparse
from collections import Counter
import urllib.request
import urllib.error
import socket
import re
import threading

# ── Per-domain rate limiter ───────────────────────────────────────────
# Multiple background tasks (deep competitor analysis, onboarding sitemap
# analysis, crawl budget) can all hit the same origin simultaneously,
# causing HTTP 429 chain failures.  This semaphore ensures at most 1
# concurrent request per domain with a 1s cooldown between requests, and
# enforces an extended pause after any observed 429 so the origin can cool
# down before we touch it again.
_RETRYABLE_HTTP = frozenset({429, 500, 502, 503, 504})
_MAX_RETRY_SLEEP = 30.0        # cap per backoff sleep (increased for 429 rate limits)
_BATCH_DEADLINE_SECS = 120.0   # wall-clock budget for a whole (recursive) sitemap fetch
_429_ACTIVE_WINDOW = 20.0      # a 429 inside this window => the origin is throttling
_PACING_MIN = 2.0
_PACING_MAX = 5.0

_DOMAIN_SEMAPHORES: Dict[str, threading.Lock] = {}
_DOMAIN_LAST_REQUEST: Dict[str, float] = {}
_DOMAIN_LAST_429: Dict[str, float] = {}
_DOMAIN_429_LOCK = threading.Lock()

# Per-URL sitemap DataFrame cache — avoids refetching when multiple
# background tasks hit the same domain. TTL ensures freshness.
_SITEMAP_CACHE: Dict[str, Tuple[pd.DataFrame, float]] = {}
_SITEMAP_CACHE_LOCK = threading.Lock()
_SITEMAP_CACHE_TTL = 600  # 10 minutes
_DOMAIN_LOCK_TIMEOUT = 60.0  # max wait to acquire per-domain lock


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc
    except Exception:
        return url


def _note_429(domain: str) -> None:
    with _DOMAIN_429_LOCK:
        _DOMAIN_LAST_429[domain] = _time.monotonic()


def _domain_429_cooldown(domain: str) -> float:
    """Seconds still remaining in the post-429 pause for this domain (0 if none)."""
    with _DOMAIN_429_LOCK:
        last = _DOMAIN_LAST_429.get(domain, 0.0)
    return max(last + _429_ACTIVE_WINDOW - _time.monotonic(), 0.0)


def _throttle_domain_sync(domain: str) -> None:
    """Acquire per-domain lock + enforce cooldown between requests."""
    if domain not in _DOMAIN_SEMAPHORES:
        _DOMAIN_SEMAPHORES[domain] = threading.Lock()
    lock = _DOMAIN_SEMAPHORES[domain]

    acquired = lock.acquire(timeout=_DOMAIN_LOCK_TIMEOUT)
    if not acquired:
        logger.warning(f"Could not acquire domain lock for {domain} within {_DOMAIN_LOCK_TIMEOUT}s — proceeding without throttle")
        return
    try:
        pause = 1.0 - (_time.monotonic() - _DOMAIN_LAST_REQUEST.get(domain, 0.0))
        pause = max(pause, _domain_429_cooldown(domain))
        if pause > 0:
            _time.sleep(pause)
        _DOMAIN_LAST_REQUEST[domain] = _time.monotonic()
    finally:
        lock.release()

class AdvertoolsService:
    """
    Centralized service for leveraging the Advertools library for deep SEO intelligence.
    Provides functions for sitemap analysis, content auditing, and link extraction.
    """
    
    def __init__(self):
        self.logger = logger.bind(service="AdvertoolsService")

    @staticmethod
    def _sitemap_to_df_with_retry(
        sitemap_url: str,
        max_retries: int = 3,
        _depth: int = 0,
        _deadline: Optional[float] = None,
        max_urls: Optional[int] = None,
    ) -> pd.DataFrame:
        """Fetch sitemap with rate-limit-aware retry + jittered backoff.

        Handles both empty responses AND exceptions (e.g. HTTP 429 / 5xx)
        with a capped, jittered backoff (every sleep capped at 10s):
        - 1st retry: ~3-8s (base 5s, ±50% jitter)
        - 2nd retry: ~8-10s (base 15s, capped)
        - 3rd retry: ~10s (base 45s, capped)

        Non-retryable HTTP errors (4xx like 404/403) fail fast instead of
        retrying — a sitemap that simply doesn't exist will never succeed.

        A 429 marks the origin as rate-limited: the response's Retry-After is
        honored (capped), a post-429 pause is enforced before the next request
        to the same domain, and remaining sub-sitemaps are given fewer retries.

        A shared wall-clock deadline bounds the entire (recursive) fetch so a
        heavily rate-limited origin cannot stall an interactive run forever;
        whatever has been fetched so far is returned.

        IMPORTANT: advertools' own sitemap_to_df() with recursive=True fetches
        every sub-sitemap concurrently via ThreadPoolExecutor(max_workers=8)
        with zero delay between requests, which bypasses our per-domain
        throttle and trips HTTP 429.  We therefore always fetch with
        recursive=False, detect sitemap indexes ourselves from the ``loc``
        column, and fetch sub-sitemaps SEQUENTIALLY with a pacing sleep so we
        stay under the origin's rate limit.
        """
        import time as _time
        import random

        MAX_INDEX_DEPTH = 3
        if _deadline is None:
            _deadline = _time.monotonic() + _BATCH_DEADLINE_SECS

        def _looks_like_sitemap_file(loc: str) -> bool:
            path = urlparse(loc).path.lower()
            return path.endswith(".xml") or path.endswith(".xml.gz")

        def _looks_like_sitemap_index(df: pd.DataFrame) -> bool:
            if df is None or df.empty or "loc" not in df.columns:
                return False
            locs = df["loc"].dropna().astype(str).tolist()
            if not locs:
                return False
            return all(_looks_like_sitemap_file(loc) for loc in locs)

        def _retry_after_seconds(err: Any) -> Optional[float]:
            headers = getattr(err, "headers", None)
            ra = headers.get("Retry-After") if headers else None
            if not ra:
                return None
            try:
                return float(ra)
            except (TypeError, ValueError):
                return None  # HTTP-date form — fall back to jittered backoff

        def _fetch_once(url: str, retries: int) -> pd.DataFrame:
            domain = _extract_domain(url)
            df = pd.DataFrame()

            # Check cache first (in-memory)
            with _SITEMAP_CACHE_LOCK:
                cached = _SITEMAP_CACHE.get(url)
                if cached is not None:
                    cached_df, cached_at = cached
                    if _time.monotonic() - cached_at < _SITEMAP_CACHE_TTL:
                        logger.debug(f"advertools cache HIT for {url} (age={_time.monotonic() - cached_at:.0f}s)")
                        return cached_df.copy()
                    else:
                        del _SITEMAP_CACHE[url]

            # Check persisted cache (survives restarts)
            try:
                from services.analytics_cache_service import analytics_cache
                cached_json = analytics_cache.get('sitemap_df', 'shared', url=url)
                if cached_json:
                    restored_df = pd.read_json(cached_json)
                    if restored_df is not None and not restored_df.empty:
                        with _SITEMAP_CACHE_LOCK:
                            _SITEMAP_CACHE[url] = (restored_df, _time.monotonic())
                        logger.debug(f"advertools cache HIT from DB for {url}")
                        return restored_df
            except Exception:
                pass

            for attempt in range(retries + 1):
                sleep_secs = 0.0
                if _time.monotonic() >= _deadline:
                    logger.warning(f"sitemap_to_df batch deadline reached for {url}, giving up")
                    break
                try:
                    if attempt == 0:
                        _throttle_domain_sync(domain)
                    df = adv.sitemap_to_df(url, recursive=False)
                except urllib.error.HTTPError as e:
                    if e.code not in _RETRYABLE_HTTP:
                        logger.warning(
                            f"sitemap_to_df HTTP {e.code} for {url} — permanent, skipping"
                        )
                        return pd.DataFrame()
                    if e.code == 429:
                        _note_429(domain)
                        ra = _retry_after_seconds(e)
                        if ra is not None:
                            sleep_secs = min(ra, _MAX_RETRY_SLEEP)
                    logger.warning(
                        f"sitemap_to_df raised for {url} "
                        f"(attempt {attempt + 1}/{retries + 1}): {e}"
                    )
                    df = pd.DataFrame()
                except Exception as e:
                    logger.warning(
                        f"sitemap_to_df raised for {url} "
                        f"(attempt {attempt + 1}/{retries + 1}): {e}"
                    )
                    df = pd.DataFrame()
                if df is not None and not df.empty:
                    with _SITEMAP_CACHE_LOCK:
                        _SITEMAP_CACHE[url] = (df.copy(), _time.monotonic())
                    # Persist to analytics cache so cache survives restarts
                    try:
                        from services.analytics_cache_service import analytics_cache
                        analytics_cache.set('sitemap_df', 'shared', df.to_json(), url=url)
                    except Exception:
                        pass
                    return df
                if attempt < retries:
                    if sleep_secs <= 0:
                        base_delay = 5 * (3 ** attempt)
                        sleep_secs = min(base_delay * (0.5 + random.random()), _MAX_RETRY_SLEEP)
                    logger.warning(
                        f"sitemap_to_df empty/failed for {url}, "
                        f"retrying in {sleep_secs:.1f}s..."
                    )
                    _time.sleep(sleep_secs)
            return df

        df = _fetch_once(sitemap_url, max_retries)

        # Sitemap index detected: recurse into sub-sitemaps one at a time,
        # pacing each request to avoid triggering the origin's rate limit.
        if _depth < MAX_INDEX_DEPTH and _looks_like_sitemap_index(df):
            frames = []
            domain = _extract_domain(sitemap_url)
            for sub_url in df["loc"].dropna().astype(str).tolist():
                if _time.monotonic() >= _deadline:
                    logger.warning("sitemap_to_df batch deadline reached, returning partial results")
                    break
                # Stop early once we have enough URLs (e.g. an SEO preview only
                # needs a handful) so we don't crawl every sub-sitemap of a
                # large index and trip the origin's rate limit.
                if max_urls is not None and sum(len(f) for f in frames) >= max_urls:
                    logger.info(
                        f"sitemap_to_df collected {sum(len(f) for f in frames)} URLs, "
                        f"reached max_urls={max_urls}, stopping sub-sitemap recursion"
                    )
                    break
                # Once the origin has shown it's throttling, cap retries for the
                # remaining sub-sitemaps so the batch degrades quickly.
                sub_retries = 1 if _domain_429_cooldown(domain) > 0 else max_retries
                sub_df = AdvertoolsService._sitemap_to_df_with_retry(
                    sub_url,
                    max_retries=sub_retries,
                    _depth=_depth + 1,
                    _deadline=_deadline,
                    max_urls=max_urls,
                )
                if sub_df is not None and not sub_df.empty:
                    frames.append(sub_df)
                # After a 429, ride out the origin's cooldown before the next
                # sub-sitemap; otherwise use normal pacing between requests.
                cooldown = _domain_429_cooldown(domain)
                if cooldown > 0:
                    _time.sleep(min(cooldown, 15.0))
                else:
                    _time.sleep(_PACING_MIN + random.random() * (_PACING_MAX - _PACING_MIN))
            if frames:
                return pd.concat(frames, ignore_index=True)
            return pd.DataFrame()

        return df

    async def analyze_sitemap(self, sitemap_url: str, max_retries: int = 3) -> Dict[str, Any]:
        """
        Analyzes a website's sitemap to extract metrics on publishing velocity, freshness,
        URL structure patterns, and topic distribution.

        ``max_retries`` bounds how many times each sitemap / sub-sitemap is retried
        on transient failures (e.g. HTTP 429). Background tasks on rate-limited
        origins pass a low value so the sitemap index recursion degrades fast
        instead of burning 4 attempts × 30s backoff per sub-sitemap.
        """
        try:
            self.logger.info(f"Analyzing sitemap: {sitemap_url}")
            
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, lambda: _throttle_domain_sync(_extract_domain(sitemap_url)))
            df = await loop.run_in_executor(
                None, lambda: self._sitemap_to_df_with_retry(sitemap_url, max_retries=max_retries)
            )
            
            if df is None or df.empty or 'loc' not in df.columns:
                return {"success": False, "error": "Sitemap is empty, unparseable, or missing URL column."}

            if 'lastmod' in df.columns:
                df['lastmod'] = pd.to_datetime(df['lastmod'], errors='coerce', utc=True)
                
            total_urls = len(df)
            
            # --- Content Freshness Scoring ---
            freshness = self._compute_freshness(df)
            
            # --- URL Structure Analysis ---
            url_structure = {}
            if 'loc' in df.columns:
                url_structure = await self._analyze_url_structure(df['loc'].tolist())
            
            # --- Content Pillars via url_to_df ---
            pillars = {}
            url_df = None
            try:
                url_df = await loop.run_in_executor(None, lambda: adv.url_to_df(df['loc']))
                if url_df is not None and not url_df.empty:
                    dir_cols = [c for c in url_df.columns if c.startswith('dir_')]
                    if dir_cols:
                        pillar_series = url_df[dir_cols[0]].fillna("home").astype(str)
                        for col in dir_cols[1:3]:
                            mask = url_df[col].notna() & (url_df[col].astype(str) != 'nan')
                            pillar_series = pillar_series + "/" + url_df[col].where(mask, "")
                        pillars = pillar_series.value_counts().head(15).to_dict()
            except Exception:
                fallback_pillars = {}
                if 'loc' in df.columns:
                    def extract_hierarchy(url: str):
                        try:
                            parts = urlparse(url).path.strip('/').split('/')
                            if not parts or not parts[0]: return "home"
                            return "/".join(parts[:2])
                        except:
                            return "other"
                    fallback_pillars = df['loc'].apply(extract_hierarchy).value_counts().head(15).to_dict()
                pillars = fallback_pillars

            # Sample URLs for auditing (top 15 most recent)
            audit_urls = []
            if 'lastmod' in df.columns and not df['lastmod'].isna().all():
                audit_urls = df.sort_values('lastmod', ascending=False).head(15)['loc'].tolist()
            else:
                audit_urls = df['loc'].head(15).tolist()

            return {
                "success": True,
                "metrics": {
                    "total_urls": total_urls,
                    "publishing_velocity": freshness.get("publishing_velocity"),
                    "stale_content_count": freshness.get("stale_count"),
                    "stale_content_percentage": freshness.get("stale_percentage"),
                    "freshness_score": freshness.get("freshness_score"),
                    "publishing_recency": freshness.get("publishing_recency"),
                    "publishing_trend": freshness.get("publishing_trend"),
                    "top_pillars": pillars,
                    "url_structure": url_structure,
                    "audit_sample_urls": audit_urls
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            self.logger.error(f"Failed to analyze sitemap {sitemap_url}: {str(e)}")
            return {"success": False, "error": str(e)}

    def _compute_freshness(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Compute content freshness, publishing velocity, and staleness metrics."""
        result = {
            "publishing_velocity": 0,
            "stale_count": 0,
            "stale_percentage": 0,
            "freshness_score": 0,
            "publishing_recency": {},
            "publishing_trend": "unknown"
        }
        
        if 'lastmod' not in df.columns or df['lastmod'].isna().all():
            return result

        lastmod = df['lastmod'].dropna()
        if lastmod.empty:
            return result

        now = datetime.now(lastmod.dt.tz)
        thirty_days_ago = now - timedelta(days=30)
        ninety_days_ago = now - timedelta(days=90)
        six_months_ago = now - timedelta(days=180)

        recent_urls = df[df['lastmod'] > thirty_days_ago]
        stale_urls = df[df['lastmod'] < six_months_ago]
        
        total_urls = len(df)
        stale_count = len(stale_urls)
        stale_percentage = round((stale_count / total_urls) * 100, 2) if total_urls > 0 else 0

        # Publishing velocity: URLs per week over last 90 days
        recent_90 = df[df['lastmod'] > ninety_days_ago]
        publishing_velocity = round(len(recent_90) / 13.0, 2) if not recent_90.empty else 0

        # Freshness score (0-100): weighted combination of metrics
        non_stale_ratio = 1.0 - (stale_percentage / 100.0)
        recency_ratio = len(recent_urls) / max(total_urls, 1)
        velocity_score = min(publishing_velocity / 10.0, 1.0)
        freshness_score = round((non_stale_ratio * 50 + recency_ratio * 30 + velocity_score * 20), 1)

        # Publishing recency: URLs published in last 1d, 7d, 30d, 90d
        publishing_recency = {
            "last_24h": int(len(df[df['lastmod'] > (now - timedelta(days=1))])),
            "last_7d": int(len(df[df['lastmod'] > (now - timedelta(days=7))])),
            "last_30d": int(len(recent_urls)),
            "last_90d": int(len(recent_90)),
        }

        # Publishing trend: compare recent 30d vs prior 30d
        prior_30 = df[(df['lastmod'] <= thirty_days_ago) & (df['lastmod'] > (now - timedelta(days=60)))]
        recent_count = len(recent_urls)
        prior_count = len(prior_30)
        if recent_count > prior_count * 1.1:
            publishing_trend = "increasing"
        elif recent_count < prior_count * 0.9:
            publishing_trend = "decreasing"
        else:
            publishing_trend = "stable"

        return {
            "publishing_velocity": publishing_velocity,
            "stale_count": stale_count,
            "stale_percentage": stale_percentage,
            "freshness_score": freshness_score,
            "publishing_recency": publishing_recency,
            "publishing_trend": publishing_trend
        }

    async def _analyze_url_structure(self, urls: List[str]) -> Dict[str, Any]:
        """Analyze URL patterns for parameter bloat, directory depth, and path patterns."""
        # Filter out any non-string values (NaN, None, float) from the URL list
        clean_urls = [u for u in urls if isinstance(u, str) and u.strip()]
        if not clean_urls:
            return {}
        try:
            loop = asyncio.get_event_loop()
            url_df = await loop.run_in_executor(None, lambda: adv.url_to_df(clean_urls))

            if url_df is None or url_df.empty:
                return {}

            total = len(url_df)

            # Query param analysis
            has_query = url_df['query'].notna() & (url_df['query'] != '')
            param_count = has_query.sum()
            param_percentage = round((param_count / total) * 100, 2) if total > 0 else 0

            # Extract individual parameters
            all_params = []
            param_frequency = {}
            if param_count > 0:
                for q in url_df.loc[has_query, 'query'].dropna().unique():
                    for pair in q.split('&'):
                        key = pair.split('=')[0] if '=' in pair else pair
                        all_params.append(key)
                from collections import Counter
                param_frequency = dict(Counter(all_params).most_common(10))

            # Directory depth analysis
            dir_cols = [c for c in url_df.columns if c.startswith('dir_')]
            def count_depth(row):
                for i, col in enumerate(dir_cols):
                    val = row[col]
                    if pd.isna(val) or str(val) == 'nan' or str(val).strip() == '':
                        return i
                return len(dir_cols)

            depths = url_df.apply(count_depth, axis=1)
            avg_depth = round(depths.mean(), 1) if not depths.empty else 0
            max_depth = int(depths.max()) if not depths.empty else 0
            depth_distribution = depths.value_counts().sort_index().head(10).to_dict()
            depth_distribution = {str(k): int(v) for k, v in depth_distribution.items()}

            # Protocol consistency
            schemes = url_df['scheme'].value_counts().to_dict() if 'scheme' in url_df.columns else {}

            # Subdomain analysis
            netloc_counts = url_df['netloc'].value_counts() if 'netloc' in url_df.columns else None
            unique_subdomains = int(netloc_counts.nunique()) if netloc_counts is not None else 0
            primary_domain = netloc_counts.index[0] if netloc_counts is not None and not netloc_counts.empty else ""

            return {
                "total_urls_analyzed": total,
                "parameter_usage": {
                    "urls_with_params": int(param_count),
                    "percentage_with_params": param_percentage,
                    "top_parameters": param_frequency
                },
                "directory_depth": {
                    "average_depth": avg_depth,
                    "max_depth": max_depth,
                    "distribution": depth_distribution
                },
                "protocols": {str(k): int(v) for k, v in schemes.items()},
                "subdomains": {
                    "primary": primary_domain,
                    "unique_count": unique_subdomains
                }
            }
        except Exception as e:
            self.logger.warning(f"URL structure analysis failed: {e}")
            return {}

    async def audit_content(self, url_list: List[str]) -> Dict[str, Any]:
        """
        Performs a shallow crawl and theme analysis using word frequency.
        Uses unique temporary files for thread safety.
        """
        temp_file = None
        try:
            self.logger.info(f"Auditing content for {len(url_list)} URLs")
            
            # Create a unique temporary file
            with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as tf:
                temp_file = tf.name

            # advertools crawl is blocking
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, lambda: adv.crawl(
                url_list=url_list,
                output_file=temp_file,
                follow_links=False,
                custom_settings={
                    'LOG_LEVEL': 'WARNING',
                    'CLOSESPIDER_PAGECOUNT': 15, # Guardrail: Max 15 pages
                    'DOWNLOAD_TIMEOUT': 30,      # Guardrail: 30s timeout per page
                    'DOWNLOAD_FAIL_ON_DATALOSS': False  # Allow partial responses
                }
            ))
            
            if not os.path.exists(temp_file) or os.path.getsize(temp_file) == 0:
                return {"success": False, "error": "Crawl failed to generate output or output is empty."}

            crawl_df = pd.read_json(temp_file, lines=True)
            
            # Extract themes using word frequency
            text_columns = [col for col in ['body_text', 'h1', 'h2', 'title'] if col in crawl_df.columns]
            if not text_columns:
                 return {"success": False, "error": "No text content found to analyze."}

            all_text = " ".join(crawl_df[text_columns].fillna("").values.flatten())
            
            if not all_text.strip():
                return {"success": False, "error": "Extracted text is empty."}

            word_freq = await loop.run_in_executor(
                None,
                # advertools >=0.13 renamed the ``rm_stopwords`` boolean
                # to ``rm_words`` (a set of stopwords). The default
                # English stopword set is what the old boolean True
                # behaviour produced, so use ``adv.stopwords['english']``
                # to preserve the original behaviour.
                # phrase_len=2 yields meaningful 2-word topics ("content
                # marketing", "small business") instead of bare single words
                # that read as noise to non-technical users.
                lambda: adv.word_frequency(
                    [all_text],
                    phrase_len=2,
                    rm_words=adv.stopwords.get("english", set()),
                ),
            )
            # Drop phrases that are stopword-only ("how to", "of page",
            # "the right") — they read as noise and are not real topics.
            stopwords = adv.stopwords.get("english", set())
            records = word_freq.head(40).to_dict(orient='records')
            top_themes = [
                r for r in records
                if all(w not in stopwords for w in str(r.get("word", "")).split())
            ][:20]

            # Additional metrics: Readability, word count
            avg_word_count = 0
            if 'body_text' in crawl_df.columns:
                crawl_df['word_count'] = crawl_df['body_text'].fillna("").str.split().str.len()
                avg_word_count = crawl_df['word_count'].mean()

            return {
                "success": True,
                "themes": top_themes,
                "page_count": len(crawl_df),
                "avg_word_count": round(avg_word_count, 1),
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            self.logger.error(f"Failed to audit content: {str(e)}")
            return {"success": False, "error": str(e)}
        finally:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except Exception as e:
                    self.logger.warning(f"Failed to remove temp file {temp_file}: {e}")

    async def analyze_site_structure(self, url_list: List[str], site_domain: Optional[str] = None) -> Dict[str, Any]:
        """
        Crawls a set of pages with link following to analyze internal link health,
        redirect chains, and page-level SEO elements.
        
        Extracts metrics via crawlytics: link distribution, redirect chains, image SEO.
        """
        temp_file = None
        try:
            self.logger.info(f"Analyzing site structure for {len(url_list)} URLs, domain={site_domain}")
            
            with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as tf:
                temp_file = tf.name

            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, lambda: adv.crawl(
                url_list=url_list,
                output_file=temp_file,
                follow_links=True,
                allowed_domains=[site_domain] if site_domain else None,
                custom_settings={
                    'LOG_LEVEL': 'WARNING',
                    'CLOSESPIDER_PAGECOUNT': 50,
                    'DOWNLOAD_TIMEOUT': 30,
                    'CONCURRENT_REQUESTS_PER_DOMAIN': 3,
                    'DEPTH_LIMIT': 3,
                    'DOWNLOAD_FAIL_ON_DATALOSS': False,  # Allow partial responses
                }
            ))
            
            if not os.path.exists(temp_file) or os.path.getsize(temp_file) == 0:
                return {"success": False, "error": "Site structure crawl produced no output."}

            crawl_df = pd.read_json(temp_file, lines=True)
            page_count = len(crawl_df)
            result = {"success": True, "page_count": page_count}

            # --- Link Health via crawlytics ---
            loop = asyncio.get_event_loop()
            try:
                internal_regex = site_domain if site_domain else None
                link_df = await loop.run_in_executor(
                    None, lambda: adv.crawlytics.links(crawl_df, internal_url_regex=internal_regex)
                )
                if link_df is not None and not link_df.empty:
                    total_links = len(link_df)
                    internal_links = int(link_df['internal'].sum()) if 'internal' in link_df.columns else 0
                    external_links = total_links - internal_links
                    nofollow_links = int(link_df['nofollow'].sum()) if 'nofollow' in link_df.columns else 0

                    # Count links per page
                    links_per_page = link_df.groupby(level=0).size()
                    avg_links_per_page = round(links_per_page.mean(), 1) if not links_per_page.empty else 0

                    # Most common anchor text (internal links only)
                    anchor_texts = []
                    if 'text' in link_df.columns and 'internal' in link_df.columns:
                        internal_anchors = link_df[link_df['internal'] == True]['text'].dropna()
                        for t in internal_anchors:
                            if isinstance(t, str) and t.strip():
                                anchor_texts.extend([w.strip() for w in t.split() if len(w.strip()) > 2])
                    from collections import Counter
                    top_anchors = dict(Counter(anchor_texts).most_common(15)) if anchor_texts else {}

                    result["link_health"] = {
                        "total_links_found": total_links,
                        "internal_link_count": internal_links,
                        "external_link_count": external_links,
                        "internal_link_percentage": round((internal_links / total_links) * 100, 1) if total_links > 0 else 0,
                        "nofollow_link_count": nofollow_links,
                        "avg_links_per_page": avg_links_per_page,
                        "top_anchor_words": top_anchors
                    }
                else:
                    result["link_health"] = {"error": "No links found in crawl data"}
            except Exception as e:
                self.logger.warning(f"Link analysis failed: {e}")
                result["link_health"] = {"error": str(e)}

            # --- Redirect Chain Audit via crawlytics ---
            try:
                redirect_df = await loop.run_in_executor(
                    None, lambda: adv.crawlytics.redirects(crawl_df)
                )
                if redirect_df is not None and not redirect_df.empty:
                    total_redirects = len(redirect_df)
                    redirect_chains = redirect_df['redirect_times'].nunique() if 'redirect_times' in redirect_df.columns else 0
                    redirect_statuses = redirect_df['status'].value_counts().to_dict() if 'status' in redirect_df.columns else {}
                    multi_hop = redirect_df[redirect_df['redirect_times'] > 1] if 'redirect_times' in redirect_df.columns else pd.DataFrame()

                    result["redirect_audit"] = {
                        "total_redirects": int(total_redirects),
                        "unique_chains": int(redirect_chains),
                        "status_distribution": {str(k): int(v) for k, v in redirect_statuses.items()},
                        "multi_hop_chains": int(len(multi_hop)),
                        "affected_pages": multi_hop.index.unique().tolist() if not multi_hop.empty else []
                    }
                else:
                    result["redirect_audit"] = {"total_redirects": 0, "note": "No redirects detected"}
            except Exception as e:
                self.logger.warning(f"Redirect analysis failed: {e}")
                result["redirect_audit"] = {"error": str(e)}

            # --- Image SEO overview via crawlytics ---
            try:
                img_df = await loop.run_in_executor(
                    None, lambda: adv.crawlytics.images(crawl_df)
                )
                if img_df is not None and not img_df.empty:
                    total_images = len(img_df)
                    missing_alt = int(img_df['img_alt'].isna().sum()) if 'img_alt' in img_df.columns else 0
                    alt_coverage = round(((total_images - missing_alt) / total_images) * 100, 1) if total_images > 0 else 0
                    result["image_seo"] = {
                        "total_images": total_images,
                        "missing_alt_count": missing_alt,
                        "alt_coverage_percentage": alt_coverage
                    }
            except Exception as e:
                self.logger.warning(f"Image analysis failed: {e}")

            # --- Page-level metrics ---
            if 'status' in crawl_df.columns:
                status_dist = crawl_df['status'].value_counts().to_dict()
                result["page_status"] = {str(k): int(v) for k, v in status_dist.items()}
            if 'title' in crawl_df.columns:
                missing_titles = int(crawl_df['title'].isna().sum())
                result["missing_titles"] = missing_titles
            if 'meta_desc' in crawl_df.columns:
                missing_descriptions = int(crawl_df['meta_desc'].isna().sum())
                result["missing_descriptions"] = missing_descriptions

            result["timestamp"] = datetime.utcnow().isoformat()
            return result

        except Exception as e:
            self.logger.error(f"Failed to analyze site structure: {str(e)}")
            return {"success": False, "error": str(e)}
        finally:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except Exception as e:
                    self.logger.warning(f"Failed to remove temp file {temp_file}: {e}")

    async def analyze_robots_txt(self, website_url: str) -> Dict[str, Any]:
        """
        Fetch and analyze robots.txt for compliance issues.
        Checks directives, sitemap declaration, crawl-delay, and common problems.
        """
        try:
            self.logger.info(f"Analyzing robots.txt for {website_url}")
            parsed = urlparse(website_url)
            base_url = f"{parsed.scheme}://{parsed.netloc}"
            robots_url = f"{base_url}/robots.txt"
            result = {
                "success": True,
                "url": robots_url,
                "accessible": True,
                "total_directives": 0,
                "user_agents_found": [],
                "has_sitemap_directive": False,
                "sitemap_urls": [],
                "has_crawl_delay": False,
                "disallow_rules": [],
                "issues": [],
                "compliance_score": 100,
            }
            loop = asyncio.get_event_loop()
            try:
                robots_df = await loop.run_in_executor(
                    None, lambda: adv.robotstxt_to_df(robots_url)
                )
                if robots_df is None or robots_df.empty:
                    raise ValueError("Empty result from robotstxt_to_df")
            except Exception as adv_err:
                self.logger.warning(f"adv.robotstxt_to_df failed, using manual fallback: {adv_err}")
                robots_df = await loop.run_in_executor(
                    None, lambda: self._parse_robots_txt_manual(robots_url)
                )
            if robots_df is None or robots_df.empty:
                result["success"] = False
                result["error"] = "Could not fetch or parse robots.txt"
                result["accessible"] = False
                return result

            result["total_directives"] = len(robots_df)

            if 'user_agent' in robots_df.columns:
                result["user_agents_found"] = robots_df['user_agent'].dropna().unique().tolist()

            rule_col = 'rule' if 'rule' in robots_df.columns else 'directive' if 'directive' in robots_df.columns else None
            value_col = 'value' if 'value' in robots_df.columns else 'directive_value' if 'directive_value' in robots_df.columns else None

            if rule_col and value_col:
                rules_lower = robots_df[rule_col].astype(str).str.lower()
                result["has_sitemap_directive"] = 'sitemap' in rules_lower.values
                result["has_crawl_delay"] = 'crawl-delay' in rules_lower.values
                has_disallow_all = any(
                    str(row.get(value_col, '')).strip() == '/'
                    for _, row in robots_df[robots_df[rule_col].astype(str).str.lower() == 'disallow'].iterrows()
                ) if 'disallow' in rules_lower.values else False

                disallow_mask = rules_lower == 'disallow'
                if disallow_mask.any():
                    for _, row in robots_df[disallow_mask].iterrows():
                        val = str(row.get(value_col, ''))
                        ua = str(row.get('user_agent', '*'))
                        if val:
                            result["disallow_rules"].append({"user_agent": ua, "path": val})

                sitemap_mask = rules_lower == 'sitemap'
                if sitemap_mask.any():
                    result["sitemap_urls"] = robots_df.loc[sitemap_mask, value_col].dropna().unique().tolist()

                if has_disallow_all:
                    result["issues"].append({
                        "severity": "critical", "code": "DISALLOW_ALL",
                        "detail": "robots.txt disallows all user agents from all paths (Disallow: /)"
                    })

            if not result["has_sitemap_directive"]:
                result["issues"].append({
                    "severity": "warning", "code": "NO_SITEMAP",
                    "detail": "No Sitemap directive found — search engines may miss pages"
                })
            if not result["has_crawl_delay"]:
                result["issues"].append({
                    "severity": "info", "code": "NO_CRAWL_DELAY",
                    "detail": "No Crawl-delay directive set — not critical for most sites"
                })

            for issue in result["issues"]:
                sev = issue["severity"]
                if sev == "critical":
                    result["compliance_score"] -= 30
                elif sev == "warning":
                    result["compliance_score"] -= 15
                elif sev == "info":
                    result["compliance_score"] -= 5
            result["compliance_score"] = max(result["compliance_score"], 0)

            return result

        except Exception as e:
            self.logger.error(f"Robots.txt analysis failed: {e}")
            return {"success": False, "error": str(e), "url": robots_url if 'robots_url' in locals() else website_url}

    def _parse_robots_txt_manual(self, url: str) -> pd.DataFrame:
        """Fallback: manually fetch and parse robots.txt."""
        records = []
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                content = resp.read().decode("utf-8", errors="replace")
            current_ua = "*"
            for line in content.splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if line.lower().startswith("user-agent"):
                    parts = line.split(":", 1)
                    current_ua = parts[1].strip() if len(parts) > 1 else "*"
                    continue
                if ":" in line:
                    directive, _, value = line.partition(":")
                    records.append({
                        "user_agent": current_ua,
                        "rule": directive.strip(),
                        "value": value.strip(),
                    })
        except Exception as e:
            self.logger.warning(f"Manual robots.txt fetch failed: {e}")
        if not records:
            return pd.DataFrame()
        return pd.DataFrame(records)

    async def analyze_crawl_budget(
        self,
        sitemap_url: str,
        site_domain: str,
        fallback_sitemap_urls: Optional[List[str]] = None,
        known_sitemap_total: Optional[int] = None,
        primary_sitemap_attempted: bool = False,
    ) -> Dict[str, Any]:
        """
        Analyze crawl budget by comparing sitemap inventory against actual crawl results.
        Estimates budget utilization, waste from redirects/errors, and optimization score.

        If `known_sitemap_total` is supplied (e.g. from a prior sitemap analysis in the
        same run), the sitemap is NOT re-fetched — re-fetching a rate-limited sitemap
        (HTTP 429) repeatedly just burns time and can hard-trip the origin's rate limiter.

        If `primary_sitemap_attempted` is True, the primary sitemap URL was already
        fetched (and possibly failed, e.g. with 429s) earlier in the same run, so it is
        not retried here — only robots.txt fallback sitemaps are attempted.
        """
        temp_file = None
        try:
            self.logger.info(f"Analyzing crawl budget for {site_domain}")
            loop = asyncio.get_event_loop()

            sitemap_total = 0
            if known_sitemap_total is not None and known_sitemap_total > 0:
                sitemap_total = int(known_sitemap_total)
                self.logger.info(
                    f"Crawl budget: reusing sitemap total {sitemap_total} from prior "
                    f"sitemap analysis (skipping re-fetch of {sitemap_url})."
                )
            else:
                sitemap_df = None
                if primary_sitemap_attempted:
                    self.logger.info(
                        f"Crawl budget: primary sitemap {sitemap_url} already fetched "
                        f"earlier in this run; not re-fetching it. Trying fallbacks only."
                    )
                else:
                    _throttle_domain_sync(_extract_domain(sitemap_url))
                    sitemap_df = await loop.run_in_executor(
                        None, lambda: self._sitemap_to_df_with_retry(sitemap_url)
                    )
                # Fallback: if the primary sitemap 429'd on every attempt, try robots.txt sitemaps
                if (sitemap_df is None or sitemap_df.empty) and fallback_sitemap_urls:
                    for fb in fallback_sitemap_urls:
                        if not fb or fb == sitemap_url:
                            continue
                        self.logger.info(f"Primary sitemap failed, trying fallback: {fb}")
                        _throttle_domain_sync(_extract_domain(fb))
                        sitemap_df = await loop.run_in_executor(None, lambda u=fb: self._sitemap_to_df_with_retry(u))
                        if sitemap_df is not None and not sitemap_df.empty:
                            break
                if sitemap_df is None or sitemap_df.empty:
                    self.logger.warning(
                        f"Crawl budget: no sitemap data available for {sitemap_url} "
                        f"(fallbacks={fallback_sitemap_urls or []}). Crawling site root only."
                    )
                sitemap_total = len(sitemap_df) if sitemap_df is not None and not sitemap_df.empty else 0

            start_url = f"https://{site_domain}" if not site_domain.startswith("http") else site_domain

            with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as tf:
                temp_file = tf.name

            # Conservative crawl settings to avoid tripping per-domain rate limits.
            # The sitemap fetch above already hit 429s on some origins, so we throttle
            # the crawl hard and let scrapy retry 429s with a delay instead of failing.
            await loop.run_in_executor(None, lambda: adv.crawl(
                url_list=[start_url],
                output_file=temp_file,
                follow_links=True,
                allowed_domains=[site_domain],
                custom_settings={
                    'LOG_LEVEL': 'WARNING',
                    'CLOSESPIDER_PAGECOUNT': 30,
                    'DOWNLOAD_TIMEOUT': 20,
                    'CONCURRENT_REQUESTS_PER_DOMAIN': 2,
                    'DOWNLOAD_DELAY': 0.8,
                    'RANDOMIZE_DOWNLOAD_DELAY': True,
                    'AUTOTHROTTLE_ENABLED': True,
                    'AUTOTHROTTLE_START_DELAY': 1.0,
                    'AUTOTHROTTLE_MAX_DELAY': 5.0,
                    'AUTOTHROTTLE_TARGET_CONCURRENCY': 1.0,
                    'RETRY_ENABLED': True,
                    'DOWNLOAD_FAIL_ON_DATALOSS': False,
                    'RETRY_TIMES': 2,
                    'RETRY_DELAY': 3.0,
                    'DEPTH_LIMIT': 2,
                }
            ))

            if not os.path.exists(temp_file) or os.path.getsize(temp_file) == 0:
                return {"success": False, "error": "Crawl produced no output"}

            crawl_df = pd.read_json(temp_file, lines=True)
            crawled_count = len(crawl_df)

            status_dist = {}
            if 'status' in crawl_df.columns:
                raw = crawl_df['status'].value_counts().to_dict()
                status_dist = {str(k): int(v) for k, v in raw.items()}

            wasted = 0
            for code_s in status_dist:
                code = int(code_s)
                if code >= 300 or code < 200:
                    wasted += status_dist[code_s]

            budget_usage_ratio = round(crawled_count / max(sitemap_total, 1), 3)
            waste_ratio = round(wasted / max(crawled_count, 1), 3)

            depth_dist = {}
            if 'depth' in crawl_df.columns:
                raw = crawl_df['depth'].value_counts().sort_index().to_dict()
                depth_dist = {str(k): int(v) for k, v in raw.items()}

            param_count = 0
            url_col = 'url' if 'url' in crawl_df.columns else 'response_url' if 'response_url' in crawl_df.columns else None
            if url_col:
                # Literal `?` (not a regex repetition operator).
                param_count = int(crawl_df[url_col].astype(str).str.contains('?', regex=False).sum())

            optimization_score = max(0, round(100 - (waste_ratio * 100) - (budget_usage_ratio * 20), 1))

            return {
                "success": True,
                "sitemap_total_urls": sitemap_total,
                "pages_crawled": crawled_count,
                "crawl_coverage_percentage": round(budget_usage_ratio * 100, 1),
                "status_distribution": status_dist,
                "wasted_crawl_requests": int(wasted),
                "waste_percentage": round(waste_ratio * 100, 1),
                "depth_distribution": depth_dist,
                "urls_with_parameters": int(param_count),
                "optimization_score": optimization_score,
            }

        except Exception as e:
            self.logger.error(f"Crawl budget analysis failed: {e}")
            return {"success": False, "error": str(e)}
        finally:
            if temp_file and os.path.exists(temp_file):
                try: os.remove(temp_file)
                except Exception: pass

    async def sitemap_compare(self, sitemap_a: str, sitemap_b: str) -> Dict[str, Any]:
        """
        Compare two sitemaps for competitive content gap analysis.
        Analyzes URL count, freshness, directory pillars, and identifies
        patterns unique to each sitemap.
        """
        try:
            self.logger.info(f"Comparing sitemaps: {sitemap_a} vs {sitemap_b}")
            loop = asyncio.get_event_loop()

            _throttle_domain_sync(_extract_domain(sitemap_a))
            _throttle_domain_sync(_extract_domain(sitemap_b))
            df_a = await loop.run_in_executor(
                None, lambda: self._sitemap_to_df_with_retry(sitemap_a)
            )
            df_b = await loop.run_in_executor(
                None, lambda: self._sitemap_to_df_with_retry(sitemap_b)
            )

            total_a = len(df_a) if df_a is not None and not df_a.empty else 0
            total_b = len(df_b) if df_b is not None and not df_b.empty else 0
            result = {
                "success": True,
                "sitemap_a": {"url": sitemap_a, "total_urls": total_a},
                "sitemap_b": {"url": sitemap_b, "total_urls": total_b},
                "url_count_diff": total_a - total_b,
                "ratio": round(total_a / max(total_b, 1), 2),
                "pillars_a": {},
                "pillars_b": {},
                "shared_pillars": [],
                "unique_to_a": [],
                "unique_to_b": [],
                "freshness_comparison": {},
                "overlap_score": 0,
            }

            if total_a == 0 or total_b == 0:
                return result

            def extract_pillars(df: pd.DataFrame, label: str) -> Tuple[dict, list]:
                pillars = {}
                if 'loc' in df.columns:
                    try:
                        url_df = adv.url_to_df(df['loc'])
                        if url_df is not None and not url_df.empty:
                            dir_cols = [c for c in url_df.columns if c.startswith('dir_')]
                            if dir_cols:
                                pillar_series = url_df[dir_cols[0]].fillna("home").astype(str)
                                for col in dir_cols[1:3]:
                                    mask = url_df[col].notna() & (url_df[col].astype(str) != 'nan')
                                    pillar_series = pillar_series + "/" + url_df[col].where(mask, "")
                                pillars = pillar_series.value_counts().head(20).to_dict()
                    except Exception:
                        pass

                if not pillars:
                    seen = {}
                    for url in df['loc'].dropna():
                        parts = urlparse(url).path.strip('/').split('/')
                        key = parts[0] if parts and parts[0] else "home"
                        seen[key] = seen.get(key, 0) + 1
                    pillars = dict(sorted(seen.items(), key=lambda x: x[1], reverse=True)[:20])

                pillar_keys = list(pillars.keys()) if pillars else []
                return pillars, pillar_keys

            pillars_a, keys_a = extract_pillars(df_a, "a")
            pillars_b, keys_b = extract_pillars(df_b, "b")
            result["pillars_a"] = pillars_a
            result["pillars_b"] = pillars_b

            set_a = set(keys_a)
            set_b = set(keys_b)
            shared = set_a & set_b
            result["shared_pillars"] = sorted(shared)
            result["unique_to_a"] = sorted(set_a - set_b)
            result["unique_to_b"] = sorted(set_b - set_a)

            total_keys = max(len(set_a | set_b), 1)
            overlap_count = len(shared)
            result["overlap_score"] = round((overlap_count / total_keys) * 100, 1)

            def compute_freshness_stats(df: pd.DataFrame) -> dict:
                stats = {"has_lastmod": False, "recent_30d": 0, "total_with_dates": 0}
                if 'lastmod' in df.columns:
                    lm = pd.to_datetime(df['lastmod'], errors='coerce', utc=True).dropna()
                    if not lm.empty:
                        stats["has_lastmod"] = True
                        stats["total_with_dates"] = int(len(lm))
                        stats["recent_30d"] = int((lm > (datetime.now(lm.dt.tz) - timedelta(days=30))).sum())
                return stats

            result["freshness_comparison"] = {
                "a": compute_freshness_stats(df_a),
                "b": compute_freshness_stats(df_b),
            }

            return result

        except Exception as e:
            self.logger.error(f"Sitemap comparison failed: {e}")
            return {"success": False, "error": str(e)}

    async def compare_crawl_results(self, result_a: Dict[str, Any], result_b: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compare two crawl analysis result dicts to surface changes over time.
        Useful for tracking SEO improvements between scheduled executions.
        """
        try:
            diff = {
                "success": True,
                "page_count_change": 0,
                "status_distribution_changes": {},
                "link_health_changes": {},
                "redirect_changes": {},
                "new_issues": [],
                "resolved_issues": [],
            }

            pc_a = result_a.get("page_count", 0)
            pc_b = result_b.get("page_count", 0)
            diff["page_count_change"] = pc_b - pc_a

            sd_a = result_a.get("page_status", {})
            sd_b = result_b.get("page_status", {})
            all_codes = set(list(sd_a.keys()) + list(sd_b.keys()))
            for c in sorted(all_codes):
                va = sd_a.get(c, 0)
                vb = sd_b.get(c, 0)
                change = vb - va
                if change != 0:
                    diff["status_distribution_changes"][c] = change

            def _safe_diff(d_a: dict, d_b: dict, prefix: str) -> dict:
                changes = {}
                all_keys = set(list(d_a.keys()) + list(d_b.keys()))
                for k in all_keys:
                    va = d_a.get(k, 0)
                    vb = d_b.get(k, 0)
                    if isinstance(va, (int, float)) and isinstance(vb, (int, float)):
                        change = round(vb - va, 2)
                        if change != 0:
                            changes[f"{prefix}_{k}"] = change
                return changes

            lh_a = result_a.get("link_health", {})
            lh_b = result_b.get("link_health", {})
            diff["link_health_changes"] = _safe_diff(lh_a, lh_b, "link")

            rd_a = result_a.get("redirect_audit", {})
            rd_b = result_b.get("redirect_audit", {})
            diff["redirect_changes"] = _safe_diff(rd_a, rd_b, "redirect")

            return diff

        except Exception as e:
            self.logger.error(f"Crawl comparison failed: {e}")
            return {"success": False, "error": str(e)}

    async def extract_communication_style(self, url_list: List[str]) -> Dict[str, Any]:
        """
        Analyzes linking patterns and social media presence using unique temporary files.
        """
        temp_file = None
        try:
            self.logger.info(f"Extracting communication style for {len(url_list)} URLs")
            
            with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as tf:
                temp_file = tf.name

            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, lambda: adv.crawl(
                url_list=url_list,
                output_file=temp_file,
                follow_links=False,
                custom_settings={
                    'LOG_LEVEL': 'WARNING',
                    'CLOSESPIDER_PAGECOUNT': 10,
                    'DOWNLOAD_TIMEOUT': 30,
                    'DOWNLOAD_FAIL_ON_DATALOSS': False,
                }
            ))
            
            if not os.path.exists(temp_file) or os.path.getsize(temp_file) == 0:
                return {"success": False, "error": "Link extraction crawl failed."}

            crawl_df = pd.read_json(temp_file, lines=True)
            
            # Extract social links and internal/external stats
            all_links = []
            if 'links_url' in crawl_df.columns:
                for links in crawl_df['links_url'].dropna():
                    if isinstance(links, str):
                        all_links.extend(links.split("@@"))
                    elif isinstance(links, list):
                        all_links.extend(links)

            if not all_links:
                return {"success": True, "social_links": [], "link_stats": {"total_links_found": 0, "unique_domains": 0}}

            # Analyze links
            link_df = adv.url_to_df(all_links)
            
            social_domains = ['twitter.com', 'x.com', 'linkedin.com', 'facebook.com', 'instagram.com', 'youtube.com', 'github.com']
            social_links = []
            if not link_df.empty and 'netloc' in link_df.columns:
                social_links = link_df[link_df['netloc'].isin(social_domains)]['url'].unique().tolist()
            
            return {
                "success": True,
                "social_links": social_links,
                "link_stats": {
                    "total_links_found": len(all_links),
                    "unique_domains": link_df['netloc'].nunique() if not link_df.empty else 0
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            self.logger.error(f"Failed to extract communication style: {str(e)}")
            return {"success": False, "error": str(e)}
        finally:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except Exception as e:
                    self.logger.warning(f"Failed to remove temp file {temp_file}: {e}")
