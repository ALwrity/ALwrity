"""Onboarding welcome email for ALwrity.

Sent once when a user clicks "Launch ALwrity & Complete Onboarding". It
celebrates the start of their digital-marketing journey with ALwrity, summarises
what we learned about them during onboarding (fully personalised from live
onboarding data), introduces the AI Agent team, and points them to their next
high-leverage step: creating a Content Strategy & Calendar.

Design mirrors the full-width, high-energy style of the daily digest renderers
(reusing palette + helper builders from ``services.email_templates``), so the
welcome is on-brand with the rest of the product's email.

Only the send entrypoint (``send_welcome_email``) touches the database / Resend.
The renderer (``render_welcome_email``) is a pure function over the payload.
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
class WelcomeEmailPayload:
    """Everything the welcome renderer needs, fully personalised.

    Every field is optional so the email degrades gracefully when the user's
    onboarding left gaps (it must never crash on sparse data).
    """
    first_name: str = ""
    website_url: str = ""
    industry: str = ""
    target_audience: str = ""
    writing_tone: str = ""
    writing_voice: str = ""
    content_types: List[str] = field(default_factory=list)
    connected_platforms: List[str] = field(default_factory=list)
    competitors: List[str] = field(default_factory=list)
    research_depth: str = ""
    timezone: str = ""
    strategy_url: str = "https://alwrity.com/content-planning"
    dashboard_url: str = "https://alwrity.com/dashboard"


# ────────────────────────────────────────────────────────────────────────
# Data acquisition
# ────────────────────────────────────────────────────────────────────────

def _val(d: Optional[Dict[str, Any]], *keys: str, default: Any = "") -> Any:
    """Read the first present key from a nested dict, returning default."""
    if not isinstance(d, dict):
        return default
    for k in keys:
        v = d.get(k)
        if v is not None and v != "" and v != [] and v != {}:
            return v
    return default


def build_welcome_payload(user_id: str, db=None, first_name: str = "") -> WelcomeEmailPayload:
    """Assemble a personalised welcome payload from the user's onboarding data.

    ``db`` should be the user's session (``get_session_for_user(user_id)``) when
    available; otherwise this helper opens its own read session. Never raises on
    missing data — it returns a payload with whatever it found.
    """
    payload = WelcomeEmailPayload(first_name=first_name or "")

    interactive_session = db is not None
    owns_session = db is None
    if owns_session:
        from services.database import get_session_for_user
        db = get_session_for_user(user_id)

    try:
        from models.onboarding import OnboardingSession
        session = None
        if db is not None:
            try:
                session = db.query(OnboardingSession).filter(
                    OnboardingSession.user_id == user_id
                ).order_by(OnboardingSession.updated_at.desc()).first()
            except Exception:
                session = None

        if session is not None:
            payload.first_name = first_name or _name_from_session(session)
            payload.timezone = getattr(session, "timezone", "") or ""

        # Best-effort integrated data (industry, tone, audience, content types…).
        canonical = {}
        website = {}
        research = {}
        competitors: List[Dict[str, Any]] = []
        platforms: List[str] = []
        try:
            if db is not None:
                from api.content_planning.services.content_strategy.onboarding.data_integration import (
                    OnboardingDataIntegrationService,
                )
                svc = OnboardingDataIntegrationService()
                integrated = svc.get_integrated_data_sync(user_id, db)
            else:
                integrated = {}
        except Exception:
            integrated = {}

        if isinstance(integrated, dict):
            canonical = integrated.get("canonical_profile") or {}
            website = integrated.get("website_analysis") or {}
            research = integrated.get("research_preferences") or {}
            competitors = integrated.get("competitor_analysis") or []
            pi = integrated.get("platform_integrations") or {}
            if isinstance(pi, dict):
                platforms = pi.get("connected_platforms") or []

        if isinstance(canonical, dict):
            payload.industry = _val(canonical, "industry")
            payload.target_audience = _val(canonical, "target_audience")
            payload.writing_tone = _val(canonical, "writing_tone")
            payload.writing_voice = _val(canonical, "writing_voice")
            payload.content_types = list(canonical.get("content_types") or [])
            if not payload.connected_platforms:
                payload.connected_platforms = list(canonical.get("platform_preferences") or [])
            payload.research_depth = _val(canonical, "research_depth")
            bv = canonical.get("brand_voice") or {}
            if not payload.writing_tone and isinstance(bv, dict):
                payload.writing_tone = _val(bv, "default_tone")

        if not payload.website_url:
            payload.website_url = _val(website, "website_url")
        if not payload.content_types:
            payload.content_types = list(research.get("content_types") or [])

        if not payload.connected_platforms:
            payload.connected_platforms = platforms

        payload.competitors = _competitor_domains(competitors)
    finally:
        if owns_session and db is not None:
            db.close()

    return payload


def _name_from_session(session) -> str:
    """Best-effort first name from the onboarding session (never raises)."""
    try:
        payload = getattr(session, "payload", None)
        if isinstance(payload, dict):
            fname = _val(payload, "first_name", "name")
            if fname:
                return str(fname).split()[0]
    except Exception:
        pass
    return ""


def _competitor_domains(competitors) -> List[str]:
    names: List[str] = []
    for c in competitors:
        if isinstance(c, str):
            name = c
        elif isinstance(c, dict):
            name = (
                c.get("competitor_domain") or c.get("domain")
                or c.get("url") or c.get("website_url") or c.get("title")
            )
        else:
            continue
        if name:
            domain = str(name)
            if "://" in domain:
                domain = domain.split("://")[-1]
            domain = domain.split("/")[0].lstrip("www.")
            if domain and domain not in names:
                names.append(domain)
    return names[:4]


# ────────────────────────────────────────────────────────────────────────
# Renderer
# ────────────────────────────────────────────────────────────────────────

def render_welcome_email(payload: WelcomeEmailPayload, verbose: bool = True) -> str:
    """Render the full-width, personalised onboarding welcome email."""
    from services.email_templates import (
        _FONT, _esc, _confetti,
        INK, INDIGO, VIOLET, AMBER, GREEN, SLATE_400, SLATE_800,
    )

    first = (_esc(payload.first_name) or "there")

    # ── "Here's what we learned about you" fact rows ──
    facts: List[tuple] = []
    if payload.industry:
        facts.append(("Industry", payload.industry, "🏭"))
    if payload.website_url:
        facts.append(("Your site", payload.website_url, "🌐"))
    if payload.target_audience:
        facts.append(("Audience", payload.target_audience, "🎯"))
    if payload.writing_tone or payload.writing_voice:
        facts.append(("Your voice", (payload.writing_tone or payload.writing_voice), "✍️"))
    if payload.content_types:
        facts.append(("Content you'll create", ", ".join(payload.content_types[:3]), "📝"))
    if payload.connected_platforms:
        facts.append(("Platforms", ", ".join(payload.connected_platforms), "🔗"))
    if payload.competitors:
        facts.append(("To outrank", ", ".join(payload.competitors), "🏁"))

    facts_html = ""
    if facts:
        # Default to 2-column grid on desktop; stack on mobile.
        facts_html = "<table width='100%' cellpadding='0' cellspacing='0' border='0'>"
        for i in range(0, len(facts), 2):
            row = facts[i : i + 2]
            facts_html += "<tr>"
            for label, value, emoji in row:
                facts_html += (
                    f"<td width='50%' style='vertical-align:top;padding:10px;'>"
                    f"<div style='font-family:{_FONT};font-size:11px;letter-spacing:1px;"
                    f"       color:{SLATE_400};text-transform:uppercase;'>{label}</div>"
                    f"<div style='font-family:{_FONT};font-size:13px;font-weight:700;"
                    f"       color:{SLATE_800};margin-top:4px;'>{emoji} {_esc(value)}</div>"
                    f"</td>"
                )
            facts_html += "</tr>"
        facts_html += "</table>"
    else:
        facts_html = (
            f"<div style='font-family:{_FONT};font-size:13px;color:{SLATE_400}'>"
            "We'll keep learning as you go — your plan is already being built from "
            "the details you shared.</div>"
        )

    tone_text = ""
    if payload.writing_tone or payload.writing_voice:
        tone_text = (
            f" We've tuned everything to your "
            f"<strong style='color:{AMBER}'>{_esc(payload.writing_tone or payload.writing_voice)}</strong> voice."
        )

    platform_text = ""
    if payload.connected_platforms:
        platform_text = (
            f" Connected platforms: <strong style='color:{GREEN}'>{', '.join(_esc(p) for p in payload.connected_platforms)}</strong>."
        )

    agents = [
        ("🧠", "Strategist", "Turns your goals into a concrete content plan and calendar."),
        ("🔎", "SEO Specialist", "Watches rankings and flags the fastest wins for you."),
        ("📰", "Researcher", "Finds fresh market, competitor, and audience insights."),
        ("✍️", "Writers", "Draft on-brand posts, articles, and campaigns for every platform."),
        ("📊", "Analyst", "Tracks performance so the team keeps you on the smartest path."),
    ]
    agent_rows = ""
    for emoji, name, desc in agents:
        agent_rows += (
            f"<tr>"
            f"<td width='40' valign='top' style='padding:9px 0;font-size:20px;'>{emoji}</td>"
            f"<td style='padding:9px 0;'><div style='font-family:{_FONT};font-size:14px;font-weight:800;"
            f"color:{SLATE_800}'>{name}</div>"
            f"<div style='font-family:{_FONT};font-size:12px;color:{SLATE_400};margin-top:2px;"
            f"line-height:1.5'>{desc}</div></td>"
            f"</tr>"
        )

    return f"""<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>Welcome to ALwrity 🎉</title>
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
  Welcome to ALwrity — your AI agent team is already working for you, {first}!
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(160deg,#064e3b 0%,#047857 22%,#0f766e 40%,#2563eb 62%,#7c3aed 80%,#0f172a 100%);">
<tr><td align="center" style="padding:34px 14px;">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-container" style="max-width:600px;width:100%;position:relative;">

  <div class="hide-mobile" style="position:absolute;top:8px;left:0;right:0;height:120px;pointer-events:none;">
    {_confetti(9, '6px')}{_confetti(3, '40px')}{_confetti(6, '72px')}
  </div>

  <tr>
    <td style="padding:0 0 14px 0;text-align:center;">
      <div style="font-family:{_FONT};font-size:12px;color:#a7f3d0;letter-spacing:2px;">⚡ ALWRITY &nbsp;·&nbsp; YOUR AI CONTENT TEAM ·</div>
      <div style="font-family:{_FONT};font-size:38px;font-weight:800;color:#ffffff;line-height:1.15;margin-top:8px;">
        Welcome, {_esc(first)}! 🎉
      </div>
      <div style="font-family:{_FONT};font-size:17px;color:#d1fae5;margin-top:8px;line-height:1.5;">
        This is the start of your <strong style="color:#fbbf24;">new age of digital marketing</strong>
        — powered by an entire AI team working for you, around the clock.
      </div>
    </td>
  </tr>

  <tr>
    <td style="padding:0 0 14px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(90deg,#ecfdf5,#eff6ff);padding:16px 20px;">
            <div style="font-family:{_FONT};font-size:17px;font-weight:800;color:{INK};">💡 What we learned about you</div>
            <div style="font-family:{_FONT};font-size:12px;color:{SLATE_400};margin-top:2px;">Your agent team is already building around this.</div>
          </td>
          <td style="width:20%;text-align:center;background:linear-gradient(90deg,#ecfdf5,#eff6ff);padding:16px 12px;">
            <div style="font-family:{_FONT};font-size:30px;">🚀</div>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding:6px 6px 14px 6px;">
            {facts_html}
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding:0 0 14px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.11);border:1px solid rgba(255,255,255,0.22);border-radius:16px;">
        <tr>
          <td style="padding:18px 20px;">
            <div style="font-family:{_FONT};font-size:11px;color:#a7f3d0;letter-spacing:2px;padding-bottom:6px;">✦ &nbsp;YOUR AI AGENT TEAM&nbsp; ✦</div>
            <div style="font-family:{_FONT};font-size:15px;color:#e0f2fe;line-height:1.7;">
              A team of specialised agents never sleeps on your behalf. Every morning they
              plan your day, research your market, keep an eye on SEO, and draft content
              in your voice — so you wake up to work already done.{tone_text}{platform_text}
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid rgba(255,255,255,0.16);margin-top:16px;">
              {agent_rows}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding:0 0 14px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:22px 24px;text-align:center;">
            <div style="font-family:{_FONT};font-size:16px;font-weight:800;color:{INK};">
              Your next high-leverage move
            </div>
            <div style="font-family:{_FONT};font-size:13px;color:{SLATE_400};margin-top:6px;line-height:1.6;">
              Set your long-term direction now: create a <strong style="color:{INDIGO};">Content Strategy</strong>
              and a <strong style="color:{INDIGO};">Content Calendar</strong> so every agent is aligned to one
              plan that grows your business — not just one-off posts.
            </div>
            <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin-top:18px;">
              <tr>
                <td style="border-radius:999px;background:linear-gradient(90deg,{INDIGO},{VIOLET});padding:2px;">
                  <a href="{_esc(payload.strategy_url)}" target="_blank" style="display:inline-block;padding:14px 34px;font-family:{_FONT};font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:999px;background:{INDIGO};">
                    Create your Content Strategy &amp; Calendar &rarr;
                  </a>
                </td>
              </tr>
            </table>
            <div style="font-family:{_FONT};font-size:12px;color:{SLATE_400};margin-top:10px;">
              <a href="{_esc(payload.dashboard_url)}" style="color:{SLATE_400};text-decoration:underline;">or explore your dashboard first</a>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding:0 0 8px 0;text-align:center;">
      <div style="font-family:{_FONT};font-size:12px;color:#94a3b8;line-height:1.7;">
        You're receiving this because you created an ALwrity account.<br>
        <a href="https://alwrity.com/settings/email-preferences" style="color:#cbd5e1;text-decoration:underline;">Manage email preferences</a>
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


