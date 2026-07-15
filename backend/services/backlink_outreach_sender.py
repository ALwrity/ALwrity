"""Email sender for backlink outreach via SMTP."""

from __future__ import annotations

import os
import ssl
import smtplib
import asyncio
from dataclasses import dataclass, field
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional, Set
from uuid import uuid4
from loguru import logger


SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USERNAME)
SMTP_ALLOWED_FROM_EMAILS = os.getenv("SMTP_ALLOWED_FROM_EMAILS", "")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() in ("true", "1", "yes")
SMTP_VERIFY_TLS = os.getenv("SMTP_VERIFY_TLS", "true").lower() in ("true", "1", "yes")
SMTP_SEND_TIMEOUT = int(os.getenv("SMTP_SEND_TIMEOUT", "30"))


@dataclass
class SenderAuthorizationResult:
    authorized: bool
    effective_sender_email: str = ""
    failure_reasons: List[str] = field(default_factory=list)


@dataclass
class SendEmailResult:
    success: bool
    effective_sender_email: str = ""
    message_id: str = ""
    failure_reasons: List[str] = field(default_factory=list)


class BacklinkOutreachSender:
    def __init__(self, smtp_config: Optional[dict] = None):
        if smtp_config:
            self._host = smtp_config.get("host", SMTP_HOST)
            self._port = int(smtp_config.get("port", SMTP_PORT))
            self._username = smtp_config.get("username", SMTP_USERNAME)
            self._password = smtp_config.get("password", SMTP_PASSWORD)
            self._from_email = smtp_config.get("from_email") or smtp_config.get("username", SMTP_FROM_EMAIL or SMTP_USERNAME)
            self._allowed_from_emails = SMTP_ALLOWED_FROM_EMAILS
            self._use_tls = bool(smtp_config.get("use_tls", SMTP_USE_TLS))
            self._verify_tls = bool(smtp_config.get("verify_tls", SMTP_VERIFY_TLS))
            self._timeout = int(smtp_config.get("timeout", SMTP_SEND_TIMEOUT))
        else:
            self._host = SMTP_HOST
            self._port = SMTP_PORT
            self._username = SMTP_USERNAME
            self._password = SMTP_PASSWORD
            self._from_email = SMTP_FROM_EMAIL or SMTP_USERNAME
            self._allowed_from_emails = SMTP_ALLOWED_FROM_EMAILS
            self._use_tls = SMTP_USE_TLS
            self._verify_tls = SMTP_VERIFY_TLS
            self._timeout = SMTP_SEND_TIMEOUT

    def is_configured(self) -> bool:
        return bool(self._username and self._password)

    @staticmethod
    def _normalize_email(email: Optional[str]) -> str:
        return (email or "").strip().lower()

    def _allowed_sender_aliases(self) -> Set[str]:
        aliases = {
            self._normalize_email(alias)
            for alias in self._allowed_from_emails.split(",")
            if self._normalize_email(alias)
        }
        for configured_sender in (self._from_email, self._username):
            normalized = self._normalize_email(configured_sender)
            if normalized:
                aliases.add(normalized)
        return aliases

    def validate_sender_alias(self, from_email: Optional[str] = None) -> SenderAuthorizationResult:
        default_sender = self._normalize_email(self._from_email or self._username)
        requested_sender = self._normalize_email(from_email) or default_sender

        if not self.is_configured():
            return SenderAuthorizationResult(
                authorized=False,
                effective_sender_email=requested_sender,
                failure_reasons=["smtp_not_configured"],
            )
        if not requested_sender:
            return SenderAuthorizationResult(
                authorized=False,
                failure_reasons=["smtp_sender_missing"],
            )

        allowed_aliases = self._allowed_sender_aliases()
        if requested_sender not in allowed_aliases:
            return SenderAuthorizationResult(
                authorized=False,
                effective_sender_email=requested_sender,
                failure_reasons=["sender_alias_not_authorized"],
            )

        return SenderAuthorizationResult(
            authorized=True,
            effective_sender_email=requested_sender,
        )

    async def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        from_email: Optional[str] = None,
    ) -> SendEmailResult:
        sender_validation = self.validate_sender_alias(from_email)
        if not sender_validation.authorized:
            logger.error(f"SMTP sender validation failed: {sender_validation.failure_reasons}")
            return SendEmailResult(
                success=False,
                effective_sender_email=sender_validation.effective_sender_email,
                failure_reasons=sender_validation.failure_reasons,
            )

        sender = sender_validation.effective_sender_email

        msg_id = f"<{uuid4().hex}@{sender.split('@')[-1] if '@' in sender else 'outreach.local'}>"
        msg = MIMEMultipart("alternative")
        msg["From"] = sender
        msg["To"] = to_email
        msg["Subject"] = subject
        msg["Message-ID"] = msg_id
        msg.attach(MIMEText(body, "plain"))

        loop = asyncio.get_running_loop()

        def _send() -> bool:
            try:
                tls_context = ssl.create_default_context()
                if not self._verify_tls:
                    tls_context.check_hostname = False
                    tls_context.verify_mode = ssl.CERT_NONE
                with smtplib.SMTP(self._host, self._port, timeout=self._timeout) as server:
                    if self._use_tls:
                        server.starttls(context=tls_context)
                        server.ehlo()
                    server.login(self._username, self._password)
                    server.sendmail(sender, [to_email], msg.as_string())
                logger.info(f"Email sent to {to_email}: {subject[:60]}")
                return True
            except smtplib.SMTPException as e:
                logger.error(f"SMTP error sending to {to_email}: {e}")
                return False
            except Exception as e:
                logger.error(f"Unexpected error sending to {to_email}: {e}")
                return False

        success = await loop.run_in_executor(None, _send)
        return SendEmailResult(
            success=success,
            effective_sender_email=sender,
            message_id=msg_id if success else "",
            failure_reasons=[] if success else ["smtp_send_failed"],
        )

    def personalize(self, template: str, variables: dict) -> str:
        """Replace {placeholder} variables in a template string."""
        for key, value in variables.items():
            template = template.replace(f"{{{key}}}", str(value))
        return template


backlink_outreach_sender = BacklinkOutreachSender()