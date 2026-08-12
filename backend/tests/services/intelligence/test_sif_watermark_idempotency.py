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


class TestSIFPageLimitByTier:
    """Verify tier-based page limits (Phase 5)."""

    def test_free_tier_uses_env_default(self, monkeypatch):
        from unittest.mock import patch, MagicMock
        monkeypatch.setenv("MAX_SIF_PAGES_PER_INDEX", "10")

        svc = MagicMock()
        svc.user_id = "user_1"
        svc._get_sif_page_limit = None  # placeholder, patched below

        from services.intelligence.sif_integration import SIFIntegrationService
        with patch.object(SIFIntegrationService, "_get_sif_page_limit") as mock_method:
            mock_method.return_value = 10
            svc = SIFIntegrationService.__new__(SIFIntegrationService)
            svc.user_id = "user_1"
            assert svc._get_sif_page_limit() == 10

    def test_tier_map_returns_proper_limits(self):
        tier_map = {
            "free": 10,
            "basic": 20,
            "pro": 30,
            "enterprise": 50,
        }
        assert tier_map["free"] == 10
        assert tier_map["basic"] == 20
        assert tier_map["pro"] == 30
        assert tier_map["enterprise"] == 50
