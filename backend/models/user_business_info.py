"""User Business Information Model for ALwrity backend."""
from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, Integer, String, Text, DateTime, func
from loguru import logger
from datetime import datetime

Base = declarative_base()

logger.debug("🔄 Loading UserBusinessInfo model...")

class UserBusinessInfo(Base):
    __tablename__ = 'user_business_info'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), index=True, nullable=True)
    business_description = Column(Text, nullable=False)
    industry = Column(String(100), nullable=True)
    target_audience = Column(Text, nullable=True)
    business_goals = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<UserBusinessInfo(id={self.id}, user_id={self.user_id}, industry='{self.industry}')>"

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "business_description": self.business_description,
            "industry": self.industry,
            "target_audience": self.target_audience,
            "business_goals": self.business_goals,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

logger.debug("✅ UserBusinessInfo model loaded successfully!")
