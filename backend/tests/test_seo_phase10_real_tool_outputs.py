"""
Phase 10 (plan Phase B, slice 1) — real outputs for user-facing SEO tools.

B3a: OpenGraphService returned canned tags ("AI-Generated Title",
     "https://example.com/default-image.jpg"). It now parses the REAL page
     (title, meta description, existing og:*) and only uses hints as fallback;
     fetch failure -> explicit unavailable, never canned values.
B3b: ImageAltService returned canned alt text + fake confidence. It now uses
     the real Gemini vision seam (describe_image) and derives confidence from
     actual keyword coverage; unavailable vision -> explicit unavailable.
B4:  EnterpriseSEOService._execute_competitive_analysis fabricated
     "Data from external API" + invented advantages/gaps. It now calls the
     real DeepCompetitorAnalysisService when a user + competitors exist, and
     otherwise returns explicit no_data. The fabricating helpers are deleted.
"""

import asyncio
import inspect
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from services.seo_tools.opengraph_service import OpenGraphService
from services.seo_tools.image_alt_service import ImageAltService


# ---------------------------------------------------------------------------
# B3a — OpenGraph reads the real page
# ---------------------------------------------------------------------------

PAGE_HTML = """
<html><head>
<title>Real Page Title | ALwrity</title>
<meta name="description" content="A real meta description for the page." />
<meta property="og:image" content="https://real.example.com/cover.png" />
<meta property="og:title" content="Existing OG Title" />
<meta property="og:description" content="Existing OG description." />
</head><body><h1>Hi</h1></body></html>
"""


def _og_service() -> OpenGraphService:
    return OpenGraphService()


def test_b3a_opengraph_uses_real_page_metadata():
    service = _og_service()
    with patch(
        "services.seo_tools.opengraph_service.fetch_page",
        new=AsyncMock(return_value=(PAGE_HTML, 200, 0.12)),
    ):
        result = asyncio.run(service.generate_opengraph_tags("https://real.example.com"))

    assert result["data_source"] == "page"
    tags = result["og_tags"]
    # Real page values win over hints/defaults.
    assert tags["og:title"] == "Existing OG Title"
    assert tags["og:description"] == "Existing OG description."
    assert tags["og:image"] == "https://real.example.com/cover.png"
    assert tags["og:url"] == "https://real.example.com"
    assert "AI-Generated Title" not in str(result)
    assert "default-image" not in str(result)
    assert result["validation"]["valid"] is True


def test_b3a_opengraph_derives_from_title_and_meta_description_when_no_og():
    html = (
        "<html><head><title>Fallback Title From Page</title>"
        '<meta name="description" content="Fallback description from meta." />'
        "</head><body></body></html>"
    )
    service = _og_service()
    with patch(
        "services.seo_tools.opengraph_service.fetch_page",
        new=AsyncMock(return_value=(html, 200, 0.1)),
    ):
        result = asyncio.run(
            service.generate_opengraph_tags("https://x.com", description_hint=None)
        )

    assert result["og_tags"]["og:title"] == "Fallback Title From Page"
    assert result["og_tags"]["og:description"] == "Fallback description from meta."


def test_b3a_opengraph_fetch_failure_is_explicit_unavailable():
    service = _og_service()
    with patch(
        "services.seo_tools.opengraph_service.fetch_page",
        new=AsyncMock(return_value=(None, 404, 0.05)),
    ):
        result = asyncio.run(service.generate_opengraph_tags("https://gone.example.com"))

    assert result["status"] == "unavailable"
    assert result["data_source"] == "unavailable"
    assert result["og_tags"] == {}
    assert "AI-Generated" not in str(result)
    assert "default-image" not in str(result)


# ---------------------------------------------------------------------------
# B3b — Image alt text uses real vision, honest when unavailable
# ---------------------------------------------------------------------------

