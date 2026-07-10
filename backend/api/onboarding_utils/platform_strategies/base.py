"""
PlatformOnboardingStrategy Protocol
===================================

Defines the strategy interface that each platform (website, linkedin,
instagram, ...) must implement.  The onboarding plumbing calls only these
methods, never platform-specific services directly, so new platforms can
be added without touching shared code.

Step numbers follow the **backend** convention (1-indexed, steps 1-5,
step 6 = completion) established by the existing website onboarding flow.
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Protocol, runtime_checkable

from sqlalchemy.orm import Session


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

WEBSITE_TYPE = "website"
LINKEDIN_TYPE = "linkedin"

VALID_TYPES = {WEBSITE_TYPE, LINKEDIN_TYPE}


# ---------------------------------------------------------------------------
# Protocol
# ---------------------------------------------------------------------------

@runtime_checkable
class PlatformOnboardingStrategy(Protocol):
    """Strategy contract for a platform onboarding path.

    The shared ``StepManagementService`` delegates step-specific work to
    these methods.  Shared concerns (progress tracking, SSOT refresh,
    validation) stay in the service; platform-specific concerns (data
    persistence, task scheduling, SIF sync) live in the strategy.

    All methods should be **non-blocking** -- they must catch/log
    exceptions rather than propagate them so step completion never fails
    due to a strategy bug.
    """

    @property
    def onboarding_type(self) -> str:
        """Return the platform identifier (e.g. ``"website"``)."""
        ...

    @property
    def context_file_prefix(self) -> str:
        """Prefix for AgentFlatContextStore file keys (e.g. ``"website"``)."""
        ...

    async def complete_step(
        self,
        svc,
        step_number: int,
        user_id: str,
        request_data: Dict[str, Any],
        db: Session,
    ) -> Dict[str, Any]:
        """Execute platform-specific logic for completing a step.

        Receives the ``StepManagementService`` instance (``svc``) so
        existing private helpers can be reused.  Returns a dict with
        optional ``warnings`` list that is merged into the step-complete
        response.

        This method is **async** so strategies that need to call async
        services (e.g. LinkedIn's ``get_or_fetch_profile``) can ``await``
        them directly.  Sync strategies (like website) simply define
        ``async def`` and run their sync code without any awaits.

        Backend step numbers:
            1 -- API keys / initial integrations
            2 -- Website analysis / profile baseline
            3 -- Research / competitor discovery
            4 -- Persona generation
            5 -- Integrations / content preferences
        """
        ...

    async def sif_sync(
        self,
        user_id: str,
        sif_service,
    ) -> None:
        """Sync onboarding data to the SIF semantic index for this platform.

        Implementations may no-op if the platform does not use SIF (e.g.
        structured-table platforms like LinkedIn).
        """
        ...