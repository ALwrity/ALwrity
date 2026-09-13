import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from services.monitoring_metrics import MetricKey, TOOL_REGISTRY

logger = logging.getLogger(__name__)

TASK_TEMPLATES: List[Dict[str, Any]] = [
    {
        "component": "Strategic Insights",
        "title": "GSC Visibility Check",
        "description": "Track search visibility via Google Search Console performance data",
        "assignee": "ALwrity",
        "frequency": "Weekly",
        "metric": MetricKey.GSC_VISIBILITY_SCORE.value,
        "tool": TOOL_REGISTRY[MetricKey.GSC_VISIBILITY_SCORE.value],
        "measurementMethod": TOOL_REGISTRY[MetricKey.GSC_VISIBILITY_SCORE.value],
        "successCriteria": "visibility_score > 65 and avg_position < 10",
        "alertThreshold": "visibility_score < 45 or avg_position > 20",
        "actionableInsights": "Top 3 opportunities from GSC content_opportunities",
        "presence": "gsc_connected",
    },
    {
        "component": "Strategic Insights",
        "title": "Goal Progress Tracker",
        "description": "Monitor strategy task completion rate from execution logs",
        "assignee": "ALwrity",
        "frequency": "Weekly",
        "metric": MetricKey.MONITORING_TASK_COMPLETION_RATE.value,
        "tool": TOOL_REGISTRY[MetricKey.MONITORING_TASK_COMPLETION_RATE.value],
        "measurementMethod": TOOL_REGISTRY[MetricKey.MONITORING_TASK_COMPLETION_RATE.value],
        "successCriteria": "completion_rate >= 80%",
        "alertThreshold": "completion_rate < 60%",
        "actionableInsights": "List overdue monitoring tasks",
        "presence": "always",
    },
    {
        "component": "Strategic Insights",
        "title": "Track Strategic Goal Achievement",
        "description": "Human review of progress toward business objectives",
        "assignee": "Human",
        "frequency": "Monthly",
        "metric": MetricKey.HUMAN_GOAL_ACHIEVEMENT.value,
        "tool": "manual.human_review",
        "measurementMethod": "manual.human_review",
        "successCriteria": "Achieve 80% of strategic goals",
        "alertThreshold": "Drop below 60% achievement",
        "actionableInsights": "Update business goals or content pillars",
        "presence": "always",
    },
    {
        "component": "Competitive Analysis",
        "title": "Competitor Content Freshness",
        "description": "Detect competitor content for gap topics via Exa",
        "assignee": "ALwrity",
        "frequency": "Weekly",
        "metric": MetricKey.COMPETITOR_CONTENT_COUNT.value,
        "tool": TOOL_REGISTRY[MetricKey.COMPETITOR_CONTENT_COUNT.value],
        "measurementMethod": TOOL_REGISTRY[MetricKey.COMPETITOR_CONTENT_COUNT.value],
        "successCriteria": "competitor_count <= 2 new pages/week",
        "alertThreshold": "competitor_count >= 5 new pages/week",
        "actionableInsights": "highlights per topic from competitor_content",
        "presence": "competitors_present",
    },
    {
        "component": "Competitive Analysis",
        "title": "SERP Share of Voice",
        "description": "Measure SERP presence via site: queries",
        "assignee": "ALwrity",
        "frequency": "Weekly",
        "metric": MetricKey.SERP_SHARE_OF_VOICE.value,
        "tool": TOOL_REGISTRY[MetricKey.SERP_SHARE_OF_VOICE.value],
        "measurementMethod": TOOL_REGISTRY[MetricKey.SERP_SHARE_OF_VOICE.value],
        "successCriteria": "rank_in_top_3 >= 3 keywords",
        "alertThreshold": "lost_top3 for 2 consecutive weeks",
        "actionableInsights": "snippet drift for gap topics",
        "presence": "competitors_present",
    },
    {
        "component": "Competitive Analysis",
        "title": "Validate Competitive Intelligence",
        "description": "Human review of competitor analysis accuracy",
        "assignee": "Human",
        "frequency": "Monthly",
        "metric": MetricKey.HUMAN_INTELLIGENCE_ACCURACY.value,
        "tool": "manual.human_review",
        "measurementMethod": "manual.human_review",
        "successCriteria": "Maintain 90%+ accuracy",
        "alertThreshold": "Drop below 80% accuracy",
        "actionableInsights": "Correct competitor list or positioning",
        "presence": "always",
    },
    {
        "component": "Performance Predictions",
        "title": "Prediction vs Actual",
        "description": "Compare predicted traffic growth vs GSC actual trend",
        "assignee": "ALwrity",
        "frequency": "Weekly",
        "metric": MetricKey.GSC_TREND_DELTA.value,
        "tool": TOOL_REGISTRY[MetricKey.GSC_TREND_DELTA.value],
        "measurementMethod": TOOL_REGISTRY[MetricKey.GSC_TREND_DELTA.value],
        "successCriteria": "prediction error < 15%",
        "alertThreshold": "prediction error > 30%",
        "actionableInsights": "Recalibrate performance_predictions",
        "presence": "gsc_connected",
    },
    {
        "component": "Performance Predictions",
        "title": "Review Prediction Insights",
        "description": "Human review of prediction business implications",
        "assignee": "Human",
        "frequency": "Monthly",
        "metric": MetricKey.HUMAN_INTELLIGENCE_ACCURACY.value,
        "tool": "manual.human_review",
        "measurementMethod": "manual.human_review",
        "successCriteria": "Generate actionable insights",
        "alertThreshold": "Insights become less actionable",
        "actionableInsights": "Update strategy forecasts",
        "presence": "always",
    },
    {
        "component": "Implementation Roadmap",
        "title": "Publishing Velocity",
        "description": "Track content publishing via sitemap analysis",
        "assignee": "ALwrity",
        "frequency": "Weekly",
        "metric": MetricKey.SITEMAP_PUBLISHING_VELOCITY.value,
        "tool": TOOL_REGISTRY[MetricKey.SITEMAP_PUBLISHING_VELOCITY.value],
        "measurementMethod": TOOL_REGISTRY[MetricKey.SITEMAP_PUBLISHING_VELOCITY.value],
        "successCriteria": "velocity >= roadmap phase target (0.3/d)",
        "alertThreshold": "velocity = 0 for 14 days",
        "actionableInsights": "publishing_patterns.trends",
        "presence": "sitemap_present",
    },
    {
        "component": "Implementation Roadmap",
        "title": "Review Implementation Effectiveness",
        "description": "Human review of implementation strategy effectiveness",
        "assignee": "Human",
        "frequency": "Monthly",
        "metric": MetricKey.HUMAN_IMPLEMENTATION_SUCCESS.value,
        "tool": "manual.human_review",
        "measurementMethod": "manual.human_review",
        "successCriteria": "Achieve 80%+ implementation success",
        "alertThreshold": "Drop below 60% success",
        "actionableInsights": "Adjust roadmap phases",
        "presence": "always",
    },
    {
        "component": "Risk Assessment",
        "title": "Technical Risk Score",
        "description": "Monitor PageSpeed and technical SEO signals",
        "assignee": "ALwrity",
        "frequency": "Weekly",
        "metric": MetricKey.PAGESPEED_PERFORMANCE_SCORE.value,
        "tool": TOOL_REGISTRY[MetricKey.PAGESPEED_PERFORMANCE_SCORE.value],
        "measurementMethod": TOOL_REGISTRY[MetricKey.PAGESPEED_PERFORMANCE_SCORE.value],
        "successCriteria": "performance_score > 80",
        "alertThreshold": "performance_score < 50 or critical_issues > 5",
        "actionableInsights": "Top PageSpeed opportunity title",
        "presence": "always",
    },
    {
        "component": "Risk Assessment",
        "title": "Index Health",
        "description": "Check sitemap index coverage via GSC",
        "assignee": "ALwrity",
        "frequency": "Weekly",
        "metric": MetricKey.SITEMAP_INDEX_COVERAGE.value,
        "tool": TOOL_REGISTRY[MetricKey.SITEMAP_INDEX_COVERAGE.value],
        "measurementMethod": TOOL_REGISTRY[MetricKey.SITEMAP_INDEX_COVERAGE.value],
        "successCriteria": "coverage > 95%",
        "alertThreshold": "404/403 count > 10",
        "actionableInsights": "sitemap fetch_stats.nested_skipped",
        "presence": "gsc_connected",
    },
    {
        "component": "Risk Assessment",
        "title": "Review Risk Management Decisions",
        "description": "Human review of risk management outcomes",
        "assignee": "Human",
        "frequency": "Monthly",
        "metric": MetricKey.HUMAN_RISK_MANAGEMENT.value,
        "tool": "manual.human_review",
        "measurementMethod": "manual.human_review",
        "successCriteria": "Maintain 85%+ risk management effectiveness",
        "alertThreshold": "Drop below 70% effectiveness",
        "actionableInsights": "Update mitigation strategies",
        "presence": "always",
    },
]