# ────────────────────────────────────────────────────────────────────────
# Send
# ────────────────────────────────────────────────────────────────────────

def send_welcome_email(user_id: str, db=None, first_name: str = "") -> Optional[str]:
    """Send the onboarding welcome email once per user.

    Idempotent via the ``DailyEmailLedger`` row ``(user_id, today, "welcome")``.
    Non-blocking / best-effort: never raises — returns the Resend message id on
    success, ``None`` otherwise. Reuses the production Resend pipeline.
    """
    from datetime import datetime
    try:
        from models.daily_email_ledger import DailyEmailLedger
        import services.daily_email_digest as digest_module

        owns_session = db is None
        if owns_session:
            from services.database import get_session_for_user
            db = get_session_for_user(user_id)

        try:
            contact_email = _contact_email(user_id, db)
            if not contact_email:
                _ledger_skip(db, user_id, "skipped_no_email")
                return None

            # Respect the end user's choice: never send when they opted out on
            # the final onboarding step.
            if not _opted_in(user_id, db):
                _ledger_skip(db, user_id, "skipped_opted_out")
                return None

            # Idempotency: have we already sent the welcome for this user?
            existing = db.query(DailyEmailLedger).filter(
                DailyEmailLedger.user_id == user_id,
                DailyEmailLedger.email_type == "welcome",
            ).first()
            if existing and existing.status == "sent":
                return None

            payload = build_welcome_payload(user_id, db=db, first_name=first_name)
            html = render_welcome_email(payload)

            subject = "Welcome to ALwrity — your AI agent team is ready 🎉"
            if payload.first_name:
                subject = f"Welcome to ALwrity, {payload.first_name} — your AI team is ready 🎉"

            message_id = digest_module._send_via_resend(contact_email, subject, html)

            today = datetime.utcnow().strftime("%Y-%m-%d")
            row = existing or DailyEmailLedger(
                user_id=user_id,
                plan_date=today,
                email_type="welcome",
                status="pending",
            )
            row.plan_date = today
            row.sent_at = datetime.now(timezone.utc)
            if message_id:
                row.status = "sent"
                row.resend_message_id = message_id
            else:
                row.status = "failed"
                row.error_message = "Resend send failed"
            db.add(row)
            db.commit()
            return message_id
        finally:
            if owns_session:
                db.close()
    except Exception:
        # Never let a welcome email break onboarding completion.
        return None


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
    """Honour the onboarding final-step email opt-in (defaults to False)."""
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


def _ledger_skip(db, user_id: str, status: str) -> None:
    try:
        from models.daily_email_ledger import DailyEmailLedger
        from datetime import datetime
        existing = db.query(DailyEmailLedger).filter(
            DailyEmailLedger.user_id == user_id,
            DailyEmailLedger.email_type == "welcome",
        ).first()
        if existing and existing.status in ("sent", status):
            return
        if existing:
            existing.status = status
            db.add(existing)
        else:
            db.add(DailyEmailLedger(
                user_id=user_id,
                plan_date=datetime.utcnow().strftime("%Y-%m-%d"),
                email_type="welcome",
                status=status,
            ))
        db.commit()
    except Exception:
        pass