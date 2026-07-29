"""Auth override callables for tests.

The prod backend authenticates every protected route with
``Depends(get_current_user)`` (Authorization header JWT) and protected
'<img>/<audio>' style routes with
``Depends(get_current_user_with_query_token)`` (Bearer or ``?token=``).
Tests want to exercise the full HTTP path without standing up real
JWTs, so we override the deps at app build time.

Usage from conftest::

    from tests.framework.auth import fake_user_factory, override_auth_deps

    def fake_user():
        return fake_user_factory(uid="user_a", email="a@example.com")

    app.dependency_overrides[get_current_user] = fake_user
    app.dependency_overrides[get_current_user_with_query_token] = fake_user
"""

from __future__ import annotations

from typing import Any, Callable, Dict, Optional

from middleware.auth_middleware import (
    get_current_user,
    get_current_user_with_query_token,
)


def fake_user_factory(
    uid: str = "user_test",
    email: str = "test@example.com",
    first_name: str = "Test",
    last_name: str = "User",
    extras: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build the dict that ``get_current_user`` would have returned.

    Returns a fresh dict each call so test mutations don't leak.
    """
    base = {
        "id": uid,
        "uid": uid,
        "clerk_user_id": uid,
        "email": email,
        "first_name": first_name,
        "last_name": last_name,
        "is_active": True,
    }
    if extras:
        base.update(extras)
    return base


def fake_user_for(uid: str) -> Callable[[], Dict[str, Any]]:
    """Return a callable that yields a fresh fake-user dict each invocation.

    Useful for tests that need deterministic user identities and don't
    want to share mutable state between requests.
    """
    def _factory() -> Dict[str, Any]:
        return fake_user_factory(uid=uid)
    return _factory


def override_auth_deps(app, fake_user: Callable[[], Dict[str, Any]]) -> None:
    """Wire both auth deps on ``app`` to ``fake_user``.

    Idempotent. Safe to call multiple times.
    """
    app.dependency_overrides[get_current_user] = fake_user
    app.dependency_overrides[get_current_user_with_query_token] = fake_user


def clear_auth_overrides(app) -> None:
    """Remove every auth override registered on ``app``."""
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_current_user_with_query_token, None)
