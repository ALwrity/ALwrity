"""Phase 3c: scheduler dashboard monitoring-task block (real SQLite, no mocks).

Replicates the exact query from the /dashboard monitoring block and asserts:
user isolation via the strategy join, status filter, and per-type cap.
"""
from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models.base import Base
from models.enhanced_strategy_models import EnhancedContentStrategy
from models.monitoring_models import MonitoringTask


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def _strategy(db, user_id, name="S"):
    s = EnhancedContentStrategy(user_id=user_id, name=name)
    db.add(s)
    db.flush()
    return s


def _task(db, strategy_id, status, title="T"):
    t = MonitoringTask(
        strategy_id=strategy_id, component_name="Strategic Insights",
        task_title=title, task_description="d", assignee="ALwrity",
        frequency="Weekly", metric="gsc.ctr",
        measurement_method="services.seo_tools.gsc_analyzer_service."
        "GSCAnalyzerService.analyze_search_performance",
        success_criteria="x", alert_threshold="y", status=status,
        next_execution=datetime.utcnow() + timedelta(days=7),
    )
    db.add(t)
    db.flush()
    return t


def _dashboard_query(db, user_id_str, limit):
    # Exact replica of the monitoring block in scheduler_dashboard_core.py
    q = (
        db.query(MonitoringTask, EnhancedContentStrategy.user_id)
        .join(EnhancedContentStrategy,
              MonitoringTask.strategy_id == EnhancedContentStrategy.id)
        .filter(MonitoringTask.status.in_(
            ['active', 'pending', 'failed', 'paused']))
    )
    if user_id_str:
        q = q.filter(EnhancedContentStrategy.user_id == user_id_str)
    return q.limit(limit).all()


def test_user_isolation_and_status_filter():
    db = _session()
    s1 = _strategy(db, "u1")
    s2 = _strategy(db, "u2")
    t_active = _task(db, s1.id, "active", "A")
    _task(db, s1.id, "pending", "P")
    _task(db, s1.id, "failed", "F")
    _task(db, s1.id, "completed", "C")  # excluded: terminal
    _task(db, s2.id, "active", "OTHER")  # excluded: other user
    db.commit()

    rows = _dashboard_query(db, "u1", 100)
    titles = sorted(t.task_title for t, _ in rows)
    assert titles == ["A", "F", "P"]
    assert {owner for _, owner in rows} == {"u1"}
    assert t_active.id in [t.id for t, _ in rows]
    db.close()


def test_per_type_cap():
    db = _session()
    s = _strategy(db, "u1")
    for i in range(5):
        _task(db, s.id, "active", f"T{i}")
    db.commit()
    assert len(_dashboard_query(db, "u1", 3)) == 3
    db.close()


def test_entry_shape_matches_helper_contract():
    from api.scheduler_dashboard_core import _build_db_task_entry
    db = _session()
    s = _strategy(db, "u1")
    t = _task(db, s.id, "active", "A")
    db.commit()
    entry = _build_db_task_entry(
        task_id_prefix='monitoring', user_id="u1", task_db_id=t.id,
        trigger_type='CronTrigger', next_execution_attr='next_execution',
        task=t, user_job_store='default',
        function_name='monitoring_task_executor.execute_task',
        frequency=t.frequency, task_category='strategy_monitoring',
        extra={'strategy_id': t.strategy_id, 'metric': t.metric,
               'assignee': t.assignee, 'status': t.status,
               'last_executed': None},
    )
    assert entry["id"] == f"monitoring_u1_{t.id}"
    assert entry["is_database_task"] is True
    assert entry["source"] == "database_task"
    assert entry["task_category"] == "strategy_monitoring"
    assert entry["metric"] == "gsc.ctr"
    db.close()
