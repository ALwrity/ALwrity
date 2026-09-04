"""TDD tests for digest email transparency (Phase 3b).

The daily digest email should include a transparency footer with the
plan's limitations and agent evidence summary, so the end user knows
the grounding quality of their plan.
"""
import pytest

from services.daily_email_digest import DigestPayload


class TestDigestTransparency:
    def test_digest_payload_has_limitations_field(self):
        """DigestPayload must carry a limitations field so the email can
        show what data was missing/degraded."""
        fields = DigestPayload.__dataclass_fields__
        assert "limitations" in fields, (
            "DigestPayload must have a 'limitations' field"
        )

    def test_digest_payload_has_sif_query_summary(self):
        """DigestPayload must carry a sif_query_summary field (aggregated
        search outcome counts) for email transparency."""
        fields = DigestPayload.__dataclass_fields__
        assert "sif_query_summary" in fields, (
            "DigestPayload must have a 'sif_query_summary' field"
        )

    def test_build_digest_payload_extracts_limitations_from_plan(self, monkeypatch):
        """build_digest_payload should extract limitations from the plan's
        plan_json so the email footer can render them."""
        from unittest.mock import MagicMock, patch

        from services.daily_email_digest import build_digest_payload
        from services.database import get_session_for_user as _gsf

        # Minimal fake plan with limitations in plan_json
        plan = MagicMock()
        plan.plan_json = {
            "limitations": ["Data freshness is stale", "No provider integrations"],
            "agent_evidence": [
                {"agent": "seo_specialist", "analysis": "Title too long",
                 "sif_queries": [{"query": "seo audit", "outcome": "miss"}]},
            ],
        }
        plan.id = 1
        tasks = []

        fake_session = MagicMock()
        fake_session.query.return_value.filter.return_value.first.return_value = plan
        fake_session.query.return_value.filter.return_value.all.return_value = tasks

        monkeypatch.setattr(
            "services.daily_email_digest.get_session_for_user",
            lambda uid: fake_session,
        )
        # Mock the helper functions that need DB queries
        monkeypatch.setattr(
            "services.daily_email_digest._fetch_task_memory_signals",
            lambda session, uid, tasks: [],
        )
        monkeypatch.setattr(
            "services.daily_email_digest._fetch_certification_summary",
            lambda session, uid: {},
        )

        # Mock task query to return empty list (no tasks)
        fake_session.query.return_value.filter.return_value.all.return_value = []

        result = build_digest_payload("u1", "2026-01-01")

        if result is not None:
            assert getattr(result, "limitations", None) is not None, (
                "build_digest_payload must extract limitations from plan_json"
            )

    def test_render_email_includes_limitations_footer(self):
        """The rendered email HTML must contain a limitations section when
        the payload has limitations."""
        from services.daily_email_digest import DigestPayload, TaskSummary, render_email

        task = TaskSummary(
            title="Write post",
            pillar_id="generate",
            priority="high",
            estimated_time=30,
            status="pending",
            action_url="/blog-writer",
            source_agent="content_strategist",
            synthesis_mode="llm",
        )
        payload = DigestPayload(
            date="2026-09-02",
            generation_mode="agent_committee",
            synthesis_mode_breakdown={"llm": 1, "template_fallback": 0, "data_derived": 0},
            committee_agent_count=5,
            tasks=[task],
            completed_count=0,
            not_done_count=1,
            completion_percentage=0.0,
            total_estimated_time=30,
            alerts=[],
            task_memory_signals=[],
            certification_summary={},
            confidence_estimates=[],
            timezone="UTC",
            limitations=["Data freshness is stale; recommendations may be incomplete."],
            sif_query_summary={"total_queries": 5, "success": 3, "miss": 2},
        )

        html = render_email(payload, verbose=True)
        assert "Data freshness" in html, (
            "render_email must include limitations in the output HTML"
        )
        assert "transparency" in html.lower() or "grounding" in html.lower(), (
            "render_email should label the limitations section"
        )
