from fastapi import FastAPI
from fastapi.testclient import TestClient

from alwrity_utils.health_checker import HealthChecker
import services.database as database
import services.startup_health as startup_health


def _public_database_health_client():
    app = FastAPI()
    app.add_api_route(
        "/health/database",
        HealthChecker().database_health_response,
        methods=["GET"],
    )
    return TestClient(app)


def test_public_database_health_reports_unverified_without_startup_or_tenant_db(
    monkeypatch,
):
    def unexpected_call(*args, **kwargs):
        raise AssertionError("Public database status must not access startup or tenant DBs")

    monkeypatch.setattr(startup_health, "get_startup_status", unexpected_call)
    tenant_database_functions = (
        "get_all_user_ids",
        "get_engine_for_user",
        "get_session_for_user",
        "get_user_db_path",
        "init_user_database",
    )
    for module in (database, startup_health):
        for function_name in tenant_database_functions:
            if hasattr(module, function_name):
                monkeypatch.setattr(module, function_name, unexpected_call)

    with _public_database_health_client() as client:
        response = client.get("/health/database")

    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "not_verified"
    assert body["database_connectivity"] == "not_verified"
    assert body["scope"] == "public"
    assert body["authenticated_tenant_check_required"] is True
    assert body["message"] == (
        "Tenant database connectivity is not verified by this public endpoint. "
        "Use an authenticated tenant-scoped health check."
    )
    assert body["timestamp"]


def test_authenticated_readiness_still_checks_the_current_tenant(monkeypatch):
    class FakeSession:
        def __init__(self):
            self.executed_statements = []
            self.closed = False

        def execute(self, statement):
            self.executed_statements.append(str(statement))

        def close(self):
            self.closed = True

    session = FakeSession()
    resolved_user_ids = []
    monkeypatch.setattr(
        startup_health,
        "get_user_db_path",
        lambda user_id: f"tenant-db-for-{user_id}",
    )
    monkeypatch.setattr(
        startup_health,
        "get_session_for_user",
        lambda user_id: resolved_user_ids.append(user_id) or session,
    )

    result = startup_health.readiness_under_auth_context({"id": "tenant-123"})

    assert result["ready"] is True
    assert result["user_id"] == "tenant-123"
    assert resolved_user_ids == ["tenant-123"]
    assert session.executed_statements == ["SELECT 1"]
    assert session.closed is True


def test_comprehensive_health_does_not_claim_healthy_without_db_verification(
    monkeypatch,
):
    monkeypatch.setattr(
        HealthChecker,
        "basic_health_check",
        lambda self: {"status": "healthy"},
    )

    result = HealthChecker().comprehensive_health_check()

    assert result["status"] == "degraded"
    assert result["database"]["status"] == "not_verified"
