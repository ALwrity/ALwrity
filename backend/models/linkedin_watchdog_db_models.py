"""SQLAlchemy models for Industry Watchdog persistence."""

import json
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, Index
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class WatchdogIndustryDB(Base):
    __tablename__ = "watchdog_industries"
    id = Column(String(64), primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    search_queries = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_watchdog_industries_user", "user_id", "name"),
    )

    def get_search_queries(self):
        return json.loads(self.search_queries or "[]")

    def set_search_queries(self, queries: list):
        self.search_queries = json.dumps(queries)


class WatchdogCompanyDB(Base):
    __tablename__ = "watchdog_companies"
    id = Column(String(64), primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    url = Column(Text, nullable=True)
    industry_tag = Column(String(255), nullable=True)
    search_queries = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_watchdog_companies_user", "user_id", "name"),
    )

    def get_search_queries(self):
        return json.loads(self.search_queries or "[]")

    def set_search_queries(self, queries: list):
        self.search_queries = json.dumps(queries)


class WatchdogPersonDB(Base):
    __tablename__ = "watchdog_people"
    id = Column(String(64), primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    title = Column(String(255), nullable=True)
    company = Column(String(255), nullable=True)
    linkedin_url = Column(Text, nullable=True)
    search_queries = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_watchdog_people_user", "user_id", "name"),
    )

    def get_search_queries(self):
        return json.loads(self.search_queries or "[]")

    def set_search_queries(self, queries: list):
        self.search_queries = json.dumps(queries)


class WatchdogUpdateDB(Base):
    __tablename__ = "watchdog_updates"
    id = Column(String(64), primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    category = Column(String(16), nullable=False, index=True)
    reference_id = Column(String(64), nullable=False, index=True)
    reference_name = Column(String(255), nullable=False)
    title = Column(String(512), nullable=False)
    url = Column(Text, nullable=False)
    summary = Column(Text, nullable=True)
    source = Column(String(255), nullable=True)
    published_date = Column(String(64), nullable=True)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_watchdog_updates_user_cat_created", "user_id", "category", "created_at"),
    )


class WatchdogMonitorDB(Base):
    __tablename__ = "watchdog_monitors"
    id = Column(String(64), primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    exa_monitor_id = Column(String(128), nullable=False, unique=True, index=True)
    category = Column(String(16), nullable=False)
    reference_id = Column(String(64), nullable=False, index=True)
    search_query = Column(Text, nullable=False)
    trigger_period = Column(String(8), nullable=False, default="1d")
    status = Column(String(16), nullable=False, default="active", index=True)
    webhook_secret = Column(String(255), nullable=True)
    last_run_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_watchdog_monitors_user_ref", "user_id", "category", "reference_id"),
    )
