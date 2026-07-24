# ALwrity Test Framework — Contributor's Guide

This guide explains how the test framework is laid out, how to extend it
to new feature areas, and how the CI/CD harness picks up new suites.

## TL;DR

- **Reusable building blocks** live in `tests/framework/`.
- **Per-feature suites** live in `tests/functional/<feature>/`.
- **CI** runs suites via `.github/workflows/linkedin-tests.yml` —
  smart PR selection picks only changed-area suites, manual dispatch
  lets you run anything, and a twice-weekly schedule catches drift.
- Pure unit tests and direct-call tests continue to live under
  `tests/api/`, `tests/services/`, etc. — no migration is required,
  and they are picked up by the `legacy` matrix job.

---

## Layout

```
backend/tests/
├── conftest.py                           # Global: stub dotenv, sys.modules shims, OAuth DB fixtures
├── framework/                            # ← REUSABLE here
│   ├── __init__.py
│   ├── app_factory.py                    # build_app helpers
│   ├── auth.py                           # fake_user_factory + auth override helpers
│   ├── fernet.py                         # generate_fernet_key, patch_fernet_key
│   ├── http.py                           # build_client, assert_status
│   ├── service_stubs.py                  # install_llm_image_stubs + ad-hoc service mocks
│   ├── CONTRIBUTING.md                   # this file
│   └── test_framework_self.py            # tests for the framework primitives
├── functional/                           # ← NEW SUITES go here
│   ├── linkedin/
│   │   ├── conftest.py
│   │   ├── test_auth_connection_status.py
│   │   └── test_framework_smoke.py
│   └── blog_writer/
│       ├── conftest.py                   # blog_app + blog_user fixtures
│       └── test_blog_writer_smoke.py
├── api/                                  # Existing direct-call tests, untouched
├── services/                             # Existing service-layer tests, untouched
└── …
```

---

## CI / CD — how suites get picked

The GitHub Actions workflow `.github/workflows/linkedin-tests.yml`
runs `apply-suite-selection` first, which inspects the trigger and
the changed paths and decides which suites to run:

| Trigger | Behaviour |
| --- | --- |
| `pull_request` / `push` | Diff base..head, pick suites whose source paths overlap. Framework always runs alongside. |
| `workflow_dispatch` | User picks a suite via the manual dropdown (`auto`, `framework`, `linkedin`, `blog_writer`, `story_writer`, `legacy`, `full`). Default is `auto`. |
| `schedule` (Tue + Fri 03:00 UTC) | Run the **full** matrix twice a week — the safety net. |
| nightly slow path | Always runs against `main` only. |

Path → suite mapping (see the workflow for the canonical version):

| Suite | Trigger paths |
| --- | --- |
| `framework` | `backend/tests/framework/`, `backend/pytest.ini` |
| `linkedin` | `backend/api/linkedin*`, `backend/services/integrations/linkedin*` |
| `blog_writer` | `backend/api/blog_writer/`, `backend/api/blog_seo_analysis*` |
| `story_writer` | `backend/api/story_writer/`, `backend/services/story_writer/` |
| `legacy` | `backend/tests/api/`, `backend/tests/services/`, `backend/tests/test_*` |
| catch-all → full matrix | `backend/alwrity_utils/`, `backend/middleware/`, `backend/services/database.py`, `backend/tests/__init__.py` |

### Path detection guarantees

- Sensible default: PR with no matching paths still runs `framework` + `legacy` (sanity net).
- Framework always co-runs with anything it might affect.
- Catch-all prefixes trigger the full matrix — these are cross-cutting.
- Schedule / dispatch never descend to "smart" mode — they always run the configured suite(s).

### Pre-production launch checklist

1. Open **Actions → Backend tests → Run workflow**.
2. Pick `suites: full` from the dropdown.
3. Wait for the matrix to finish (~30 min).
4. If anything failed, address before tagging a release.

If a release happens outside this manual gate, the Tuesday/Friday schedule run is the safety net — it has already validated every cross-suite interaction within the past 3 days.

---

## When to add to `tests/framework/` vs `tests/functional/<feature>/`

| If you need to… | Put it in |
| --- | --- |
| Mount a different router collection in the test app | `tests/functional/<feature>/conftest.py` (use `build_app`) |
| Override a different FastAPI dep (`get_db`, a service factory, …) | in your suite's conftest, using `app.dependency_overrides[dep] = ...` |
| Standardise a fake-user shape across many tests | `tests/framework/auth.py` |
| Stub a service that is required at import time (Fernet key, dotenv, missing third-party SDK) | `tests/framework/service_stubs.py` |
| Reuse a custom test client across a feature | `tests/framework/http.py` (helpers) and your suite's conftest |
| Test a single endpoint within a feature | Inside `tests/functional/<feature>/` |

Rule of thumb: anything that is **generic to FastAPI / pytest** goes
in `framework/`. Anything that **talks about a specific feature area**
goes in `functional/<feature>/`.

---

## Adding a new feature suite (e.g., for `analytics`)

```python
# backend/tests/functional/analytics/__init__.py
"""Analytics functional test suite."""
```

