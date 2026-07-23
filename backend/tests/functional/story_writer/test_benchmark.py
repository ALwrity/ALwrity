"""API benchmark — Story Writer endpoints.

Measures every endpoint response time and flags slow routes.
Runs against the functional test app with auth + DB overrides.

    pytest -m benchmark -k story_writer
"""

import uuid
import pytest

from tests.framework.benchmark import (
    BenchmarkClient,
    BenchmarkReport,
    benchmark_route,
)

pytestmark = [pytest.mark.story_writer, pytest.mark.benchmark]


@pytest.fixture(scope="session")
def story_bm_report():
    report = BenchmarkReport()
    yield report
    print("\n" + report.summary())


@pytest.fixture
def bm_no_db(story_writer_app, story_bm_report):
    """Benchmark client without DB — for health, etc."""
    yield BenchmarkClient(story_writer_app, story_bm_report)


@pytest.fixture
def bm_db(story_writer_app_with_db, story_bm_report):
    """Benchmark client with DB — for CRUD endpoints."""
    yield BenchmarkClient(story_writer_app_with_db, story_bm_report)


# ===========================================================================
# Synchronous endpoints (no LLM, no async task)
# ===========================================================================

class TestHealth:
    def test_health(self, bm_no_db):
        bm_no_db.get("/api/story/health")  # warmup (cold-start init)
        m = benchmark_route(bm_no_db, "GET", "/api/story/health")
        assert m is not None and m.status == 200
        assert m.duration_ms <= 100, (
            f"health: {m.duration_ms:.1f}ms > 100ms (warm)"
        )


class TestProjects:
    def test_list_empty(self, bm_db):
        m = benchmark_route(bm_db, "GET", "/api/story/projects")
        assert m is not None and m.duration_ms <= 100

    def test_create(self, bm_db):
        pid = f"bm_{uuid.uuid4().hex[:8]}"
        m = benchmark_route(
            bm_db, "POST", "/api/story/projects",
            payload={"project_id": pid, "title": "BM"},
        )
        assert m is not None and m.duration_ms <= 100

    def test_get(self, bm_db):
        pid = f"bm_{uuid.uuid4().hex[:8]}"
        benchmark_route(
            bm_db, "POST", "/api/story/projects",
            payload={"project_id": pid},
        )
        m = benchmark_route(bm_db, "GET", f"/api/story/projects/{pid}")
        assert m is not None and m.duration_ms <= 100

    def test_update(self, bm_db):
        pid = f"bm_{uuid.uuid4().hex[:8]}"
        benchmark_route(
            bm_db, "POST", "/api/story/projects",
            payload={"project_id": pid},
        )
        m = benchmark_route(
            bm_db, "PUT", f"/api/story/projects/{pid}",
            payload={"title": "Updated"},
        )
        assert m is not None and m.duration_ms <= 100

    def test_delete(self, bm_db):
        pid = f"bm_{uuid.uuid4().hex[:8]}"
        benchmark_route(
            bm_db, "POST", "/api/story/projects",
            payload={"project_id": pid},
        )
        m = benchmark_route(bm_db, "DELETE", f"/api/story/projects/{pid}")
        assert m is not None and m.duration_ms <= 100


class TestAuth:
    def test_auth_override_speed(self, bm_no_db):
        """Auth override must be instantaneous (no real JWT decode)."""
        from middleware.auth_middleware import get_current_user

        override = bm_no_db._client.app.dependency_overrides.get(get_current_user)
        import time
        t0 = time.perf_counter()
        result = override()
        dt = (time.perf_counter() - t0) * 1000
        assert dt <= 1.0, f"auth override: {dt:.1f}ms > 1ms"
        assert result is not None
