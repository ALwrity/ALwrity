"""DB models for OAuth provider token/state storage and GSC caches.

Schema is owned by Alembic (see ``f8d3e4f5a6b7_add_oauth_provider_tables``).
These models register the tables with the shared ``Base`` so autogenerate stays
in sync; the provider services keep their historical raw-SQL data access.

LinkedIn OAuth tables are intentionally NOT here: their schema is still owned
by ``services/integrations/linkedin_oauth.py::_init_db`` (raw DDL plus runtime
column healing for legacy DBs); converting them requires a dedicated pass.
"""

from datetime import datetime
import sqlalchemy as sa
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Index

from models.base import Base


class GSCCredential(Base):
    __tablename__ = "gsc_credentials"
    user_id = Column(String(255), primary_key=True)
    credentials_json = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=sa.text("CURRENT_TIMESTAMP"))
    updated_at = Column(DateTime, server_default=sa.text("CURRENT_TIMESTAMP"))


class GSCDataCache(Base):
    __tablename__ = "gsc_data_cache"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), ForeignKey("gsc_credentials.user_id"), nullable=False)
    site_url = Column(String(1024), nullable=False)
    data_type = Column(String(64), nullable=False)
    data_json = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=sa.text("CURRENT_TIMESTAMP"))
    expires_at = Column(DateTime, nullable=False)


class GSCOAuthState(Base):
    __tablename__ = "gsc_oauth_states"
    state = Column(String(512), primary_key=True)
    user_id = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=sa.text("CURRENT_TIMESTAMP"))


class BingOAuthToken(Base):
    __tablename__ = "bing_oauth_tokens"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    token_type = Column(String(64), server_default="bearer")
    expires_at = Column(DateTime, nullable=True)
    scope = Column(Text, nullable=True)
    site_url = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=sa.text("CURRENT_TIMESTAMP"))
    updated_at = Column(DateTime, server_default=sa.text("CURRENT_TIMESTAMP"))
    is_active = Column(Boolean, server_default=sa.text("1"))


class BingOAuthState(Base):
    __tablename__ = "bing_oauth_states"
    id = Column(Integer, primary_key=True, autoincrement=True)
    state = Column(String(512), nullable=False, unique=True)
    user_id = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=sa.text("CURRENT_TIMESTAMP"))
    expires_at = Column(DateTime, nullable=True)


class WordPressOAuthToken(Base):
    __tablename__ = "wordpress_oauth_tokens"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    token_type = Column(String(64), server_default="bearer")
    expires_at = Column(DateTime, nullable=True)
    scope = Column(Text, nullable=True)
    blog_id = Column(String(255), nullable=True)
    blog_url = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=sa.text("CURRENT_TIMESTAMP"))
    updated_at = Column(DateTime, server_default=sa.text("CURRENT_TIMESTAMP"))
    is_active = Column(Boolean, server_default=sa.text("1"))


class WordPressOAuthState(Base):
    __tablename__ = "wordpress_oauth_states"
    id = Column(Integer, primary_key=True, autoincrement=True)
    state = Column(String(512), nullable=False, unique=True)
    user_id = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=sa.text("CURRENT_TIMESTAMP"))
    expires_at = Column(DateTime, nullable=True)


class WixOAuthToken(Base):
    __tablename__ = "wix_oauth_tokens"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    token_type = Column(String(64), server_default="bearer")
    expires_at = Column(DateTime, nullable=True)
    expires_in = Column(Integer, nullable=True)
    scope = Column(Text, nullable=True)
    site_id = Column(String(255), nullable=True)
    member_id = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=sa.text("CURRENT_TIMESTAMP"))
    updated_at = Column(DateTime, server_default=sa.text("CURRENT_TIMESTAMP"))
    is_active = Column(Boolean, server_default=sa.text("1"))


class WixOAuthPKCEState(Base):
    __tablename__ = "wix_oauth_pkce_states"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False)
    state = Column(String(512), nullable=False, unique=True)
    code_verifier = Column(Text, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=sa.text("CURRENT_TIMESTAMP"))
    used_at = Column(DateTime, nullable=True)


Index(
    "idx_wix_oauth_pkce_user_state",
    WixOAuthPKCEState.user_id,
    WixOAuthPKCEState.state,
)


class YouTubeOAuthToken(Base):
    __tablename__ = "youtube_oauth_tokens"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    token_type = Column(String(64), server_default="bearer")
    expires_at = Column(DateTime, nullable=True)
    scope = Column(Text, nullable=True)
    channel_id = Column(String(255), nullable=True)
    channel_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=sa.text("CURRENT_TIMESTAMP"))
    updated_at = Column(DateTime, server_default=sa.text("CURRENT_TIMESTAMP"))
    is_active = Column(Boolean, server_default=sa.text("1"))


class YouTubeOAuthState(Base):
    __tablename__ = "youtube_oauth_states"
    id = Column(Integer, primary_key=True, autoincrement=True)
    state = Column(String(512), nullable=False, unique=True)
    user_id = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=sa.text("CURRENT_TIMESTAMP"))
    expires_at = Column(DateTime, nullable=True)
