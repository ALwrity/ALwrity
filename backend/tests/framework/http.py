"""HTTP test client helpers.

Wraps ``fastapi.testclient.TestClient`` with small ergonomics for
common test patterns:

* :func:`assert_status` — raises with the full body on mismatch.
* :func:`build_client` — apply auth overrides and yield a ready-to-use
  ``TestClient``.

Avoid importing ``fastapi.testclient`` directly so this module remains
the only point where the test transport is selected.
"""

from __future__ import annotations

from typing import Callable, Dict, Optional

from fastapi import FastAPI


def build_client(
    app: FastAPI,
    *,
    base_user_factory: Optional[Callable[[], Dict]] = None,
) -> "TestClient":
    """Build a ``TestClient`` for ``app`` with optional auth wiring.

    If ``base_user_factory`` is provided and the app has no auth
    overrides yet, the function attaches a default fake-user override
    so most tests "just work". Tests that want a custom user can use
    :func:`tests.framework.auth.fake_user_for` first.
    """
    from fastapi.testclient import TestClient

    if base_user_factory is not None:
        from middleware.auth_middleware import (
            get_current_user,
            get_current_user_with_query_token,
        )
        if get_current_user not in app.dependency_overrides:
            from tests.framework.auth import override_auth_deps
            override_auth_deps(app, base_user_factory)

    return TestClient(app)


def assert_status(response, expected: int) -> None:
    """Assert ``response.status_code == expected`` with a rich error body.

    Mismatched responses raise ``AssertionError`` whose message includes
    the URL, status, and (for non-2xx) the response body — enough to
    diagnose most failures without re-running the test.
    """
    if response.status_code == expected:
        return
    body = _safe_body(response)
    raise AssertionError(
        f"Expected status {expected} but got {response.status_code} for "
        f"{response.request.method} {response.url}\nBody: {body}"
    )


def _safe_body(response) -> str:
    try:
        return response.text
    except Exception as exc:  # pragma: no cover - defensive
        return f"<unreadable body: {exc!r}>"
