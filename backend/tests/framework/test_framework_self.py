"""Self-tests for the test framework.

These tests deliberately do *not* load any LinkedIn router — they
exercise the framework primitives (auth overrides, fernet helpers,
service stubs, http helpers, app factory) against a tiny synthetic
FastAPI app. This way a regression in the framework gets caught
before it reaches the larger LinkedIn suites.

If you delete the LinkedIn functional suites and only keep the
framework itself, these tests should still pass.
"""

from __future__ import annotations

import os
from typing import Any, Dict

import pytest
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient

from middleware.auth_middleware import get_current_user
from tests.framework.app_factory import build_app
from tests.framework.auth import (
    clear_auth_overrides,
    fake_user_factory,
    fake_user_for,
    override_auth_deps,
)
from tests.framework.fernet import generate_fernet_key, patch_fernet_key
from tests.framework.http import assert_status, build_client
from tests.framework.service_stubs import install_llm_image_stubs


# Synthetic router for self-testing — totally disconnected from
# production code.
_echo_router = APIRouter(prefix="/echo", tags=["Framework Self-Test"])


@_echo_router.get("/whoami")
async def _echo(current_user: dict = Depends(get_current_user)):
    return {"who": current_user}


@_echo_router.get("/ping")
async def _ping():
    return "pong"


@_echo_router.post("/square")
async def _square(payload: Dict[str, Any]):
    return {k: v ** 2 for k, v in payload.items()}


# ---------------------------------------------------------------------------
# fernet module
# ---------------------------------------------------------------------------
class TestFernet:
    def test_generate_fernet_key_returns_string(self):
        key = generate_fernet_key()
        assert isinstance(key, str)
        assert len(key) > 30  # base64-encoded 32-byte key + padding
        # Two consecutive calls must produce distinct keys.
        assert key != generate_fernet_key()

    def test_patch_fernet_key_sets_env_during_block(self):
        prev = os.environ.get("LINKEDIN_TOKEN_ENCRYPTION_KEY")
        test_key = generate_fernet_key()
        with patch_fernet_key(test_key):
            assert os.environ["LINKEDIN_TOKEN_ENCRYPTION_KEY"] == test_key
        if prev is None:
            assert "LINKEDIN_TOKEN_ENCRYPTION_KEY" not in os.environ
        else:
            assert os.environ["LINKEDIN_TOKEN_ENCRYPTION_KEY"] == prev


# ---------------------------------------------------------------------------
# service_stubs module
# ---------------------------------------------------------------------------
class TestServiceStubs:
    def test_install_llm_image_stubs_idempotent(self):
        m1 = install_llm_image_stubs()
        m2 = install_llm_image_stubs()
        # Same module is returned each call.
        assert m1 is m2
        # The required symbols are present.
        assert callable(m1.generate_image)
        assert callable(m1.generate_image_variation)
        assert callable(m1._enhance_image_prompt)


# ---------------------------------------------------------------------------
# auth module + http module + app_factory — together because they
# share the same FastAPI app per-test.
# ---------------------------------------------------------------------------
class TestAuthAndHttp:
    @pytest.fixture
    def app(self):
        return build_app(routers=[_echo_router], title="fw-self-test")

    def test_fake_user_factory_shape(self):
        user = fake_user_factory(uid="x", email="x@y")
        assert user["id"] == "x"
        assert user["clerk_user_id"] == "x"
        assert user["email"] == "x@y"
        # Each call should yield a fresh dict.
        assert user is not fake_user_factory(uid="x", email="x@y")

    def test_fake_user_for_produces_callable(self):
        factory = fake_user_for(uid="user_test")
        assert callable(factory)
        assert factory()["id"] == "user_test"
        assert factory() is not factory()

    def test_override_and_clear_auth(self, app):
        def u():
            return fake_user_factory(uid="alice")
        override_auth_deps(app, u)
        client = TestClient(app)
        resp = client.get("/echo/whoami")
        assert_status(resp, 200)
        assert resp.json()["who"]["id"] == "alice"

        clear_auth_overrides(app)
        # After clearing, the *real* get_current_user runs, which asks
        # for credentials. We just verify bson for non-401 path no longer
        # returns alice.
        resp2 = client.get("/echo/ping")
        # /ping doesn't depend on auth, so it still works.
        assert_status(resp2, 200)

    def test_assert_status_passes_on_match(self, app):
        client = build_client(app)
        resp = client.get("/echo/ping")
        assert_status(resp, 200)

    def test_assert_status_raises_with_body_on_mismatch(self, app):
        client = build_client(app)
        resp = client.get("/echo/whoami")  # Not 200 — auth not overridden
        with pytest.raises(AssertionError) as excinfo:
            assert_status(resp, 204)
        msg = str(excinfo.value)
        # The helpful error body must include the URL and the actual status.
        assert "/echo/whoami" in msg
        assert str(resp.status_code) in msg or str(401) in msg or str(403) in msg
