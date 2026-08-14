"""Tests for the durable, DB-backed persona generation task store.

These replace the transient in-memory ``persona_tasks`` dict, so the tests
verify state actually persists in the database (survives a fresh session /
process restart) and that the polling endpoint reconciles orphaned tasks.
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

MOD = "api.onboarding_utils.step4_persona_routes"


def _fake_user(uid: str = "user_test") -> dict:
    return {"id": uid, "uid": uid, "clerk_user_id": uid, "email": "t@e.com", "is_active": True}


@pytest.fixture
def task_engine(tmp_path):
    from models.persona_task_models import PersonaGenerationTask
    from models.base import Base

    # File-backed SQLite so the TestClient (which runs the ASGI app in a
    # different thread) shares the same database as the test thread.
    engine = create_engine(f"sqlite:///{tmp_path / 'persona_tasks.db'}")
    Base.metadata.create_all(bind=engine, tables=[PersonaGenerationTask.__table__])
    return engine


def _session_factory(engine):
    return lambda uid: sessionmaker(bind=engine)()


def _build_app():
    from api.onboarding_utils.step4_persona_routes import router
    from middleware.auth_middleware import get_current_user

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: _fake_user()
    return app


class TestTaskStoreDurability:
    def test_create_and_get_roundtrip(self, task_engine):
        from api.onboarding_utils import step4_persona_routes as m

        with patch(f"{MOD}.get_session_for_user", side_effect=_session_factory(task_engine)):
            m._create_persona_task("u1", "t1", "pending", 0, "init", [], None, None)
            task = m._get_persona_task("u1", "t1")

        assert task is not None
        assert task["task_id"] == "t1"
        assert task["status"] == "pending"
        assert task["progress"] == 0

    def test_update_appends_progress_and_updates_status(self, task_engine):
        from api.onboarding_utils import step4_persona_routes as m

        with patch(f"{MOD}.get_session_for_user", side_effect=_session_factory(task_engine)):
            m._create_persona_task("u1", "t1", "pending", 0, "init", [], None, None)
            m._update_persona_task("u1", "t1", "running", 40, "core generated")
            m._update_persona_task("u1", "t1", "completed", 100, "done", result={"success": True})

            task = m._get_persona_task("u1", "t1")

        assert task["status"] == "completed"
        assert task["progress"] == 100
        assert task["result"] == {"success": True}
        assert len(task["progress_messages"]) == 2
        assert task["progress_messages"][0]["message"] == "core generated"

    def test_get_nonexistent_returns_none(self, task_engine):
        from api.onboarding_utils import step4_persona_routes as m

        with patch(f"{MOD}.get_session_for_user", side_effect=_session_factory(task_engine)):
            assert m._get_persona_task("u1", "missing") is None

    def test_state_survives_fresh_session(self, task_engine):
        """State must be in the DB, not process memory — a brand-new session reads it back."""
        from api.onboarding_utils import step4_persona_routes as m

        with patch(f"{MOD}.get_session_for_user", side_effect=_session_factory(task_engine)):
            m._create_persona_task("u1", "t1", "running", 50, "working", [], None, None)

        # New patch context = new sessions from scratch, but same underlying DB.
        with patch(f"{MOD}.get_session_for_user", side_effect=_session_factory(task_engine)):
            task = m._get_persona_task("u1", "t1")

        assert task is not None
        assert task["status"] == "running"
        assert task["progress"] == 50


class TestPersonaTaskEndpoint:
    def test_404_when_task_not_found(self, task_engine):
        with patch(f"{MOD}.get_session_for_user", side_effect=_session_factory(task_engine)):
            client = TestClient(_build_app(), raise_server_exceptions=False)
            resp = client.get("/step4/persona-task/nonexistent")

        assert resp.status_code == 404

    def test_returns_task_status(self, task_engine):
        from api.onboarding_utils import step4_persona_routes as m

        with patch(f"{MOD}.get_session_for_user", side_effect=_session_factory(task_engine)):
            m._create_persona_task("user_test", "t1", "pending", 0, "init", [], None, None)
            client = TestClient(_build_app(), raise_server_exceptions=False)
            resp = client.get("/step4/persona-task/t1")

        assert resp.status_code == 200
        body = resp.json()
        assert body["task_id"] == "t1"
        assert body["status"] == "pending"

    def test_stale_running_task_marked_failed(self, task_engine):
        from api.onboarding_utils import step4_persona_routes as m
        from models.persona_task_models import PersonaGenerationTask

        with patch(f"{MOD}.get_session_for_user", side_effect=_session_factory(task_engine)):
            m._create_persona_task("user_test", "t1", "running", 50, "working", [], None, None)

            # Backdate the task so it looks orphaned (server restarted mid-run).
            db = sessionmaker(bind=task_engine)()
            row = db.query(PersonaGenerationTask).filter_by(task_id="t1").first()
            row.updated_at = datetime.utcnow() - timedelta(minutes=30)
            db.commit()
            db.close()

            client = TestClient(_build_app(), raise_server_exceptions=False)
            resp = client.get("/step4/persona-task/t1")

        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "failed"
        assert body["error"] == "interrupted"
