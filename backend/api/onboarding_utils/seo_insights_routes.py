"""
Phase 12 (plan Phase C) — SEO-informed onboarding routes.

- POST /api/onboarding/seo-insights/on-page-audit  -> run + PERSIST the on-page
  audit into the SEO SSOT (previously the wizard result was volatile).
- POST /api/onboarding/seo-insights/gsc-snapshot   -> derive striking-distance
  / low-CTR highlights from REAL stored GSC rows and persist them.
- GET  /api/onboarding/seo-insights/prefill        -> onboarding-derived
  prefill (site URL + content pillars) for the SEO dashboard tools.

Services are imported lazily inside handlers so this router stays light for
slim-mode startup; all three are user-scoped via get_current_user.
"""

from typing import Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from pydantic import BaseModel

from middleware.auth_middleware import get_current_user
from services.database import get_db_session
from services.onboarding_seo_insights import (
    build_seo_prefill,
    persist_gsc_snapshot,
    persist_on_page_audit,
    summarize_gsc_rows,
)

router = APIRouter(prefix="/api/onboarding/seo-insights", tags=["Onboarding SEO Insights"])


class OnPageAuditRequest(BaseModel):
    website_url: str
    target_keywords: Optional[list[str]] = None


class GscSnapshotRequest(BaseModel):
    site_url: str
    date_range_days: int = 90


@router.post("/on-page-audit")
async def run_and_persist_on_page_audit(
    request: OnPageAuditRequest,
    current_user: dict = Depends(get_current_user),
):
    """Run the real on-page audit and persist it into website_analyses.seo_audit."""
    user_id = str(current_user.get("id"))
    db = get_db_session()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        from services.seo_tools.on_page_seo_service import OnPageSEOService

        audit = await OnPageSEOService().analyze_on_page_seo(
            url=request.website_url,
            target_keywords=request.target_keywords or [],
        )
        persisted = await persist_on_page_audit(
            user_id, request.website_url, audit, db
        )
        return {"success": True, "audit": audit, "persisted": persisted}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"On-page audit persist failed for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="On-page audit failed")
    finally:
        db.close()


@router.post("/gsc-snapshot")
async def run_and_persist_gsc_snapshot(
    request: GscSnapshotRequest,
    current_user: dict = Depends(get_current_user),
):
    """Derive + persist real GSC highlights (striking distance, low CTR)."""
    user_id = str(current_user.get("id"))
    db = get_db_session()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        from services.gsc_service import GSCService

        end_dt = datetime.utcnow()
        start_dt = end_dt - timedelta(days=max(1, min(request.date_range_days, 365)))
        analytics = GSCService().get_search_analytics(
            user_id,
            request.site_url,
            start_dt.strftime("%Y-%m-%d"),
            end_dt.strftime("%Y-%m-%d"),
        )

        if not analytics or analytics.get("error"):
            # Honest no_data: persist the status, never fabricated highlights.
            snapshot = {
                "status": "no_data",
                "message": (analytics or {}).get("error", "No GSC data available"),
                **summarize_gsc_rows([]),
            }
        else:
            rows = (analytics.get("query_data") or {}).get("rows") or []
            snapshot = {"status": "success", **summarize_gsc_rows(rows)}

        persisted = await persist_gsc_snapshot(user_id, request.site_url, snapshot, db)
        return {"success": True, "snapshot": persisted}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"GSC snapshot failed for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="GSC snapshot failed")
    finally:
        db.close()


@router.get("/prefill")
async def get_seo_prefill(current_user: dict = Depends(get_current_user)):
    """Onboarding-derived prefill: site URL + content pillars (real data only)."""
    user_id = str(current_user.get("id"))
    db = get_db_session()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        return build_seo_prefill(user_id, db)
    finally:
        db.close()
