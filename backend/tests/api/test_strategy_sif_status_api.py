"""SIF x Strategy — Phase 1: ``GET /strategy/sif-status`` API tests.

Proves the read-only status endpoint returns a safe, serializable payload
across the lifecycle states and never writes:
- no active strategy → ``indexing.phase == no_active_strategy``
- active + success lifecycle → phase ``success``, embedding_count 8,
  watermark block, vfs mirror block, 8 canonical document kinds
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

from models.enhanced_strategy_models import EnhancedContentStrategy
from models.monitoring_models import StrategyActivationStatus
from models.sif_indexing_watermark import SIFIndexingWatermark
from models.strategy_sif_index_status import (
    STATUS_PENDING,
    STATUS_RUNNING,
    STATUS_SUCCESS,
    StrategySifIndexStatus,
)

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

UID = "42"
NUMERIC_UID = 42
SOURCE = "user:42:strategy_active:current"
CLERK_ID = "user_str_abc123"

ENDPOINT_MOD = "api.content_planning.api.content_strategy.endpoints.strategy_wizard_endpoints"
WORKSPACE_ROOT = "services.workspace_paths.get_workspace_root"


@pytest.fixture()
def ctx(tmp_path):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    StrategySifIndexStatus.__table__.create(engine)
    StrategyActivationStatus.__table__.create(engine)
    EnhancedContentStrategy.__table__.create(engine)
    SIFIndexingWatermark.__table__.create(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    row = EnhancedContentStrategy()
    row.id = 7
    row.user_id = str(NUMERIC_UID)
    row.name = "Growth Plan"
    row.industry = "SaaS"
    row.business_objectives = ["grow"]
    row.comprehensive_ai_analysis = {
        "strategy_metadata": {"version": "2.0"},
        "base_strategy": {"pillars": ["ownership"]},
    }
    session.add(row)
    session.commit()

    yield SimpleNamespace(
        Session=Session, session=session, workspace=tmp_path
    )
    session.close()
    engine.dispose()


def _seed_activation(session, *, activated=True, user_id=NUMERIC_UID):
    if not activated:
        return
    act = StrategyActivationStatus(
        user_id=user_id,
        strategy_id=7,
        activation_date=datetime(2026, 9, 9, 10, 0, 0),
        status="active",
        last_updated=datetime(2026, 9, 9, 10, 0, 0),
    )
    session.add(act)
    session.commit()
    return act


@pytest.fixture()
def client(ctx, monkeypatch):
    from api.content_planning.api.content_strategy.endpoints.strategy_wizard_endpoints import router
    from middleware.auth_middleware import get_current_user

    monkeypatch.setattr(WORKSPACE_ROOT, lambda: ctx.workspace)
    monkeypatch.setattr(
        f"{ENDPOINT_MOD}.get_session_for_user", lambda user_id: ctx.session
    )

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: {
        "id": str(NUMERIC_UID), "uid": str(NUMERIC_UID),
        "clerk_user_id": str(NUMERIC_UID), "email": "t@e.com", "is_active": True,
    }
    return TestClient(app, raise_server_exceptions=True)


@pytest.fixture()
def clerk_client(ctx, monkeypatch):
    """Client whose authenticated user carries a raw (non-numeric) Clerk id."""
    from api.content_planning.api.content_strategy.endpoints.strategy_wizard_endpoints import router
    from middleware.auth_middleware import get_current_user

    monkeypatch.setattr(WORKSPACE_ROOT, lambda: ctx.workspace)
    monkeypatch.setattr(
        f"{ENDPOINT_MOD}.get_session_for_user", lambda user_id: ctx.session
    )

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: {
        "id": CLERK_ID, "uid": None,
        "clerk_user_id": CLERK_ID, "email": "t@e.com", "is_active": True,
    }
    return TestClient(app, raise_server_exceptions=True)


class TestStatusEndpoint:
    def test_no_active_strategy(self, client):
        resp = client.get("/strategy/sif-status")
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["activation"] is None
        assert data["indexing"]["phase"] == "no_active_strategy"
        assert data["indexing"]["status"] is None

    def test_pending_lifecycle_visible(self, ctx, client):
        _seed_activation(ctx.session)
        StrategySifIndexStatus.set_status(ctx.session, UID, SOURCE, STATUS_PENDING)
        ctx.session.commit()

        data = client.get("/strategy/sif-status").json()["data"]
        assert data["indexing"]["phase"] == "pending"
        assert data["activation"]["strategy_id"] == 7

    def test_success_payload_complete(self, ctx, client):
        _seed_activation(ctx.session)
        StrategySifIndexStatus.set_status(ctx.session, UID, SOURCE, STATUS_RUNNING)
        StrategySifIndexStatus.set_status(
            ctx.session, UID, SOURCE, STATUS_SUCCESS, embedding_count=8
        )
        SIFIndexingWatermark.upsert(
            ctx.session, UID, SOURCE, "a" * 64, embedding_count=8,
            notes="strategy activation",
        )
        ctx.session.commit()

        data = client.get("/strategy/sif-status").json()["data"]
        indexing = data["indexing"]
        assert indexing["phase"] == "success"
        assert indexing["embedding_count"] == 8
        assert indexing["error_message"] is None
        assert indexing["finished_at"] is not None

        watermark = data["watermark"]
        assert watermark is not None
        assert watermark["embedding_count"] == 8
        assert watermark["source_hash"] == "a" * 64

        assert data["vfs_mirror"]["exists"] is False
        assert "path" in data["vfs_mirror"]
        docs = data["document_kinds"]
        assert docs["checked"] is False
        assert len(docs["names"]) == 8
        assert docs["doc_ids"][0] == "user:42:strategy_active:current:form_summary"

    def test_clerk_string_user_id_resolves_active_strategy(self, ctx, clerk_client):
        _seed_activation(ctx.session, user_id=CLERK_ID)

        data = clerk_client.get("/strategy/sif-status").json()["data"]
        assert data["activation"] is not None
        assert data["activation"]["strategy_id"] == 7
        assert data["indexing"]["phase"] == "not_indexed"
        assert data["indexing"]["status"] is None

    def test_document_kinds_contract(self, client):
        data = client.get("/strategy/sif-status").json()["data"]
        assert data["document_kinds"]["names"] == [
            "form_summary", "base_strategy", "strategic_insights",
            "competitive_analysis", "performance_predictions",
            "implementation_roadmap", "risk_assessment", "user_persona_digest",
        ]