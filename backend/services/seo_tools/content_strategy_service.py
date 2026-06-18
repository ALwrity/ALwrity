"""
Content Strategy Analysis Service

AI-powered content strategy analyzer that provides insights into
content gaps, opportunities, and competitive positioning.
"""

import json
import re
import asyncio
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import statistics
from loguru import logger

from ..llm_providers.main_text_generation import llm_text_gen
from middleware.logging_middleware import seo_logger

from .sitemap_service import SitemapService

# Per-domain concurrency lock for sitemap benchmarking.
# Prevents N concurrent calls to the same domain from flooding it with requests.
_sitemap_benchmarking_locks: Dict[str, asyncio.Lock] = {}
_sitemap_benchmarking_lock_cleanup_interval = 300  # seconds

class ContentStrategyService:
    """Service for AI-powered content strategy analysis"""
    
    def __init__(self):
        """Initialize the content strategy service"""
        self.service_name = "content_strategy_analyzer"
        logger.info(f"Initialized {self.service_name}")
    
    async def analyze_content_strategy(
        self,
        website_url: str,
        competitors: List[str] = None,
        target_keywords: List[str] = None,
        custom_parameters: Dict[str, Any] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        start_time = datetime.utcnow()

        competitors = competitors or []
        target_keywords = target_keywords or []
        custom_parameters = custom_parameters or {}

        sitemap_service = SitemapService()

        discovered_user_sitemap = await sitemap_service.discover_sitemap_url(website_url)
        user_sitemap_result = None
        if discovered_user_sitemap:
            user_sitemap_result = await sitemap_service.analyze_sitemap(
                sitemap_url=discovered_user_sitemap,
                analyze_content_trends=True,
                analyze_publishing_patterns=True,
                include_ai_insights=False
            )

        competitor_sitemaps: Dict[str, Optional[str]] = {}
        competitor_results: Dict[str, Dict[str, Any]] = {}

        for competitor_url in competitors[:5]:
            sitemap_url = await sitemap_service.discover_sitemap_url(competitor_url)
            competitor_sitemaps[competitor_url] = sitemap_url
            if sitemap_url:
                try:
                    competitor_results[competitor_url] = await sitemap_service.analyze_sitemap(
                        sitemap_url=sitemap_url,
                        analyze_content_trends=True,
                        analyze_publishing_patterns=True,
                        include_ai_insights=False
                    )
                except Exception as e:
                    competitor_results[competitor_url] = {"error": str(e)}

        deterministic = self._build_deterministic_insights(
            website_url=website_url,
            user_sitemap_url=discovered_user_sitemap,
            user_sitemap_result=user_sitemap_result,
            competitor_sitemaps=competitor_sitemaps,
            competitor_results=competitor_results,
            target_keywords=target_keywords
        )

        ai_strategy = None
        ai_error = None
        if user_id:
            try:
                prompt = self._build_ai_prompt(
                    website_url=website_url,
                    target_keywords=target_keywords,
                    custom_parameters=custom_parameters,
                    deterministic_summary=deterministic
                )
                ai_response = llm_text_gen(
                    prompt=prompt,
                    system_prompt=self._get_system_prompt(),
                    user_id=user_id
                )
                ai_strategy = self._parse_json_response(ai_response)

                await seo_logger.log_ai_analysis(
                    tool_name=self.service_name,
                    prompt=prompt,
                    response=ai_response,
                    model_used="gemini-2.0-flash-001"
                )
            except Exception as e:
                ai_error = str(e)

        execution_time = (datetime.utcnow() - start_time).total_seconds()

        result = {
            "website_url": website_url,
            "analysis_type": "content_strategy",
            "timestamp": datetime.utcnow().isoformat(),
            "execution_time": execution_time,
            "inputs": {
                "competitors": competitors[:5],
                "target_keywords": target_keywords,
                "custom_parameters": custom_parameters
            },
            "data_sources": {
                "user_sitemap_url": discovered_user_sitemap,
                "competitor_sitemaps": competitor_sitemaps
            },
            "deterministic_insights": deterministic,
            "ai_strategy": ai_strategy,
            "ai_error": ai_error
        }

        await seo_logger.log_tool_usage(
            tool_name=self.service_name,
            input_data={
                "website_url": website_url,
                "competitors_count": len(competitors),
                "target_keywords_count": len(target_keywords),
                "has_user_sitemap": bool(discovered_user_sitemap)
            },
            output_data={
                "website_url": website_url,
                "has_ai_strategy": bool(ai_strategy),
                "has_ai_error": bool(ai_error),
                "execution_time": execution_time
            },
            success=True if (ai_strategy is not None or deterministic is not None) else False
        )

        return result

    async def analyze_competitive_sitemap_benchmarking(
        self,
        website_url: str,
        competitors: List[str],
        max_competitors: Optional[int] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        start_time = datetime.utcnow()
        # Using WARNING level to ensure visibility in production logs as requested by user
        logger.warning(f"🚀 [START] Competitive sitemap benchmarking for {website_url} with {len(competitors)} competitors")

        # Per-domain dedup lock: only one benchmarking run per domain at a time
        domain = self._normalize_domain(website_url)
        lock = _sitemap_benchmarking_locks.setdefault(domain, asyncio.Lock())
        lock_key = id(lock)
        logger.warning(f"🔒 [DEDUP] Waiting for domain lock {lock_key} on {domain} (concurrent calls held until prior run finishes)")
        async with lock:
            logger.warning(f"🔓 [DEDUP] Acquired domain lock {lock_key} on {domain}")

            competitors = [c for c in (competitors or []) if isinstance(c, str) and c.strip()]
            if max_competitors:
                competitors = competitors[: max(0, int(max_competitors))]
            
            if not competitors:
                logger.warning(f"No competitors provided for benchmarking {website_url}")

            sitemap_service = SitemapService()

            logger.warning(f"🔍 [PROGRESS] Discovering user sitemap for {website_url}")
            discovered_user_sitemap = await sitemap_service.discover_sitemap_url(website_url)
            user_sitemap_result = None
            user_error = None
            if discovered_user_sitemap:
                try:
                    logger.warning(f"⚡ [PROGRESS] Analyzing user sitemap: {discovered_user_sitemap}")
                    user_sitemap_result = await sitemap_service.analyze_sitemap(
                        sitemap_url=discovered_user_sitemap,
                        analyze_content_trends=True,
                        analyze_publishing_patterns=True,
                        include_ai_insights=False,
                        user_id=user_id
                    )
                except Exception as e:
                    user_error = str(e)
                    logger.error(f"Error analyzing user sitemap {discovered_user_sitemap}: {e}")
            else:
                user_error = "No sitemap discovered for your website. Please ensure your site has a valid sitemap.xml."
                logger.warning(f"⚠️ No sitemap found for user website {website_url}")

            competitor_sitemaps: Dict[str, Optional[str]] = {}
            competitor_results: Dict[str, Dict[str, Any]] = {}
            competitor_errors: Dict[str, str] = {}

            logger.warning(f"🔍 [PROGRESS] Discovering sitemaps for {len(competitors)} competitors")
            discovery_tasks = [sitemap_service.discover_sitemap_url(u) for u in competitors]
            discovery_results = await asyncio.gather(*discovery_tasks, return_exceptions=True)
            for i, url in enumerate(competitors):
                res = discovery_results[i]
                if isinstance(res, Exception):
                    competitor_sitemaps[url] = None
                    competitor_errors[url] = str(res)
                    logger.warning(f"Error discovering sitemap for competitor {url}: {res}")
                else:
                    competitor_sitemaps[url] = res
                    if not res:
                        competitor_errors[url] = "No sitemap found"
                        logger.info(f"ℹ️ No sitemap found for competitor {url}")
                    else:
                        logger.info(f"✅ Found sitemap for competitor {url}: {res}")

            to_analyze = [(url, competitor_sitemaps.get(url)) for url in competitors if competitor_sitemaps.get(url)]
            logger.warning(f"⚡ [PROGRESS] Analyzing {len(to_analyze)} competitor sitemaps")
            
            # Helper for safe analysis with timeout
            async def analyze_with_timeout(url, sm):
                try:
                    logger.warning(f"🕒 [START] Analyzing {url} with 300s timeout")
                    result = await asyncio.wait_for(
                        sitemap_service.analyze_sitemap(
                            sitemap_url=sm,
                            analyze_content_trends=True,
                            analyze_publishing_patterns=True,
                            include_ai_insights=False,
                            user_id=user_id
                        ),
                        timeout=300.0
                    )
                    logger.warning(f"✅ [DONE] Analysis finished for {url}")
                    return result
                except asyncio.TimeoutError:
                    logger.error(f"⏱️ Analysis timed out for competitor {url} (limit: 300s)")
                    return TimeoutError(f"Analysis timed out after 300s")
                except Exception as e:
                    msg = str(e)
                    if "URL returned a webpage" in msg or "Failed to parse sitemap XML" in msg or "no element found" in msg:
                        logger.warning(f"⚠️ Analysis skipped for {url}: Invalid sitemap ({msg})")
                    else:
                        logger.error(f"❌ Analysis failed for {url}: {e}")
                    return e

            analysis_tasks = [
                analyze_with_timeout(url, sm)
                for (url, sm) in to_analyze
            ]
            analysis_results = await asyncio.gather(*analysis_tasks, return_exceptions=True)
            for i, (url, _) in enumerate(to_analyze):
                res = analysis_results[i]
                if isinstance(res, Exception):
                    competitor_errors[url] = str(res)
                    if "URL returned a webpage" not in str(res) and "Failed to parse sitemap XML" not in str(res) and "no element found" not in str(res):
                        logger.error(f"Error analyzing sitemap for competitor {url}: {res}")
                else:
                    competitor_results[url] = res

            user_summary = self._summarize_sitemap(user_sitemap_result)
            competitor_summaries: Dict[str, Dict[str, Any]] = {}
            for competitor_url, result in competitor_results.items():
                if result and isinstance(result, dict) and "error" not in result:
                    competitor_summaries[competitor_url] = self._summarize_sitemap(result)

            benchmark = self._build_competitive_sitemap_benchmark(
                website_url=website_url,
                user_summary=user_summary,
                competitor_summaries=competitor_summaries
            )

            execution_time = (datetime.utcnow() - start_time).total_seconds()

            return {
                "analysis_type": "competitive_sitemap_benchmarking",
                "timestamp": datetime.utcnow().isoformat(),
                "execution_time": execution_time,
                "inputs": {
                    "website_url": website_url,
                    "competitors": competitors,
                    "max_competitors": max_competitors
                },
                "data_sources": {
                    "user_sitemap_url": discovered_user_sitemap,
                    "competitor_sitemaps": competitor_sitemaps
                },
                "user": {
                    "summary": user_summary,
                    "error": user_error
                },
                "competitors": {
                    "summaries": competitor_summaries,
                    "errors": competitor_errors
                },
                "benchmark": benchmark
            }

    def _safe_ratio(self, numerator: Any, denominator: Any) -> Optional[float]:
        try:
            num = float(numerator)
            den = float(denominator)
            if den <= 0:
                return None
            return round(num / den, 4)
        except Exception:
            return None

    def _as_float(self, value: Any) -> Optional[float]:
        try:
            if value is None:
                return None
            return float(value)
        except Exception:
            return None

    def _median(self, values: List[Optional[float]]) -> Optional[float]:
        cleaned = [v for v in values if isinstance(v, (int, float))]
        if not cleaned:
            return None
        try:
            return float(statistics.median(cleaned))
        except Exception:
            return None

    @staticmethod
    def _normalize_domain(website_url: str) -> str:
        """Extract and normalize the domain from a URL for lock keying."""
        from urllib.parse import urlparse
        parsed = urlparse(website_url)
        domain = (parsed.netloc or parsed.path or website_url).lower()
        return domain.rstrip("/")

    def _build_competitive_sitemap_benchmark(
        self,
        website_url: str,
        user_summary: Dict[str, Any],
        competitor_summaries: Dict[str, Dict[str, Any]]
    ) -> Dict[str, Any]:
        user_patterns = user_summary.get("top_url_patterns") or {}
        user_sections = set(user_patterns.keys())

        competitor_section_stats: Dict[str, Dict[str, Any]] = {}
        competitor_metrics: List[Dict[str, Any]] = []

        for competitor_url, summary in competitor_summaries.items():
            patterns = summary.get("top_url_patterns") or {}
            total_urls = summary.get("total_urls") or 0
            span_days = (summary.get("date_range") or {}).get("span_days")
            competitor_metrics.append({
                "competitor_url": competitor_url,
                "total_urls": summary.get("total_urls"),
                "sections_count": len(patterns.keys()),
                "average_path_depth": summary.get("average_path_depth"),
                "max_path_depth": summary.get("max_path_depth"),
                "publishing_velocity": summary.get("publishing_velocity"),
                "lastmod_coverage": self._safe_ratio(summary.get("total_dated_urls"), total_urls) if isinstance(summary.get("total_dated_urls"), (int, float)) else None,
                "span_days": span_days
            })

            for section, count in patterns.items():
                if not section:
                    continue
                if section not in competitor_section_stats:
                    competitor_section_stats[section] = {
                        "competitor_presence": 0,
                        "total_url_count": 0
                    }
                competitor_section_stats[section]["competitor_presence"] += 1
                competitor_section_stats[section]["total_url_count"] += int(count or 0)

        competitor_count = len(competitor_summaries)
        missing_sections = []
        for section, stats in sorted(
            competitor_section_stats.items(),
            key=lambda x: (x[1].get("competitor_presence", 0), x[1].get("total_url_count", 0)),
            reverse=True
        ):
            # Filter out known non-content patterns:
            # 1. Sections present in user site
            # 2. Short sections <= 3 chars (likely language codes like /en, /es, /fr)
            # 3. Common technical paths (wp-content, wp-includes, cgi-bin)
            if section in user_sections:
                continue
            
            if len(section) <= 3: # e.g., /es, /fr, /pt
                continue
                
            if any(tech in section.lower() for tech in ['wp-content', 'wp-includes', 'cgi-bin', 'assets', 'static']):
                continue

            if competitor_count > 0 and stats.get("competitor_presence", 0) >= max(2, int(round(0.4 * competitor_count))):
                missing_sections.append({
                    "section": section,
                    # Ensure presence is a normalized ratio (0.0 - 1.0)
                    "competitor_presence": self._safe_ratio(stats.get("competitor_presence", 0), competitor_count) or 0,
                    "competitor_count": stats.get("competitor_presence"),
                    "total_url_count": stats.get("total_url_count", 0)
                })
        missing_sections = missing_sections[:15]

        velocity_values = [self._as_float(s.get("publishing_velocity")) for s in competitor_summaries.values()]
        depth_values = [self._as_float(s.get("average_path_depth")) for s in competitor_summaries.values()]
        competitor_velocity_median = self._median(velocity_values)
        competitor_depth_median = self._median(depth_values)

        user_velocity = self._as_float(user_summary.get("publishing_velocity"))
        user_depth = self._as_float(user_summary.get("average_path_depth"))
        user_total_urls = user_summary.get("total_urls") or 0

        opportunities = []
        # Note: 'missing_sections' opportunity removed to avoid duplication with 'Competitor Content Strategy Patterns' section

        # Insight 1: Content Volume Gap
        competitor_total_urls_list = [m["total_urls"] for m in competitor_metrics if m.get("total_urls")]
        competitor_urls_median = self._median(competitor_total_urls_list)
        
        if competitor_urls_median and user_total_urls < competitor_urls_median * 0.8:
             opportunities.append({
                "type": "content_volume_gap",
                "title": "Competitors have significantly more content",
                "metrics": {
                    "user_total_pages": user_total_urls,
                    "competitor_median_total_pages": int(competitor_urls_median)
                }
            })

        # Insight 2: Publishing Velocity Gap
        if competitor_velocity_median is not None and user_velocity is not None:
            if user_velocity < competitor_velocity_median * 0.75:
                opportunities.append({
                    "type": "publishing_velocity_gap",
                    "title": "Competitors appear to publish more frequently",
                    "metrics": {
                        "user_publishing_velocity": user_velocity,
                        "competitor_median_publishing_velocity": competitor_velocity_median
                    }
                })

        # Insight 3: Architecture Depth Gap
        if competitor_depth_median is not None and user_depth is not None:
            if user_depth < competitor_depth_median - 0.5:
                opportunities.append({
                    "type": "architecture_depth_gap",
                    "title": "Competitors have deeper site structure",
                    "metrics": {
                        "user_average_path_depth": user_depth,
                        "competitor_median_average_path_depth": competitor_depth_median
                    }
                })

        competitor_metrics_sorted = sorted(
            competitor_metrics,
            key=lambda x: (x.get("total_urls") or 0),
            reverse=True
        )

        return {
            "website_url": website_url,
            "competitors_analyzed": competitor_count,
            "user_sections_count": len(user_sections),
            "competitor_section_leaders": competitor_metrics_sorted[:10],
            "gaps": {
                "missing_sections": missing_sections
            },
            "opportunities": opportunities
        }

    def _summarize_sitemap(self, sitemap_result: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if not sitemap_result or not isinstance(sitemap_result, dict):
            return {}
        structure = sitemap_result.get("structure_analysis") or {}
        trends = sitemap_result.get("content_trends") or {}
        patterns = sitemap_result.get("publishing_patterns") or {}
        return {
            "total_urls": sitemap_result.get("total_urls"),
            "top_url_patterns": structure.get("url_patterns") or {},
            "file_types": structure.get("file_types") or {},
            "average_path_depth": structure.get("average_path_depth"),
            "max_path_depth": structure.get("max_path_depth"),
            "publishing_velocity": trends.get("publishing_velocity"),
            "date_range": trends.get("date_range") or {},
            "total_dated_urls": trends.get("total_dated_urls"),
            "priority_distribution": patterns.get("priority_distribution") or {},
            "changefreq_distribution": patterns.get("changefreq_distribution") or {},
        }

    def _build_deterministic_insights(
        self,
        website_url: str,
        user_sitemap_url: Optional[str],
        user_sitemap_result: Optional[Dict[str, Any]],
        competitor_sitemaps: Dict[str, Optional[str]],
        competitor_results: Dict[str, Dict[str, Any]],
        target_keywords: List[str]
    ) -> Dict[str, Any]:
        user_summary = self._summarize_sitemap(user_sitemap_result)
        competitor_summaries: Dict[str, Dict[str, Any]] = {}
        for competitor_url, result in competitor_results.items():
            if result and isinstance(result, dict) and "error" not in result:
                competitor_summaries[competitor_url] = self._summarize_sitemap(result)

        user_sections = set((user_summary.get("top_url_patterns") or {}).keys())
        competitor_section_union: Dict[str, int] = {}
        for comp_summary in competitor_summaries.values():
            patterns = comp_summary.get("top_url_patterns") or {}
            for k, v in patterns.items():
                competitor_section_union[k] = competitor_section_union.get(k, 0) + int(v or 0)

        missing_vs_competitors = []
        for section, count in sorted(competitor_section_union.items(), key=lambda x: x[1], reverse=True):
            if section not in user_sections and section:
                missing_vs_competitors.append({"section": section, "competitor_url_count": count})
        missing_vs_competitors = missing_vs_competitors[:10]

        keyword_hints = []
        if target_keywords:
            user_pattern_text = " ".join(sorted(user_sections))
            for kw in target_keywords[:25]:
                kw_clean = (kw or "").strip()
                if not kw_clean:
                    continue
                hit = kw_clean.lower() in user_pattern_text.lower()
                keyword_hints.append({"keyword": kw_clean, "seen_in_url_patterns": hit})

        return {
            "website_url": website_url,
            "sitemap_found": bool(user_sitemap_url),
            "user_sitemap_summary": user_summary,
            "competitor_sitemap_summaries": competitor_summaries,
            "gaps_vs_competitors": {
                "missing_sections": missing_vs_competitors
            },
            "keyword_hints": keyword_hints
        }

    def _get_system_prompt(self) -> str:
        return (
            "You are an SEO and content strategy expert for non-technical content creators, "
            "digital marketers, and solopreneurs. Return ONLY valid minified JSON."
        )

    def _build_ai_prompt(
        self,
        website_url: str,
        target_keywords: List[str],
        custom_parameters: Dict[str, Any],
        deterministic_summary: Dict[str, Any]
    ) -> str:
        required_schema = {
            "positioning_summary": "",
            "content_gaps": [],
            "topic_clusters": [],
            "publishing_recommendations": {},
            "quick_wins": [],
            "risks": [],
            "meta": {"confidence": 0.0, "inputs_used": []}
        }

        return (
            "RULES:\n"
            "- Return ONE single-line MINIFIED JSON object only.\n"
            "- No markdown, code fences, or prose.\n"
            "- Use EXACTLY the top-level keys from this schema: "
            f"{list(required_schema.keys())}.\n"
            "- For arrays of objects, keep objects small and consistent.\n\n"
            f"WEBSITE: {website_url}\n"
            f"TARGET_KEYWORDS: {target_keywords[:25]}\n"
            f"CUSTOM_PARAMETERS: {custom_parameters}\n\n"
            f"SITEMAP_DERIVED_DATA (compact): {json.dumps(deterministic_summary, ensure_ascii=False)[:12000]}\n\n"
            "Now produce the strategy JSON."
        )

    def _parse_json_response(self, text: str) -> Dict[str, Any]:
        cleaned = text.strip()
        cleaned = cleaned.replace("```json", "").replace("```", "").strip()

        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if match:
            cleaned = match.group(0)

        return json.loads(cleaned)
    
    async def health_check(self) -> Dict[str, Any]:
        """Health check for the content strategy service"""
        return {
            "status": "operational",
            "service": self.service_name,
            "last_check": datetime.utcnow().isoformat()
        }
