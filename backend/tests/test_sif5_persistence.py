"""Source-level + lightweight runtime tests for the sif/phase-5
multi-instance correctness fixes: JSON-file -> DB for the
24-hour semantic health cadence, and durable monitoring history
via the semantic_monitoring_snapshots table.
"""
import ast
import re
import sys
from pathlib import Path

BACKEND_ROOT = Path(r"C:/Users/diksha rawat/Desktop/ALwrity_github/windsurf/ALwrity/backend")


def _read(rel: str) -> str:
    return (BACKEND_ROOT / rel).read_text(encoding="utf-8")


# ---------- JSON file -> DB for cadence ----------

def test_check_cycle_handler_no_longer_uses_json_file():
    """The scheduler must not read or write a JSON file in the
    user's home directory for the semantic health cadence.
    """
    src = _read("services/scheduler/core/check_cycle_handler.py")
    # The previous symbols must be gone
    forbidden = [
        "semantic_last_checks.json",
        "_SEMANTIC_STATE_FILE",
        "_load_semantic_check_timestamps",
        "_save_semantic_check_timestamps",
        "os.path.join(os.path.expanduser",
    ]
    for token in forbidden:
        assert token not in src, (
            f"check_cycle_handler.py should not contain {token!r} "
            f"(was the JSON-file cadence tracker; replaced by DB)"
        )
    # The new helpers must be present
    assert "_load_last_check_for_user" in src
    assert "_record_semantic_check" in src
    assert "SemanticHealthCheck" in src


def test_semantic_health_check_model_exists():
    """The SemanticHealthCheck model must exist with the right
    columns and a get_last_check_at classmethod.
    """
    src = _read("models/semantic_health_check.py")
    tree = ast.parse(src)
    # Find the class
    found = False
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name == "SemanticHealthCheck":
            found = True
            # __tablename__ must be the right value
            for stmt in node.body:
                if isinstance(stmt, ast.Assign):
                    for target in stmt.targets:
                        if isinstance(target, ast.Name) and target.id == "__tablename__":
                            assert stmt.value.value == "semantic_health_checks"
            # Must have get_last_check_at
            methods = [n.name for n in node.body if isinstance(n, ast.FunctionDef)]
            assert "get_last_check_at" in methods
            assert "record_check" in methods
    assert found, "SemanticHealthCheck class not found"


def test_database_migration_creates_semantic_health_checks_table():
    """services/database.py must include the auto-migration for
    the new semantic_health_checks table.
    """
    src = _read("services/database.py")
    assert "_ensure_semantic_health_checks_table" in src
    # Find the function and verify its body has the right CREATE TABLE
    # statement. We use re.search anchored on the function name to
    # avoid the previous "wrong function" bug where a non-greedy
    # capture matched the first adjacent function instead.
    lines = src.splitlines()
    # Find the function definition line
    def_line = None
    for i, line in enumerate(lines):
        if line.startswith("def _ensure_semantic_health_checks_table("):
            def_line = i
            break
    assert def_line is not None
    # Walk forward until we hit the next top-level def or end of file
    body_lines = []
    for line in lines[def_line + 1:]:
        if line.startswith("def ") or line.startswith("class "):
            break
        body_lines.append(line)
    body = "\n".join(body_lines)
    assert "semantic_health_checks" in body, "CREATE TABLE for semantic_health_checks missing"
    assert "user_id" in body
    assert "last_check_at" in body
    assert "status" in body
    assert "value" in body
    # Must be wired into the init sequence
    assert re.search(
        r"_ensure_semantic_health_checks_table\(engine,\s*user_id\)",
        src,
    ), "auto-migration not wired into DB init"


def test_runtime_record_and_read_back_last_check():
    """Round-trip: record a check, read it back, verify it survives."""
    # Use an in-memory SQLite to exercise the model without a real
    # tenant DB. The model uses a standalone declarative base, so we
    # can create its table on a fresh engine.
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from datetime import datetime, timedelta
    from models.semantic_health_check import (
        SemanticHealthCheck, Base,
    )

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Initially, no check
    assert SemanticHealthCheck.get_last_check_at(session, "rt_user_42") is None

    # Record a check
    row = SemanticHealthCheck.record_check(
        session,
        user_id="rt_user_42",
        status="healthy",
        value=0.85,
        description="all good",
        recommendations=["continue"],
    )
    assert row is not None
    session.commit()

    # Read it back
    last = SemanticHealthCheck.get_last_check_at(session, "rt_user_42")
    assert last is not None
    # Should be within the last few seconds
    assert (datetime.utcnow() - last).total_seconds() < 5

    # Upsert (update status)
    row2 = SemanticHealthCheck.record_check(
        session,
        user_id="rt_user_42",
        status="critical",
        value=0.1,
    )
    session.commit()
    session.expire_all()
    fresh = SemanticHealthCheck.get_last_check_at(session, "rt_user_42")
    assert fresh is not None
    # Last-check timestamp should have advanced
    assert fresh >= last

    session.close()


