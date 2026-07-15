"""Processes due backlink outreach follow-ups."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from loguru import logger

from services.database import get_session_for_user, get_all_user_ids
from models.backlink_outreach_models import FollowUpSchedule, OutreachAttempt, BacklinkLead
from services.backlink_outreach_sender import backlink_outreach_sender, BacklinkOutreachSender
from services.backlink_outreach_storage import BacklinkOutreachStorageService


def process_due_followups(user_id: Optional[str] = None) -> int:
    """Find and send follow-ups that are due (scheduled_for <= now AND not sent).
    If user_id is None, processes follow-ups for all users.
    Returns the number of follow-ups successfully sent.
    """
    user_ids = [user_id] if user_id else (get_all_user_ids() or [])
    total_sent = 0

    for uid in user_ids:
        db = get_session_for_user(uid)
        if not db:
            logger.warning(f"[followup_processor] No database session for user {uid}")
            continue

        try:
            now = datetime.utcnow()
            due: List[FollowUpSchedule] = (
                db.query(FollowUpSchedule)
                .filter(
                    FollowUpSchedule.scheduled_for <= now,
                    FollowUpSchedule.sent == False,
                )
                .all()
            )

            if not due:
                continue

            sent_count = 0
            for sched in due:
                attempt: OutreachAttempt | None = (
                    db.query(OutreachAttempt)
                    .filter(OutreachAttempt.id == sched.attempt_id)
                    .first()
                )
                if not attempt:
                    logger.warning(f"[followup_processor] Attempt {sched.attempt_id} not found for follow-up {sched.id}")
                    continue

                lead: BacklinkLead | None = (
                    db.query(BacklinkLead)
                    .filter(BacklinkLead.id == attempt.lead_id)
                    .first()
                )
                lead_email = lead.email if lead else ""
                if not lead_email:
                    logger.warning(f"[followup_processor] No lead email for attempt {sched.attempt_id}")
                    continue

                storage = BacklinkOutreachStorageService()
                user_smtp = storage.get_smtp_config(uid)
                sender = BacklinkOutreachSender(smtp_config=user_smtp) if user_smtp else backlink_outreach_sender
                result = sender.send_email(
                    to_email=lead_email,
                    subject=sched.subject or "",
                    body=sched.body or "",
                    from_email=getattr(attempt, "sender_email", None),
                )

                if result.success:
                    sched.sent = True
                    db.commit()
                    sent_count += 1
                    logger.info(f"[followup_processor] Sent follow-up {sched.id} for attempt {sched.attempt_id}")
                else:
                    logger.error(f"[followup_processor] Failed to send follow-up {sched.id}: {result.failure_reasons}")

            total_sent += sent_count
        except Exception as e:
            logger.error(f"[followup_processor] Error processing follow-ups for user {uid}: {e}")
            db.rollback()
        finally:
            db.close()

    return total_sent
