"""Phase 4: stub delegation is strategy-grounded (edge cases + provenance)."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from api.content_planning.services.calendar_generation_service import (
    CalendarGenerationService,
)


def _ai_json(**overrides):
    base = {
        "base_strategy": {
            "preferred_formats": ["Blog"],
            "brand_voice": "Bold and direct",
            "business_objectives": ["Grow pipeline"],
            "market_gaps": ["AI onboarding"],
        },
        "strategic_insights": {"content_opportunities": ["AI Tutorials"]},
        "performance_predictions": {
            "estimated_engagement_rate": 0.073,
            "estimated_reach": 5400,
            "estimated_conversions": 42,
            "estimated_roi": 4.1,
            "success_probability": 0.68,
        },
        "summary": {},
        "risk_assessment": {},
    }
    base.update(overrides)
    return base


@pytest.fixture
def grounded_db():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    from models.base import Base  # noqa: F401
    import models.content_planning  # noqa: F401
    import models.enhanced_calendar_models  # noqa: F401
    import models.enhanced_strategy_models  # noqa: F401
    import models.onboarding  # noqa: F401

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()

    from models.onboarding import OnboardingSession
    from models.enhanced_strategy_models import EnhancedContentStrategy

    session.add(OnboardingSession(user_id="user-1"))
    strategy = EnhancedContentStrategy(
        user_id="user-1", name="S", industry="saas", ai_recommendations=_ai_json()
    )
    session.add(strategy)
    session.commit()
    session.refresh(strategy)
    yield session, strategy.id
    session.close()


def _service(db):
    service = object.__new__(CalendarGenerationService)
    service.db_session = db
    service.orchestrator = None
    service.orchestrator_sessions = {}
    return service


@pytest.mark.asyncio
async def test_optimize_rejects_unsupported_platform(grounded_db):
    db, strategy_id = grounded_db
    with pytest.raises(HTTPException) as excinfo:
        await _service(db).optimize_content_for_platform(
            user_id="user-1", title="T", description="D",
            content_type="blog_post", target_platform="myspace",
            strategy_id=strategy_id,
        )
    assert excinfo.value.status_code == 422
    assert "LinkedIn" in str(excinfo.value.detail)


@pytest.mark.asyncio
async def test_optimize_trims_to_character_budget(grounded_db):
    db, strategy_id = grounded_db
    out = await _service(db).optimize_content_for_platform(
        user_id="user-1", title="T", description="D" * 500,
        content_type="blog_post", target_platform="twitter",
        strategy_id=strategy_id,
    )
    assert out["optimized_content"]["target_platform"] == "Twitter"
    assert len(f"{out['optimized_content']['title']}\n{out['optimized_content']['description']}") <= 280
    assert out["length_optimization"]["within_limit"] is False
    assert out["optimization_score"] < 1.0


@pytest.mark.asyncio
async def test_optimize_requires_strategy(grounded_db):
    db, _ = grounded_db
    with pytest.raises(HTTPException) as excinfo:
        await _service(db).optimize_content_for_platform(
            user_id="nobody", title="T", description="D",
            content_type="blog_post", target_platform="linkedin",
        )
    assert excinfo.value.status_code == 422


@pytest.mark.asyncio
async def test_predict_missing_priors_is_422(grounded_db):
    from models.enhanced_strategy_models import EnhancedContentStrategy

    db, _ = grounded_db
    bare = EnhancedContentStrategy(
        user_id="user-1", name="Bare", industry="saas",
        ai_recommendations=_ai_json(performance_predictions={}),
    )
    db.add(bare)
    db.commit()
    db.refresh(bare)
    with pytest.raises(HTTPException) as excinfo:
        await _service(db).predict_content_performance(
            user_id="user-1", content_type="blog_post", platform="linkedin",
            content_data={}, strategy_id=bare.id,
        )
    assert excinfo.value.status_code == 422
    assert "missing_metrics" in str(excinfo.value.detail)


@pytest.mark.asyncio
async def test_predict_uses_historical_average(grounded_db):
    from models.content_planning import ContentAnalytics

    db, strategy_id = grounded_db
    db.add(ContentAnalytics(
        strategy_id=strategy_id, platform="linkedin",
        metrics={"engagement_rate": 0.10, "reach": 8000, "conversions": 60, "roi": 5.0},
    ))
    db.add(ContentAnalytics(
        strategy_id=strategy_id, platform="linkedin",
        metrics={"engagement_rate": 0.06, "reach": 4000, "conversions": 20, "roi": 3.0},
    ))
    db.commit()
    out = await _service(db).predict_content_performance(
        user_id="user-1", content_type="blog_post", platform="linkedin",
        content_data={}, strategy_id=strategy_id,
    )
    assert out["predicted_engagement_rate"] == 0.08
    assert out["predicted_reach"] == 6000
    assert out["sources"]["metric_sources"]["reach"] == "historical_average"
    assert out["sources"]["historical_basis"] == {"analytics_rows": 2}


@pytest.mark.asyncio
async def test_repurpose_empty_platforms_is_422(grounded_db):
    db, strategy_id = grounded_db
    with pytest.raises(HTTPException) as excinfo:
        await _service(db).repurpose_content_across_platforms(
            user_id="user-1", original_content={"title": "t"},
            target_platforms=[], strategy_id=strategy_id,
        )
    assert excinfo.value.status_code == 422


@pytest.mark.asyncio
async def test_trending_without_strategy_is_422(grounded_db):
    db, _ = grounded_db
    with pytest.raises(HTTPException) as excinfo:
        await _service(db).get_trending_topics(user_id="nobody", industry="saas", limit=5)
    assert excinfo.value.status_code == 422
