"""Phase C: DB-activated strategy wins; VFS mirror is a guarded fallback.

- Rich DB row + conflicting VFS file -> DB values, no VFS read needed for correctness.
- VFS reader raising -> DB still resolves (guards).
- Empty DB + VFS file -> vfs_fallback provenance, grounded values.
- Empty DB + no VFS -> ValueError (existing contract preserved).
- Corrupt VFS -> ValueError, never a crash.
- Thin DB row + VFS -> missing fields filled, DB values preserved.
"""

from __future__ import annotations

import pytest

VFS_MARKDOWN = """# Active Content Strategy

- strategy_id: 7
- activation_date: 2026-01-01T00:00:00
- version: 2.0

## Form Inputs
- name: VFS Strategy
- industry: saas
- business_objectives: ["Grow pipeline"]
- brand_voice: Bold and direct
- content_frequency: 3x weekly
- market_gaps: ["AI onboarding", "Video SEO"]
- preferred_formats: ["Blog", "Video"]

## Strategic Insights
- content_opportunities: ["AI Tutorials", "Case Studies"]
"""


def _rich_ai_json():
    return {
        "base_strategy": {
            "content_pillars": ["DB Pillar"],
            "preferred_formats": ["Newsletter"],
            "brand_voice": "DB voice",
            "business_objectives": ["DB objective"],
        },
        "strategic_insights": {},
        "summary": {},
        "risk_assessment": {},
    }


@pytest.fixture
def sqlite_db():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    from models.base import Base  # noqa: F401
    import models.content_planning  # noqa: F401
    import models.daily_workflow_models  # noqa: F401 (FK target of calendar_events)
    import models.enhanced_strategy_models  # noqa: F401
    import models.onboarding  # noqa: F401
    import models.monitoring_models  # noqa: F401

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


@pytest.fixture
def processor(sqlite_db):
    from services.content_planning_db import ContentPlanningDBService
    from services.calendar_generation_datasource_framework.data_processing.strategy_data import (
        StrategyDataProcessor,
    )

    proc = StrategyDataProcessor()
    proc.content_planning_db_service = ContentPlanningDBService(sqlite_db)
    return proc


@pytest.fixture
def vfs_home(tmp_path, monkeypatch):
    """Point the workspace resolver at tmp; return writer for active.md."""

    def _resolve(user_id: str):
        return tmp_path / f"ws-{user_id}"

    monkeypatch.setattr(
        "services.workspace_paths.get_user_workspace_dir", _resolve
    )

    def _write(content: str = VFS_MARKDOWN):
        target_dir = tmp_path / "ws-user-1" / "strategy"
        target_dir.mkdir(parents=True, exist_ok=True)
        (target_dir / "active.md").write_text(content, encoding="utf-8")

    return _write


def _add_enhanced(sqlite_db, ai_json, name="DB Strategy"):
    from models.enhanced_strategy_models import EnhancedContentStrategy

    row = EnhancedContentStrategy(
        user_id="user-1", name=name, industry="saas", ai_recommendations=ai_json
    )
    sqlite_db.add(row)
    sqlite_db.commit()
    sqlite_db.refresh(row)
    return row


@pytest.mark.asyncio
async def test_db_wins_over_vfs(processor, sqlite_db, vfs_home):
    row = _add_enhanced(sqlite_db, _rich_ai_json())
    vfs_home()

    data = await processor.get_strategy_data(row.id, user_id="user-1")

    assert data["content_pillars"] == ["DB Pillar"]
    assert data["brand_voice"] == "DB voice"
    assert data["strategy_source"] == "db:enhanced"


@pytest.mark.asyncio
async def test_vfs_failure_never_breaks_db(processor, sqlite_db, monkeypatch):
    row = _add_enhanced(sqlite_db, _rich_ai_json())

    def _boom(user_id: str):
        raise RuntimeError("disk on fire")

    monkeypatch.setattr(
        "services.workspace_paths.get_user_workspace_dir", _boom
    )

    data = await processor.get_strategy_data(row.id, user_id="user-1")

    assert data["content_pillars"] == ["DB Pillar"]
    assert data["strategy_source"] == "db:enhanced"


@pytest.mark.asyncio
async def test_vfs_fallback_when_db_empty(processor, vfs_home):
    vfs_home()

    data = await processor.get_strategy_data(None, user_id="user-1")

    assert data["strategy_source"] == "vfs_fallback"
    assert data["content_pillars"] == ["AI Tutorials", "Case Studies"]
    assert data["brand_voice"] == "Bold and direct"
    assert data["industry"] == "saas"


@pytest.mark.asyncio
async def test_no_db_no_vfs_raises(processor):
    # Existing contract: ValueError wrapped as "Failed to get strategy data".
    with pytest.raises(Exception, match="No strategy data found"):
        await processor.get_strategy_data(None, user_id="user-1")


@pytest.mark.asyncio
async def test_corrupt_vfs_raises_not_crashes(processor, vfs_home):
    vfs_home("not markdown at all\njust ((( garbage [[[")

    with pytest.raises(Exception, match="No strategy data found"):
        await processor.get_strategy_data(None, user_id="user-1")


@pytest.mark.asyncio
async def test_thin_db_enriched_from_vfs(processor, sqlite_db, vfs_home):
    row = _add_enhanced(sqlite_db, None, name="Thin")
    vfs_home()

    data = await processor.get_strategy_data(row.id, user_id="user-1")

    assert data["strategy_source"] == "db:enhanced+vfs_enriched"
    # Missing fields filled from the mirror...
    assert data["brand_voice"] == "Bold and direct"
    assert data["content_pillars"] == ["AI Tutorials", "Case Studies"]
    # ...but DB values are never overwritten.
    assert data["strategy_name"] == "Thin"
