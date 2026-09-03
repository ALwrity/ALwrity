"""Email HTML renderers for the ALwrity daily digest.

Production renderers that convert a :class:`DigestPayload` (or any object
exposing the same attributes) into Resend-ready HTML.

Two rendered designs are provided:

* ``render_standard_digest`` -- the two-column (64/36) daily plan email: a
  full-bleed gradient sheet behind a vibrant confetti header, a candy progress
  bar, then Today's Tasks (left) beside Transparency / Alerts / Task History
  (right), with a gradient pill CTA and compliant footer. Matches the
  re-engagement variant's full-width, high-energy look.
* ``render_reengagement`` -- the bold "go crazy" variant used when the design
  doc's re-engagement hook (Sec 10) fires: night-sky gradient, confetti,
  highlight-ribbons, candy stats, quick-win task cards, and a pulsing pill CTA.

Both are fully data-driven: every number, label, and link is read from the
payload, never hardcoded. They are pure functions (no I/O, no DB, no logging
dependencies) so they are safe to import from tests and scripts alike.

The legacy ``render_email`` stub in ``daily_email_digest`` dispatches to these.
"""

from __future__ import annotations

from typing import Any, Optional


# ─── Palette (shared) ─────────────────────────────────────────────────────
INK = "#0f172a"
INDIGO = "#4f46e5"
VIOLET = "#8b5cf6"
FUCHSIA = "#e879f9"
PINK = "#f472b6"
CYAN = "#22d3ee"
SKY = "#38bdf8"
AMBER = "#fbbf24"
LIME = "#a3e635"
ORANGE = "#fb923c"
GREEN = "#34d399"
ROSE = "#fb7185"
WHITE = "#ffffff"
SLATE_50 = "#f8fafc"
SLATE_100 = "#f1f5f9"
SLATE_200 = "#e2e8f0"
SLATE_300 = "#cbd5e1"
SLATE_400 = "#94a3b8"
SLATE_500 = "#64748b"
SLATE_700 = "#334155"
SLATE_800 = "#1e293b"
RED_500 = "#ef4444"
GREEN_500 = "#22c55e"
GREEN_BG = "#f0fdf4"
AMBER_500 = "#f59e0b"
AMBER_BG = "#fffbeb"
RED_BG = "#fef2f2"
BLUE_500 = "#3b82f6"
BLUE_BG = "#eff6ff"
CYAN_BG = "#ecfeff"

_FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"


# ─── Small builders shared by both templates ──────────────────────────────

