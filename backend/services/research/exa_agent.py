"""
Exa Agent API — common infrastructure for structured web research.

Provides a reusable client that wraps the Exa Agent API
(exa.agent.runs.create + poll_until_finished). Accepts a
plain-English query and a JSON Schema output_schema, returns
validated JSON.

Usage:
    from services.research.exa_agent import ExaAgentClient

    agent = ExaAgentClient()
    result = await agent.run(
        query="Find competitors for example.com",
        output_schema={
            "type": "object",
            "properties": {
                "companies": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "company": {"type": "string"},
                            "website": {"type": "string", "format": "uri"},
                        },
                        "required": ["company"],
                    },
                }
            },
            "required": ["companies"],
        },
    )
    # result = {"companies": [{"company": "...", "website": "..."}]}
"""

import os
from typing import Optional, Dict, Any

from loguru import logger

from exa_py import Exa

DEFAULT_EFFORT = "medium"
DEFAULT_TIMEOUT = 300  # seconds
DEFAULT_POLL_INTERVAL = 4000  # milliseconds


class ExaAgentClient:
    """Reusable client for Exa's Agent API (structured web research).

    Each call creates an Agent run, polls until completion, and
    returns the schema-validated structured output.  Intended as
    a common building block — onboarding, blog writer, LinkedIn,
    or any future feature can call ``await agent.run(...)``
    without duplicating the create/poll lifecycle.

    Key attributes:
        exa   – the underlying ``exa_py.Exa`` client
        timeout – max seconds to wait for a run to finish
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        timeout: int = DEFAULT_TIMEOUT,
    ):
        key = api_key or os.getenv("EXA_API_KEY")
        if not key:
            raise RuntimeError("EXA_API_KEY is not configured")

        self.exa = Exa(api_key=key)
        self.timeout = timeout
        logger.info(f"ExaAgentClient initialized — exa_py.Exa has agent={hasattr(self.exa, 'agent')}")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def run(
        self,
        query: str,
        output_schema: Dict[str, Any],
        effort: str = DEFAULT_EFFORT,
    ) -> Optional[Dict[str, Any]]:
        """Execute an Agent run and return the structured JSON result.

        Parameters:
            query          – natural-language research prompt
            output_schema  – JSON Schema dict (Pydantic.model_json_schema()
                             or hand-written dict)
            effort         – "minimal"|"low"|"medium"|"high"|"xhigh"|"auto"

        Returns:
            Schema-validated dict from ``output.structured``, or ``None``
            if the run failed or produced no structured output.
        """
        if not query or not isinstance(query, str):
            raise ValueError("query must be a non-empty string")

        if not output_schema or not isinstance(output_schema, dict):
            raise ValueError("output_schema must be a non-empty dict")

        logger.info(f"ExaAgentClient.run starting — query={query[:120]}... effort={effort}")

        try:
            # 1. Create run (may take a few seconds)
            run = self.exa.agent.runs.create(
                query=query,
                output_schema=output_schema,
                effort=effort,
            )
            run_id = run.id
            logger.info(f"ExaAgentClient: run created id={run_id} status={run.status}")

            # 2. Poll until terminal
            completed = self.exa.agent.runs.poll_until_finished(
                run_id,
                poll_interval=DEFAULT_POLL_INTERVAL,
            )

            # 3. Extract structured output
            if completed.output and completed.output.structured:
                logger.info(f"ExaAgentClient: run completed id={run_id}")
                return completed.output.structured

            logger.warning(
                f"ExaAgentClient: run completed but no structured output "
                f"id={run_id} status={completed.status}"
            )
            return None

        except Exception as e:
            logger.error(f"ExaAgentClient.run failed: {e}")
            return None

    async def run_sync(
        self,
        query: str,
        output_schema: Dict[str, Any],
        effort: str = DEFAULT_EFFORT,
    ) -> Optional[Dict[str, Any]]:
        """Convenience alias for ``run()`` — same signature."""
        return await self.run(query, output_schema, effort)
