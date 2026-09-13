"""Phase 0: shared active-strategy resolver (TDD).

``strategy_common.resolve_active_strategy`` will back both
``monitoring_evidence`` and ``strategy_context`` — the single source of
truth for "which strategy is active for this user right now".
"""
from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models.base import Base
from models.enhanced_strategy_models import EnhancedContentStrategy
from models.monitoring_models import StrategyActivationStatus


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def _strategy(db, user_id, name="S"):
    s = EnhancedContentStrategy(user_id=user_id, name=name)
    db.add(s)
    db.flush()
    return s


def _activate(db, strategy_id, user_id, when=None, status="active"):
    a = StrategyActivationStatus(
        strategy_id=strategy_id, user_id=user_id, status=status,
        activation_date=when or datetime.utcnow(),
    )
    db.add(a)
    db.flush()
    return a


def test_resolves_latest_active_for_user():
    from services.strategy_common import resolve_active_strategy
    db = _session()
    s = _strategy(db, "u1")
    _activate(db, s.id, "u1", when=datetime.utcnow() - timedelta(days=5))
    db.commit()
    assert resolve_active_strategy(db, "u1") == s.id
    db.close()


def test_latest_activation_wins():
    from services.strategy_common import resolve_active_strategy
    db = _session()
    older = _strategy(db, "u1", "older")
    newer = _strategy(db, "u1", "newer")
    _activate(db, older.id, "u1", when=datetime.utcnow() - timedelta(days=10))
    _activate(db, newer.id, "u1", when=datetime.utcnow() - timedelta(days=1))
    db.commit()
    assert resolve_active_strategy(db, "u1") == newer.id
    db.close()


def test_user_isolation():
    from services.strategy_common import resolve_active_strategy
    db = _session()
    a = _strategy(db, "u1")
    b = _strategy(db, "u2")
    _activate(db, a.id, "u1")
    _activate(db, b.id, "u2")
    db.commit()
    assert resolve_active_strategy(db, "u1") == a.id
    assert resolve_active_strategy(db, "u2") == b.id
    db.close()


def test_no_active_returns_none():
    from services.strategy_common import resolve_active_strategy
    db = _session()
    s = _strategy(db, "u1")
    _activate(db, s.id, "u1", status="inactive")
    db.commit()
    assert resolve_active_strategy(db, "u1") is None
    db.close()


def test_no_activation_rows_returns_none():
    from services.strategy_common import resolve_active_strategy
    db = _session()
    _strategy(db, "u1")
    db.commit()
    assert resolve_active_strategy(db, "u1") is None
    db.close()