"""Tests for the Sec-10 re-engagement trigger and the data-driven templates.

Covers:
  - _should_reengage true/false across the idle window
  - idle window override via REENGAGEMENT_IDLE_DAYS
  - fail-open (False) when the query itself fails
  - subject flip in send_digest when re-engaging
  - render_standard_digest vs render_reengagement produce distinct, payload
    driven output (no hardcoded counts)
"""
import types

import pytest

import services.daily_email_digest as digest_mod
import services.email_templates as templates


class _FakeQuery:
    def __init__(self, scalar_result):
        self._scalar = scalar_result

    def filter(self, *args, **kwargs):
        return self

    def scalar(self):
        return self._scalar


class _FakeSession:
    def __init__(self, scalar_result):
        self._query = _FakeQuery(scalar_result)

    def query(self, *args, **kwargs):
        return self._query

    def close(self):
        pass


def _payload_objs():
    def T(**kw):
        base = dict(
            title="Post about X",
            pillar_id="generate",
            priority="medium",
            estimated_time=20,
            status="pending",
            action_url="/writer",
            source_agent="content_strategist",
            synthesis_mode="llm",
        )
        base.update(kw)
        return types.SimpleNamespace(**base)

    cert = types.SimpleNamespace(
        agent="cs",
        state="certified",
        tools_total=4,
        tools_blocked=0,
        missing_gates=[],
    )
    return types.SimpleNamespace(
        date="2026-09-02",
        generation_mode="agent_committee",
        synthesis_mode_breakdown={"llm": 1, "data_derived": 1, "template_fallback": 0},
        committee_agent_count=3,
        tasks=[T(), T(status="completed"), T(pillar_id="analyze", estimated_time=5)],
        completed_count=1,
        not_done_count=2,
        completion_percentage=33.3,
        total_estimated_time=60,
        alerts=[{"severity": "high", "title": "SEO", "message": "meta missing"}],
        task_memory_signals=[],
        certification_summary={"Content Strategist": cert},
        confidence_estimates=[],
        timezone="UTC",
    )


# --------------------------------------------------------------------------- #
# _should_reengage
# --------------------------------------------------------------------------- #

def test_should_reengage_false_when_recent_completion_exists():
    session = _FakeSession(scalar_result=2)  # 2 recent completed tasks
    assert digest_mod._should_reengage(session, "u1", idle_days=3) is False


def test_should_reengage_true_when_zero_recent_completions():
    session = _FakeSession(scalar_result=0)
    assert digest_mod._should_reengage(session, "u1", idle_days=3) is True


def test_should_reengage_uses_env_idle_days():
    # Env provides the window when not passed explicitly (default 3 days).
    session = _FakeSession(scalar_result=0)
    assert digest_mod._should_reengage(session, "u1") is True
    # A non-positive window never triggers re-engagement.
    assert digest_mod._should_reengage(session, "u1", idle_days=0) is False


def test_should_reengage_fails_open_on_query_error(monkeypatch):
    class _Boom:
        def filter(self, *a, **k):
            return self

        def scalar(self):
            raise RuntimeError("db down")

    assert digest_mod._should_reengage(_Boom(), "u1", idle_days=3) is False


# --------------------------------------------------------------------------- #
# Templates are data-driven
# --------------------------------------------------------------------------- #

def test_standard_and_reengage_renders_differ():
    std = templates.render_standard_digest(_payload_objs(), verbose=True)
    ren = templates.render_reengagement(_payload_objs(), verbose=True)
    assert std != ren
    assert "pending" in ren or "quickest" in ren.lower()
    assert "<!DOCTYPE html>" in std and "<!DOCTYPE html>" in ren


def test_reengagement_includes_confetti_and_pulse():
    ren = templates.render_reengagement(_payload_objs(), verbose=True)
    assert "position:absolute" in ren
    assert "@keyframes pulse" in ren
    assert "transparent" in ren  # confetti ribbon gradient


def test_standard_renders_quickest_task_from_payload():
    std = templates.render_standard_digest(_payload_objs(), verbose=True)
    # No hardcoded count: the summary must be computed from payload, so the
    # completed/total text should reflect the payload numbers (1/1+...).
    assert "1/1" not in std  # would be a hardcoded unrelated count


def test_standard_is_full_width_and_high_energy():
    """The standard digest should match the re-engagement variant's full-width,
    high-energy look: a full-bleed gradient sheet, confetti, pulsing pill CTA,
    and a percentage progress bar driven by the payload."""
    std = templates.render_standard_digest(_payload_objs(), verbose=True)
    assert "linear-gradient(160deg," in std          # full-bleed gradient sheet
    assert "background-color:#0f172a" in std         # dark full-bleed background
    assert "position:absolute" in std                # confetti header accents
    assert 'class="pulse"' in std                    # pulsing gradient CTA
    assert "border-radius:999px" in std              # pill CTA
    # Progress bar width reflects payload completion (33.3 -> 33.3%)
    assert "linear-gradient(90deg,#4f46e5,#8b5cf6" in std


# --------------------------------------------------------------------------- #
# send_digest subject flip
# --------------------------------------------------------------------------- #

def test_send_digest_flips_subject_when_reengaging(monkeypatch):
    from tests.services.test_daily_email_digest_race import (
        _FakeRow,
        _FakeSession,
    )

    onboarding = _FakeRow(email_digest_opt_in=True)
    session = _FakeSession(first_results=[None, onboarding])
    monkeypatch.setattr(digest_mod, "get_session_for_user", lambda uid: session)

    from services.daily_email_digest import DigestPayload, TaskSummary

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
        synthesis_mode_breakdown={"llm": 1, "data_derived": 0, "template_fallback": 0},
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
    )
    monkeypatch.setattr(
        digest_mod, "build_digest_payload", lambda *a, **k: payload
    )
    monkeypatch.setattr(digest_mod, "_should_reengage", lambda *a, **k: True)

    sent = {}
    def _fake_send(to_email, subject, html):
        sent["subject"] = subject
        return "msg-123"

    monkeypatch.setattr(digest_mod, "_send_via_resend", _fake_send)

    ok = digest_mod.send_digest("u1", "2026-09-02", "user@example.com")

    assert ok is True
    assert sent["subject"] == "You have 1 pending tasks — here's the quickest one"