def test_b3b_alt_text_from_file_uses_vision_and_real_confidence():
    service = ImageAltService()
    with patch(
        "services.seo_tools.image_alt_service.describe_image",
        return_value="A guide to SEO tools on a laptop screen",
    ), patch("services.seo_tools.image_alt_service.os.path.exists", return_value=True):
        result = asyncio.run(
            service.generate_alt_text_from_file(
                "/tmp/pic.png", context="blog hero", keywords=["seo", "tools"]
            )
        )

    assert result["data_source"] == "vision"
    assert result["alt_text"] == "A guide to SEO tools on a laptop screen"
    # confidence is DERIVED: 2/2 requested keywords present.
    assert result["confidence"] == 1.0
    assert "AI-generated" not in str(result)


def test_b3b_alt_text_unavailable_when_vision_returns_none():
    service = ImageAltService()
    with patch(
        "services.seo_tools.image_alt_service.describe_image", return_value=None
    ), patch("services.seo_tools.image_alt_service.os.path.exists", return_value=True):
        result = asyncio.run(service.generate_alt_text_from_file("/tmp/pic.png"))

    assert result["status"] == "unavailable"
    assert result["data_source"] == "unavailable"
    assert result["alt_text"] == ""
    assert "AI-generated" not in str(result)


def test_b3b_alt_text_from_url_download_failure_is_unavailable():
    service = ImageAltService()
    with patch.object(
        service, "_download_image_to_temp", new=AsyncMock(return_value=None)
    ):
        result = asyncio.run(
            service.generate_alt_text_from_url("https://x.com/a.png", keywords=["seo"])
        )

    assert result["status"] == "unavailable"
    assert result["alt_text"] == ""


# ---------------------------------------------------------------------------
# B4 — enterprise competitive analysis: real service or explicit no_data
# ---------------------------------------------------------------------------

DEEP_FIXTURE = {
    "baseline": {"domain": "me.com"},
    "competitors": [{"input": {"url": "https://c.com"}, "extraction": {}, "ai_analysis": {}}],
    "aggregation": {"summary": "Competitor publishes weekly", "market_velocity": "high"},
    "metadata": {"generated_at": "2026-09-13T00:00:00Z", "competitors_analyzed": 1},
}


def _enterprise():
    from services.seo_tools.enterprise_seo_service import EnterpriseSEOService

    service = EnterpriseSEOService.__new__(EnterpriseSEOService)
    service.logger = MagicMock()
    return service


def test_b4_competitive_uses_real_deep_analysis_when_available():
    service = _enterprise()
    fake_deep = MagicMock()
    fake_deep.run = AsyncMock(return_value=DEEP_FIXTURE)
    with patch(
        "services.seo.deep_competitor_analysis_service.DeepCompetitorAnalysisService",
        MagicMock(return_value=fake_deep),
    ):
        result = asyncio.run(
            service._execute_competitive_analysis(
                "https://me.com", ["https://c.com"], "audit-1", user_id="u1"
            )
        )

    assert result["data_source"] == "deep_competitor_analysis"
    assert result["primary_site"] == "https://me.com"
    assert result["aggregation"] == DEEP_FIXTURE["aggregation"]
    # Real service received the authenticated user + competitors.
    _, kwargs = fake_deep.run.call_args
    assert kwargs["user_id"] == "u1"
    assert kwargs["competitors"] == [{"url": "https://c.com"}]
    # Fabricated placeholders must be gone.
    assert "Data from external API" not in str(result)
    assert "competitive_advantages" not in result
    assert "Unique content angle" not in str(result)


def test_b4_competitive_without_competitors_or_user_is_no_data():
    service = _enterprise()
    no_comp = asyncio.run(
        service._execute_competitive_analysis("https://me.com", [], "audit-1", user_id="u1")
    )
    assert no_comp["status"] == "no_data"
    assert no_comp["data_source"] == "none"

    no_user = asyncio.run(
        service._execute_competitive_analysis(
            "https://me.com", ["https://c.com"], "audit-1", user_id=None
        )
    )
    assert no_user["status"] == "no_data"
    assert "Data from external API" not in str(no_user)


def test_b4_fabricating_helpers_deleted():
    from services.seo_tools.enterprise_seo_service import EnterpriseSEOService

    assert not hasattr(EnterpriseSEOService, "_identify_competitive_advantages")
    assert not hasattr(EnterpriseSEOService, "_identify_competitive_gaps")
