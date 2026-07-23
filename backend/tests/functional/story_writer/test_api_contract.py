"""API contract regression tests for Story Writer endpoints.

Verifies that every Story Writer route returns the correct response schema
and HTTP status codes. Runs against the functional test app with auth and
DB overrides in place.

Marked as ``critical`` — these MUST pass before merging any PR that
touches story writer routes, models, or services.
"""

import pytest

from tests.framework.http import assert_status

pytestmark = [pytest.mark.story_writer, pytest.mark.critical]


# ---------------------------------------------------------------------------
# Schema constants — add new fields here as the API evolves
# ---------------------------------------------------------------------------

PROJECT_RESPONSE_KEYS = {
    "id",
    "project_id",
    "user_id",
    "title",
    "story_mode",
    "story_template",
    "setup",
    "outline",
    "scenes",
    "story_content",
    "anime_bible",
    "media_state",
    "current_phase",
    "status",
    "is_favorite",
    "is_complete",
    "created_at",
    "updated_at",
}

PROJECT_LIST_RESPONSE_KEYS = {"projects", "total", "limit", "offset"}

HEALTH_RESPONSE_KEYS = {"status", "service"}


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

class TestHealthContract:
    def test_health_returns_correct_schema(self, story_writer_client):
        response = story_writer_client.get("/api/story/health")
        assert_status(response, 200)
        data = response.json()
        assert set(data.keys()) == HEALTH_RESPONSE_KEYS, (
            f"Health response schema changed. Expected {HEALTH_RESPONSE_KEYS}, "
            f"got {set(data.keys())}"
        )
        assert data["status"] == "ok"
        assert data["service"] == "story_writer"

    def test_health_does_not_require_db(self, story_writer_client):
        """Health endpoint should never depend on get_db."""
        response = story_writer_client.get("/api/story/health")
        assert_status(response, 200)


# ---------------------------------------------------------------------------
# Projects — Create
# ---------------------------------------------------------------------------

class TestCreateProjectContract:
    def test_create_response_contains_all_keys(
        self, story_writer_client_with_db
    ):
        response = story_writer_client_with_db.post(
            "/api/story/projects",
            json={"project_id": "reg_test_1", "title": "Contract Test"},
        )
        assert_status(response, 201)
        data = response.json()
        assert set(data.keys()) == PROJECT_RESPONSE_KEYS, (
            f"Create response schema changed. Missing: "
            f"{PROJECT_RESPONSE_KEYS - set(data.keys())}. "
            f"Extra: {set(data.keys()) - PROJECT_RESPONSE_KEYS}"
        )

    def test_create_populates_required_fields(
        self, story_writer_client_with_db
    ):
        response = story_writer_client_with_db.post(
            "/api/story/projects",
            json={"project_id": "reg_test_2", "title": "Populated"},
        )
        data = response.json()
        assert data["project_id"] == "reg_test_2"
        assert data["title"] == "Populated"
        assert data["status"] == "draft"
        assert data["is_favorite"] is False
        assert data["is_complete"] is False
        assert data["user_id"] == "user_storywriter"
        assert data["created_at"] is not None
        assert data["updated_at"] is not None

    def test_create_returns_400_for_missing_project_id(
        self, story_writer_client_with_db
    ):
        response = story_writer_client_with_db.post(
            "/api/story/projects",
            json={"title": "No ID"},
        )
        assert_status(response, 422)


# ---------------------------------------------------------------------------
# Projects — Get
# ---------------------------------------------------------------------------

class TestGetProjectContract:
    def test_get_response_schema(self, story_writer_client_with_db):
        pid = "reg_test_get"
        story_writer_client_with_db.post(
            "/api/story/projects", json={"project_id": pid, "title": "Get Me"}
        )
        response = story_writer_client_with_db.get(f"/api/story/projects/{pid}")
        assert_status(response, 200)
        data = response.json()
        assert set(data.keys()) == PROJECT_RESPONSE_KEYS

    def test_get_returns_404_schema(self, story_writer_client_with_db):
        response = story_writer_client_with_db.get(
            "/api/story/projects/impossible_id"
        )
        assert_status(response, 404)
        data = response.json()
        assert "detail" in data


# ---------------------------------------------------------------------------
# Projects — List
# ---------------------------------------------------------------------------

class TestListProjectsContract:
    def test_list_response_schema(self, story_writer_client_with_db):
        response = story_writer_client_with_db.get("/api/story/projects")
        assert_status(response, 200)
        data = response.json()
        assert set(data.keys()) == PROJECT_LIST_RESPONSE_KEYS
        assert isinstance(data["projects"], list)
        assert isinstance(data["total"], int)
        assert isinstance(data["limit"], int)
        assert isinstance(data["offset"], int)

    def test_list_limit_defaults(self, story_writer_client_with_db):
        response = story_writer_client_with_db.get("/api/story/projects")
        data = response.json()
        assert data["limit"] > 0
        assert data["offset"] == 0

    def test_list_each_project_has_correct_schema(
        self, story_writer_client_with_db
    ):
        story_writer_client_with_db.post(
            "/api/story/projects",
            json={"project_id": "reg_list_1", "title": "One"},
        )
        response = story_writer_client_with_db.get("/api/story/projects")
        for project in response.json()["projects"]:
            assert set(project.keys()) == PROJECT_RESPONSE_KEYS


# ---------------------------------------------------------------------------
# Projects — Update
# ---------------------------------------------------------------------------

class TestUpdateProjectContract:
    def test_update_response_schema(self, story_writer_client_with_db):
        pid = "reg_test_update"
        story_writer_client_with_db.post(
            "/api/story/projects", json={"project_id": pid}
        )
        response = story_writer_client_with_db.put(
            f"/api/story/projects/{pid}",
            json={"title": "Updated Title"},
        )
        assert_status(response, 200)
        data = response.json()
        assert set(data.keys()) == PROJECT_RESPONSE_KEYS
        assert data["title"] == "Updated Title"

    def test_update_nonexistent_returns_404_schema(
        self, story_writer_client_with_db
    ):
        response = story_writer_client_with_db.put(
            "/api/story/projects/not_real",
            json={"title": "Ghost"},
        )
        assert_status(response, 404)


# ---------------------------------------------------------------------------
# Projects — Delete
# ---------------------------------------------------------------------------

class TestDeleteProjectContract:
    def test_delete_returns_204_no_body(self, story_writer_client_with_db):
        pid = "reg_test_delete"
        story_writer_client_with_db.post(
            "/api/story/projects", json={"project_id": pid}
        )
        response = story_writer_client_with_db.delete(
            f"/api/story/projects/{pid}"
        )
        assert_status(response, 204)
        # 204 should have no body
        assert response.text == "" or response.text is None

    def test_delete_nonexistent_returns_404(self, story_writer_client_with_db):
        response = story_writer_client_with_db.delete(
            "/api/story/projects/not_real"
        )
        assert_status(response, 404)


# ---------------------------------------------------------------------------
# Projects — Favorite
# ---------------------------------------------------------------------------

class TestFavoriteContract:
    def test_favorite_response_schema(self, story_writer_client_with_db):
        pid = "reg_test_fav"
        story_writer_client_with_db.post(
            "/api/story/projects", json={"project_id": pid}
        )
        response = story_writer_client_with_db.post(
            f"/api/story/projects/{pid}/favorite"
        )
        assert_status(response, 200)
        data = response.json()
        assert set(data.keys()) == PROJECT_RESPONSE_KEYS
        assert data["is_favorite"] is True
