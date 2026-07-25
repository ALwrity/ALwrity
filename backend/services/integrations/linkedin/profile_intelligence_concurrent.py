"""Concurrent loader for Phase 6 + Phase 7 in profile intelligence pipeline.

Usage from linkedin_profile_acquire_routes.py:

    from services.integrations.linkedin.profile_intelligence_concurrent import (
        load_recommendations_and_optimization_concurrently,
    )

    recs, opt = await load_recommendations_and_optimization_concurrently(
        load_recs_fn=_load_topic_recommendations_for_response,
        load_opt_fn=_load_profile_optimization_for_response,
        ...
    )
"""

from __future__ import annotations

import asyncio
from typing import Any, Callable, Optional, Tuple


async def load_recommendations_and_optimization_concurrently(
    *,
    load_recs_fn: Callable,
    load_opt_fn: Callable,
    user_id: str,
    ai_profile_intelligence: Any,
    profile_context: dict,
    profile_validation: dict,
    repository: Any,
    should_load_recs: bool = False,
    should_load_opt: bool = False,
    refresh_recs: bool = False,
    refresh_opt: bool = False,
) -> Tuple[Optional[tuple], Optional[tuple]]:
    """Run Phase 6 (recommendations) and Phase 7 (optimization) concurrently.

    Both depend on Phase 5 (intelligence output) but are independent of each
    other. When both are requested, fires them in parallel via asyncio.gather.

    Returns (recs_result, opt_result) where each is a tuple or None.
    """
    if ai_profile_intelligence is None:
        return None, None

    intelligence_dict = ai_profile_intelligence.model_dump()

    async def _recs():
        if not should_load_recs:
            return None
        return load_recs_fn(
            user_id, intelligence_dict, profile_validation, repository,
            force_regenerate=refresh_recs,
        )

    async def _opt():
        if not should_load_opt:
            return None
        return load_opt_fn(
            user_id, profile_context, profile_validation,
            intelligence_dict, repository,
            force_regenerate=refresh_opt,
        )

    if should_load_recs and should_load_opt:
        return await asyncio.gather(_recs(), _opt())
    elif should_load_recs:
        return await _recs(), None
    elif should_load_opt:
        return None, await _opt()

    return None, None
