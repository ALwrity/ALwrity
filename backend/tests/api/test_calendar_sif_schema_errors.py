"""R5.2 — schema failures must be distinguishable from `not_indexed`.

Model helpers (CalendarSifIndexStatus.get / watermark readers) swallow
SQLAlchemy errors and return None — so a MISSING TABLE (bad migration /
fresh DB not migrated yet) reads as phase `not_indexed` over HTTP 200 and
operators cannot tell "nothing indexed yet" from "the schema is broken".

Contract: a schema-level failure inside the SIF endpoints surfaces as a
degraded 503 (`code: "sif_storage_unavailable"`), never a silent
`not_indexed`.
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from models.calendar_sif_index_status import CalendarSifIndexStatus
from models.calendar_sif_watermark import CalendarSifWatermark
from services.database import get_db

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(_BACKEND_ROOT.parent) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT.parent))

import middleware.auth_middleware as _auth
import api.content_planning.api.routes.calendar_generation as _cal

NUMERIC_UID = "user-42"


def _build_app(session):
    app = FastAPI()
    app.include_router(_cal.router)
    app.dependency_overrides[_cal.get_current_user] = lambda: {
        "id": NUMERIC_UID, "uid": NUMERIC_UID,
        "clerk_user_id": NUMERIC_UID, "email": "t@e.com", "is_active": True,
    }
    app.dependency_overrides[get_db] = lambda: session
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    CalendarSifIndexStatus.__table__.create(engine)
    CalendarSifWatermark.__table__.create(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()
    engine.dispose()


class BrokenSession:
    """query() fails at the SQLAlchemy level (e.g. missing schema)."""

    def query(self, *a, **k):
        raise RuntimeError('no such table: calendar_sif_index_status')

    def rollback(self):
        pass


class TestSchemaErrorsDistinguishable:
    def test_status_endpoint_reports_unavailable_not_not_indexed(self):
        """A broken READ (schema-level) must surface as degraded 503 —
        never as the honest-looking `not_indexed` (R5.2)."""
        client = _build_app(BrokenSession())
        resp = client.get("/calendar-generation/calendar/sif-status")
        assert resp.status_code == 503, resp.text
        data = resp.json()["detail"]["data"]
        assert data["indexing"]["phase"] == "unavailable", (
            "a schema failure must never report the honest-looking not_indexed"
        )
        assert data["code"] == "sif_storage_unavailable"

    def test_row_absent_still_reports_not_indexed(self, db):
        """A healthy empty DB (no rows) still reads as the honest
        `not_indexed` over 200 — the two states stay separable."""
        client = _build_app(db)
        resp = client.get("/calendar-generation/calendar/sif-status")
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["indexing"]["phase"] == "not_indexed"

