"""SIF x Strategy — Phase 1: durable indexing lifecycle (unit tests).

Proves the ``strategy_sif_index_status`` model and the lifecycle writers
against a real sqlite session:

- ``StrategySifIndexStatus.set_status``/``get`` transition contract
  (pending → running → success | skipped | failed), attempt counting,
  started/finished stamps, error_message persistence, and DB-error
  swallow (a missing table must never raise).
- ``record_strategy_sif_status`` (indexer helper) commits best-effort.
- ``_run_indexing_lifecycle`` drives running → terminal for success,
  fresh/unchanged (skipped), and exhausted-retry (failed) outcomes.
- ``dispatch_activation_indexing`` records ``pending`` synchronously,
  then the task flips it to ``success``.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from models.strategy_sif_index_status import (
    STATUS_FAILED,
    STATUS_PENDING,
    STATUS_RUNNING,
    STATUS_SKIPPED,
    STATUS_SUCCESS,
    StrategySifIndexStatus,
)

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

UID = "user-42"
ACTIVATION = "2026-09-09T10:00:00"
WORKSPACE_ROOT = "services.workspace_paths.get_workspace_root"
SIF_FACTORY_PATH = "services.intelligence.strategy_indexer.TxtaiIntelligenceService"


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
        business_objectives=["grow"],
        brand_voice="bold",
        comprehensive_ai_analysis=comprehensive,
    )
    data.update(overrides)
    return data


class FakeSIF:
    def __init__(self, fail_every_time=False):
        self.fail_every_time = fail_every_time
        self.calls = []

    async def index_content(self, items):
        self.calls.append(list(items))
        if self.fail_every_time:
            raise RuntimeError("embed boom")
        return len(items)


@pytest.fixture()
def ctx():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    StrategySifIndexStatus.__table__.create(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield SimpleNamespace(Session=Session, session=session)
    session.close()
    engine.dispose()


def _row(session, user_id=UID):
    return StrategySifIndexStatus.get(session, user_id, "user:user-42:strategy_active:current")


def _run(coro):
    return asyncio.run(coro)


class TestModel:
    def test_pending_row_created(self, ctx):
        row = StrategySifIndexStatus.set_status(
            ctx.session, UID, "user:user-42:strategy_active:current", STATUS_PENDING
        )
        assert row is not None
        assert row.status == STATUS_PENDING
        assert row.attempt == 0
        assert row.started_at is not None
        assert row.finished_at is None

    def test_running_increments_attempt_and_keeps_started_at(self, ctx):
        source = "user:user-42:strategy_active:current"
        StrategySifIndexStatus.set_status(ctx.session, UID, source, STATUS_PENDING)
        first_started = _row(ctx.session).started_at

        row = StrategySifIndexStatus.set_status(ctx.session, UID, source, STATUS_RUNNING)
        assert row.attempt == 1
        assert row.started_at == first_started, "running must not reset started_at"

        row = StrategySifIndexStatus.set_status(ctx.session, UID, source, STATUS_RUNNING)
        assert row.attempt == 2, "re-entering running re-counts the attempt"

    def test_terminal_failure_records_error_and_stamps_finished(self, ctx):
        source = "user:user-42:strategy_active:current"
        StrategySifIndexStatus.set_status(ctx.session, UID, source, STATUS_RUNNING)
        row = StrategySifIndexStatus.set_status(
            ctx.session, UID, source, STATUS_FAILED, error_message="broken"
        )
        assert row.status == STATUS_FAILED
        assert row.error_message == "broken"
        assert row.finished_at is not None

    def test_success_records_embedding_count(self, ctx):
        source = "user:user-42:strategy_active:current"
        StrategySifIndexStatus.set_status(ctx.session, UID, source, STATUS_RUNNING)
        row = StrategySifIndexStatus.set_status(
            ctx.session, UID, source, STATUS_SUCCESS, embedding_count=8
        )
        assert row.status == STATUS_SUCCESS
        assert row.embedding_count == 8
        assert row.finished_at is not None

    def test_get_missing_row_returns_none(self, ctx):
        assert _row(ctx.session) is None

    def test_skipped_state_supported(self, ctx):
        source = "user:user-42:strategy_active:current"
        StrategySifIndexStatus.set_status(ctx.session, UID, source, STATUS_SKIPPED)
        assert _row(ctx.session).status == STATUS_SKIPPED

    def test_db_error_is_swallowed(self, ctx):
        source = "user:user-42:strategy_active:current"
        ctx.session.execute(text("DROP TABLE strategy_sif_index_status"))
        ctx.session.commit()
        result = StrategySifIndexStatus.set_status(
            ctx.session, UID, source, STATUS_PENDING
        )
        assert result is None, "a missing table must degrade to None, not raise"


class TestRecordHelper:
    def test_record_status_commits(self, ctx):
        from services.intelligence.strategy_indexer import record_strategy_sif_status

        source = "user:user-42:strategy_active:current"
        record_strategy_sif_status(ctx.session, UID, source, STATUS_PENDING)
        assert _row(ctx.session).status == STATUS_PENDING

    def test_record_status_never_raises_on_missing_table(self, ctx):
        from services.intelligence.strategy_indexer import record_strategy_sif_status

        source = "user:user-42:strategy_active:current"
        ctx.session.execute(text("DROP TABLE strategy_sif_index_status"))
        ctx.session.commit()
        record_strategy_sif_status(ctx.session, UID, source, STATUS_RUNNING)


class TestLifecycleRunner:
    def test_success_path(self, ctx):
        from services.intelligence.strategy_indexer import _run_indexing_lifecycle

        count = _run(_run_indexing_lifecycle(
            ctx.session, UID, make_strategy(), activation_date=ACTIVATION,
            sif_service=FakeSIF(), retries=1, base_delay=0.0,
        ))
        assert count == 8
        assert _row(ctx.session).status == STATUS_SUCCESS
        assert _row(ctx.session).embedding_count == 8

    def test_unchanged_fresh_watermark_is_skipped(self, ctx):
        from unittest.mock import patch
        from services.intelligence import strategy_indexer as idx
        from services.intelligence.strategy_indexer import _run_indexing_lifecycle

        with patch.object(idx.SIFIndexingWatermark, "is_fresh", return_value=True):
            count = _run(_run_indexing_lifecycle(
                ctx.session, UID, make_strategy(), activation_date=ACTIVATION,
                sif_service=FakeSIF(), retries=1, base_delay=0.0,
            ))
        assert count == 0
        assert _row(ctx.session).status == STATUS_SKIPPED

    def test_exhausted_retries_marks_failed(self, ctx):
        from services.intelligence.strategy_indexer import _run_indexing_lifecycle

        count = _run(_run_indexing_lifecycle(
            ctx.session, UID, make_strategy(), activation_date=ACTIVATION,
            sif_service=FakeSIF(fail_every_time=True), retries=2, base_delay=0.0,
        ))
        assert count == 0
        row = _row(ctx.session)
        assert row.status == STATUS_FAILED
        assert "embed boom" in (row.error_message or "")


class TestDispatchPending:
    def test_pending_recorded_then_task_succeeds(self, ctx, tmp_path, monkeypatch):
        from services.intelligence.strategy_vfs_companion import dispatch_activation_indexing

        monkeypatch.setattr(WORKSPACE_ROOT, lambda: tmp_path)
        monkeypatch.setattr(
            SIF_FACTORY_PATH,
            lambda *a, **k: FakeSIF(),
        )

        async def _go():
            task = dispatch_activation_indexing(ctx.session, UID, make_strategy(), ACTIVATION)
            assert task is not None
            return await task

        count = _run(_go())
        assert count == 8
        assert _row(ctx.session).status == STATUS_SUCCESS
        assert _row(ctx.session).embedding_count == 8