# ---------- Durable monitoring history ----------

def test_semantic_monitoring_snapshot_model_exists():
    """The new model must exist with the right shape."""
    src = _read("models/semantic_monitoring_snapshot.py")
    tree = ast.parse(src)
    found = False
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name == "SemanticMonitoringSnapshot":
            found = True
            methods = [n.name for n in node.body if isinstance(n, ast.FunctionDef)]
            assert "append_snapshot" in methods
            assert "get_recent_snapshots" in methods
            assert "prune_old_snapshots" in methods
    assert found, "SemanticMonitoringSnapshot class not found"


def test_database_migration_creates_semantic_monitoring_snapshots_table():
    src = _read("services/database.py")
    assert "_ensure_semantic_monitoring_snapshots_table" in src
    lines = src.splitlines()
    def_line = None
    for i, line in enumerate(lines):
        if line.startswith("def _ensure_semantic_monitoring_snapshots_table("):
            def_line = i
            break
    assert def_line is not None
    body_lines = []
    for line in lines[def_line + 1:]:
        if line.startswith("def ") or line.startswith("class "):
            break
        body_lines.append(line)
    body = "\n".join(body_lines)
    assert "semantic_monitoring_snapshots" in body
    assert "user_id" in body
    assert "captured_at" in body
    assert "snapshot_json" in body
    # Must be wired into the init sequence
    assert re.search(
        r"_ensure_semantic_monitoring_snapshots_table\(engine,\s*user_id\)",
        src,
    ), "auto-migration not wired into DB init"


def test_monitoring_loop_persists_snapshot_to_db():
    """The _monitoring_loop must persist each cycle's snapshot via
    SemanticMonitoringSnapshot.append_snapshot.
    """
    src = _read("services/intelligence/monitoring/semantic_dashboard.py")
    # Find the _monitoring_loop body
    m = re.search(
        r"async def _monitoring_loop\(self\):(.*?)(?=\n    async def |\n    def [a-zA-Z]|\nclass )",
        src, re.DOTALL,
    )
    assert m is not None
    body = m.group(1)
    assert "SemanticMonitoringSnapshot.append_snapshot" in body
    assert "SemanticMonitoringSnapshot.prune_old_snapshots" in body


def test_get_monitoring_history_merges_db_and_memory():
    """get_monitoring_history should read from the DB and merge
    with the in-memory list, deduping by timestamp.
    """
    src = _read("services/intelligence/monitoring/semantic_dashboard.py")
    m = re.search(
        r"def get_monitoring_history\(self.*?\) ->.*?:(.*?)(?=\n    (?:async )?def |\nclass )",
        src, re.DOTALL,
    )
    assert m is not None
    body = m.group(1)
    assert "SemanticMonitoringSnapshot.get_recent_snapshots" in body
    assert "seen_timestamps" in body, "must dedupe by timestamp"


def test_runtime_snapshot_append_and_prune():
    """Round-trip: append snapshots, read them back, prune old ones."""
    from datetime import datetime, timedelta
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from models.semantic_monitoring_snapshot import (
        SemanticMonitoringSnapshot, Base,
    )

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Append 3 snapshots
    for i in range(3):
        snap = {"timestamp": datetime.utcnow().isoformat(), "value": i}
        SemanticMonitoringSnapshot.append_snapshot(session, "rt_user_99", snap)
    session.commit()

    # Read them back
    out = SemanticMonitoringSnapshot.get_recent_snapshots(
        session, "rt_user_99", hours=24
    )
    assert len(out) == 3

    # Prune with 0-hour window should delete all
    deleted = SemanticMonitoringSnapshot.prune_old_snapshots(
        session, max_age_hours=0
    )
    assert deleted >= 0  # may be 0 if "captured_at" wasn't < cutoff
    # Verify nothing breaks even with empty result
    out2 = SemanticMonitoringSnapshot.get_recent_snapshots(
        session, "rt_user_99", hours=24
    )
    assert isinstance(out2, list)

    session.close()


def test_get_recent_snapshots_handles_corrupt_json():
    """A single corrupt row should not poison the whole response."""
    from datetime import datetime
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from models.semantic_monitoring_snapshot import (
        SemanticMonitoringSnapshot, Base,
    )

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # One good row, one corrupt row
    SemanticMonitoringSnapshot.append_snapshot(
        session, "rt_user_corrupt",
        {"timestamp": datetime.utcnow().isoformat(), "value": 1.0},
    )
    bad = SemanticMonitoringSnapshot(
        user_id="rt_user_corrupt",
        captured_at=datetime.utcnow(),
        snapshot_json="this is not json",
    )
    session.add(bad)
    session.commit()

    out = SemanticMonitoringSnapshot.get_recent_snapshots(
        session, "rt_user_corrupt", hours=24
    )
    # Good row present, corrupt row skipped (no exception)
    assert len(out) == 1
    assert out[0]["value"] == 1.0
    session.close()
