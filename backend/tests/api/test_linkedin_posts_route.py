"""Tests for GET /api/linkedin-social/posts route."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _load_linkedin_posts_routes():
    module_name = "_linkedin_posts_routes_under_test"
    if module_name in sys.modules:
        return sys.modules[module_name]
    routes_path = _BACKEND_ROOT / "api" / "linkedin_posts_routes.py"
    spec = importlib.util.spec_from_file_location(module_name, routes_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load route module from {routes_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


_routes = _load_linkedin_posts_routes()
get_linkedin_posts = _routes.get_linkedin_posts


def _mock_fetch_result() -> object:
    from services.integrations.linkedin.linkedin_posts_types import (
        FetchPostsResult,
        NormalizedLinkedInPost,
    )

    return FetchPostsResult(
        user_id="user-route-test",
        account_id="acc_route",
        identifier="ACoTEST",
        posts=[
            NormalizedLinkedInPost(
                unipile_post_id="post_1",
                social_id="urn:li:activity:1",
                content_kind="post",
                title="Hello",
                text="Hello world",
                share_url="https://linkedin.com/post/1",
                parsed_datetime="2025-01-01T00:00:00Z",
                is_repost=False,
                reaction_counter=1,
                comment_counter=0,
                repost_counter=0,
                impressions_counter=10,
                author_name="Jane",
                author_public_identifier="jane",
            )
        ],
        cursor=None,
    )


@pytest.mark.asyncio
async def test_get_linkedin_posts_returns_normalized_payload():
    current_user = {"id": "user-route-test"}
    mock_db = object()

    with patch.object(
        _routes,
        "fetch_user_posts",
        new=AsyncMock(return_value=_mock_fetch_result()),
    ):
        response = await get_linkedin_posts(
            limit=20,
            cursor=None,
            fetch_all=False,
            include_article_body=True,
            persist=False,
            identifier=None,
            current_user=current_user,
            db=mock_db,
        )

    assert response.user_id == "user-route-test"
    assert response.count == 1
    assert response.posts[0].title == "Hello"


@pytest.mark.asyncio
async def test_get_linkedin_posts_maps_not_connected_to_401():
    from services.integrations.linkedin.types import LinkedInNotConnectedError

    with patch.object(
        _routes,
        "fetch_user_posts",
        new=AsyncMock(side_effect=LinkedInNotConnectedError("not connected")),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await get_linkedin_posts(
                limit=20,
                cursor=None,
                fetch_all=False,
                include_article_body=True,
                persist=False,
                identifier=None,
                current_user={"id": "user-route-test"},
                db=object(),
            )

    assert exc_info.value.status_code == 401
