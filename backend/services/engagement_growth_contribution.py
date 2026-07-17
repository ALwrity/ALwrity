"""Engagement growth contribution helpers for post analytics trends."""

from __future__ import annotations

from models.linkedin_posts_models import PostDelta


def post_growth_score(
    reactions_delta: int,
    comments_delta: int,
    impressions_delta: int,
    followers_delta: int = 0,
) -> int:
    """Composite growth score (reactions + comments + impressions + followers)."""
    return reactions_delta + comments_delta + impressions_delta + followers_delta


def post_growth_score_from_delta(delta: PostDelta) -> int:
    """Return the composite growth score for a single post delta."""
    return post_growth_score(
        delta.reactions_delta,
        delta.comments_delta,
        delta.impressions_delta,
        getattr(delta, "followers_delta", 0) or 0,
    )


def compute_growth_contributions(deltas: list[PostDelta]) -> dict[str, float]:
    """Compute each post's share of total positive engagement growth.

    Uses the sum of positive composite scores across *all* posts in the
    comparison window as the denominator. Only posts with a strictly positive
    score receive an entry.
    """
    positive_scores: dict[str, int] = {}
    for delta in deltas:
        score = post_growth_score_from_delta(delta)
        if score > 0:
            positive_scores[delta.post_id] = score

    total_positive = sum(positive_scores.values())
    if total_positive <= 0:
        return {}

    return {
        post_id: round(100.0 * score / total_positive, 1)
        for post_id, score in positive_scores.items()
    }


def attach_growth_contributions(gainers: list[PostDelta], deltas: list[PostDelta]) -> list[PostDelta]:
    """Return rising posts with ``growth_contribution_pct`` set where applicable."""
    contributions = compute_growth_contributions(deltas)
    if not contributions:
        return gainers

    return [
        delta.model_copy(update={"growth_contribution_pct": contributions[delta.post_id]})
        if delta.post_id in contributions
        else delta
        for delta in gainers
    ]
