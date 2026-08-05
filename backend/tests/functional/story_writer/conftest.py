"""Shared fixtures for the Story Writer functional suite.

Active fixtures:
* ``story_writer_user``    — fresh fake user dict with a deterministic id
* ``story_writer_user_factory`` — callable producing fresh fake-user dicts
* ``story_writer_app``     — FastAPI app with the story_writer router mounted
                             and auth wired to the test user
* ``story_writer_client``  — TestClient over ``story_writer_app``

All fixtures are function-scoped so every test starts clean.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any, Dict

import pytest

# Ensure backend root is on sys.path before any backend imports.
_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


# -------------------------------------------------------------------------
# Stub the LLM image module before any story_writer router import.
# -------------------------------------------------------------------------
@pytest.fixture(scope="session", autouse=True)
def _install_llm_image_stubs():
    from tests.framework.service_stubs import install_llm_image_stubs
    install_llm_image_stubs()
    yield


# -------------------------------------------------------------------------
# Fake users
# -------------------------------------------------------------------------
@pytest.fixture
def story_writer_user() -> Dict[str, Any]:
    """A dict shaped like what ``get_current_user`` would return."""
    from tests.framework.auth import fake_user_factory
    return fake_user_factory(uid="user_storywriter", email="story@example.com")


@pytest.fixture
def story_writer_user_factory():
    """Return a callable that produces a fresh fake-user dict each call."""

    def _make(uid: str = "user_storywriter") -> Dict[str, Any]:
        from tests.framework.auth import fake_user_factory
        return fake_user_factory(uid=uid)

    return _make


# -------------------------------------------------------------------------
# App + client
# -------------------------------------------------------------------------
@pytest.fixture
def story_writer_app(story_writer_user_factory):
    """A fresh FastAPI app mounting the story writer router with auth overrides."""
    from tests.framework.app_factory import build_app
    from api.story_writer.router import router

    return build_app(
        routers=[router],
        auth_user_factory=story_writer_user_factory,
        title="ALwrity Story Writer Test App",
    )


@pytest.fixture
def story_writer_client(story_writer_app, story_writer_user_factory):
    """TestClient over the story writer test app."""
    from tests.framework.http import build_client
    return build_client(story_writer_app, base_user_factory=story_writer_user_factory)


# -------------------------------------------------------------------------
# DB-backed fixtures — for tests that need the story_projects table
# -------------------------------------------------------------------------

@pytest.fixture(scope="session")
def story_db_engine():
    """Session-scoped SQLite engine using a temp file."""
    import tempfile
    import os

    from sqlalchemy import create_engine

    fd, db_path = tempfile.mkstemp(suffix=".db", prefix="story_test_")
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
        echo=False,
    )

    from models.base import Base
    from models.story_project_models import StoryProject  # noqa: F401

    Base.metadata.create_all(engine)
    yield engine

    engine.dispose()
    os.close(fd)
    try:
        os.unlink(db_path)
    except OSError:
        pass


@pytest.fixture
def story_db_session(story_db_engine):
    """Fresh session per test with table truncation."""
    from sqlalchemy.orm import sessionmaker

    SessionLocal = sessionmaker(bind=story_db_engine, expire_on_commit=False)
    session = SessionLocal()
    from models.story_project_models import StoryProject
    session.query(StoryProject).delete()
    session.commit()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def story_writer_app_with_db(story_writer_app, story_db_session):
    """Override get_db to use the in-memory DB."""
    from services.database import get_db

    def _override_get_db():
        yield story_db_session

    story_writer_app.dependency_overrides[get_db] = _override_get_db
    return story_writer_app


@pytest.fixture
def story_writer_client_with_db(story_writer_app_with_db, story_writer_user_factory):
    """TestClient with DB dependency overridden."""
    from tests.framework.http import build_client
    return build_client(
        story_writer_app_with_db, base_user_factory=story_writer_user_factory
    )
