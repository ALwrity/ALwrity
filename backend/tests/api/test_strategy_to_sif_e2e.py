"""SIF x Strategy integration — Phase SIF-E: end-to-end (activation → index).

Proves the integrated contract against a real sqlite session and the real
dispatch path (txtai replaced by a recorded fake):

- One activation indexes exactly 8 documents with the locked doc-id
  scheme ``user:{uid}:strategy_active:current:{kind}``.
- The watermark row ``sif_indexing_watermarks`` is stamped with
  source_id / embedding_count / sha256 hash; an unchanged re-activation
  is fresh and skips the embed entirely.
- A changed re-activation replaces the same doc ids in place (no
  orphaned kinds) and moves the watermark hash.
- The VFS mirror ``strategy/active.md`` exists after dispatch.
- HTTP layer: ``POST /strategy/activate`` returns 200 and invokes the
  hook with the committed snapshot (activation details are covered by
  ``test_strategy_activation_sif_hook.py``).
"""
from __future__ import annotations

import asyncio
import sys
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
from services.intelligence.strategy_indexer import compute_strategy_source_hash

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

UID = "user-42"
NUMERIC_UID = 42
ACTIVATION = "2026-09-09T10:00:00"

ENDPOINT_MOD = "api.content_planning.api.content_strategy.endpoints.strategy_wizard_endpoints"
DISPATCH_TARGET = "services.intelligence.strategy_vfs_companion.dispatch_activation_indexing"
SIF_FACTORY_PATH = "services.intelligence.strategy_indexer.TxtaiIntelligenceService"
WORKSPACE_ROOT = "services.workspace_paths.get_workspace_root"


class FakeEmbeddings:
    def __init__(self):
        self.docs = {}

    def get(self, doc_id):
        return self.docs.get(doc_id)


class FakeSIF:
    """Recorded stand-in for TxtaiIntelligenceService."""

    def __init__(self):
        self.calls = []
        self.embeddings = FakeEmbeddings()

    async def index_content(self, items):
        self.calls.append(list(items))
        for doc_id, text, _meta in items:
            self.embeddings.docs[doc_id] = {"text": text}
        return len(items)


class FakeSIFFactory:
    """Side-effect factory so every ``TxtaiIntelligenceService(user_id)`` yields a recorded fake."""

    def __init__(self):
        self.instances = []

    def __call__(self, *args, **kwargs):
        instance = FakeSIF()
        self.instances.append(instance)
        return instance


