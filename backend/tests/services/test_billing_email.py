"""Tests for the billing transactional email service.

Phase 1 — payment confirmation:
  - personalised render (first name, plan, price, cycle, renewal date, features).
  - graceful degradation, HTML escaping, payload assembly, helpers.
  - send: success, event-level idempotency, opt-out skip, no-email fallback, fail-open.

Phase 2 — plan change (upgrade/downgrade):
  - upgrade vs downgrade copy + old→new facts.
  - payload assembly from subscription + plan, with explicit previous-plan/type/price.
  - renewal-history fallback when previous-plan context is omitted.
  - build_from_kind routing and plan-change subjects.
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


# --------------------------------------------------------------------------- #
# Phase 2 — plan change (upgrade / downgrade)
# --------------------------------------------------------------------------- #

def _renewal_history(**overrides):
    values = {
        "previous_plan_name": "Basic",
        "previous_plan_tier": "basic",
        "renewal_type": "upgrade",
        "payment_amount": "79.00",
        "billing_cycle": types.SimpleNamespace(value="monthly"),
        "plan_date": "2026-09-03",
        "email_type": "plan_change",
    }
    values.update(overrides)
    return types.SimpleNamespace(**values)


def _user_subscription(plan_id=2, billing_cycle="monthly"):
    return types.SimpleNamespace(
        user_id="u1",
        plan_id=plan_id,
        billing_cycle=types.SimpleNamespace(value=billing_cycle),
        current_period_start=datetime_obj("2026-09-03"),
        current_period_end=datetime_obj("2026-10-03"),
        is_active=True,
    )


def _plan_change_session():
    return _FakeSession({
        "usersubscription": [_user_subscription(plan_id=2)],
        "subscriptionplan": [_plan(name="Pro", tier="pro")],
        "subscriptionrenewalhistory": [_renewal_history(previous_plan_name="Basic", renewal_type="upgrade")],
    })


def test_plan_change_payload_defaults():
    # No renewal history or explicit context → graceful empty defaults.
    session = _FakeSession({
        "usersubscription": [_user_subscription(plan_id=2)],
        "subscriptionplan": [_plan(name="Pro", tier="pro")],
        "subscriptionrenewalhistory": [],
    })
    p = billing.build_plan_change_payload("u1", db=session, first_name="Ada")
    assert p.kind == "plan_change"
    assert p.plan_name == "Pro"
    assert p.first_name == "Ada"
    assert p.previous_plan_name == ""
    assert p.renewal_type == ""


def test_plan_change_payload_uses_explicit_context():
    session = _plan_change_session()
    p = billing.build_plan_change_payload(
        "u1", db=session, first_name="Ada",
        previous_plan_name="Basic", previous_plan_tier="basic",
        renewal_type="upgrade", price="79",
    )
    assert p.previous_plan_name == "Basic"
    assert p.previous_plan_tier == "basic"
    assert p.renewal_type == "upgrade"
    assert p.price == "79"


def test_plan_change_falls_back_to_renewal_history():
    # No explicit context → pull previous-plan facts from latest renewal history.
    session = _plan_change_session()
    p = billing.build_plan_change_payload("u1", db=session, first_name="Ada")
    assert p.previous_plan_name == "Basic"
    assert p.renewal_type == "upgrade"


def test_build_from_kind_routes_plan_change(monkeypatch):
    monkeypatch.setattr(billing, "_contact_email", lambda uid, db: "a@b.io")
    monkeypatch.setattr(billing, "_opted_in", lambda uid, db: True)
    session = _plan_change_session()
    p = billing.build_from_kind(
        "u1", db=session, kind="plan_change", first_name="Ada",
        extra={"previous_plan_name": "Basic", "previous_plan_tier": "basic", "renewal_type": "upgrade", "price": "79"},
    )
    assert p.kind == "plan_change"
    assert p.previous_plan_name == "Basic"
    assert p.renewal_type == "upgrade"
    assert p.plan_name == "Pro"


def test_plan_change_upgrade_render():
    p = billing.BillingEmailPayload(
        kind="plan_change", first_name="Ada", plan_name="Pro", plan_tier="pro",
        previous_plan_name="Basic", previous_plan_tier="basic",
        renewal_type="upgrade", price="$79",
    )
    html = billing.render_billing_email(p, verbose=True)
    assert "UPGRADED" in html
    assert "Welcome to Pro, Ada" in html
    assert "Basic" in html
    assert "$79" in html


def test_plan_change_downgrade_render():
    p = billing.BillingEmailPayload(
        kind="plan_change", first_name="Ada", plan_name="Basic", plan_tier="basic",
        previous_plan_name="Pro", previous_plan_tier="pro",
        renewal_type="downgrade", price="$29",
    )
    html = billing.render_billing_email(p, verbose=True)
    assert "PLAN CHANGED" in html
    assert "Your plan is now Basic, Ada" in html
    assert "Pro" in html
    assert "$29" in html


def test_plan_change_generic_render():
    p = billing.BillingEmailPayload(kind="plan_change", first_name="Ada", plan_name="Pro", renewal_type="renewal")
    html = billing.render_billing_email(p, verbose=True)
    assert "PLAN UPDATE" in html
    assert "Your ALwrity plan: Pro, Ada" in html


def test_plan_change_upgrade_subject():
    subj = billing._subject_for("plan_change", billing.BillingEmailPayload(
        first_name="Ada", plan_name="Pro", renewal_type="upgrade",
    ))
    assert "You're on Pro now, Ada" in subj


def test_plan_change_downgrade_subject():
    subj = billing._subject_for("plan_change", billing.BillingEmailPayload(
        first_name="Ada", plan_name="Basic", renewal_type="downgrade",
    ))
    assert "Your ALwrity plan is now Basic" in subj


def test_plan_change_generic_subject():
    subj = billing._subject_for("plan_change", billing.BillingEmailPayload(
        first_name="Ada", plan_name="Pro", renewal_type="renewal",
    ))
    assert "Your ALwrity plan: Pro" in subj


# --------------------------------------------------------------------------- #
# Phase 3 — renewal receipt
# --------------------------------------------------------------------------- #

def test_renewal_receipt_payload_defaults():
    session = _FakeSession({
        "usersubscription": [_user_subscription(plan_id=2)],
        "subscriptionplan": [_plan(name="Pro", tier="pro")],
    })
    p = billing.build_renewal_receipt_payload("u1", db=session, first_name="Ada")
    assert p.kind == "renewal_receipt"
    assert p.plan_name == "Pro"
    assert p.first_name == "Ada"
    assert p.billing_cycle == "monthly"
    assert p.price == "$79"


def test_renewal_receipt_payload_with_explicit_price():
    session = _FakeSession({
        "usersubscription": [_user_subscription(plan_id=2)],
        "subscriptionplan": [_plan(name="Pro", tier="pro")],
    })
    p = billing.build_renewal_receipt_payload(
        "u1", db=session, first_name="Ada",
        price="99.00", period_start="1704067200", period_end="1706659200",
    )
    assert p.kind == "renewal_receipt"
    assert p.price == "$99"
    assert p.period_start == "Jan 01, 2024"
    assert p.period_end == "Jan 31, 2024"


def test_renewal_receipt_render():
    p = billing.BillingEmailPayload(
        kind="renewal_receipt", first_name="Ada", plan_name="Pro", plan_tier="pro",
        price="$79", billing_cycle="monthly", period_start="Sep 03, 2026", period_end="Oct 03, 2026",
        renewal_date="Oct 03, 2026",
    )
    html = billing.render_billing_email(p, verbose=True)
    assert "RENEWED" in html
    assert "Thanks for staying with us, Ada" in html
    assert "Pro" in html
    assert "$79" in html
    assert "Sep 03, 2026 – Oct 03, 2026" in html or "Sep 03, 2026 – Oct 03" in html
    assert "Next renewal date" in html
    assert "Oct 03, 2026" in html
    assert "Billing settings" in html


def test_renewal_receipt_subject_with_first_name():
    subj = billing._subject_for("renewal_receipt", billing.BillingEmailPayload(
        first_name="Ada", plan_name="Pro",
    ))
    assert "Your Pro plan has renewed, Ada" in subj
    assert "receipt inside" in subj


def test_renewal_receipt_subject_without_first_name():
    subj = billing._subject_for("renewal_receipt", billing.BillingEmailPayload(
        plan_name="Basic",
    ))
    assert "Your Basic plan has renewed" in subj
    assert "receipt inside" in subj


def test_build_from_kind_routes_renewal_receipt(monkeypatch):
    monkeypatch.setattr(billing, "_contact_email", lambda uid, db: "a@b.io")
    monkeypatch.setattr(billing, "_opted_in", lambda uid, db: True)
    session = _FakeSession({
        "usersubscription": [_user_subscription(plan_id=2)],
        "subscriptionplan": [_plan(name="Pro", tier="pro")],
    })
    p = billing.build_from_kind(
        "u1", db=session, kind="renewal_receipt", first_name="Ada",
        extra={"price": "99", "period_start": "1704067200", "period_end": "1706659200"},
    )
    assert p.kind == "renewal_receipt"
    assert p.plan_name == "Pro"
    assert p.price == "$99"


# --------------------------------------------------------------------------- #
# Phase 4 — payment failure
# --------------------------------------------------------------------------- #

def test_payment_failed_payload_defaults():
    session = _FakeSession({
        "usersubscription": [_user_subscription(plan_id=2)],
        "subscriptionplan": [_plan(name="Pro", tier="pro")],
    })
    p = billing.build_payment_failed_payload("u1", db=session, first_name="Ada")
    assert p.kind == "payment_failed"
    assert p.plan_name == "Pro"
    assert p.first_name == "Ada"
    assert p.price == "$79"


def test_payment_failed_payload_with_explicit_price():
    session = _FakeSession({
        "usersubscription": [_user_subscription(plan_id=2)],
        "subscriptionplan": [_plan(name="Pro", tier="pro")],
    })
    p = billing.build_payment_failed_payload(
        "u1", db=session, first_name="Ada",
        price="49.50", failure_reason="Your card was declined",
    )
    assert p.kind == "payment_failed"
    assert p.price == "$50"  # rounded
    assert p.first_name == "Ada"


def test_payment_failed_render():
    p = billing.BillingEmailPayload(
        kind="payment_failed", first_name="Ada", plan_name="Pro", price="$79",
    )
    html = billing.render_billing_email(p, verbose=True)
    assert "PAYMENT FAILED" in html
    assert "We couldn't process your payment" in html
    assert "Hi Ada" in html
    assert "Pro" in html
    assert "$79" in html
    assert "Update payment method" in html
    assert "settings/billing" in html


def test_payment_failed_subject():
    subj = billing._subject_for("payment_failed", billing.BillingEmailPayload(
        first_name="Ada", plan_name="Pro",
    ))
    assert "Action required" in subj
    assert "payment failed" in subj


def test_build_from_kind_routes_payment_failed(monkeypatch):
    monkeypatch.setattr(billing, "_contact_email", lambda uid, db: "a@b.io")
    monkeypatch.setattr(billing, "_opted_in", lambda uid, db: True)
    session = _FakeSession({
        "usersubscription": [_user_subscription(plan_id=2)],
        "subscriptionplan": [_plan(name="Pro", tier="pro")],
    })
    p = billing.build_from_kind(
        "u1", db=session, kind="payment_failed", first_name="Ada",
        extra={"price": "49.50", "failure_reason": "Insufficient funds"},
    )
    assert p.kind == "payment_failed"
    assert p.plan_name == "Pro"
    assert p.price == "$50"