class DeterministicMonitoringFactory:
    def _presence_context(self, strategy_data: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, bool]:
        competitors = strategy_data.get("competitive_analysis", {}).get("competitors", []) or strategy_data.get("competitors", [])
        has_competitors = bool(competitors and len(competitors) > 0)
        seo_audit = strategy_data.get("seo_audit", {}) or strategy_data.get("strategic_insights", {})
        sitemap = strategy_data.get("sitemap_analysis") or seo_audit.get("sitemap_analysis")
        has_sitemap = bool(sitemap or strategy_data.get("website_url") or strategy_data.get("website") or strategy_data.get("sitemap_present"))
        gsc_connected = bool(strategy_data.get("gsc_connected") or strategy_data.get("gsc_verified") or strategy_data.get("has_gsc"))
        if user_id and not gsc_connected:
            try:
                from services.gsc_service import GSCService
                svc = GSCService()
                sites = svc.get_site_list(str(user_id))
                gsc_connected = bool(sites)
            except Exception:
                pass
        return {
            "always": True,
            "gsc_connected": gsc_connected,
            "competitors_present": has_competitors,
            "sitemap_present": has_sitemap if has_sitemap else True,
        }

    def build_plan(self, strategy_data: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
        presence = self._presence_context(strategy_data, user_id)
        monitoring_tasks: List[Dict[str, Any]] = []
        for tmpl in TASK_TEMPLATES:
            req = tmpl.get("presence", "always")
            if not presence.get(req, False):
                logger.info(f"Skipping task {tmpl['title']} missing presence {req}")
                continue
            task = {k: v for k, v in tmpl.items() if k not in ("tool", "presence")}
            task["tool"] = tmpl["tool"]
            monitoring_tasks.append(task)
        total = len(monitoring_tasks)
        alwrity = sum(1 for t in monitoring_tasks if t["assignee"] == "ALwrity")
        human = total - alwrity
        return {
            "monitoringTasks": monitoring_tasks,
            "totalTasks": total,
            "alwrityTasks": alwrity,
            "humanTasks": human,
            "metricsCount": total,
            "generatedAt": datetime.utcnow().isoformat(),
            "deterministic": True,
            "version": "2.0-deterministic",
        }

    def get_task_templates(self) -> List[Dict[str, Any]]:
        return [dict(t) for t in TASK_TEMPLATES]
