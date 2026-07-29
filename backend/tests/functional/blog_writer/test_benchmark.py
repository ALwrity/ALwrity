"""API benchmark — Blog Writer endpoints.

    pytest -m benchmark -k blog_writer
"""

import pytest

from tests.framework.benchmark import (
    BenchmarkClient,
    BenchmarkReport,
    benchmark_route,
)

pytestmark = [pytest.mark.blog_writer, pytest.mark.benchmark]


@pytest.fixture(scope="session")
def blog_bm_report():
    report = BenchmarkReport()
    yield report
    print("\n" + report.summary())


@pytest.fixture
def blog_bm_client(blog_app, blog_bm_report):
    yield BenchmarkClient(blog_app, blog_bm_report)


class TestBlogHealth:
    def test_health(self, blog_bm_client):
        # Warmup — first call includes cold-start service initialization
        blog_bm_client.get("/api/blog/health")
        m = benchmark_route(blog_bm_client, "GET", "/api/blog/health")
        assert m is not None and m.status == 200
        # Warm response should be fast; cold-start may add 50ms+ for init
        assert m.duration_ms <= 100, (
            f"blog health (warm): {m.duration_ms:.1f}ms > 100ms"
        )


class TestBlogCache:
    def test_cache_stats(self, blog_bm_client):
        m = benchmark_route(blog_bm_client, "GET", "/api/blog/cache/stats")
        assert m is not None and m.duration_ms <= 50

    def test_cache_clear(self, blog_bm_client):
        m = benchmark_route(blog_bm_client, "DELETE", "/api/blog/cache/clear")
        assert m is not None and m.duration_ms <= 50
