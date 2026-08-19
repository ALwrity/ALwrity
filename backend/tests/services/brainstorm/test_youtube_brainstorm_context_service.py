"""Tests for YouTube brainstorm context helpers."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


class TestYouTubeBrainstormContextService:
    def test_format_trends_block_uses_rising_queries(self):
        from services.brainstorm.youtube_brainstorm_context_service import _format_trends_block

        block = _format_trends_block(
            {
                "related_queries": {
                    "rising": [{"query": "solo travel tips", "value": 120}],
                    "top": [],
                },
                "related_topics": {"rising": [], "top": []},
            }
        )
        assert "YOUTUBE TRENDING SIGNALS" in block
        assert "solo travel tips" in block

    @pytest.mark.asyncio
    async def test_fetch_youtube_trends_context_returns_empty_on_timeout(self):
        from services.brainstorm import youtube_brainstorm_context_service as svc

        with patch.object(svc, "_get_trends_service") as get_service, patch.object(
            svc.asyncio, "wait_for", side_effect=TimeoutError()
        ):
            get_service.return_value.analyze_trends = MagicMock()
            result = await svc.fetch_youtube_trends_context("budget travel", "user-1")
            assert result == ""

    def test_fetch_youtube_saved_ideas_context_filters_youtube_tags(self):
        from services.brainstorm.youtube_brainstorm_context_service import (
            fetch_youtube_saved_ideas_context,
        )

        row_youtube = MagicMock(prompt="YouTube idea", tags="youtube,plan")
        row_other = MagicMock(prompt="LinkedIn idea", tags="linkedin")

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [
            row_youtube,
            row_other,
        ]

        with patch(
            "services.brainstorm.youtube_brainstorm_context_service.get_session_for_user",
            return_value=mock_db,
        ):
            block = fetch_youtube_saved_ideas_context("user-1")

        assert "YouTube idea" in block
        assert "LinkedIn idea" not in block
        mock_db.close.assert_called_once()
