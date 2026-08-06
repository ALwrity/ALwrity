from sqlalchemy import Column, Integer, String, DateTime, Text, Index
from models.base import Base


class PlatformAnalyticsData(Base):
    __tablename__ = "platform_analytics_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True)
    platform = Column(String(50), nullable=False)
    site_url = Column(String(500), nullable=True)
    metrics_json = Column(Text, nullable=True)
    summary_json = Column(Text, nullable=True)
    status = Column(String(50), default="success")
    error_message = Column(String, nullable=True)
    analysis_date = Column(DateTime, nullable=False)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

    __table_args__ = (
        Index("ix_platform_analytics_user_platform_site", "user_id", "platform", "site_url"),
    )
