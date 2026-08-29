"""DB models for WordPress integration (sites and published-post tracking).

Schema is owned by Alembic (see ``alembic_migrations/versions/``). These models
register the tables with the shared ``Base`` so autogenerate stays in sync; the
WordPress services keep their historical raw-SQL data access.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint

from models.base import Base


class WordPressSite(Base):
    __tablename__ = "wordpress_sites"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True)
    site_url = Column(String(1024), nullable=False)
    site_name = Column(String(255), nullable=True)
    username = Column(String(255), nullable=False)
    app_password = Column(String(512), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "site_url", name="uq_wordpress_sites_user_site"),
    )


class WordPressPost(Base):
    __tablename__ = "wordpress_posts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True)
    site_id = Column(Integer, ForeignKey("wordpress_sites.id"), nullable=False, index=True)
    wp_post_id = Column(Integer, nullable=False)
    title = Column(String(1024), nullable=False)
    status = Column(String(32), default="draft")
    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
