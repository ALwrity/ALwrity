"""Durable execution attempts for Today workflow recommendations."""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, JSON, String, Text

from models.base import Base


class WorkflowTaskExecution(Base):
    __tablename__ = "workflow_task_executions"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("daily_workflow_tasks.id"), nullable=False, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    idempotency_key = Column(String(255), nullable=False)
    action_id = Column(String(255), nullable=False)
    agent_type = Column(String(100), nullable=False)
    action_type = Column(String(50), nullable=False)
    status = Column(String(30), nullable=False, default="running", index=True)
    approval_request_id = Column(Integer, nullable=True)
    result_json = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index(
            "ix_workflow_execution_task_idempotency",
            "task_id",
            "idempotency_key",
            unique=True,
        ),
    )
