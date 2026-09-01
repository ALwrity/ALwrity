from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from models.daily_workflow_models import Base, DailyWorkflowPlan, DailyWorkflowTask
from services.today_workflow_pillar import (
    PILLAR_BACKFILL_CADENCE_DAYS,
    _ensure_pillar_coverage,
    _get_last_backfill_dates,
    _is_backfill_due,
    _pillar_backfill_mode,
    count_template_fallback_tasks,
)

NOW = datetime.utcnow()


@pytest.fixture()
def db_engine(monkeypatch):
    # run_in_threadpool executes queries off-thread; share one connection
    # across threads so :memory: works.
    engine = create_engine(
        "sqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)

    import services.database as database_module

    monkeypatch.setattr(
        database_module, "get_session_for_user", lambda user_id: Session()
    )
    yield Session
    engine.dispose()


def _seed_plan(session, user_id="u1"):
    plan = DailyWorkflowPlan(user_id=user_id, date="2026-08-24")
    session.add(plan)
    session.commit()
    return plan


def _seed_task(session, plan, pillar_id, source, created_at, user_id="u1"):
    session.add(
        DailyWorkflowTask(
            plan_id=plan.id,
            user_id=user_id,
            pillar_id=pillar_id,
            title=f"task-{pillar_id}-{source}",
            description="x",
            metadata_json={"source": source},
            created_at=created_at,
            updated_at=created_at,
        )
    )
    session.commit()


class TestIsBackfillDue:
    def test_never_backfilled_is_due(self):
        assert _is_backfill_due(None, NOW)

    @pytest.mark.parametrize("age_days", [0, 1, 6])
    def test_recent_backfill_is_not_due(self, age_days):
        last = (NOW - timedelta(days=age_days)).isoformat()
        assert not _is_backfill_due(last, NOW)

    @pytest.mark.parametrize("age_days", [7, 8, 30])
    def test_old_backfill_is_due(self, age_days):
        last = (NOW - timedelta(days=age_days)).isoformat()
        assert _is_backfill_due(last, NOW)

    def test_unparseable_fails_open_to_due(self):
        assert _is_backfill_due("not-a-date", NOW)


class TestLastBackfillLookup:
    def test_only_backfill_sources_counted_newest_wins(self, db_engine):
        session = db_engine()
        plan = _seed_plan(session)
        _seed_task(session, plan, "plan", "llm_pillar_backfill", NOW - timedelta(days=1))
        _seed_task(session, plan, "plan", "controlled_fallback", NOW - timedelta(days=3))
        # Agent-sourced task must be ignored entirely.
        _seed_task(session, plan, "generate", "agent_proposal", NOW - timedelta(hours=1))
        session.close()

        import asyncio

        result = asyncio.run(_get_last_backfill_dates("u1"))

        assert set(result.keys()) == {"plan"}
        parsed = datetime.fromisoformat(result["plan"])
        assert abs((NOW - parsed).days) <= 2

    def test_lookup_failure_returns_empty(self, db_engine, monkeypatch):
        import services.database as database_module

        def boom(user_id):
            raise RuntimeError("db down")

        monkeypatch.setattr(database_module, "get_session_for_user", boom)

        import asyncio

        assert asyncio.run(_get_last_backfill_dates("u1")) == {}


class TestCoverageGating:
    @pytest.fixture()
    def pillar_module(self, monkeypatch):
        import services.today_workflow_pillar as pillar

        # Cadence gating only runs when backfill is explicitly enabled;
        # the suite default is ``off`` (honest absence).
        monkeypatch.setenv("TODAY_WORKFLOW_PILLAR_BACKFILL", "on")

        calls = {"built": []}

        def fake_build(user_id, date, pillar_id, grounding):
            calls["built"].append(pillar_id)
            return {
                "pillarId": pillar_id,
                "title": f"Backfill {pillar_id}",
                "description": "d",
                "priority": "medium",
                "estimatedTime": 15,
                "actionType": "navigate",
                "enabled": True,
            }

        monkeypatch.setattr(pillar, "_build_single_task_for_missing_pillar", fake_build)
        pillar.calls = calls
        return pillar

    @staticmethod
    def _stub_dates(pillar_module, monkeypatch, mapping):
        import services.today_workflow_pillar as pillar

        async def lookup(user_id, cadence_days=PILLAR_BACKFILL_CADENCE_DAYS):
            return mapping

        monkeypatch.setattr(pillar, "_get_last_backfill_dates", lookup)

    @pytest.mark.asyncio
    async def test_recently_backfilled_pillar_is_skipped(self, pillar_module, monkeypatch):
        self._stub_dates(
            pillar_module, monkeypatch, {"plan": (NOW - timedelta(days=2)).isoformat()}
        )

        result = await _ensure_pillar_coverage([], "u1", "2026-08-24", {})

        built = pillar_module.calls["built"]
        assert "plan" not in built
        assert "generate" in built
        assert all(t["pillarId"] != "plan" for t in result)

    @pytest.mark.asyncio
    async def test_stale_or_unknown_pillars_are_built(self, pillar_module, monkeypatch):
        self._stub_dates(
            pillar_module,
            monkeypatch,
            {
                "plan": (NOW - timedelta(days=9)).isoformat(),
                "generate": (NOW - timedelta(days=90)).isoformat(),
            },
        )

        result = await _ensure_pillar_coverage([], "u1", "2026-08-24", {})

        built = set(pillar_module.calls["built"])
        assert "plan" in built
        assert "generate" in built
        returned_pillars = {t["pillarId"] for t in result}
        assert {"plan", "generate"} <= returned_pillars

    @pytest.mark.asyncio
    async def test_cadence_failure_fails_open_to_generation(self, pillar_module, monkeypatch):
        """End-to-end: a DB failure inside the real lookup is caught, every
        pillar is treated as due, and coverage generation still runs."""
        import services.database as database_module

        def boom(user_id):
            raise RuntimeError("db down")

        monkeypatch.setattr(database_module, "get_session_for_user", boom)

        result = await _ensure_pillar_coverage([], "u1", "2026-08-24", {})

        # Every pillar was attempted despite the failed lookup.
        assert len(set(pillar_module.calls["built"])) == 6
        assert len(result) == 6

    @pytest.mark.asyncio
    async def test_guardrail_disabled_skips_cadence_and_build(self, pillar_module, monkeypatch):
        import services.today_workflow_pillar as pillar

        async def unexpected(*args, **kwargs):
            raise AssertionError("cadence lookup must not run when guardrail disabled")

        monkeypatch.setattr(pillar, "_get_last_backfill_dates", unexpected)

        result = await _ensure_pillar_coverage(
            [],
            "u1",
            "2026-08-24",
            {"workflow_config": {"disable_pillar_coverage_guardrail": True}},
        )

        assert result == []
        assert pillar_module.calls["built"] == []


class TestBackfillModeGate:
    @pytest.fixture()
    def pillar_module(self, monkeypatch):
        import services.today_workflow_pillar as pillar

        calls = {"built": []}
        built_source = {"source": "llm_pillar_backfill"}

        def fake_build(user_id, date, pillar_id, grounding):
            calls["built"].append(pillar_id)
            return {
                "pillarId": pillar_id,
                "title": f"Backfill {pillar_id}",
                "description": "d",
                "priority": "medium",
                "estimatedTime": 15,
                "actionType": "navigate",
                "enabled": True,
                "metadata": {
                    "source": built_source["source"],
                    "synthesis_mode": (
                        "template_fallback"
                        if built_source["source"] == "controlled_fallback"
                        else "llm"
                    ),
                },
            }

        monkeypatch.setattr(pillar, "_build_single_task_for_missing_pillar", fake_build)

        async def no_dates(user_id, cadence_days=PILLAR_BACKFILL_CADENCE_DAYS):
            return {}

        monkeypatch.setattr(pillar, "_get_last_backfill_dates", no_dates)
        pillar.calls = calls
        pillar.built_source = built_source
        return pillar

    def test_mode_defaults_to_off_on_invalid_value(self, monkeypatch):
        # Invalid values fall back to ``off`` so a typo can't silently enable
        # an invented-coverage cost path (honest absence is the default).
        monkeypatch.setenv("TODAY_WORKFLOW_PILLAR_BACKFILL", "sometimes")
        assert _pillar_backfill_mode() == "off"

    @pytest.mark.parametrize("value,expected", [("on", "on"), ("off", "off"), ("LLM_ONLY", "llm_only"), ("", "off")])
    def test_mode_reads_env(self, monkeypatch, value, expected):
        monkeypatch.setenv("TODAY_WORKFLOW_PILLAR_BACKFILL", value)
        assert _pillar_backfill_mode() == expected

    @pytest.mark.asyncio
    async def test_off_disables_coverage_entirely(self, pillar_module, monkeypatch):
        monkeypatch.setenv("TODAY_WORKFLOW_PILLAR_BACKFILL", "off")

        result = await _ensure_pillar_coverage([], "u1", "2026-08-24", {})

        assert result == []
        assert pillar_module.calls["built"] == []

    @pytest.mark.asyncio
    async def test_llm_only_keeps_llm_task(self, pillar_module, monkeypatch):
        monkeypatch.setenv("TODAY_WORKFLOW_PILLAR_BACKFILL", "llm_only")
        pillar_module.built_source["source"] = "llm_pillar_backfill"

        result = await _ensure_pillar_coverage([], "u1", "2026-08-24", {})

        assert len(result) == 6
        assert count_template_fallback_tasks(result) == 0

    @pytest.mark.asyncio
    async def test_llm_only_suppresses_template_task(self, pillar_module, monkeypatch):
        monkeypatch.setenv("TODAY_WORKFLOW_PILLAR_BACKFILL", "llm_only")
        pillar_module.built_source["source"] = "controlled_fallback"

        result = await _ensure_pillar_coverage([], "u1", "2026-08-24", {})

        assert result == []
        # Generation was attempted; the template output was dropped.
        assert len(pillar_module.calls["built"]) == 6


class TestTemplateFallbackCounter:
    def test_counts_only_template_fallback_metadata(self):
        tasks = [
            {"metadata": {"synthesis_mode": "llm"}},
            {"metadata": {"synthesis_mode": "template_fallback"}},
            {"metadata": {}},
            {},
            None,
        ]
        assert count_template_fallback_tasks(tasks) == 1

    def test_non_list_input_is_zero(self):
        assert count_template_fallback_tasks(None) == 0