@pytest.fixture()
def ctx(tmp_path):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SIFIndexingWatermark.__table__.create(engine)
    EnhancedContentStrategy.__table__.create(engine)
    StrategyActivationStatus.__table__.create(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    yield SimpleNamespace(
        Session=Session,
        session=session,
        sif_factory=FakeSIFFactory(),
        workspace=tmp_path,
        active_md=tmp_path / f"workspace_{UID}" / "strategy" / "active.md",
    )
    session.close()
    engine.dispose()


def make_strategy(**overrides):
    comprehensive = {
        "strategy_metadata": {
            "version": "2.0",
            "generated_at": "2026-09-09T09:00:00",
            "grounding_status": "grounded",
        },
        "base_strategy": {"pillars": ["ownership"]},
        "strategic_insights": {"top": "differentiate on trust"},
        "competitive_analysis": {"competitors": ["A", "B"]},
        "performance_predictions": {"6m_views": 50000},
        "implementation_roadmap": {"q1": ["brand audit"]},
        "risk_assessment": {"risks": ["bandwidth"]},
    }
    data = dict(
        id=7,
        name="Growth Plan",
        industry="SaaS",
        business_objectives=["grow", "retain"],
        content_budget=5000.0,
        team_size=3,
        brand_voice="bold",
        comprehensive_ai_analysis=comprehensive,
    )
    data.update(overrides)
    return data


def _expected_chunk_ids(strategy=None):
    return [f"user:{UID}:strategy_active:current:{k}" for k in
            ("form_summary", "base_strategy", "strategic_insights",
             "competitive_analysis", "performance_predictions",
             "implementation_roadmap", "risk_assessment", "user_persona_digest")]


def _watermark_row(session):
    return (
        session.query(SIFIndexingWatermark)
        .filter(SIFIndexingWatermark.user_id == UID)
        .one_or_none()
    )


def _dispatch_and_await(ctx, strategy=None, activation=ACTIVATION):
    from services.intelligence.strategy_vfs_companion import dispatch_activation_indexing

    strategy = strategy or make_strategy()

    async def _go():
        task = dispatch_activation_indexing(ctx.session, UID, strategy, activation)
        assert task is not None
        return await task

    return asyncio.run(_go())


class TestDispatchE2E:
    def test_full_pipeline_indexes_eight_docs_and_stamps_watermark(self, ctx, monkeypatch):
        monkeypatch.setattr(WORKSPACE_ROOT, lambda: ctx.workspace)
        monkeypatch.setattr(SIF_FACTORY_PATH, ctx.sif_factory)

        count = _dispatch_and_await(ctx)
        assert count == 8
        service = ctx.sif_factory.instances[0]
        ids = [c[0] for c in service.calls[0]]
        assert ids == _expected_chunk_ids()
        assert len(ids) == len(set(ids)) == 8

        row = _watermark_row(ctx.session)
        assert row is not None
        assert row.source_id == "user:user-42:strategy_active:current"
        assert row.embedding_count == 8
        assert len(row.source_hash) == 64
        int(row.source_hash, 16)

    def test_unchanged_reactivation_is_skipped(self, ctx, monkeypatch):
        monkeypatch.setattr(WORKSPACE_ROOT, lambda: ctx.workspace)
        monkeypatch.setattr(SIF_FACTORY_PATH, ctx.sif_factory)

        first = _dispatch_and_await(ctx)
        second = _dispatch_and_await(ctx)
        assert first == 8
        assert second == 0
        assert len(ctx.sif_factory.instances[0].calls) == 1
        assert _watermark_row(ctx.session).embedding_count == 8

    def test_changed_reactivation_replaces_in_place(self, ctx, monkeypatch):
        monkeypatch.setattr(WORKSPACE_ROOT, lambda: ctx.workspace)
        monkeypatch.setattr(SIF_FACTORY_PATH, ctx.sif_factory)

        _dispatch_and_await(ctx)
        changed = make_strategy(business_objectives=["only-ads"])
        second = _dispatch_and_await(ctx, strategy=changed)
        assert second == 8

        assert len(ctx.sif_factory.instances) == 2, "changed reactivation must re-embed"
        first_ids = [c[0] for c in ctx.sif_factory.instances[0].calls[0]]
        second_ids = [c[0] for c in ctx.sif_factory.instances[1].calls[0]]
        assert first_ids == second_ids, "re-activation must upsert the same doc ids"

        row = _watermark_row(ctx.session)
        assert row.embedding_count == 8
        assert row.source_hash == compute_strategy_source_hash(UID, changed, ACTIVATION)

    def test_vfs_mirror_exists_after_dispatch(self, ctx, monkeypatch):
        monkeypatch.setattr(WORKSPACE_ROOT, lambda: ctx.workspace)
        monkeypatch.setattr(SIF_FACTORY_PATH, ctx.sif_factory)

        _dispatch_and_await(ctx)
        assert ctx.active_md.exists()
        content = ctx.active_md.read_text(encoding="utf-8")
        assert "# Active Content Strategy" in content
        assert "- strategy_id: 7" in content


class TestHttpE2E:
    def test_http_activation_commits_and_invokes_hook(self, ctx, monkeypatch):
        from api.content_planning.api.content_strategy.endpoints.strategy_wizard_endpoints import router
        from middleware.auth_middleware import get_current_user

        monkeypatch.setattr(WORKSPACE_ROOT, lambda: ctx.workspace)

        row = EnhancedContentStrategy()
        row.id = 7
        row.user_id = str(NUMERIC_UID)
        row.name = "Growth Plan"
        row.industry = "SaaS"
        row.business_objectives = ["grow"]
        row.comprehensive_ai_analysis = make_strategy()["comprehensive_ai_analysis"]
        ctx.session.add(row)
        ctx.session.commit()

        captured = {}

        def _dispatch(db_arg, user_id, strategy_data, activation_date, sif_service=None):
            captured["db"] = db_arg
            captured["user_id"] = user_id
            captured["data"] = strategy_data
            captured["activation_date"] = activation_date

        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_current_user] = lambda: {
            "id": str(NUMERIC_UID), "uid": str(NUMERIC_UID),
            "clerk_user_id": str(NUMERIC_UID), "email": "t@e.com", "is_active": True,
        }

        monkeypatch.setattr(f"{ENDPOINT_MOD}.get_session_for_user", lambda user_id: ctx.session)
        monkeypatch.setattr(DISPATCH_TARGET, _dispatch)
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/strategy/activate", json={"strategy_id": 7})

        assert resp.status_code == 200, resp.text
        assert captured["data"]["id"] == 7
        assert captured["activation_date"] is not None

        verify = ctx.Session()
        try:
            status_row = (
                verify.query(StrategyActivationStatus)
                .filter(StrategyActivationStatus.user_id == NUMERIC_UID,
                        StrategyActivationStatus.strategy_id == 7)
                .one_or_none()
            )
        finally:
            verify.close()
        assert status_row is not None
        assert status_row.status == "active"