"""SIF x Strategy integration — Phase 5: startup backfill (unit tests).

Strategy backfill catches users whose strategy was activated BEFORE the
SIF x Strategy indexing feature shipped (so it was never embedded). It
runs at server startup, is flag-gated, and is strictly best-effort.

These tests prove:

- ``active_strategy_for_user`` mirrors the ``GET /strategy/current`` SSOT
  query (latest ``'active'`` activation row + its strategy snapshot).
- ``strategy_is_indexed`` is a pure watermark-existence predicate for the
  active-strategy source id (the shared "already indexed?" signal).
- ``dispatch_strategy_backfill`` enumerates users, skips already-indexed /
  no-active users, and dispatches the SAME post-activation pipeline as a
  real activation for the rest — reporting scanned/dispatched / already
  indexed / no-active / errors, honoring ``limit``, never raising per-user.
- Every outcome is metered via ``sif_strategy_backfill_total``.
- ``run_startup_backfill`` (the app.py startup entry) never raises.
"""
from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from models.enhanced_strategy_models import EnhancedContentStrategy
from models.monitoring_models import StrategyActivationStatus
from models.sif_indexing_watermark import SIFIndexingWatermark
from services.intelligence import strategy_backfill as backfill
from services.intelligence.sif_strategy_source_ids import active_strategy_source_id

UID = "42"
NUMERIC_UID = 42
ACTIVATION = datetime(2026, 9, 9, 10, 0, 0)
ENABLED_TARGET = "services.intelligence.strategy_indexer.strategy_sif_indexing_enabled"
DISPATCH_TARGET = "services.intelligence.strategy_vfs_companion.dispatch_activation_indexing"


def _comprehensive():
    return {
        "strategy_metadata": {
            "version": "2.0",
            "generated_at": "2026-09-09T09:00:00",
            "grounding_status": "grounded",
        },
        "base_strategy": {"pillars": ["ownership"]},
        "strategic_insights": {"top": "differentiate on trust"},
        "competitive_analysis": {"competitors": ["A"]},
        "performance_predictions": {"6m_views": 50000},
        "implementation_roadmap": {"q1": ["brand audit"]},
        "risk_assessment": {"risks": ["bandwidth"]},
    }


