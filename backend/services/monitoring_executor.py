import logging
import time
from typing import Dict, Any, Optional
from datetime import datetime

from services.monitoring_metrics import TOOL_REGISTRY, ALLOWED_METRICS

logger = logging.getLogger(__name__)

class MonitoringExecutor:
    def __init__(self):
        self.registry = TOOL_REGISTRY

    def is_executable(self, task: Dict[str, Any]) -> bool:
        if task.get("assignee") == "Human":
            return False
        metric = task.get("metric")
        if metric not in ALLOWED_METRICS:
            return False
        tool_path = task.get("measurementMethod") or task.get("tool")
        if not tool_path or tool_path == "manual.human_review":
            return False
        return tool_path in self.registry.values() or metric in self.registry

    async def execute_task(self, task: Dict[str, Any], strategy_data: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
        start = time.time()
        metric = task.get("metric")
        title = task.get("title", "unknown")
        if not self.is_executable(task):
            logger.info(f"Skipping non-executable task {title} metric={metric}")
            return {
                "status": "skipped",
                "metric": metric,
                "title": title,
                "reason": "Human task or unknown metric",
                "execution_time_ms": 0,
            }
        tool_path = self.registry.get(metric) or task.get("measurementMethod")
        try:
            result = await self._dispatch(tool_path, task, strategy_data, user_id)
            elapsed = int((time.time() - start) * 1000)
            logger.info(f"Executed monitoring task {title} metric={metric} in {elapsed}ms")
            return {
                "status": "success",
                "metric": metric,
                "title": title,
                "tool": tool_path,
                "result_data": result,
                "execution_time_ms": elapsed,
                "executed_at": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            elapsed = int((time.time() - start) * 1000)
            logger.error(f"Monitoring task {title} failed: {e}")
            return {
                "status": "failed",
                "metric": metric,
                "title": title,
                "tool": tool_path,
                "error_message": str(e),
                "execution_time_ms": elapsed,
                "executed_at": datetime.utcnow().isoformat(),
            }

    async def _dispatch(self, tool_path: str, task: Dict[str, Any], strategy_data: Dict[str, Any], user_id: Optional[str]) -> Dict[str, Any]:
        if "gsc_analyzer" in tool_path:
            return await self._exec_gsc_analyzer(task, strategy_data, user_id)
        if "serp_gap" in tool_path:
            return await self._exec_serp_gap(task, strategy_data, user_id)
        if "competitor_content" in tool_path:
            return await self._exec_competitor_content(task, strategy_data, user_id)
        if "sitemap_service" in tool_path:
            return await self._exec_sitemap(task, strategy_data, user_id)
        if "pagespeed" in tool_path:
            return await self._exec_pagespeed(task, strategy_data, user_id)
        if "gsc_service" in tool_path and "get_sitemaps" in tool_path:
            return await self._exec_gsc_sitemaps(task, strategy_data, user_id)
        if "monitoring_executor" in tool_path and "task_completion" in tool_path:
            return await self._exec_task_completion(task, strategy_data, user_id)
        return {"note": f"No dispatcher for {tool_path} — stubbed", "strategy_id": strategy_data.get("id")}

    async def _exec_gsc_analyzer(self, task, strategy_data, user_id):
        try:
            from services.seo_tools.gsc_analyzer_service import GSCAnalyzerService
            from services.gsc_service import GSCService
            gsc = GSCService()
            sites = gsc.get_site_list(str(user_id)) if user_id else []
            site_url = strategy_data.get("website_url") or strategy_data.get("website") or (sites[0]["siteUrl"] if sites else "https://example.com")
            svc = GSCAnalyzerService()
            return await svc.analyze_search_performance(site_url, date_range_days=30, user_id=str(user_id) if user_id else None)
        except Exception as e:
            return {"error": str(e), "stub": True}

    async def _exec_serp_gap(self, task, strategy_data, user_id):
        try:
            from services.seo_tools.serp_gap_service import SerpGapService
            svc = SerpGapService()
            topics = strategy_data.get("content_pillars", [])[:3] or ["content strategy"]
            competitors = strategy_data.get("competitive_analysis", {}).get("competitors", []) or ["example.com"]
            return await svc.analyze_topic_gaps(topics, competitors)
        except Exception as e:
            return {"error": str(e), "stub": True}

    async def _exec_competitor_content(self, task, strategy_data, user_id):
        try:
            from services.seo_tools.competitor_content_service import CompetitorContentService
            svc = CompetitorContentService()
            topics = strategy_data.get("content_pillars", [])[:3] or ["AI content"]
            competitors = strategy_data.get("competitive_analysis", {}).get("competitors", []) or ["example.com"]
            return await svc.deep_dive(topics, competitors)
        except Exception as e:
            return {"error": str(e), "stub": True}

    async def _exec_sitemap(self, task, strategy_data, user_id):
        try:
            from services.seo_tools.sitemap_service import SitemapService
            svc = SitemapService()
            url = strategy_data.get("website_url") or strategy_data.get("website") or "https://example.com/sitemap.xml"
            return await svc.analyze_sitemap(url, include_ai_insights=False, user_id=str(user_id) if user_id else None)
        except Exception as e:
            return {"error": str(e), "stub": True}

    async def _exec_pagespeed(self, task, strategy_data, user_id):
        try:
            from services.seo_tools.pagespeed_service import PageSpeedService
            svc = PageSpeedService()
            url = strategy_data.get("website_url") or "https://example.com"
            return await svc.analyze_pagespeed(url, strategy="DESKTOP", user_id=str(user_id) if user_id else None)
        except Exception as e:
            return {"error": str(e), "stub": True}

    async def _exec_gsc_sitemaps(self, task, strategy_data, user_id):
        try:
            from services.gsc_service import GSCService
            svc = GSCService()
            sites = svc.get_site_list(str(user_id)) if user_id else []
            site_url = strategy_data.get("website_url") or (sites[0]["siteUrl"] if sites else "https://example.com")
            return {"sitemaps": svc.get_sitemaps(str(user_id), site_url) if user_id else []}
        except Exception as e:
            return {"error": str(e), "stub": True}

    async def _exec_task_completion(self, task, strategy_data, user_id):
        strategy_id = strategy_data.get("id") or strategy_data.get("strategy_id")
        return {"strategy_id": strategy_id, "completion_rate": 0, "note": "stub - would query TaskExecutionLog"}
