"""Transactional billing / payment emails for ALwrity.

Phase 1 implements the **payment confirmation** email: sent once when a user
completes a Stripe checkout and their subscription is activated. It thanks the
user, confirms the payment, summarises their plan (name, price, billing cycle,
renewal date, feature highlights), and points them to their dashboard.

The service is designed to grow: ``render_billing_email`` dispatches on
``BillingEmailPayload.kind`` so later phases can add ``plan_change``,
``renewal_receipt`` and ``payment_failed`` variants without touching existing
code.

Mirrors the onboarding welcome email architecture:
  * a pure-function renderer over a dataclass payload, and
  * a best-effort, fail-open, idempotent ``send_billing_email`` that alone
    touches the database / Resend.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ────────────────────────────────────────────────────────────────────────
# Payload
# ────────────────────────────────────────────────────────────────────────

@dataclass
class BillingEmailPayload:
    """Everything a billing renderer needs, personalised per user.

    Every field is optional so the email degrades gracefully on sparse data.
    ``kind`` selects which variant ``render_billing_email`` produces.
    """
    kind: str = "payment_confirmation"  # payment_confirmation | plan_change | renewal_receipt | payment_failed
    first_name: str = ""

    # Plan / billing
    plan_name: str = ""
    plan_tier: str = ""
    billing_cycle: str = ""          # "monthly" | "yearly"
    price: str = ""                  # display string, e.g. "$79"
    period_start: str = ""
    period_end: str = ""
    renewal_date: str = ""
    features: List[str] = field(default_factory=list)

    # Plan change (Phase 2+)
    previous_plan_name: str = ""
    previous_plan_tier: str = ""
    renewal_type: str = ""           # "upgrade" | "downgrade" | "renewal" | "new"

    # URLs
    dashboard_url: str = "https://alwrity.com/dashboard"
    billing_url: str = "https://alwrity.com/settings/billing"


# ────────────────────────────────────────────────────────────────────────
# Payload acquisition
# ────────────────────────────────────────────────────────────────────────

def _plan_features(plan) -> List[str]:
    try:
        feats = getattr(plan, "features", None)
        if isinstance(feats, list):
            return [str(f) for f in feats if f]
        if isinstance(feats, dict):
            flagged = [k for k, v in feats.items() if v]
            return [str(f) for f in flagged if f]
    except Exception:
        pass
    return []


def build_payment_confirmation_payload(user_id: str, db, first_name: str = "") -> BillingEmailPayload:
    """Assemble a personalised payment-confirmation payload from the user's
    just-activated subscription. Never raises on missing data."""
    payload = BillingEmailPayload(kind="payment_confirmation", first_name=first_name or "")

    try:
        from models.subscription_models import UserSubscription, SubscriptionPlan

        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id
        ).first()

        if subscription is None:
            payload.price = "$0"
            return payload

        plan = None
        if subscription.plan_id:
            try:
                plan = db.query(SubscriptionPlan).filter(
                    SubscriptionPlan.id == subscription.plan_id
                ).first()
            except Exception:
                plan = None

        # Plan name / tier
        if plan is not None:
            payload.plan_name = getattr(plan, "name", "") or ""
            try:
                payload.plan_tier = str(plan.tier.value if hasattr(plan.tier, "value") else plan.tier)
            except Exception:
                payload.plan_tier = ""

        # Billing cycle
        cycle = getattr(subscription, "billing_cycle", None)
        try:
            payload.billing_cycle = str(cycle.value if hasattr(cycle, "value") else cycle) or ""
        except Exception:
            payload.billing_cycle = ""

        # Price
        price = None
        if plan is not None:
            try:
                if payload.billing_cycle == "yearly":
                    price = getattr(plan, "price_yearly", None)
                else:
                    price = getattr(plan, "price_monthly", None)
            except Exception:
                price = None
        if price is None:
            price = 0.0
        payload.price = _money(price)

        # Periods
        payload.period_start = _fmt_dt(getattr(subscription, "current_period_start", None))
        payload.period_end = _fmt_dt(getattr(subscription, "current_period_end", None))
        if payload.period_end:
            payload.renewal_date = payload.period_end

        # Features
        if plan is not None:
            payload.features = _plan_features(plan)[:5]
    except Exception as e:
        logger.warning(f"Failed to build payment-confirmation payload for {user_id}: {e}")

    return payload


def build_plan_change_payload(user_id: str, db, first_name: str = "",
                              previous_plan_name: str = "", previous_plan_tier: str = "",
                              renewal_type: str = "", price: str = "") -> BillingEmailPayload:
    """Assemble a personalised plan-change payload.

    ``previous_plan_*``, ``renewal_type`` and ``price`` are best supplied by the
    caller (the /subscribe endpoint has them in scope); when omitted we fall back
    to the most recent ``SubscriptionRenewalHistory`` and the current plan.
    Never raises on missing data.
    """
    payload = BillingEmailPayload(kind="plan_change", first_name=first_name or "")
    payload.renewal_type = renewal_type or ""
    payload.previous_plan_name = previous_plan_name or ""
    payload.previous_plan_tier = previous_plan_tier or ""

    try:
        from models.subscription_models import UserSubscription, SubscriptionPlan

        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id
        ).first()

        if subscription is None:
            payload.price = price or "$0"
            return payload

        plan = None
        if subscription.plan_id:
            try:
                plan = db.query(SubscriptionPlan).filter(
                    SubscriptionPlan.id == subscription.plan_id
                ).first()
            except Exception:
                plan = None

        if plan is not None:
            payload.plan_name = getattr(plan, "name", "") or ""
            payload.features = _plan_features(plan)[:5]
            if not price:
                cycle = getattr(subscription, "billing_cycle", None)
                cyc = ""
                try:
                    cyc = str(cycle.value if hasattr(cycle, "value") else cycle) or ""
                except Exception:
                    cyc = ""
                try:
                    raw = getattr(plan, "price_yearly" if cyc == "yearly" else "price_monthly", None)
                    payload.price = _money(raw)
                except Exception:
                    payload.price = "$0"
            else:
                payload.price = price

        # Cycle + periods from the active subscription
        cycle = getattr(subscription, "billing_cycle", None)
        try:
            payload.billing_cycle = str(cycle.value if hasattr(cycle, "value") else cycle) or ""
        except Exception:
            payload.billing_cycle = ""
        payload.period_start = _fmt_dt(getattr(subscription, "current_period_start", None))
        payload.period_end = _fmt_dt(getattr(subscription, "current_period_end", None))
        if payload.period_end:
            payload.renewal_date = payload.period_end

        # Fall back to the most recent renewal history for previous-plan context
        if not payload.previous_plan_name and not payload.renewal_type:
            try:
                from models.subscription_models import SubscriptionRenewalHistory
                hist = db.query(SubscriptionRenewalHistory).filter(
                    SubscriptionRenewalHistory.user_id == user_id
                ).order_by(SubscriptionRenewalHistory.created_at.desc()).first()
                if hist is not None:
                    payload.previous_plan_name = getattr(hist, "previous_plan_name", "") or ""
                    payload.previous_plan_tier = getattr(hist, "previous_plan_tier", "") or ""
                    payload.renewal_type = getattr(hist, "renewal_type", "") or ""
            except Exception:
                pass
    except Exception as e:
        logger.warning(f"Failed to build plan-change payload for {user_id}: {e}")
        payload.price = price or payload.price

    return payload


def build_renewal_receipt_payload(user_id: str, db, first_name: str = "",
                                  price: str = "", period_start: str = "",
                                  period_end: str = "") -> BillingEmailPayload:
    """Assemble a renewal-receipt payload.

    ``price`` and ``period_start``/``period_end`` are best supplied by the caller
    (both hook sites have them in scope); when omitted we derive price from the
    current plan and periods from the active subscription. Never raises on missing
    data.
    """
    payload = BillingEmailPayload(
        kind="renewal_receipt",
        first_name=first_name or "",
        price=price or "",
    )

    try:
        from models.subscription_models import UserSubscription, SubscriptionPlan

        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id
        ).first()

        if subscription is None:
            payload.price = _money(payload.price) if payload.price else "$0"
            return payload

        plan = None
        if subscription.plan_id:
            try:
                plan = db.query(SubscriptionPlan).filter(
                    SubscriptionPlan.id == subscription.plan_id
                ).first()
            except Exception:
                plan = None

        # Billing cycle + plan name/tier/features
        cycle = getattr(subscription, "billing_cycle", None)
        try:
            payload.billing_cycle = str(cycle.value if hasattr(cycle, "value") else cycle) or ""
        except Exception:
            payload.billing_cycle = ""

        if plan is not None:
            payload.plan_name = getattr(plan, "name", "") or ""
            try:
                payload.plan_tier = str(plan.tier.value if hasattr(plan.tier, "value") else plan.tier)
            except Exception:
                payload.plan_tier = ""
            payload.features = _plan_features(plan)[:5]
            if not payload.price:
                try:
                    raw = getattr(plan, "price_yearly" if payload.billing_cycle == "yearly" else "price_monthly", None)
                    payload.price = _money(raw)
                except Exception:
                    payload.price = "$0"
            else:
                payload.price = _money(payload.price) if _is_raw_amount(payload.price) else payload.price

        # Periods: caller-provided take precedence, else fall back to subscription.
        if period_start:
            payload.period_start = _fmt_dt(_to_ts(period_start))
        else:
            payload.period_start = _fmt_dt(getattr(subscription, "current_period_start", None))
        if period_end:
            payload.period_end = _fmt_dt(_to_ts(period_end))
        else:
            payload.period_end = _fmt_dt(getattr(subscription, "current_period_end", None))
        if payload.period_end:
            payload.renewal_date = payload.period_end
    except Exception as e:
        logger.warning(f"Failed to build renewal-receipt payload for {user_id}: {e}")
        if not payload.price:
            payload.price = "$0"

    return payload


def _is_raw_amount(value: str) -> bool:
    """True if ``value`` looks like a raw numeric amount (e.g. Stripe minor units)
    rather than an already-formatted display string like ``$79``."""
    try:
        float(value)
        return True
    except (TypeError, ValueError):
        return False


def _to_ts(value: Any):
    """Normalise seconds-since-epoch or ISO/date string into a form _fmt_dt accepts."""
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, str) and value.isdigit():
        return float(value)
    return value


def _money(value: Any) -> str:
    try:
        f = float(value or 0)
    except (TypeError, ValueError):
        return "$0"
    f = round(f)
    return f"${f:,}"
    # e.g. $79, $1,990


def _fmt_dt(dt: Any) -> str:
    if not dt:
        return ""
    try:
        if isinstance(dt, (int, float)):
            dt = datetime.fromtimestamp(dt)
        return dt.strftime("%b %d, %Y")
    except Exception:
        return ""


# ────────────────────────────────────────────────────────────────────────
# Renderer
# ────────────────────────────────────────────────────────────────────────

def render_billing_email(payload: BillingEmailPayload, verbose: bool = True) -> str:
    """Render the billing email for the payload's ``kind``."""
    if payload.kind == "payment_confirmation":
        return _render_payment_confirmation(payload)
    if payload.kind == "plan_change":
        return _render_plan_change(payload)
    if payload.kind == "renewal_receipt":
        return _render_renewal_receipt(payload)
    # Later phases add: payment_failed.
    logger.warning(f"render_billing_email: unknown kind {payload.kind!r}; rendering confirmation")
    return _render_payment_confirmation(payload)


