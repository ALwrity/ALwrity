"""Tests for the reconciler, re-engagement quickest-task link, and weekly digest.

Covers:
  - reconcile_missed_digests actually sends (opt-in + email), skips opt-outs,
    and increments the sent count from the real send path.
  - render_reengagement emits a one-click deep-link to the lowest-effort task.
  - render_weekly_digest is data-driven (totals, strongest/weakest, agents).
"""
import types

import pytest

import services.daily_email_digest as digest_mod
import services.email_templates as templates


class _Query:
    def __init__(self, results):
        self._results = list(results)

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._results[0] if self._results else None

    def all(self):
        return self._results


def _weekly_payload_objs():
    return types.SimpleNamespace(
        user_id="u1",
        week_label="7 days ending 2026-09-02",
        end_date="2026-09-02",
        total_tasks=9,
        completed=4,
        skipped=2,
        completion_percentage=44.4,
        pillars=[types.SimpleNamespace(pillar_id="plan", proposed=4, completed=3, completion_rate=75.0)],
        agents=[
            types.SimpleNamespace(agent="content_strategist", proposed=5, completed=3, acceptance_rate=60.0),
            types.SimpleNamespace(agent="seo_specialist", proposed=4, completed=1, acceptance_rate=25.0),
        ],
        strongest_pillar="plan",
        weakest_pillar="engage",
        timezone="UTC",
    )


# --------------------------------------------------------------------------- #
# Re-engagement quickest-task deep link
# --------------------------------------------------------------------------- #

def test_reengagement_has_quickest_task_deep_link():
    from services.daily_email_digest import DigestPayload, TaskSummary

    task = TaskSummary(
        title="Optimize meta descriptions",
        pillar_id="analyze",
        priority="medium",
        estimated_time=5,
        status="pending",
        action_url="/seo-dashboard",
        source_agent="seo_specialist",
        synthesis_mode="data_derived",
    )
    big = TaskSummary(
        title="Big 99-min task",
        pillar_id="plan",
        priority="high",
        estimated_time=99,
        status="pending",
        action_url="/plan",
        source_agent="content_strategist",
        synthesis_mode="llm",
    )
    payload = DigestPayload(
        date="2026-09-02",
        generation_mode="agent_committee",
        synthesis_mode_breakdown={"llm": 1, "data_derived": 1, "template_fallback": 0},
        committee_agent_count=3,
        tasks=[big, task],
        completed_count=0,
        not_done_count=2,
        completion_percentage=0.0,
        total_estimated_time=104,
        alerts=[],
        task_memory_signals=[],
        certification_summary={},
        confidence_estimates=[],
        timezone="UTC",
    )

    html = templates.render_reengagement(payload, verbose=True)
    assert "QUICKEST WIN" in html
    # The quickest task (5-min) is the deep-linked one, not the 99-min one.
    assert "Optimize meta descriptions" in html
    assert 'href="https://alwrity.com/seo-dashboard"' in html
    assert "Continue" in html
    # Accurate total = pending only (5 + 99), never a hardcoded 15.
    assert "Reclaim Your 104 Minutes" in html
    assert "104 focused minutes" in html


# --------------------------------------------------------------------------- #
# Weekly renderer
# --------------------------------------------------------------------------- #

def test_weekly_renders_data_driven():
    html = templates.render_weekly_digest(_weekly_payload_objs(), verbose=True)
    assert "COMPLETION RATE" in html
    assert "STRONGEST PILLAR" in html
    assert "Agent Acceptance" in html
    # Values come from the payload (not hardcoded).
    assert "44%" in html
    assert "4 of 9" in html or "4 of 9" in html
    assert "content_strategist" in html and "3/5" in html


def test_weekly_empty_agents_shows_fallback():
    p = _weekly_payload_objs()
    p.agents = []
    p.pillars = []
    html = templates.render_weekly_digest(p, verbose=True)
    assert "No agent acceptance data" in html
    assert "No pillar data" in html


# --------------------------------------------------------------------------- #
# Reconciler
# --------------------------------------------------------------------------- #

class _FakeSession:
    """Returns scripted first()/all() results for the reconciler's queries."""

    def __init__(self, ledgers, onboarding):
        self.ledgers = ledgers
        self.onboarding = onboarding

    def query(self, *args, **kwargs):
        if args and args[0].__name__ == "DailyEmailLedger":
            return _Query(self.ledgers)
        return _Query([self.onboarding])

    def commit(self):
        pass

    def close(self):
        pass


def _ledger(status, user_id="u1", email_type="daily", row_id=1):
    return types.SimpleNamespace(
        id=row_id,
        user_id=user_id,
        plan_date="2026-09-02",
        email_type=email_type,
        status=status,
        error_message=None,
        sent_at=None,
        resend_message_id=None,
        updated_at=None,
    )


def test_reconciler_sends_opted_in_user(monkeypatch):
    ledgers = [_ledger("pending", user_id="u1")]
    onboarding = types.SimpleNamespace(contact_email="user@example.com", email_digest_opt_in=True)

    session = _FakeSession(ledgers, onboarding)

    monkeypatch.setattr(digest_mod, "get_session_for_user", lambda uid: session)
    sent_calls = []
    monkeypatch.setattr(
        digest_mod, "build_digest_payload",
        lambda uid, date, verbose=True: _fake_payload(),
    )
    monkeypatch.setattr(digest_mod, "_should_reengage", lambda *a, **k: False)

    def _fake_send(to_email, subject, html):
        sent_calls.append(to_email)
        return "msg-1"
    monkeypatch.setattr(digest_mod, "_send_via_resend", _fake_send)

    count = digest_mod.reconcile_missed_digests()

    assert sent_calls == ["user@example.com"]
    assert ledgers[0].status == "sent"
    assert count == 1


def test_reconciler_skips_opted_out(monkeypatch):
    ledgers = [_ledger("pending", user_id="u1")]
    onboarding = types.SimpleNamespace(contact_email="user@example.com", email_digest_opt_in=False)
    session = _FakeSession(ledgers, onboarding)

    monkeypatch.setattr(digest_mod, "get_session_for_user", lambda uid: session)
    sent_calls = []
    monkeypatch.setattr(digest_mod, "_send_via_resend", lambda *a, **k: sent_calls.append(a[0]) or "msg")

    count = digest_mod.reconcile_missed_digests()

    assert sent_calls == []
    assert ledgers[0].status == "skipped_opted_out"
    assert count == 0


def _fake_payload():
    from services.daily_email_digest import DigestPayload, TaskSummary

    return DigestPayload(
        date="2026-09-02",
        generation_mode="agent_committee",
        synthesis_mode_breakdown={"llm": 1, "data_derived": 0, "template_fallback": 0},
        committee_agent_count=2,
        tasks=[TaskSummary("T", "plan", "high", 10, "pending", "/x", "cs", "llm")],
        completed_count=0,
        not_done_count=1,
        completion_percentage=0.0,
        total_estimated_time=10,
        alerts=[],
        task_memory_signals=[],
        certification_summary={},
        confidence_estimates=[],
        timezone="UTC",
    )