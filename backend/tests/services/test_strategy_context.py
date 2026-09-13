"""Phase 1: strategy_context compact digest (TDD).

Real SQLite, no mocks. Asserts the digest envelope contract: truthful,
bounded (serialized <= raw budget), decoupled flattening of a nested
``ai_recommendations`` JSON payload; inactive/error states never fabricated.
"""
import json
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models.base import Base
from models.enhanced_strategy_models import EnhancedContentStrategy
from models.monitoring_models import StrategyActivationStatus


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def _strategy(db, user_id, name="S", ai=None):
    s = EnhancedContentStrategy(user_id=user_id, name=name, ai_recommendations=ai)
    db.add(s)
    db.flush()
    return s


def _activate(db, strategy_id, user_id):
    a = StrategyActivationStatus(
        strategy_id=strategy_id, user_id=user_id, status="active",
        activation_date=datetime.utcnow(),
    )
    db.add(a)
    db.flush()
    return a


def _realistic_ai():
    return {
        "base_strategy": {
            "target_metrics": {"visibility_score": 70, "organic_traffic": 10000},
            "target_audience": {"demographics": "B2B marketers"},
            "brand_voice": {"tone": "confident", "voice": "expert"},
        },
        "strategic_insights": {
            "content_opportunities": ["AI storytelling", "Tool comparisons"],
            "market_positioning": "Challenger with strong organic play",
            "swot_summary": {"strengths": "deep niche content"},
        },
        "implementation_roadmap": {
            "phases": [
                {"phase": "Phase 1", "milestone": "Foundation", "timeline": "Month 1-2", "status": "in_progress"},
                {"phase": "Phase 2", "milestone": "Scale", "timeline": "Month 3-4", "status": "planned"},
            ]
        },
        "performance_predictions": {
            "optimization_focus": "CTR + conversions",
            "predicted_trend": {"6mo": {"visibility": 75}},
        },
        "risk_assessment": {
            "risks": [
                {"title": "Algorithm change", "severity": "high", "mitigation": "Diversify channels"},
            ]
        },
        "competitive_analysis": {
            "leaders": ["competitor-a.com"],
        },
        "summary": "Grow organic visibility via content depth and niche authority.",
    }


def test_no_active_strategy_returns_inactive_envelope():
    from services.strategy_context import build_strategy_context
    db = _session()
    _strategy(db, "u1", ai=_realistic_ai())  # exists but not activated
    db.commit()

    out = build_strategy_context(db, "u1")
    assert out["status"] == "inactive"
    assert out["strategy_id"] is None
    assert out["kpi_targets"] == []
    assert out["roadmap"] == []
    assert out["risks"] == []
    db.close()


def test_active_strategy_isolated_to_user():
    from services.strategy_context import build_strategy_context
    db = _session()
    s1 = _strategy(db, "u1", "Mine", ai=_realistic_ai())
    _strategy(db, "u2", "Theirs", ai=_realistic_ai())
    _activate(db, s1.id, "u1")
    _activate(db, s1.id + 999, "u2")  # u2 activation to a non-matching id
    db.commit()

    out = build_strategy_context(db, "u1")
    assert out["status"] == "available"
    db.close()


def test_available_digest_carries_kpi_roadmap_risks():
    from services.strategy_context import build_strategy_context
    db = _session()
    s = _strategy(db, "u1", "DocuTech", ai=_realistic_ai())
    _activate(db, s.id, "u1")
    db.commit()

    out = build_strategy_context(db, "u1")
    assert out["status"] == "available"
    assert out["strategy_id"] == s.id
    assert out["name"] == "DocuTech"
    assert out["kpi_targets"]
    assert any(k.get("metric") == "visibility_score" for k in out["kpi_targets"])
    assert any(m.get("milestone") == "Foundation" for m in out["roadmap"])
    assert any(r.get("title") == "Algorithm change" for r in out["risks"])
    assert out["positioning"]
    assert out["summary"]
    assert out["created_at"] is not None
    db.close()


def test_digest_is_bounded_serialized_length():
    from services.strategy_context import build_strategy_context
    db = _session()
    s = _strategy(db, "u1", "Bounded", ai=_realistic_ai())
    _activate(db, s.id, "u1")
    # Seed with maximal roadmap/risks/kpis to push length
    fat = _realistic_ai()
    fat["implementation_roadmap"]["phases"] = [
        {"phase": f"P{i}", "milestone": f"M{i}", "timeline": f"Month {i}", "status": "planned"}
        for i in range(50)
    ]
    fat["strategic_insights"]["content_opportunities"] = [f"topic {i}" for i in range(100)]
    s2 = _strategy(db, "u1", "Fat", ai=fat)
    _activate(db, s2.id, "u1", )
    db.query(StrategyActivationStatus).filter(
        StrategyActivationStatus.strategy_id == s.id
    ).delete()
    db.commit()

    out = build_strategy_context(db, "u1")
    serialized = json.dumps(out, default=str)
    assert len(serialized) <= 3000, f"digest exceeds budget: {len(serialized)}"
    db.close()


def test_ai_json_as_string_is_parsed():
    from services.strategy_context import build_strategy_context
    db = _session()
    s = _strategy(db, "u1", "StrAi", ai=json.dumps(_realistic_ai()))
    _activate(db, s.id, "u1")
    db.commit()

    out = build_strategy_context(db, "u1")
    assert out["status"] == "available"
    assert out["kpi_targets"]
    db.close()


def test_db_error_returns_error_envelope_not_raise():
    from services.strategy_context import build_strategy_context

    class _BrokenDB:
        def query(self, *_a, **_k):
            raise RuntimeError("session exploded")

    out = build_strategy_context(_BrokenDB(), "u1")
    assert out["status"] == "error"
    assert out["strategy_id"] is None
    assert any("session exploded" in lim for lim in out.get("limitations", []))


def test_format_strategy_block_renders_bounded_untagged():
    from services.strategy_context import format_strategy_block
    block = format_strategy_block({"status": "available", "name": "DocuTech",
                                   "summary": "Grow organic visibility.",
                                   "kpi_targets": [{"metric": "visibility_score", "target": "70"}],
                                   "roadmap": [{"milestone": "Foundation", "phase": "Phase 1",
                                                "timeline": "Month 1", "status": "in_progress"}],
                                   "goals": ["increase traffic"], "positioning": "Challenger"})
    assert block
    assert "visibility_score" in block
    assert "Foundation" in block
    assert len(block) <= 1500


def test_format_strategy_block_inactive_or_empty_returns_empty():
    from services.strategy_context import format_strategy_block
    assert format_strategy_block({"status": "inactive"}) == ""
    assert format_strategy_block({"status": "error", "limitations": ["boom"]}) == ""
    assert format_strategy_block({"status": "available", "kpi_targets": [],
                                  "roadmap": [], "goals": []}) == ""