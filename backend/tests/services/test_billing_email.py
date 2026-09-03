"""Tests for the Phase-1 billing transactional email (payment confirmation).

Covers:
  - render_billing_email (payment confirmation) is data-driven and personalised:
    first name, plan, price, billing cycle, renewal date, feature highlights, CTA.
  - graceful degradation on a sparse payload (never raises).
  - HTML escaping of user-derived content.
  - payload assembly from a user subscription + plan.
  - money / date formatting helpers.
  - send_billing_email: success, event-level idempotency, opt-out skip,
    no-email fallback, and fail-open behavior (never raises).
"""
import types
from datetime import datetime

import pytest

import services.subscription.billing_email as billing
import services.daily_email_digest as digest_module


# --------------------------------------------------------------------------- #
# Fakes
# --------------------------------------------------------------------------- #

class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows

    def filter(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def limit(self, n):
        return _FakeQuery(self._rows[:n])

    def first(self):
        return self._rows[0] if self._rows else None

    def all(self):
        return self._rows


class _FakeSession:
    def __init__(self, queries=None):
        self._queries = queries or {}
        self.added = []
        self.committed = False
        self.rolled_back = False

    def query(self, model, *args, **kwargs):
        name = model.__name__.lower()
        rows = self._queries.get(name, [])
        return _FakeQuery(rows)

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True

    def close(self):
        pass

    def expire_all(self):
        pass


def _plan(name="Pro", tier="pro"):
    tier_obj = types.SimpleNamespace(value=tier)
    return types.SimpleNamespace(
        id=2,
        name=name,
        tier=tier_obj,
        price_monthly=79.0,
        price_yearly=790.0,
        features=["Unlimited content generation", "Premium research", "Priority support", "No watermark"],
    )


def _subscription(plan_id=2):
    return types.SimpleNamespace(
        user_id="u1",
        plan_id=plan_id,
        billing_cycle=types.SimpleNamespace(value="monthly"),
        current_period_start=datetime_obj("2026-09-03"),
        current_period_end=datetime_obj("2026-10-03"),
        is_active=True,
        write_attrs={},
    )


def datetime_obj(date_str):
    return datetime.strptime(date_str, "%Y-%m-%d")


def _onboarding(opt_in=True):
    return types.SimpleNamespace(
        contact_email="a@b.io",
        email_digest_opt_in=opt_in,
        timezone="UTC",
        payload={},
    )


def _ledger_row(status="sent", event_ref=""):
    return types.SimpleNamespace(
        user_id="u1",
        plan_date="2026-09-03",
        email_type="payment_confirmation",
        status=status,
        sent_at=None,
        resend_message_id=None,
        error_message=event_ref or None,
        id=1,
    )


# --------------------------------------------------------------------------- #
# Renderer
# --------------------------------------------------------------------------- #

def test_payment_confirmation_personalised():
    p = billing.BillingEmailPayload(
        kind="payment_confirmation",
        first_name="Ada",
        plan_name="Pro",
        plan_tier="pro",
        billing_cycle="monthly",
        price="$79",
        renewal_date="Oct 03, 2026",
        features=["Unlimited content generation", "Premium research"],
    )
    html = billing.render_billing_email(p, verbose=True)
    assert "<!DOCTYPE html>" in html
    assert "Ada" in html
    assert "Pro" in html
    assert "$79" in html
    assert "Oct 03, 2026" in html
    assert "Open my dashboard" in html


def test_payment_confirmation_shows_features_and_manual_billing():
    p = billing.BillingEmailPayload(
        kind="payment_confirmation", plan_name="Pro", price="$79",
        features=["Unlimited content generation", "Priority support"],
    )
    html = billing.render_billing_email(p, verbose=True)
    assert "Unlimited content generation" in html
    assert "Priority support" in html
    assert "Billing settings" in html
    assert "settings/billing" in html


def test_payment_confirmation_yearly_suffix():
    p = billing.BillingEmailPayload(
        kind="payment_confirmation", plan_name="Pro", price="$790",
        billing_cycle="yearly", renewal_date="Sep 03, 2027",
    )
    html = billing.render_billing_email(p, verbose=True)
    assert "billed yearly" in html
    assert "$790" in html


def test_payment_confirmation_degrades_on_sparse_payload():
    html = billing.render_billing_email(billing.BillingEmailPayload(), verbose=True)
    assert "<!DOCTYPE html>" in html
    assert "there" in html  # fallback salutation
    assert "Open my dashboard" in html


def test_payment_confirmation_escapes_user_input():
    p = billing.BillingEmailPayload(
        kind="payment_confirmation", first_name="<script>", plan_name="Pro & More",
    )
    html = billing.render_billing_email(p, verbose=True)
    assert "<script>" not in html
    assert "&lt;script&gt;" in html


def test_render_unknown_kind_falls_back():
    p = billing.BillingEmailPayload(kind="nonsense", plan_name="Pro")
    html = billing.render_billing_email(p, verbose=True)
    assert "Open my dashboard" in html


# --------------------------------------------------------------------------- #
# Payload assembly
# --------------------------------------------------------------------------- #

def test_build_payment_confirmation_payload_from_subscription():
    session = _FakeSession({
        "usersubscription": [_subscription()],
        "subscriptionplan": [_plan()],
    })
    p = billing.build_payment_confirmation_payload("u1", db=session, first_name="Bo")
    assert p.first_name == "Bo"
    assert p.plan_name == "Pro"
    assert p.plan_tier == "pro"
    assert p.billing_cycle == "monthly"
    assert p.price == "$79"
    assert p.renewal_date == "Oct 03, 2026"
    assert p.features == ["Unlimited content generation", "Premium research", "Priority support", "No watermark"]


def test_build_payment_confirmation_year_price():
    sub = _subscription()
    sub.billing_cycle = types.SimpleNamespace(value="yearly")
    session = _FakeSession({
        "usersubscription": [sub],
        "subscriptionplan": [_plan()],
    })
    p = billing.build_payment_confirmation_payload("u1", db=session)
    assert p.price == "$790"


def test_build_payment_confirmation_no_subscription():
    session = _FakeSession({"usersubscription": []})
    p = billing.build_payment_confirmation_payload("u1", db=session)
    assert p.plan_name == ""
    assert p.price == "$0"


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def test_money_formatting():
    assert billing._money(79.0) == "$79"
    assert billing._money(1990) == "$1,990"
    assert billing._money(0) == "$0"
    assert billing._money(None) == "$0"


def test_format_dt():
    assert billing._fmt_dt(datetime(2026, 10, 3)) == "Oct 03, 2026"
    assert billing._fmt_dt(1781136000) == "Jun 11, 2026"  # coarse timestamp sanity
    assert billing._fmt_dt(None) == ""


# --------------------------------------------------------------------------- #
# Send: best-effort, idempotent, opt-out aware
# --------------------------------------------------------------------------- #

def test_send_billing_email_success(monkeypatch):
    session = _FakeSession({"onboardingsession": [], "dailyemailledger": []})
    monkeypatch.setattr(billing, "_contact_email", lambda uid, db: "a@b.io")
    monkeypatch.setattr(billing, "_opted_in", lambda uid, db: True)
    monkeypatch.setattr(digest_module, "_send_via_resend", lambda *a, **k: "msg_111")
    monkeypatch.setattr(
        billing, "build_payment_confirmation_payload",
        lambda uid, db, first_name="": billing.BillingEmailPayload(
            kind="payment_confirmation", first_name="Ada", plan_name="Pro", price="$79"),
    )
    assert billing.send_billing_email("u1", db=session, kind="payment_confirmation", event_ref="evt_1") == "msg_111"
    assert session.committed
    assert session.added and session.added[-1].status == "sent"


def test_send_billing_email_idempotent_after_send(monkeypatch):
    session = _FakeSession({"dailyemailledger": [_ledger_row(status="sent", event_ref="evt_1")]})
    monkeypatch.setattr(billing, "_contact_email", lambda uid, db: "a@b.io")
    monkeypatch.setattr(billing, "_opted_in", lambda uid, db: True)

    def boom(*a, **k):
        raise AssertionError("should not re-send the same event")

    monkeypatch.setattr(digest_module, "_send_via_resend", boom)
    assert billing.send_billing_email("u1", db=session, kind="payment_confirmation", event_ref="evt_1") is None


def test_send_billing_email_skips_opt_out(monkeypatch):
    session = _FakeSession({"dailyemailledger": []})
    monkeypatch.setattr(billing, "_contact_email", lambda uid, db: "a@b.io")
    monkeypatch.setattr(billing, "_opted_in", lambda uid, db: False)
    calls = {}

    def fake_skip(db, uid, status, kind, event_ref):
        calls["status"] = status

    monkeypatch.setattr(billing, "_ledger_skip", fake_skip)
    assert billing.send_billing_email("u1", db=session, kind="payment_confirmation") is None
    assert calls.get("status") == "skipped_opted_out"


def test_send_billing_email_skips_no_email(monkeypatch):
    session = _FakeSession({"dailyemailledger": []})
    monkeypatch.setattr(billing, "_contact_email", lambda uid, db: "")
    monkeypatch.setattr(billing, "_opted_in", lambda uid, db: True)
    calls = {}

    def fake_skip(db, uid, status, kind, event_ref):
        calls["status"] = status

    monkeypatch.setattr(billing, "_ledger_skip", fake_skip)
    assert billing.send_billing_email("u1", db=session, kind="payment_confirmation") is None
    assert calls.get("status") == "skipped_no_email"


def test_send_billing_email_fails_open(monkeypatch):
    class _Boom:
        def add(self, o):
            raise RuntimeError("db down")

    s = _Boom()
    s.query = lambda *a, **k: (_ for _ in ()).throw(RuntimeError("explode"))
    monkeypatch.setattr(billing, "_contact_email", lambda uid, db: "a@b.io")
    assert billing.send_billing_email("u1", db=s, kind="payment_confirmation") is None


def test_opted_in_defaults_false():
    session = _FakeSession({"onboardingsession": []})
    assert billing._opted_in("u1", db=session) is False


def test_opted_in_respects_choice():
    session_true = _FakeSession({"onboardingsession": [_onboarding(opt_in=True)]})
    session_false = _FakeSession({"onboardingsession": [_onboarding(opt_in=False)]})
    assert billing._opted_in("u1", db=session_true) is True
    assert billing._opted_in("u1", db=session_false) is False