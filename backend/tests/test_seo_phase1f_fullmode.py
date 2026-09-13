"""Phase 1F TDD — slim mode must fail fast with 503 JSON, never silent 404.

Leaves content-strategy / calendar untouched. No full app import (fast).
"""
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def test_seo_unavailable_stub_returns_503_json():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from routers.seo_unavailable import build_seo_unavailable_router

    app = FastAPI()
    app.include_router(build_seo_unavailable_router())
    client = TestClient(app, raise_server_exceptions=False)

    # Health probe: explicit 503, not 404
    r = client.get("/api/seo/health")
    assert r.status_code == 503, f"expected 503, got {r.status_code}"
    assert r.json().get("reason") == "full-mode-only"

    # Any tool path under /api/seo/*: same explicit 503, not 404
    r = client.post("/api/seo/enterprise/quick-audit", json={"website_url": "https://example.com"})
    assert r.status_code == 503, f"expected 503, got {r.status_code}"
    assert r.json().get("reason") == "full-mode-only"


def test_app_wires_stub_in_slim_mode_branch():
    app_py = (BACKEND_ROOT / "app.py").read_text(encoding="utf-8", errors="ignore")
    assert "seo_unavailable" in app_py, "app.py must mount the 503 stub in slim mode"
    assert "full-mode-only" in app_py
