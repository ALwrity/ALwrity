from sqlalchemy import Column, Integer, String, DateTime, Index
from sqlalchemy.sql import func

from models.base import Base


class DailyEmailLedger(Base):
    """Idempotency ledger for daily email digests.

    Ensures one email per user per day, tracks send status, and enables
    the reconciler to recover missed sends.
    """

    __tablename__ = "daily_email_ledgers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True)
    plan_date = Column(String(10), nullable=False)  # YYYY-MM-DD format
    email_type = Column(String(20), nullable=False, default="daily")  # "daily" | "weekly"
    status = Column(
        String(30),
        nullable=False,
        default="pending",
    )  # pending | sent | skipped_no_content | skipped_opted_out | failed
    sent_at = Column(DateTime, nullable=True)
    resend_message_id = Column(String(255), nullable=True)  # for webhook reconciliation
    error_message = Column(String(500), nullable=True)  # last error if failed
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index(
            "idx_ledger_user_date_type",
            "user_id",
            "plan_date",
            "email_type",
            unique=True,
        ),
    )

    def __repr__(self):
        return f"<DailyEmailLedger(user_id={self.user_id}, date={self.plan_date}, type={self.email_type}, status={self.status})>"

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "plan_date": self.plan_date,
            "email_type": self.email_type,
            "status": self.status,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "resend_message_id": self.resend_message_id,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