```python
# backend/tests/functional/analytics/conftest.py
import pytest
from tests.framework.app_factory import _load_routers_for_prefix


@pytest.fixture
def analytics_user_factory():
    from tests.framework.auth import fake_user_factory

    def _make(uid: str = "user_analytics", **extras):
        return fake_user_factory(uid=uid, **extras)
    return _make


@pytest.fixture
def analytics_app(analytics_user_factory):
    from tests.framework.app_factory import build_app
    from alwrity_utils.router_manager import CORE_ROUTER_REGISTRY

    # Choose the routers for your feature.
    wanted = {"linkedin_analytics", "linkedin_post_analytics"}
    routers = [
        _load_routers_for_prefix(name)
        for name in wanted
    ]
    return build_app(routers=routers, auth_user_factory=analytics_user_factory)


@pytest.fixture
def analytics_client(analytics_app, analytics_user_factory):
    from tests.framework.http import build_client
    return build_client(analytics_app, base_user_factory=analytics_user_factory)
```

```python
# backend/tests/functional/analytics/test_analytics_smoke.py
import pytest
from tests.framework.http import assert_status

pytestmark = [pytest.mark.analytics, pytest.mark.functional]


def test_personal_analytics_smoke(analytics_client, monkeypatch):
    # Patch the heavy services so the test stays fast.
    from api.linkedin_analytics_routes import _oauth_service

    monkeypatch.setattr(
        type(_oauth_service), "get_connection_status", lambda self, user_id: {
            "connected": True,
            "provider": "unipile",
            "accounts": [{"account_id": "X"}],
        }
    )

    response = analytics_client.get(
        "/api/linkedin-social/analytics/personal"
    )
    assert_status(response, 200)
```

Tests pick up automatically once the directory exists — no registration
step is required. Pytest discovers `test_*.py` files under `tests/`.

---

## Markers

`pytest.ini` declares the markers used by CI gates and the local
filtering UX:

| Marker | Purpose | CI gate |
| --- | --- | --- |
| `smoke` | Fast, no-dep sanity checks (router registration, health endpoints). | First job: always-on. |
| `critical` | Auth, token storage, profile-acquire happy paths. | Second job: blocks merge. |
| `regression` | Bug-specific regression coverage. | Run on each PR. |
| `integration` | Cross-service flows (OAuth roundtrip, photo lifecycle). | Run on each PR, can be slow. |
| `functional` | End-to-end functional coverage over HTTP (default for `tests/functional/`). | Same as above. |
| `slow` | Tests that take >2s even with mocks. | Nightly only. |
| `trio` | Tests parametrised over the trio backend (skipped if trio not installed). | Same as `asyncio`. |
| `linkedin` | Specific to the LinkedIn feature area. | Filtering convenience. |

Mark tests by decorating classes or modules:

```python
pytestmark = [pytest.mark.linkedin, pytest.mark.functional]

class TestXyzCritical:
    pytestmark = [pytest.mark.critical]

    def test_initially_disconnected(self, linkedin_client): ...
```

Local filters:

```bash
# Smoke only
pytest -m smoke

# Everything EXCEPT slow
pytest -m "not slow"

# Linkedin critical path only
pytest tests/functional/linkedin -m critical
```

---

## CI / CD (`.github/workflows/linkedin-tests.yml`)

The workflow is named `linkedin-tests.yml` for historical reasons but
**runs every suite** under `backend/tests/functional/`. The pipeline:

1. `smoke` job — boots fast, fails the build on a broken import.
2. `critical` job — runs only marked-critical tests in parallel.
3. `full` job — runs the whole tree minus `slow` + `trio`.
4. `nightly` job — runs the slow tests too, scheduled.

To add your suite to a specific gate, mark its tests. There is no
code change to the workflow required.

---

## Hermeticity rules

These are non-negotiable for the suites under `tests/functional/`:

1. **No network.** Tests must not hit real APIs. Use `monkeypatch`
   on third-party SDKs (`stripe`, `anthropic`, etc.) before the first
   import.
2. **No real environment variables.** The framework's
   `tests/framework/fernet.py` and `tests/conftest.py` install all the
   keys your modules need; tests should never reach for `os.environ`
   directly except within `monkeypatch.setenv`.
3. **No SQLite files outside the test's own temp dir.** Use
   `tests/conftest.py:temp_user_db` to get a per-test database. The
   framework cleans up on context exit.
4. **Idempotent fixtures.** A fixture must produce the same result no
   matter how many times it's read in a single test.

---

## Common patterns

### Patch a service-locals function inside a route module

```python
def test_x(monkeypatch):
    monkeypatch.setattr(
        "api.linkedin_oauth_connection_routes._oauth_service.disconnect",
        lambda self, user_id: {"status": "disconnected", "user_id": user_id},
    )
```

### Override a different FastAPI dep

```python
def test_db(linkedin_app):
    from services.database import get_db

    def _fake_db():
        yield None  # or a SQLAlchemy session against your fixture DB

    linkedin_app.dependency_overrides[get_db] = _fake_db
    client = linkedin_app.test_client()  # or rebuild via build_client
    ...
```

### Use a fresh fake user per request

```python
def test_y(linkedin_client, monkeypatch):
    from middleware.auth_middleware import get_current_user
    from tests.framework.auth import fake_user_factory

    def fresh_user():
        return fake_user_factory(uid="user_a")

    linkedin_client.app.dependency_overrides[get_current_user] = fresh_user
    response = linkedin_client.get(...)
```

---

## Removing this framework

If you decide the framework isn't pulling its weight, deleting
`backend/tests/framework/` and `backend/tests/functional/` removes
the entire infrastructure with one commit. The pre-existing tests
under `backend/tests/api/` and `backend/tests/services/` continue to
work unchanged. **There is no dependency from production code on the
framework.**
