"""DB models for LinkedIn OAuth token/state storage and analysis context.

Schema is owned by Alembic (see ``f9a0b1c2d3e4_add_linkedin_oauth_tables`` and
``fb1c2d3e4f5a_heal_linkedin_oauth_columns``). These models register the tables
with the shared ``Base`` so autogenerate stays in sync; the LinkedIn services
keep their historical raw-SQL data access.

Legacy ``zernio_*`` columns, when present on old databases, are intentionally
not modeled (unused; dropping them is unsafe and unnecessary).
"""

import sqlalchemy as sa
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, UniqueConstraint

from models.base import Base


class LinkedInOAuthToken(Base):
    __tablename__ = "linkedin_oauth_tokens"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False)
    provider_mode = Column(
        String(32), nullable=False, server_default=sa.text("'unipile'")
    )
    linkedin_access_token = Column(Text, nullable=True)
    linkedin_refresh_token = Column(Text, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    account_name = Column(String(255), nullable=True)
    profile_urn = Column(String(255), nullable=True)
    is_active = Column(Boolean, server_default=sa.text("1"))
    created_at = Column(DateTime, server_default=sa.text("CURRENT_TIMESTAMP"))
    updated_at = Column(DateTime, server_default=sa.text("CURRENT_TIMESTAMP"))
    unipile_account_id = Column(String(255), nullable=True)
    unipile_org_account_id = Column(String(255), nullable=True)
    unipile_sync_status = Column(String(64), nullable=True)


class LinkedInOAuthState(Base):
    __tablename__ = "linkedin_oauth_states"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False)
    state = Column(String(512), nullable=False)
    code_verifier = Column(Text, nullable=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=sa.text("CURRENT_TIMESTAMP"))
    used_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("state", name="uq_linkedin_oauth_states_state"),
    )


class LinkedInAnalysisContext(Base):
    __tablename__ = "linkedin_analysis_context"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False)
    unipile_account_id = Column(String(255), nullable=False)

    normalized_profile_json = Column(Text, nullable=True)
    raw_userprofile_json = Column(Text, nullable=True)
    profile_content_hash = Column(String(128), nullable=True)
    fetched_at = Column(DateTime, nullable=True)

    profile_context_json = Column(Text, nullable=True)
    profile_validation_json = Column(Text, nullable=True)
    user_completion_json = Column(Text, nullable=True)
    ai_profile_intelligence_json = Column(Text, nullable=True)
    topic_recommendations_json = Column(Text, nullable=True)
    profile_optimization_json = Column(Text, nullable=True)

    profile_context_updated_at = Column(DateTime, nullable=True)
    ai_intelligence_updated_at = Column(DateTime, nullable=True)
    recommendations_updated_at = Column(DateTime, nullable=True)
    profile_optimization_updated_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, server_default=sa.text("CURRENT_TIMESTAMP"))
    updated_at = Column(DateTime, server_default=sa.text("CURRENT_TIMESTAMP"))

    __table_args__ = (
        UniqueConstraint("user_id", name="uq_linkedin_analysis_context_user"),
    )
