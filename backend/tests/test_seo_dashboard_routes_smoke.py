"""Smoke tests for SEO dashboard route registration in FastAPI app entrypoints."""

import importlib
import os
import sys
import types
from pathlib import Path

import pytest


def _install_environment_defaults() -> None:
    """Set minimal environment defaults needed for importing app entrypoints in tests."""
    os.environ.setdefault("STRIPE_MODE", "test")
    os.environ.setdefault(
        "STRIPE_PLAN_PRICE_MAPPING_TEST",
        '{"free":{"monthly":"price_test_free"},"basic":{"monthly":"price_test_basic"},"pro":{"monthly":"price_test_pro"}}',
    )


def _install_dependency_stubs() -> None:
    """Install lightweight stubs for optional heavy dependencies used during import."""
    if "spacy" not in sys.modules:
        spacy_stub = types.ModuleType("spacy")
        spacy_stub.load = lambda _model: object()
        sys.modules["spacy"] = spacy_stub


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

TARGET_PATHS = {
    "/api/seo-dashboard/cache-stats",
    "/api/seo-dashboard/sif-health",
}

ENTRYPOINT_MODULES = ("backend.app", "backend.main")


@pytest.mark.parametrize("module_name", ENTRYPOINT_MODULES)
def test_seo_dashboard_routes_registered(module_name: str) -> None:
    """Verify module import succeeds and required SEO dashboard routes are registered."""
    _install_environment_defaults()
    _install_dependency_stubs()
    module = importlib.import_module(module_name)
    fastapi_app = module.app

    registered_paths = {route.path for route in fastapi_app.routes if hasattr(route, 'path')}

    missing_paths = TARGET_PATHS - registered_paths
    assert not missing_paths, (
        f"{module_name} is missing required SEO dashboard route(s): "
        f"{sorted(missing_paths)}"
    )
