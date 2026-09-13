"""
OpenGraph Tags Generation Service

Phase 10 (plan Phase B / B3a): previously returned canned placeholder tags
("AI-Generated Title", a default-image URL) for every URL. It now reads the
REAL page: existing og:* tags first, then <title>/meta description as derived
fallbacks, and only then the caller's hints. Fetch failure is explicit
("unavailable") — never fabricated tag values.
"""

from typing import Dict, Any, Optional
from datetime import datetime
from html.parser import HTMLParser
from loguru import logger

from services.seo_tools.page_audit_common import fetch_page


class _HeadMetaParser(HTMLParser):
    """Collects <title> and <meta name/property=... content=...> from a page."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title: Optional[str] = None
        self._in_title = False
        self.meta: Dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag == "title":
            self._in_title = True
        elif tag == "meta":
            data = {k.lower(): v for k, v in attrs if k and v is not None}
            key = data.get("property") or data.get("name")
            content = data.get("content")
            if key and content is not None:
                self.meta[key.lower()] = content

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title = (self.title or "") + data


def _parse_page_meta(html: str) -> _HeadMetaParser:
    parser = _HeadMetaParser()
    try:
        parser.feed(html or "")
        parser.close()
    except Exception as e:  # malformed HTML must not explode the tool
        logger.warning(f"OpenGraph meta parse issue: {e}")
    return parser


class OpenGraphService:
    """Service for generating OpenGraph tags from real page metadata"""

    def __init__(self):
        """Initialize the OpenGraph service"""
        self.service_name = "opengraph_generator"
        logger.info(f"Initialized {self.service_name}")

    async def generate_opengraph_tags(
        self,
        url: str,
        title_hint: Optional[str] = None,
        description_hint: Optional[str] = None,
        platform: str = "General",
    ) -> Dict[str, Any]:
        """Generate OpenGraph tags for a URL from its REAL page metadata."""
        html = None
        status = 500
        try:
            html, status, _load = await fetch_page(url)
        except Exception as e:
            logger.warning(f"OpenGraph page fetch raised for {url}: {e}")
            html = None

        if not html:
            logger.info(f"OpenGraph unavailable for {url} (fetch status {status})")
            return {
                "status": "unavailable",
                "data_source": "unavailable",
                "og_tags": {},
                "platform_optimized": platform,
                "recommendations": [],
                "validation": {
                    "valid": False,
                    "issues": [f"Page could not be fetched (HTTP {status})"],
                },
                "message": "Could not fetch the page; no OpenGraph tags can be derived.",
            }

        meta = _parse_page_meta(html)
        page_title = (meta.title or "").strip() or None

        # Real page values win; hints are only fallbacks.
        title = meta.meta.get("og:title") or page_title or title_hint
        description = (
            meta.meta.get("og:description")
            or meta.meta.get("description")
            or description_hint
        )
        image = meta.meta.get("og:image")

        og_tags: Dict[str, str] = {"og:url": url, "og:type": "website"}
        if title:
            og_tags["og:title"] = title
        if description:
            og_tags["og:description"] = description
        if image:
            og_tags["og:image"] = image
        if (platform or "").lower() == "twitter":
            og_tags["twitter:card"] = "summary_large_image" if image else "summary"

        issues = []
        recommendations = []
        if not title:
            issues.append("Missing og:title")
            recommendations.append("Add a page <title> or og:title tag.")
        elif len(title) > 60:
            recommendations.append("Shorten og:title to <= 60 characters for full display.")
        if not description:
            issues.append("Missing og:description")
            recommendations.append("Add a meta description or og:description tag.")
        elif len(description) > 160:
            recommendations.append("Shorten og:description to <= 160 characters.")
        if not image:
            issues.append("Missing og:image")
            recommendations.append("Add an og:image (1200x630) for richer social cards.")

        return {
            "og_tags": og_tags,
            "platform_optimized": platform,
            "recommendations": recommendations,
            "validation": {"valid": not issues, "issues": issues},
            "data_source": "page",
        }

    async def health_check(self) -> Dict[str, Any]:
        """Health check for the OpenGraph service"""
        return {
            "status": "operational",
            "service": self.service_name,
            "last_check": datetime.utcnow().isoformat(),
        }