def _render_payment_confirmation(payload: BillingEmailPayload) -> str:
    from services.email_templates import (
        _FONT, _esc, _confetti,
        INK, ORANGE, AMBER, GREEN, SLATE_400, SLATE_800,
    )

    first = _esc(payload.first_name) or "there"
    plan = _esc(payload.plan_name or "your plan")
    cycle_txt = "yearly" if payload.billing_cycle == "yearly" else "monthly"
    price_suffix = "billed yearly" if payload.billing_cycle == "yearly" else "per month"

    period_line = ""
    if payload.renewal_date:
        period_line = (
            f"Your plan renews on <strong style='color:{INK}'>{_esc(payload.renewal_date)}</strong>. "
            "We'll send you a reminder before then."
        )
    else:
        period_line = "Your plan covers everything your AI team needs for the next billing period."

    # Feature highlights
    feats = [f for f in payload.features if f]
    if feats:
        feat_html = ""
        for f in feats:
            feat_html += (
                f"<tr><td style='width:22px;vertical-align:top;padding:6px 0;font-size:14px;"
                f"color:{GREEN};'>&#10003;</td>"
                f"<td style='padding:6px 0;font-family:{_FONT};font-size:13px;color:{SLATE_800};"
                f"line-height:1.5;'>{_esc(f)}</td></tr>"
            )
        features_block = (
            f"<table width='100%' cellpadding='0' cellspacing='0' border='0'>"
            f"<tr><td style='padding:14px 22px;font-family:{_FONT};font-size:12px;font-weight:800;"
            f"color:{SLATE_400};text-transform:uppercase;letter-spacing:1px;'>Included in {plan}</td></tr>"
            f"{feat_html}"
            f"</table>"
        )
    else:
        features_block = ""

    return f"""<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>Payment confirmed — welcome to {plan}</title>
<style>
  body, table, td, a {{ -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }}
  table, td {{ mso-table-lspace:0pt; mso-table-rspace:0pt; }}
  body {{ margin:0 !important; padding:0 !important; width:100% !important; background-color:#0f172a; }}
  @media only screen and (max-width:620px) {{
    .email-container {{ width:100% !important; padding:14px !important; }}
    .hide-mobile {{ display:none !important; }}
  }}
</style>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:{_FONT};">

<div style="display:none;font-size:1px;color:#0f172a;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Payment confirmed! Welcome to {plan}, {first}.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(160deg,#052e16 0%,#15803d 26%,#0d9488 48%,#2563eb 70%,#6d28d9 100%);">
<tr><td align="center" style="padding:34px 14px;">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-container" style="max-width:600px;width:100%;position:relative;">

  <div class="hide-mobile" style="position:absolute;top:10px;left:0;right:0;height:130px;pointer-events:none;">
    {_confetti(11, '6px')}{_confetti(5, '40px')}{_confetti(8, '74px')}
  </div>

  <!-- Hero -->
  <tr>
    <td style="padding:0 0 16px 0;text-align:center;">
      <div style="font-family:{_FONT};font-size:12px;color:#bbf7d0;letter-spacing:2px;">&#10003; &nbsp;PAYMENT CONFIRMED&nbsp; &#10003;</div>
      <div style="font-family:{_FONT};font-size:36px;font-weight:800;color:#ffffff;line-height:1.15;margin-top:8px;">
        Welcome to {plan}, {first}! 🎉
      </div>
      <div style="font-family:{_FONT};font-size:16px;color:#dcfce7;margin-top:8px;line-height:1.5;">
        Your <strong style="color:#fef08a;">{plan}</strong> plan is active — your entire AI
        content team is ready to start working for you.
      </div>
    </td>
  </tr>

  <!-- Receipt card -->
  <tr>
    <td style="padding:0 0 16px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(90deg,#f0fdf4,#eff6ff);padding:18px 22px;">
            <div style="font-family:{_FONT};font-size:16px;font-weight:800;color:{INK};">Your {plan} billing</div>
            <div style="font-family:{_FONT};font-size:12px;color:{SLATE_400};margin-top:2px;">Payment received. No action needed.</div>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 22px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family:{_FONT};font-size:13px;color:{SLATE_400};padding:5px 0;">Plan</td>
                <td align="right" style="font-family:{_FONT};font-size:13px;font-weight:700;color:{SLATE_800};padding:5px 0;">{plan}</td>
              </tr>
              <tr>
                <td style="font-family:{_FONT};font-size:13px;color:{SLATE_400};padding:5px 0;">Billing cycle</td>
                <td align="right" style="font-family:{_FONT};font-size:13px;font-weight:700;color:{SLATE_800};padding:5px 0;text-transform:capitalize;">{_esc(cycle_txt)}</td>
              </tr>
              <tr>
                <td style="font-family:{_FONT};font-size:13px;color:{SLATE_400};padding:5px 0;">Amount due now</td>
                <td align="right" style="font-family:{_FONT};font-size:15px;font-weight:800;color:{INK};padding:5px 0;">{_esc(payload.price)} <span style="font-size:12px;font-weight:600;color:{SLATE_400};">{_esc(price_suffix)}</span></td>
              </tr>
            </table>
            <div style="border-top:1px dashed #cbd5e1;margin:12px 0;"></div>
            <div style="font-family:{_FONT};font-size:12px;color:{SLATE_400};line-height:1.6;">{period_line}</div>
          </td>
        </tr>
        {features_block}
      </table>
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td style="padding:0 0 16px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.11);border:1px solid rgba(255,255,255,0.22);border-radius:16px;">
        <tr>
          <td style="padding:22px 24px;text-align:center;">
            <div style="font-family:{_FONT};font-size:16px;font-weight:800;color:#ffffff;">
              Ready to put your AI team to work?
            </div>
            <div style="font-family:{_FONT};font-size:13px;color:#c7d2fe;margin-top:6px;line-height:1.6;">
              Head to your dashboard to see your daily plan, set a content strategy,
              and let the agents start creating on-brand content for you.
            </div>
            <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin-top:18px;">
              <tr>
                <td style="border-radius:999px;background:linear-gradient(90deg,{AMBER},{ORANGE});padding:2px;">
                  <a href="{_esc(payload.dashboard_url)}" target="_blank" style="display:inline-block;padding:14px 34px;font-family:{_FONT};font-size:15px;font-weight:800;color:{INK};text-decoration:none;border-radius:999px;background:{AMBER};">
                    Open my dashboard &rarr;
                  </a>
                </td>
              </tr>
            </table>
            <div style="font-family:{_FONT};font-size:12px;color:#cbd5e1;margin-top:12px;">
              Manage your plan and billing anytime:&nbsp;
              <a href="{_esc(payload.billing_url)}" style="color:#fef08a;text-decoration:underline;">Billing settings</a>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding:0 0 8px 0;text-align:center;">
      <div style="font-family:{_FONT};font-size:12px;color:#94a3b8;line-height:1.7;">
        You're receiving this because you completed your ALwrity subscription.<br>
        <a href="https://alwrity.com/settings/email-preferences" style="color:#cbd5e1;text-decoration:underline;">Email preferences</a>
        &nbsp;·&nbsp;
        <a href="#" style="color:#cbd5e1;text-decoration:underline;">Unsubscribe</a>
      </div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>"""


