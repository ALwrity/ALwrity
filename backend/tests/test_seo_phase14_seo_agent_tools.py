"""
Phase 14 (plan Phase D slices 2-3) — real SEO agent tools + CTA'd alerts.

Slice 2 (tools): SEOOptimizationAgent.propose_daily_tasks() now proposes REAL
tasks from the seo_evidence grounding block (pages needing fixes, striking
distance, low CTR), and perform_seo_audit() reads the persisted evidence
instead of a generic SIF similarity search. No data -> honest empty/decline.

Slice 3 (alerts): produce_seo_alerts() raises CTA'd AgentAlerts
(cta_path='/seo-dashboard') with stable dedupe_keys so the huddle feed and the
next grounding surface them automatically. no_data/error -> no alerts.
"""

import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from services.intelligence.agents.specialized.seo_optimization import SEOOptimizationAgent
from services.intelligence.agents.seo_alert_producer import produce_seo_alerts


EVIDENCE_OK = {
    "status": "ok",
    "health_score": 55,
    "pages_audited": 10,
    "pages_needing_fix": 3,
    "avg_page_score": 64.0,
    "striking_distance": [
        {"keyword": "seo tools", "position": 5.0, "impressions": 300, "ctr": 3.0}
    ],
    "low_ctr": [
        {"keyword": "content audit", "position": 2.0, "impressions": 500, "ctr": 0.5}
    ],
    "content_trend": {"page_count_change": 3},
    "last_audit_at": "2026-09-12T00:00:00Z",
    "limitations": [],
}


def _agent() -> SEOOptimizationAgent:
    agent = SEOOptimizationAgent.__new__(SEOOptimizationAgent)
    agent.user_id = "u1"
    agent.sif_service = None
    agent._remember_grounding = MagicMock()
    agent._synthesize_task_proposals = AsyncMock(side_effect=lambda ctx, proposals, instructions=None: proposals)
    return agent


def _titles(proposals):
    return [p.title for p in proposals]


def _urls(proposals):
    return [getattr(p, "action_url", None) for p in proposals]


# ---------------------------------------------------------------------------
# Slice 2 — tools
# ---------------------------------------------------------------------------

def test_d2_propose_tasks_from_real_evidence():
    agent = _agent()
    proposals = asyncio.run(
        agent.propose_daily_tasks({"seo_evidence": EVIDENCE_OK})
    )

    titles = _titles(proposals)
    assert any("underperforming" in t for t in titles)
    assert any('"seo tools"' in t for t in titles)
    assert any('"content audit"' in t for t in titles)
    # Every evidence-driven task is a navigation back to the SEO dashboard.
    assert all(u == "/seo-dashboard" for u in _urls(proposals))
    # Evidence is framed with real numbers, not filler.
    assert any("3" in t for t in titles)


def test_d2_no_data_evidence_yields_no_fabricated_tasks():
    agent = _agent()
    proposals = asyncio.run(
        agent.propose_daily_tasks({"seo_evidence": {"status": "no_data", "pages_needing_fix": 0}})
    )
    assert proposals == []


def test_d2_perform_seo_audit_reads_persisted_evidence():
    agent = _agent()
    with patch(
        "services.intelligence.agents.seo_evidence.build_seo_evidence",
        return_value=EVIDENCE_OK,
    ), patch("services.database.get_db_session", return_value=MagicMock()):
        result = asyncio.run(agent.perform_seo_audit("https://x.com"))

    assert result["health"] == "reviewed"
    assert result["evidence"]["pages_needing_fix"] == 3
    # Real issues list derived from evidence, not a generic SIF count.
    assert any("below 70" in issue for issue in result["issues"])
    assert any("striking-distance" in issue for issue in result["issues"])


# ---------------------------------------------------------------------------
# Slice 3 — CTA'd alerts
# ---------------------------------------------------------------------------

def test_d3_alerts_raised_with_cta_path_and_dedupe_keys():
    service = MagicMock()
    service.create_alert = MagicMock(side_effect=lambda **kwargs: SimpleNamespace(**kwargs))

    created = produce_seo_alerts(MagicMock(), "u1", EVIDENCE_OK, activity_service=service)

    alert_types = {c["alert_type"] for c in created}
    assert {"seo_page_health", "seo_striking_distance", "seo_low_ctr", "seo_health_low"} <= alert_types

    for call in service.create_alert.call_args_list:
        kwargs = call.kwargs
        assert kwargs["cta_path"] == "/seo-dashboard"
        assert kwargs["dedupe_key"].startswith("seo:")
        assert kwargs["title"] and kwargs["message"]


def test_d3_no_data_or_error_evidence_produces_nothing():
    service = MagicMock()
    service.create_alert = MagicMock()
    assert produce_seo_alerts(MagicMock(), "u1", {"status": "no_data"}, activity_service=service) == []
    assert produce_seo_alerts(MagicMock(), "u1", {"status": "error"}, activity_service=service) == []
    assert service.create_alert.call_count == 0


def test_d3_grounding_context_wires_the_alert_producer():
    src = (BACKEND_ROOT / "services" / "today_workflow_service.py").read_text(
        encoding="utf-8", errors="ignore"
    )
    assert "produce_seo_alerts" in src
