"""Phase: Monitoring Evidence — strategy-monitoring evidence for agent meetings.

Real SQLite, no mocks. Asserts the envelope contract: truthful DB-derived
signals only; inactive/error states never fabricated.
"""
from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models.base import Base
from models.enhanced_strategy_models import EnhancedContentStrategy
from models.monitoring_models import (
    MonitoringTask,
    StrategyActivationStatus,
    TaskExecutionLog,
)


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def _strategy(db, user_id, name="S"):
    s = EnhancedContentStrategy(user_id=user_id, name=name)
    db.add(s)
    db.flush()
    return s


def _activate(db, strategy_id, user_id):
    a = StrategyActivationStatus(
        strategy_id=strategy_id, user_id=user_id, status="active"
    )
    db.add(a)
    db.flush()
    return a


def _task(db, strategy_id, assignee="ALwrity", title="T", metric="gsc.ctr",
          status="active", next_execution=None):
    t = MonitoringTask(
        strategy_id=strategy_id, component_name="Strategic Insights",
        task_title=title, task_description="d", assignee=assignee,
        frequency="Weekly", metric=metric,
        measurement_method="services.seo_tools.gsc_analyzer_service."
        "GSCAnalyzerService.analyze_search_performance",
        success_criteria="x", alert_threshold="y", status=status,
        next_execution=next_execution,
    )
    db.add(t)
    db.flush()
    return t


def _log(db, task_id, user_id, status="success", error=None, minutes_ago=10,
         result_data=None):
    l = TaskExecutionLog(
        task_id=task_id, user_id=user_id, status=status,
        error_message=error, result_data=result_data,
        execution_date=datetime.utcnow() - timedelta(minutes=minutes_ago),
    )
    db.add(l)
    db.flush()
    return l


def test_no_active_strategy_returns_inactive_envelope():
    from services.monitoring_evidence import build_strategy_monitoring_evidence
    db = _session()
    s = _strategy(db, "u1")
    _task(db, s.id, status="active")  # task exists but strategy NOT activated
    db.commit()

    out = build_strategy_monitoring_evidence(db, "u1")
    assert out["status"] == "inactive"
    assert out["strategy_id"] is None
    assert out["overall"] is None
    assert out["success_rate"] is None
    assert out["failed_tasks"] == []
    assert out["overdue_tasks"] == []
    assert out["human_pending"] == []
    db.close()


def test_active_strategy_only_that_users_tasks():
    from services.monitoring_evidence import build_strategy_monitoring_evidence
    db = _session()
    s1 = _strategy(db, "u1", "Mine")
    s2 = _strategy(db, "u2", "Theirs")
    _activate(db, s1.id, "u1")
    _activate(db, s2.id, "u2")
    t1 = _task(db, s1.id, title="MyTask")
    _task(db, s2.id, title="TheirTask")
    _log(db, t1.id, "u1", status="success")
    db.commit()

    out = build_strategy_monitoring_evidence(db, "u1")
    assert out["strategy_id"] == s1.id
    titles = {t["title"] for t in out["tasks"]}
    assert titles == {"MyTask"}
    assert out["success_rate"] == 1.0
    db.close()


def test_healthy_all_success_no_overdue():
    from services.monitoring_evidence import build_strategy_monitoring_evidence
    db = _session()
    s = _strategy(db, "u1")
    _activate(db, s.id, "u1")
    t1 = _task(db, s.id, title="A")
    t2 = _task(db, s.id, title="B")
    _log(db, t1.id, "u1", status="success")
    _log(db, t2.id, "u1", status="success")
    db.commit()

    out = build_strategy_monitoring_evidence(db, "u1")
    assert out["status"] == "available"
    assert out["overall"] == "healthy"
    assert out["success_rate"] == 1.0
    assert out["byResult"] == {"success": 2}
    assert out["failed_tasks"] == []
    db.close()


