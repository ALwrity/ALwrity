"""Send a polished ALwrity daily digest preview email with mock data.

Uses the same Resend pipeline as the real digest. This lets us validate
the visual design in real inboxes before building the React Email template.

Usage (from backend/):
    python scripts/send_digest_preview.py to@example.com
    python scripts/send_digest_preview.py to@example.com "Custom subject"
"""
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

try:
    from dotenv import load_dotenv
    load_dotenv(BACKEND_ROOT / ".env")
except Exception:
    pass

from services.daily_email_digest import _send_via_resend


# ─── Colors ──────────────────────────────────────────────────────────────
BRAND_INDIGO = "#4f46e5"
BRAND_INDIGO_DARK = "#4338ca"
SLATE_50 = "#f8fafc"
SLATE_100 = "#f1f5f9"
SLATE_200 = "#e2e8f0"
SLATE_300 = "#cbd5e1"
SLATE_400 = "#94a3b8"
SLATE_500 = "#64748b"
SLATE_600 = "#475569"
SLATE_700 = "#334155"
SLATE_800 = "#1e293b"
SLATE_900 = "#0f172a"
GREEN_500 = "#22c55e"
GREEN_600 = "#16a34a"
GREEN_BG = "#f0fdf4"
AMBER_500 = "#f59e0b"
AMBER_BG = "#fffbeb"
RED_500 = "#ef4444"
RED_BG = "#fef2f2"
BLUE_500 = "#3b82f6"
BLUE_BG = "#eff6ff"
CYAN_BG = "#ecfeff"


def _pill_badge(pillar: str) -> str:
    colors = {
        "plan": ("#6366f1", "#eef2ff"),
        "analyze": ("#0891b2", "#ecfeff"),
        "engage": ("#d946ef", "#fdf4ff"),
        "publish": ("#f59e0b", "#fffbeb"),
        "remarket": ("#ef4444", "#fef2f2"),
    }
    fg, bg = colors.get(pillar, (SLATE_500, SLATE_100))
    return (
        f'<span style="background:{bg};color:{fg};padding:2px 8px;'
        f'border-radius:4px;font-size:11px;font-weight:600;'
        f'text-transform:uppercase;letter-spacing:0.5px;">{pillar}</span>'
    )


def _priority_dot(priority: str) -> str:
    color = RED_500 if priority == "high" else AMBER_500 if priority == "medium" else SLATE_300
    return (
        f'<span style="display:inline-block;width:8px;height:8px;'
        f'border-radius:50%;background:{color};margin-right:4px;'
        f'vertical-align:middle;"></span>'
    )


def _synthesis_badge(mode: str) -> str:
    styles = {
        "llm": (GREEN_500, GREEN_BG, "AI Analysis"),
        "data_derived": (BLUE_500, BLUE_BG, "Data-Driven"),
        "template_fallback": (AMBER_500, AMBER_BG, "Template"),
    }
    fg, bg, label = styles.get(mode, (SLATE_400, SLATE_100, mode))
    return (
        f'<span style="background:{bg};color:{fg};padding:1px 6px;'
        f'border-radius:3px;font-size:10px;font-weight:600;'
        f'margin-left:6px;">{label}</span>'
    )


def _cert_indicator(state: str) -> str:
    styles = {
        "certified": (GREEN_500, "●"),
        "certified_with_provider_dependency": (BLUE_500, "●"),
        "degraded": (AMBER_500, "●"),
        "not certified": (SLATE_400, "○"),
    }
    color, icon = styles.get(state, (SLATE_400, "○"))
    return (
        f'<span style="color:{color};font-size:14px;margin-right:4px;">{icon}</span>'
    )


