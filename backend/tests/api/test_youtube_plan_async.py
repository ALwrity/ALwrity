"""Contract tests for asynchronous YouTube plan generation endpoints."""

from __future__ import annotations

from typing import Any, Dict

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.youtube import router as youtube_router_module
from api.youtube.task_manager import task_manager
from middleware.auth_middleware import get_current_user, get_current_user_with_query_token
from tests.framework.auth import fake_user_factory
from tests.framework.http import assert_status


def _build_test_client() -> TestClient:
    app = FastAPI(title="YouTube Plan Async Test App")
    app.include_router(youtube_router_module.router, prefix="/api")
    app.dependency_overrides[get_current_user] = lambda: fake_user_factory(uid="user_plan_a")
    app.dependency_overrides[get_current_user_with_query_token] = lambda: fake_user_factory(uid="user_plan_a")
    return TestClient(app)


def _valid_plan_request() -> Dict[str, Any]:
    return {
        "user_idea": "Create a practical tutorial about content batching for creators",
        "duration_type": "shorts",
        "video_type": "educational",
        "target_audience": "solo creators",
        "video_goal": "teach",
        "brand_style": "clean, practical",
    }


def test_create_plan_task_returns_task_id(monkeypatch):
    client = _build_test_client()
    task_manager.task_storage.clear()

    async def _fake_execute(task_id: str, request_data: Dict[str, Any], user_id: str):
        task_manager.update_task_status(
            task_id,
            "completed",
            progress=100.0,
            message="Video plan generated successfully",
            result={
                "plan": {
                    "video_summary": "Batching content efficiently.",
                    "target_audience": "solo creators",
                    "content_outline": [],
                    "hook_strategy": "Lead with key pain point",
                    "visual_style": "clean, practical",
                    "seo_keywords": ["content batching"],
                    "duration_type": "shorts",
                }
            },
        )

    monkeypatch.setattr(youtube_router_module, "execute_video_plan_task", _fake_execute)

    response = client.post("/api/youtube/plan", json=_valid_plan_request())
    assert_status(response, 200)
    payload = response.json()
    assert payload["success"] is True
    assert payload.get("task_id")

    status_response = client.get(f"/api/youtube/plan/{payload['task_id']}")
    assert_status(status_response, 200)
    status_payload = status_response.json()
    assert status_payload is not None
    assert status_payload["status"] == "completed"
    assert status_payload["result"]["plan"]["target_audience"] == "solo creators"


def test_plan_status_is_owner_scoped(monkeypatch):
    client = _build_test_client()
    task_manager.task_storage.clear()

    async def _fake_execute(task_id: str, request_data: Dict[str, Any], user_id: str):
        task_manager.update_task_status(
            task_id,
            "processing",
            progress=25.0,
            message="Generating plan",
        )

    monkeypatch.setattr(youtube_router_module, "execute_video_plan_task", _fake_execute)

    response = client.post("/api/youtube/plan", json=_valid_plan_request())
    assert_status(response, 200)
    task_id = response.json()["task_id"]

    client.app.dependency_overrides[get_current_user] = lambda: fake_user_factory(uid="user_plan_b")
    client.app.dependency_overrides[get_current_user_with_query_token] = lambda: fake_user_factory(uid="user_plan_b")

    foreign_status = client.get(f"/api/youtube/plan/{task_id}")
    assert_status(foreign_status, 200)
    assert foreign_status.json() is None


def test_plan_task_failure_is_exposed_in_status(monkeypatch):
    client = _build_test_client()
    task_manager.task_storage.clear()

    async def _fake_execute(task_id: str, request_data: Dict[str, Any], user_id: str):
        task_manager.update_task_status(
            task_id,
            "failed",
            progress=100.0,
            message="Video plan generation failed",
            error="Provider timeout",
            error_status=504,
            error_data={"detail": "upstream timeout"},
        )

    monkeypatch.setattr(youtube_router_module, "execute_video_plan_task", _fake_execute)

    response = client.post("/api/youtube/plan", json=_valid_plan_request())
    assert_status(response, 200)
    task_id = response.json()["task_id"]

    status_response = client.get(f"/api/youtube/plan/{task_id}")
    assert_status(status_response, 200)
    status_payload = status_response.json()
    assert status_payload["status"] == "failed"
    assert status_payload["error"] == "Provider timeout"
    assert status_payload["error_status"] == 504

