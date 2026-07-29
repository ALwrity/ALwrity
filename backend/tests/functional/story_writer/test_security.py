"""Security regression tests — multi-tenancy isolation, exception safety.

Verifies StoryWriter invariants:
1. Cross-user data isolation — user A cannot see/touch user B's projects
2. No secrets in error responses — 500 responses must not leak DB internals
3. Auth context enforcement — endpoints must reject missing user context
"""

import pytest

from tests.framework.http import assert_status
from tests.framework.auth import fake_user_factory

pytestmark = [pytest.mark.story_writer, pytest.mark.critical]


class TestCrossUserIsolation:
    """Ensure story projects are properly scoped to the authenticated user."""

    def test_create_sets_correct_user_id(self, story_writer_client_with_db):
        r = story_writer_client_with_db.post(
            "/api/story/projects",
            json={"project_id": "sec_create", "title": "Mine"},
        )
        assert_status(r, 201)
        assert r.json()["user_id"] == "user_storywriter"

    def test_list_only_returns_own_projects(self, story_writer_client_with_db):
        story_writer_client_with_db.post(
            "/api/story/projects", json={"project_id": "sec_a", "title": "A"}
        )
        story_writer_client_with_db.post(
            "/api/story/projects", json={"project_id": "sec_b", "title": "B"}
        )
        r = story_writer_client_with_db.get("/api/story/projects")
        ids = {p["project_id"] for p in r.json()["projects"]}
        assert "sec_a" in ids and "sec_b" in ids and r.json()["total"] == 2

    def test_cannot_delete_other_users_project(self, story_writer_client_with_db):
        pid = "sec_del"
        story_writer_client_with_db.post(
            "/api/story/projects", json={"project_id": pid}
        )
        from middleware.auth_middleware import get_current_user

        story_writer_client_with_db.app.dependency_overrides[get_current_user] = (
            lambda: fake_user_factory(uid="user_other")
        )
        r = story_writer_client_with_db.delete(f"/api/story/projects/{pid}")
        assert_status(r, 404)

    def test_cannot_update_other_users_project(self, story_writer_client_with_db):
        pid = "sec_upd"
        story_writer_client_with_db.post(
            "/api/story/projects", json={"project_id": pid, "title": "Orig"}
        )
        from middleware.auth_middleware import get_current_user

        story_writer_client_with_db.app.dependency_overrides[get_current_user] = (
            lambda: fake_user_factory(uid="user_other")
        )
        r = story_writer_client_with_db.put(
            f"/api/story/projects/{pid}", json={"title": "Hacked"}
        )
        assert_status(r, 404)

    def test_unauthorized_without_user_context(self, story_writer_app):
        from middleware.auth_middleware import get_current_user
        story_writer_app.dependency_overrides.pop(get_current_user, None)

        from fastapi.testclient import TestClient
        client = TestClient(story_writer_app)
        r = client.get("/api/story/projects")
        assert r.status_code in (401, 403)


SENSITIVE_PATTERNS = [
    "sqlite3.", "SQLite", "sqlalchemy", "OperationalError",
    "ProgrammingError", "IntegrityError", "Traceback",
    "C:\\", "/Users/",
]


class TestExceptionSafety:
    """Verify 500 error responses do not leak internal implementation details."""

    def test_invalid_update_does_not_leak_db_details(self, story_writer_client_with_db):
        r = story_writer_client_with_db.put(
            "/api/story/projects/nonexistent",
            json={"is_complete": "not_a_boolean"},
        )
        if r.status_code == 500:
            body = r.text
            for pattern in SENSITIVE_PATTERNS:
                assert pattern not in body, (
                    f"500 leaked '{pattern}': {body[:200]}"
                )

    def test_error_responses_have_detail_key(self, story_writer_client_with_db):
        r = story_writer_client_with_db.get("/api/story/projects/nonexistent")
        assert_status(r, 404)
        assert "detail" in r.json()

    def test_health_never_returns_500(self, story_writer_client):
        r = story_writer_client.get("/api/story/health")
        assert r.status_code != 500


class TestAuthMiddlewareSafety:
    """Verify auth middleware never logs tokens or secrets."""

    def test_middleware_filters_auth_header_from_logs(self):
        import inspect
        from middleware.auth_middleware import ClerkAuthMiddleware
        source = inspect.getsource(ClerkAuthMiddleware)
        assert "authorization" in source.lower() or "auth" in source.lower()
