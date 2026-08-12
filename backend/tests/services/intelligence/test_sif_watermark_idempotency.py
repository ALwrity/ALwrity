"""Tests for SIF watermark-based idempotent indexing (Phase 4)."""

from __future__ import annotations

from unittest.mock import MagicMock


class TestSIFIndexingWatermark:
    """Verify SIFIndexingWatermark is_fresh and upsert behavior."""

    def test_is_fresh_returns_true_when_hash_matches(self):
        from models.sif_indexing_watermark import SIFIndexingWatermark

        session = MagicMock()
        row = MagicMock()
        row.source_hash = "abc123"
        session.query.return_value.filter.return_value.one_or_none.return_value = row

        result = SIFIndexingWatermark.is_fresh(session, "user_1", "user_content:https://x.com", "abc123")
        assert result is True

    def test_is_fresh_returns_false_when_hash_differs(self):
        from models.sif_indexing_watermark import SIFIndexingWatermark

        session = MagicMock()
        row = MagicMock()
        row.source_hash = "old_hash"
        session.query.return_value.filter.return_value.one_or_none.return_value = row

        result = SIFIndexingWatermark.is_fresh(session, "user_1", "user_content:https://x.com", "new_hash")
        assert result is False

    def test_is_fresh_returns_false_when_no_row(self):
        from models.sif_indexing_watermark import SIFIndexingWatermark

        session = MagicMock()
        session.query.return_value.filter.return_value.one_or_none.return_value = None

        result = SIFIndexingWatermark.is_fresh(session, "user_1", "src", "hash")
        assert result is False

    def test_is_fresh_returns_false_for_empty_hash(self):
        from models.sif_indexing_watermark import SIFIndexingWatermark

        session = MagicMock()
        result = SIFIndexingWatermark.is_fresh(session, "user_1", "src", "")
        assert result is False

    def test_upsert_creates_new_row(self):
        from models.sif_indexing_watermark import SIFIndexingWatermark

        session = MagicMock()
        session.query.return_value.filter.return_value.one_or_none.return_value = None

        row = SIFIndexingWatermark.upsert(session, "user_1", "src", "hash", 1, "notes")
        assert row is not None
        session.add.assert_called_once()

    def test_upsert_updates_existing_row(self):
        from models.sif_indexing_watermark import SIFIndexingWatermark

        session = MagicMock()
        existing = MagicMock()
        existing.source_hash = "old"
        session.query.return_value.filter.return_value.one_or_none.return_value = existing

        row = SIFIndexingWatermark.upsert(session, "user_1", "src", "new", 2)
        assert row is existing
        assert existing.source_hash == "new"
        assert existing.embedding_count == 2


class TestContentHashIdempotency:
    """Verify content hashing produces stable IDs for watermark checks."""

    def test_same_content_produces_same_hash(self):
        import hashlib
        content_a = "The quick brown fox jumps over the lazy dog."
        content_b = "The quick brown fox jumps over the lazy dog."
        hash_a = hashlib.sha256(content_a.encode("utf-8")).hexdigest()
        hash_b = hashlib.sha256(content_b.encode("utf-8")).hexdigest()
        assert hash_a == hash_b

    def test_different_content_produces_different_hash(self):
        import hashlib
        hash_a = hashlib.sha256(b"content one").hexdigest()
        hash_b = hashlib.sha256(b"content two").hexdigest()
        assert hash_a != hash_b