def _render_plan_change(payload: BillingEmailPayload) -> str:
    from services.email_templates import (
        _FONT, _esc, _confetti,
        INK, ORANGE, AMBER, GREEN, LIME, ROSE, SLATE_300, SLATE_400, SLATE_800,
    )

    first = _esc(payload.first_name) or "there"
    new_plan = _esc(payload.plan_name or "your new plan")
    old_plan = _esc(payload.previous_plan_name) or "your previous plan"

    renewal_type = (payload.renewal_type or "").lower()
    is_upgrade = renewal_type == "upgrade"
    is_downgrade = renewal_type == "downgrade"

    if is_upgrade:
        headline = f"Welcome to {new_plan}, {first}! 🚀"
        accent = AMBER
        sub = f"You've moved up from <strong style='color:{SLATE_800}'>{old_plan}</strong> to "
        sub2 = f"<strong style='color:{INK}'>{new_plan}</strong> — more power, more output, more growth."
        badge = f"<span style='background:{LIME};color:{INK};padding:3px 10px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:0.5px;'>UPGRADED</span>"
    elif is_downgrade:
        headline = f"Your plan is now {new_plan}, {first}"
        accent = ROSE
        sub = f"You switched from <strong style='color:{SLATE_800}'>{old_plan}</strong> to "
        sub2 = f"<strong style='color:{INK}'>{new_plan}</strong>. Everything we do will stay within your new limits."
        badge = f"<span style='background:{ROSE};color:#ffffff;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:0.5px;'>PLAN CHANGED</span>"
    else:
        headline = f"Your ALwrity plan: {new_plan}, {first}"
        accent = AMBER
        sub = f"Your plan is now "
        sub2 = f"<strong style='color:{INK}'>{new_plan}</strong>. Here's what that covers."
        badge = f"<span style='background:rgba(255,255,255,0.18);color:#ffffff;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:0.5px;'>PLAN UPDATE</span>"

    # Compare features: highlight what the new plan adds (net-new over previous).
    feats = [f for f in payload.features if f]
    feat_html = ""
    if feats:
        rows = ""
        for f in feats:
            rows += (
                f"<tr><td style='width:22px;vertical-align:top;padding:6px 0;font-size:14px;"
                f"color:{GREEN};'>&#10003;</td>"
                f"<td style='padding:6px 0;font-family:{_FONT};font-size:13px;color:{SLATE_800};"
                f"line-height:1.5;'>{_esc(f)}</td></tr>"
            )
        feat_html = (
            f"<table width='100%' cellpadding='0' cellspacing='0' border='0'>"
            f"<tr><td style='padding:12px 22px;font-family:{_FONT};font-size:12px;font-weight:800;"
            f"color:{SLATE_400};text-transform:uppercase;letter-spacing:1px;'>Included in {new_plan}</td></tr>"
            f"{rows}"
            f"</table>"
        )

    plan_line = ""
    if payload.price:
        plan_line = (
            f"Plan: <strong style='color:{INK}'>{new_plan}</strong> &nbsp;·&nbsp; "
            f"{_esc(payload.price)}<span style='font-size:12px;color:{SLATE_400};'> "
            f"{'billed yearly' if payload.billing_cycle == 'yearly' else 'per month'}</span>"
        )
    renew_line = ""
    if payload.renewal_date:
        renew_line = (
            f"Your billing period now runs through "
            f"<strong style='color:{SLATE_800}'>{_esc(payload.renewal_date)}</strong>."
        )

    return f"""<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>Your ALwrity plan changed to {new_plan}</title>
<style>
  body, table, td, a {{ -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }}
  table, td {{ mso-table-lspace:0pt; mso-table-rspace:0pt; }}
  body {{ margin:0 !important; padding:0 !important; width:100% !important; background-color:#0f172a; }}
  @media only screen and (max-width:620px) {{
    .email-container {{ width:100% !important; padding:14px !important; }}
    .hide-mobile {{ display:none !important; }}
  }}
</style>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:{_FONT};">

<div style="display:none;font-size:1px;color:#0f172a;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Your ALwrity plan is now {new_plan}.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(160deg,#052e16 0%,#15803d 26%,#0d9488 48%,#2563eb 70%,#6d28d9 100%);">
<tr><td align="center" style="padding:34px 14px;">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-container" style="max-width:600px;width:100%;position:relative;">

  <div class="hide-mobile" style="position:absolute;top:10px;left:0;right:0;height:130px;pointer-events:none;">
    {_confetti(21, '6px')}{_confetti(13, '40px')}{_confetti(17, '74px')}
  </div>

  <!-- Hero -->
  <tr>
    <td style="padding:0 0 16px 0;text-align:center;">
      {badge}
      <div style="font-family:{_FONT};font-size:32px;font-weight:800;color:#ffffff;line-height:1.15;margin-top:10px;">
        {headline}
      </div>
      <div style="font-family:{_FONT};font-size:15px;color:#dcfce7;margin-top:8px;line-height:1.6;">
        {sub}{sub2}
      </div>
    </td>
  </tr>

  <!-- Plan detail card -->
  <tr>
    <td style="padding:0 0 16px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(90deg,#f0fdf4,#eff6ff);padding:18px 22px;">
            <div style="font-family:{_FONT};font-size:16px;font-weight:800;color:{INK};">Your {new_plan} plan</div>
            <div style="font-family:{_FONT};font-size:12px;color:{SLATE_400};margin-top:2px;">
              {('From ' + old_plan) if old_plan and old_plan != 'your previous plan' else 'ALwrity subscription'}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 22px;">
            <div style="font-family:{_FONT};font-size:13px;font-weight:700;color:{SLATE_800};padding:4px 0;">{plan_line}</div>
            {f"<div style='font-family:{_FONT};font-size:12px;color:{SLATE_400};padding:4px 0;'>{renew_line}</div>" if renew_line else ""}
          </td>
        </tr>
        {feat_html}
      </table>
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td style="padding:0 0 16px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.11);border:1px solid rgba(255,255,255,0.22);border-radius:16px;">
        <tr>
          <td style="padding:22px 24px;text-align:center;">
            <div style="font-family:{_FONT};font-size:16px;font-weight:800;color:#ffffff;">
              {('Your AI team is ready to push further.' if is_upgrade else 'Keep going — your plan is set.')}
            </div>
            <div style="font-family:{_FONT};font-size:13px;color:#c7d2fe;margin-top:6px;line-height:1.6;">
              Head to your dashboard to see your daily plan and let the agents get to work on your goals.
            </div>
            <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin-top:18px;">
              <tr>
                <td style="border-radius:999px;background:linear-gradient(90deg,{AMBER},{ORANGE});padding:2px;">
                  <a href="{_esc(payload.dashboard_url)}" target="_blank" style="display:inline-block;padding:14px 34px;font-family:{_FONT};font-size:15px;font-weight:800;color:{INK};text-decoration:none;border-radius:999px;background:{AMBER};">
                    Open my dashboard &rarr;
                  </a>
                </td>
              </tr>
            </table>
            <div style="font-family:{_FONT};font-size:12px;color:#cbd5e1;margin-top:12px;">
              Manage your plan and billing anytime:&nbsp;
              <a href="{_esc(payload.billing_url)}" style="color:#fef08a;text-decoration:underline;">Billing settings</a>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding:0 0 8px 0;text-align:center;">
      <div style="font-family:{_FONT};font-size:12px;color:#94a3b8;line-height:1.7;">
        You're receiving this because you changed your ALwrity subscription.<br>
        <a href="https://alwrity.com/settings/email-preferences" style="color:#cbd5e1;text-decoration:underline;">Email preferences</a>
        &nbsp;·&nbsp;
        <a href="#" style="color:#cbd5e1;text-decoration:underline;">Unsubscribe</a>
      </div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>"""


