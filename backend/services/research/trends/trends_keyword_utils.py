"""Normalize long user ideas into short search-friendly keywords."""

from __future__ import annotations

import re
from typing import Iterable, List

# Generic words that do not help search queries.
_TRENDS_STOPWORDS = frozenset(
    {
        "a",
        "an",
        "the",
        "for",
        "and",
        "or",
        "to",
        "of",
        "in",
        "on",
        "at",
        "by",
        "with",
        "from",
        "your",
        "our",
        "their",
        "this",
        "that",
        "how",
        "what",
        "about",
        "guide",
        "video",
        "targeting",
        "young",
        "professionals",
        "beginners",
        "complete",
        "ultimate",
    }
)


def normalize_trends_keywords(raw_keywords: Iterable[str], max_keywords: int = 5) -> List[str]:
    """
    Convert long ideas into 1-5 short search terms.

    Search APIs work best with 1-4 word phrases, not full video titles.
    """
    result: List[str] = []
    seen: set[str] = set()

    def add(phrase: str) -> None:
        cleaned = " ".join(phrase.split()).strip()[:50]
        key = cleaned.lower()
        if cleaned and key not in seen and len(result) < max_keywords:
            seen.add(key)
            result.append(cleaned)

    for raw in raw_keywords:
        text = (raw or "").strip()
        if not text:
            continue

        word_count = len(text.split())
        if len(text) <= 45 and word_count <= 4:
            add(text)
            continue

        tokens = [
            token
            for token in re.findall(r"[A-Za-z0-9]+", text)
            if len(token) > 2 and token.lower() not in _TRENDS_STOPWORDS
        ]
        if not tokens:
            add(text[:45])
            continue

        add(" ".join(tokens[:3]))
        for token in sorted(tokens, key=len, reverse=True):
            add(token)
            if len(result) >= max_keywords:
                break

    if not result:
        first = next((k.strip() for k in raw_keywords if k and k.strip()), "")
        if first:
            add(first[:45])

    return result[:max_keywords]
