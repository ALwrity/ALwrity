"""Send a bold, engaging ALwrity re-engagement email with mock data.

This is a design experiment: an urgent, high-engagement variant designed to
reconnect with users who have gone idle. Uses vivid gradients, animated
progress bars, pulse CTA, and bigger stats. Animations are best-effort
email-client support with graceful fallback (Gmail strips most `<style>`
keyframe animations; Apple Mail / recent Outlook desktop support them).

Usage (from backend/):
    python scripts/send_reengagement_email.py to@example.com
    python scripts/send_reengagement_email.py to@example.com "Custom subject"
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


# ─── Palette ──────────────────────────────────────────────────────────────
# Vibrant "spot on crazy" theme: electric candy tones on a deep indigo night.
INK = "#0f172a"
INDIGO = "#4f46e5"
INDIGO_DARK = "#4338ca"
VIOLET = "#8b5cf6"
FUCHSIA = "#e879f9"
PINK = "#f472b6"
CYAN = "#22d3ee"
SKY = "#38bdf8"
AMBER = "#fbbf24"
AMBER_DARK = "#d97706"
ORANGE = "#fb923c"
ROSE = "#fb7185"
RED = "#f43f5e"
GREEN = "#34d399"
EMERALD = "#10b981"
LIME = "#a3e635"
WHITE = "#ffffff"
SLATE_500 = "#64748b"
SLATE_400 = "#94a3b8"
SLATE_300 = "#cbd5e1"
SLATE_200 = "#e2e8f0"
SLATE_100 = "#f1f5f9"
AMBER_BG = "#fffbeb"
ROSE_BG = "#fff1f2"
GREEN_BG = "#ecfdf5"


def _ribbon(text: str, highlight: str, text_color: str = "#0f172a") -> str:
    """Highlight-ribbon doodad: a marker-style highlight + hand-drawn underline."""
    return (
        f'<span style="background:linear-gradient(180deg,transparent 55%,{highlight} 55%);'
        f'padding:0 4px;color:{text_color};border-radius:2px;">{text}</span>'
    )


def _confetti(seed: int, top: str) -> str:
    """Scatter a few confetti pieces across a slice of the email."""
    shapes = ["●", "◆", "✚", "▲"]
    colors = [AMBER, PINK, CYAN, LIME, VIOLET, ORANGE]
    pieces = ""
    for i in range(9):
        c = colors[(seed + i) % len(colors)]
        s = shapes[(seed + i) % len(shapes)]
        left = (seed * 37 + i * 55) % 88 + 4
        size = 10 + ((seed + i) % 3) * 4
        rotate = (seed * 11 + i * 23) % 50 - 25
        pieces += (
            f'<span style="position:absolute;left:{left}%;top:{top};'
            f'font-size:{size}px;color:{c};opacity:0.8;'
            f'transform:rotate({rotate}deg);line-height:1;'
            f'font-family:Arial,sans-serif;">{s}</span>'
        )
    return pieces


def build_reengagement_html() -> str:
    # ─── Mock data ───────────────────────────────────────────────────────
    pending = [
        {
            "title": "Finish your SEO content brief",
            "pillar": "plan",
            "priority": "high",
            "time": 15,
            "url": "/blog-writer",
            "accent": INDIGO,
            "bar": "68%",
            "label": "68% ready",
            "emoji": "📝",
        },
        {
            "title": "Approve the repurposed LinkedIn post",
            "pillar": "publish",
            "priority": "high",
            "time": 5,
            "url": "/content-repurpose",
            "accent": VIOLET,
            "bar": "82%",
            "label": "82% ready",
            "emoji": "💜",
        },
        {
            "title": "Action the 3 SEO crawl warnings",
            "pillar": "analyze",
            "priority": "medium",
            "time": 12,
            "url": "/seo-dashboard",
            "accent": FUCHSIA,
            "bar": "45%",
            "label": "45% ready",
            "emoji": "🕵️",
        },
    ]

    pending_cards = ""
    for t in pending:
        pending_cards += f"""
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
          <tr>
            <td style="padding:14px 16px;background:#ffffff;border:1px solid {SLATE_200};border-radius:12px;border-left:5px solid {t['accent']};">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="30" valign="top" style="font-size:20px;">{t['emoji']}</td>
                  <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:700;color:{INK};padding-bottom:6px;">
                    {t['title']}
                  </td>
                  <td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;font-weight:800;color:{t['accent']};white-space:nowrap;">
                    ⏱ {t['time']} min
                  </td>
                </tr>
                <tr>
                  <td colspan="3" style="padding-bottom:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;font-weight:700;color:{SLATE_400};">
                    {t['label']}
                  </td>
                </tr>
                <tr>
                  <td colspan="3" style="padding-bottom:10px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{SLATE_100};border-radius:6px;height:10px;">
                      <tr>
                        <td style="width:{t['bar']};background:linear-gradient(90deg,{t['accent']}, {FUCHSIA});border-radius:6px;height:10px;font-size:1px;line-height:10px;">
                          &nbsp;
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td colspan="2">
                    <a href="https://alwrity.com{t['url']}" target="_blank" style="display:inline-block;background:{t['accent']};color:#ffffff;padding:9px 18px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                      {('Continue →' if t['priority']=='high' else 'Open →')}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>"""

    total_min = sum(t["time"] for t in pending)

    html = f"""<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<title>Take back your momentum</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  body, table, td, a {{ -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }}
  table, td {{ mso-table-lspace:0pt; mso-table-rspace:0pt; }}
  body {{ margin:0 !important; padding:0 !important; width:100% !important; background-color:#0f172a; }}
  /* Animated pulse on the CTA (Apple Mail / recent Outlook desktop; graceful in Gmail) */
  @keyframes pulse {{
    0% {{ box-shadow:0 0 0 0 rgba(232,121,249,0.65); }}
    70% {{ box-shadow:0 0 0 16px rgba(232,121,249,0); }}
    100% {{ box-shadow:0 0 0 0 rgba(232,121,249,0); }}
  }}
  .pulse {{ animation: pulse 1.5s infinite; }}
  @media only screen and (max-width:620px) {{
    .email-container {{ width:100% !important; padding:12px !important; }}
    .hide-mobile {{ display:none !important; }}
  }}
</style>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

<!-- Preheader -->
<div style="display:none;font-size:1px;color:#0f172a;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  You have 3 tasks waiting · only ~{total_min} min to catch up · let's make it a streak 🎉
</div>

<!-- Ambient gradient night-sky background -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(160deg,#1e1b4b 0%,#312e81 28%,#4c1d95 46%,#7c3aed 62%,#db2777 80%,#0f172a 100%);">
<tr><td align="center" style="padding:36px 16px;">

  <!-- Email container (relative for confetti + decorative doodads) -->
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-container" style="max-width:600px;width:100%;background:transparent;position:relative;">

    <!-- Confetti scattered across the hero -->
    <div class="hide-mobile" style="position:absolute;top:10px;left:0;right:0;height:120px;pointer-events:none;">
      {_confetti(1, '10px')}
      {_confetti(4, '44px')}
      {_confetti(7, '78px')}
    </div>

    <!-- ═══ HERO ═══ -->
    <tr>
      <td style="padding:0 0 16px 0;text-align:center;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;font-weight:800;color:#c7d2fe;letter-spacing:3px;padding-bottom:2px;">
              ⚡ ALWRITY
            </td>
          </tr>
          <tr>
            <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#fbcfe8;letter-spacing:1px;padding-bottom:14px;">
              · &nbsp; YOUR AI CONTENT TEAM &nbsp; ·
            </td>
          </tr>
          <tr>
            <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:40px;font-weight:800;color:#ffffff;line-height:1.12;letter-spacing:-1px;">
              Your content engine<br>has been {_ribbon('waiting', AMBER, '#0f172a')}.
            </td>
          </tr>
          <tr>
            <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;color:#e9d5ff;padding-top:14px;line-height:1.6;">
              It's been <strong style="color:#fde68a;">5 days</strong> since your last task.
              Your ideas are {_ribbon('drafted and ready', SKY, '#0f172a')}.
              A focused <strong style="color:#6ee7b7;">~{total_min} minutes</strong> is all it takes.
            </td>
          </tr>
          <tr>
            <td style="padding-top:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;font-weight:700;color:#fbcfe8;">
              🎯 Let's turn it into a <span style="background:#fde68a;color:#0f172a;padding:1px 7px;border-radius:999px;">streak</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ═══ STREAK / PENDING BANNER (candy glass card) ═══ -->
    <tr>
      <td style="padding:0 0 16px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.13);border:1px solid rgba(255,255,255,0.30);border-radius:16px;">
          <tr>
            <td style="padding:22px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:#c7d2fe;letter-spacing:1px;">PENDING TASKS</div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:46px;font-weight:800;color:#ffffff;line-height:1.1;">{len(pending)}</div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#c7d2fe;">~{total_min} min to finish</div>
                  </td>
                  <td align="center" style="border-left:1px solid rgba(255,255,255,0.30);">
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:#c7d2fe;letter-spacing:1px;">STREAK</div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:46px;font-weight:800;color:#fde68a;line-height:1.1;">🔥 0</div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#c7d2fe;">let's start one today</div>
                  </td>
                  <td align="center" style="border-left:1px solid rgba(255,255,255,0.30);">
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:#c7d2fe;letter-spacing:1px;">THIS WEEK</div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:46px;font-weight:800;color:#6ee7b7;line-height:1.1;">-40%</div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#c7d2fe;">vs. your best week</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ═══ QUICK WINS ═══ -->
    <tr>
      <td style="padding:0 0 12px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(90deg,#eef2ff,#f5f3ff);padding:20px 24px 12px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:18px;font-weight:800;color:{INK};">
                    ⚡ Quick wins<span style="color:{SLATE_400};font-size:13px;font-weight:600;">&nbsp;─ highest impact, lowest effort</span>
                  </td>
                </tr>
                <tr>
                  <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:{SLATE_500};padding-top:3px;">
                    Start with the <span style="background:#d1fae5;color:#065f46;font-weight:700;padding:1px 5px;border-radius:4px;">shortest task</span> — momentum is the whole game. 🚀
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 20px 22px 20px;">
              {pending_cards}
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ═══ IMPACT / WHY IT MATTERS ═══ -->
    <tr>
      <td style="padding:0 0 16px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.11);border:1px solid rgba(255,255,255,0.22);border-radius:16px;">
          <tr>
            <td style="padding:20px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:#c7d2fe;letter-spacing:2px;padding-bottom:8px;">
                    ✦ &nbsp;WHY THIS MATTERS&nbsp; ✦
                  </td>
                </tr>
                <tr>
                  <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#e9d5ff;line-height:1.7;">
                    Brands that publish <strong style="color:#fde68a;">3+ pieces a week</strong> earn
                    <strong style="color:#6ee7b7;">~2.5&times; more organic traffic</strong> than monthly posters.
                    Your agent team drafted the ideas — all that's left is a couple of clicks.
                    {_ribbon('We did the hard part already', LIME, '#0f172a')}. 💪
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ═══ CTA (pulsing gradient + cap doodad) ═══ -->
    <tr>
      <td style="padding:0 0 16px 0;text-align:center;">
        <table cellpadding="0" cellspacing="0" border="0" align="center">
          <tr>
            <td class="pulse" style="border-radius:999px;background:linear-gradient(90deg,#4f46e5,#a855f7,#ec4899);padding:2px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-radius:999px;background:#111827;padding:0;">
                    <a href="https://alwrity.com/dashboard" target="_blank" style="display:inline-block;padding:15px 42px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:17px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:999px;">
                      Reclaim 15 minutes &rarr; 🎉
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#c7d2fe;padding-top:10px;">
          Your team's ideas are 1 click from becoming content.
        </div>
      </td>
    </tr>

    <!-- ═══ FOOTER ═══ -->
    <tr>
      <td style="padding:0 0 10px 0;text-align:center;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#94a3b8;line-height:1.8;">
              You're receiving this because you opted in to ALwrity's agent-team summaries.<br>
              <a href="https://alwrity.com/settings/email-preferences" style="color:#cbd5e1;text-decoration:underline;">Manage email preferences</a>
              &nbsp;·&nbsp;
              <a href="#" style="color:#cbd5e1;text-decoration:underline;">Unsubscribe</a>
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
    subject = sys.argv[2] if len(sys.argv) > 2 else (
        "🔥 You have 3 tasks waiting — 15 min to get back on track"
    )

    if not os.environ.get("RESEND_API_KEY"):
        print("RESEND_API_KEY is not set. Check backend/.env.")
        return 1

    html = build_reengagement_html()
    message_id = _send_via_resend(to_email, subject, html)

    if message_id:
        print(f"sent: {message_id}")
        print(f"-> Re-engagement preview sent to {to_email}")
        return 0

    print("failed: no message_id returned. Check RESEND_API_KEY and sender domain.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
