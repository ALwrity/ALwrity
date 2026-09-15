"""Onboarding-data route + canonical-profile read tests (Brand Brain Phase 0).

``GET /enhanced-strategies/onboarding-data`` is referenced by
``StrategySetupWizard/BrandBrainView.tsx`` but was never registered -- it 404s
today. These tests lock it into the real ``routes.py`` surface (auth-gated, not
404) and pin the envelope it must return: ``data.canonical_profile`` (+ its
``sources``), ``data_quality``, and a processing timestamp.

The onboarding integration pipeline itself is covered by the dedicated service
suites (``test_data_integration_rebuild``, ``test_canonical_profile_enrichment``).
Here the service is patched at the endpoint seam so route wiring + response
envelope are tested without a 10-table SQLite fixture.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

UTILITY_MOD = "api.content_planning.api.content_strategy.endpoints.utility_endpoints"

SAMPLE_CANONICAL = {
    "industry": "B2B SaaS",
    "target_audience": {"demographics": "marketing leaders"},
    "writing_tone": "professional",
    "writing_voice": "authoritative",
    "writing_complexity": "intermediate",
    "content_types": ["blog_post", "case_study"],
    "strategic_insights": "SEO growth via thought leadership",
    "sources": {"industry": "website_analysis", "target_audience": "research_preferences"},
}
SAMPLE_INTEGRATED = {
    "onboarding_session": {"current_step": 6, "progress": 100},
    "canonical_profile": SAMPLE_CANONICAL,
    "data_quality": {"completeness": 0.9, "overall_score": 0.8},
    "processing_timestamp": "2026-09-14T00:00:00",
}


class _FakeSession:
    """Placeholder session handed to the mocked service (unused there)."""


def _unauthorized_user():
    raise HTTPException(status_code=401, detail="Unauthorized")


def _fake_user(uid: str = "999") -> dict:
    return {"id": uid, "uid": uid, "clerk_user_id": uid, "email": "t@e.com", "is_active": True}


def _build_layered_app():
    """Real enhanced-strategies surface (routes.py) with auth gated out."""
    from api.content_planning.api.content_strategy.routes import router
    from middleware.auth_middleware import get_current_user

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = _unauthorized_user
    return app


class TestOnboardingDataRouteMounted:
    """RED: before Phase 0 the wizard's call path is shadowed.

    Without a registered ``GET /enhanced-strategies/onboarding-data``, the
    request falls through to the parameterized ``GET
    /enhanced-strategies/{strategy_id}`` CRUD route (``strategy_crud.py``),
    which rejects ``onboarding-data`` as a non-integer id (422 in production).
    """

    def test_onboarding_data_specific_route_registered(self):
        from api.content_planning.api.content_strategy.routes import router

        paths = [r.path for r in router.routes]
        assert (
            "/enhanced-strategies/onboarding-data" in paths
        ), "specific /onboarding-data route not registered (falls through to /{strategy_id})"

    def test_onboarding_data_registered_before_strategy_id_shadow(self):
        from api.content_planning.api.content_strategy.routes import router

        paths = [r.path for r in router.routes]
        assert "/enhanced-strategies/{strategy_id}" in paths  # the shadow exists
        assert paths.index(
            "/enhanced-strategies/onboarding-data"
        ) < paths.index("/enhanced-strategies/{strategy_id}")


class TestOnboardingDataEnvelope:
    """Authed GET must return the canonical_profile envelope (not an error)."""

    @pytest.fixture
    def client(self):
        from middleware.auth_middleware import get_current_user
        from api.content_planning.api.content_strategy.endpoints import utility_endpoints as m

        app = FastAPI()
        app.include_router(m.router, prefix="/enhanced-strategies")
        app.dependency_overrides[get_current_user] = _fake_user
        app.dependency_overrides[m.get_db] = lambda: _FakeSession()
        with patch.object(
            m.OnboardingDataIntegrationService,
            "get_integrated_data_sync",
            return_value=SAMPLE_INTEGRATED,
        ):
            yield TestClient(app, raise_server_exceptions=False)

    def test_returns_canonical_profile_envelope(self, client):
        resp = client.get("/enhanced-strategies/onboarding-data")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "success"
        data = body["data"]
        assert data["canonical_profile"]["industry"] == "B2B SaaS"
        assert data["sources"]["industry"] == "website_analysis"
        assert data["data_quality"]["overall_score"] == 0.8
        assert data["processing_timestamp"]

    def test_404_when_onboarding_never_started(self, client):
        from api.content_planning.api.content_strategy.endpoints import utility_endpoints as m

        with patch.object(
            m.OnboardingDataIntegrationService,
            "get_integrated_data_sync",
            return_value={**SAMPLE_INTEGRATED, "onboarding_session": {}},
        ):
            resp = client.get("/enhanced-strategies/onboarding-data")
        assert resp.status_code == 404