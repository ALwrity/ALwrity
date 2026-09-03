"""TDD tests for the digest persistence-race fix.

``finish_meeting`` enqueues the digest in a background thread BEFORE the
caller persists the plan row, so the first ``build_digest_payload`` call can
legitimately find no plan yet. ``send_digest`` must poll briefly for the
plan instead of terminally marking ``skipped_no_content``.
"""
import pytest

import services.daily_email_digest as digest_mod


class _FakeRow:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class _FakeQuery:
    """Chainable query stub: .first() pops from a provided sequence."""

    def __init__(self, first_results, scalar_result=0):
        self._first_results = list(first_results)
        self._scalar_result = scalar_result

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        if self._first_results:
            return self._first_results.pop(0)
        return None

    def all(self):
        return []

    def count(self):
        return 0

    def scalar(self):
        return self._scalar_result


class _FakeSession:
    def __init__(self, first_results, scalar_result=0):
        self._query = _FakeQuery(first_results, scalar_result)
        self.added = []
        self.committed = 0

    def query(self, *args, **kwargs):
        return self._query

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        self.committed += 1

    def close(self):
        pass


def _payload():
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
    return DigestPayload(
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
    )


@pytest.fixture()
def digest_env(monkeypatch):
    """Fake session (ledger None + opted-in onboarding), stubbed sender."""
    onboarding = _FakeRow(email_digest_opt_in=True)
    session = _FakeSession(first_results=[None, onboarding])

    monkeypatch.setattr(digest_mod, "get_session_for_user", lambda uid: session)
    sent = {"calls": []}

    def _fake_send(to_email, subject, html):
        sent["calls"].append(to_email)
        return "msg-123"

    monkeypatch.setattr(digest_mod, "_send_via_resend", _fake_send)
    sleeps = []
    monkeypatch.setattr(
        digest_mod.time, "sleep", lambda s: sleeps.append(s)
    )
    return {"session": session, "sent": sent, "sleeps": sleeps}


def test_send_digest_polls_until_plan_persists(monkeypatch, digest_env):
    """The plan is persisted a moment AFTER the digest thread starts: the
    first two payload builds return None (no plan yet), the third succeeds.
    send_digest must wait and retry, then send."""
    attempts = {"n": 0}
    real_payload = _payload

    def _flaky_build(user_id, date, verbose):
        attempts["n"] += 1
        return real_payload() if attempts["n"] >= 3 else None

    monkeypatch.setattr(digest_mod, "build_digest_payload", _flaky_build)

    ok = digest_mod.send_digest("u1", "2026-09-02", "user@example.com")

    assert ok is True
    assert attempts["n"] == 3, f"expected 3 build attempts, got {attempts['n']}"
    assert digest_env["sent"]["calls"] == ["user@example.com"]
    assert len(digest_env["sleeps"]) == 2, "two waits before the successful attempt"
    ledgers = [a for a in digest_env["session"].added if hasattr(a, "status")]
    assert ledgers and ledgers[-1].status == "sent"


def test_send_digest_gives_up_after_max_attempts(monkeypatch, digest_env):
    """A plan that never appears terminates as skipped_no_content after the
    bounded poll (no infinite wait)."""
    monkeypatch.setattr(digest_mod, "build_digest_payload", lambda *a, **k: None)

    ok = digest_mod.send_digest("u1", "2026-09-02", "user@example.com")

    assert ok is True  # terminal skip, not an error
    assert len(digest_env["sleeps"]) == digest_mod._DIGEST_PLAN_WAIT_ATTEMPTS - 1
    ledgers = [a for a in digest_env["session"].added if hasattr(a, "status")]
    assert ledgers and ledgers[-1].status == "skipped_no_content"
    assert digest_env["sent"]["calls"] == []


def test_send_digest_sends_immediately_when_plan_ready(monkeypatch, digest_env):
    """A ready plan sends with zero waits (healthy path unchanged)."""
    monkeypatch.setattr(digest_mod, "build_digest_payload", lambda *a, **k: _payload())

    ok = digest_mod.send_digest("u1", "2026-09-02", "user@example.com")

    assert ok is True
    assert digest_env["sent"]["calls"] == ["user@example.com"]
    assert digest_env["sleeps"] == []
