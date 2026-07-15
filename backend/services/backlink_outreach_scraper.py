"""Deep website scraper for backlink outreach discovery.

Orchestrates Exa neural search + DuckDuckGo fallback to find guest-post
opportunities with full-page content extraction and quality scoring.
"""

from __future__ import annotations

import asyncio
import base64
import json
import re
from typing import Any, Dict, List, Optional
from urllib.parse import quote, urlparse

import httpx
from bs4 import BeautifulSoup
from loguru import logger


class BacklinkOutreachScraper:
    """Scrapes websites for backlink outreach opportunities using Exa + DuckDuckGo."""

    GUEST_POST_KEYWORDS = [
        "write for us", "guest post", "submit guest post",
        "guest contributor", "become a guest blogger", "guest bloggers wanted",
        "add guest post", "submit article", "guest post opportunities",
        "contribute to our blog", "write for our blog",
    ]

    def __init__(self, user_id: Optional[str] = None):
        self.user_id = user_id
        self._exa_svc = None
        self._exa_provider = None  # ExaResearchProvider (richer search)

    # -- Public API --

    async def deep_discover(
        self,
        keyword: str,
        max_results: int = 15,
        scrape_timeout_seconds: float = 15.0,
        scrape_max_concurrency: int = 5,
    ) -> Dict[str, Any]:
        """Discover guest-post opportunities using Exa, falling back to DuckDuckGo."""
        if self._is_exa_available():
            logger.info(f"[BacklinkScraper] Using Exa for keyword: {keyword}")
            return await self._discover_with_exa(keyword, max_results)
        logger.info(f"[BacklinkScraper] Exa unavailable, falling back to DuckDuckGo for: {keyword}")
        return await self._discover_with_duckduckgo(
            keyword,
            max_results,
            scrape_timeout_seconds=scrape_timeout_seconds,
            scrape_max_concurrency=scrape_max_concurrency,
        )

    async def scrape_urls(
        self,
        urls: List[str],
        timeout_seconds: float = 15.0,
        max_concurrency: int = 5,
    ) -> List[Dict[str, Any]]:
        """Fetch full page content with non-blocking fallbacks and bounded concurrency."""
        exa = self._get_exa_sdk()
        if not exa:
            return await self._scrape_urls_fallback(
                urls, timeout_seconds=timeout_seconds, max_concurrency=max_concurrency
            )
        loop = asyncio.get_running_loop()
        try:
            result = await loop.run_in_executor(
                None, lambda: exa.get_contents(urls, text={"max_characters": 5000})
            )
            return self._parse_get_contents_result(result)
        except Exception as e:
            logger.warning(f"[BacklinkScraper] Exa get_contents failed: {e}")
            return await self._scrape_urls_fallback(
                urls, timeout_seconds=timeout_seconds, max_concurrency=max_concurrency
            )

    # -- Availability --

    def _is_exa_available(self) -> bool:
        try:
            exa = self._get_exa_sdk()
            return exa is not None
        except Exception:
            return False

    def _get_exa_sdk(self):
        """Get Exa SDK instance via ExaService, respecting per-user API key."""
        if self._exa_svc is None:
            from services.research.exa_service import ExaService
            self._exa_svc = ExaService()
        self._exa_svc._try_initialize()
        return self._exa_svc.exa if self._exa_svc.enabled else None

    def _get_exa_provider(self):
        """Lazy-init ExaResearchProvider (canonical Exa integration with preflight/tracking)."""
        if self._exa_provider is None:
            try:
                from services.research.exa_research_provider import ExaResearchProvider
                self._exa_provider = ExaResearchProvider()
            except Exception as e:
                logger.warning(f"[BacklinkScraper] ExaResearchProvider unavailable: {e}")
                return None
        return self._exa_provider

    # -- Exa Discovery --

    async def _discover_with_exa(self, keyword: str, max_results: int) -> Dict[str, Any]:
        provider = self._get_exa_provider()
        if not provider:
            return await self._discover_with_duckduckgo(keyword, max_results)

        queries = self._generate_search_queries(keyword)
        dedup: Dict[str, Dict[str, Any]] = {}
        results_per_query = max(1, max_results // len(queries))

        for query in queries[:4]:
            rows = await provider.search_contents(
                query,
                num_results=results_per_query,
                user_id=self.user_id,
                text_max_characters=5000,
            )
            for row in rows:
                norm_url = self._normalize_url(row.get("url", ""))
                if not norm_url or norm_url in dedup:
                    continue
                dedup[norm_url] = row
            if len(dedup) >= max_results:
                break

        opportunities = self._build_enriched_opportunities(dedup, keyword, "exa")
        opportunities = await asyncio.gather(*[
            self._enhance_email_discovery(opp) for opp in opportunities
        ])

        email_stats = self._compute_email_stats(opportunities)

        return {
            "keyword": keyword,
            "source": "exa",
            "total_found": len(opportunities),
            "queries": queries,
            "email_stats": email_stats,
            "opportunities": opportunities,
        }

    def _parse_get_contents_result(self, result) -> List[Dict[str, Any]]:
        rows = []
        results = getattr(result, "results", [])
        for r in results:
            rows.append({
                "url": getattr(r, "url", ""),
                "title": getattr(r, "title", ""),
                "text": getattr(r, "text", ""),
                "highlights": getattr(r, "highlights", []),
                "summary": getattr(r, "summary", ""),
            })
        return rows

    # -- DuckDuckGo Fallback Discovery --

    async def _discover_with_duckduckgo(
        self,
        keyword: str,
        max_results: int,
        scrape_timeout_seconds: float = 15.0,
        scrape_max_concurrency: int = 5,
    ) -> Dict[str, Any]:
        queries = self._generate_search_queries(keyword)
        dedup: Dict[str, Dict[str, Any]] = {}

        async with httpx.AsyncClient(timeout=httpx.Timeout(12.0), follow_redirects=True) as client:
            for query in queries[:4]:
                rows = await self._duckduckgo_search(query, client=client)
                for row in rows:
                    norm_url = self._normalize_url(row.get("url", ""))
                    if not norm_url or norm_url in dedup:
                        continue
                    dedup[norm_url] = row
                if len(dedup) >= max_results:
                    break
                await asyncio.sleep(0.4)

        # Scrape discovered URLs with Exa get_contents (or fallback)
        urls_to_scrape = list(dedup.keys())[:max_results]
        scraped = await self.scrape_urls(
            urls_to_scrape,
            timeout_seconds=scrape_timeout_seconds,
            max_concurrency=scrape_max_concurrency,
        )
        scraped_map = {self._normalize_url(s.get("url", "")): s for s in scraped}

        # Merge DDG results with scraped content
        merged = {}
        for norm_url, ddg_row in dedup.items():
            full = scraped_map.get(norm_url, {})
            merged[norm_url] = {
                "url": norm_url,
                "title": full.get("title") or ddg_row.get("title", ""),
                "text": full.get("text", ""),
                "highlights": full.get("highlights", ddg_row.get("highlights", [])),
                "summary": full.get("summary", ddg_row.get("snippet", "")),
                "snippet": ddg_row.get("snippet", ""),
                "score": 0.5,
            }

        opportunities = self._build_enriched_opportunities(merged, keyword, "duckduckgo")
        opportunities = await asyncio.gather(*[
            self._enhance_email_discovery(opp) for opp in opportunities
        ])

        email_stats = self._compute_email_stats(opportunities)
        queries = self._generate_search_queries(keyword)

        return {
            "keyword": keyword,
            "source": "duckduckgo",
            "total_found": len(opportunities),
            "queries": queries,
            "email_stats": email_stats,
            "opportunities": opportunities,
        }

    async def _duckduckgo_search(
        self,
        query: str,
        retries: int = 2,
        client: Optional[httpx.AsyncClient] = None,
    ) -> List[Dict[str, Any]]:
        encoded = quote(query)
        url = f"https://duckduckgo.com/html/?q={encoded}"
        headers = {"User-Agent": "Mozilla/5.0 ALwrityBacklinkBot/1.0"}

        async def _request(active_client: httpx.AsyncClient) -> List[Dict[str, Any]]:
            for attempt in range(retries + 1):
                try:
                    resp = await active_client.get(url, headers=headers)
                    resp.raise_for_status()
                    soup = BeautifulSoup(resp.text, "html.parser")
                    results = []
                    for result in soup.select("div.result")[:10]:
                        anchor = result.select_one("a.result__a")
                        snippet_el = result.select_one("a.result__snippet") or result.select_one("div.result__snippet")
                        if not anchor or not anchor.get("href"):
                            continue
                        results.append({
                            "url": anchor.get("href"),
                            "title": anchor.get_text(strip=True),
                            "snippet": snippet_el.get_text(" ", strip=True) if snippet_el else "",
                            "highlights": [],
                        })
                    return results
                except (httpx.HTTPError, httpx.TimeoutException):
                    if attempt == retries:
                        return []
                    await asyncio.sleep(0.6 * (attempt + 1))
            return []

        if client is not None:
            return await _request(client)

        async with httpx.AsyncClient(timeout=httpx.Timeout(12.0), follow_redirects=True) as owned_client:
            return await _request(owned_client)

    async def _scrape_urls_fallback(
        self,
        urls: List[str],
        timeout_seconds: float = 15.0,
        max_concurrency: int = 5,
    ) -> List[Dict[str, Any]]:
        """Basic async HTTP scrape when Exa is unavailable."""
        headers = {"User-Agent": "Mozilla/5.0 ALwrityBacklinkBot/1.0"}
        semaphore = asyncio.Semaphore(max(1, max_concurrency))
        timeout = httpx.Timeout(timeout_seconds)

        async def scrape_one(client: httpx.AsyncClient, url: str) -> Optional[Dict[str, Any]]:
            async with semaphore:
                try:
                    resp = await client.get(url, headers=headers)
                    resp.raise_for_status()
                    soup = BeautifulSoup(resp.text, "html.parser")
                    for tag in soup(["script", "style", "nav", "footer", "header"]):
                        tag.decompose()
                    text = soup.get_text(separator=" ", strip=True)
                    title = soup.title.get_text(strip=True) if soup.title else ""
                    return {"url": url, "title": title, "text": text[:5000], "highlights": [], "summary": ""}
                except (httpx.HTTPError, httpx.TimeoutException):
                    return None

        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            tasks = [scrape_one(client, url) for url in urls]
            scraped = await asyncio.gather(*tasks)
        return [row for row in scraped if row]

    # -- Enrichment Pipeline --

    def _build_enriched_opportunities(
        self, dedup: Dict[str, Dict[str, Any]], keyword: str, source: str
    ) -> List[Dict[str, Any]]:
        opportunities = []
        for norm_url, row in dedup.items():
            text = row.get("text", "")
            title = row.get("title", row.get("snippet", ""))
            quality = self._score_quality(text, title)
            contacts = self._extract_contacts(text)
            domain = self._extract_domain(norm_url)
            has_guidelines = self._check_guest_post_signals(text)

            opportunities.append({
                "url": norm_url,
                "domain": domain,
                "page_title": title,
                "snippet": row.get("snippet") or (text[:300] if text else ""),
                "full_text": text[:5000],
                "email": contacts.get("email"),
                "all_emails": contacts.get("all_emails", []),
                "contact_page": contacts.get("contact_page"),
                "confidence_score": min(1.0, quality + 0.1),
                "quality_score": quality,
                "word_count": len(text.split()),
                "has_guest_post_guidelines": has_guidelines,
                "discovery_source": source,
                "exa_score": row.get("score"),
                "exa_author": row.get("author"),
                "exa_published_date": row.get("published_date"),
                "exa_summary": (row.get("summary") or "")[:500],
                "exa_highlights": row.get("highlights", []),
            })
        opportunities.sort(key=lambda x: x["quality_score"], reverse=True)
        return opportunities

    def _compute_email_stats(self, opportunities: List[Dict[str, Any]]) -> Dict[str, Any]:
        total = len(opportunities)
        with_email = sum(1 for opp in opportunities if opp.get("email"))
        from_contact = sum(1 for opp in opportunities if opp.get("discovery_source", "").endswith("+contact_page"))
        from_tavily = sum(1 for opp in opportunities if opp.get("discovery_source", "").endswith("+tavily"))
        from_guessed = sum(1 for opp in opportunities if opp.get("discovery_source", "").endswith("+guessed"))
        from_ai = sum(1 for opp in opportunities if opp.get("discovery_source", "").endswith("+ai"))
        from_regex = with_email - from_contact - from_tavily - from_guessed - from_ai
        total_emails = sum(len(opp.get("all_emails", [])) for opp in opportunities)
        return {
            "total": total,
            "with_email": with_email,
            "total_emails_found": total_emails,
            "from_regex": max(0, from_regex),
            "from_contact_page": from_contact,
            "from_tavily": from_tavily,
            "from_guessed": from_guessed,
            "from_ai": from_ai,
        }

    def _extract_domain(self, url: str) -> str:
        try:
            return urlparse(url).netloc
        except Exception:
            return url

    def _normalize_url(self, url: str) -> str:
        u = (url or "").strip().strip("`")
        if not u:
            return ""
        if u.startswith("//"):
            u = f"https:{u}"
        if not re.match(r"^https?://", u):
            return ""
        return u.split("#")[0].rstrip("/")

    def _extract_contacts(self, text: str) -> Dict[str, Any]:
        result: Dict[str, Any] = {"email": None, "contact_page": None, "all_emails": []}
        if not text:
            return result

        # -- Collect ALL email addresses from all patterns --
        all_found: List[str] = []

        # 1. Standard email addresses
        all_found.extend(re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", text))

        # 2. mailto: links (common in HTML)
        all_found.extend(
            re.findall(r'mailto:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})', text)
        )

        # 3. Obfuscated emails — handle [at], (at), {at}, <at>, etc.
        for match in re.finditer(
            r'([A-Za-z0-9._%+-]+)\s*[\[({<]?\s*at\s*[])}>]?\s*([A-Za-z0-9.-]+)\s*[\[({<]?\s*dot\s*[])}>]?\s*([A-Za-z]{2,})',
            text, re.IGNORECASE,
        ):
            all_found.append(f"{match.group(1)}@{match.group(2)}.{match.group(3)}")
        # 4. 'user at domain.com' — at without dot TLD separator (min 3-char username to reduce false positives)
        for match in re.finditer(
            r'([A-Za-z0-9._%+-]{3,})\s*[\[({<]?\s*at\s*[])}>]?\s*@?\s*([A-Za-z0-9.-]+\.[A-Za-z]{2,})',
            text, re.IGNORECASE,
        ):
            all_found.append(f"{match.group(1)}@{match.group(2)}")
        # 5. Unicode fullwidth obfuscation (e.g. ｕｓｅｒ＠ｄｏｍａｉｎ．ｃｏｍ)
        for match in re.finditer(
            r'([Ａ-Ｚａ-ｚ０-９._%+-]+)＠([Ａ-Ｚａ-ｚ０-９.-]+)．([Ａ-Ｚａ-ｚ]{2,})',
            text,
        ):
            local = match.group(1).translate(str.maketrans(
                "ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ"
                "ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ"
                "０１２３４５６７８９._%+-",
                "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                "abcdefghijklmnopqrstuvwxyz"
                "0123456789._%+-"
            ))
            domain = match.group(2).translate(str.maketrans(
                "ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ"
                "ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ"
                "０１２３４５６７８９.-",
                "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                "abcdefghijklmnopqrstuvwxyz"
                "0123456789.-"
            ))
            tld = match.group(3).translate(str.maketrans(
                "ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ",
                "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
            ))
            all_found.append(f"{local}@{domain}.{tld}")

        # Deduplicate and pick first as primary, keep top 5
        seen: set = set()
        unique: List[str] = []
        for e in all_found:
            e_clean = e.strip().lower()
            if e_clean and e_clean not in seen:
                seen.add(e_clean)
                unique.append(e.strip())
        result["all_emails"] = unique[:5]
        result["email"] = unique[0] if unique else None

        # Contact page URLs (expanded patterns)
        contact_match = re.search(
            r"(https?://[^\s\"'<>]*(?:"
            r"contact|about|team|staff|authors?|contributors?|"
            r"write-for-us|guest-post|submissions?|editorial|"
            r"about-us|our-team|meet-the-team|leadership"
            r")[^\s\"'<>]*)",
            text, re.IGNORECASE,
        )
        if contact_match:
            result["contact_page"] = contact_match.group(1).rstrip("/")
        return result

    async def _scrape_url_for_emails(self, url: str, timeout_seconds: float = 15.0) -> Optional[str]:
        """Scrape a URL and extract the first email found (Tavily Extract + fallback httpx/BS4)."""
        content = await self._scrape_url_for_content(url, timeout_seconds=timeout_seconds)
        if content:
            contacts = self._extract_contacts(content)
            return contacts.get("email")
        return None

    async def _scrape_url_with_tavily(self, url: str) -> Optional[str]:
        """Use Tavily Extract to get clean markdown content from a URL.
        Returns clean markdown with boilerplate removed, or None if unavailable.
        """
        try:
            from services.research.tavily_service import TavilyService
            tavily = TavilyService()
            if not tavily.enabled:
                return None
            result = await tavily.extract(urls=url, extract_depth="basic")
            if result.get("success") and result.get("results"):
                raw = result["results"][0].get("raw_content", "")
                if raw and len(raw.strip()) > 100:
                    return raw
            return None
        except Exception as e:
            logger.debug(f"[BacklinkScraper] Tavily Extract failed for {url}: {e}")
            return None

    async def _scrape_url_for_content(self, url: str, timeout_seconds: float = 15.0) -> Optional[str]:
        """Scrape a URL for full page text. Tries Tavily Extract first (clean markdown),
        falls back to httpx + BeautifulSoup.
        In both paths, also fetches raw HTML for CF/base64 email decoding.
        """
        tavily_content = await self._scrape_url_with_tavily(url)

        # Always try raw HTML for CF/base64-protected emails
        raw_text = None
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(timeout_seconds), follow_redirects=True) as client:
                headers = {"User-Agent": "Mozilla/5.0 ALwrityBacklinkBot/1.0"}
                resp = await client.get(url, headers=headers)
                resp.raise_for_status()
                raw_html = resp.text
                hidden_emails = []
                hidden_emails.extend(self._decode_cf_email(raw_html))
                hidden_emails.extend(self._decode_base64_emails(raw_html))
                soup = BeautifulSoup(raw_html, "html.parser")
                raw_text = soup.get_text(separator=" ", strip=True)
                if hidden_emails:
                    raw_text += " " + " ".join(hidden_emails)
        except Exception as e:
            logger.debug(f"[BacklinkScraper] Raw HTML fetch failed for {url}: {e}")

        if tavily_content and raw_text:
            return tavily_content + "\n" + raw_text[:3000]
        if tavily_content:
            return tavily_content
        return raw_text

    async def _tavily_search_for_contact(self, domain: str) -> Optional[str]:
        """Use Tavily to search for contact email for a domain."""
        try:
            from services.research.tavily_service import TavilyService
            tavily = TavilyService()
            if not tavily.enabled:
                return None
            query = f"{domain} email address contact"
            result = await tavily.search(query, max_results=5, include_raw_content="text")
            sources = result.get("results", [])
            for src in sources:
                content = src.get("content", "") or src.get("raw_content", "") or ""
                if content:
                    contacts = self._extract_contacts(content)
                    if contacts.get("email"):
                        return contacts["email"]
        except Exception as e:
            logger.debug(f"[BacklinkScraper] Tavily contact search failed for {domain}: {e}")
        return None

    _COMMON_EMAIL_PREFIXES = [
        "info", "hello", "contact", "editor", "team", "support",
        "admin", "hi", "hey", "editorial", "submissions",
        "contributors", "writers", "pitch", "tips", "press",
    ]

    @staticmethod
    def _decode_cf_email(html: str) -> List[str]:
        """Decode CloudFlare email-protected emails from raw HTML.
        Looks for data-cfemail attributes and decrypts them.
        """
        found: List[str] = []
        for match in re.finditer(r'data-cfemail=["\']([A-Fa-f0-9]+)["\']', html):
            hex_str = match.group(1)
            try:
                raw_bytes = bytes.fromhex(hex_str)
                if len(raw_bytes) < 2:
                    continue
                key = raw_bytes[0]
                decrypted = []
                for i, b in enumerate(raw_bytes[1:]):
                    decrypted.append(b ^ ((key + i) & 0xFF))
                email = bytes(decrypted).decode("utf-8", errors="replace")
                if "@" in email and "." in email.split("@")[-1]:
                    found.append(email.strip())
            except Exception:
                continue
        return found

    @staticmethod
    def _decode_base64_emails(text: str) -> List[str]:
        """Extract emails from base64-encoded JS atob() calls in HTML."""
        found: List[str] = []
        for match in re.finditer(r"""(?:window\.)?atob\s*\(\s*['"]([A-Za-z0-9+/=]+)['"]\s*\)""", text):
            try:
                decoded = base64.b64decode(match.group(1)).decode("utf-8", errors="replace")
                if "@" in decoded and "." in decoded.split("@")[-1]:
                    found.append(decoded.strip())
            except Exception:
                continue
        return found

    @staticmethod
    def _guess_common_email(domain: str) -> Optional[str]:
        """Try common email prefixes for a domain (e.g. info@domain.com)."""
        if not domain or "." not in domain:
            return None
        domain = domain.strip().lower()
        # Skip generic TLD-only (just in case)
        if len(domain.split(".")) < 2:
            return None
        # Try the most likely prefixes
        for prefix in ["info", "hello", "contact", "editor", "team"]:
            candidate = f"{prefix}@{domain}"
            # Basic sanity — must look like a valid email
            if re.match(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$", candidate):
                return candidate
        return None

    async def _enhance_email_discovery(self, opportunity: Dict[str, Any]) -> Dict[str, Any]:
        """Async enhancement: scrape contact pages + Tavily search for missing emails."""
        if opportunity.get("email"):
            return opportunity
        domain = opportunity.get("domain", "")
        contact_page = opportunity.get("contact_page", "")

        # Try scraping the contact page first
        if contact_page:
            email = await self._scrape_url_for_emails(contact_page)
            if email:
                opportunity["email"] = email
                opportunity["discovery_source"] = opportunity.get("discovery_source", "") + "+contact_page"
                return opportunity

        # Fall back to scraping the main domain URL
        url = opportunity.get("url", "")
        if url and url != contact_page:
            email = await self._scrape_url_for_emails(url)
            if email:
                opportunity["email"] = email
                opportunity["discovery_source"] = opportunity.get("discovery_source", "") + "+url_scrape"
                return opportunity

        # Try Tavily search for the domain
        if domain:
            email = await self._tavily_search_for_contact(domain)
            if email:
                opportunity["email"] = email
                opportunity["discovery_source"] = opportunity.get("discovery_source", "") + "+tavily"
                return opportunity

        # Last resort: guess common email prefixes (info@, contact@, hello@, etc.)
        if domain:
            guessed = self._guess_common_email(domain)
            if guessed:
                opportunity["email"] = guessed
                opportunity["discovery_source"] = opportunity.get("discovery_source", "") + "+guessed"
                return opportunity

        return opportunity

    # -- AI Prospecting (LLM-powered analysis) --

    _AI_PROSPECT_STRUCT = {
        "type": "object",
        "properties": {
            "results": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "url": {"type": "string"},
                        "email": {"type": "string"},
                        "contact_page_url": {"type": "string"},
                        "site_active": {"type": "boolean"},
                        "accepts_guest_posts": {"type": "boolean"},
                        "guidelines_summary": {"type": "string"},
                        "relevance_score": {"type": "number"},
                        "editor_name": {"type": "string"},
                        "pitch_angle": {"type": "string"},
                        "risk_flags": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["url", "site_active", "accepts_guest_posts", "relevance_score", "risk_flags"],
                },
            }
        },
        "required": ["results"],
    }

    _AI_PROSPECT_SYSTEM_PROMPT = """You are an expert backlink outreach research assistant.
Analyze each website opportunity and extract structured details.
- ONLY return an email if it is explicitly visible in the content. NEVER guess or construct an email.
- Set site_active to false if the site appears abandoned (no recent posts).
- Set accepts_guest_posts based on explicit signals like "write for us", "guest post guidelines", etc.
- relevance_score: 0.0 (completely irrelevant) to 1.0 (perfect match for the keyword).
  Use Exa Score as a strong prior — if Exa Score is high (>=0.7), the site is likely highly topical even if the snippet is short.
- Rank opportunities within each batch relative to each other: the batch's strongest candidate should get the highest relevance_score.
- risk_flags: include "no_email", "site_inactive", "no_guest_post_signal", "low_relevance" as appropriate.
- pitch_angle: a one-sentence hook based on the site's apparent content gaps.
- editor_name: the name of an editor or author found on the page, if any.
Return ONLY valid JSON matching the schema."""

    async def ai_prospect_opportunities(
        self,
        opportunities: List[Dict[str, Any]],
        keyword: str,
        user_id: str,
        batch_size: int = 5,
    ) -> List[Dict[str, Any]]:
        """Run LLM analysis on opportunities to extract emails and enrichment data.
        Batches into groups of `batch_size` for efficiency.
        """
        from services.llm_providers.main_text_generation import llm_text_gen

        # Ensure full_text is populated for all opportunities
        # _scrape_url_for_content now tries Tavily Extract first (clean markdown),
        # then falls back to httpx+BeautifulSoup
        scrape_tasks: List[asyncio.Task] = []
        scrape_map: List[Dict[str, Any]] = []
        for opp in opportunities:
            if not opp.get("full_text"):
                url = opp.get("url", "")
                if url:
                    scrape_tasks.append(asyncio.ensure_future(self._scrape_url_for_content(url)))
                    scrape_map.append(opp)
        if scrape_tasks:
            results = await asyncio.gather(*scrape_tasks)
            for scraped, target_opp in zip(results, scrape_map):
                if scraped:
                    target_opp["full_text"] = scraped[:5000]

        enriched: List[Dict[str, Any]] = []

        # Stratified batching: sort by exa_score (preferred) or quality_score,
        # split into 3 quality tiers, then round-robin into batches so each
        # batch has a mix of high/mid/low opportunities. This gives the LLM
        # a calibration anchor for relative ranking.
        sorted_opps = sorted(
            opportunities,
            key=lambda o: o.get("exa_score") if o.get("exa_score") is not None else o.get("quality_score", 0),
            reverse=True,
        )
        n = len(sorted_opps)
        top_end = max(1, int(n * 0.2))
        bot_start = min(n, int(n * 0.8))
        tiers = [
            sorted_opps[:top_end],          # top 20%
            sorted_opps[top_end:bot_start],  # middle 60%
            sorted_opps[bot_start:],         # bottom 20%
        ]

        batches: List[List[Dict[str, Any]]] = []
        tier_order = [0, 1, 2, 1, 1]  # top → mid → low → mid → mid per 5
        pointers = [0, 0, 0]
        batch: List[Dict[str, Any]] = []
        any_remaining = True
        while any_remaining:
            any_remaining = False
            for ti in tier_order:
                if pointers[ti] < len(tiers[ti]):
                    batch.append(tiers[ti][pointers[ti]])
                    pointers[ti] += 1
                    any_remaining = True
                    if len(batch) == batch_size:
                        batches.append(batch)
                        batch = []
        if batch:
            batches.append(batch)

        for batch in batches:
            batch_prompt_parts = []
            for idx, opp in enumerate(batch):
                text = (opp.get("full_text") or opp.get("snippet") or "")[:2500]
                highlights = opp.get("exa_highlights", [])
                exa_summary = (opp.get("exa_summary") or "")[:200]
                gps_count = sum(1 for cue in self.GUEST_POST_KEYWORDS if cue in text.lower())
                batch_prompt_parts.append(
                    f"[{idx + 1}]\n"
                    f"URL: {opp.get('url', '')}\n"
                    f"Domain: {opp.get('domain', '')}\n"
                    f"Title: {opp.get('page_title', '')}\n"
                    f"Exa Score: {opp.get('exa_score', 'N/A')}\n"
                    f"Exa Highlights: {'; '.join(highlights[:2]) if highlights else 'N/A'}\n"
                    f"Exa Summary: {exa_summary if exa_summary else 'N/A'}\n"
                    f"Published: {opp.get('exa_published_date', 'N/A')}\n"
                    f"Author: {opp.get('exa_author', 'N/A')}\n"
                    f"Word Count: {opp.get('word_count', 0)}\n"
                    f"Guest Post Signal Count: {gps_count}\n"
                    f"Content: {text}\n"
                )
            prompt = (
                f"Backlink outreach for keyword: {keyword}\n\n"
                f"Analyze the following {len(batch)} opportunities and return structured JSON:\n\n"
                + "\n---\n".join(batch_prompt_parts)
            )

            try:
                raw = llm_text_gen(
                    prompt=prompt,
                    system_prompt=self._AI_PROSPECT_SYSTEM_PROMPT,
                    json_struct=self._AI_PROSPECT_STRUCT,
                    user_id=user_id,
                    temperature=0.3,
                    max_tokens=2000,
                )
                if isinstance(raw, dict):
                    parsed = raw
                else:
                    parsed = json.loads(raw)
                llm_results = parsed.get("results", [])
            except Exception as e:
                logger.warning(f"[BacklinkScraper] AI prospect batch failed: {e}")
                llm_results = []

            # Merge LLM results back into opportunities
            llm_by_url: Dict[str, Dict[str, Any]] = {}
            for r in llm_results:
                url = (r.get("url") or "").strip().rstrip("/")
                if url:
                    llm_by_url[url] = r

            for opp in batch:
                norm_url = (opp.get("url") or "").strip().rstrip("/")
                llm_data = llm_by_url.get(norm_url, {})
                if llm_data:
                    # Only overwrite email if LLM found one (LLM is more reliable than regex)
                    llm_email = (llm_data.get("email") or "").strip()
                    if llm_email and re.match(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$", llm_email):
                        opp["email"] = llm_email
                        opp["discovery_source"] = opp.get("discovery_source", "") + "+ai"
                    opp["ai_contact_page"] = llm_data.get("contact_page_url") or opp.get("contact_page")
                    opp["ai_site_active"] = llm_data.get("site_active", True)
                    opp["ai_accepts_guest_posts"] = llm_data.get("accepts_guest_posts", False)
                    opp["ai_guidelines_summary"] = llm_data.get("guidelines_summary", "")
                    opp["ai_relevance_score"] = llm_data.get("relevance_score", opp.get("quality_score", 0.5))
                    opp["ai_editor_name"] = llm_data.get("editor_name", "")
                    opp["ai_pitch_angle"] = llm_data.get("pitch_angle", "")
                    opp["ai_risk_flags"] = llm_data.get("risk_flags", [])
                else:
                    # Mark as LLM-processed but no data returned
                    opp["ai_risk_flags"] = opp.get("ai_risk_flags", []) + ["ai_analysis_failed"]
                opp["ai_prospected"] = True
                enriched.append(opp)

        return enriched

    def _score_quality(self, text: str, title: str) -> float:
        score = 0.3
        words = text.split()
        wc = len(words)
        if wc > 2000:
            score += 0.3
        elif wc > 800:
            score += 0.2
        elif wc > 200:
            score += 0.1
        hay = f"{title} {text[:2000]}".lower()
        cues_found = sum(1 for cue in self.GUEST_POST_KEYWORDS if cue in hay)
        score += min(0.3, cues_found * 0.06)
        spam_signals = [
            r"buy\s+links?" in hay, r"cheap\s+backlinks?" in hay,
            r"pbn" in hay, r"private\s+blog\s+network" in hay,
        ]
        if any(spam_signals):
            score -= 0.3
        return max(0.0, min(1.0, score))

    def _check_guest_post_signals(self, text: str) -> bool:
        if not text:
            return False
        hay = text.lower()
        guidelines = [
            "guest post guidelines", "submission guidelines",
            "write for us", "guest post", "submit a guest post",
            "guest contributor guidelines", "contributor guidelines",
        ]
        return any(g in hay for g in guidelines)

    def _generate_search_queries(self, keyword: str) -> List[str]:
        kw = (keyword or "").strip()
        if not kw:
            return []
        return [
            f"{kw} write for us",
            f"{kw} guest post",
            f"{kw} submit guest post",
            f"{kw} guest contributor",
            f"{kw} become a guest blogger",
            f"{kw} add guest post",
            f"{kw} guest post opportunities",
            f"{kw} submit article",
        ]
