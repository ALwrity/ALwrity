"""Phase 2B TDD — page-audit golden outputs + shared fetch helper.

No network. Fixture HTML exercises title/meta/h1/images/links rules.
Leaves content-strategy / calendar / seo_dashboard.py untouched.
"""
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

FIXTURE_HTML = """<html><head>
<title>Short</title>
<meta name="description" content="A fine description well within the ideal length limits for search testing purposes.">
<meta name="viewport" content="width=device-width">
<link rel="canonical" href="https://example.com/page">
</head><body>
<h1>Heading one</h1> <h1>Heading two</h1>
<p>{" ".join(["word"] * 400)}</p>
<img src="/a.png" alt="ok"><img src="/b.png">
<a href="https://example.com/other">in</a> <a href="https://other.test/x">out</a>
</body></html>""".replace('{" ".join(["word"] * 400)}', " ".join(["word"] * 400))


def test_on_page_golden_output():
    import asyncio
    from services.seo_tools.on_page_seo_service import OnPageSEOService

    async def _run():
        svc = OnPageSEOService()
        # Patch at helper namespace (from-import binds there); exercises wrapper.
        with patch(
            "services.seo_tools.on_page_seo_service.fetch_page",
            new=AsyncMock(return_value=(FIXTURE_HTML, 200, 0.1)),
        ):
            return await svc.analyze_on_page_seo("https://example.com/page")

    result = asyncio.run(_run())
    assert result["url"] == "https://example.com/page"
    assert result["overall_score"] == 90  # -10 short title only
    assert result["meta"]["score"] == 90
    assert result["technical"]["score"] == 90  # -10 multiple H1
    assert result["content_health"]["score"] == 90  # -10 one image w/o alt
    # 400 fixture words + title(1) + headings(4) + links(2), whitespace-separated
    assert result["content_health"]["word_count"] == 407
    assert any("Title length" in i for i in result["meta"]["issues"])
    assert any("Multiple H1" in i for i in result["technical"]["issues"])


def test_technical_golden_output():
    import asyncio
    from services.seo_tools.technical_seo_service import TechnicalSEOService

    async def _run():
        svc = TechnicalSEOService()
        # Seam: shared helper at the service's namespace (from-import binds there).
        with patch(
            "services.seo_tools.technical_seo_service.fetch_page",
            new=AsyncMock(return_value=(FIXTURE_HTML, 200, 0.1)),
        ):
            return await svc.analyze_technical_seo("https://example.com/page")

    result = asyncio.run(_run())
    assert result["site_structure"]["h1_count"] == 2
    assert result["site_structure"]["internal_links"] == 1
    assert result["site_structure"]["external_links"] == 1
    assert any(i["type"] == "Multiple H1 Tags" for i in result["technical_issues"])


def test_technical_health_check_operational():
    import asyncio
    from services.seo_tools.technical_seo_service import TechnicalSEOService

    result = asyncio.run(TechnicalSEOService().health_check())
    assert result["status"] == "operational", f"health_check broken: {result}"


def test_shared_fetch_helper_exists():
    """Both services must delegate fetching to page_audit_common (no dup)."""
    src_common = (BACKEND_ROOT / "services/seo_tools/page_audit_common.py").read_text()
    assert "async def fetch_page" in src_common
    for rel in (
        "services/seo_tools/on_page_seo_service.py",
        "services/seo_tools/technical_seo_service.py",
    ):
        src = (BACKEND_ROOT / rel).read_text()
        assert "page_audit_common" in src, f"{rel} must use shared fetch helper"
        assert "ClientSession()" not in src, f"{rel} must not open raw sessions"