def _render_renewal_receipt(payload: BillingEmailPayload) -> str:
    from services.email_templates import (
        _FONT, _esc,
        INK, AMBER, GREEN, SLATE_300, SLATE_400, SLATE_800,
    )

    first = _esc(payload.first_name) or "there"
    plan = _esc(payload.plan_name or "your plan")
    amount = _esc(payload.price) or "$0"
    period = f"{_esc(payload.period_start)} – {_esc(payload.period_end)}" if payload.period_start or payload.period_end else payload.renewal_date or ""
    cycle_txt = "yearly" if payload.billing_cycle == "yearly" else "monthly"

    period_row = ""
    if payload.renewal_date:
        period_row = (
            f"<tr><td style='padding:6px 0;font-family:{_FONT};font-size:13px;color:{SLATE_800};'>"
            f"Next renewal date"
            f"</td><td style='padding:6px 0;font-family:{_FONT};font-size:13px;font-weight:700;text-align:right;color:{INK};'>"
            f"{_esc(payload.renewal_date)}</td></tr>"
        )

    total_row = (
        f"<tr><td style='padding:10px 0 0 0;border-top:2px solid {SLATE_300};font-family:{_FONT};"
        f"font-size:14px;font-weight:800;color:{INK};'>Total charged</td>"
        f"<td style='padding:10px 0 0 0;border-top:2px solid {SLATE_300};font-family:{_FONT};"
        f"font-size:16px;font-weight:800;text-align:right;color:{INK};'>{amount}</td></tr>"
    )

    return f"""<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>Your {plan} plan has renewed</title>
<style>
  body, table, td, a {{ -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }}
  table, td {{ mso-table-lspace:0pt; mso-table-rspace:0pt; }}
  body {{ margin:0 !important; padding:0 !important; width:100% !important; background-color:#0f172a; }}
  @media only screen and (max-width:620px) {{
    .email-container {{ width:100% !important; padding:14px !important; }}
    .hide-mobile {{ display:none !important; }}
  }}
</style>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:{_FONT};">

<div style="display:none;font-size:1px;color:#0f172a;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Your {plan} plan has renewed · {amount}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(160deg,#052e16 0%,#15803d 26%,#0d9488 48%,#2563eb 70%,#6d28d9 100%);">
<tr><td align="center" style="padding:34px 14px;">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-container" style="max-width:600px;width:100%;position:relative;">

  <!-- Hero -->
  <tr>
    <td style="padding:0 0 16px 0;text-align:center;">
      <span style="background:rgba(255,255,255,0.18);color:#ffffff;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:0.5px;">RENEWED</span>
      <div style="font-family:{_FONT};font-size:30px;font-weight:800;color:#ffffff;line-height:1.15;margin-top:10px;">
        Thanks for staying with us, {first}
      </div>
      <div style="font-family:{_FONT};font-size:15px;color:#dcfce7;margin-top:8px;line-height:1.6;">
        Your {plan} plan ({cycle_txt}) has been renewed.
      </div>
    </td>
  </tr>

  <!-- Receipt card -->
  <tr>
    <td style="padding:0 0 16px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:16px 22px;border-bottom:1px solid {SLATE_300};">
            <div style="font-family:{_FONT};font-size:16px;font-weight:800;color:{INK};">ALwrity — {plan}</div>
            <div style="font-family:{_FONT};font-size:12px;color:{SLATE_400};margin-top:2px;">Receipt · {cycle_txt} renewal</div>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 22px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:6px 0;font-family:{_FONT};font-size:13px;color:{SLATE_800};">Billing period</td>
                <td style="padding:6px 0;font-family:{_FONT};font-size:13px;font-weight:700;text-align:right;color:{INK};">{period or '—'}</td>
              </tr>
              {period_row}
              {total_row}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td style="padding:0 0 16px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.11);border:1px solid rgba(255,255,255,0.22);border-radius:16px;">
        <tr>
          <td style="padding:22px 24px;text-align:center;">
            <div style="font-family:{_FONT};font-size:16px;font-weight:800;color:#ffffff;">
              Need to review or change anything?
            </div>
            <div style="font-family:{_FONT};font-size:13px;color:#c7d2fe;margin-top:6px;line-height:1.6;">
              Manage your plan, payment method, and receipts anytime.
            </div>
            <a href="{_esc(payload.billing_url)}" style="display:inline-block;background:#ffffff;color:{INK};text-decoration:none;font-family:{_FONT};font-size:14px;font-weight:800;padding:12px 22px;border-radius:999px;margin-top:14px;">Billing settings</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>"""


