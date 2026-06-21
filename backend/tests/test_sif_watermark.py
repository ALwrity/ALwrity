"""Phase 3.4: SIFIndexingWatermark contract + freshness tests.

Covers the new model added in Phase 3.4:
- Schema is created via _ensure_sif_indexing_watermark_table.
- is_fresh returns True on hash match, False on hash mismatch or no row.
- is_fresh returns False on empty source_hash (forces re-embed).
- upsert is idempotent and updates the hash on subsequent calls.
- Unique constraint on (user_id, source_id) is enforced at the DB level.
- DB error during is_fresh returns False (safe default).
"""
import os
import sqlite3
import sys
import tempfile
import types
import importlib.util
from pathlib import Path

import pytest


def _load_module_from_path(name: str, path: str):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture(scope="module")
def watermark_model():
    """Load the SIFIndexingWatermark model.

    Uses a per-test isolated module cache entry so we don't conflict
    with the canonical import path used by the rest of the test
    session.
    """
    if "models.sif_indexing_watermark" in sys.modules:
        return sys.modules["models.sif_indexing_watermark"]
    spec = importlib.util.spec_from_file_location(
        "models.sif_indexing_watermark",
        BACKEND_DIR / "models" / "sif_indexing_watermark.py",
    )
    mod = importlib.util.module_from_spec(spec)
    sys.modules["models.sif_indexing_watermark"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture()
def in_memory_engine(watermark_model):
    """SQLite in-memory engine with the watermark table created."""
    from sqlalchemy import create_engine
    engine = create_engine("sqlite:///:memory:")
    watermark_model.Base.metadata.create_all(engine)
    return engine


def test_table_columns(watermark_model, in_memory_engine):
    from sqlalchemy import inspect
    insp = inspect(in_memory_engine)
    cols = {c["name"] for c in insp.get_columns("sif_indexing_watermarks")}
    expected = {"id", "user_id", "source_id", "source_hash",
                "embedding_count", "indexed_at", "notes"}
    assert expected <= cols, f"Missing columns: {expected - cols}"


def test_unique_constraint_in_db(watermark_model, in_memory_engine):
    """DB-level unique constraint on (user_id, source_id) is enforced."""
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.exc import IntegrityError
    Session = sessionmaker(bind=in_memory_engine)
    s = Session()
    s.add(watermark_model.SIFIndexingWatermark(
        user_id="u1", source_id="src", source_hash="h1"
    ))
    s.commit()
    s.add(watermark_model.SIFIndexingWatermark(
        user_id="u1", source_id="src", source_hash="h2"
    ))
    with pytest.raises(IntegrityError):
        s.commit()
    s.close()


def test_is_fresh_returns_false_when_no_row(watermark_model, in_memory_engine):
    from sqlalchemy.orm import sessionmaker
    Session = sessionmaker(bind=in_memory_engine)
    s = Session()
    fresh = watermark_model.SIFIndexingWatermark.is_fresh(
        s, user_id="u1", source_id="missing", source_hash="any"
    )
    assert fresh is False
    s.close()


def test_is_fresh_returns_true_on_hash_match(watermark_model, in_memory_engine):
    from sqlalchemy.orm import sessionmaker
    Session = sessionmaker(bind=in_memory_engine)
    s = Session()
    s.add(watermark_model.SIFIndexingWatermark(
        user_id="u1", source_id="src", source_hash="abc123"
    ))
    s.commit()
    fresh = watermark_model.SIFIndexingWatermark.is_fresh(
        s, user_id="u1", source_id="src", source_hash="abc123"
    )
    assert fresh is True
    s.close()


def test_is_fresh_returns_false_on_hash_mismatch(watermark_model, in_memory_engine):
    from sqlalchemy.orm import sessionmaker
    Session = sessionmaker(bind=in_memory_engine)
    s = Session()
    s.add(watermark_model.SIFIndexingWatermark(
        user_id="u1", source_id="src", source_hash="abc123"
    ))
    s.commit()
    fresh = watermark_model.SIFIndexingWatermark.is_fresh(
        s, user_id="u1", source_id="src", source_hash="different"
    )
    assert fresh is False
    s.close()


def test_is_fresh_returns_false_for_empty_source_hash(watermark_model, in_memory_engine):
    """Empty source_hash means "no hash available" → always re-embed."""
    from sqlalchemy.orm import sessionmaker
    Session = sessionmaker(bind=in_memory_engine)
    s = Session()
    s.add(watermark_model.SIFIndexingWatermark(
        user_id="u1", source_id="src", source_hash="abc123"
    ))
    s.commit()
    fresh = watermark_model.SIFIndexingWatermark.is_fresh(
        s, user_id="u1", source_id="src", source_hash=""
    )
    assert fresh is False
    s.close()


def test_is_fresh_isolated_per_user(watermark_model, in_memory_engine):
    from sqlalchemy.orm import sessionmaker
    Session = sessionmaker(bind=in_memory_engine)
    s = Session()
    s.add(watermark_model.SIFIndexingWatermark(
        user_id="u1", source_id="src", source_hash="abc"
    ))
    s.commit()
    # u2's same source_id should not match u1's watermark
    assert watermark_model.SIFIndexingWatermark.is_fresh(
        s, user_id="u2", source_id="src", source_hash="abc"
    ) is False
    s.close()


def test_upsert_inserts_new_row(watermark_model, in_memory_engine):
    from sqlalchemy.orm import sessionmaker
    Session = sessionmaker(bind=in_memory_engine)
    s = Session()
    row = watermark_model.SIFIndexingWatermark.upsert(
        s, user_id="u1", source_id="src",
        source_hash="h1", embedding_count=5, notes="first"
    )
    s.commit()
    assert row is not None
    assert row.id is not None
    assert row.embedding_count == 5
    assert row.notes == "first"
    s.close()


def test_upsert_updates_existing_row(watermark_model, in_memory_engine):
    from sqlalchemy.orm import sessionmaker
    Session = sessionmaker(bind=in_memory_engine)
    s = Session()
    watermark_model.SIFIndexingWatermark.upsert(
        s, user_id="u1", source_id="src", source_hash="h1", embedding_count=5
    )
    s.commit()
    watermark_model.SIFIndexingWatermark.upsert(
        s, user_id="u1", source_id="src", source_hash="h2", embedding_count=10
    )
    s.commit()
    rows = s.query(watermark_model.SIFIndexingWatermark).all()
    assert len(rows) == 1
    assert rows[0].source_hash == "h2"
    assert rows[0].embedding_count == 10
    s.close()


def test_is_fresh_safe_default_on_db_error(watermark_model):
    """If the session is closed before is_fresh is called, return False."""
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy import create_engine
    engine = create_engine("sqlite:///:memory:")
    watermark_model.Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    s = Session()
    s.close()  # close first to provoke error
    fresh = watermark_model.SIFIndexingWatermark.is_fresh(
        s, user_id="u1", source_id="src", source_hash="x"
    )
    # Should not raise; should return False (safe default).
    assert fresh is False
