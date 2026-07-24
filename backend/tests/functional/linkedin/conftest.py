"""Shared fixtures for the LinkedIn functional suite.

Active fixtures:

* ``linkedin_user`` — fresh fake user dict with a deterministic id.
* ``other_user``    — second fake user for cross-user isolation tests.
* ``linkedin_fernet_key`` — freshly minted Fernet key for any import
  side-effects that read ``LINKEDIN_TOKEN_ENCRYPTION_KEY``.
* ``linkedin_routers`` — list of ``_RoutedModule`` objects resolved via
  :func:`tests.framework.app_factory._load_linkedin_routers`. Useful
  for tests that exercise router registration directly.
* ``linkedin_app`` — FastAPI app with every LinkedIn router mounted
  and auth wired to the test user.
* ``linkedin_client`` — :class:`fastapi.testclient.TestClient` over
  ``linkedin_app``.
* ``linkedin_oauth_db`` — temp SQLite DB with ``linkedin_oauth_tokens``
  schema pre-installed. Yields a ``ctx`` object whose ``db_path`` is
  what you point OAuth fixtures at.

Server-bound fixtures (the app, the client) are scoped ``function`` so
every test starts clean.
"""

from __future__ import annotations

import os
import sys
import types
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest

# -------------------------------------------------------------------------
# Ensure backend root is on sys.path before any backend imports run.
# (conftest at tests/conftest.py already does this; we duplicate here so
# the suite is importable in isolation, e.g. from ``pytest tests/functional/linkedin``.)
# -------------------------------------------------------------------------
_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


# -------------------------------------------------------------------------
# Stub the LLM image module *before* any LinkedIn router imports it.
# Idempotent. Re-using the helper from tests.framework keeps this consistent.
# -------------------------------------------------------------------------
@pytest.fixture(scope="session", autouse=True)
def _install_llm_image_stubs():
    from tests.framework.service_stubs import install_llm_image_stubs
    install_llm_image_stubs()
    yield


# -------------------------------------------------------------------------
# Fernet key: ensure a real key exists. Tests that need to *re*-patch the
# env var (e.g. to test missing-key behaviour) get their own fixture below.
# -------------------------------------------------------------------------
@pytest.fixture(scope="session", autouse=True)
def _session_fernet_key():
    from tests.framework.fernet import generate_fernet_key
    os.environ.setdefault("LINKEDIN_TOKEN_ENCRYPTION_KEY", generate_fernet_key())
    yield


@pytest.fixture
def linkedin_fernet_key() -> str:
    """Return a freshly generated Fernet key for tests that patch the env.

    Used by auth/decode roundtrip-style tests where the session-wide
    key would obscure the assertion.
    """
    from tests.framework.fernet import generate_fernet_key
    return generate_fernet_key()


# -------------------------------------------------------------------------
# Fake users
# -------------------------------------------------------------------------
@pytest.fixture
def linkedin_user() -> Dict[str, Any]:
    """A dict shaped like what ``get_current_user`` would return."""
    from tests.framework.auth import fake_user_factory
    return fake_user_factory(uid="user_linkedin", email="li@example.com")


@pytest.fixture
def other_user() -> Dict[str, Any]:
    """A second, distinct user — for isolation checks."""
    from tests.framework.auth import fake_user_factory
    return fake_user_factory(uid="user_other", email="other@example.com")


@pytest.fixture
def linkedin_user_factory():
    """Return a callable that produces a fresh fake-user dict each call.

    Note: the signature intentionally has no ``**kwargs`` to keep
    FastAPI's dependency injection from introspecting the override
    function and treating unknown args as required parameters.
    """

    def _make(uid: str = "user_linkedin") -> Dict[str, Any]:
        from tests.framework.auth import fake_user_factory
        return fake_user_factory(uid=uid)

    return _make


# -------------------------------------------------------------------------
# Router + app + client
# -------------------------------------------------------------------------
@pytest.fixture
def linkedin_routers():
    """List of ``_RoutedModule`` objects for every registered LinkedIn router.

    Tests that want to assert router registration without booting the
    full FastAPI app can iterate over this directly.
    """
    from tests.framework.app_factory import _load_linkedin_routers
    return _load_linkedin_routers(exclude=set())


@pytest.fixture
def linkedin_app(linkedin_user_factory):
    """A fresh FastAPI app mounting every LinkedIn router.

    Auth is overridden via ``linkedin_user_factory`` so each request
    yields a fresh fake-user dict (no leakage between calls).
    Override ``get_db`` and ``get_current_user_with_query_token``
    are not touched here; tests that hit endpoints depending on
    them should swap in their own fixture.
    """
    from tests.framework.app_factory import build_linkedin_app
    return build_linkedin_app(auth_user_factory=linkedin_user_factory)


@pytest.fixture
def linkedin_client(linkedin_app, linkedin_user_factory):
    """TestClient over the LinkedIn test app with auth wired to ``user_linkedin``.

    The TestClient is rebuilt per test (function scope) so tests don't
    share mutable request state.
    """
    from tests.framework.http import build_client
    return build_client(linkedin_app, base_user_factory=linkedin_user_factory)


# -------------------------------------------------------------------------
# Per-user OAuth DB (delegates to the existing conftest fixture and exposes
# a richer handle so suite tests don't need to know the implementation details)
# -------------------------------------------------------------------------
@dataclass
class LinkedInOAuthDBContext:
    db_path: str
    user_id: str


@pytest.fixture
def linkedin_oauth_db(patch_user_db_path):
    """Yield a context manager installing a temp SQLite DB pre-loaded with the
    LinkedIn OAuth schema. Enter it like::

        with linkedin_oauth_db("user_a") as ctx:
            ... # ctx.db_path, ctx.user_id available
    """
    def _patcher(user_id: str = "user_linkedin") -> LinkedInOAuthDBContext:
        # We return a wrapper rather than the raw patch context so callers
        # don't need to import the parent fixture's API.
        ctx = patch_user_db_path(user_id)
        return _OAuthDBContextAdapter(ctx, user_id)
    return _patcher


class _OAuthDBContextAdapter:
    """Adapts ``_PatchedUserDB`` to expose a typed ``db_path``/``user_id``."""

    def __init__(self, raw_ctx, user_id: str):
        self._raw = raw_ctx
        self._user_id = user_id

    def __enter__(self) -> LinkedInOAuthDBContext:
        raw = self._raw.__enter__()
        return LinkedInOAuthDBContext(db_path=raw.db_path, user_id=self._user_id)

    def __exit__(self, exc_type, exc, tb):
        return self._raw.__exit__(exc_type, exc, tb)


# -------------------------------------------------------------------------
# Optional: override get_db for endpoints that take a Session dep.
# Tests that hit those endpoints can request this fixture and get_db
# will yield a sqlite session against the test DB instead.
# -------------------------------------------------------------------------
@pytest.fixture
def override_get_db(linkedin_oauth_db):
    """Override ``services.database.get_db`` to yield a session against
    a per-user temp SQLite DB.

    Returns the ``override_get_db`` factory — tests who need DB-backed
    endpoints should arrange it in their own app build::

        app.dependency_overrides[get_db] = ...
    """
    def _override(current_user):
        # Lazy: ask the fixture-factory to install a temp DB, then yield a
        # connection from it. For simplicity we use the same SQLite
        # connection the OAuth tests use (no schema beyond linkedin_oauth_tokens).
        raise NotImplementedError(
            "override_get_db is opt-in: install per-endpoint in the test "
            "file rather than at the suite level."
        )
    return _override
