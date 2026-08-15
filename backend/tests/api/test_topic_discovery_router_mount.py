"""
Tests for shared topic-discovery router mounting (YouTube Plan Phase 1).

Ensures /api/podcast/trends and /api/podcast/research/tavily-category are
available in youtube-only feature mode without mounting the full Podcast API.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


class TestShouldMountTopicDiscovery:
    def test_youtube_only_mounts(self):
        from api.shared.topic_discovery_router import should_mount_topic_discovery_for_youtube

        assert should_mount_topic_discovery_for_youtube({"youtube"}) is True

    def test_all_mode_skips(self):
        from api.shared.topic_discovery_router import should_mount_topic_discovery_for_youtube

        assert should_mount_topic_discovery_for_youtube({"all"}) is False

    def test_youtube_and_podcast_skips(self):
        from api.shared.topic_discovery_router import should_mount_topic_discovery_for_youtube

        assert should_mount_topic_discovery_for_youtube({"youtube", "podcast"}) is False

    def test_podcast_only_skips(self):
        from api.shared.topic_discovery_router import should_mount_topic_discovery_for_youtube

        assert should_mount_topic_discovery_for_youtube({"podcast"}) is False

    def test_linkedin_only_skips(self):
        from api.shared.topic_discovery_router import should_mount_topic_discovery_for_youtube

        assert should_mount_topic_discovery_for_youtube({"linkedin"}) is False


class TestTopicDiscoveryRouterPaths:
    def test_openapi_paths_registered(self):
        from api.shared.topic_discovery_router import mount_topic_discovery_routes

        app = FastAPI()
        mount_topic_discovery_routes(app)
        paths = app.openapi()["paths"]

        assert "/api/podcast/trends" in paths
        assert "/api/podcast/research/tavily-category" in paths
        assert "/api/podcast/extract-url" in paths
        assert "post" in paths["/api/podcast/trends"]
        assert "post" in paths["/api/podcast/research/tavily-category"]
        assert "post" in paths["/api/podcast/extract-url"]


class TestTopicDiscoveryTrendsEndpoint:
    def test_trends_returns_success_with_mocked_service(self):
        from api.shared.topic_discovery_router import mount_topic_discovery_routes
        from middleware.auth_middleware import get_current_user

        app = FastAPI()
        mount_topic_discovery_routes(app)
        app.dependency_overrides[get_current_user] = lambda: {"user_id": "user_test", "id": "user_test"}

        mock_service = MagicMock()
        mock_service.analyze_trends = AsyncMock(
            return_value={
                "interest_over_time": [{"date": "2026-01-01", "value": 50}],
                "interest_by_region": [],
                "related_topics": {"top": [], "rising": []},
                "related_queries": {"top": [], "rising": []},
            }
        )

        with patch(
            "api.podcast.handlers.trends.get_trends_service",
            return_value=mock_service,
        ):
            client = TestClient(app)
            response = client.post(
                "/api/podcast/trends",
                json={
                    "keywords": ["AI tutorials"],
                    "timeframe": "today 12-m",
                    "geo": "US",
                    "source": "podcast",
                },
            )

        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["data"]["interest_over_time"]

    def test_trends_requires_auth(self):
        from api.shared.topic_discovery_router import mount_topic_discovery_routes

        app = FastAPI()
        mount_topic_discovery_routes(app)

        client = TestClient(app)
        response = client.post(
            "/api/podcast/trends",
            json={"keywords": ["AI tutorials"]},
        )

        assert response.status_code in {401, 403, 422}
