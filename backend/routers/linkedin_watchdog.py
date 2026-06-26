import hashlib
import hmac
import os
from typing import Dict, Any, Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from loguru import logger

from models.linkedin_watchdog_models import (
    WatchdogIndustryCreate, WatchdogIndustryUpdate,
    WatchdogCompanyCreate, WatchdogCompanyUpdate,
    WatchdogPersonCreate, WatchdogPersonUpdate,
    WatchdogDiscoverCompaniesRequest, WatchdogDiscoverPeopleRequest,
    WatchdogUpdatesResponse, WatchdogRefreshResponse,
    WatchdogListResponse, WatchdogDiscoverResponse,
)
from services.linkedin.watchdog_service import watchdog_service
from middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/api/linkedin/watchdog", tags=["LinkedIn Watchdog"])


def _resolve_user_id(current_user: Dict[str, Any]) -> str:
    return current_user.get("id") or current_user.get("clerk_user_id") or "default"


def _build_webhook_url(request: Request) -> str:
    """Construct the webhook URL from the incoming request base.

    Respects the EXA_WEBHOOK_BASE_URL env var so deployments can
    override with a public HTTPS endpoint (required by Exa's API).
    Falls back to the incoming request's base URL.
    """
    api_url = os.getenv("REACT_APP_API_URL")
    if api_url:
        return api_url.rstrip("/") + "/api/linkedin/watchdog/webhook"
    base = str(request.base_url).rstrip("/")
    return f"{base}/api/linkedin/watchdog/webhook"


# ── Helper: public endpoint marker (avoids Clerk auth for webhook) ──

# Webhook route is defined last so we can apply a different auth strategy.
# We'll skip Clerk auth on it manually.


# ── All watched items ───────────────────────────────────────────────

