"""Integration tests for Story Writer project CRUD endpoints.

Tests the full HTTP → DB roundtrip: create, list, get, update, delete,
and favorite-toggle. Uses an in-memory SQLite database with SQLAlchemy
so the real StoryProjectService and its ORM queries are exercised.
"""

import uuid

import pytest

from tests.framework.http import assert_status

pytestmark = [pytest.mark.story_writer, pytest.mark.integration]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _unique_project_id():
    return f"test_story_{uuid.uuid4().hex[:12]}"


# ---------------------------------------------------------------------------
# Create project
# ---------------------------------------------------------------------------

class TestCreateProject:
    def test_create_returns_201_with_project_data(self, story_writer_client_with_db):
        pid = _unique_project_id()
        response = story_writer_client_with_db.post(
            "/api/story/projects",
            json={"project_id": pid, "title": "Test Story", "story_mode": "pure"},
        )
        assert_status(response, 201)
        data = response.json()
        assert data["project_id"] == pid
        assert data["title"] == "Test Story"
        assert data["story_mode"] == "pure"
        assert data["user_id"] == "user_storywriter"
        assert data["status"] == "draft"

    def test_create_returns_400_for_duplicate_id(self, story_writer_client_with_db):
        pid = _unique_project_id()
        story_writer_client_with_db.post(
            "/api/story/projects",
            json={"project_id": pid, "title": "First"},
        )
        response = story_writer_client_with_db.post(
            "/api/story/projects",
            json={"project_id": pid, "title": "Duplicate"},
        )
        assert_status(response, 400)
        assert "already exists" in response.json()["detail"]


# ---------------------------------------------------------------------------
# Get single project
# ---------------------------------------------------------------------------

class TestGetProject:
    def test_get_returns_200_for_existing_project(self, story_writer_client_with_db):
        pid = _unique_project_id()
        story_writer_client_with_db.post(
            "/api/story/projects", json={"project_id": pid, "title": "Find Me"}
        )
        response = story_writer_client_with_db.get(f"/api/story/projects/{pid}")
        assert_status(response, 200)
        assert response.json()["title"] == "Find Me"

    def test_get_returns_404_for_nonexistent_project(self, story_writer_client_with_db):
        response = story_writer_client_with_db.get(
            "/api/story/projects/nonexistent_id"
        )
        assert_status(response, 404)

    def test_get_is_user_scoped(self, story_writer_client_with_db, monkeypatch):
        """A project created by one 'user' should NOT be visible to another."""
        pid = _unique_project_id()
        # Create as user_storywriter (default)
        story_writer_client_with_db.post(
            "/api/story/projects", json={"project_id": pid, "title": "Mine"}
        )
        # Switch client to a different user
        from middleware.auth_middleware import get_current_user
        from tests.framework.auth import fake_user_factory

        client = story_writer_client_with_db
        client.app.dependency_overrides[get_current_user] = (
            lambda: fake_user_factory(uid="user_other")
        )
        response = client.get(f"/api/story/projects/{pid}")
        assert_status(response, 404)


# ---------------------------------------------------------------------------
# List projects
# ---------------------------------------------------------------------------

class TestListProjects:
    def test_list_returns_empty_when_no_projects(self, story_writer_client_with_db):
        response = story_writer_client_with_db.get("/api/story/projects")
        assert_status(response, 200)
        data = response.json()
        assert data["projects"] == []
        assert data["total"] == 0

    def test_list_returns_user_projects(self, story_writer_client_with_db):
        for i in range(3):
            story_writer_client_with_db.post(
                "/api/story/projects",
                json={"project_id": _unique_project_id(), "title": f"Story {i}"},
            )
        response = story_writer_client_with_db.get("/api/story/projects")
        assert_status(response, 200)
        data = response.json()
        assert data["total"] == 3
        assert len(data["projects"]) == 3

    def test_list_respects_limit_and_offset(self, story_writer_client_with_db):
        for i in range(5):
            story_writer_client_with_db.post(
                "/api/story/projects",
                json={"project_id": _unique_project_id(), "title": f"Story {i}"},
            )
        response = story_writer_client_with_db.get(
            "/api/story/projects?limit=2&offset=1"
        )
        assert_status(response, 200)
        data = response.json()
        assert len(data["projects"]) == 2
        assert data["total"] == 5
        assert data["limit"] == 2
        assert data["offset"] == 1

    def test_list_filters_by_status(self, story_writer_client_with_db):
        story_writer_client_with_db.post(
            "/api/story/projects",
            json={"project_id": _unique_project_id(), "title": "Draft"},
        )
        response = story_writer_client_with_db.get(
            "/api/story/projects?status=completed"
        )
        assert_status(response, 200)
        assert response.json()["total"] == 0

    def test_list_rejects_invalid_order_by(self, story_writer_client_with_db):
        response = story_writer_client_with_db.get(
            "/api/story/projects?order_by=invalid_column"
        )
        assert_status(response, 400)


