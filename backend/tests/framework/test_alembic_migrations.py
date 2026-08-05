"""Tests for the Alembic migration infrastructure introduced in Phase 2-4.

These tests verify that the baseline migration works end-to-end, that
the stamp-and-upgrade flow is idempotent, and that downgrade is safe.
"""

from __future__ import annotations

import sqlite3
import tempfile
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config as AlembicConfig
from sqlalchemy import create_engine, inspect

_ALEMBIC_INI = (
    Path(__file__).resolve().parents[2] / "alembic.ini"
)


def _fresh_engine():
    """Return a SQLAlchemy engine pointing at a fresh temp-disk SQLite database."""
    fd, db_path = tempfile.mkstemp(suffix=".db", prefix="alembic_test_")
    engine = create_engine(f"sqlite:///{db_path}")
    engine._db_path = db_path
    engine._db_fd = fd
    return engine


def _cleanup(engine):
    import os
    engine.dispose()
    os.close(engine._db_fd)
    try:
        os.unlink(engine._db_path)
    except OSError:
        pass


def _alembic_cfg(db_path: str) -> AlembicConfig:
    cfg = AlembicConfig(str(_ALEMBIC_INI))
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{db_path}")
    return cfg


def _table_names(engine):
    return set(inspect(engine).get_table_names())


def _alembic_version_row(engine) -> str | None:
    with engine.connect() as conn:
        result = conn.exec_driver_sql(
            "SELECT version_num FROM alembic_version LIMIT 1"
        ).fetchone()
        return result[0] if result else None


# ---------------------------------------------------------------------------


class TestBaselineMigration:
    """Verify the baseline_all_tables migration works on a fresh database."""

    @pytest.fixture
    def engine(self):
        eng = _fresh_engine()
        yield eng
        _cleanup(eng)

    def test_upgrade_head_creates_all_tables(self, engine):
        """Alembic upgrade head on a fresh DB creates all expected tables."""
        cfg = _alembic_cfg(engine._db_path)
        command.upgrade(cfg, "head")

        tables = _table_names(engine)
        assert "alembic_version" in tables
        assert "onboarding_sessions" in tables
        assert "subscription_plans" in tables
        assert len(tables) >= 125, f"Expected >= 125 tables, got {len(tables)}"

    def test_alembic_version_row_exists(self, engine):
        """After upgrade, alembic_version has the head revision."""
        cfg = _alembic_cfg(engine._db_path)
        command.upgrade(cfg, "head")

        rev = _alembic_version_row(engine)
        assert rev is not None, "alembic_version table must have a row"
        assert len(rev) == 12, f"Expected 12-char revision ID, got {rev!r}"

    def test_downgrade_removes_all_tables(self, engine):
        """Downgrade from baseline should drop everything except alembic_version."""
        cfg = _alembic_cfg(engine._db_path)
        command.upgrade(cfg, "head")
        assert len(_table_names(engine)) >= 125

        command.downgrade(cfg, "base")
        tables = _table_names(engine)
        assert tables == {"alembic_version"}, (
            f"Expected only alembic_version after base downgrade, got {tables}"
        )

    def test_repeat_upgrade_is_idempotent(self, engine):
        """Running upgrade head twice shouldn't fail or create duplicates."""
        cfg = _alembic_cfg(engine._db_path)
        command.upgrade(cfg, "head")
        count1 = len(_table_names(engine))
        command.upgrade(cfg, "head")
        count2 = len(_table_names(engine))
        assert count1 == count2, (count1, count2)


class TestStampExisting:
    """Verify the auto-stamp flow for existing pre-Alembic databases."""

    @pytest.fixture
    def engine(self):
        eng = _fresh_engine()
        yield eng
        _cleanup(eng)

    def _create_tables_via_orm(self, engine):
        """Simulate a pre-Alembic DB: create tables via ORM, skip alembic_version."""
        from models.base import Base

        # Trigger full model registration
        import services.database.init_db  # noqa: F401

        Base.metadata.create_all(bind=engine)

    def test_stamp_on_existing_db_makes_upgrade_a_noop(self, engine):
        """Stamp an existing (create_all) DB, then upgrade should be no-op."""
        self._create_tables_via_orm(engine)
        tables_before = _table_names(engine)
        assert "alembic_version" not in tables_before

        cfg = _alembic_cfg(engine._db_path)
        command.stamp(cfg, "head")

        # After stamp, alembic_version exists
        assert "alembic_version" in _table_names(engine)

        # Upgrade should be a no-op — no new tables, no errors
        command.upgrade(cfg, "head")
        tables_after = _table_names(engine)
        # Same tables except alembic_version was added by stamp
        assert tables_after == tables_before | {"alembic_version"}

    def test_stamp_does_not_damage_existing_data(self, engine):
        """Data in stamped tables survives stamp+upgrade."""
        self._create_tables_via_orm(engine)
        with engine.connect() as conn:
            conn.exec_driver_sql(
                "INSERT INTO onboarding_sessions (user_id, current_step, progress, onboarding_type)"
                " VALUES ('test_user', 3, 0.75, 'website')"
            )
            conn.commit()

        cfg = _alembic_cfg(engine._db_path)
        command.stamp(cfg, "head")
        command.upgrade(cfg, "head")

        with engine.connect() as conn:
            row = conn.exec_driver_sql(
                "SELECT user_id, current_step, progress, onboarding_type FROM onboarding_sessions"
            ).fetchone()
            assert row == ("test_user", 3, 0.75, "website")


class TestAutoStampDetection:
    """Verify the auto-stamp logic in init_db.py detects the right cases."""

    def test_empty_db_not_stamped(self):
        """Empty DB: _auto_stamp_existing_db returns False."""
        from services.database.init_db import _auto_stamp_existing_db

        eng = _fresh_engine()
        try:
            result = _auto_stamp_existing_db(eng, "test_empty")
            assert result is False
        finally:
            _cleanup(eng)

    def test_existing_db_with_tables_gets_stamped(self):
        """DB with tables but no alembic_version: auto-stamp returns True."""
        from services.database.init_db import _auto_stamp_existing_db
        from models.base import Base
        import services.database.init_db  # noqa: F401

        eng = _fresh_engine()
        try:
            Base.metadata.create_all(bind=eng)
            result = _auto_stamp_existing_db(eng, "test_existing")
            assert result is True
            assert "alembic_version" in _table_names(eng)
        finally:
            _cleanup(eng)
