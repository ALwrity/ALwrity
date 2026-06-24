"""Tests for LinkedIn posts asset-library persistence."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from services.integrations.linkedin import linkedin_posts_storage as storage_module
from services.integrations.linkedin.linkedin_posts_normalizer import normalize_unipile_post
from services.integrations.linkedin.linkedin_posts_storage import (
    CONTENT_ORIGIN,
    find_asset_id_by_social_id,
    persist_fetched_post,
    persist_fetched_posts,
)


def _sample_post(**overrides):
    raw = {
        "id": "post_001",
        "social_id": "urn:li:activity:111",
        "text": "Hello LinkedIn world",
        "parsed_datetime": "2025-01-01T00:00:00Z",
        "reaction_counter": 1,
        "comment_counter": 0,
        "repost_counter": 0,
        "impressions_counter": 10,
        "is_repost": False,
        "author": {"name": "Jane", "public_identifier": "jane"},
        **overrides,
    }
    return normalize_unipile_post(raw)


def test_persist_post_uses_linkedin_writer_pattern():
    saved: list[dict] = []

    def fake_save(**kwargs):
        saved.append(kwargs)
        return 101

    post = _sample_post()
    asset_id = persist_fetched_post(
        db=MagicMock(),
        user_id="user-1",
        post=post,
        save_fn=fake_save,
    )

    assert asset_id == 101
    assert len(saved) == 1
    call = saved[0]
    assert call["source_module"] == "linkedin_writer"
    assert call["subdirectory"] == "posts"
    assert call["tags"] == ["linkedin", "post", "fetched"]
    assert call["asset_metadata"]["content_origin"] == CONTENT_ORIGIN
    assert call["asset_metadata"]["social_id"] == "urn:li:activity:111"
    assert call["title"].startswith("LinkedIn Post:")


def test_persist_article_uses_md_and_articles_subdirectory():
    saved: list[dict] = []

    def fake_save(**kwargs):
        saved.append(kwargs)
        return 202

    post = _sample_post(
        article={"title": "My Article", "subtitle": "Subtitle"},
        text="Intro paragraph",
    )
    asset_id = persist_fetched_post(
        db=MagicMock(),
        user_id="user-1",
        post=post,
        save_fn=fake_save,
    )

    assert asset_id == 202
    call = saved[0]
    assert call["subdirectory"] == "articles"
    assert call["file_extension"] == ".md"
    assert call["tags"] == ["linkedin", "article", "fetched"]
    assert call["content"].startswith("# My Article")


def test_find_asset_id_by_social_id_matches_content_origin(monkeypatch):
    asset = MagicMock()
    asset.id = 55
    asset.asset_metadata = {
        "content_origin": CONTENT_ORIGIN,
        "social_id": "urn:li:activity:dup",
    }

    service = MagicMock()
    service.get_user_assets.return_value = ([asset], 1)

    monkeypatch.setattr(storage_module, "ContentAssetService", lambda _db: service)
    found = find_asset_id_by_social_id(MagicMock(), "user-1", "urn:li:activity:dup")

    assert found == 55


def test_persist_fetched_posts_skips_duplicate_social_id(monkeypatch):
    calls = {"count": 0}

    def fake_save(**_kwargs):
        calls["count"] += 1
        return 1

    post = _sample_post()
    db = MagicMock()

    monkeypatch.setattr(storage_module, "find_asset_id_by_social_id", lambda *_a, **_k: 99)
    asset_ids, skipped = persist_fetched_posts(
        db, "user-1", [post], save_fn=fake_save
    )

    assert asset_ids == [99]
    assert skipped == ["urn:li:activity:111"]
    assert calls["count"] == 0
