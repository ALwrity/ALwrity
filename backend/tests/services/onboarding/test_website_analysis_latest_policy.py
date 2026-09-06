"""Tests for latest-only website analysis lookup and check-existing payload."""

from __future__ import annotations

from datetime import datetime
from unittest.mock import MagicMock

import pytest

from api.onboarding_utils.website_analysis_latest_policy import (
    build_check_existing_payload,
    find_latest_completed_analysis,
    purge_superseded_analyses,
    resolve_last_analyzed_at,
)
from models.onboarding import WebsiteAnalysis


def _analysis(
    *,
    id: int,
    url: str,
    analysis_date: datetime | None = None,
    updated_at: datetime | None = None,
):
    row = MagicMock(spec=WebsiteAnalysis)
    row.id = id
    row.website_url = url
    row.status = "completed"
    row.analysis_date = analysis_date
    row.updated_at = updated_at
    row.writing_style = {"tone": "professional"}
    row.target_audience = {"level": "intermediate"}
    row.content_type = {"primary": "blog"}
    return row


class TestResolveLastAnalyzedAt:
    def test_prefers_updated_at_over_analysis_date(self):
        analysis = _analysis(
            id=1,
            url="https://example.com",
            analysis_date=datetime(2026, 8, 31, 10, 0, 0),
            updated_at=datetime(2026, 9, 6, 15, 30, 0),
        )
        assert resolve_last_analyzed_at(analysis) == datetime(2026, 9, 6, 15, 30, 0)

    def test_falls_back_to_analysis_date(self):
        analysis = _analysis(
            id=1,
            url="https://example.com",
            analysis_date=datetime(2026, 8, 31, 10, 0, 0),
            updated_at=None,
        )
        assert resolve_last_analyzed_at(analysis) == datetime(2026, 8, 31, 10, 0, 0)


class TestFindLatestCompletedAnalysis:
    def test_matches_normalized_url_variants_and_picks_most_recent(self):
        older = _analysis(
            id=10,
            url="http://www.example.com",
            updated_at=datetime(2026, 8, 31),
        )
        newer = _analysis(
            id=11,
            url="https://example.com/",
            updated_at=datetime(2026, 9, 6),
        )
        other_site = _analysis(
            id=12,
            url="https://other.com",
            updated_at=datetime(2026, 9, 7),
        )

        db = MagicMock()
        query = MagicMock()
        query.filter_by.return_value.order_by.return_value.all.return_value = [
            newer,
            older,
            other_site,
        ]
        db.query.return_value = query

        result = find_latest_completed_analysis(db, session_id=5, website_url="https://www.example.com/")

        assert result is newer

    def test_returns_none_when_no_match(self):
        db = MagicMock()
        query = MagicMock()
        query.filter_by.return_value.order_by.return_value.all.return_value = []
        db.query.return_value = query

        assert find_latest_completed_analysis(db, 1, "https://missing.com") is None


class TestBuildCheckExistingPayload:
    def test_includes_last_analyzed_at_from_updated_at(self):
        analysis = _analysis(
            id=42,
            url="https://alwrity.com",
            analysis_date=datetime(2026, 8, 31),
            updated_at=datetime(2026, 9, 6, 12, 0, 0),
        )
        payload = build_check_existing_payload(analysis)

        assert payload["exists"] is True
        assert payload["analysis_id"] == 42
        assert payload["last_analyzed_at"] == "2026-09-06T12:00:00"
        assert payload["analysis_date"] == "2026-08-31T00:00:00"


class TestPurgeSupersededAnalyses:
    def test_deletes_other_rows_for_same_normalized_site(self):
        keep = _analysis(id=1, url="https://www.example.com")
        duplicate = _analysis(id=2, url="http://example.com")
        other = _analysis(id=3, url="https://other.com")

        db = MagicMock()
        query = MagicMock()
        query.filter_by.return_value.all.return_value = [keep, duplicate, other]
        db.query.return_value = query

        deleted = purge_superseded_analyses(db, session_id=9, website_url="https://example.com", keep_id=1)

        assert deleted == 1
        db.delete.assert_called_once_with(duplicate)
        db.commit.assert_called_once()
