"""Phase 3.5: per-user seed terms for fallback clustering.

The ``_fallback_clustering`` path in ``TxtaiIntelligenceService``
uses a hardcoded list of marketing-related seed queries to
bootstrap cluster discovery when the FAISS graph is not
available. That's a sensible default for the historical SIF
deployment, but it produces off-topic clusters for users in
non-marketing domains (e.g. a medical researcher indexing
clinical literature).

This module exposes ``resolve_seed_terms`` which:
  1. If the caller passed ``seed_terms``, takes the first 5 and
     pads with the historical defaults if shorter.
  2. If the caller passed ``None`` or an empty list, returns
     the historical defaults unchanged.

The pure-function shape keeps this small and easy to test in
isolation. The historical defaults are kept here (not in
``txtai_service.py``) so a future change to the defaults
doesn't require editing the service file.

Usage from ``txtai_service.py._fallback_clustering``::

    from .sif_seed_terms import resolve_seed_terms

    sample_queries = resolve_seed_terms(seed_terms)
"""
from __future__ import annotations

from typing import List, Optional


HISTORICAL_DEFAULT_SEEDS: List[str] = [
    "marketing",
    "SEO",
    "content",
    "social media",
    "email marketing",
]

_MAX_SEEDS = 5


def resolve_seed_terms(seed_terms: Optional[List[str]]) -> List[str]:
    """Return the final list of seed queries for fallback clustering.

    Args:
        seed_terms: caller-supplied list, or None for defaults.

    Returns:
        A list of up to ``_MAX_SEEDS`` (5) query strings. Caller-
        provided seeds take priority; the historical defaults fill
        any remaining slots without duplicating caller seeds.
    """
    if not seed_terms:
        return list(HISTORICAL_DEFAULT_SEEDS)
    seeds: List[str] = list(seed_terms)[:_MAX_SEEDS]
    for default in HISTORICAL_DEFAULT_SEEDS:
        if len(seeds) >= _MAX_SEEDS:
            break
        if default not in seeds:
            seeds.append(default)
    return seeds
