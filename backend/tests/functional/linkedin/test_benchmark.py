"""API benchmark — LinkedIn endpoints.

    pytest -m benchmark -k linkedin
"""

import pytest

from tests.framework.benchmark import (
    BenchmarkClient,
    BenchmarkReport,
    benchmark_route,
)

pytestmark = [pytest.mark.linkedin, pytest.mark.benchmark]


@pytest.fixture(scope="session")
def li_bm_report():
    report = BenchmarkReport()
    yield report
    print("\n" + report.summary())


@pytest.fixture
def li_bm_client(linkedin_app, li_bm_report):
    yield BenchmarkClient(linkedin_app, li_bm_report)


class TestLinkedInStatus:
    def test_connection_status(self, li_bm_client, monkeypatch):
        from api.linkedin_oauth_connection_routes import _oauth_service

        def _fake(self, uid):
            return {
                "connected": False, "provider": "unipile",
                "has_per_user_token": False, "has_env_fallback": False,
                "accounts": [], "account_name": None,
            }
        monkeypatch.setattr(type(_oauth_service), "get_connection_status", _fake)

        m = benchmark_route(li_bm_client, "GET",
                            "/api/linkedin-social/connection/status")
        assert m is not None and m.status == 200
        assert m.duration_ms <= 30, (
            f"connection/status: {m.duration_ms:.1f}ms > 30ms "
            "(must stay fast — called by 14 components on mount)"
        )

    def test_unipile_health(self, li_bm_client, monkeypatch):
        monkeypatch.setattr(
            "api.linkedin_oauth_connection_routes.get_cached_unipile_health",
            lambda: {"healthy": True},
        )
        m = benchmark_route(li_bm_client, "GET",
                            "/api/linkedin-social/unipile/health")
        assert m is not None and m.duration_ms <= 30

    def test_disconnect(self, li_bm_client, monkeypatch):
        from api.linkedin_oauth_connection_routes import _oauth_service

        async def _fake(self, uid):
            return {"success": True, "connected": False, "revoked": 0}
        monkeypatch.setattr(type(_oauth_service), "disconnect_user", _fake)

        m = benchmark_route(li_bm_client, "POST",
                            "/api/linkedin-social/disconnect")
        assert m is not None and m.status == 200
        assert m.duration_ms <= 100
