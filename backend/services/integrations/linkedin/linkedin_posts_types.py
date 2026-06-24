"""
Typed shapes for LinkedIn posts/articles fetched via Unipile.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, Optional

PostContentKind = Literal["post", "article", "repost"]


@dataclass(frozen=True)
class NormalizedLinkedInPost:
    """Normalized LinkedIn post or article from Unipile."""

    unipile_post_id: str
    social_id: str
    content_kind: PostContentKind
    title: str
    text: str
    share_url: str
    parsed_datetime: str
    is_repost: bool
    reaction_counter: int
    comment_counter: int
    repost_counter: int
    impressions_counter: int
    author_name: str
    author_public_identifier: str
    article_subtitle: str = ""
    article_cover_url: str = ""
    raw: dict[str, Any] = field(default_factory=dict, compare=False)


@dataclass
class FetchPostsResult:
    """Result of a posts fetch operation."""

    user_id: str
    account_id: str
    identifier: str
    posts: list[NormalizedLinkedInPost]
    cursor: Optional[str] = None
    persisted_asset_ids: list[int] = field(default_factory=list)
    skipped_social_ids: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "user_id": self.user_id,
            "account_id": self.account_id,
            "identifier": self.identifier,
            "cursor": self.cursor,
            "count": len(self.posts),
            "persisted_asset_ids": self.persisted_asset_ids,
            "skipped_social_ids": self.skipped_social_ids,
            "posts": [
                {
                    "unipile_post_id": p.unipile_post_id,
                    "social_id": p.social_id,
                    "content_kind": p.content_kind,
                    "title": p.title,
                    "text": p.text,
                    "share_url": p.share_url,
                    "parsed_datetime": p.parsed_datetime,
                    "is_repost": p.is_repost,
                    "reaction_counter": p.reaction_counter,
                    "comment_counter": p.comment_counter,
                    "repost_counter": p.repost_counter,
                    "impressions_counter": p.impressions_counter,
                    "author_name": p.author_name,
                    "author_public_identifier": p.author_public_identifier,
                    "article_subtitle": p.article_subtitle,
                    "article_cover_url": p.article_cover_url,
                }
                for p in self.posts
            ],
        }
