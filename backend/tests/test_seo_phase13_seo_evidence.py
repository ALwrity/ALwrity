"""
Phase 13 (plan Phase D, slice 1) — seo_evidence grounding block.

The daily-workflow committee grounding currently injects a single
`{seo_summary}` string. This slice adds a REAL, persisted SEO evidence block
(build_seo_evidence) consumed by every agent — and specifically the SEO
specialist — so daily tasks can be driven by actual audit/health/GSC signals.

Honest-by-construction: no stored data -> status 'no_data' with empty lists (no
fabricated metrics); any failure -> status 'error' envelope, never an exception.
"""

import sys
from pathlib import Path
from types import SimpleNamespace

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from services.intelligence.agents.seo_evidence import build_seo_evidence


def _db(session, analysis, audits):
    db = SimpleNamespace()
    calls = {"n": 0}

    def query(model):
        calls["n"] += 1
        q = SimpleNamespace()
        q.filter = lambda *a, **k: q
        if calls["n"] == 1:
            q.first = lambda: session
            q.all = lambda: []
        elif calls["n"] == 2:
            q.first = lambda: analysis
            q.all = lambda: []
        else:
            q.first = lambda: None
            q.all = lambda: audits
        return q

    db.query = query
    return db


def test_d1_evidence_from_persisted_seo_artifacts():
    session = SimpleNamespace(id=1, user_id="u1")
    analysis = SimpleNamespace(
        seo_audit={
            "on_page_audit": {"overall_score": 71},
            "gsc_snapshot": {
                "striking_distance": [{"keyword": "seo tools", "position": 5.0, "impressions": 300, "ctr": 3.0}],
                "low_ctr": [{"keyword": "low", "position": 2.0, "impressions": 500, "ctr": 0.5}],
            },
            "last_content_audit_trend": {"page_count_change": 3},
            "last_on_page_audit_at": "2026-09-12T00:00:00Z",
        }
    )
    audits = [
        SimpleNamespace(overall_score=80),
        SimpleNamespace(overall_score=55),
        SimpleNamespace(overall_score=60),
    ]
    evidence = build_seo_evidence(_db(session, analysis, audits), "u1")

    assert evidence["status"] == "ok"
    assert evidence["health_score"] == 71
    assert evidence["pages_audited"] == 3
    assert evidence["pages_needing_fix"] == 2  # 55 + 60 below 70
    assert evidence["avg_page_score"] == 65.0
    assert evidence["striking_distance"][0]["keyword"] == "seo tools"
    assert evidence["low_ctr"][0]["keyword"] == "low"
    assert evidence["content_trend"] == {"page_count_change": 3}
    assert evidence["last_audit_at"] == "2026-09-12T00:00:00Z"
    assert evidence["limitations"] == []


def test_d1_no_data_is_honest_empty_never_fabricated():
    evidence = build_seo_evidence(_db(None, None, []), "u1")
    assert evidence["status"] == "no_data"
    assert evidence["health_score"] is None
    assert evidence["pages_audited"] == 0
    assert evidence["pages_needing_fix"] == 0
    assert evidence["avg_page_score"] is None
    assert evidence["striking_distance"] == []
    assert evidence["low_ctr"] == []
    assert evidence["limitations"]


def test_d1_failure_degrades_to_error_envelope_never_raises():
    class _BoomDb:
        def query(self, *_a, **_k):
            raise RuntimeError("db down")

    evidence = build_seo_evidence(_BoomDb(), "u1")
    assert evidence["status"] == "error"
    assert evidence["limitations"]
    assert "db down" in evidence["limitations"][0]


def test_d1_grounding_context_includes_seo_evidence():
    src = (BACKEND_ROOT / "services" / "today_workflow_service.py").read_text(
        encoding="utf-8", errors="ignore"
    )
    assert "build_seo_evidence" in src
    assert '"seo_evidence"' in src
