from __future__ import annotations

import asyncio
import json
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

from services.component_logic.web_crawler_logic import WebCrawlerLogic
from services.llm_providers.main_text_generation import llm_text_gen
from services.ai_service_manager import AIServiceManager, AIServiceType
from services.seo_tools.sitemap_service import SitemapService
from services.seo.advertools_service import AdvertoolsService
from utils.logger_utils import get_service_logger

logger = get_service_logger("deep_competitor_analysis")


class DeepCompetitorAnalysisService:
    def __init__(self):
        self.crawler = WebCrawlerLogic()
        self.advertools = AdvertoolsService()

    async def run(
        self,
        *,
        user_id: str,
        website_analysis: Dict[str, Any],
        competitors: List[Dict[str, Any]],
        max_competitors: int = 25,
        crawl_concurrency: int = 4
    ) -> Dict[str, Any]:
        baseline = self._build_baseline(website_analysis)
        normalized_competitors = self._normalize_competitors(competitors, max_competitors=max_competitors)

        crawl_results = await self._crawl_competitors(
            normalized_competitors,
            crawl_concurrency=crawl_concurrency
        )

        per_competitor_outputs: List[Dict[str, Any]] = []
        for competitor_input, crawl_result in crawl_results:
            extraction = self._build_extraction_artifact(competitor_input, crawl_result)
            ai_analysis = await self._analyze_competitor_with_ai(
                user_id=user_id,
                baseline=baseline,
                competitor_input=competitor_input,
                extraction=extraction
            )
            per_competitor_outputs.append({
                "input": competitor_input,
                "extraction": extraction,
                "ai_analysis": ai_analysis
            })

        aggregation = await self._aggregate_with_ai(
            user_id=user_id,
            baseline=baseline,
            competitors=per_competitor_outputs
        )

        return {
            "baseline": baseline,
            "competitors": per_competitor_outputs,
            "aggregation": aggregation,
            "metadata": {
                "generated_at": datetime.utcnow().isoformat(),
                "competitors_requested": len(normalized_competitors),
                "competitors_analyzed": len(per_competitor_outputs),
                "crawl_concurrency": crawl_concurrency
            }
        }

    async def generate_weekly_strategy_brief(
        self,
        *,
        user_id: str,
        website_analysis: Dict[str, Any],
        competitors: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Generates a weekly strategic intelligence brief by analyzing 
        recent competitor changes and market shifts.
        """
        sitemap_service = SitemapService()
        ai_manager = AIServiceManager()
        
        # Stage 1: Data Collection (User + Competitors)
        baseline = self._build_baseline(website_analysis)
        normalized_competitors = self._normalize_competitors(competitors, max_competitors=10)
        
        # Fetch competitor sitemaps for recent changes
        competitor_changes = []
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        ninety_days_ago = datetime.utcnow() - timedelta(days=90)
        
        for comp in normalized_competitors:
            try:
                # Stage 1: Advertools Deep Intelligence
                # Discover exact sitemap URL first (essential for Advertools)
                discovered_sitemap = await sitemap_service.discover_sitemap_url(comp['url'])
                effective_url = discovered_sitemap if discovered_sitemap else comp['url']
                
                adv_result = await self.advertools.analyze_sitemap(effective_url)
                
                # REUSE: Use existing SitemapService.analyze_sitemap for robust Stage 1 & 2
                analysis_result = await sitemap_service.analyze_sitemap(
                    sitemap_url=effective_url,
                    analyze_content_trends=True,
                    analyze_publishing_patterns=True,
                    include_ai_insights=False,
                    user_id=user_id
                )
                
                if analysis_result and analysis_result.get('urls'):
                    urls = analysis_result['urls']
                    structure = analysis_result.get('structure_analysis', {})
                    
                    # Enhancement 1: Keyword Clustering (NLP from URLs) - REUSE from SitemapService
                    keyword_clusters = structure.get('keyword_clusters', {})
                    
                    # Enhancement 2: Strategic Pillar Mapping - REUSE from SitemapService
                    pillars = structure.get('strategic_pillars', {})
                    
                    # Enhancement 3: Advertools Site Hierarchy (from folders)
                    site_hierarchy = adv_result.get('metrics', {}).get('top_pillars', {}) if adv_result.get('success') else {}
                    
                    # Enhancement 4: Content Cadence Trend (Last 7 days vs 90 days)
                    recent_urls = [u for u in urls if self._is_newer_than(u.get('lastmod'), seven_days_ago)]
                    historical_urls = [u for u in urls if self._is_newer_than(u.get('lastmod'), ninety_days_ago)]
                    
                    recent_velocity = len(recent_urls) / 7
                    historical_velocity = len(historical_urls) / 90
                    cadence_shift = ((recent_velocity - historical_velocity) / max(historical_velocity, 0.01)) * 100
                    
                    # Advertools Word Frequency (Audit top 5 recent URLs)
                    top_themes = []
                    if recent_urls:
                        audit_urls = [u['loc'] for u in recent_urls[:5]]
                        # Use thread-safe audit_content from AdvertoolsService
                        audit_result = await self.advertools.audit_content(audit_urls)
                        if audit_result.get('success'):
                            top_themes = audit_result.get('themes', [])

                    competitor_changes.append({
                        "domain": comp['domain'],
                        "name": comp['name'],
                        "new_content_count": len(recent_urls),
                        "recent_topics": [self._extract_topic_from_url(u['loc']) for u in recent_urls[:10]],
                        "total_pages": len(urls),
                        "keyword_clusters": keyword_clusters,
                        "strategic_pillars": pillars,
                        "site_hierarchy": site_hierarchy,
                        "top_themes": top_themes,
                        "cadence_shift_percent": round(cadence_shift, 1),
                        "publishing_velocity": round(recent_velocity, 2),
                        "stale_content_pct": adv_result.get('metrics', {}).get('stale_content_percentage', 0) if adv_result.get('success') else 0
                    })
            except Exception as e:
                logger.warning(f"Failed to fetch sitemap for {comp['domain']}: {e}")

        # Stage 2: Differential Analysis (Non-AI Aggregation)
        avg_competitor_velocity = sum(c['publishing_velocity'] for c in competitor_changes) / len(competitor_changes) if competitor_changes else 0
        market_clusters = self._aggregate_clusters([c['keyword_clusters'] for c in competitor_changes])
        
        # Stage 3: AI Strategic Intelligence
        # Extract rich user context from baseline
        brand_analysis = baseline.get("brand_analysis", {})
        seo_audit = baseline.get("seo_audit", {})
        
        user_niche = brand_analysis.get("industry") or "General Business"
        user_topics = brand_analysis.get("topics") or []
        if not user_topics and seo_audit.get("keywords"):
             user_topics = seo_audit.get("keywords")[:5]

        analysis_context = {
            "user_profile": {
                "website_url": baseline.get("website_url"),
                "industry": user_niche,
                "niche_description": brand_analysis.get("description") or brand_analysis.get("summary") or "",
                "core_topics": user_topics,
                "target_audience": baseline.get("target_audience") or {},
                "business_objectives": brand_analysis.get("objectives") or "Growth",
                "brand_voice": brand_analysis.get("voice") or "Professional",
                "augmented_themes": brand_analysis.get("augmented_themes", []) # Added from Advertools
            },
            "market_intelligence": {
                "market_clusters": market_clusters,
                "competitors_analyzed_count": len(competitor_changes),
                "market_opportunities_detected": ["Content Velocity Gap", "Topic Authority Shift", "Stale Content Replacement"],
                "competitor_hierarchies": {c['name']: c['site_hierarchy'] for c in competitor_changes},
                "competitor_content_themes": {c['name']: c['top_themes'] for c in competitor_changes}
            },
            "competitive_landscape_detailed": competitor_changes,
        }
        
        # Call AI for strategic intelligence and content gaps in parallel
        strategic_intelligence, content_gaps = await asyncio.gather(
            ai_manager.generate_strategic_intelligence(analysis_context, user_id=user_id),
            ai_manager.generate_content_gap_analysis(analysis_context, user_id=user_id),
        )

        # Stage 4: Result Assembly
        report = {
            "week_commencing": seven_days_ago.date().isoformat(),
            "generated_at": datetime.utcnow().isoformat(),
            "metrics": {
                "market_velocity": round(avg_competitor_velocity, 2),
                "market_clusters": market_clusters[:5],
                "aggressive_competitors": [c['name'] for c in competitor_changes if c['cadence_shift_percent'] > 50]
            },
            "insights": {
                "the_big_move": strategic_intelligence.get("data", {}).get("strategic_insights", [{}])[0] if strategic_intelligence.get("success") else {},
                "low_hanging_fruit": content_gaps.get("data", {}).get("content_recommendations", []) if content_gaps.get("success") else [],
                "threat_alerts": strategic_intelligence.get("data", {}).get("strategic_insights", [{}])[1:] if strategic_intelligence.get("success") else []
            },
            "raw_data": {
                "competitor_changes": competitor_changes
            }
        }
        
        return report

    def _is_newer_than(self, lastmod: Optional[str], threshold: datetime) -> bool:
        if not lastmod:
            return False
        try:
            # Handle various ISO formats
            dt_str = lastmod.replace('Z', '+00:00')
            return datetime.fromisoformat(dt_str).replace(tzinfo=None) > threshold
        except:
            return False

    def _aggregate_clusters(self, clusters_list: List[Dict[str, int]]) -> List[str]:
        """Aggregate clusters across competitors to find market-wide themes."""
        master: Dict[str, int] = {}
        for cluster in clusters_list:
            for k, v in cluster.items():
                master[k] = master.get(k, 0) + 1 # Count competitor occurrences
        return sorted(master, key=lambda x: master[x], reverse=True)[:10]

    def _extract_topic_from_url(self, url: str) -> str:
        """Helper to get a readable topic from a URL slug."""
        try:
            path = urlparse(url).path
            slug = path.strip('/').split('/')[-1]
            return slug.replace('-', ' ').replace('_', ' ').capitalize()
        except:
            return "New Content"

    def _build_baseline(self, website_analysis: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(website_analysis, dict):
            website_analysis = {}

        baseline = {
            "website_url": website_analysis.get("website_url"),
            "brand_analysis": website_analysis.get("brand_analysis") or {},
            "content_strategy_insights": website_analysis.get("content_strategy_insights") or {},
            "seo_audit": website_analysis.get("seo_audit") or {},
            "style_guidelines": website_analysis.get("style_guidelines") or {},
            "style_patterns": website_analysis.get("style_patterns") or {}
        }

        return baseline

    def _normalize_competitors(self, competitors: List[Dict[str, Any]], *, max_competitors: int) -> List[Dict[str, Any]]:
        if not isinstance(competitors, list):
            return []

        seen_domains = set()
        normalized: List[Dict[str, Any]] = []

        for comp in competitors:
            if not isinstance(comp, dict):
                continue

            raw_url = comp.get("url") or comp.get("website_url") or comp.get("domain") or ""
            url = self._normalize_url(raw_url)
            if not url:
                continue

            domain = self._extract_domain(url)
            if not domain or domain in seen_domains:
                continue

            seen_domains.add(domain)
            normalized.append({
                "url": url,
                "domain": domain,
                "name": comp.get("name") or comp.get("title") or domain,
                "summary": comp.get("summary") or comp.get("description") or ""
            })

            if len(normalized) >= max_competitors:
                break

        return normalized

    def _normalize_url(self, raw: str) -> Optional[str]:
        if not raw or not isinstance(raw, str):
            return None

        raw = raw.strip()
        if not raw:
            return None

        if not raw.startswith(("http://", "https://")):
            raw = "https://" + raw

        try:
            parsed = urlparse(raw)
            if not parsed.scheme or not parsed.netloc:
                return None
            return f"{parsed.scheme}://{parsed.netloc}"
        except Exception:
            return None

    def _extract_domain(self, url: str) -> Optional[str]:
        try:
            parsed = urlparse(url)
            domain = (parsed.netloc or "").lower()
            if domain.startswith("www."):
                domain = domain[4:]
            return domain or None
        except Exception:
            return None

    async def _crawl_competitors(
        self,
        competitors: List[Dict[str, Any]],
        *,
        crawl_concurrency: int
    ) -> List[Tuple[Dict[str, Any], Dict[str, Any]]]:
        semaphore = asyncio.Semaphore(max(1, int(crawl_concurrency)))

        async def crawl_one(comp: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
            async with semaphore:
                url = comp.get("url")
                if not url:
                    return comp, {"success": False, "error": "missing_url"}
                try:
                    return comp, await self.crawler.crawl_website(url)
                except Exception as e:
                    return comp, {"success": False, "error": str(e)}

        tasks = [crawl_one(c) for c in competitors]
        return await asyncio.gather(*tasks)

    def _build_extraction_artifact(self, competitor_input: Dict[str, Any], crawl_result: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(crawl_result, dict) or not crawl_result.get("success"):
            return {
                "fetch_status": {
                    "status": "failed",
                    "error": crawl_result.get("error") if isinstance(crawl_result, dict) else "unknown_error"
                }
            }

        content = crawl_result.get("content") if isinstance(crawl_result.get("content"), dict) else {}
        title = content.get("title") or ""
        description = content.get("description") or ""
        headings = content.get("headings") if isinstance(content.get("headings"), list) else []
        links = content.get("links") if isinstance(content.get("links"), list) else []
        meta_tags = content.get("meta_tags") if isinstance(content.get("meta_tags"), dict) else {}
        main_content = content.get("main_content") or ""
        content_structure = content.get("content_structure") if isinstance(content.get("content_structure"), dict) else {}

        nav_labels = self._extract_nav_labels(links)
        h1_h2 = [h for h in headings if isinstance(h, str)][:25]
        cta_signals = self._extract_cta_signals(main_content, links)
        proof_signals = self._extract_proof_signals(main_content, links)

        excerpt = main_content.strip()
        if len(excerpt) > 2000:
            excerpt = excerpt[:2000]

        return {
            "fetch_status": {
                "status": "ok",
                "fetched_url": crawl_result.get("url"),
                "timestamp": crawl_result.get("timestamp")
            },
            "page_meta": {
                "title": title,
                "meta_description": description,
                "og_title": meta_tags.get("og:title"),
                "og_description": meta_tags.get("og:description")
            },
            "structure": {
                "headings": h1_h2,
                "nav_labels": nav_labels,
                "content_structure": content_structure
            },
            "signals": {
                "cta_signals": cta_signals,
                "proof_signals": proof_signals
            },
            "content_excerpt": excerpt
        }

    def _extract_nav_labels(self, links: List[Dict[str, Any]]) -> List[str]:
        labels: List[str] = []
        for link in links[:200]:
            if not isinstance(link, dict):
                continue
            text = (link.get("text") or "").strip()
            if not text or len(text) > 50:
                continue
            labels.append(text)
        deduped: List[str] = []
        seen = set()
        for label in labels:
            key = label.lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(label)
            if len(deduped) >= 25:
                break
        return deduped

    def _extract_cta_signals(self, main_content: str, links: List[Dict[str, Any]]) -> Dict[str, Any]:
        text = (main_content or "").lower()
        keywords = ["get started", "start", "book", "demo", "trial", "pricing", "contact", "signup", "sign up", "subscribe"]
        keyword_hits = [k for k in keywords if k in text]

        link_texts = []
        for link in links[:200]:
            if isinstance(link, dict):
                t = (link.get("text") or "").strip()
                if t:
                    link_texts.append(t.lower())

        cta_link_hits = [k for k in keywords if any(k in lt for lt in link_texts)]
        return {
            "keyword_hits": keyword_hits[:10],
            "link_cta_hits": list(dict.fromkeys(cta_link_hits))[:10]
        }

    def _extract_proof_signals(self, main_content: str, links: List[Dict[str, Any]]) -> Dict[str, Any]:
        text = (main_content or "").lower()
        proof_keywords = ["case study", "testimonials", "customers", "trusted by", "reviews", "awards", "partners"]
        hits = [k for k in proof_keywords if k in text]

        link_hits = []
        for link in links[:200]:
            if not isinstance(link, dict):
                continue
            href = (link.get("href") or "").lower()
            if any(k.replace(" ", "") in href.replace("-", "").replace("_", "") for k in ["case study", "testimonials", "customers"]):
                link_hits.append(href)
        return {
            "keyword_hits": hits[:10],
            "supporting_links": link_hits[:10]
        }

    async def _analyze_competitor_with_ai(
        self,
        *,
        user_id: str,
        baseline: Dict[str, Any],
        competitor_input: Dict[str, Any],
        extraction: Dict[str, Any]
    ) -> Dict[str, Any]:
        if not isinstance(extraction, dict) or extraction.get("fetch_status", {}).get("status") != "ok":
            return {
                "status": "skipped",
                "reason": "crawl_failed"
            }

        json_struct = {
            "positioning": {
                "value_prop": "string",
                "target_audience": "string",
                "market_tier": "string",
                "primary_offer": "string"
            },
            "content_strategy": {
                "themes": ["string"],
                "messaging_angles": ["string"],
                "cta_patterns": ["string"],
                "tone_markers": ["string"]
            },
            "competitive_advantages": ["string"],
            "weaknesses_or_risks": ["string"],
            "comparison_to_user_baseline": {
                "overlaps": ["string"],
                "deltas": ["string"],
                "opportunities": ["string"]
            },
            "confidence": {
                "overall": "number",
                "notes": ["string"]
            }
        }

        prompt = (
            "You are a competitive intelligence analyst.\n"
            "Analyze the competitor homepage extraction and compare it to the user's Step 2 baseline insights.\n"
            "Return strictly the requested JSON.\n\n"
            f"User baseline (Step 2 insights): {json.dumps(baseline, ensure_ascii=False)}\n\n"
            f"Competitor input: {json.dumps(competitor_input, ensure_ascii=False)}\n\n"
            f"Homepage extraction: {json.dumps(extraction, ensure_ascii=False)}\n"
        )

        try:
            raw = llm_text_gen(prompt, json_struct=json_struct, user_id=user_id)
            parsed = self._safe_json_parse(raw)
            if isinstance(parsed, dict):
                return parsed
            return {"status": "failed", "error": "invalid_ai_json"}
        except Exception as e:
            logger.warning(f"AI competitor analysis failed for {competitor_input.get('domain')}: {e}")
            return {"status": "failed", "error": str(e)}

    async def _aggregate_with_ai(
        self,
        *,
        user_id: str,
        baseline: Dict[str, Any],
        competitors: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        json_struct = {
            "market_map": {
                "clusters": [
                    {
                        "cluster_name": "string",
                        "description": "string",
                        "competitors": ["string"]
                    }
                ]
            },
            "common_patterns": {
                "common_themes": ["string"],
                "common_ctas": ["string"],
                "common_proof_signals": ["string"]
            },
            "content_gaps_and_opportunities": [
                {
                    "gap": "string",
                    "why_it_matters": "string",
                    "recommended_content_types": ["string"],
                    "impact": "string",
                    "effort": "string"
                }
            ],
            "strategic_recommendations": [
                {
                    "action": "string",
                    "expected_impact": "string",
                    "effort": "string",
                    "first_steps": ["string"]
                }
            ],
            "warnings": ["string"]
        }

        compact = []
        for item in competitors:
            comp = item.get("input") if isinstance(item, dict) else None
            ai = item.get("ai_analysis") if isinstance(item, dict) else None
            if isinstance(comp, dict) and isinstance(ai, dict):
                compact.append({
                    "domain": comp.get("domain"),
                    "name": comp.get("name"),
                    "ai_analysis": ai
                })

        prompt = (
            "You are a senior strategy consultant.\n"
            "Using the user's Step 2 baseline insights and per-competitor analyses, produce an aggregated market view.\n"
            "Return strictly the requested JSON.\n\n"
            f"User baseline (Step 2 insights): {json.dumps(baseline, ensure_ascii=False)}\n\n"
            f"Per-competitor analyses: {json.dumps(compact, ensure_ascii=False)}\n"
        )

        try:
            raw = llm_text_gen(prompt, json_struct=json_struct, user_id=user_id)
            parsed = self._safe_json_parse(raw)
            if isinstance(parsed, dict):
                return parsed
            return {"warnings": ["invalid_ai_json"]}
        except Exception as e:
            logger.warning(f"AI aggregation failed: {e}")
            return {"warnings": [str(e)]}

    def _safe_json_parse(self, text: str) -> Any:
        if not isinstance(text, str):
            return None
        cleaned = text.strip()
        cleaned = re.sub(r"^```json\\s*", "", cleaned)
        cleaned = re.sub(r"^```\\s*", "", cleaned)
        cleaned = re.sub(r"```\\s*$", "", cleaned)
        cleaned = cleaned.strip()
        try:
            return json.loads(cleaned)
        except Exception:
            match = re.search(r"\\{[\\s\\S]*\\}", cleaned)
            if match:
                try:
                    return json.loads(match.group(0))
                except Exception:
                    return None
            return None

