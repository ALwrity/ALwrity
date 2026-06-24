"""
Exa Monitors API client.

Provides a shared client for creating, listing, triggering, and deleting
Exa Monitors — scheduled recurring searches with automatic deduplication.

Used by:
- LinkedIn Writer Industry Watchdog (automated news polling)
- Blog Writer / content research (future)

This is a separate client from ExaContentResearchProvider because the
Monitors API uses a different surface (no exa_py SDK support yet).
"""

import os
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime
from loguru import logger

import httpx


MONITOR_BASE_URL = "https://api.exa.ai/monitors"
DEFAULT_TIMEOUT = 30.0


class ExaMonitorClient:
    """Direct HTTP client for the Exa Monitors API."""

    def __init__(self):
        self.api_key = os.getenv("EXA_API_KEY")
        if not self.api_key:
            raise RuntimeError("EXA_API_KEY not configured")
        self._http = httpx.AsyncClient(
            base_url=MONITOR_BASE_URL,
            headers={
                "x-api-key": self.api_key,
                "Content-Type": "application/json",
            },
            timeout=DEFAULT_TIMEOUT,
        )
        logger.info("ExaMonitorClient initialized")

    async def close(self):
        try:
            await self._http.aclose()
        except Exception:
            pass

    # ── Subscription preflight (reused pattern) ────────────────────

    async def _preflight_check(self, user_id: Optional[str] = None):
        if not user_id:
            return
        from models.subscription_models import APIProvider
        from services.subscription import PricingService
        from services.database import get_session_for_user
        from fastapi import HTTPException

        db = get_session_for_user(user_id)
        if not db:
            return
        try:
            pricing_service = PricingService(db)
            can_proceed, message, usage_info = pricing_service.check_usage_limits(
                user_id=user_id,
                provider=APIProvider.EXA,
                tokens_requested=0,
                actual_provider_name="exa",
            )
            if not can_proceed:
                raise HTTPException(status_code=429, detail={
                    'error': 'insufficient_balance',
                    'message': message,
                    'provider': 'exa',
                    'usage_info': usage_info or {},
                })
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"[ExaMonitor] Preflight check failed: {e}")
        finally:
            try:
                db.close()
            except Exception:
                pass

    def _track_usage(self, user_id: str, cost: float = 0.0):
        """Record monitor API usage. Cost is typically 0 since monitors
        are billed separately (runs are free; search results are billed)."""
        try:
            from services.database import get_session_for_user
            from services.subscription import PricingService
            from sqlalchemy import text

            db = get_session_for_user(user_id)
            if not db:
                return
            try:
                pricing_service = PricingService(db)
                current_period = pricing_service.get_current_billing_period(user_id)

                update_query = text("""
                    UPDATE usage_summaries
                    SET exa_calls = COALESCE(exa_calls, 0) + 1,
                        exa_cost = COALESCE(exa_cost, 0) + :cost,
                        total_calls = total_calls + 1,
                        total_cost = total_cost + :cost
                    WHERE user_id = :user_id AND billing_period = :period
                """)
                db.execute(update_query, {
                    'cost': cost,
                    'user_id': user_id,
                    'period': current_period,
                })
                db.commit()
            except Exception:
                db.rollback()
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"[ExaMonitor] track_usage failed: {e}")

    # ── CRUD: Monitors ─────────────────────────────────────────────

    async def create_monitor(
        self,
        name: str,
        query: str,
        webhook_url: str,
        num_results: int = 10,
        trigger_period: str = "1d",
        metadata: Optional[Dict[str, str]] = None,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create an Exa Monitor for recurring scheduled searches.

        Args:
            name: Display name for the monitor.
            query: The search query to run on each interval.
            webhook_url: HTTPS URL to receive run results.
            num_results: Results per run (1-100, default 10).
            trigger_period: Interval string ("1h", "6h", "1d", "7d"). Default "1d".
            metadata: Arbitrary key-value pairs echoed in webhook deliveries.
            user_id: Optional user ID for subscription checking.

        Returns:
            Monitor dict with keys: id, name, search, trigger, webhook, webhookSecret, etc.

        Raises:
            HTTPException(429): If user has exceeded subscription limits.
            RuntimeError: If API call fails.
        """
        await self._preflight_check(user_id)

        payload = {
            "name": name,
            "search": {
                "query": query,
                "numResults": num_results,
                "contents": {
                    "text": {"max_characters": 1000},
                    "highlights": {"num_sentences": 3, "highlights_per_url": 2},
                },
            },
            "trigger": {
                "type": "interval",
                "period": trigger_period,
            },
            "webhook": {
                "url": webhook_url,
            },
        }
        if metadata:
            payload["metadata"] = metadata

        try:
            response = await self._http.post("/", json=payload)
            response.raise_for_status()
            data = response.json()
            if user_id:
                self._track_usage(user_id)
            logger.info(
                f"[ExaMonitor] Created '{name}' id={data.get('id')} "
                f"query='{query[:60]}' period={trigger_period}"
            )
            return data
        except httpx.HTTPStatusError as e:
            body = e.response.text[:300]
            logger.error(f"[ExaMonitor] create failed ({e.response.status_code}): {body}")
            raise RuntimeError(
                f"Exa Monitor creation failed: {e.response.status_code} {body}"
            ) from e
        except httpx.RequestError as e:
            logger.error(f"[ExaMonitor] create request failed: {e}")
            raise RuntimeError(f"Exa Monitor API unreachable: {e}") from e

    async def list_monitors(
        self,
        offset: int = 0,
        limit: int = 50,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List all Exa Monitors for the API key."""
        await self._preflight_check(user_id)

        try:
            response = await self._http.get("/", params={"offset": offset, "limit": limit})
            response.raise_for_status()
            data = response.json()
            results = data if isinstance(data, list) else data.get("results", [])
            return results
        except httpx.HTTPStatusError as e:
            logger.error(f"[ExaMonitor] list failed ({e.response.status_code})")
            raise RuntimeError(f"Exa Monitor list failed: {e.response.status_code}") from e
        except httpx.RequestError as e:
            logger.error(f"[ExaMonitor] list request failed: {e}")
            raise RuntimeError(f"Exa Monitor API unreachable: {e}") from e

    async def get_monitor(
        self,
        monitor_id: str,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get details for a specific Exa Monitor."""
        await self._preflight_check(user_id)

        try:
            response = await self._http.get(f"/{monitor_id}")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise RuntimeError(f"Exa Monitor {monitor_id} not found") from e
            logger.error(f"[ExaMonitor] get failed ({e.response.status_code})")
            raise RuntimeError(f"Exa Monitor get failed: {e.response.status_code}") from e
        except httpx.RequestError as e:
            logger.error(f"[ExaMonitor] get request failed: {e}")
            raise RuntimeError(f"Exa Monitor API unreachable: {e}") from e

    async def delete_monitor(
        self,
        monitor_id: str,
        user_id: Optional[str] = None,
    ) -> bool:
        """Delete an Exa Monitor. Returns True on success."""
        await self._preflight_check(user_id)

        try:
            response = await self._http.delete(f"/{monitor_id}")
            response.raise_for_status()
            logger.info(f"[ExaMonitor] Deleted {monitor_id}")
            if user_id:
                self._track_usage(user_id)
            return True
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.warning(f"[ExaMonitor] {monitor_id} not found during delete")
                return False
            logger.error(f"[ExaMonitor] delete failed ({e.response.status_code})")
            return False
        except httpx.RequestError as e:
            logger.error(f"[ExaMonitor] delete request failed: {e}")
            return False

    # ── Runs ───────────────────────────────────────────────────────

    async def trigger_run(
        self,
        monitor_id: str,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Manually trigger a monitor run (on-demand, outside schedule).

        Returns:
            Run dict with keys: id, status, createdAt, etc.
        """
        await self._preflight_check(user_id)

        try:
            response = await self._http.post(f"/{monitor_id}/trigger")
            response.raise_for_status()
            data = response.json()
            if user_id:
                self._track_usage(user_id)
            logger.info(f"[ExaMonitor] Triggered run for {monitor_id}: run_id={data.get('id')}")
            return data
        except httpx.HTTPStatusError as e:
            body = e.response.text[:300]
            logger.error(f"[ExaMonitor] trigger failed ({e.response.status_code}): {body}")
            raise RuntimeError(
                f"Exa Monitor trigger failed: {e.response.status_code} {body}"
            ) from e
        except httpx.RequestError as e:
            logger.error(f"[ExaMonitor] trigger request failed: {e}")
            raise RuntimeError(f"Exa Monitor API unreachable: {e}") from e

    async def list_runs(
        self,
        monitor_id: str,
        offset: int = 0,
        limit: int = 20,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List runs for a specific Exa Monitor."""
        await self._preflight_check(user_id)

        try:
            response = await self._http.get(
                f"/{monitor_id}/runs",
                params={"offset": offset, "limit": limit},
            )
            response.raise_for_status()
            data = response.json()
            results = data if isinstance(data, list) else data.get("results", [])
            return results
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise RuntimeError(f"Exa Monitor {monitor_id} not found") from e
            logger.error(f"[ExaMonitor] list_runs failed ({e.response.status_code})")
            raise RuntimeError(f"Exa Monitor list_runs failed: {e.response.status_code}") from e
        except httpx.RequestError as e:
            logger.error(f"[ExaMonitor] list_runs request failed: {e}")
            raise RuntimeError(f"Exa Monitor API unreachable: {e}") from e

    async def get_run_results(
        self,
        monitor_id: str,
        run_id: str,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get search results from a specific monitor run.

        Returns:
            List of result dicts with keys: title, url, text, publishedDate, author, score.
        """
        await self._preflight_check(user_id)

        try:
            response = await self._http.get(f"/{monitor_id}/runs/{run_id}")
            response.raise_for_status()
            data = response.json()
            results = data if isinstance(data, list) else data.get("results", [])
            return results
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise RuntimeError(f"Run {run_id} not found for monitor {monitor_id}") from e
            logger.error(f"[ExaMonitor] get_run_results failed ({e.response.status_code})")
            raise RuntimeError(
                f"Exa Monitor get_run_results failed: {e.response.status_code}"
            ) from e
        except httpx.RequestError as e:
            logger.error(f"[ExaMonitor] get_run_results request failed: {e}")
            raise RuntimeError(f"Exa Monitor API unreachable: {e}") from e


# Global singleton
_exa_monitor_client: Optional[ExaMonitorClient] = None


def get_exa_monitor_client() -> ExaMonitorClient:
    """Get or create the global Exa Monitor client instance."""
    global _exa_monitor_client
    if _exa_monitor_client is None:
        _exa_monitor_client = ExaMonitorClient()
    return _exa_monitor_client
