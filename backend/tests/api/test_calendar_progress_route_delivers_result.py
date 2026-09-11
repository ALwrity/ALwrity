"""B4 — the /progress endpoint delivers the final assembled calendar once a
session completes, so the frontend wizard can render a real calendar instead
of empty step-result metadata.
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from middleware.auth_middleware import get_current_user
from services.database import get_db
from api.content_planning.api.routes.calendar_generation import (
    router as calendar_generation_router,
)
from api.content_planning.services.calendar_generation_service import (
    CalendarGenerationService,
)


def _progress_payload(status, with_result):
    payload = {
        "session_id": "sid-1",
        "status": status,
        "current_step": 12 if status == "completed" else 5,
        "step_progress": 100 if status == "completed" else 40,
        "overall_progress": 100 if status == "completed" else 40,
        "step_results": {},
        "quality_scores": {},
        "transparency_messages": [],
        "educational_content": [],
        "errors": [],
        "warnings": [],
        "estimated_completion": None,
        "last_updated": "2026-01-10T00:00:00Z",
    }
    if with_result:
        payload["result"] = {
            "daily_schedule": [
                {"date": "2026-01-05", "content_items": [{"title": "AI 101"}]}
            ],
            "weekly_themes": [{"week_number": 1, "theme": "AI Foundations"}],
        }
    return payload


def _build_app(monkeypatch, payload):
    monkeypatch.setattr(
        CalendarGenerationService,
        "get_orchestrator_progress",
        lambda self, session_id: payload,
    )
    app = FastAPI()
    app.include_router(calendar_generation_router)
    app.dependency_overrides[get_current_user] = lambda: {"id": "user-123"}
    app.dependency_overrides[get_db] = lambda: None
    return TestClient(app, raise_server_exceptions=False)


def test_progress_route_returns_result_when_completed(monkeypatch):
    client = _build_app(monkeypatch, _progress_payload("completed", with_result=True))

    resp = client.get("/calendar-generation/progress/sid-1")

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["status"] == "completed"
    assert payload["result"]["daily_schedule"][0]["content_items"][0]["title"] == "AI 101"
    assert payload["result"]["weekly_themes"][0]["theme"] == "AI Foundations"


def test_progress_route_excludes_result_while_running(monkeypatch):
    client = _build_app(monkeypatch, _progress_payload("running", with_result=False))

    resp = client.get("/calendar-generation/progress/sid-1")

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["status"] == "running"
    assert payload["result"] is None