import advertools as adv
import pandas as pd
import asyncio
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

class AdvertoolsService:
    """
    Centralized service for leveraging the Advertools library for deep SEO intelligence.
    Provides functions for sitemap analysis, content auditing, and link extraction.
    """
    
    def __init__(self):
        self.logger = logger.bind(service="AdvertoolsService")

    async def analyze_sitemap(self, sitemap_url: str) -> Dict[str, Any]:
        """
        Analyzes a website's sitemap to extract metrics on publishing velocity, freshness,
        URL structure patterns, and topic distribution.
        """
        try:
            self.logger.info(f"Analyzing sitemap: {sitemap_url}")
            
            loop = asyncio.get_event_loop()
            df = await loop.run_in_executor(None, lambda: adv.sitemap_to_df(sitemap_url))
            
            if df is None or df.empty:
                return {"success": False, "error": "Sitemap is empty or could not be parsed."}

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
                url_df = adv.url_to_df(df['loc'])
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
        try:
            loop = asyncio.get_event_loop()
            url_df = await loop.run_in_executor(None, lambda: adv.url_to_df(urls))

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
                    'DOWNLOAD_TIMEOUT': 30        # Guardrail: 30s timeout per page
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

            word_freq = await loop.run_in_executor(None, lambda: adv.word_frequency([all_text], rm_stopwords=True))
            top_themes = word_freq.head(20).to_dict(orient='records')

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
                }
            ))
            
            if not os.path.exists(temp_file) or os.path.getsize(temp_file) == 0:
                return {"success": False, "error": "Site structure crawl produced no output."}

            crawl_df = pd.read_json(temp_file, lines=True)
            page_count = len(crawl_df)
            result = {"success": True, "page_count": page_count}

            # --- Link Health via crawlytics ---
            try:
                internal_regex = site_domain if site_domain else None
                link_df = adv.crawlytics.links(crawl_df, internal_url_regex=internal_regex)
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
                redirect_df = adv.crawlytics.redirects(crawl_df)
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
                img_df = adv.crawlytics.images(crawl_df)
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

    async def analyze_crawl_budget(self, sitemap_url: str, site_domain: str) -> Dict[str, Any]:
        """
        Analyze crawl budget by comparing sitemap inventory against actual crawl results.
        Estimates budget utilization, waste from redirects/errors, and optimization score.
        """
        temp_file = None
        try:
            self.logger.info(f"Analyzing crawl budget for {site_domain}")
            loop = asyncio.get_event_loop()

            sitemap_df = await loop.run_in_executor(None, lambda: adv.sitemap_to_df(sitemap_url))
            sitemap_total = len(sitemap_df) if sitemap_df is not None and not sitemap_df.empty else 0

            start_url = f"https://{site_domain}" if not site_domain.startswith("http") else site_domain

            with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as tf:
                temp_file = tf.name

            await loop.run_in_executor(None, lambda: adv.crawl(
                url_list=[start_url],
                output_file=temp_file,
                follow_links=True,
                allowed_domains=[site_domain],
                custom_settings={
                    'LOG_LEVEL': 'WARNING',
                    'CLOSESPIDER_PAGECOUNT': 30,
                    'DOWNLOAD_TIMEOUT': 15,
                    'CONCURRENT_REQUESTS_PER_DOMAIN': 5,
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

            df_a = await loop.run_in_executor(None, lambda: adv.sitemap_to_df(sitemap_a))
            df_b = await loop.run_in_executor(None, lambda: adv.sitemap_to_df(sitemap_b))

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
                    'DOWNLOAD_TIMEOUT': 30
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