# ────────────────────────────────────────────────────────────────────────
# Send
# ────────────────────────────────────────────────────────────────────────

def send_billing_email(user_id: str, db=None, first_name: str = "",
                       kind: str = "payment_confirmation",
                       event_ref: str = "",
                       payload_extra: Optional[Dict[str, Any]] = None) -> Optional[str]:
    """Send a billing notification email, best-effort and idempotent.

    ``event_ref`` is a natural key (e.g. the Stripe checkout/event id) that, when
    supplied, together with ``kind`` guarantees one email per distinct event even
    across retries on different days (the per-day ``DailyEmailLedger`` can't do
    this alone). ``payload_extra`` carries kind-specific context (e.g. the
    previous plan for a plan_change email). Never raises — returns the Resend
    message id on success, else ``None``.
    """
    import services.daily_email_digest as digest_module
    try:
        from models.daily_email_ledger import DailyEmailLedger

        owns_session = db is None
        if owns_session:
            from services.database import get_session_for_user
            db = get_session_for_user(user_id)

        try:
            contact_email = _contact_email(user_id, db)
            if not contact_email:
                _ledger_skip(db, user_id, "skipped_no_email", kind, event_ref)
                return None
            if not _opted_in(user_id, db):
                _ledger_skip(db, user_id, "skipped_opted_out", kind, event_ref)
                return None

            # Idempotency: never re-send the same event/kind.
            if not _reserve_once(db, user_id, kind, event_ref):
                return None

            payload = build_from_kind(user_id, db, kind, first_name=first_name,
                                      extra=payload_extra)
            html = render_billing_email(payload)

            subject = _subject_for(kind, payload)
            message_id = digest_module._send_via_resend(contact_email, subject, html)

            _record_result(db, user_id, kind, event_ref, message_id)
            return message_id
        finally:
            if owns_session:
                db.close()
    except Exception:
        # Never let a billing email break the payment/subscription flow.
        return None