def test_down_with_failed_tasks_carries_error():
    from services.monitoring_evidence import build_strategy_monitoring_evidence
    db = _session()
    s = _strategy(db, "u1")
    _activate(db, s.id, "u1")
    a = _task(db, s.id, title="VisCheck", metric="gsc.ctr")
    b = _task(db, s.id, title="Sitemap")
    _log(db, a.id, "u1", status="failed", error="GSC 403 quota")
    _log(db, b.id, "u1", status="success")
    db.commit()

    out = build_strategy_monitoring_evidence(db, "u1")
    assert out["status"] == "available"
    assert out["overall"] == "down"  # 1 of 2 failed -> >= 0.5 ratio
    assert out["success_rate"] == 0.5
    assert len(out["failed_tasks"]) == 1
    failed = out["failed_tasks"][0]
    assert failed["title"] == "VisCheck"
    assert failed["metric"] == "gsc.ctr"
    assert failed["error_message"] == "GSC 403 quota"
    db.close()


def test_overdue_and_human_pending_signals():
    from services.monitoring_evidence import build_strategy_monitoring_evidence
    db = _session()
    s = _strategy(db, "u1")
    _activate(db, s.id, "u1")
    overdue = _task(db, s.id, title="Overdue",
                    next_execution=datetime.utcnow() - timedelta(hours=2))
    _log(db, overdue.id, "u1", status="success")
    human = _task(db, s.id, assignee="Human", title="HumanReview", status="active")
    db.commit()

    out = build_strategy_monitoring_evidence(db, "u1")
    assert [t["title"] for t in out["overdue_tasks"]] == ["Overdue"]
    assert [t["title"] for t in out["human_pending"]] == ["HumanReview"]
    # Overdue present -> overall degrades, even with zero failures
    assert out["overall"] == "degraded"
    db.close()


def test_db_error_returns_error_envelope_not_raise():
    from services.monitoring_evidence import build_strategy_monitoring_evidence

    class _BrokenDB:
        def query(self, *_a, **_k):
            raise RuntimeError("session exploded")

    out = build_strategy_monitoring_evidence(_BrokenDB(), "u1")
    assert out["status"] == "error"
    assert out["strategy_id"] is None
    assert any("session exploded" in lim for lim in out.get("limitations", []))


def test_envelope_carries_kpi_last_values_from_success_tool_result():
    from services.monitoring_evidence import build_strategy_monitoring_evidence
    db = _session()
    s = _strategy(db, "u1")
    _activate(db, s.id, "u1")
    t = _task(db, s.id, title="CtrCheck", metric="gsc.ctr")
    _log(db, t.id, "u1", status="success",
         result_data={"metric": "gsc.ctr",
                      "tool_result": {"performance_overview": {"overall_ctr": 2.75}}})
    db.commit()

    out = build_strategy_monitoring_evidence(db, "u1")
    assert out["status"] == "available"
    assert out["kpi_last_values"].get("gsc.ctr") == 2.75
    db.close()


def test_envelope_kpi_last_values_empty_on_failed_or_missing():
    from services.monitoring_evidence import build_strategy_monitoring_evidence
    db = _session()
    s = _strategy(db, "u1")
    _activate(db, s.id, "u1")
    t = _task(db, s.id, title="CtrCheck", metric="gsc.ctr")
    _log(db, t.id, "u1", status="failed", error="boom",
         result_data={"metric": "gsc.ctr",
                      "tool_result": {"performance_overview": {"overall_ctr": 9.0}}})
    db.commit()

    out = build_strategy_monitoring_evidence(db, "u1")
    assert out["status"] == "available"
    assert out["kpi_last_values"] == {}
    db.close()


def test_inactive_envelope_has_kpi_last_values_key():
    from services.monitoring_evidence import build_strategy_monitoring_evidence
    db = _session()
    _strategy(db, "u1")
    db.commit()
    out = build_strategy_monitoring_evidence(db, "u1")
    assert "kpi_last_values" in out
    assert out["kpi_last_values"] == {}
    db.close()