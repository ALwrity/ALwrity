"""
Scheduler Dashboard — Constants and Registries
=============================================

Houses the `TASK_DISPLAY_INFO` registry (M2) and the
`_per_user_stats_to_response` helper (M6). These are extracted from
`scheduler_dashboard.py` so the main module doesn't carry every
display string and per-user stat shape.
"""

from typing import Dict, Any, Optional

# M2: TASK_DISPLAY_INFO is the source-of-truth mapping from internal
# task_type strings (used in DB columns and metadata) to the
# human-readable labels, descriptions, and frequencies that the
# dashboard surfaces. The previous implementation had this inline in
# `scheduler_dashboard.py`; here it's a proper registry with a
# lookup helper and an add-entry API for future task types.
TASK_DISPLAY_INFO: Dict[str, Dict[str, str]] = {
    "onboarding_full_website_analysis": {
        "label": "Full-Site SEO Audit",
        "description": "Crawls your entire website and generates per-page SEO audit results.",
        "frequency": "One-time",
    },
    "deep_competitor_analysis": {
        "label": "Deep Competitor Analysis",
        "description": "Analyzes competitors' content strategy, keywords, and positioning.",
        "frequency": "Weekly (strategic insights) or One-time",
    },
    "sif_indexing": {
        "label": "SIF Content Indexing",
        "description": "Indexes your website content into the Semantic Intelligence Framework for agent-powered recommendations.",
        "frequency": "Every 48 hours",
    },
    "market_trends": {
        "label": "Market Trends",
        "description": "Monitors search trends and surfaces high-impact content opportunities.",
        "frequency": "Every 72 hours",
    },
    "advertools": {
        "label": "Advertools Analysis",
        "description": "Runs brand analysis and site health audits using Advertools.",
        "frequency": "Weekly",
    },
    "oauth_token_monitoring": {
        "label": "OAuth Token Health",
        "description": "Monitors and refreshes OAuth tokens for connected platforms (GSC, Bing, WordPress, Wix).",
        "frequency": "Weekly",
    },
    "website_analysis": {
        "label": "Website Analysis",
        "description": "Periodically re-crawls your website and updates style analysis, content pillars, and SEO data.",
        "frequency": "Every 10 days",
    },
    "gsc_insights": {
        "label": "Google Search Console Insights",
        "description": "Pulls search performance data from Google Search Console.",
        "frequency": "Weekly",
    },
    "bing_insights": {
        "label": "Bing Insights",
        "description": "Pulls search performance data from Bing Webmaster Tools.",
        "frequency": "Weekly",
    },
    "deep_website_crawl": {
        "label": "Deep Website Crawl",
        "description": "Performs deep crawl of your website for technical SEO issues.",
        "frequency": "Weekly",
    },
    "platform_insights": {
        "label": "Platform Insights",
        "description": "Aggregates search performance data from connected platforms.",
        "frequency": "Weekly",
    },
}


def get_task_display_info(task_type: str) -> Dict[str, str]:
    """Look up display info for a task type. Falls back to sensible
    defaults so a new task type that hasn't been registered doesn't
    crash the dashboard — it just shows a generic label.
    """
    fallback = {
        "label": task_type.replace("_", " ").title() if task_type else "Task",
        "description": "",
        "frequency": "Periodic",
    }
    info = TASK_DISPLAY_INFO.get(task_type)
    if not info:
        return fallback
    return {**fallback, **info}


def register_task_display_info(
    task_type: str,
    label: str,
    description: str = "",
    frequency: str = "Periodic",
) -> None:
    """M2: register a new task type's display info. Callers (e.g., a
    new executor or task type) can extend the registry at runtime
    without editing this module.
    """
    TASK_DISPLAY_INFO[task_type] = {
        "label": label,
        "description": description,
        "frequency": frequency,
    }


# M6: per-user stats shape exposed in API responses. The scheduler
# tracks per-user task execution counters in `self.stats["per_user_stats"]`;
# the API response mirrors those keys with safe defaults so a missing
# user (or older DB state) doesn't surface as None.
PER_USER_STATS_KEYS = ("tasks_executed", "tasks_failed", "last_update")


def format_per_user_stats(
    user_stats: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """Return a per-user stats dict with stable shape and zero defaults."""
    stats = user_stats or {}
    return {
        "tasks_executed": int(stats.get("tasks_executed", 0) or 0),
        "tasks_failed": int(stats.get("tasks_failed", 0) or 0),
        "last_update": stats.get("last_update"),
    }
