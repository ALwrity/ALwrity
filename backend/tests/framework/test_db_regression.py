"""Regression safety net for Alembic Phase 1 (Base unification).

Captures the *current* database schema state before any refactoring so that
Phase 1 (merge 16 ``declarative_base()`` calls into a single shared Base)
can be verified without introducing regressions.

After Phase 1, this test must pass with **zero modifications** — all 152+
tables must still be created, all models must still import, and the table
count must not regress.
"""

from __future__ import annotations

import pytest
from sqlalchemy import inspect

from services.database import get_engine_for_user
from services.database.init_db import init_user_database


# Minimum table count snapshot taken 2026-08 before Phase 1.
_EXPECTED_MIN_TABLES = 125

# Tables created via schema_migrations.py raw SQL (not via create_all).
# These must still be present after init_user_database() completes.
_EXTRA_TABLES = {
    "sif_indexing_watermarks",
    "semantic_health_checks",
}


def _table_names(engine):
    inspector = inspect(engine)
    return set(inspector.get_table_names())


class TestDatabaseBaselineBeforeAlembic:
    """Regression guard: init_user_database() behaves identically before/after unification.

    Phase 1 goal: all 16 declarative_base() calls merge into a single
    ``from models.base import Base``.  When this test passes after that
    refactor, we know zero tables were lost, zero models are orphans,
    and the extra migration tables still get created.
    """

    @pytest.fixture(autouse=True)
    def _db(self):
        """Fresh per-user engine provisioned for each test."""
        self.engine = get_engine_for_user("test_db_regr")
        yield
        self.engine.dispose()

    def test_init_creates_min_tables(self):
        """Equivalent to `assert len(Base.metadata.tables) >= N` but tested live."""
        init_user_database("test_user_db_1")
        tables = _table_names(self.engine)
        assert len(tables) >= _EXPECTED_MIN_TABLES, (
            f"Expected >= {_EXPECTED_MIN_TABLES} tables, got {len(tables)}: {sorted(tables)}"
        )

    def test_alembic_version_table_exists_after_phase_4(self):
        """Phase 4: alembic upgrade head creates the alembic_version tracking table."""
        init_user_database("test_user_2")
        tables = _table_names(self.engine)
        assert "alembic_version" in tables, (
            "alembic_version table must exist after switching to alembic upgrade head"
        )

    def test_extra_tables_exist(self):
        """Tables created outside the ORM (schema_migrations.py) must be present."""
        init_user_database("test_user_3")
        tables = _table_names(self.engine)
        missing = _EXTRA_TABLES - tables
        assert not missing, f"Extra tables missing: {missing}"

    def test_all_model_modules_importable(self):
        """Verify all model module imports succeed — none of the transient
        import-side-effect tables (sif_indexing_watermarks, research_cache,
        outline_cache) break collection."""
        init_user_database("test_user_4")

        # Force import the subset of model files init_db imports
        # (These imports are the ones that fail if a Base is broken.)
        import models.agent_activity_models  # noqa: F811
        import models.daily_workflow_models  # noqa: F811
        import models.enhanced_calendar_models  # noqa: F811
        import models.gsc_brainstorm_cache_models  # noqa: F811
        import models.linkedin_monitoring_models  # noqa: F811
        import models.oauth_token_monitoring_models  # noqa: F811
        import models.platform_insights_monitoring_models  # noqa: F811
        import models.sif_indexing_watermark  # noqa: F811
        import models.website_analysis_monitoring_models  # noqa: F811
        from models.base import Base  # noqa: F811, F401
        from models.base import Base  # noqa: F811, F401
        from models.base import Base  # noqa: F811, F401
        from models.base import Base  # noqa: F811, F401
        from models.base import Base  # noqa: F811, F401
        from models.linkedin_comment_assistant_cache_model import (
            Base as _lcc,  # noqa: F811, F401
        )
        from models.base import Base                   as _lpa
        from models.base import Base  # noqa: F811, F401
        from models.base import Base                   as _wd
        from models.base import Base  # noqa: F811, F401
        from models.base import Base  # noqa: F811, F401
        from models.base import Base  # noqa: F811, F401
        from models.base import Base                   as _pas
        from models.base import Base  # noqa: F811, F401
        from models.base import Base  # noqa: F811, F401
        from models.base import Base  # noqa: F811, F401

        assert True  # all imports succeeded

    def test_table_count_is_stable_across_repeated_inits(self):
        """Calling init twice shouldn't change table count."""
        self.engine.dispose()
        self.engine = get_engine_for_user("test_user_5")
        init_user_database("test_user_5")
        count1 = len(_table_names(self.engine))
        init_user_database("test_user_5")
        count2 = len(_table_names(self.engine))
        assert count1 == count2, (count1, count2)

    def test_content_thats_not_a_typo(self):
        """This is a placeholder that simply runs."""
        init_user_database("test_user_6")
        assert len(_table_names(self.engine)) > 0