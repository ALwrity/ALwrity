"""Send live verification emails for the production digest renderer wiring.

Exercises the real production path used by ``send_digest``:
  render_email(payload, verbose, reengage=...)  -> dispatch to the two-column
  standard or bold re-engagement template, then the real Resend pipeline.

This mirrors the approved two-column (64/36) and confetti/ribbon designs but
drives them through the production ``email_templates`` renderers instead of the
standalone mock scripts, so the live send provably exercises the code now wired
into production.

Usage (from backend/):
    python scripts/send_digest_live_verify.py to@example.com
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

from services.daily_email_digest import (
    DigestPayload,
    TaskSummary,
    TaskMemorySignal,
    CertificationInfo,
    render_email,
    _send_via_resend,
)


def build_payload() -> DigestPayload:
    tasks = [
        TaskSummary(
            title="Write a blog post about AI trends in healthcare",
            pillar_id="plan",
            priority="high",
            estimated_time=25,
            status="completed",
            action_url="/blog-writer?topic=ai-healthcare",
            source_agent="content_strategist",
            synthesis_mode="llm",
        ),
        TaskSummary(
            title="Optimize meta descriptions for product pages",
            pillar_id="analyze",
            priority="high",
            estimated_time=15,
            status="pending",
            action_url="/seo-dashboard",
            source_agent="seo_specialist",
            synthesis_mode="data_derived",
        ),
        TaskSummary(
            title="Create a social media thread about industry insights",
            pillar_id="engage",
            priority="medium",
            estimated_time=20,
            status="pending",
            action_url="/social-scheduler",
            source_agent="social_media_manager",
            synthesis_mode="llm",
        ),
        TaskSummary(
            title="Draft newsletter for subscriber re-engagement",
            pillar_id="publish",
            priority="medium",
            estimated_time=30,
            status="pending",
            action_url="/newsletter-builder",
            source_agent="content_strategist",
            synthesis_mode="llm",
        ),
    ]
    return DigestPayload(
        date="2026-09-02",
        generation_mode="agent_committee",
        synthesis_mode_breakdown={"llm": 3, "data_derived": 1, "template_fallback": 0},
        committee_agent_count=5,
        tasks=tasks,
        completed_count=1,
        not_done_count=3,
        completion_percentage=25.0,
        total_estimated_time=90,
        alerts=[
            {
                "severity": "high",
                "title": "SEO Crawl Issues Detected",
                "message": "3 product pages have missing meta descriptions. The SEO Specialist has prioritized fixing these.",
            }
        ],
        task_memory_signals=[
            TaskMemorySignal(
                title="Blog post on industry trends",
                pillar_id="plan",
                completion_count=3,
                last_completed="2026-08-30",
                feedback_score=5,
                signal_text="Completed 3 times. Last completed yesterday. User feedback: positive.",
            )
        ],
        certification_summary={
            "Content Strategist": CertificationInfo(
                agent="content_strategist",
                state="certified",
                tools_total=4,
                tools_blocked=0,
                missing_gates=[],
            ),
            "SEO Specialist": CertificationInfo(
                agent="seo_specialist",
                state="certified_with_provider_dependency",
                tools_total=6,
                tools_blocked=1,
                missing_gates=["google_search_console"],
            ),
        },
        confidence_estimates=[],
        timezone="UTC",
    )


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2

    to_email = sys.argv[1]
    api_key_present = bool(os.environ.get("RESEND_API_KEY"))
    if not api_key_present:
        print("RESEND_API_KEY is not set. Check backend/.env.")
        return 1

    payload = build_payload()

    # Standard two-column digest, verbose (lets users see the re-engage form too)
    std_html = render_email(payload, verbose=True, reengage=False)
    std_subject = f"Your Daily ALwrity Plan — {payload.completed_count}/{len(payload.tasks)} tasks done"
    mid = _send_via_resend(to_email, std_subject, std_html)
    print(f"standard -> message_id={mid}")

    # Re-engagement variant: subject flip + bold candy/confetti/ribbon body
    pending = [t for t in payload.tasks if t.status != "completed"]
    ren_html = render_email(payload, verbose=True, reengage=True)
    ren_subject = f"You have {len(pending)} pending tasks — here's the quickest one"
    mid2 = _send_via_resend(to_email, ren_subject, ren_html)
    print(f"reengagement -> message_id={mid2}")

    if mid and mid2:
        print(f"-> Both digest variants sent to {to_email}")
        print("-> Check your inbox (and spam folder).")
        return 0
    print("failed: one or both sends returned no message_id.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())