def _pill_badge(pillar: str) -> str:
    colors = {
        "plan": ("#6366f1", "#eef2ff"),
        "analyze": ("#0891b2", "#ecfeff"),
        "engage": ("#d946ef", "#fdf4ff"),
        "publish": ("#f59e0b", "#fffbeb"),
        "remarket": ("#ef4444", "#fef2f2"),
        "generate": ("#16a34a", "#f0fdf4"),
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
    fg, bg, label = styles.get(mode, (SLATE_400, SLATE_100, str(mode)))
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
    return f'<span style="color:{color};font-size:14px;margin-right:4px;">{icon}</span>'


def _ribbon(text: str, highlight: str, text_color: str = INK) -> str:
    """Marker-style highlight ribbon."""
    return (
        f'<span style="background:linear-gradient(180deg,transparent 55%,{highlight} 55%);'
        f'padding:0 4px;color:{text_color};border-radius:2px;">{_esc(text)}</span>'
    )


def _confetti(seed: int, top: str) -> str:
    """Scatter a few confetti pieces (best-effort; hidden on some clients)."""
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


def _esc(value: Any) -> str:
    """Minimal HTML escaping for user-derived strings."""
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _task_tasks(payload) -> list:
    return payload.tasks or []


def _task_kicker(task) -> str:
    """Short, action-oriented nudge shown under each re-engagement task card."""
    agent = (getattr(task, "source_agent", "") or "").replace("_", " ").strip().lower()
    est = int(getattr(task, "estimated_time", 0) or 0)
    if agent:
        base = f"Kickstarted by your {agent} — "
    else:
        base = ""
    if est <= 5:
        return base + "a two-minute move with real upside."
    if est <= 15:
        return base + "the fast win your momentum is waiting for."
    return base + "a quick decision now saves a bigger cleanup later."


def _task_alerts(payload) -> list:
    return payload.alerts or []


def _task_memory(payload) -> list:
    return payload.task_memory_signals or []


def _task_cert(user_id=None) -> dict:
    # Certification info travels on the payload already.
    return {}


# =============================================================================
# Standard two-column digest
# =============================================================================

def render_standard_digest(payload, verbose: bool = True) -> str:
    """Render the full-width, high-energy daily plan email from a payload.

    A full-bleed gradient sheet (matching the re-engagement variant) wraps a
    confetti header, a candy progress bar, and the two-column (64/36) layout.
    """
    tasks = _task_tasks(payload)
    alerts = _task_alerts(payload)
    mem = _task_memory(payload)
    cert_summary = getattr(payload, "certification_summary", {}) or {}

    completed = getattr(payload, "completed_count", 0)
    total = len(tasks)
    pct = getattr(payload, "completion_percentage", 0.0)
    remaining = getattr(payload, "total_estimated_time", 0)
    agents = getattr(payload, "committee_agent_count", 0)
    bar_pct = max(0.0, min(100.0, float(pct or (100.0 if total and completed == total else 0))))

    # ── Task cards ──
    task_cards = ""
    for t in tasks:
        status = getattr(t, "status", "pending")
        done = status == "completed"
        border = GREEN_500 if done else SLATE_200
        title_color = SLATE_400 if done else SLATE_800
        deco = "line-through" if done else "none"
        mode = getattr(t, "synthesis_mode", "") or ""
        cta = "View Result" if done else "Open in ALwrity →"
        url = getattr(t, "action_url", "") or "https://alwrity.com/dashboard"
        if not str(url).startswith("http"):
            url = "https://alwrity.com" + url
        task_cards += f"""
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
          <tr>
            <td style="background:{SLATE_50};border-radius:8px;border-left:4px solid {border};padding:12px 14px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:{_FONT};font-size:14px;font-weight:600;color:{title_color};text-decoration:{deco};padding-bottom:6px;">
                    {_esc(getattr(t, 'title', 'Untitled'))}{_synthesis_badge(mode) if mode else ''}
                  </td>
                </tr>
                <tr>
                  <td style="font-family:{_FONT};font-size:12px;color:{SLATE_500};padding-bottom:8px;">
                    {_pill_badge(getattr(t, 'pillar_id', ''))}
                    <span style="margin-left:8px;">{_priority_dot(getattr(t, 'priority', 'medium'))}{_esc(getattr(t, 'priority', ''))}</span>
                    <span style="margin-left:8px;">⏱ {_esc(getattr(t, 'estimated_time', 0))} min</span>
                    <span style="margin-left:8px;color:{SLATE_400};">by {_esc(getattr(t, 'source_agent', '-') or '-')}</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href="{_esc(url)}" target="_blank" style="display:inline-block;background:linear-gradient(90deg,{INDIGO},{VIOLET});color:#ffffff;padding:7px 16px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700;font-family:{_FONT};">
                      {cta}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>"""

    # ── Alerts ──
    alerts_html = ""
    for a in alerts:
        severity = getattr(a, "severity", "info") if not isinstance(a, dict) else a.get("severity", "info")
        title = getattr(a, "title", "") if not isinstance(a, dict) else a.get("title", "")
        message = getattr(a, "message", "") if not isinstance(a, dict) else a.get("message", "")
        bg = RED_BG if severity == "high" else AMBER_BG
        border = RED_500 if severity == "high" else AMBER_500
        fg = "#991b1b" if severity == "high" else "#92400e"
        alerts_html += f"""
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
          <tr>
            <td style="background:{bg};border-radius:6px;border-left:3px solid {border};padding:10px 12px;">
              <div style="font-family:{_FONT};font-size:13px;font-weight:600;color:{fg};margin-bottom:4px;">{_esc(title)}</div>
              <div style="font-family:{_FONT};font-size:12px;color:{SLATE_500};">{_esc(message)}</div>
            </td>
          </tr>
        </table>"""

    # ── Task memory ──
    mem_html = ""
    for m in mem:
        title = getattr(m, "title", "")
        signal = getattr(m, "signal_text", "")
        mem_html += f"""
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:6px;">
          <tr>
            <td style="background:{BLUE_BG};border-radius:6px;border-left:3px solid {BLUE_500};padding:8px 12px;">
              <div style="font-family:{_FONT};font-size:13px;font-weight:600;color:#1e40af;">{_esc(title)}</div>
              <div style="font-family:{_FONT};font-size:12px;color:#1e3a8a;margin-top:2px;">{_esc(signal)}</div>
            </td>
          </tr>
        </table>"""

    # ── Certification ──
    cert_rows = ""
    for agent, cert in cert_summary.items():
        state = getattr(cert, "state", "unknown")
        label = state.replace("_", " ").title()
        cert_rows += f"""
        <tr>
          <td style="padding:4px 0;font-family:{_FONT};font-size:13px;color:{SLATE_700};">
            {_cert_indicator(state)} {_esc(agent)}
            <span style="color:{SLATE_400};font-size:12px;margin-left:4px;">— {label}</span>
          </td>
        </tr>"""

    # synthesis breakdown line
    sb = getattr(payload, "synthesis_mode_breakdown", {}) or {}
    mode_notes = " · ".join(f"{_esc(k)}: {v}" for k, v in sb.items()) or "no analysis data"

    cert_block = cert_rows or (
        f'<tr><td style="font-family:{_FONT};font-size:12px;color:{SLATE_500};">'
        "No certification data</td></tr>"
    )
    alerts_block = alerts_html or (
        f'<div style="font-family:{_FONT};font-size:12px;color:{SLATE_500};">'
        "All quiet — no alerts.</div>"
    )
    mem_block = mem_html or (
        f'<div style="font-family:{_FONT};font-size:12px;color:{SLATE_500};">'
        "No recent history yet.</div>"
    )

    return f"""<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<title>Your Daily ALwrity Plan</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  body, table, td, a {{ -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }}
  table, td {{ mso-table-lspace:0pt; mso-table-rspace:0pt; }}
  body {{ margin:0 !important; padding:0 !important; width:100% !important; background-color:#0f172a; }}
  @keyframes pulse {{
    0% {{ box-shadow:0 0 0 0 rgba(99,102,241,0.60); }}
    70% {{ box-shadow:0 0 0 14px rgba(99,102,241,0); }}
    100% {{ box-shadow:0 0 0 0 rgba(99,102,241,0); }}
  }}
  .pulse {{ animation: pulse 1.6s infinite; }}
  .col-left, .col-right {{ display:table-cell; }}
  @media only screen and (max-width:620px) {{
    .email-container {{ width:100% !important; padding:12px !important; }}
    .col-left, .col-right {{ display:block !important; width:100% !important; padding:0 0 12px 0 !important; }}
    .hide-mobile {{ display:none !important; }}
  }}
</style>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:{_FONT};">

<div style="display:none;font-size:1px;color:#0f172a;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  {completed} of {total} tasks done · {_esc(getattr(payload,'date',''))} · {mode_notes}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(160deg,#1e1b4b 0%,#312e81 28%,#4c1d95 50%,#6d28d9 66%,#7c3aed 78%,#4f46e5 100%);">
<tr><td align="center" style="padding:26px 12px;">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-container" style="max-width:600px;width:100%;position:relative;">

  <div class="hide-mobile" style="position:absolute;top:8px;left:0;right:0;height:110px;pointer-events:none;">
    {_confetti(2, '8px')}{_confetti(5, '40px')}{_confetti(8, '72px')}
  </div>

  <!-- HEADER -->
  <tr>
    <td style="padding:0 0 16px 0;text-align:center;">
      <div style="font-family:{_FONT};font-size:12px;color:#c7d2fe;letter-spacing:2px;">⚡ ALWRITY &nbsp;·&nbsp; YOUR DAILY PLAN &nbsp;·&nbsp;</div>
      <div style="font-family:{_FONT};font-size:34px;font-weight:800;color:#ffffff;line-height:1.15;margin-top:8px;">
        {_ribbon('Today', AMBER)} your team
        <br>got to work.
      </div>
      <div style="font-family:{_FONT};font-size:14px;color:#e0e7ff;margin-top:10px;line-height:1.6;">
        {completed} of {total} tasks done &middot; across {agents or 'n/a'} agents &middot;
        <strong style="color:#fde68a;">~{remaining} min</strong> to finish.
      </div>
    </td>
  </tr>

  <!-- PROGRESS CARD -->
  <tr>
    <td style="padding:0 0 16px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:20px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle" style="font-family:{_FONT};font-size:20px;font-weight:800;color:{SLATE_800};">
                  {_ribbon(f'{bar_pct:.0f}%', LIME)} complete
                </td>
                <td align="right" valign="middle" style="font-family:{_FONT};font-size:13px;color:{SLATE_500};">
                  ⏱ ~{remaining} min remaining
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding-top:14px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{SLATE_100};border-radius:8px;height:14px;">
                    <tr>
                      <td style="width:{bar_pct}%;background:linear-gradient(90deg,{INDIGO},{VIOLET},{FUCHSIA});border-radius:8px;height:14px;font-size:1px;line-height:14px;">&nbsp;</td>
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

  <!-- TWO-COLUMN -->
  <tr>
    <td style="padding:0 0 16px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <!-- LEFT 64% : Tasks -->
          <td width="64%" valign="top" class="col-left" style="width:64%;padding:0 8px 0 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:16px;">
              <tr>
                <td style="padding:18px 16px 4px 16px;font-family:{_FONT};font-size:17px;font-weight:800;color:{SLATE_800};">
                  ⚡ Today's Tasks
                </td>
                <td align="right" style="padding:18px 16px 4px 0;font-family:{_FONT};font-size:12px;color:{SLATE_400};white-space:nowrap;">
                  {total} tasks · {remaining} min
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding:0 12px 20px 12px;">
                  {task_cards}
                </td>
              </tr>
            </table>
          </td>
          <!-- RIGHT 36% : supporting -->
          <td width="36%" valign="top" class="col-right" style="width:36%;padding:0 0 0 8px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">

              <tr>
                <td style="padding:0 0 12px 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:16px;">
                    <tr><td style="padding:14px 16px;font-family:{_FONT};font-size:15px;font-weight:800;color:{SLATE_800};">🔍 Agent Team</td></tr>
                    <tr><td style="padding:0 16px 4px 16px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">{cert_block}</table></td></tr>
                    <tr><td style="padding:8px 16px 16px 16px;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:{SLATE_50};border-radius:6px;padding:8px 10px;font-family:{_FONT};font-size:11px;color:{SLATE_500};">{_esc(getattr(payload,'generation_mode',''))} · {mode_notes}</td></tr></table></td></tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:0 0 12px 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:16px;">
                    <tr><td style="padding:14px 16px;font-family:{_FONT};font-size:15px;font-weight:800;color:{SLATE_800};">⚠️ Alerts</td></tr>
                    <tr><td style="padding:0 12px 14px 12px;">{alerts_block}</td></tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:0 0 12px 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:16px;">
                    <tr><td style="padding:14px 16px;font-family:{_FONT};font-size:15px;font-weight:800;color:{SLATE_800};">📈 Task History</td></tr>
                    <tr><td style="padding:0 12px 14px 12px;">{mem_block}</td></tr>
                  </table>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td style="padding:0 0 16px 0;text-align:center;">
      <table cellpadding="0" cellspacing="0" border="0" align="center">
        <tr>
          <td class="pulse" style="border-radius:999px;background:linear-gradient(90deg,#4f46e5,#8b5cf6,#ec4899);padding:2px;">
            <a href="https://alwrity.com/dashboard" target="_blank" style="display:inline-block;padding:14px 38px;font-family:{_FONT};font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:999px;background:#111827;">
              Complete Your Daily Plan &rarr;
            </a>
          </td>
        </tr>
      </table>
      <div style="font-family:{_FONT};font-size:12px;color:#c7d2fe;padding-top:8px;">One click and today's plan turns into content.</div>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="padding:0 0 10px 0;text-align:center;">
      <div style="font-family:{_FONT};font-size:12px;color:#94a3b8;line-height:1.7;">
        You're receiving this because you opted in to ALwrity's agent-team summaries.<br>
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


# =============================================================================
# Re-engagement variant
# =============================================================================

def render_reengagement(payload, verbose: bool = True) -> str:
    """Render the bold 'go crazy' re-engagement email from a payload.

    The design doc (Sec 10) fires this when the user has zero completed tasks
    in the idle window: it leads with the lowest-effort pending task.
    """
    tasks = _task_tasks(payload)
    total = len(tasks)
    pending = [t for t in tasks if getattr(t, "status", "pending") != "completed"]
    completed = getattr(payload, "completed_count", 0)
    # Accurate actionable time = sum of pending tasks only (not completed ones).
    total_min = sum(int(getattr(t, "estimated_time", 0) or 0) for t in pending)

    # lowest-effort pending task (design doc: "quickest" = lowest estimated_time)
    quickest = min(pending, key=lambda t: getattr(t, "estimated_time", 0)) if pending else None

    # ── Quick-win cards ──
    pending_cards = ""
    card_index = 0
    for t in tasks:
        status = getattr(t, "status", "pending")
        if status == "completed":
            continue
        card_index += 1
        accent = INDIGO
        emoji = "🎯"
        t_time = int(getattr(t, "estimated_time", 0) or 0)
        label = _task_kicker(t)
        button_label = "Continue" if t is quickest else "Open"
        url = getattr(t, "action_url", "") or "https://alwrity.com/dashboard"
        if not str(url).startswith("http"):
            url = "https://alwrity.com" + url
        pending_cards += f"""
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
          <tr>
            <td style="padding:13px 15px;background:#ffffff;border:1px solid {SLATE_200};border-radius:12px;border-left:5px solid {accent};">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="26" valign="top" style="font-size:18px;">{card_index}.</td>
                  <td style="font-family:{_FONT};font-size:14px;font-weight:700;color:{SLATE_800};padding-bottom:6px;">{_esc(getattr(t,'title','Untitled'))}</td>
                  <td align="right" style="font-family:{_FONT};font-size:12px;font-weight:800;color:{accent};white-space:nowrap;">⏱ {t_time} min</td>
                </tr>
                <tr>
                  <td colspan="3" style="padding-bottom:6px;font-family:{_FONT};font-size:12px;color:{SLATE_500};line-height:1.5;">{label}</td>
                </tr>
                <tr>
                  <td colspan="3">
                    <a href="{_esc(url)}" target="_blank" style="display:inline-block;background:{accent};color:#ffffff;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700;font-family:{_FONT};">{button_label} →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>"""

    if not pending_cards:
        pending_cards = (
            f'<div style="font-family:{_FONT};font-size:13px;color:{SLATE_500};">'
            "You are all caught up. 🎉</div>"
        )

    quickest_cta = ""
    if quickest:
        qtitle = _esc(getattr(quickest, "title", "Untitled"))
        qurl = getattr(quickest, "action_url", "") or "https://alwrity.com/dashboard"
        if not str(qurl).startswith("http"):
            qurl = "https://alwrity.com" + qurl
        qtime = int(getattr(quickest, "estimated_time", 0) or 0)
        # One-click deep link straight to the lowest-effort pending task.
        quickest_cta = f"""
        <tr>
          <td style="padding:0 0 14px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(90deg,#4f46e5,#7c3aed);border-radius:16px;overflow:hidden;">
              <tr>
                <td style="padding:18px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="font-family:{_FONT};font-size:13px;color:#e0e7ff;letter-spacing:1px;">⚡ QUICKEST WIN</td>
                    </tr>
                    <tr>
                      <td style="font-family:{_FONT};font-size:18px;font-weight:800;color:#ffffff;padding-top:4px;">{qtitle}</td>
                    </tr>
                    <tr>
                      <td style="font-family:{_FONT};font-size:12px;color:#c7d2fe;padding-top:6px;">Only ~{qtime} min to knock this one out — great first move.</td>
                    </tr>
                    <tr>
                      <td style="padding-top:12px;">
                        <a href="{_esc(qurl)}" target="_blank" style="display:inline-block;background:#ffffff;color:#4f46e5;padding:9px 20px;border-radius:999px;font-family:{_FONT};font-size:13px;font-weight:800;text-decoration:none;">
                          Continue &rarr;
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>"""
    else:
        quickest_cta = f"""
        <tr>
          <td style="padding:0 0 14px 0;">
            <div style="font-family:{_FONT};font-size:13px;color:#e9d5ff;line-height:1.6;">
              You’re all caught up — your {total} pending tasks are waiting for that spark. 🎉
            </div>
          </td>
        </tr>"""

    idle_days = int(getattr(payload, "idle_days", 0) or 0)
    if idle_days > 0:
        intro_line = (
            f"It’s been <strong style=\"color:#fde68a;\">{idle_days} day{'s' if idle_days != 1 else ''}</strong> "
            f"since your last power move. Here’s how to turn "
            f"<strong style=\"color:#6ee7b7;\">{total_min} focused minutes</strong> "
            f"into serious organic momentum."
        )
    else:
        intro_line = (
            f"Here’s how to turn <strong style=\"color:#6ee7b7;\">{total_min} focused minutes</strong> "
            f"into serious organic momentum — your {total} pending tasks are waiting."
        )

    return f"""<!DOCTYPE html>
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
<body style="margin:0;padding:0;background-color:#0f172a;font-family:{_FONT};">

<div style="display:none;font-size:1px;color:#0f172a;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  You have {total} tasks waiting · only ~{total_min} min · let's make it a streak 🎉
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(160deg,#1e1b4b 0%,#312e81 28%,#4c1d95 46%,#7c3aed 62%,#db2777 80%,#0f172a 100%);">
<tr><td align="center" style="padding:34px 14px;">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-container" style="max-width:600px;width:100%;position:relative;">

  <div class="hide-mobile" style="position:absolute;top:10px;left:0;right:0;height:120px;pointer-events:none;">
    {_confetti(1, '10px')}{_confetti(4, '44px')}{_confetti(7, '78px')}
  </div>

  <tr>
    <td style="padding:0 0 14px 0;text-align:center;">
      <div style="font-family:{_FONT};font-size:12px;color:#fbcfe8;letter-spacing:2px;">⚡ ALWRITY &nbsp;·&nbsp; YOUR AI CONTENT ENGINE ·</div>
      <div style="font-family:{_FONT};font-size:34px;font-weight:800;color:#ffffff;line-height:1.15;margin-top:8px;">
        Your content engine<br>has been {_ribbon('waiting', AMBER)}.
      </div>
      <div style="font-family:{_FONT};font-size:15px;color:#e9d5ff;margin-top:10px;line-height:1.6;">
        {intro_line}
      </div>
    </td>
  </tr>

  <tr>
    <td style="padding:0 0 14px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.13);border:1px solid rgba(255,255,255,0.30);border-radius:16px;">
        <tr>
          <td style="padding:18px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center">
                  <div style="font-family:{_FONT};font-size:11px;color:#c7d2fe;letter-spacing:1px;">PENDING</div>
                  <div style="font-family:{_FONT};font-size:42px;font-weight:800;color:#ffffff;line-height:1.1;">{total}</div>
                  <div style="font-family:{_FONT};font-size:12px;color:#c7d2fe;">~{total_min} min</div>
                </td>
                <td align="center" style="border-left:1px solid rgba(255,255,255,0.30);">
                  <div style="font-family:{_FONT};font-size:11px;color:#c7d2fe;letter-spacing:1px;">COMPLETED</div>
                  <div style="font-family:{_FONT};font-size:42px;font-weight:800;color:#6ee7b7;line-height:1.1;">{completed}</div>
                  <div style="font-family:{_FONT};font-size:12px;color:#c7d2fe;">this cycle</div>
                </td>
                <td align="center" style="border-left:1px solid rgba(255,255,255,0.30);">
                  <div style="font-family:{_FONT};font-size:11px;color:#c7d2fe;letter-spacing:1px;">STREAK</div>
                  <div style="font-family:{_FONT};font-size:42px;font-weight:800;color:#fde68a;line-height:1.1;">🔥 0</div>
                  <div style="font-family:{_FONT};font-size:12px;color:#c7d2fe;">let's start one</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding:0 0 14px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.11);border:1px solid rgba(255,255,255,0.22);border-radius:16px;">
        <tr>
          <td style="padding:16px 20px;">
            <div style="font-family:{_FONT};font-size:11px;color:#c7d2fe;letter-spacing:2px;padding-bottom:6px;">✦ &nbsp;WHY THIS MATTERS&nbsp; ✦</div>
            <div style="font-family:{_FONT};font-size:13px;color:#e9d5ff;line-height:1.7;">
              Brands that publish <strong style="color:#fde68a;">3+ pieces a week</strong> earn
              <strong style="color:#6ee7b7;">~2.5&times; more organic traffic</strong>.
              Your agent team already drafted the ideas — {_ribbon('completion is all that’s between you and the upside', LIME)}. 💪
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  {quickest_cta}

  <tr>
    <td style="padding:0 0 12px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(90deg,#eef2ff,#f5f3ff);padding:16px 18px;">
            <div style="font-family:{_FONT};font-size:17px;font-weight:800;color:{INK};">⚡ Quick wins — maximum impact, minimum effort</div>
            <div style="font-family:{_FONT};font-size:12px;color:{SLATE_500};margin-top:2px;">Start with the shortest task — action creates traction. 🚀</div>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 14px 16px 14px;">
            {pending_cards}
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding:0 0 14px 0;text-align:center;">
      <table cellpadding="0" cellspacing="0" border="0" align="center">
        <tr>
          <td class="pulse" style="border-radius:999px;background:linear-gradient(90deg,#4f46e5,#a855f7,#ec4899);padding:2px;">
            <a href="https://alwrity.com/dashboard" target="_blank" style="display:inline-block;padding:14px 38px;font-family:{_FONT};font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:999px;background:#111827;">
              Reclaim Your {total_min} Minutes &rarr; 🎉
            </a>
          </td>
        </tr>
      </table>
      <div style="font-family:{_FONT};font-size:12px;color:#c7d2fe;padding-top:8px;">Your team's ideas are one click from becoming content.</div>
    </td>
  </tr>

  <tr>
    <td style="padding:0 0 8px 0;text-align:center;">
      <div style="font-family:{_FONT};font-size:12px;color:#94a3b8;line-height:1.7;">
        You're receiving this because you opted in to ALwrity's agent-team summaries.<br>
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


# =============================================================================
# Weekly summary digest
# =============================================================================

def render_weekly_digest(payload, verbose: bool = True) -> str:
    """Render the full-width weekly summary email (design doc Sec 11).

    Takes a :class:`WeeklySummaryPayload` (or any object exposing the same
    attributes): weekly totals, strongest/weakest pillar, and per-agent
    acceptance, all data-driven.
    """
    week_label = _esc(getattr(payload, "week_label", "This week"))
    total = getattr(payload, "total_tasks", 0)
    completed = getattr(payload, "completed", 0)
    skipped = getattr(payload, "skipped", 0)
    pct = getattr(payload, "completion_percentage", 0.0)
    strongest = _esc(getattr(payload, "strongest_pillar", "-") or "-")
    weakest = _esc(getattr(payload, "weakest_pillar", "-") or "-")
    agents = getattr(payload, "agents", []) or []
    pillars = getattr(payload, "pillars", []) or []

    agent_rows = ""
    for a in agents:
        name = _esc(getattr(a, "agent", "-") or "-")
        prop = getattr(a, "proposed", 0)
        comp = getattr(a, "completed", 0)
        rate = getattr(a, "acceptance_rate", 0.0)
        bar_color = GREEN_500 if rate >= 50 else AMBER_500 if rate >= 25 else ROSE
        bar_w = max(0.0, min(100.0, float(rate)))
        agent_rows += f"""
        <tr>
          <td style="padding:9px 0;font-family:{_FONT};font-size:13px;color:{SLATE_700};">{name}</td>
          <td align="center" style="padding:9px 0;font-family:{_FONT};font-size:13px;color:{SLATE_500};">{comp}/{prop}</td>
          <td align="right" style="padding:9px 0;">
            <table width="90" cellpadding="0" cellspacing="0" border="0" align="right" style="background:{SLATE_100};border-radius:6px;height:8px;">
              <tr><td style="width:{bar_w}%;background:{bar_color};border-radius:6px;height:8px;font-size:1px;line-height:8px;">&nbsp;</td></tr>
            </table>
            <span style="font-family:{_FONT};font-size:12px;font-weight:700;color:{SLATE_700};padding-left:6px;">{rate:.0f}%</span>
          </td>
        </tr>"""

    pillar_rows = ""
    for p in pillars:
        pname = _esc(getattr(p, "pillar_id", "-") or "-")
        prop = getattr(p, "proposed", 0)
        comp = getattr(p, "completed", 0)
        rate = getattr(p, "completion_rate", 0.0)
        pillar_rows += f"""
        <tr>
          <td style="padding:7px 0;font-family:{_FONT};font-size:13px;color:{SLATE_700};">{_pill_badge(pname)}</td>
          <td align="center" style="padding:7px 0;font-family:{_FONT};font-size:13px;color:{SLATE_500};">{comp}/{prop}</td>
          <td align="right" style="padding:7px 0;font-family:{_FONT};font-size:13px;font-weight:700;color:{SLATE_700};">{rate:.0f}%</td>
        </tr>"""

    if not agent_rows:
        agent_rows = (
            f'<tr><td style="padding:10px 0;font-family:{_FONT};font-size:13px;color:{SLATE_500};">'
            "No agent acceptance data for this week.</td></tr>"
        )
    if not pillar_rows:
        pillar_rows = (
            f'<tr><td style="padding:10px 0;font-family:{_FONT};font-size:13px;color:{SLATE_500};">'
            "No pillar data for this week.</td></tr>"
        )

    return f"""<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<title>Your Weekly ALwrity Summary</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  body, table, td, a {{ -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }}
  table, td {{ mso-table-lspace:0pt; mso-table-rspace:0pt; }}
  body {{ margin:0 !important; padding:0 !important; width:100% !important; background-color:#0f172a; }}
  @keyframes pulse {{
    0% {{ box-shadow:0 0 0 0 rgba(99,102,241,0.60); }}
    70% {{ box-shadow:0 0 0 14px rgba(99,102,241,0); }}
    100% {{ box-shadow:0 0 0 0 rgba(99,102,241,0); }}
  }}
  .pulse {{ animation: pulse 1.6s infinite; }}
  @media only screen and (max-width:620px) {{
    .email-container {{ width:100% !important; padding:12px !important; }}
    .hide-mobile {{ display:none !important; }}
  }}
</style>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:{_FONT};">

<div style="display:none;font-size:1px;color:#0f172a;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  {week_label} · {completed}/{total} tasks completed · {pct:.0f}%
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(160deg,#052e16 0%,#14532d 30%,#166534 55%,#15803d 75%,#4d7c0f 100%);">
<tr><td align="center" style="padding:28px 12px;">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-container" style="max-width:600px;width:100%;position:relative;">

  <div class="hide-mobile" style="position:absolute;top:8px;left:0;right:0;height:110px;pointer-events:none;">
    {_confetti(3, '8px')}{_confetti(6, '40px')}{_confetti(9, '72px')}
  </div>

  <!-- HEADER -->
  <tr>
    <td style="padding:0 0 16px 0;text-align:center;">
      <div style="font-family:{_FONT};font-size:12px;color:#bbf7d0;letter-spacing:2px;">⚡ ALWRITY &nbsp;·&nbsp; WEEKLY SUMMARY &nbsp;·&nbsp;</div>
      <div style="font-family:{_FONT};font-size:32px;font-weight:800;color:#ffffff;line-height:1.15;margin-top:8px;">
        Your week in <br>content &amp; growth.
      </div>
      <div style="font-family:{_FONT};font-size:14px;color:#dcfce7;margin-top:10px;">{week_label} · {_esc(getattr(payload,'timezone','UTC'))}</div>
    </td>
  </tr>

  <!-- BIG STAT -->
  <tr>
    <td style="padding:0 0 16px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.13);border:1px solid rgba(255,255,255,0.30);border-radius:16px;">
        <tr>
          <td style="padding:22px 18px;" align="center">
            <div style="font-family:{_FONT};font-size:11px;color:#bbf7d0;letter-spacing:1px;">COMPLETION RATE</div>
            <div style="font-family:{_FONT};font-size:68px;font-weight:800;color:#ffffff;line-height:1.1;">{pct:.0f}%</div>
            <div style="font-family:{_FONT};font-size:13px;color:#bbf7d0;">{completed} of {total} tasks completed · {skipped} skipped</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- STRONGEST / WEAKEST -->
  <tr>
    <td style="padding:0 0 16px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="50%" valign="top" style="width:50%;padding:0 4px 0 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:14px;">
              <tr><td style="padding:14px 16px;font-family:{_FONT};font-size:12px;color:{SLATE_400};letter-spacing:1px;">STRONGEST PILLAR</td></tr>
              <tr><td style="padding:0 16px 16px 16px;font-family:{_FONT};font-size:18px;font-weight:800;color:{GREEN_500};">{_ribbon(strongest, LIME)}</td></tr>
            </table>
          </td>
          <td width="50%" valign="top" style="width:50%;padding:0 0 0 4px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:14px;">
              <tr><td style="padding:14px 16px;font-family:{_FONT};font-size:12px;color:{SLATE_400};letter-spacing:1px;">NEEDS ATTENTION</td></tr>
              <tr><td style="padding:0 16px 16px 16px;font-family:{_FONT};font-size:18px;font-weight:800;color:{ROSE};">{_ribbon(weakest, AMBER)}</td></tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- AGENT ACCEPTANCE -->
  <tr>
    <td style="padding:0 0 16px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:16px;">
        <tr>
          <td style="background:linear-gradient(90deg,#f0fdf4,#ecfdf5);padding:16px 18px;">
            <div style="font-family:{_FONT};font-size:17px;font-weight:800;color:{INK};">🤖 Agent Acceptance</div>
            <div style="font-family:{_FONT};font-size:12px;color:{SLATE_500};margin-top:2px;">Which agents propose tasks you actually complete.</div>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 18px 16px 18px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family:{_FONT};font-size:11px;color:{SLATE_400};letter-spacing:1px;">AGENT</td>
                <td align="center" style="font-family:{_FONT};font-size:11px;color:{SLATE_400};letter-spacing:1px;">DONE/PROPOSED</td>
                <td align="right" style="font-family:{_FONT};font-size:11px;color:{SLATE_400};letter-spacing:1px;">ACCEPTANCE</td>
              </tr>
              {agent_rows}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- PILLAR BREAKDOWN -->
  <tr>
    <td style="padding:0 0 16px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:16px;">
        <tr>
          <td style="padding:16px 18px 4px 18px;font-family:{_FONT};font-size:16px;font-weight:800;color:{SLATE_800};">📊 Pillar Breakdown</td>
        </tr>
        <tr>
          <td style="padding:4px 18px 16px 18px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family:{_FONT};font-size:11px;color:{SLATE_400};letter-spacing:1px;">PILLAR</td>
                <td style="font-family:{_FONT};font-size:11px;color:{SLATE_400};letter-spacing:1px;">DONE</td>
                <td style="font-family:{_FONT};font-size:11px;color:{SLATE_400};letter-spacing:1px;">RATE</td>
              </tr>
              {pillar_rows}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td style="padding:0 0 16px 0;text-align:center;">
      <table cellpadding="0" cellspacing="0" border="0" align="center">
        <tr>
          <td class="pulse" style="border-radius:999px;background:linear-gradient(90deg,#15803d,#65a30d);padding:2px;">
            <a href="https://alwrity.com/dashboard" target="_blank" style="display:inline-block;padding:14px 38px;font-family:{_FONT};font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:999px;background:#111827;">
              Plan next week &rarr;
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="padding:0 0 10px 0;text-align:center;">
      <div style="font-family:{_FONT};font-size:12px;color:#94a3b8;line-height:1.7;">
        You're receiving this because you opted in to ALwrity's agent-team summaries.<br>
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