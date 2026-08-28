"""
Lightweight SEO audit preview — runs a 3-page subset for instant onboarding feedback.

Reuses the same SEO analyzers as the full executor but runs single-threaded
on just the first 3 discoverable pages, returning results synchronously.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List

import aiohttp
from loguru import logger

from services.seo_analyzer.analyzers import (
    MetaDataAnalyzer,
    TechnicalSEOAnalyzer,
    ContentAnalyzer,
    URLStructureAnalyzer,
    AccessibilityAnalyzer,
    UserExperienceAnalyzer,
)

PREVIEW_PAGE_LIMIT = 3
PREVIEW_TIMEOUT = 15  # seconds per page fetch
PREVIEW_WEIGHTS = {
    "meta": 0.15,
    "content": 0.20,
    "technical": 0.20,
    "performance": 0.20,
    "accessibility": 0.10,
    "ux": 0.10,
    "security": 0.05,
}


async def run_seo_preview(website_url: str) -> Dict[str, Any]:
    """Run a 3-page SEO preview and return results for onboarding display."""
    logger.info(f"[SeoPreview] Starting preview for {website_url}")

    # Discover pages from sitemap or crawl homepage
    pages = await _discover_preview_pages(website_url)
    if not pages:
        return {"success": False, "error": "Could not discover any pages", "pages": []}

    # Analyze each page
    meta = MetaDataAnalyzer()
    content_analyzer = ContentAnalyzer()
    technical = TechnicalSEOAnalyzer()
    url_structure = URLStructureAnalyzer()
    accessibility = AccessibilityAnalyzer()
    ux = UserExperienceAnalyzer()

    results: List[Dict[str, Any]] = []
    for url, html in pages:
        page_result = {"url": url}

        # Each analyzer takes (html_content, url) as positionals
        page_result["meta"] = _summarize(meta.analyze(html, url))
        page_result["content"] = _summarize(content_analyzer.analyze(html, url))
        page_result["technical"] = _summarize(technical.analyze(html, url))
        page_result["url_structure"] = _summarize(url_structure.analyze(url))
        page_result["accessibility"] = _summarize(accessibility.analyze(html))
        page_result["ux"] = _summarize(ux.analyze(html, url))

        # Overall score
        scores = []
        for cat, weight in PREVIEW_WEIGHTS.items():
            cat_score = page_result.get(cat, {}).get("score", 0)
            scores.append(cat_score * weight)
        page_result["overall_score"] = round(sum(scores) * 100, 1)

        # Top issues — flatten into human-readable {category, severity, issue, fix}
        issues = []
        for cat in ("meta", "content", "technical", "accessibility", "ux"):
            cat_issues = page_result.get(cat, {}).get("issues", [])[:3]
            for i in cat_issues:
                if isinstance(i, dict):
                    issues.append({
                        "category": cat,
                        "severity": i.get("severity", "issue"),
                        "issue": i.get("message", ""),
                        "fix": i.get("fix", ""),
                        "location": i.get("location", ""),
                    })
                else:
                    issues.append({"category": cat, "severity": "issue", "issue": str(i), "fix": ""})
        page_result["top_issues"] = issues[:5]

        results.append(page_result)

    # Site-level summary
    avg_score = round(sum(p["overall_score"] for p in results) / len(results), 1) if results else 0
    total_issues = sum(len(p.get("top_issues", [])) for p in results)

    logger.info(f"[SeoPreview] Done — {len(results)} pages, avg score {avg_score}")

    return {
        "success": True,
        "pages_analyzed": len(results),
        "average_score": avg_score,
        "total_issues_found": total_issues,
        "preview_mode": True,
        "pages": results,
    }


async def _discover_preview_pages(website_url: str) -> List[tuple]:
    """Discover up to PREVIEW_PAGE_LIMIT pages using sitemap (same as full analysis)."""
    from urllib.parse import urlparse

    # Try common sitemap locations (with and without www)
    base = website_url.rstrip("/")
    parsed = urlparse(website_url)
    domain = parsed.netloc.replace("www.", "")
    sitemap_candidates = list(dict.fromkeys([
        f"{base}/sitemap.xml",
        f"{base}/sitemap_index.xml",
        f"{base}/wp-sitemap.xml",
        f"https://{domain}/sitemap.xml",
        f"https://www.{domain}/sitemap.xml",
    ]))

    logger.info(f"[SeoPreview] Trying sitemap candidates: {sitemap_candidates}")

    for sitemap_url in sitemap_candidates:
        try:
            from services.seo.advertools_service import AdvertoolsService
            import pandas as pd
            # Use the rate-limit-aware wrapper: fetches sitemap indexes and
            # sub-sitemaps SEQUENTIALLY with pacing, instead of advertools'
            # default recursive concurrent fetch (max_workers=8) which 429s.
            # A preview only needs a handful of URLs, so cap the sub-sitemap
            # recursion at PREVIEW_PAGE_LIMIT and keep retries low (fast fail
            # instead of burning 4 retries × 30s backoff per sub-sitemap).
            # The fetch is synchronous (blocking sleeps), so run it in a thread
            # to avoid blocking the FastAPI event loop for other requests.
            loop = asyncio.get_running_loop()
            df = await loop.run_in_executor(
                None,
                lambda: AdvertoolsService._sitemap_to_df_with_retry(
                    sitemap_url,
                    max_retries=1,
                    max_urls=PREVIEW_PAGE_LIMIT * 2,
                ),
            )
            if df is not None and not df.empty and "loc" in df.columns:
                urls = df["loc"].dropna().head(PREVIEW_PAGE_LIMIT).tolist()
                logger.info(
                    f"[SeoPreview] Sitemap {sitemap_url} returned {len(urls)} URLs"
                )
                discovered = []
                async with aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=15)
                ) as session:
                    for url in urls:
                        try:
                            async with session.get(url, allow_redirects=True) as resp:
                                if resp.status == 200:
                                    discovered.append((str(resp.url), await resp.text()))
                        except Exception:
                            pass
                        if len(discovered) >= PREVIEW_PAGE_LIMIT:
                            break
                if discovered:
                    return discovered
        except Exception as exc:
            logger.info(f"[SeoPreview] Sitemap {sitemap_url} failed: {exc}")
            continue

    # Fallback: just fetch the homepage
    logger.info("[SeoPreview] No sitemap found, falling back to homepage only")
    try:
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=PREVIEW_TIMEOUT)
        ) as session:
            async with session.get(website_url, allow_redirects=True) as resp:
                if resp.status == 200:
                    return [(str(resp.url), await resp.text())]
    except Exception:
        pass
    return []


def _summarize(result: Dict) -> Dict:
    """Extract key fields from an analyzer result for preview display."""
    summary = {}
    if isinstance(result, dict):
        raw_score = result.get("score", result.get("overall_score", 0))
        summary["score"] = min(1.0, max(0.0, float(raw_score) / 100))
        issues = result.get("issues", result.get("findings", []))
        flat = []
        if isinstance(issues, list):
            for item in issues:
                if isinstance(item, dict):
                    # Keep the rich analyzer fields (message + fix + severity)
                    # so the UI can render a human-readable problem and remedy.
                    flat.append({
                        "severity": item.get("type", "issue"),
                        "message": item.get("message", ""),
                        "location": item.get("location", ""),
                        "fix": item.get("fix", ""),
                        "current_value": item.get("current_value", ""),
                    })
                else:
                    flat.append({"severity": "issue", "message": str(item), "location": "", "fix": ""})
        elif isinstance(issues, dict):
            flat = [
                {"severity": "issue", "message": str(v), "location": k, "fix": ""}
                for k, v in list(issues.items())[:3]
            ]
        summary["issues"] = flat[:5]
    return summary