def build_digest_html() -> str:
    """Build a polished mock digest email."""

    # ─── Mock data ───────────────────────────────────────────────────────
    tasks = [
        {
            "title": "Write a blog post about AI trends in healthcare",
            "pillar": "plan",
            "priority": "high",
            "time": 25,
            "status": "completed",
            "agent": "Content Strategist",
            "mode": "llm",
            "url": "/blog-writer?topic=ai-healthcare",
        },
        {
            "title": "Optimize meta descriptions for product pages",
            "pillar": "analyze",
            "priority": "high",
            "time": 15,
            "status": "pending",
            "agent": "SEO Specialist",
            "mode": "data_derived",
            "url": "/seo-dashboard",
        },
        {
            "title": "Create social media thread about industry insights",
            "pillar": "engage",
            "priority": "medium",
            "time": 20,
            "status": "pending",
            "agent": "Social Media Manager",
            "mode": "llm",
            "url": "/social-scheduler",
        },
        {
            "title": "Review competitor's latest content strategy",
            "pillar": "analyze",
            "priority": "medium",
            "time": 15,
            "status": "pending",
            "agent": "Competitor Analyst",
            "mode": "data_derived",
            "url": "/competitor-intel",
        },
        {
            "title": "Draft newsletter for subscriber re-engagement",
            "pillar": "publish",
            "priority": "medium",
            "time": 30,
            "status": "pending",
            "agent": "Content Strategist",
            "mode": "llm",
            "url": "/newsletter-builder",
        },
        {
            "title": "Repurpose top-performing posts for LinkedIn",
            "pillar": "remarket",
            "priority": "low",
            "time": 15,
            "status": "pending",
            "agent": "Social Media Manager",
            "mode": "llm",
            "url": "/content-repurpose",
        },
    ]

    completed = sum(1 for t in tasks if t["status"] == "completed")
    total = len(tasks)
    pct = round(completed / total * 100, 1)
    remaining_time = sum(t["time"] for t in tasks if t["status"] != "completed")

    # ─── Task cards ──────────────────────────────────────────────────────
    task_cards = ""
    for t in tasks:
        status_color = GREEN_500 if t["status"] == "completed" else SLATE_300
        border_color = GREEN_500 if t["status"] == "completed" else SLATE_200
        title_decoration = "line-through" if t["status"] == "completed" else "none"
        title_color = SLATE_400 if t["status"] == "completed" else SLATE_800

        task_cards += f"""
        <tr>
          <td style="padding:0 0 8px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td style="background:{SLATE_50};border-radius:8px;border-left:4px solid {border_color};padding:14px 16px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                    <tr>
                      <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:600;color:{title_color};text-decoration:{title_decoration};padding-bottom:6px;">
                        {t["title"]}{_synthesis_badge(t["mode"])}
                      </td>
                    </tr>
                    <tr>
                      <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:{SLATE_500};padding-bottom:8px;">
                        {_pill_badge(t["pillar"])}
                        <span style="margin-left:8px;">{_priority_dot(t["priority"])}{t["priority"]}</span>
                        <span style="margin-left:8px;">⏱ {t["time"]} min</span>
                        <span style="margin-left:8px;color:{SLATE_400};">by {t["agent"]}</span>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <a href="https://alwrity.com{t['url']}" target="_blank" style="display:inline-block;background:{BRAND_INDIGO};color:#ffffff;padding:6px 14px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                          {'View Result' if t["status"] == "completed" else 'Open in ALwrity →'}
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>"""

    # ─── Alerts ──────────────────────────────────────────────────────────
    alerts_html = ""
    alert_data = [
        {
            "title": "SEO Crawl Issues Detected",
            "message": "3 product pages have missing meta descriptions. The SEO Specialist has prioritized fixing these.",
            "severity": "high",
        },
        {
            "title": "Competitor Published New Post",
            "message": "TechCrunch published an article in your niche. Consider creating a response piece.",
            "severity": "medium",
        },
    ]

    for a in alert_data:
        bg = RED_BG if a["severity"] == "high" else AMBER_BG
        border = RED_500 if a["severity"] == "high" else AMBER_500
        fg = "#991b1b" if a["severity"] == "high" else "#92400e"
        alerts_html += f"""
        <tr>
          <td style="padding:0 0 8px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td style="background:{bg};border-radius:6px;border-left:3px solid {border};padding:12px 14px;">
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;font-weight:600;color:{fg};margin-bottom:4px;">
                    {a["title"]}
                  </div>
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:{SLATE_600};">
                    {a["message"]}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>"""

    # ─── Task history ────────────────────────────────────────────────────
    history_html = ""
    history_data = [
        {"title": "Write blog post about industry trends", "signal": "Completed 3 times. Last completed yesterday. User feedback: positive."},
        {"title": "Audit product page SEO", "signal": "Completed 1 time. Last completed 2 days ago."},
    ]

    for h in history_data:
        history_html += f"""
        <tr>
          <td style="padding:0 0 6px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td style="background:{BLUE_BG};border-radius:6px;border-left:3px solid {BLUE_500};padding:10px 14px;">
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;font-weight:600;color:#1e40af;">
                    {h["title"]}
                  </div>
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#1e3a8a;margin-top:2px;">
                    {h["signal"]}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>"""

    # ─── Certification ───────────────────────────────────────────────────
    cert_data = [
        ("Content Strategist", "certified"),
        ("SEO Specialist", "certified"),
        ("Social Media Manager", "certified_with_provider_dependency"),
        ("Competitor Analyst", "certified"),
        ("Content Guardian", "certified"),
    ]

    cert_rows = ""
    for agent, state in cert_data:
        label = state.replace("_", " ").title()
        cert_rows += f"""
        <tr>
          <td style="padding:6px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:{SLATE_700};">
            {_cert_indicator(state)} {agent}
            <span style="color:{SLATE_400};font-size:12px;margin-left:6px;">— {label}</span>
          </td>
        </tr>"""

    # ─── Full HTML ───────────────────────────────────────────────────────
    html = f"""<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Your Daily ALwrity Plan</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset */
    body, table, td, a {{ -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }}
    table, td {{ mso-table-lspace: 0pt; mso-table-rspace: 0pt; }}
    img {{ -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }}
    body {{ margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f1f5f9; }}
    /* Dark mode support */
    @media (prefers-color-scheme: dark) {{
      .email-bg {{ background-color: #0f172a !important; }}
      .card-bg {{ background-color: #1e293b !important; }}
    }}
    /* Two-column layout */
    .col-left {{ width: 60%; }}
    .col-right {{ width: 40%; }}
    .col-gap {{ width: 16px; }}
    /* Mobile: stack the two columns sequentially */
    @media only screen and (max-width: 620px) {{
      .email-container {{ width: 100% !important; padding: 16px !important; }}
      .task-card {{ padding: 12px !important; }}
      .col-left, .col-right {{ display: block !important; width: 100% !important; }}
      .col-gap {{ display: none !important; }}
      .two-col-row {{ display: block !important; }}
      .col-cell {{ display: block !important; width: 100% !important; padding: 0 0 16px 0 !important; }}
    }}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" class="email-bg">

<!-- Preheader (hidden preview text) -->
<div style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
  3/7 tasks done · 5 agents prepared your plan · SEO issues detected
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;" class="email-bg">
<tr><td align="center" style="padding:24px 16px;">

<!-- Email container -->
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-container" style="max-width:600px;width:100%;">

  <!-- ═══ HEADER ═══ -->
  <tr>
    <td style="padding:0 0 24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px 12px 0 0;overflow:hidden;" class="card-bg">
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:32px 32px 28px 32px;">
            <!-- Logo -->
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                  ⚡ ALwrity
                </td>
              </tr>
            </table>
            <!-- Title -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
              <tr>
                <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:26px;font-weight:700;color:#ffffff;line-height:1.3;">
                  Your Daily Plan
                </td>
              </tr>
              <tr>
                <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#c7d2fe;margin-top:6px;">
                  Wednesday, September 2, 2026 · Prepared for <strong>Acme Corp</strong>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══ PROGRESS CARD ═══ -->
  <tr>
    <td style="padding:0 0 16px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;" class="card-bg">
        <tr>
          <td style="padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <!-- Progress circle area -->
                <td width="80" valign="top">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="72" height="72" style="border-radius:50%;border:4px solid #e0e7ff;text-align:center;vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:22px;font-weight:700;color:{BRAND_INDIGO};">
                        {pct}%
                      </td>
                    </tr>
                  </table>
                </td>
                <!-- Stats -->
                <td valign="middle" style="padding-left:20px;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:20px;font-weight:700;color:{SLATE_800};">
                        {completed} of {total} tasks completed
                      </td>
                    </tr>
                    <tr>
                      <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:{SLATE_500};padding-top:4px;">
                        ⏱ ~{remaining_time} min remaining · 5 agents participated
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <!-- Agent breakdown -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
              <tr>
                <td style="background:{CYAN_BG};border-radius:6px;padding:10px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:{SLATE_600};">
                  🤖 <strong>4</strong> from live agent analysis · <strong>1</strong> from data-driven insights · <strong>1</strong> from template fallback
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══ TWO-COLUMN: TASKS (L) + SUPPORTING (R) ═══ -->
  <tr>
    <td style="padding:0 0 16px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr class="two-col-row">
          <!-- LEFT COLUMN (64%) — Today's Tasks -->
          <td width="64%" valign="top" class="col-cell col-left" style="width:64%;padding:0 2% 0 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;" class="card-bg">
              <tr>
                <td style="padding:24px 24px 8px 24px;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;font-weight:700;color:{SLATE_800};">
                        Today's Tasks
                      </td>
                      <td style="padding-left:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:{SLATE_400};">
                        {total} tasks · {remaining_time} min
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 10px 18px 10px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    {task_cards}
                  </table>
                </td>
              </tr>
            </table>
          </td>
          <!-- RIGHT COLUMN (36%) — Transparency / Alerts / Task History -->
          <td width="36%" valign="top" class="col-cell col-right" style="width:36%;padding:0 0 0 2%;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">

              <!-- Transparency -->
              <tr>
                <td style="padding:0 0 16px 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;" class="card-bg">
                    <tr>
                      <td style="padding:16px 16px;">
                        <table cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:700;color:{SLATE_800};padding-bottom:10px;">
                              🔍 Agent Team Transparency
                            </td>
                          </tr>
                        </table>
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                          {cert_rows}
                        </table>
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">
                          <tr>
                            <td style="background:{SLATE_50};border-radius:6px;padding:8px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:{SLATE_500};">
                              All agents use live data from your onboarding configuration. Tasks marked "Template" are honest fallbacks when AI synthesis was unavailable.
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Alerts -->
              <tr>
                <td style="padding:0 0 16px 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;" class="card-bg">
                    <tr>
                      <td style="padding:16px 16px 0 16px;">
                        <table cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:700;color:{SLATE_800};">
                              ⚠️ Alerts
                            </td>
                            <td style="padding-left:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:{SLATE_400};">
                              {len(alert_data)} items
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 12px 16px 12px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                          {alerts_html}
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Task History -->
              <tr>
                <td style="padding:0 0 16px 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;" class="card-bg">
                    <tr>
                      <td style="padding:16px 16px 0 16px;">
                        <table cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:700;color:{SLATE_800};">
                              📈 Task History
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 12px 16px 12px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                          {history_html}
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══ CTA ═══ -->
  <tr>
    <td style="padding:0 0 16px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;" class="card-bg">
        <tr>
          <td style="padding:32px;text-align:center;">
            <table cellpadding="0" cellspacing="0" border="0" align="center">
              <tr>
                <td style="border-radius:8px;background:{BRAND_INDIGO};">
                  <a href="https://alwrity.com/dashboard" target="_blank" style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                    Complete Your Daily Plan →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══ FOOTER ═══ -->
  <tr>
    <td style="padding:0 0 24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:0 0 12px 12px;overflow:hidden;" class="card-bg">
        <tr>
          <td style="padding:24px 32px;text-align:center;">
            <table cellpadding="0" cellspacing="0" border="0" align="center">
              <tr>
                <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:{SLATE_400};line-height:1.6;">
                  You're receiving this because you opted in to daily AI agent team summaries.<br>
                  <a href="https://alwrity.com/settings/email-preferences" style="color:{SLATE_500};text-decoration:underline;">Manage email preferences</a>
                  &nbsp;·&nbsp;
                  <a href="#" style="color:{SLATE_500};text-decoration:underline;">Unsubscribe</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

</table>
<!-- /Email container -->

</td></tr>
</table>

</body>
</html>"""

    return html


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2

    to_email = sys.argv[1]
    subject = sys.argv[2] if len(sys.argv) > 2 else "Your Daily ALwrity Plan — 1/7 tasks done"

    api_key_present = bool(os.environ.get("RESEND_API_KEY"))
    if not api_key_present:
        print("RESEND_API_KEY is not set. Check backend/.env.")
        return 1

    html = build_digest_html()
    message_id = _send_via_resend(to_email, subject, html)

    if message_id:
        print(f"sent: {message_id}")
        print(f"-> Digest preview sent to {to_email}")
        print("-> Check your inbox (and spam folder) for the visual result.")
        return 0

    print("failed: no message_id returned. Check RESEND_API_KEY and sender domain.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
