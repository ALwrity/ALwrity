"""
Phase 8B — slim-mode 503 parity + seo_tools single-mount contract (TDD).

Phase 2 of the seo-tools UI completion plan:
  P8B-1: /api/seo-dashboard/* gets the same fail-fast 503 stub as /api/seo/*
         in slim modes (never a silent 404) — Phase 1F contract parity.
  P8B-2: the seo_tools registry entry mounts ONLY in full mode; feature-only
         "core"/"seo" modes must not import the heavy router (they get 503s).
  P8B-3: full mode mounts seo_tools exactly once (registry path); the
         explicit duplicate include is gone.
  P8B-4: stub body contract stable: success=False, reason="full-mode-only".

Mirrors test_seo_phase1f_fullmode.py: no full app import — behavioral tests
build a fresh FastAPI; app wiring is pinned via source-reading assertions.
"""

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from fastapi import FastAPI
from fastapi.testclient import TestClient


def _client_with(stub_router) -> TestClient:
    app = FastAPI()
    app.include_router(stub_router)
    return TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# P8B-1: dashboard stub — 503 with reason, never 404, for any method + subpath
# ---------------------------------------------------------------------------

def test_p8b1_dashboard_stub_503_not_404():
    from routers.seo_unavailable import build_seo_unavailable_router

    client = _client_with(
        build_seo_unavailable_router(
            prefix="/api/seo-dashboard",
            tag="SEO Dashboard",
            feature_label="SEO dashboard endpoints",
        )
    )

    # Health probe (unauthenticated path): explicit 503, not 404
    r = client.get("/api/seo-dashboard/health")
    assert r.status_code == 503, f"expected 503, got {r.status_code}"
    assert r.json().get("reason") == "full-mode-only"

    # Analyzer paths the frontend calls
    r = client.post(
        "/api/seo-dashboard/analyze-comprehensive", json={"url": "https://example.com"}
    )
    assert r.status_code == 503
    assert r.json().get("reason") == "full-mode-only"

    r = client.get("/api/seo-dashboard/summary?url=https://example.com")
    assert r.status_code == 503

    r = client.post("/api/seo-dashboard/batch-analyze", json={"urls": ["https://a.dev"]})
    assert r.status_code == 503


def test_p8b1_default_prefix_backcompat_still_api_seo():
    """Bare builder keeps the Phase 1F contract: catch-all under /api/seo."""
    from routers.seo_unavailable import build_seo_unavailable_router

    client = _client_with(build_seo_unavailable_router())

    r = client.get("/api/seo/health")
    assert r.status_code == 503
    assert r.json().get("reason") == "full-mode-only"

    r = client.post("/api/seo/enterprise/quick-audit", json={"website_url": "https://example.com"})
    assert r.status_code == 503


def test_p8b4_stub_body_contract():
    from routers.seo_unavailable import build_seo_unavailable_router

    client = _client_with(build_seo_unavailable_router(prefix="/api/seo-dashboard"))
    body = client.get("/api/seo-dashboard/anything").json()

    assert body["success"] is False
    assert body["reason"] == "full-mode-only"
    assert "full mode" in body["message"] and "ALWRITY_ENABLED_FEATURES" in body["message"]


# ---------------------------------------------------------------------------
# P8B-2: seo_tools must mount from the registry in FULL mode only
# ---------------------------------------------------------------------------

def test_p8b2_registry_seo_tools_is_full_mode_only():
    from alwrity_utils.router_manager import CORE_ROUTER_REGISTRY

    entry = next((e for e in CORE_ROUTER_REGISTRY if e.get("name") == "seo_tools"), None)
    assert entry is not None, "seo_tools missing from the core registry"
    assert entry.get("features") == {"all"}, (
        f"seo_tools registry entry must be full-mode-only (features={{'all'}}), "
        f"got {entry.get('features')} — feature-only 'core'/'seo' modes must "
        f"403/503 via the stub, never import the heavy seo router"
    )


# ---------------------------------------------------------------------------
# P8B-3: app.py wiring — single mount in full mode, dual stubs in slim mode
# ---------------------------------------------------------------------------

def test_p8b3_no_duplicate_explicit_seo_tools_include():
    app_py = (BACKEND_ROOT / "app.py").read_text(encoding="utf-8", errors="ignore")
    # The registry (include_core_routers) already mounts seo_tools in full
    # mode; the explicit include was a duplicate route registration.
    assert "app.include_router(seo_tools_router)" not in app_py, (
        "app.py still explicitly includes seo_tools_router — duplicate mount"
    )
    # The guarded import stays for early import-error surfacing in full mode.
    assert "from routers.seo_tools import router as seo_tools_router" in app_py


def test_p8b3_slim_mode_mounts_both_stubs():
    app_py = (BACKEND_ROOT / "app.py").read_text(encoding="utf-8", errors="ignore")
    assert app_py.count("build_seo_unavailable_router(") >= 2, (
        "app.py must mount both 503 stubs in the slim branch (/api/seo and /api/seo-dashboard)"
    )
    assert 'prefix="/api/seo-dashboard"' in app_py, (
        "app.py dashboard 503 stub must use /api/seo-dashboard prefix"
    )
    assert "full-mode-only" in app_py