# ---------------------------------------------------------------------------
# Update project
# ---------------------------------------------------------------------------

class TestUpdateProject:
    def test_update_changes_title(self, story_writer_client_with_db):
        pid = _unique_project_id()
        story_writer_client_with_db.post(
            "/api/story/projects", json={"project_id": pid, "title": "Old Title"}
        )
        response = story_writer_client_with_db.put(
            f"/api/story/projects/{pid}", json={"title": "New Title"}
        )
        assert_status(response, 200)
        assert response.json()["title"] == "New Title"

    def test_update_returns_404_for_nonexistent(self, story_writer_client_with_db):
        response = story_writer_client_with_db.put(
            "/api/story/projects/nonexistent", json={"title": "Ghost"}
        )
        assert_status(response, 404)

    def test_update_preserves_unset_fields(self, story_writer_client_with_db):
        pid = _unique_project_id()
        story_writer_client_with_db.post(
            "/api/story/projects",
            json={
                "project_id": pid,
                "title": "Keep Mode",
                "story_mode": "marketing",
            },
        )
        # Update only title — story_mode should survive
        response = story_writer_client_with_db.put(
            f"/api/story/projects/{pid}", json={"title": "Renamed"}
        )
        assert_status(response, 200)
        data = response.json()
        assert data["title"] == "Renamed"
        assert data["story_mode"] == "marketing"

    def test_update_mark_complete(self, story_writer_client_with_db):
        pid = _unique_project_id()
        story_writer_client_with_db.post(
            "/api/story/projects", json={"project_id": pid, "title": "WIP"}
        )
        response = story_writer_client_with_db.put(
            f"/api/story/projects/{pid}", json={"is_complete": True}
        )
        assert_status(response, 200)
        assert response.json()["is_complete"] is True


# ---------------------------------------------------------------------------
# Delete project
# ---------------------------------------------------------------------------

class TestDeleteProject:
    def test_delete_removes_project(self, story_writer_client_with_db):
        pid = _unique_project_id()
        story_writer_client_with_db.post(
            "/api/story/projects", json={"project_id": pid, "title": "Delete Me"}
        )
        response = story_writer_client_with_db.delete(f"/api/story/projects/{pid}")
        assert_status(response, 204)

        # Verify it's gone
        get_resp = story_writer_client_with_db.get(f"/api/story/projects/{pid}")
        assert_status(get_resp, 404)

    def test_delete_returns_404_for_nonexistent(self, story_writer_client_with_db):
        response = story_writer_client_with_db.delete(
            "/api/story/projects/nonexistent"
        )
        assert_status(response, 404)


# ---------------------------------------------------------------------------
# Favorite toggle
# ---------------------------------------------------------------------------

class TestFavoriteToggle:
    def test_toggle_favorite_flips_flag(self, story_writer_client_with_db):
        pid = _unique_project_id()
        story_writer_client_with_db.post(
            "/api/story/projects", json={"project_id": pid, "title": "Fav Test"}
        )
        # Toggle ON
        resp1 = story_writer_client_with_db.post(f"/api/story/projects/{pid}/favorite")
        assert_status(resp1, 200)
        assert resp1.json()["is_favorite"] is True

        # Toggle OFF
        resp2 = story_writer_client_with_db.post(f"/api/story/projects/{pid}/favorite")
        assert_status(resp2, 200)
        assert resp2.json()["is_favorite"] is False
