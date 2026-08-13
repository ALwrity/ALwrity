"""
Semantic Harvester Service

Crawls web pages using BeautifulSoup-based WebCrawlerLogic.
Prioritises the user's own sitemap URLs (from website analysis)
to avoid external API costs and ban risk.
"""

import os
import traceback
from datetime import datetime
from typing import List, Dict, Any, Optional
from loguru import logger


class SemanticHarvesterService:
    def __init__(self):
        self._harvest_stats = {
            "total_urls_processed": 0,
            "successful_extractions": 0,
            "failed_extractions": 0,
            "last_harvest_time": None
        }

    async def harvest_website(self, website_url: str, limit: int = 100, user_id: Optional[str] = None,
                               progress_callback=None) -> List[Dict[str, Any]]:
        """
        Crawl a website using BeautifulSoup and the user's sitemap.

        Priorities for URL selection:
        1. Sitemap URLs from website analysis (top N by path depth)
        2. Fallback to homepage-only if no sitemap data

        Args:
            website_url: The root URL to crawl.
            limit: Maximum number of pages (capped by MAX_SIF_PAGES_PER_INDEX).
            user_id: Optional user ID for sitemap lookup.
            progress_callback: Optional async callable(current, total) for progress.
        """
        logger.info(f"[SemanticHarvester] Starting harvest for {website_url} (Limit: {limit})")

        results = []

        try:
            if not website_url or not website_url.strip():
                return []

            website_url = website_url.strip()
            if not website_url.startswith(('http://', 'https://')):
                website_url = f"https://{website_url}"

            # Determine page limit from env var (default 10)
            max_pages = int(os.getenv("MAX_SIF_PAGES_PER_INDEX", "10"))
            limit = min(limit, max_pages)
            logger.info(f"[SemanticHarvester] Page limit: {limit}")

            # Resolve URLs to crawl: sitemap first, homepage fallback
            urls_to_crawl = await self._resolve_urls_from_sitemap(website_url, user_id, limit)

            from services.component_logic.web_crawler_logic import WebCrawlerLogic
            crawler = WebCrawlerLogic()

            for i, url in enumerate(urls_to_crawl):
                try:
                    logger.debug(f"[SemanticHarvester] Crawling {i+1}/{len(urls_to_crawl)}: {url}")
                    crawl_result = await crawler.crawl_website(url, use_exa=False)
                    if crawl_result and crawl_result.get("success"):
                        content = crawl_result.get("content", {})
                        text = content.get("main_content", "") or ""
                        if text:
                            results.append({
                                "url": url,
                                "title": content.get("title", url),
                                "content": text[:10_000],
                                "metadata": {
                                    "source": "beautifulsoup",
                                    "word_count": len(text.split()),
                                    "depth": url.count("/") - 2,
                                }
                            })
                            self._harvest_stats["successful_extractions"] += 1
                        else:
                            self._harvest_stats["failed_extractions"] += 1
                    else:
                        self._harvest_stats["failed_extractions"] += 1
                except Exception as crawl_err:
                    logger.warning(f"[SemanticHarvester] Crawl failed for {url}: {crawl_err}")
                    self._harvest_stats["failed_extractions"] += 1
                finally:
                    if progress_callback:
                        try:
                            await progress_callback(len(results), len(urls_to_crawl))
                        except Exception:
                            pass

            self._harvest_stats["total_urls_processed"] += len(urls_to_crawl)
            self._harvest_stats["last_harvest_time"] = datetime.now().isoformat()
            logger.info(f"[SemanticHarvester] Harvested {len(results)}/{len(urls_to_crawl)} pages from {website_url}")

        except Exception as e:
            logger.error(f"[SemanticHarvester] Harvest failed for {website_url}: {e}")
            logger.error(f"[SemanticHarvester] Full traceback: {traceback.format_exc()}")

        return results

    async def _resolve_urls_from_sitemap(self, website_url: str, user_id: Optional[str], limit: int) -> List[str]:
        """Extract prioritized URLs from the user's sitemap analysis."""
        urls = []

        # Try DB-based sitemap (from Step 1 website analysis)
        if user_id:
            try:
                from services.database import get_session_for_user
                from models.onboarding import WebsiteAnalysis, OnboardingSession

                db = get_session_for_user(user_id)
                if db:
                    try:
                        analyses = (
                            db.query(WebsiteAnalysis)
                            .join(OnboardingSession, WebsiteAnalysis.session_id == OnboardingSession.id)
                            .filter(OnboardingSession.user_id == user_id)
                            .order_by(WebsiteAnalysis.created_at.desc())
                            .all()
                        )
                        for analysis in analyses:
                            if not analysis.seo_audit:
                                continue
                            sitemap_data = analysis.seo_audit.get("sitemap_analysis", {})
                            analysis_data = sitemap_data.get("analysis_data", {}) or sitemap_data
                            sitemap_urls = analysis_data.get("url_list", [])
                            if sitemap_urls:
                                from urllib.parse import urlparse
                                base_domain = urlparse(website_url).netloc
                                for url_str in sitemap_urls:
                                    if not url_str:
                                        continue
                                    if isinstance(url_str, dict):
                                        url_str = url_str.get("loc", "")
                                    if not isinstance(url_str, str) or not url_str.startswith("http"):
                                        continue
                                    parsed = urlparse(url_str)
                                    if parsed.netloc == base_domain or parsed.netloc.endswith("." + base_domain):
                                        urls.append(url_str)
                        db.close()
                    finally:
                        pass
            except Exception as e:
                logger.debug(f"[SemanticHarvester] Could not load sitemap from DB: {e}")

        # Prioritise: homepage first, then shallow paths, then deep
        if urls:
            urls = sorted(urls, key=lambda u: u.count("/"))
            # Ensure homepage is first
            base = website_url.rstrip("/")
            if base in urls:
                urls.remove(base)
            urls.insert(0, base)
        else:
            # Fallback: homepage only
            urls = [website_url]

        return urls[:limit]

    async def harvest_competitors(self, competitor_urls: List[str], pages_per_competitor: int = 10) -> List[Dict[str, Any]]:
        """Harvest content from multiple competitors with detailed logging."""
        logger.info(f"[SemanticHarvester] Starting competitor harvest for {len(competitor_urls)} competitors")
        
        if not competitor_urls:
            logger.warning("[SemanticHarvester] No competitor URLs provided")
            return []
        
        all_content = []
        successful_harvests = 0
        failed_harvests = 0
        
        for i, url in enumerate(competitor_urls, 1):
            try:
                logger.debug(f"[SemanticHarvester] Processing competitor {i}/{len(competitor_urls)}: {url}")
                content = await self.harvest_website(url, limit=pages_per_competitor)
                
                if content:
                    all_content.extend(content)
                    successful_harvests += 1
                    logger.debug(f"[SemanticHarvester] Successfully harvested {len(content)} pages from {url}")
                else:
                    failed_harvests += 1
                    logger.warning(f"[SemanticHarvester] No content harvested from {url}")
                    
            except Exception as e:
                failed_harvests += 1
                logger.error(f"[SemanticHarvester] Failed to harvest competitor {url}: {e}")
        
        # Update statistics
        self._harvest_stats["total_urls_processed"] += len(competitor_urls)
        self._harvest_stats["successful_extractions"] += successful_harvests
        self._harvest_stats["failed_extractions"] += failed_harvests
        self._harvest_stats["last_harvest_time"] = datetime.now().isoformat()
        
        logger.info(f"[SemanticHarvester] Competitor harvest completed: {successful_harvests} successful, {failed_harvests} failed")
        logger.info(f"[SemanticHarvester] Total content pieces harvested: {len(all_content)}")
        
        return all_content
    
    def get_harvest_stats(self) -> Dict[str, Any]:
        """Get statistics about harvesting operations."""
        return self._harvest_stats.copy()
