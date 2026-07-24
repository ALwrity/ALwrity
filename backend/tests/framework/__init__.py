"""Reusable test framework for ALwrity backend suites.

This package is the foundry for the higher-level functional suites
(``tests/functional/linkedin`` and beyond). Anything reusable
across feature areas belongs here.

Modules:
    app_factory: build a fresh FastAPI app including only the routers needed
                 by a test, with auth + dependency overrides applied.
    auth:        auth override callables for ``Depends(get_current_user)``
                 and ``Depends(get_current_user_with_query_token)``.
    fernet:      Fernet key generation/setup for services that read encryption
                 keys from env (LinkedIn OAuth tokens, etc.).
    service_stubs: in-memory mock helpers for OAuth singletons and repositories.
    http:        small wrappers over ``fastapi.testclient.TestClient`` that
                 add helpful defaults (header injection, status assertion).

Extending to a new feature:
    1. Add a ``app_factory.build_app(routers=[...])`` invocation pointing at
       the routers you want exercised.
    2. Add an entry in ``tests/functional/<feature>/conftest.py`` that pulls
       the shared fixtures defined here (e.g. ``auth_client``).
    3. Write tests using ``TestClient`` against the resulting ``app``.

Importing:

    >>> from tests.framework.app_factory import build_linkedin_app
    >>> from tests.framework.http import assert_status

No test file should import from :mod:`fastapi.testclient` directly; route
all HTTP interactions through :mod:`tests.framework.http` so behavior
(and assertion ergonomics) stay consistent across feature suites.
"""
