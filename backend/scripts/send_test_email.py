"""Standalone email-pipeline smoke test.

Sends a minimal test email DIRECTLY via the same Resend path the daily
digest uses, bypassing the digest/plan logic entirely.

Usage (from backend/):
    python scripts/send_test_email.py to@example.com
    python scripts/send_test_email.py to@example.com "Custom subject"

Interpreting the result:
- Prints "sent: <message_id>"  -> the email pipeline works; if a digest
  still does not arrive, the problem is in the digest payload/plan flow,
  not in email sending.
- Prints "failed: ..."         -> email sending itself is broken (check
  RESEND_API_KEY, the sender domain, and the recipient inbox/spam).

Reads RESEND_API_KEY (and optionally RESEND_FROM_EMAIL) from backend/.env
via the normal dotenv loading, or from the environment.
"""
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

# Load backend/.env so RESEND_API_KEY is available without extra setup.
try:
    from dotenv import load_dotenv

    load_dotenv(BACKEND_ROOT / ".env")
except Exception:
    pass

from services.daily_email_digest import _send_via_resend  # noqa: E402


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    to_email = sys.argv[1]
    subject = sys.argv[2] if len(sys.argv) > 2 else "ALwrity test email"
    api_key_present = bool(os.environ.get("RESEND_API_KEY"))
    if not api_key_present:
        print("RESEND_API_KEY is not set - cannot send. Check backend/.env.")
        return 1

    html = (
        "<html><body style='font-family:sans-serif'>"
        "<h2>ALwrity email pipeline test</h2>"
        "<p>If you received this, the Resend sending path works. "
        "Any digest delivery problems are in the digest/plan flow, "
        "not in email sending.</p>"
        "</body></html>"
    )
    message_id = _send_via_resend(to_email, subject, html)
    if message_id:
        print(f"sent: {message_id}")
        print("-> The email pipeline works. If digests still do not arrive, "
              "the problem is in the digest/plan codeflow.")
        return 0
    print("failed: no message_id returned (see the log lines above for the "
          "Resend error). Check RESEND_API_KEY, the verified sender domain, "
          "and the recipient address.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
