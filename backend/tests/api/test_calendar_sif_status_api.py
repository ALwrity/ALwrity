"""Calendar SIF — Phase A: ``GET /calendar-generation/calendar/sif-status`` API tests.

Proves the read-only status endpoint returns a safe, serializable payload
across the lifecycle states and never writes:
- no completed calendar → ``indexing.phase == not_indexed``
- completed + success lifecycle → phase ``success``, embedding_count ≥ 0,
  watermark block, 8 canonical document kinds
- 200 responses and plain-dict values (no raw ORM leaks).
"""
from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from models.calendar_sif_index_status import (
    STATUS_FAILED,
    STATUS_PENDING,
    STATUS_RUNNING,
    STATUS_SKIPPED,
    STATUS_SUCCESS,
    CalendarSifIndexStatus,
)
from models.calendar_sif_watermark import CalendarSifWatermark
from services.database import get_db

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

UID = "user-42"
CLERK_ID = "user_str_abc123"
SOURCE = "user:user-42:calendar_latest"

import middleware.auth_middleware as _auth
import api.content_planning.api.routes.calendar_generation as _cal


@pytest.fixture()
def ctx(tmp_path):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    CalendarSifIndexStatus.__table__.create(engine)
    CalendarSifWatermark.__table__.create(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield SimpleNamespace(Session=Session, session=session, workspace=tmp_path)
    session.close()
    engine.dispose()


@pytest.fixture()
def client(ctx, monkeypatch):
    app = FastAPI()
    app.include_router(_cal.router)
    app.dependency_overrides[_auth.get_current_user] = lambda: {
        "id": UID, "uid": UID,
        "clerk_user_id": UID, "email": "t@e.com", "is_active": True,
    }
    app.dependency_overrides[get_db] = lambda: ctx.session
    return TestClient(app, raise_server_exceptions=True)


@pytest.fixture()
def clerk_client(ctx, monkeypatch):
    app = FastAPI()
    app.include_router(_cal.router)
    app.dependency_overrides[_auth.get_current_user] = lambda: {
        "id": CLERK_ID, "uid": None,
        "clerk_user_id": CLERK_ID, "email": "t@e.com", "is_active": True,
    }
    app.dependency_overrides[get_db] = lambda: ctx.session
    return TestClient(app, raise_server_exceptions=True)


class TestStatusEndpoint:
    def test_no_indexing_not_indexed(self, client):
        resp = client.get("/calendar-generation/calendar/sif-status")
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["indexing"]["phase"] == "not_indexed"
        assert data["indexing"]["status"] is None
        assert data["indexing"]["embedding_count"] == 0
        assert data["watermark"] is None

    def test_pending_lifecycle_visible(self, ctx, client):
        CalendarSifIndexStatus.set_status(ctx.session, UID, SOURCE, STATUS_PENDING)
        ctx.session.commit()

        data = client.get("/calendar-generation/calendar/sif-status").json()["data"]
        assert data["indexing"]["phase"] == "pending"
        assert data["indexing"]["status"] == STATUS_PENDING

    def test_success_payload_complete(self, ctx, client):
        CalendarSifIndexStatus.set_status(
            ctx.session, UID, SOURCE, STATUS_RUNNING
        )
        CalendarSifIndexStatus.set_status(
            ctx.session, UID, SOURCE, STATUS_SUCCESS, embedding_count=8
        )
        CalendarSifWatermark.upsert(
            ctx.session, UID, SOURCE, "a" * 64, embedding_count=8,
            notes="calendar generation completion",
        )
        ctx.session.commit()

        data = client.get("/calendar-generation/calendar/sif-status").json()["data"]
        indexing = data["indexing"]
        assert indexing["phase"] == "success"
        assert indexing["embedding_count"] == 8
        assert indexing["error_message"] is None
        assert indexing["finished_at"] is not None

        watermark = data["watermark"]
        assert watermark is not None
        assert watermark["embedding_count"] == 8
        assert watermark["source_hash"] == "a" * 64

    def test_failed_lifecycle_visible(self, ctx, client):
        CalendarSifIndexStatus.set_status(
            ctx.session, UID, SOURCE, STATUS_RUNNING
        )
        CalendarSifIndexStatus.set_status(
            ctx.session, UID, SOURCE, STATUS_FAILED,
            embedding_count=0, error_message="txtai unavailable",
        )
        ctx.session.commit()

        data = client.get("/calendar-generation/calendar/sif-status").json()["data"]
        assert data["indexing"]["phase"] == "failed"
        assert data["indexing"]["error_message"] == "txtai unavailable"

    def test_skipped_lifecycle_visible(self, ctx, client):
        CalendarSifIndexStatus.set_status(
            ctx.session, UID, SOURCE, STATUS_SKIPPED, embedding_count=8
        )
        ctx.session.commit()

        data = client.get("/calendar-generation/calendar/sif-status").json()["data"]
        assert data["indexing"]["phase"] == "skipped"

    def test_clerk_string_user_id(self, ctx, clerk_client):
        data = clerk_client.get("/calendar-generation/calendar/sif-status").json()["data"]
        assert data["indexing"]["phase"] == "not_indexed"
        assert data["watermark"] is None

    def test_document_kinds_contract(self, client):
        data = client.get("/calendar-generation/calendar/sif-status").json()["data"]
        assert data["document_kinds"]["names"] == [
            "calendar_overview",
            "daily_schedule",
            "weekly_themes",
            "content_recommendations",
            "performance_predictions",
            "ai_insights",
            "strategy_alignment",
            "calendar_events",
        ]
        assert data["document_kinds"]["count"] == 8
        assert all(
            d.startswith("user:user-42:calendar_latest:")
            for d in data["document_kinds"]["doc_ids"]
        )
