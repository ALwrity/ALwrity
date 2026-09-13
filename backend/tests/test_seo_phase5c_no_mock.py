"""Phase 5C TDD — backend never returns mock SEO data; fail fast.

No mock scores (78/84), no fake traffic. DB outage or service error must
raise HTTPException so the UI (Phase 1E) renders the error state.
Leaves content-strategy / calendar untouched.
"""
import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def test_no_mock_data_builder_or_literals():
    src = (BACKEND_ROOT / "api/seo_dashboard.py").read_text(
        encoding="utf-8", errors="ignore"
    )
    assert "get_mock_seo_data" not in src, "mock builder still present"
    assert "score=78" not in src and "score: 78" not in src
    assert "23450" not in src, "fake traffic literal still present"


def test_dashboard_data_raises_when_no_db_session():
    import api.seo_dashboard as dash
    from fastapi import HTTPException

    with patch.object(dash, "get_db_session", return_value=None):
        try:
            asyncio.run(dash.get_seo_dashboard_data({"id": "u1"}))
        except HTTPException as e:
            assert e.status_code in (500, 503)
            return
        raise AssertionError("expected HTTPException, got mock/success")


def test_dashboard_data_raises_when_service_fails():
    import api.seo_dashboard as dash
    from fastapi import HTTPException

    fake_session = MagicMock()
    fake_session.close = MagicMock()
    with (
        patch.object(dash, "get_db_session", return_value=fake_session),
        patch.object(
            dash,
            "SEODashboardService",
            return_value=MagicMock(
                get_dashboard_overview=AsyncMock(side_effect=RuntimeError("GSC down"))
            ),
        ),
    ):
        try:
            asyncio.run(dash.get_seo_dashboard_data({"id": "u1"}))
        except HTTPException as e:
            assert e.status_code in (500, 503)
            assert "GSC down" in str(e.detail) or "dashboard" in str(e.detail).lower()
            return
        raise AssertionError("expected HTTPException, got mock/success")
