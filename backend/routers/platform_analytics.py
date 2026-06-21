"""
Platform Analytics API Routes

Provides endpoints for retrieving analytics data from connected platforms.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from loguru import logger
from pydantic import BaseModel

from services.analytics import PlatformAnalyticsService
from middleware.auth_middleware import get_current_user
from services.llm_providers.main_text_generation import llm_text_gen

router = APIRouter(prefix="/api/analytics", tags=["Platform Analytics"])

# Initialize analytics service
analytics_service = PlatformAnalyticsService()

@router.post("/cache/clear")
async def clear_analytics_cache(
    platform: Optional[str] = Query(None, description="Specific platform to clear (e.g., 'bing', 'gsc')"),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Clear analytics cache for the current user.
    If 'platform' is provided, clears only that platform's cache; otherwise clears all and connection status.
    """
    try:
        user_id = current_user.get('id')
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        if platform:
            analytics_service.invalidate_platform_cache(user_id, platform)
        else:
            analytics_service.invalidate_platform_cache(user_id)
        
        # Always refresh connection status cache as well
        analytics_service.invalidate_connection_cache(user_id)
        
        return { "success": True, "message": "Analytics cache cleared", "platform": platform or "all" }
    except Exception as e:
        logger.error(f"Failed to clear analytics cache: {e}")
        return { "success": False, "error": str(e) }


class AnalyticsRequest(BaseModel):
    """Request model for analytics data"""
    platforms: Optional[List[str]] = None
    date_range: Optional[Dict[str, str]] = None


class AnalyticsResponse(BaseModel):
    """Response model for analytics data"""
    success: bool
    data: Dict[str, Any]
    summary: Dict[str, Any]
    error: Optional[str] = None