@router.get("/all", response_model=WatchdogListResponse)
async def get_all_watched(current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = _resolve_user_id(current_user)
    return WatchdogListResponse(**watchdog_service.get_all_watched(user_id))


# ── Industries ──────────────────────────────────────────────────────

@router.get("/industries")
async def list_industries(current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = _resolve_user_id(current_user)
    return {"success": True, "industries": [i.dict() for i in watchdog_service.get_industries(user_id)]}


@router.post("/industries")
async def create_industry(data: WatchdogIndustryCreate, request: Request,
                          current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = _resolve_user_id(current_user)
    webhook_url = _build_webhook_url(request)
    industry = await watchdog_service.create_industry(user_id, data, webhook_url=webhook_url)
    logger.info(f"[Watchdog] User {user_id} created industry '{industry.name}'")
    return {"success": True, "industry": industry.dict()}


@router.put("/industries/{industry_id}")
async def update_industry(industry_id: str, data: WatchdogIndustryUpdate, request: Request,
                          current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = _resolve_user_id(current_user)
    webhook_url = _build_webhook_url(request)
    industry = await watchdog_service.update_industry(user_id, industry_id, data, webhook_url=webhook_url)
    if not industry:
        raise HTTPException(status_code=404, detail="Industry not found")
    return {"success": True, "industry": industry.dict()}


@router.delete("/industries/{industry_id}")
async def delete_industry(industry_id: str,
                          current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = _resolve_user_id(current_user)
    if not await watchdog_service.delete_industry(user_id, industry_id):
        raise HTTPException(status_code=404, detail="Industry not found")
    return {"success": True, "message": "Industry removed from watchlist"}


# ── Companies ───────────────────────────────────────────────────────

@router.get("/companies")
async def list_companies(current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = _resolve_user_id(current_user)
    return {"success": True, "companies": [c.dict() for c in watchdog_service.get_companies(user_id)]}


@router.post("/companies")
async def create_company(data: WatchdogCompanyCreate, request: Request,
                         current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = _resolve_user_id(current_user)
    webhook_url = _build_webhook_url(request)
    company = await watchdog_service.create_company(user_id, data, webhook_url=webhook_url)
    logger.info(f"[Watchdog] User {user_id} created company '{company.name}'")
    return {"success": True, "company": company.dict()}


@router.put("/companies/{company_id}")
async def update_company(company_id: str, data: WatchdogCompanyUpdate, request: Request,
                         current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = _resolve_user_id(current_user)
    webhook_url = _build_webhook_url(request)
    company = await watchdog_service.update_company(user_id, company_id, data, webhook_url=webhook_url)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return {"success": True, "company": company.dict()}


@router.delete("/companies/{company_id}")
async def delete_company(company_id: str,
                         current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = _resolve_user_id(current_user)
    if not await watchdog_service.delete_company(user_id, company_id):
        raise HTTPException(status_code=404, detail="Company not found")
    return {"success": True, "message": "Company removed from watchlist"}


# ── People ──────────────────────────────────────────────────────────

@router.get("/people")
async def list_people(current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = _resolve_user_id(current_user)
    return {"success": True, "people": [p.dict() for p in watchdog_service.get_people(user_id)]}


@router.post("/people")
async def create_person(data: WatchdogPersonCreate, request: Request,
                        current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = _resolve_user_id(current_user)
    webhook_url = _build_webhook_url(request)
    person = await watchdog_service.create_person(user_id, data, webhook_url=webhook_url)
    logger.info(f"[Watchdog] User {user_id} created person '{person.name}'")
    return {"success": True, "person": person.dict()}


@router.put("/people/{person_id}")
async def update_person(person_id: str, data: WatchdogPersonUpdate, request: Request,
                        current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = _resolve_user_id(current_user)
    webhook_url = _build_webhook_url(request)
    person = await watchdog_service.update_person(user_id, person_id, data, webhook_url=webhook_url)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return {"success": True, "person": person.dict()}


@router.delete("/people/{person_id}")
async def delete_person(person_id: str,
                        current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = _resolve_user_id(current_user)
    if not await watchdog_service.delete_person(user_id, person_id):
        raise HTTPException(status_code=404, detail="Person not found")
    return {"success": True, "message": "Person removed from watchlist"}


# ── Discovery via Exa ───────────────────────────────────────────────

@router.post("/discover/companies", response_model=WatchdogDiscoverResponse)
async def discover_companies(data: WatchdogDiscoverCompaniesRequest,
                             current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = _resolve_user_id(current_user)
    try:
        results = await watchdog_service.discover_companies(data.query, num_results=data.num_results, user_id=user_id)
        return WatchdogDiscoverResponse(success=True, results=results)
    except Exception as e:
        logger.error(f"[Watchdog] Company discovery failed: {e}")
        raise HTTPException(status_code=502, detail=f"Company search failed: {str(e)}")


@router.post("/discover/people", response_model=WatchdogDiscoverResponse)
async def discover_people(data: WatchdogDiscoverPeopleRequest,
                          current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = _resolve_user_id(current_user)
    try:
        results = await watchdog_service.discover_people(data.query, num_results=data.num_results, user_id=user_id)
        return WatchdogDiscoverResponse(success=True, results=results)
    except Exception as e:
        logger.error(f"[Watchdog] People discovery failed: {e}")
        raise HTTPException(status_code=502, detail=f"People search failed: {str(e)}")


# ── Exa Monitor management ──────────────────────────────────────────

@router.post("/sync-monitors")
async def sync_monitors(request: Request,
                        current_user: Dict[str, Any] = Depends(get_current_user)):
    """Ensure all watched items have active Exa Monitors."""
    user_id = _resolve_user_id(current_user)
    webhook_url = _build_webhook_url(request)
    counts = await watchdog_service.sync_monitors(user_id, webhook_url=webhook_url)
    return {"success": True, "message": "Monitor sync complete", "created": counts}


@router.post("/trigger-monitors")
async def trigger_monitors(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Manually trigger all active Exa Monitors."""
    user_id = _resolve_user_id(current_user)
    triggered = await watchdog_service.trigger_all_monitors(user_id)
    return {"success": True, "triggered": triggered}


@router.get("/monitor-status")
async def monitor_status(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Return monitoring status for all watched items."""
    user_id = _resolve_user_id(current_user)
    return {"success": True, "monitors": watchdog_service.get_monitor_status(user_id)}


# ── Refresh (poll Exa for new updates) ──────────────────────────────

@router.post("/refresh", response_model=WatchdogRefreshResponse)
async def refresh_watchdog(current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = _resolve_user_id(current_user)
    try:
        new_updates = await watchdog_service.poll_updates(user_id)
        total = len(watchdog_service.get_updates(user_id))
        return WatchdogRefreshResponse(
            success=True,
            new_updates=len(new_updates),
            total_updates=total,
            message=f"Found {len(new_updates)} new updates",
        )
    except Exception as e:
        logger.error(f"[Watchdog] Refresh failed for {user_id}: {e}")
        raise HTTPException(status_code=502, detail=f"Watchdog refresh failed: {str(e)}")


# ── Updates ─────────────────────────────────────────────────────────

@router.get("/updates", response_model=WatchdogUpdatesResponse)
async def get_updates(
    category: Optional[str] = Query(None, regex="^(industry|company|person)$"),
    since: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = _resolve_user_id(current_user)
    updates = watchdog_service.get_updates(user_id, category=category, since=since)
    unread = watchdog_service.get_unread_count(user_id)
    return WatchdogUpdatesResponse(
        success=True,
        updates=updates,
        total_count=len(updates),
        unread_count=unread,
    )


@router.put("/updates/{update_id}/read")
async def mark_update_read(update_id: str,
                           current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = _resolve_user_id(current_user)
    if not watchdog_service.mark_update_read(user_id, update_id):
        raise HTTPException(status_code=404, detail="Update not found")
    return {"success": True, "message": "Update marked as read"}


# ── Webhook (Exa Monitor delivery) ──────────────────────────────────

@router.post("/webhook")
async def watchdog_webhook(payload: Dict[str, Any], request: Request):
    """Receive Exa Monitor run results via webhook.

    Expected payload shape:
    {
        "event": "monitor.run.completed",
        "monitor": { "id": "...", ... },
        "run": { "id": "...", "results": [...] },
        "metadata": { "user_id": "...", "category": "...", "reference_id": "...", "reference_name": "..." }
    }

    Signature verification uses the webhookSecret stored at monitor creation time.
    The signature is passed in the `x-exa-signature-256` header (HMAC-SHA256).
    """
    signature = request.headers.get("x-exa-signature-256", "")
    metadata = payload.get("metadata") or {}
    user_id = metadata.get("user_id")
    category = metadata.get("category")
    reference_id = metadata.get("reference_id")
    reference_name = metadata.get("reference_name", "")

    if not user_id:
        logger.warning("[Watchdog] Webhook missing user_id in metadata")
        return {"success": False, "detail": "Missing user_id"}

    # Verify webhook signature
    monitor_id = payload.get("monitor", {}).get("id", "")
    if signature and monitor_id:
        from models.linkedin_watchdog_db_models import WatchdogMonitorDB
        from services.database import get_session_for_user
        db = get_session_for_user(user_id)
        if db:
            try:
                row = db.query(WatchdogMonitorDB).filter(
                    WatchdogMonitorDB.exa_monitor_id == monitor_id
                ).first()
                if row and row.webhook_secret:
                    expected = hmac.new(
                        row.webhook_secret.encode(),
                        (await request.body()),
                        hashlib.sha256,
                    ).hexdigest()
                    if not hmac.compare_digest(f"sha256={expected}", signature):
                        logger.warning(f"[Watchdog] Webhook signature mismatch for monitor {monitor_id}")
                        return {"success": False, "detail": "Invalid signature"}
            except Exception:
                pass
            finally:
                db.close()

    # Extract results
    run_data = payload.get("run", {})
    results = run_data.get("results", []) if isinstance(run_data, dict) else []
    if not results and isinstance(run_data, list):
        results = run_data

    if not results:
        logger.info(f"[Watchdog] Webhook received for {user_id}/{category}/{reference_id} — no new results")
        return {"success": True, "new_updates": 0}

    count = watchdog_service._process_webhook_results(
        user_id, category or "", reference_id or "", reference_name, results
    )
    logger.info(f"[Watchdog] Webhook processed {count} new updates for {user_id}")
    return {"success": True, "new_updates": count}
