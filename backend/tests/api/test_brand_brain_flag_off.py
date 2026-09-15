"""Brand Brain — Phase 6: feature-flag-off gating tests.

Both brand-brain endpoints must soft-disable (404) when the
``BRAND_BRAIN_DASHBOARD_ENABLED`` env flag is in the falsy set
(``{0, false, no, off}``). The gate is the first thing each handler checks
(``brand_brain_dashboard_enabled()`` at call time, default ON), so no DB or
service work runs when disabled and the 404 always wins over later validation
(e.g. an invalid semantic-search scope).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

WORKSPACE_ROOT = "services.workspace_paths.get_workspace_root"


@pytest.fixture()
def client(monkeypatch, tmp_path):
    from api.brand_brain import router as m
    from middleware.auth_middleware import get_current_user

    monkeypatch.setattr(WORKSPACE_ROOT, lambda: tmp_path)

    app = FastAPI()
    app.include_router(m.router)
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "42",
        "uid": "42",
        "clerk_user_id": "42",
        "email": "t@e.com",
        "is_active": True,
    }
    app.dependency_overrides[m.get_db] = lambda: None
    return TestClient(app, raise_server_exceptions=False)


class TestFlagOffGating:
    def test_dashboard_returns_404_when_flag_off(self, client):
        with patch.dict(os.environ, {"BRAND_BRAIN_DASHBOARD_ENABLED": "0"}, clear=False):
            resp = client.get("/api/brand-brain/dashboard")
        assert resp.status_code == 404, resp.text
        assert "disabled" in resp.json()["detail"].lower()

    def test_semantic_search_returns_404_when_flag_off(self, client):
        with patch.dict(os.environ, {"BRAND_BRAIN_DASHBOARD_ENABLED": "off"}, clear=False):
            resp = client.get("/api/brand-brain/semantic-search?query=hello")
        assert resp.status_code == 404, resp.text
        assert "disabled" in resp.json()["detail"].lower()

    def test_gate_precedes_scope_validation_when_flag_off(self, client):
        # Even a malformed scope must surface the 404 gate, not the 400.
        with patch.dict(os.environ, {"BRAND_BRAIN_DASHBOARD_ENABLED": "false"}, clear=False):
            resp = client.get("/api/brand-brain/semantic-search?scope=bogus")
        assert resp.status_code == 404, resp.text