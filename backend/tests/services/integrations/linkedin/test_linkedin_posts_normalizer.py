"""Tests for LinkedIn posts normalizer (pure, no mocks)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from services.integrations.linkedin.linkedin_posts_normalizer import (
    normalize_unipile_post,
    normalize_unipile_posts,
)

_REPO_ROOT = Path(__file__).resolve().parents[5]
_FIXTURE_PATH = _REPO_ROOT / "docs" / "linkedin" / "fixtures" / "sample_post_list_raw.json"


@pytest.fixture
def fixture_items() -> list[dict]:
    data = json.loads(_FIXTURE_PATH.read_text(encoding="utf-8"))
    return data["items"]


def test_normalize_short_post(fixture_items):
    post = normalize_unipile_post(fixture_items[0])
    assert post.content_kind == "post"
    assert post.social_id == "urn:li:activity:7000000000000000001"
    assert "product launch" in post.text
    assert post.reaction_counter == 42
    assert post.author_name == "Jane Doe"


def test_normalize_article_post(fixture_items):
    post = normalize_unipile_post(fixture_items[1])
    assert post.content_kind == "article"
    assert post.title == "How We Scaled APIs"
    assert post.article_subtitle == "Lessons from 8 years of backend engineering"
    assert post.impressions_counter == 5400


def test_normalize_repost(fixture_items):
    post = normalize_unipile_post(fixture_items[2])
    assert post.content_kind == "repost"
    assert post.is_repost is True


def test_normalize_list_skips_invalid_entries():
    items = [{"id": "a", "social_id": "s1", "text": "hello"}]
    normalized = normalize_unipile_posts(items + ["bad", None])
    assert len(normalized) == 1
    assert normalized[0].unipile_post_id == "a"
