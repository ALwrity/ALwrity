"""Tests for the onboarding welcome email.

Covers:
  - render_welcome_email is data-driven: personalises with first name, a
    "what we learned" summary, the agent-team explainer, and the content
    strategy CTA.
  - graceful degradation on an empty / sparse payload (never raises).
  - payload assembly from integrated data (personalisation sources).
  - send_welcome_email idempotency, no-email fallback, and fail-open behavior
    (never raises on a send or DB failure).
"""
import types

import pytest

import services.onboarding_welcome_email as welcome
import services.daily_email_digest as digest_module


class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows

    def filter(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def first(self):
        return self._rows[0] if self._rows else None

    def all(self):
        return self._rows

    def count(self):
        return len(self._rows)


class _FakeSession:
    def __init__(self, queries=None):
        # queries: dict keyed by "ledger" | "onboarding" | default empty.
        self._queries = queries or {}
        self.added = []
        self.committed = False

    def query(self, model, *args, **kwargs):
        name = model.__name__.lower()
        if name == "dailyemailledger":
            return _FakeQuery(self._queries.get("ledger", []))
        if name == "onboardingsession":
            return _FakeQuery(self._queries.get("onboarding", []))
        return _FakeQuery([])

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        self.committed = True

    def rollback(self):
        pass

    def close(self):
        pass


def _ledger_row(status="sent"):
    row = types.SimpleNamespace()
    row.user_id = "u1"
    row.plan_date = "2026-09-03"
    row.email_type = "welcome"
    row.status = status
    row.sent_at = None
    row.resend_message_id = None
    row.error_message = None
    return row


# --------------------------------------------------------------------------- #
# renderer: data-driven + personalised
# --------------------------------------------------------------------------- #

def _payload(**kw):
    base = dict(
        first_name="Ada",
        website_url="https://acme.io",
        industry="SaaS",
        target_audience="B2B founders",
        writing_tone="confident",
        content_types=["blog", "guides"],
        connected_platforms=["LinkedIn", "X"],
        competitors=["rival.io", "footer.co"],
    )
    base.update(kw)
    return welcome.WelcomeEmailPayload(**base)


def test_render_welcome_contains_core_blocks():
    html = welcome.render_welcome_email(_payload(), verbose=True)
    assert "<!DOCTYPE html>" in html
    assert "Ada" in html
    assert "new age of digital marketing" in html
    assert "What we learned about you" in html


def test_render_welcome_summarises_learning():
    html = welcome.render_welcome_email(_payload(), verbose=True)
    assert "acme.io" in html
    assert "B2B founders" in html
    assert "confident" in html
    assert "LinkedIn" in html
    assert "rival.io" in html and "footer.co" in html


def test_render_welcome_has_agent_team_and_cta():
    html = welcome.render_welcome_email(_payload(), verbose=True)
    assert "AI AGENT TEAM" in html
    assert "Strategist" in html and "SEO Specialist" in html
    assert "content-planning" in html
    assert "Content Strategy" in html


def test_render_welcome_degrades_on_sparse_payload():
    html = welcome.render_welcome_email(welcome.WelcomeEmailPayload(), verbose=True)
    assert "<!DOCTYPE html>" in html
    assert "there" in html  # fallback salutation
    assert "keep learning" in html


def test_render_welcome_escapes_user_input():
    html = welcome.render_welcome_email(
        _payload(first_name="<script>", industry='A&B < oops'), verbose=True
    )
    assert "<script>" not in html
    assert "&lt;script&gt;" in html


# --------------------------------------------------------------------------- #
# payload assembly
# --------------------------------------------------------------------------- #

def test_build_welcome_payload_uses_integrated_data(monkeypatch):
    class _FakeDB:
        def query(self, *a, **k):
            return _FakeQuery([])

    integrated = {
        "canonical_profile": {
            "industry": "FinTech",
            "target_audience": "CFOs",
            "writing_tone": "authoritative",
            "writing_voice": "steady",
            "content_types": ["case studies", "webinars"],
            "platform_preferences": ["LinkedIn"],
            "brand_voice": {"default_tone": "authoritative"},
        },
        "website_analysis": {"website_url": "https://fin.io"},
        "research_preferences": {},
        "competitor_analysis": [
            {"competitor_domain": "www.riv-1.com", "url": "https://www.riv-1.com/path"},
            "https://riv-2.io",
        ],
        "platform_integrations": {"connected_platforms": []},
    }

    class _FakeSvc:
        def __init__(self):
            self.calls = 0

        def get_integrated_data_sync(self, user_id, db, force_rebuild=False):
            self.calls += 1
            return integrated

    monkeypatch.setattr(
        "api.content_planning.services.content_strategy.onboarding.data_integration"
        ".OnboardingDataIntegrationService",
        _FakeSvc,
    )

    p = welcome.build_welcome_payload("u1", db=_FakeDB(), first_name="Xi")
    assert p.industry == "FinTech"
    assert p.target_audience == "CFOs"
    assert p.writing_tone == "authoritative"
    assert p.website_url == "https://fin.io"
    assert p.competitors == ["riv-1.com", "riv-2.io"]
    assert p.connected_platforms == ["LinkedIn"]


def test_competitor_domains_normalises():
    assert welcome._competitor_domains([
        {"competitor_domain": "www.a.io", "url": "https://www.a.io/x"},
        "https://b.io/what",
        {},
    ]) == ["a.io", "b.io"]


def _onboarding_row(opt_in=False):
    return types.SimpleNamespace(
        contact_email="a@b.io",
        email_digest_opt_in=opt_in,
        timezone="UTC",
        payload={},
    )


def test_opted_in_defaults_to_false():
    session = _FakeSession({"onboarding": []})
    assert welcome._opted_in("u1", db=session) is False


def test_opted_in_respects_user_choice():
    session = _FakeSession({"onboarding": [_onboarding_row(opt_in=False)]})
    assert welcome._opted_in("u1", db=session) is False

    session = _FakeSession({"onboarding": [_onboarding_row(opt_in=True)]})
    assert welcome._opted_in("u1", db=session) is True


# --------------------------------------------------------------------------- #
# send: idempotent, fail-open, no-email fallback
# --------------------------------------------------------------------------- #

def test_send_welcome_skips_when_no_email(monkeypatch):
    monkeypatch.setattr(welcome, "_contact_email", lambda uid, db: "")
    _ledger_skip_calls = {}

    def fake_skip(db, uid, status):
        _ledger_skip_calls["status"] = status

    monkeypatch.setattr(welcome, "_ledger_skip", fake_skip)
    assert welcome.send_welcome_email("u1", db=_FakeSession()) is None
    assert _ledger_skip_calls.get("status") == "skipped_no_email"


def test_send_welcome_is_idempotent_after_send(monkeypatch):
    session = _FakeSession({"ledger": [_ledger_row(status="sent")]})
    monkeypatch.setattr(welcome, "_contact_email", lambda uid, db: "a@b.io")
    monkeypatch.setattr(welcome, "_opted_in", lambda uid, db: True)

    def boom(*a, **k):
        raise AssertionError("should not re-send after a prior send")

    monkeypatch.setattr(digest_module, "_send_via_resend", boom)
    assert welcome.send_welcome_email("u1", db=session) is None


def test_send_welcome_marks_sent_on_success(monkeypatch):
    session = _FakeSession({"ledger": []})
    monkeypatch.setattr(welcome, "_contact_email", lambda uid, db: "a@b.io")
    monkeypatch.setattr(welcome, "_opted_in", lambda uid, db: True)
    monkeypatch.setattr(digest_module, "_send_via_resend", lambda *a, **k: "msg_123")
    # Avoid touching the real build (DB) — return a minimal payload.
    monkeypatch.setattr(
        welcome, "build_welcome_payload",
        lambda uid, db=None, first_name="": welcome.WelcomeEmailPayload(first_name="Ada"),
    )
    assert welcome.send_welcome_email("u1", db=session) == "msg_123"
    assert session.committed
    assert session.added and session.added[0].status == "sent"


def test_send_welcome_skips_when_opted_out(monkeypatch):
    session = _FakeSession({"ledger": []})
    monkeypatch.setattr(welcome, "_contact_email", lambda uid, db: "a@b.io")
    monkeypatch.setattr(welcome, "_opted_in", lambda uid, db: False)
    _ledger_skip_calls = {}

    def fake_skip(db, uid, status):
        _ledger_skip_calls["status"] = status

    monkeypatch.setattr(welcome, "_ledger_skip", fake_skip)
    assert welcome.send_welcome_email("u1", db=session) is None
    assert _ledger_skip_calls.get("status") == "skipped_opted_out"


def test_send_welcome_fails_open_on_any_exception(monkeypatch):
    class _BoomDB:
        def add(self, o):
            raise RuntimeError("db down")

    def boom_query(self, model, *a, **k):
        raise RuntimeError("explode")

    monkeypatch.setattr(welcome, "_contact_email", lambda uid, db: "a@b.io")
    session = _BoomDB()
    session.query = boom_query
    # Never raises; returns None on failure.
    assert welcome.send_welcome_email("u1", db=session) is None