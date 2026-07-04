"""Public contact form submission — forwards to team inbox via SMTP."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass

from loguru import logger

from services.backlink_outreach_sender import backlink_outreach_sender

CONTACT_INBOX_EMAIL = os.getenv("CONTACT_INBOX_EMAIL", "info@alwrity.com").strip()
CONTACT_FORM_LOG_ONLY = os.getenv("CONTACT_FORM_LOG_ONLY", "true").lower() in ("true", "1", "yes")

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


@dataclass
class ContactFormResult:
    success: bool
    message: str
    delivered: bool = False


def _validate_fields(name: str, email: str, message: str) -> None:
    name = (name or "").strip()
    email = (email or "").strip()
    message = (message or "").strip()

    if not name:
        raise ValueError("Please enter your name.")
    if len(name) > 200:
        raise ValueError("Name must be 200 characters or fewer.")
    if not email or not _EMAIL_RE.match(email):
        raise ValueError("Please enter a valid email address.")
    if len(email) > 320:
        raise ValueError("Email must be 320 characters or fewer.")
    if not message:
        raise ValueError("Please enter your message.")
    if len(message) > 1500:
        raise ValueError("Message must be 1,500 characters or fewer.")


async def submit_contact_form(name: str, email: str, message: str) -> ContactFormResult:
    name = name.strip()
    email = email.strip()
    message = message.strip()
    _validate_fields(name, email, message)

    subject = f"ALwrity website contact from {name}"
    body = (
        f"New message from the ALwrity contact form\n\n"
        f"Name: {name}\n"
        f"Email: {email}\n\n"
        f"Message:\n{message}\n"
    )

    if not backlink_outreach_sender.is_configured():
        logger.warning(
            "Contact form received (SMTP not configured) — name={name} email={email} message_preview={preview}",
            name=name,
            email=email,
            preview=message[:120],
        )
        if CONTACT_FORM_LOG_ONLY:
            return ContactFormResult(
                success=True,
                message="Message sent — we'll reply within 5 business days.",
                delivered=False,
            )
        return ContactFormResult(
            success=False,
            message="Contact form is temporarily unavailable. Please email info@alwrity.com directly.",
            delivered=False,
        )

    send_result = await backlink_outreach_sender.send_email(
        to_email=CONTACT_INBOX_EMAIL,
        subject=subject,
        body=body,
        from_email=None,
    )

    if not send_result.success:
        logger.error(
            "Contact form SMTP send failed: reasons={reasons} from={email}",
            reasons=send_result.failure_reasons,
            email=email,
        )
        return ContactFormResult(
            success=False,
            message="We couldn't send your message right now. Please email info@alwrity.com directly.",
            delivered=False,
        )

    logger.info("Contact form delivered to {inbox} from {email}", inbox=CONTACT_INBOX_EMAIL, email=email)
    return ContactFormResult(
        success=True,
        message="Message sent — we'll reply within 5 business days.",
        delivered=True,
    )
