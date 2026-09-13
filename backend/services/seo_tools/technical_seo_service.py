"""
Technical SEO Analysis Service

Comprehensive technical SEO crawler and analyzer with AI-enhanced
insights for website optimization and search engine compatibility.
"""

import asyncio
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
import time
from datetime import datetime
from typing import Dict, Any, List, Optional
from loguru import logger

from services.seo_tools.page_audit_common import fetch_page, normalize_url

class TechnicalSEOService:
    """Service for technical SEO analysis and crawling"""

    def __init__(self):
        """Initialize the technical SEO service"""
        self.service_name = "technical_seo_analyzer"
        logger.info(f"Initialized {self.service_name}")

    async def _fetch_page(self, url: str) -> tuple[Optional[str], int, float]:
        """Fetch page content via the shared helper (timeout 30s)."""
        return await fetch_page(url, timeout=30)

    async def analyze_technical_seo(
        self,
        url: str,
        crawl_depth: int = 3,
        include_external_links: bool = True,
        analyze_performance: bool = True
    ) -> Dict[str, Any]:
        """Analyze technical SEO factors"""
        try:
            url = normalize_url(url)
            content, status_code, load_time = await self._fetch_page(url)
            if content is None:
                raise RuntimeError(f"Fetch failed (status {status_code})")

            # Basic parsing
            soup = BeautifulSoup(content, 'html.parser')
                    
            # 1. Meta Tags Analysis
            title = soup.title.string if soup.title else None
            meta_desc = soup.find('meta', attrs={'name': 'description'})
            meta_desc_content = meta_desc['content'] if meta_desc else None
                    
            # 2. Heading Structure
            h1_tags = soup.find_all('h1')
            h2_tags = soup.find_all('h2')
            h3_tags = soup.find_all('h3')
                    
            # 3. Image Analysis
            images = soup.find_all('img')
            images_without_alt = [img['src'] for img in images if not img.get('alt')]
                    
            # 4. Link Analysis
            links = soup.find_all('a')
            internal_links = []
            external_links = []
            domain = urlparse(url).netloc
                    
            for link in links:
                href = link.get('href')
                if not href:
                    continue
                if href.startswith('http'):
                    if domain in href:
                        internal_links.append(href)
                    else:
                        external_links.append(href)
                elif href.startswith('/'):
                     internal_links.append(urljoin(url, href))

            # 5. Technical Issues Detection
            issues = []
                    
            # Status Code Issues
            if status_code != 200:
                issues.append({"type": f"Status Code {status_code}", "severity": "High", "pages_affected": 1})
                    
            # Performance Issues
            if load_time > 2.0:
                issues.append({"type": "Slow Server Response", "severity": "Medium", "pages_affected": 1})
                    
            # Meta Issues
            if not title:
                issues.append({"type": "Missing Title Tag", "severity": "High", "pages_affected": 1})
            elif len(title) > 60:
                issues.append({"type": "Title Tag Too Long", "severity": "Low", "pages_affected": 1})
                        
            if not meta_desc_content:
                issues.append({"type": "Missing Meta Description", "severity": "High", "pages_affected": 1})
                    
            # Content Structure Issues
            if not h1_tags:
                issues.append({"type": "Missing H1 Tag", "severity": "High", "pages_affected": 1})
            elif len(h1_tags) > 1:
                issues.append({"type": "Multiple H1 Tags", "severity": "Medium", "pages_affected": 1})
                        
            # Image Issues
            if images_without_alt:
                issues.append({"type": "Images Missing Alt Text", "severity": "Medium", "pages_affected": len(images_without_alt)})
                    
            # Security Issues
            if url.startswith('http:'):
                issues.append({"type": "Insecure Protocol (HTTP)", "severity": "High", "pages_affected": 1})
                    
            return {
                "url": url,
                "pages_crawled": 1, # Currently single page
                "crawl_depth": 1,
                "technical_issues": issues,
                "site_structure": {
                    "internal_links": len(internal_links),
                    "external_links": len(external_links) if include_external_links else 0,
                    "h1_count": len(h1_tags),
                    "h2_count": len(h2_tags),
                    "h3_count": len(h3_tags)
                },
                "performance_metrics": {
                    "response_time": round(load_time, 3),
                    "content_size": len(content)
                } if analyze_performance else {},
                "recommendations": [issue['type'] for issue in issues],
                "crawl_summary": {
                    "successful": 1 if status_code == 200 else 0,
                    "errors": 1 if status_code >= 400 else 0,
                    "redirects": 1 if 300 <= status_code < 400 else 0
                }
            }

        except Exception as e:
            logger.error(f"Error in technical SEO analysis: {e}")
            return {
                "url": url,
                "error": str(e),
                "technical_issues": [{"type": "Crawl Failed", "severity": "High", "pages_affected": 1}]
            }
    
    async def health_check(self) -> Dict[str, Any]:
        """Health check for the technical SEO service"""
        return {
            "status": "operational",
            "service": self.service_name,
            "last_check": datetime.utcnow().isoformat()
        }