def build_from_kind(user_id: str, db, kind: str, first_name: str = "",
                    extra: Optional[Dict[str, Any]] = None) -> BillingEmailPayload:
    if kind == "payment_confirmation":
        return build_payment_confirmation_payload(user_id, db, first_name=first_name)
    if kind == "plan_change":
        extra = extra or {}
        return build_plan_change_payload(
            user_id, db, first_name=first_name,
            previous_plan_name=extra.get("previous_plan_name", ""),
            previous_plan_tier=extra.get("previous_plan_tier", ""),
            renewal_type=extra.get("renewal_type", ""),
            price=extra.get("price", ""),
        )
    if kind == "renewal_receipt":
        extra = extra or {}
        return build_renewal_receipt_payload(
            user_id, db, first_name=first_name,
            price=extra.get("price", ""),
            period_start=extra.get("period_start", ""),
            period_end=extra.get("period_end", ""),
        )
    logger.warning(f"build_from_kind: unknown kind {kind!r}; falling back to confirmation")
    return build_payment_confirmation_payload(user_id, db, first_name=first_name)


def _subject_for(kind: str, payload: BillingEmailPayload) -> str:
    plan = payload.plan_name or "your plan"
    first = payload.first_name
    if kind == "payment_confirmation":
        if first:
            return f"Payment confirmed — welcome to {plan}, {first}! 🎉"
        return f"Payment confirmed — welcome to {plan}! 🎉"
    if kind == "plan_change":
        renewal_type = (payload.renewal_type or "").lower()
        if renewal_type == "upgrade":
            return f"You're on {plan} now, {first}! 🚀"
        if renewal_type == "downgrade":
            return f"Your ALwrity plan is now {plan}"
        return f"Your ALwrity plan: {plan}"
    if kind == "renewal_receipt":
        if first:
            return f"Your {plan} plan has renewed, {first} — receipt inside"
        return f"Your {plan} plan has renewed — receipt inside"
    return f"An update about your {plan}"


