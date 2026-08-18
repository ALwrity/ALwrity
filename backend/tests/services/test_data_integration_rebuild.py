"""Tests for canonical_profile rebuild behavior (Phase E.1)."""

from __future__ import annotations

import sys
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

MOD = "api.content_planning.services.content_strategy.onboarding.data_integration"


def _patch_sources(svc, build_mock):
    """Patch all raw-source getters + the canonical builder; return patchers."""
    patchers = [
        patch.object(svc, "_get_website_analysis", return_value={}),
        patch.object(svc, "_get_research_preferences", return_value={}),
        patch.object(svc, "_get_onboarding_session", return_value={}),
        patch.object(svc, "_get_persona_data", return_value={}),
        patch.object(svc, "_get_competitor_analysis", return_value=[]),
        patch.object(svc, "_get_deep_competitor_analysis", return_value={}),
        patch.object(svc, "_get_linkedin_profile_info", return_value=None),
        patch.object(svc, "_get_platform_integrations", return_value={}),
        patch.object(svc, "_build_canonical_profile", build_mock),
    ]
    for p in patchers:
        p.start()
    return patchers


def _db_with_cached_profile(canonical, updated_at):
    existing = MagicMock()
    existing.canonical_profile = canonical
    existing.updated_at = updated_at
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = existing
    return db


class TestCanonicalProfileRebuild:
    def test_uses_cached_profile_when_fresh(self):
        from api.content_planning.services.content_strategy.onboarding.data_integration import OnboardingDataIntegrationService

        svc = OnboardingDataIntegrationService()
        build_mock = MagicMock(return_value={"industry": "fresh"})
        patchers = _patch_sources(svc, build_mock)
        db = _db_with_cached_profile({"industry": "cached"}, datetime.utcnow())

        try:
            result = svc.get_integrated_data_sync("u1", db)
        finally:
            for p in patchers:
                p.stop()

        assert result["canonical_profile"] == {"industry": "cached"}
        build_mock.assert_not_called()

    def test_force_rebuild_bypasses_cache(self):
        from api.content_planning.services.content_strategy.onboarding.data_integration import OnboardingDataIntegrationService

        svc = OnboardingDataIntegrationService()
        build_mock = MagicMock(return_value={"industry": "fresh"})
        patchers = _patch_sources(svc, build_mock)
        db = _db_with_cached_profile({"industry": "cached"}, datetime.utcnow())

        try:
            result = svc.get_integrated_data_sync("u1", db, force_rebuild=True)
        finally:
            for p in patchers:
                p.stop()

        assert result["canonical_profile"] == {"industry": "fresh"}
        build_mock.assert_called_once()

    def test_rebuilds_when_cache_stale(self):
        from api.content_planning.services.content_strategy.onboarding.data_integration import OnboardingDataIntegrationService

        svc = OnboardingDataIntegrationService()
        build_mock = MagicMock(return_value={"industry": "fresh"})
        patchers = _patch_sources(svc, build_mock)
        stale = datetime.utcnow() - timedelta(hours=25)
        db = _db_with_cached_profile({"industry": "cached"}, stale)

        try:
            result = svc.get_integrated_data_sync("u1", db)
        finally:
            for p in patchers:
                p.stop()

        assert result["canonical_profile"] == {"industry": "fresh"}
        build_mock.assert_called_once()
