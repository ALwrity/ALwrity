"""Phase 2A TDD — sitemap single-path contract + dead-finder removal.

Discovery is already single-engine (ssot wraps SitemapService.discover);
onboarding already delegates to analyze_sitemap. This locks that contract
and removes the one dead method. No network. No seo_dashboard.py changes.
Leaves content-strategy / calendar untouched.
"""
import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def test_no_dead_homepage_finder():
    """_find_sitemap_on_homepage is defined but never called — delete it."""
    src = (BACKEND_ROOT / "services/seo_tools/sitemap_service.py").read_text(
        encoding="utf-8", errors="ignore"
    )
    assert "_find_sitemap_on_homepage" not in src, "dead finder still present"
    # Live finders stay
    assert "_find_sitemap_in_robots_txt" in src
    assert "_find_sitemap_by_common_paths" in src


def test_ssot_falls_back_to_single_discovery_engine():
    """ssot with failing DB store delegates to SitemapService.discover."""
    from services.seo import sitemap_ssot as ssot

    svc = MagicMock()
    svc.discover_sitemap_url = AsyncMock(return_value="https://x.test/sitemap.xml")
    db = MagicMock()
    # Force store-read failure -> discovery fallback (fail-fast, logged)
    with (
        __import__("unittest.mock", fromlist=["patch"]).patch.object(
            ssot, "get_stored_sitemap_url", side_effect=RuntimeError("db down")
        ),
    ):
        url = asyncio.run(ssot.get_or_discover_sitemap_url("u1", "https://x.test", svc, db=db))
    assert url == "https://x.test/sitemap.xml"
    svc.discover_sitemap_url.assert_awaited_once_with("https://x.test")


def test_onboarding_delegates_to_canonical_analyze():
    """analyze_sitemap_for_onboarding must funnel through analyze_sitemap."""
    from services.seo_tools.sitemap_service import SitemapService

    svc = SitemapService()
    canonical = AsyncMock(
        return_value={"total_urls": 0, "urls": [], "structure_analysis": {}}
    )
    with (
        __import__("unittest.mock", fromlist=["patch"]).patch.object(
            SitemapService, "analyze_sitemap", canonical
        ),
    ):
        result = asyncio.run(
            svc.analyze_sitemap_for_onboarding("https://x.test/sitemap.xml", "https://x.test")
        )
    canonical.assert_awaited_once()
    assert result["user_url"] == "https://x.test"
    assert result["onboarding_insights"]["content_gaps"] == []


def test_engines_keep_distinct_output_contracts():
    """Advertools (pandas metrics+inventory) vs SitemapService (XML insights)
    serve different consumers — document the split so nobody merges blindly."""
    import ast

    adv = ast.parse(
        (BACKEND_ROOT / "services/seo/advertools_service.py").read_text(
            encoding="utf-8", errors="ignore"
        )
    )
    names = set()
    for n in ast.walk(adv):
        if isinstance(n, ast.ClassDef) and n.name == "AdvertoolsService":
            names = {
                m.name
                for m in n.body
                if isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef))
            }
    # Pandas-only capabilities with no XML-service equivalent
    for required in ("analyze_crawl_budget", "analyze_robots_txt", "sitemap_compare"):
        assert required in names, f"AdvertoolsService.{required} missing"
