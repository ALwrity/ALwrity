"""
Phase 11 (plan Phase B, slice 2) — harness the dead advertools capacity.

B1: AdvertoolsService.compare_crawl_results had ZERO callers. The weekly
    content_audit now keeps a compact `seo_audit['content_audit_snapshot']`
    and computes a trend diff against it, persisted for the UI (`trend` on the
    result + stored snapshot). First run / degraded runs are honest: no diff,
    trend None, no fabricated change numbers.
B2: AdvertoolsService.extract_communication_style had ZERO callers. Non-degraded
    content audits now extract real social/link patterns and persist them into
    the user's brand_analysis['communication_style'] (merge-aware). Service
    failure never blocks the audit and never stores fake style data.
"""

import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from services.scheduler.executors.advertools_executor import AdvertoolsExecutor


def _executor() -> AdvertoolsExecutor:
    executor = AdvertoolsExecutor.__new__(AdvertoolsExecutor)
    executor.logger = MagicMock()
    executor.advertools_service = MagicMock()
    return executor


def _db_with_analysis(seo_audit=None, brand_analysis=None):
    """Fake db where query().filter().first() returns session then analysis."""
    db = MagicMock()
    session = SimpleNamespace(id=1, user_id="u1")
    analysis = SimpleNamespace(
        id=2,
        seo_audit=seo_audit,
        brand_analysis=brand_analysis,
        content_strategy_insights={},
    )
    db.query.return_value.filter.return_value.first.side_effect = [session, analysis]
    return db, analysis


# ---------------------------------------------------------------------------
# B1 — compare_crawl_results trend over weekly content audits
# ---------------------------------------------------------------------------

def test_b1_trend_diff_computed_against_stored_snapshot():
    executor = _executor()
    executor.advertools_service.compare_crawl_results = AsyncMock(
        return_value={"success": True, "page_count_change": 5, "link_health_changes": {"link_broken": -2}}
    )
    previous = {
        "page_count": 10,
        "page_status": {"200": 10},
        "link_health": {"broken": 5},
        "redirect_audit": {},
    }
    db, analysis = _db_with_analysis(seo_audit={"content_audit_snapshot": previous})

    result = {
        "success": True,
        "page_count": 15,
        "page_status": {"200": 15},
        "link_health": {"broken": 3},
        "redirect_audit": {},
    }
    # flag_modified expects a real ORM instance; the fake analysis is a
    # SimpleNamespace, so patch the SQLAlchemy helper here.
    with patch("sqlalchemy.orm.attributes.flag_modified"):
        asyncio.run(executor._update_content_audit_trend("u1", "https://x.com", result, db))

    assert result["trend"] == {
        "success": True,
        "page_count_change": 5,
        "link_health_changes": {"link_broken": -2},
    }
    # The diff was computed over the compact snapshots (prev vs current).
    args, _kwargs = executor.advertools_service.compare_crawl_results.call_args
    assert args[0]["page_count"] == 10
    assert args[1]["page_count"] == 15
    # Snapshot rotated to the current run for the next week's diff.
    assert analysis.seo_audit["content_audit_snapshot"]["page_count"] == 15
    assert analysis.seo_audit["last_content_audit_trend"]["page_count_change"] == 5


def test_b1_first_run_or_degraded_is_honest_no_trend():
    executor = _executor()
    executor.advertools_service.compare_crawl_results = AsyncMock()

    # First run: no stored snapshot -> no diff, snapshot just stored.
    db, analysis = _db_with_analysis(seo_audit={})
    result = {"success": True, "page_count": 4, "page_status": {}, "link_health": {}, "redirect_audit": {}}
    with patch("sqlalchemy.orm.attributes.flag_modified"):
        asyncio.run(executor._update_content_audit_trend("u1", "https://x.com", result, db))
    assert result["trend"] is None
    assert executor.advertools_service.compare_crawl_results.call_count == 0
    assert analysis.seo_audit["content_audit_snapshot"]["page_count"] == 4

    # Degraded run: previous snapshot exists but must NOT produce a diff.
    db2 = MagicMock()
    session = SimpleNamespace(id=1, user_id="u1")
    analysis2 = SimpleNamespace(id=2, seo_audit={"content_audit_snapshot": {"page_count": 10}}, brand_analysis={})
    db2.query.return_value.filter.return_value.first.side_effect = [session, analysis2]
    degraded = {"success": True, "degraded": True, "page_count": 1, "page_status": {}, "link_health": {}, "redirect_audit": {}}
    with patch("sqlalchemy.orm.attributes.flag_modified"):
        asyncio.run(executor._update_content_audit_trend("u1", "https://x.com", degraded, db2))
    assert degraded["trend"] is None
    assert executor.advertools_service.compare_crawl_results.call_count == 0


# ---------------------------------------------------------------------------
# B2 — extract_communication_style into persona augmentation
# ---------------------------------------------------------------------------

COMM_FIXTURE = {
    "success": True,
    "social_links": ["https://x.com/alwrity", "https://linkedin.com/company/alwrity"],
    "link_stats": {"total_links_found": 42, "unique_domains": 7},
    "timestamp": "2026-09-13T00:00:00Z",
}


def test_b2_communication_style_attached_on_successful_extraction():
    executor = _executor()
    executor.advertools_service.extract_communication_style = AsyncMock(return_value=COMM_FIXTURE)
    result = {"success": True}
    asyncio.run(executor._augment_with_communication_style(["https://x.com/a"], result))
    assert result["communication_style"] == COMM_FIXTURE
    executor.advertools_service.extract_communication_style.assert_awaited_once_with(["https://x.com/a"])


def test_b2_communication_style_failures_never_block_or_fabricate():
    executor = _executor()
    # Service reports failure -> nothing attached.
    executor.advertools_service.extract_communication_style = AsyncMock(
        return_value={"success": False, "error": "crawl failed"}
    )
    result = {"success": True}
    asyncio.run(executor._augment_with_communication_style(["https://x.com/a"], result))
    assert "communication_style" not in result

    # Exception -> warned, still nothing attached, no crash.
    executor.advertools_service.extract_communication_style = AsyncMock(side_effect=RuntimeError("boom"))
    result2 = {"success": True}
    asyncio.run(executor._augment_with_communication_style(["https://x.com/a"], result2))
    assert "communication_style" not in result2


def test_b2_persona_update_persists_communication_style_merge_aware():
    executor = _executor()
    db, analysis = _db_with_analysis(brand_analysis={})
    with patch("sqlalchemy.orm.attributes.flag_modified"):
        asyncio.run(
            executor._update_persona_augmentation(
                "u1", "https://x.com", {"success": True, "communication_style": COMM_FIXTURE}, db
            )
        )
    assert analysis.brand_analysis["communication_style"] == COMM_FIXTURE
    assert "last_communication_style_at" in analysis.brand_analysis

    # Degraded run without communication_style must NOT clobber what is stored.
    db2, analysis2 = _db_with_analysis(brand_analysis={"communication_style": COMM_FIXTURE})
    with patch("sqlalchemy.orm.attributes.flag_modified"):
        asyncio.run(
            executor._update_persona_augmentation("u1", "https://x.com", {"success": True, "degraded": True}, db2)
        )
    assert analysis2.brand_analysis["communication_style"] == COMM_FIXTURE
