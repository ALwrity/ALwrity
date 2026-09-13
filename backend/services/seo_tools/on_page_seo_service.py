"""
On-Page SEO Analysis Service

Comprehensive on-page SEO analyzer with AI-enhanced insights
for content optimization and technical improvements.
"""

from bs4 import BeautifulSoup
from typing import Dict, Any, List, Optional
from datetime import datetime
from loguru import logger
import re
from urllib.parse import urlparse

from services.seo_tools.page_audit_common import fetch_page, normalize_url

class OnPageSEOService:
    """Service for comprehensive on-page SEO analysis"""

    def __init__(self):
        """Initialize the on-page SEO service"""
        self.service_name = "on_page_seo_analyzer"
        logger.info(f"Initialized {self.service_name}")

    async def _fetch_page(self, url: str) -> tuple[Optional[str], int]:
        """Fetch page content via the shared helper (timeout 10s)."""
        html, status, _load_time = await fetch_page(url, timeout=10)
        return html, status

    def _analyze_meta_tags(self, soup: BeautifulSoup) -> Dict[str, Any]:
        """Analyze meta tags"""
        title = soup.title.string if soup.title else None
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        viewport = soup.find('meta', attrs={'name': 'viewport'})
        robots = soup.find('meta', attrs={'name': 'robots'})
        charset = soup.find('meta', attrs={'charset': True})
        
        # Social Tags
        og_title = soup.find('meta', property='og:title')
        og_desc = soup.find('meta', property='og:description')
        og_image = soup.find('meta', property='og:image')
        twitter_card = soup.find('meta', attrs={'name': 'twitter:card'})

        issues = []
        score = 100

        # Title Analysis
        if not title:
            issues.append("Missing title tag")
            score -= 20
        elif len(title) < 30 or len(title) > 60:
            issues.append(f"Title length ({len(title)} chars) should be 30-60 chars")
            score -= 10

        # Description Analysis
        desc_content = meta_desc['content'] if meta_desc else None
        if not desc_content:
            issues.append("Missing meta description")
            score -= 20
        elif len(desc_content) < 70 or len(desc_content) > 160:
            issues.append(f"Description length ({len(desc_content)} chars) should be 70-160 chars")
            score -= 10

        # Viewport
        if not viewport:
            issues.append("Missing viewport meta tag")
            score -= 20
        
        og_found = list(filter(None, ['Title' if og_title else '', 'Desc' if og_desc else '', 'Image' if og_image else '']))

        return {
            "title_length": f"{len(title)} chars" if title else "Missing",
            "meta_description_length": f"{len(desc_content)} chars" if desc_content else "Missing",
            "has_viewport": bool(viewport),
            "charset": charset['charset'] if charset else "Missing",
            "robots_meta": robots['content'] if robots else "Missing (Default: index, follow)",
            "og_tags": f"Found: {', '.join(og_found)}" if og_found else "None",
            "twitter_card": twitter_card['content'] if twitter_card else "Missing",
            "score": max(0, score),
            "issues": issues
        }

    def _analyze_technical(self, soup: BeautifulSoup, url: str) -> Dict[str, Any]:
        """Analyze technical SEO elements"""
        canonical = soup.find('link', attrs={'rel': 'canonical'})
        schema = soup.find_all('script', type='application/ld+json')
        
        issues = []
        score = 100

        if not canonical:
            issues.append("Missing canonical tag")
            score -= 10
        
        # Check H1
        h1_tags = soup.find_all('h1')
        if len(h1_tags) == 0:
            issues.append("Missing H1 tag")
            score -= 20
        elif len(h1_tags) > 1:
            issues.append(f"Multiple H1 tags found ({len(h1_tags)})")
            score -= 10

        return {
            "canonical_tag": canonical['href'] if canonical else "Missing",
            "schema_markup": f"Found {len(schema)} schema objects",
            "h1_count": len(h1_tags),
            "score": max(0, score),
            "issues": issues
        }

    def _analyze_content(self, soup: BeautifulSoup) -> Dict[str, Any]:
        """Analyze content quality"""
        # Remove scripts and styles
        for script in soup(["script", "style"]):
            script.extract()
            
        text = soup.get_text()
        words = len(re.findall(r'\w+', text))
        
        images = soup.find_all('img')
        images_without_alt = sum(1 for img in images if not img.get('alt'))
        
        issues = []
        score = 100

        if words < 300:
            issues.append(f"Low word count ({words} words)")
            score -= 20
            
        if images_without_alt > 0:
            issues.append(f"{images_without_alt} images missing alt text")
            score -= 10

        return {
            "word_count": words,
            "total_images": len(images),
            "images_without_alt": images_without_alt,
            "readability": "Good" if words > 300 else "Needs Improvement", # Placeholder for readability algo
            "score": max(0, score),
            "issues": issues
        }

    def _analyze_url_structure(self, url: str) -> Dict[str, Any]:
        parsed = urlparse(url)
        return {
            "protocol": parsed.scheme,
            "domain": parsed.netloc,
            "path_depth": len(parsed.path.strip('/').split('/')) if parsed.path else 0,
            "is_https": parsed.scheme == 'https'
        }

    def _calculate_overall_score(self, *analyses) -> int:
        total = sum(a.get('score', 0) for a in analyses)
        return round(total / len(analyses))

    def _generate_summary(self, *analyses) -> Dict[str, Any]:
        critical_issues = []
        for a in analyses:
            for issue in a.get('issues', []):
                critical_issues.append({"message": issue, "severity": "critical", "category": "SEO"})
        return {"critical_issues": critical_issues}

    async def analyze_on_page_seo(
        self,
        url: str,
        target_keywords: Optional[List[str]] = None,
        analyze_images: bool = True,
        analyze_content_quality: bool = True
    ) -> Dict[str, Any]:
        """Analyze on-page SEO factors"""
        try:
            # Add protocol if missing
            if not url.startswith(('http://', 'https://')):
                url = 'https://' + url

            html_content, status_code = await self._fetch_page(url)
            
            if not html_content:
                # Return error structure
                return {
                    "url": url,
                    "overall_score": 0,
                    "summary": {"critical_issues": [{"message": f"Failed to fetch URL (Status: {status_code})", "severity": "critical", "category": "Connectivity"}]},
                    "meta": {}, "technical": {}, "content_health": {}, "url_structure": {}, "performance": {}, "accessibility": {}, "ux": {}
                }
            
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Run Analyses
            meta_analysis = self._analyze_meta_tags(soup)
            technical_analysis = self._analyze_technical(soup, url)
            content_analysis = self._analyze_content(soup)
            url_analysis = self._analyze_url_structure(url)
            
            result = {
                "url": url,
                "overall_score": self._calculate_overall_score(meta_analysis, technical_analysis, content_analysis),
                "meta": meta_analysis,
                "technical": technical_analysis,
                "content_health": content_analysis,
                "url_structure": url_analysis,
                "performance": {"load_time": "Real-time check pending"},
                "accessibility": {"images_without_alt": content_analysis["images_without_alt"]},
                "ux": {"viewport": meta_analysis["has_viewport"], "mobile_friendly": bool(meta_analysis["has_viewport"])},
                "summary": self._generate_summary(meta_analysis, technical_analysis, content_analysis)
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing {url}: {str(e)}")
            return {
                "url": url,
                "overall_score": 0,
                "summary": {"critical_issues": [{"message": str(e), "severity": "critical", "category": "System"}]},
                "meta": {}, "technical": {}, "content_health": {}, "url_structure": {}, "performance": {}, "accessibility": {}, "ux": {}
            }
    
    async def health_check(self) -> Dict[str, Any]:
        """Health check for the on-page SEO service"""
        return {
            "status": "operational",
            "service": self.service_name,
            "last_check": datetime.utcnow().isoformat()
        }