@router.get("/platforms")
async def get_platform_connection_status(current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Get connection status for all platforms
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Connection status for each platform
    """
    try:
        user_id = current_user.get('id')
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        logger.info(f"Getting platform connection status for user: {user_id}")
        
        status = await analytics_service.get_platform_connection_status(user_id)
        
        return {
            "success": True,
            "platforms": status,
            "total_connected": sum(1 for p in status.values() if p.get('connected', False))
        }
        
    except Exception as e:
        logger.error(f"Failed to get platform connection status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data")
async def get_analytics_data(
    platforms: Optional[str] = Query(None, description="Comma-separated list of platforms (gsc,bing,wix,wordpress)"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_user)
) -> AnalyticsResponse:
    """
    Get analytics data from connected platforms
    
    Args:
        platforms: Comma-separated list of platforms to get data from
        current_user: Current authenticated user
        
    Returns:
        Analytics data from specified platforms
    """
    try:
        user_id = current_user.get('id')
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        # Parse platforms parameter
        platform_list = None
        if platforms:
            platform_list = [p.strip() for p in platforms.split(',') if p.strip()]
        
        logger.info(f"Getting analytics data for user: {user_id}, platforms: {platform_list}, start_date: {start_date}, end_date: {end_date}")

        analytics_data = await analytics_service.get_comprehensive_analytics(user_id, platform_list, start_date=start_date, end_date=end_date)
        summary = analytics_service.get_analytics_summary(analytics_data)

        # The "summary" and per-platform "snapshot" log lines are
        # status reports, not problems. They were logged at warning
        # level which made every successful analytics call show up
        # as a warning in the log. Demoted to debug so the console
        # (which only shows WARNING+ per logging_config.py) stays
        # clean.
        logger.debug(
            "Analytics summary for user {user}: total_clicks={clicks}, total_impressions={impr}, overall_ctr={ctr}, platforms={platforms}",
            user=user_id,
            clicks=summary.get("total_clicks"),
            impr=summary.get("total_impressions"),
            ctr=summary.get("overall_ctr"),
            platforms=list(analytics_data.keys()),
        )
        for platform_name, data in analytics_data.items():
            try:
                logger.debug(
                    "Analytics platform snapshot {platform}: status={status}, total_clicks={clicks}, total_impressions={impr}",
                    platform=platform_name,
                    status=data.status,
                    clicks=data.get_total_clicks(),
                    impr=data.get_total_impressions(),
                )
            except Exception as log_err:
                logger.warning(f"Failed to log platform snapshot for {platform_name}: {log_err}")
        
        data_dict = {}
        for platform, data in analytics_data.items():
            data_dict[platform] = {
                'platform': data.platform,
                'metrics': data.metrics,
                'date_range': data.date_range,
                'last_updated': data.last_updated,
                'status': data.status,
                'error_message': data.error_message
            }
        
        return AnalyticsResponse(
            success=True,
            data=data_dict,
            summary=summary,
            error=None
        )
        
    except Exception as e:
        logger.error(f"Failed to get analytics data: {e}")
        return AnalyticsResponse(
            success=False,
            data={},
            summary={},
            error=str(e)
        )


@router.post("/data")
async def get_analytics_data_post(
    request: AnalyticsRequest,
    current_user: dict = Depends(get_current_user)
) -> AnalyticsResponse:
    """
    Get analytics data from connected platforms (POST version)
    
    Args:
        request: Analytics request with platforms and date range
        current_user: Current authenticated user
        
    Returns:
        Analytics data from specified platforms
    """
    try:
        user_id = current_user.get('id')
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        logger.info(f"Getting analytics data for user: {user_id}, platforms: {request.platforms}")
        
        # Get analytics data
        # Extract optional dates
        start_date = None
        end_date = None
        if request.date_range and isinstance(request.date_range, dict):
            start_date = request.date_range.get('start')
            end_date = request.date_range.get('end')
        
        analytics_data = await analytics_service.get_comprehensive_analytics(user_id, request.platforms, start_date=start_date, end_date=end_date)
        
        # Generate summary
        summary = analytics_service.get_analytics_summary(analytics_data)
        
        # Convert AnalyticsData objects to dictionaries
        data_dict = {}
        for platform, data in analytics_data.items():
            data_dict[platform] = {
                'platform': data.platform,
                'metrics': data.metrics,
                'date_range': data.date_range,
                'last_updated': data.last_updated,
                'status': data.status,
                'error_message': data.error_message
            }
        
        return AnalyticsResponse(
            success=True,
            data=data_dict,
            summary=summary,
            error=None
        )
        
    except Exception as e:
        logger.error(f"Failed to get analytics data: {e}")
        return AnalyticsResponse(
            success=False,
            data={},
            summary={},
            error=str(e)
        )


@router.get("/gsc")
async def get_gsc_analytics(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get Google Search Console analytics data specifically
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        GSC analytics data
    """
    try:
        user_id = current_user.get('id')
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        logger.info(f"Getting GSC analytics for user: {user_id}")
        
        # Get GSC analytics
        gsc_data = await analytics_service._get_gsc_analytics(user_id)
        
        return {
            "success": gsc_data.status == 'success',
            "platform": gsc_data.platform,
            "metrics": gsc_data.metrics,
            "date_range": gsc_data.date_range,
            "last_updated": gsc_data.last_updated,
            "status": gsc_data.status,
            "error": gsc_data.error_message
        }
        
    except Exception as e:
        logger.error(f"Failed to get GSC analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary")
async def get_analytics_summary(current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Get a summary of analytics data across all connected platforms
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Analytics summary
    """
    try:
        user_id = current_user.get('id')
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        logger.info(f"Getting analytics summary for user: {user_id}")
        
        # Get analytics data from all platforms
        analytics_data = await analytics_service.get_comprehensive_analytics(user_id)
        
        # Generate summary
        summary = analytics_service.get_analytics_summary(analytics_data)
        
        return {
            "success": True,
            "summary": summary,
            "platforms_connected": summary['connected_platforms'],
            "platforms_total": summary['total_platforms']
        }
    except Exception as e:
        logger.error(f"Failed to get analytics summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ai-insights")
async def get_ai_insights(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    try:
        user_id = current_user.get('id')
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        sd = start_date
        ed = end_date
        if not sd or not ed:
            today = datetime.utcnow().date()
            ed = today.isoformat()
            sd = (today - timedelta(days=29)).isoformat()
        analytics = await analytics_service.get_comprehensive_analytics(user_id, ['gsc'], start_date=sd, end_date=ed)
        gsc = analytics.get('gsc')
        if not gsc or gsc.status != 'success':
            return {"success": False, "error": gsc.error_message if gsc else "GSC data unavailable"}
        metrics = gsc.metrics or {}
        tq = metrics.get('top_queries') or []
        tp = metrics.get('top_pages') or []
        cannib = metrics.get('cannibalization') or []
        sdt = datetime.strptime(sd, "%Y-%m-%d").date()
        edt = datetime.strptime(ed, "%Y-%m-%d").date()
        window_days = max((edt - sdt).days + 1, 1)
        def thr_impr():
            if window_days <= 7:
                return 100
            if window_days <= 30:
                return 500
            return 1500
        def thr_clicks():
            if window_days <= 7:
                return 10
            if window_days <= 30:
                return 30
            return 60
        low_ctr_queries = []
        for r in tq:
            imp = float(r.get('impressions', 0) or 0)
            ctr = float(r.get('ctr', 0) or 0)
            if imp >= thr_impr() and ctr <= 2.5:
                low_ctr_queries.append({
                    "query": r.get('query'),
                    "impressions": int(round(imp)),
                    "ctr": round(ctr, 2),
                    "clicks": int(round(float(r.get('clicks', 0) or 0))),
                    "position": round(float(r.get('position', 0) or 0), 2) if 'position' in r else None
                })
        striking_distance = []
        for r in tq:
            pos = float(r.get('position', 0) or 0)
            imp = float(r.get('impressions', 0) or 0)
            if 8.0 <= pos <= 20.0 and imp >= (80 if window_days <= 7 else (300 if window_days <= 30 else 1000)):
                striking_distance.append({
                    "query": r.get('query'),
                    "impressions": int(round(imp)),
                    "position": round(pos, 2),
                    "clicks": int(round(float(r.get('clicks', 0) or 0)))
                })
        low_ctr_pages = []
        for p in tp:
            imp = float(p.get('impressions', 0) or 0)
            ctr = float(p.get('ctr', 0) or 0)
            if imp >= thr_impr() and ctr <= 2.0:
                low_ctr_pages.append({
                    "page": p.get('page'),
                    "impressions": int(round(imp)),
                    "ctr": round(ctr, 2),
                    "clicks": int(round(float(p.get('clicks', 0) or 0)))
                })
        serp_feature_loss = []
        for r in tq:
            pos = float(r.get('position', 0) or 0)
            imp = float(r.get('impressions', 0) or 0)
            ctr = float(r.get('ctr', 0) or 0)
            if pos > 0 and pos <= 5.0 and imp >= thr_impr() and ctr <= 2.0:
                serp_feature_loss.append({
                    "query": r.get('query'),
                    "impressions": int(round(imp)),
                    "position": round(pos, 2),
                    "ctr": round(ctr, 2),
                    "clicks": int(round(float(r.get('clicks', 0) or 0)))
                })
        def build_map(rows):
            m = {}
            for r in rows:
                k = r.get('query')
                if not k:
                    continue
                m[k] = {
                    "clicks": float(r.get('clicks', 0) or 0),
                    "impressions": float(r.get('impressions', 0) or 0)
                }
            return m
        prev_end = (sdt - timedelta(days=1)).isoformat()
        prev_start = (sdt - timedelta(days=window_days)).isoformat()
        prev_analytics = await analytics_service.get_comprehensive_analytics(user_id, ['gsc'], start_date=prev_start, end_date=prev_end)
        prev_gsc = prev_analytics.get('gsc')
        prev_tq = prev_gsc.metrics.get('top_queries') if prev_gsc and prev_gsc.metrics else []
        curr_map = build_map(tq)
        prev_map = build_map(prev_tq)
        declining_queries = []
        for q, v in curr_map.items():
            pv = prev_map.get(q) or {"clicks": 0.0, "impressions": 0.0}
            dc = int(round(v["clicks"] - pv["clicks"]))
            di = int(round(v["impressions"] - pv["impressions"]))
            if dc < 0 or di < 0:
                if abs(dc) >= 5 or abs(di) >= thr_impr() * 0.2:
                    declining_queries.append({
                        "query": q,
                        "delta_clicks": dc,
                        "delta_impressions": di,
                        "prev_clicks": int(round(pv["clicks"])),
                        "prev_impressions": int(round(pv["impressions"]))
                    })
        low_ctr_queries = sorted(low_ctr_queries, key=lambda x: (-x["impressions"], x["ctr"]))[:10]
        striking_distance = sorted(striking_distance, key=lambda x: -x["impressions"])[:10]
        low_ctr_pages = sorted(low_ctr_pages, key=lambda x: (-x["impressions"], x["ctr"]))[:10]
        cannib_list = cannib[:10]
        serp_feature_loss = sorted(serp_feature_loss, key=lambda x: -x["impressions"])[:10]
        payload = {
            "context": {
                "site_url": None,
                "date_range": {"start": sd, "end": ed},
                "window_days": window_days
            },
            "signals": {
                "low_ctr_queries": low_ctr_queries,
                "striking_distance": striking_distance,
                "declining_queries": declining_queries[:10],
                "low_ctr_pages": low_ctr_pages,
                "cannibalization": cannib_list,
                "serp_feature_loss": serp_feature_loss
            },
            "limits": {
                "max_items_per_signal": 10,
                "language": "en",
                "tone": "simple"
            }
        }
        schema = {
            "type": "object",
            "properties": {
                "quick_summary": {"type": "string"},
                "prioritized_findings": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "severity": {"type": "string"},
                            "audience_note": {"type": "string"},
                            "evidence": {"type": "string"},
                            "why_it_matters": {"type": "string"},
                            "actions": {"type": "array", "items": {"type": "string"}},
                            "effort": {"type": "string"}
                        }
                    }
                },
                "playbooks": {
                    "type": "object",
                    "properties": {
                        "title_meta_fixes": {"type": "array", "items": {"type": "object"}},
                        "consolidation": {"type": "array", "items": {"type": "object"}},
                        "refreshes": {"type": "array", "items": {"type": "object"}},
                        "internal_linking": {"type": "array", "items": {"type": "object"}}
                    }
                },
                "metrics": {"type": "object"}
            }
        }
        system_prompt = "You are an SEO assistant for non-technical creators. Use simple language and concrete actions. Only use provided numbers. Return a single JSON object matching the schema."
        prompt = "Analyze the following GSC-derived signals and produce prioritized findings and playbooks.\n\n" + str(payload)
        ai = llm_text_gen(prompt=prompt, json_struct=schema, system_prompt=system_prompt, user_id=user_id)
        return {"success": True, "insights": ai}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI insights failed: {e}")
        return {"success": False, "error": str(e)}


@router.get("/cache/test")
async def test_cache_endpoint(current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Test endpoint to verify cache routes are working
    """
    return {
        "success": True,
        "message": "Cache endpoint is working",
        "user_id": current_user.get('id'),
        "timestamp": datetime.now().isoformat()
    }


@router.post("/cache/clear")
async def clear_analytics_cache(
    platform: Optional[str] = Query(None, description="Specific platform to clear cache for (optional)"),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Clear analytics cache for a user
    
    Args:
        platform: Specific platform to clear cache for (optional, clears all if None)
        current_user: Current authenticated user
        
    Returns:
        Cache clearing result
    """
    try:
        from datetime import datetime
        user_id = current_user.get('id')
        logger.info(f"Cache clear request received for user {user_id}, platform: {platform}")
        
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        if platform:
            # Clear cache for specific platform
            analytics_service.invalidate_platform_cache(user_id, platform)
            message = f"Cleared cache for {platform}"
        else:
            # Clear all cache for user
            analytics_service.invalidate_user_cache(user_id)
            message = "Cleared all analytics cache"
        
        logger.info(f"Cache cleared for user {user_id}: {message}")
        
        return {
            "success": True,
            "user_id": user_id,
            "platform": platform,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error clearing cache: {e}")
        raise HTTPException(status_code=500, detail=str(e))


