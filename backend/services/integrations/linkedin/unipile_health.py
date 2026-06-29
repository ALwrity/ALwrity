"""
Unipile configuration health checks for LinkedIn Social connect.

Validates env configuration and optionally probes the Unipile API so
misconfiguration surfaces at startup and via GET /api/linkedin-social/unipile/health.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from loguru import logger

from services.integrations.linkedin.unipile_client import UnipileAPIError, UnipileClient

_last_status: Optional[Dict[str, Any]] = None


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _record_check(
    checks: List[Dict[str, Any]], name: str, ok: bool, detail: str
) -> None:
    checks.append({"name": name, "ok": ok, "detail": detail})


def get_cached_unipile_health() -> Optional[Dict[str, Any]]:
    """Return the most recent startup or explicit health check result."""
    return dict(_last_status) if _last_status is not None else None


def _store_status(status: Dict[str, Any]) -> Dict[str, Any]:
    global _last_status
    _last_status = status
    return status


async def check_unipile_health(*, probe_api: bool = True) -> Dict[str, Any]:
    """
    Validate Unipile env configuration and optionally verify credentials against the API.

    Returns a structured report safe to expose over HTTP (no API key values).
    """
    provider = os.getenv("LINKEDIN_PROVIDER", "zernio").strip().lower()
    api_key = (os.getenv("UNIPILE_API_KEY") or "").strip()
    dsn = (os.getenv("UNIPILE_DSN") or "").strip()

    status: Dict[str, Any] = {
        "service": "linkedin-social-unipile",
        "linkedin_provider": provider,
        "checked_at": _utc_now_iso(),
        "configured": False,
        "healthy": False,
        "probe_api": probe_api,
        "checks": [],
        "errors": [],
        "warnings": [],
        "dsn": dsn or None,
        "api_key_length": len(api_key) if api_key else 0,
    }

    if provider != "unipile":
        _record_check(
            status["checks"],
            "linkedin_provider",
            True,
            f"LINKEDIN_PROVIDER={provider} (Unipile health check not required)",
        )
        status["status"] = "skipped"
        status["healthy"] = True
        return _store_status(status)

    _record_check(status["checks"], "linkedin_provider", True, "LINKEDIN_PROVIDER=unipile")

    if not api_key:
        _record_check(
            status["checks"],
            "unipile_api_key",
            False,
            "UNIPILE_API_KEY is missing or empty",
        )
        status["errors"].append("UNIPILE_API_KEY is not configured")
    else:
        _record_check(
            status["checks"],
            "unipile_api_key",
            True,
            f"UNIPILE_API_KEY is set ({len(api_key)} chars)",
        )

    if not dsn:
        _record_check(
            status["checks"],
            "unipile_dsn",
            False,
            "UNIPILE_DSN is missing or empty",
        )
        status["errors"].append("UNIPILE_DSN is not configured")
    else:
        _record_check(status["checks"], "unipile_dsn", True, f"UNIPILE_DSN={dsn}")

    status["configured"] = bool(api_key and dsn)
    if not status["configured"]:
        status["status"] = "misconfigured"
        return _store_status(status)

    if not probe_api:
        status["status"] = "configured"
        status["healthy"] = True
        return _store_status(status)

    client = UnipileClient(api_key=api_key, dsn=dsn)
    try:
        accounts = await client.list_accounts(provider=None)
        status["account_count"] = len(accounts)
        _record_check(
            status["checks"],
            "unipile_api_auth",
            True,
            f"Unipile API accepted credentials ({len(accounts)} account(s) listed)",
        )
        status["status"] = "healthy"
        status["healthy"] = True
    except UnipileAPIError as exc:
        detail = str(exc)
        _record_check(status["checks"], "unipile_api_auth", False, detail)
        status["errors"].append(detail)
        if exc.status_code == 401:
            status["errors"].append(
                "Unipile rejected the Access Token for this DSN. "
                "Copy both values from the same Unipile dashboard project or regenerate the token."
            )
        status["status"] = "unhealthy"
    except Exception as exc:
        detail = f"Unipile connectivity check failed: {exc}"
        _record_check(status["checks"], "unipile_api_auth", False, detail)
        status["errors"].append(detail)
        status["status"] = "unhealthy"

    return _store_status(status)


async def log_unipile_startup_health() -> Dict[str, Any]:
    """Run Unipile health check at startup and emit a clear log line."""
    result = await check_unipile_health(probe_api=True)

    if result.get("status") == "skipped":
        logger.debug(
            "[STARTUP] Unipile health check skipped "
            f"(LINKEDIN_PROVIDER={result.get('linkedin_provider')})"
        )
        return result

    if result.get("healthy"):
        logger.info(
            "[STARTUP] Unipile credentials OK "
            f"dsn={result.get('dsn')} accounts={result.get('account_count', 0)}"
        )
        return result

    logger.error(
        "[STARTUP] Unipile misconfiguration — LinkedIn Connect will fail until fixed. "
        f"errors={result.get('errors')} "
        "Update UNIPILE_API_KEY and UNIPILE_DSN in backend/.env, then restart. "
        "Diagnostics: GET /api/linkedin-social/unipile/health"
    )
    return result