def _contact_email(user_id: str, db) -> str:
    try:
        from models.onboarding import OnboardingSession
        session = db.query(OnboardingSession).filter(
            OnboardingSession.user_id == user_id
        ).order_by(OnboardingSession.updated_at.desc()).first()
        if session and getattr(session, "contact_email", None):
            return str(session.contact_email).strip()
    except Exception:
        pass
    return ""


def _opted_in(user_id: str, db) -> bool:
    try:
        from models.onboarding import OnboardingSession
        session = db.query(OnboardingSession).filter(
            OnboardingSession.user_id == user_id
        ).order_by(OnboardingSession.updated_at.desc()).first()
        if session is None:
            return False
        return bool(getattr(session, "email_digest_opt_in", False))
    except Exception:
        return False


def _ledger_skip(db, user_id: str, status: str, kind: str, event_ref: str) -> None:
    try:
        from models.daily_email_ledger import DailyEmailLedger
        existing = _find_ledger(db, user_id, kind, event_ref)
        if existing and existing.status in ("sent", status):
            return
        if existing:
            existing.status = status
            db.add(existing)
        else:
            db.add(DailyEmailLedger(
                user_id=user_id,
                plan_date=_today(),
                email_type=kind,
                status=status,
                error_message=event_ref or None,
            ))
        db.commit()
    except Exception:
        pass


