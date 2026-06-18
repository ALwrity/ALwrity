"""
SIF Error Taxonomy
==================

Single source of truth for the exception hierarchy used by the Semantic
Intelligence Framework (SIF). Every public SIF method must raise one of
these (or a domain exception like `ValueError`/`FileNotFoundError` for
truly invalid input) instead of returning an empty result silently.

Why this exists
---------------
Phase 1 audit found that ~90% of SIF public methods catch bare
`Exception` and return `[]`/`{}`/`0`/`False`. Operators cannot tell a
working system from a broken one. The fix is to (a) define what
failure looks like at the type level, and (b) convert those silent
returns into explicit raises in Phase 1.2.

Caller contract
---------------
- `SIFError` subclasses are *operational* errors. Callers are expected
  to catch them explicitly and decide whether to retry, surface to the
  user, or log and continue.
- These exceptions are NOT safe to ignore. If you do not know what
  to do with a `SIFError`, propagate it.
- All subclasses carry a `user_id` (where applicable), the `operation`
  that triggered them, and the underlying `cause` (the original
  exception, if any).

This module has zero side effects on import. It is safe to import
from anywhere in the SIF surface (txtai_service, sif_integration,
semantic_cache, harvester, agent_flat_context, agent_context_vfs,
and the agents/specialized/* classes).
"""

from __future__ import annotations

from typing import Optional


__all__ = [
    "SIFError",
    "SIFNotInitialized",
    "SIFIndexMissing",
    "SIFIndexCorrupted",
    "SIFSearchUnavailable",
    "SIFEmbeddingFailed",
    "SIFCacheError",
    "SIFContextMissing",
    "SIFAgentUnavailable",
]


class SIFError(Exception):
    """
    Base class for all Semantic Intelligence Framework errors.

    Subclasses identify the specific failure mode so callers can
    handle different cases differently. The base class should not be
    raised directly — use the most specific subclass available.

    Attributes
    ----------
    user_id : Optional[str]
        The user this error pertains to. May be `None` for errors
        that arise before a user context is known (e.g., during
        harvester preflight).
    operation : Optional[str]
        The name of the method or pipeline stage that produced the
        error (e.g., "search", "cluster", "sync_onboarding_data_to_sif").
    cause : Optional[BaseException]
        The underlying exception that triggered this SIFError, if
        any. Stored under `__cause__` automatically when raised via
        `raise SIFError(...) from e`.
    """

    def __init__(
        self,
        message: str = "",
        *,
        user_id: Optional[str] = None,
        operation: Optional[str] = None,
        cause: Optional[BaseException] = None,
    ) -> None:
        self.user_id = user_id
        self.operation = operation
        if cause is not None:
            self.__cause__ = cause
        super().__init__(message)

    def __str__(self) -> str:
        parts = [super().__str__()]
        if self.operation:
            parts.append(f"operation={self.operation!r}")
        if self.user_id is not None:
            parts.append(f"user_id={self.user_id!r}")
        if self.__cause__ is not None:
            parts.append(f"caused by {type(self.__cause__).__name__}: {self.__cause__}")
        return " | ".join(p for p in parts if p)


class SIFNotInitialized(SIFError):
    """
    Raised when a read operation runs against a TxtaiIntelligenceService
    whose `_initialized` flag is still False.

    Typical cause: the service was constructed in the same request that
    is trying to use it, and the background-thread init has not
    completed yet.

    Caller action: retry once after a short delay, or call
    `is_initialized()` to check before issuing the read.
    """


class SIFIndexMissing(SIFError):
    """
    Raised when an operation requires a populated FAISS index but
    the on-disk index does not exist or is empty.

    Typical cause: a fresh user for whom no onboarding data has
    been indexed yet, or a user whose index directory was deleted.

    Caller action: call `index_content()` with bootstrap data, or
    treat the user as having no semantic context.
    """


class SIFIndexCorrupted(SIFError):
    """
    Raised when the on-disk index exists but is in a state that
    FAISS / txtai cannot read. Today the only known trigger is the
    `IndexIDMap` nprobe incompatibility on Windows when the
    underlying index has been written by an older or differently
    configured backend.

    Caller action: surface to the operator. Phase 3.1 will add
    auto-remediation (delete + rebuild). For now, the user can be
    served by treating them as having an empty index.
    """


class SIFSearchUnavailable(SIFError):
    """
    Raised when the txtai or FAISS backend cannot be imported or
    fails to construct. Distinct from `SIFNotInitialized` (which
    means the service exists but has not loaded) and `SIFIndexCorrupted`
    (which means the index itself is broken).

    Typical cause: missing optional dependency (`pip install txtai[faiss]`)
    or a version mismatch in the underlying libraries.

    Caller action: surface to the operator; this is a deployment
    issue, not a user data issue.
    """


class SIFEmbeddingFailed(SIFError):
    """
    Raised when the embedding model itself fails — typically the
    `transform()` call or `Labels()` classification pipeline raises
    a transformer / tokenization / OOM error.

    Caller action: retry with a smaller batch. If persistent, mark
    the task as `needs_intervention` and surface to the operator.
    """


class SIFCacheError(SIFError):
    """
    Raised when the SemanticCacheManager itself fails — distinct from
    a cache miss (which is a normal return value, not an error).

    Typical cause: serialization error, disk write failure on the
    persistent cache layer, or OrderedDict corruption.

    Caller action: log and treat as a cache miss. The underlying
    operation should still proceed against the authoritative
    source (txtai, DB, etc.).
    """


class SIFContextMissing(SIFError):
    """
    Raised by SIFIntegrationService `get_step*_context` when all
    three fallback tiers (flat file → DB → SIF index) return no
    data for a user.

    Caller action: log a warning and pass an empty context to the
    downstream agent. The agent should still produce a result, even
    if it is a low-quality one. (This is the only SIFError that is
    a *legitimate* runtime condition rather than a system fault.)
    """


class SIFAgentUnavailable(SIFError):
    """
    Raised when a lazy-loaded agent class cannot be imported or
    constructed. Distinct from `SIFSearchUnavailable` (which is
    about the embeddings backend) and `SIFEmbeddingFailed` (which
    is about a specific call).

    Typical cause: a recent refactor moved the agent class and an
    old import path was not updated (this was the root cause of the
    ProductionError "cannot import name ContentGuardianAgent from
    services.intelligence.sif_agents" that motivated this taxonomy).

    Caller action: surface to the operator. This is a code defect,
    not a user data issue, and Phase 1.2 will turn the silent
    fallback into a loud raise so it cannot be missed.
    """