@pytest.fixture()
def ctx():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SIFIndexingWatermark.__table__.create(engine)
    StrategyActivationStatus.__table__.create(engine)
    EnhancedContentStrategy.__table__.create(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _seed_active_strategy(ctx, *, user_id=UID, uid=NUMERIC_UID, strategy_id=7,
                          status="active", activation_date=ACTIVATION):
    strategy = EnhancedContentStrategy()
    strategy.id = strategy_id
    strategy.user_id = str(uid) if uid is not None else user_id
    strategy.name = "Growth Plan"
    strategy.industry = "SaaS"
    strategy.business_objectives = ["grow"]
    strategy.comprehensive_ai_analysis = _comprehensive()
    ctx.add(strategy)
    ctx.add(StrategyActivationStatus(
        strategy_id=strategy_id,
        user_id=user_id,
        status=status,
        activation_date=activation_date,
    ))
    ctx.commit()
    return strategy


def _seed_watermark(ctx, *, user_id=UID, source_id=None, source_hash="a" * 64):
    row = SIFIndexingWatermark(
        user_id=user_id,
        source_id=source_id or active_strategy_source_id(user_id),
        source_hash=source_hash,
        embedding_count=8,
        notes="seed",
    )
    ctx.add(row)
    ctx.commit()
    return row


def _make_recorder(store):
    def _dispatch(db, user_id, strategy_data, activation_date, sif_service=None):
        store.append((db, user_id, strategy_data, activation_date))
        return None

    return _dispatch


class TestActiveStrategyForUser:
    def test_returns_snapshot_for_active_strategy(self, ctx):
        _seed_active_strategy(ctx)
        snap = backfill.active_strategy_for_user(ctx, UID)
        assert snap is not None
        assert snap["strategy"]["id"] == 7
        assert snap["strategy"]["name"] == "Growth Plan"
        assert snap["activated_at"] == "2026-09-09T10:00:00"

    def test_none_when_no_active_row(self, ctx):
        assert backfill.active_strategy_for_user(ctx, UID) is None

    def test_none_when_only_inactive_rows(self, ctx):
        _seed_active_strategy(ctx, status="inactive")
        assert backfill.active_strategy_for_user(ctx, UID) is None

    def test_none_when_strategy_row_missing(self, ctx):
        ctx.add(StrategyActivationStatus(
            strategy_id=999, user_id=NUMERIC_UID, status="active",
            activation_date=ACTIVATION,
        ))
        ctx.commit()
        assert backfill.active_strategy_for_user(ctx, UID) is None

    def test_none_when_user_id_matches_no_row(self, ctx):
        _seed_active_strategy(ctx)
        assert backfill.active_strategy_for_user(ctx, "not-a-number") is None

    def test_resolves_active_strategy_for_raw_string_clerk_id(self, ctx):
        _seed_active_strategy(
            ctx, user_id="user_str_abc123", uid=None, strategy_id=8
        )
        snap = backfill.active_strategy_for_user(ctx, "user_str_abc123")
        assert snap is not None
        assert snap["strategy"]["id"] == 8
        assert snap["strategy"]["name"] == "Growth Plan"

    def test_numeric_legacy_row_still_resolves_from_string_uid(self, ctx):
        _seed_active_strategy(ctx)
        snap = backfill.active_strategy_for_user(ctx, UID)
        assert snap is not None
        assert snap["strategy"]["id"] == 7


class TestStrategyIsIndexed:
    def test_true_when_watermark_exists(self, ctx):
        _seed_watermark(ctx)
        assert backfill.strategy_is_indexed(ctx, UID) is True

    def test_false_when_no_watermark(self, ctx):
        assert backfill.strategy_is_indexed(ctx, UID) is False

    def test_ignores_other_sources(self, ctx):
        _seed_watermark(ctx, source_id="onboarding:user-42:strategy")
        assert backfill.strategy_is_indexed(ctx, UID) is False


class TestDispatchBackfill:
    def _patch_foundation(self, monkeypatch, user_ids=("user-42",), session=None):
        dispatches = []
        monkeypatch.setattr(
            "services.database.sessions.get_all_user_ids",
            lambda: user_ids,
        )
        monkeypatch.setattr(
            "services.database.sessions.get_session_for_user",
            lambda uid: session,
        )

        def _dispatch(db, user_id, strategy_data, activation_date, sif_service=None):
            dispatches.append((db, user_id, strategy_data, activation_date))
            return None

        monkeypatch.setattr(DISPATCH_TARGET, _dispatch)
        monkeypatch.setattr(ENABLED_TARGET, lambda: True)
        return dispatches

    def test_disabled_flag_short_circuits(self, monkeypatch):
        monkeypatch.setattr(ENABLED_TARGET, lambda: False)

        def _explode():
            raise AssertionError("user discovery must not run when disabled")

        monkeypatch.setattr("services.database.sessions.get_all_user_ids", _explode)
        report = backfill.dispatch_strategy_backfill()
        assert report["disabled"] is True
        assert report["scanned"] == 0
        assert report["dispatched"] == 0
        assert report["errors"] == 0

    def test_dispatches_pre_feature_activations(self, ctx, monkeypatch):
        _seed_active_strategy(ctx)
        dispatches = self._patch_foundation(monkeypatch, user_ids=[UID], session=ctx)

        report = backfill.dispatch_strategy_backfill()

        assert report["disabled"] is False
        assert report["scanned"] == 1
        assert report["dispatched"] == 1
        assert report["already_indexed"] == 0
        assert report["errors"] == 0
        assert len(dispatches) == 1
        db, user_id, strategy_data, activation_date = dispatches[0]
        assert db is ctx
        assert user_id == UID
        assert strategy_data["id"] == 7
        assert activation_date == "2026-09-09T10:00:00"

    def test_skips_already_indexed_users(self, ctx, monkeypatch):
        _seed_active_strategy(ctx)
        _seed_watermark(ctx)
        dispatches = self._patch_foundation(monkeypatch, user_ids=[UID], session=ctx)

        report = backfill.dispatch_strategy_backfill()

        assert report["scanned"] == 1
        assert report["dispatched"] == 0
        assert report["already_indexed"] == 1
        assert dispatches == []

    def test_skips_users_without_active_strategy(self, ctx, monkeypatch):
        dispatches = self._patch_foundation(monkeypatch, user_ids=[UID], session=ctx)

        report = backfill.dispatch_strategy_backfill()

        assert report["scanned"] == 1
        assert report["dispatched"] == 0
        assert report["no_active_strategy"] == 1
        assert dispatches == []

    def test_per_user_errors_do_not_stop_the_pass(self, ctx, monkeypatch):
        _seed_active_strategy(ctx, user_id="1", uid=1, strategy_id=10)
        calls = []

        def _sessions(user_id):
            if user_id == "3":
                raise RuntimeError("boom")
            return ctx

        self._patch_foundation(
            monkeypatch, user_ids=["3", "1"], session=ctx,
        )
        monkeypatch.setattr(
            "services.database.sessions.get_session_for_user", _sessions,
        )
        monkeypatch.setattr(DISPATCH_TARGET, _make_recorder(calls))

        report = backfill.dispatch_strategy_backfill()

        assert report["scanned"] == 2
        assert report["errors"] == 1
        assert report["dispatched"] == 1
        assert len(calls) == 1
        assert calls[0][1] == "1"

    def test_limit_caps_the_scan(self, ctx, monkeypatch):
        monkeypatch.setattr(
            "services.database.sessions.get_all_user_ids",
            lambda: ["1", "2"],
        )
        monkeypatch.setattr(
            "services.database.sessions.get_session_for_user",
            lambda uid: ctx,
        )
        monkeypatch.setattr(ENABLED_TARGET, lambda: True)

        report = backfill.dispatch_strategy_backfill(limit=1)

        assert report["scanned"] == 1
        assert report["no_active_strategy"] == 1
        assert report["errors"] == 0
        assert report["dispatched"] == 0

    def test_outcomes_are_metered(self, ctx, monkeypatch):
        _seed_active_strategy(ctx, user_id="1", uid=1, strategy_id=10)
        _seed_active_strategy(ctx, user_id="2", uid=2, strategy_id=11)
        _seed_watermark(ctx, user_id="2")
        calls = []

        def _sessions(user_id):
            if user_id == "3":
                raise RuntimeError("boom")
            return ctx

        self._patch_foundation(
            monkeypatch, user_ids=["1", "2", "3"],
        )
        monkeypatch.setattr(
            "services.database.sessions.get_session_for_user", _sessions,
        )
        monkeypatch.setattr(DISPATCH_TARGET, _make_recorder([]))
        monkeypatch.setattr(
            "services.intelligence.sif_metrics.inc_counter",
            lambda metric, outcome, value=1: calls.append(("inc", metric, outcome)),
        )
        monkeypatch.setattr(
            "services.intelligence.sif_metrics.log_sif_event",
            lambda *a, **k: calls.append(("log", a[0], k.get("outcome"))),
        )

        report = backfill.dispatch_strategy_backfill()

        assert report == {
            "disabled": False, "scanned": 3, "dispatched": 1,
            "already_indexed": 1, "no_active_strategy": 0, "errors": 1,
        }
        incs = [c for c in calls if c[0] == "inc"]
        assert ("inc", "sif_strategy_backfill_total", "dispatched") in incs
        assert ("inc", "sif_strategy_backfill_total", "already_indexed") in incs
        assert ("inc", "sif_strategy_backfill_total", "error") in incs
        logs = [c for c in calls if c[0] == "log"]
        assert {"dispatched", "already_indexed", "error"} == {c[2] for c in logs}


class TestRunStartupBackfill:
    def test_invokes_dispatch_and_never_raises(self, monkeypatch):
        seen = {}

        def _dispatch():
            seen["called"] = True
            return {"disabled": False, "scanned": 2, "dispatched": 1,
                    "already_indexed": 1, "no_active_strategy": 0, "errors": 0}

        monkeypatch.setattr(backfill, "dispatch_strategy_backfill", _dispatch)
        backfill.run_startup_backfill()
        assert seen.get("called") is True

    def test_swallows_dispatch_failure(self, monkeypatch):
        def _dispatch():
            raise RuntimeError("boom")

        monkeypatch.setattr(backfill, "dispatch_strategy_backfill", _dispatch)
        backfill.run_startup_backfill()