def _reserve_once(db, user_id: str, kind: str, event_ref: str) -> bool:
    """Return True if this event may send (i.e. not already recorded as sent)."""
    try:
        existing = _find_ledger(db, user_id, kind, event_ref)
        if existing and existing.status == "sent":
            return False
        return True
    except Exception:
        return True  # be permissive; the send itself is best-effort


def _record_result(db, user_id: str, kind: str, event_ref: str, message_id) -> None:
    try:
        from models.daily_email_ledger import DailyEmailLedger
        existing = _find_ledger(db, user_id, kind, event_ref)
        if existing:
            existing.status = "sent" if message_id else "failed"
            existing.plan_date = _today()
            existing.sent_at = datetime.now(timezone.utc)
            existing.resend_message_id = message_id or None
            existing.error_message = None if message_id else "Resend send failed"
            db.add(existing)
        else:
            db.add(DailyEmailLedger(
                user_id=user_id,
                plan_date=_today(),
                email_type=kind,
                status="sent" if message_id else "failed",
                sent_at=datetime.now(timezone.utc),
                resend_message_id=message_id or None,
                error_message=None if message_id else "Resend send failed",
            ))
        db.commit()
    except Exception:
        pass


def _find_ledger(db, user_id: str, kind: str, event_ref: str):
    from models.daily_email_ledger import DailyEmailLedger
    query = db.query(DailyEmailLedger).filter(
        DailyEmailLedger.user_id == user_id,
        DailyEmailLedger.email_type == kind,
    )
    if event_ref:
        query = query.filter(DailyEmailLedger.error_message == event_ref)
    else:
        query = query.order_by(DailyEmailLedger.id.desc()).limit(1)
    return query.first()


def _today() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d")