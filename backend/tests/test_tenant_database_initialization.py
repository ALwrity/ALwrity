import pytest
from sqlalchemy import Table, create_engine, inspect, text
from sqlalchemy.exc import SQLAlchemyError

from models.content_planning import Base as ContentPlanningBase
from models.enhanced_calendar_models import Base as EnhancedCalendarBase
import services.database as database


def test_tenant_initialization_creates_calendar_tables_and_preserves_existing_data(
    monkeypatch,
):
    engine = create_engine("sqlite:///:memory:")
    try:
        ContentPlanningBase.metadata.create_all(bind=engine)
        planning_tables_before = set(ContentPlanningBase.metadata.tables)
        calendar_tables_before = set(EnhancedCalendarBase.metadata.tables)
        inspector = inspect(engine)
        planning_schema_before = {
            table_name: [
                (
                    column["name"],
                    str(column["type"]),
                    column["nullable"],
                    column["primary_key"],
                )
                for column in inspector.get_columns(table_name)
            ]
            for table_name in ContentPlanningBase.metadata.tables
        }

        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO content_strategies (user_id, name) "
                    "VALUES (:user_id, :name)"
                ),
                {"user_id": 1, "name": "preserve-existing-row"},
            )

        monkeypatch.setattr(database, "get_engine_for_user", lambda user_id: engine)
        database.init_user_database("in-memory-user")

        inspector = inspect(engine)
        table_names = set(inspector.get_table_names())
        assert set(ContentPlanningBase.metadata.tables).issubset(table_names)
        assert set(EnhancedCalendarBase.metadata.tables).issubset(table_names)
        assert planning_schema_before == {
            table_name: [
                (
                    column["name"],
                    str(column["type"]),
                    column["nullable"],
                    column["primary_key"],
                )
                for column in inspector.get_columns(table_name)
            ]
            for table_name in ContentPlanningBase.metadata.tables
        }
        assert set(ContentPlanningBase.metadata.tables) == planning_tables_before
        assert set(EnhancedCalendarBase.metadata.tables) == calendar_tables_before

        calendar_foreign_keys = {
            (
                table_name,
                tuple(foreign_key["constrained_columns"]),
                foreign_key["referred_table"],
            )
            for table_name in EnhancedCalendarBase.metadata.tables
            for foreign_key in inspector.get_foreign_keys(table_name)
        }
        assert {
            ("ai_calendar_recommendations", ("strategy_id",), "content_strategies"),
            ("content_performance_tracking", ("event_id",), "calendar_events"),
            ("content_performance_tracking", ("strategy_id",), "content_strategies"),
            ("content_trend_analysis", ("strategy_id",), "content_strategies"),
            ("content_optimizations", ("event_id",), "calendar_events"),
            ("calendar_generation_sessions", ("strategy_id",), "content_strategies"),
        }.issubset(calendar_foreign_keys)
        with engine.connect() as connection:
            preserved_name = connection.execute(
                text("SELECT name FROM content_strategies WHERE user_id = 1")
            ).scalar_one()
        assert preserved_name == "preserve-existing-row"
    finally:
        engine.dispose()


def test_tenant_initialization_propagates_calendar_table_creation_errors(
    monkeypatch,
):
    engine = create_engine("sqlite:///:memory:")
    original_create = Table.create

    def fail_calendar_table(self, bind=None, checkfirst=False, **kwargs):
        if self.name == "ai_calendar_recommendations":
            raise SQLAlchemyError("simulated calendar table creation failure")
        return original_create(
            self,
            bind=bind,
            checkfirst=checkfirst,
            **kwargs,
        )

    monkeypatch.setattr(database, "get_engine_for_user", lambda user_id: engine)
    monkeypatch.setattr(Table, "create", fail_calendar_table)
    try:
        with pytest.raises(SQLAlchemyError, match="simulated calendar table"):
            database.init_user_database("in-memory-user")
    finally:
        engine.dispose()


def test_engine_creation_propagates_initialization_errors_and_discards_engine(
    monkeypatch,
    tmp_path,
):
    engine = create_engine("sqlite:///:memory:")
    original_dispose = engine.dispose
    disposed = []

    def fail_initialization(user_id):
        raise SQLAlchemyError("simulated tenant initialization failure")

    def record_dispose():
        disposed.append(True)
        original_dispose()

    monkeypatch.setattr(database, "_user_engines", {})
    monkeypatch.setattr(
        database,
        "get_user_db_path",
        lambda user_id: str(tmp_path / "test.db"),
    )
    monkeypatch.setattr(database, "create_engine", lambda *args, **kwargs: engine)
    monkeypatch.setattr(database, "init_user_database", fail_initialization)
    monkeypatch.setattr(engine, "dispose", record_dispose)

    with pytest.raises(SQLAlchemyError, match="simulated tenant initialization"):
        database.get_engine_for_user("in-memory-user")

    assert "in-memory-user" not in database._user_engines
    assert disposed == [True]
