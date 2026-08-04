"""
Task scheduling preferences — stores user task choices for Step 2 background tasks.

Preferences are stored in the user's OnboardingSession.step_data JSON field.
No schema migrations required.
"""

from typing import Any, Dict, Optional

# Default preferences — all tasks enabled, staggered delays
DEFAULT_TASK_PREFERENCES: Dict[str, Dict[str, Any]] = {
    "seo_audit": {"enabled": True, "label": "Full SEO Audit", "delay_mins": 5},
    "sif_indexing": {"enabled": True, "label": "Semantic Intelligence", "delay_mins": 0},
    "market_trends": {"enabled": True, "label": "Market Trends", "delay_mins": 10},
    "deep_competitor_analysis": {"enabled": True, "label": "Deep Competitor Analysis", "delay_mins": 5},
    "advertools_content": {"enabled": True, "label": "Content Audit", "delay_mins": 15},
    "advertools_health": {"enabled": True, "label": "Site Health", "delay_mins": 60},
    "website_analysis_tasks": {"enabled": True, "label": "Website Analysis Monitoring", "delay_mins": 5},
}

TASK_DESCRIPTIONS: Dict[str, str] = {
    "seo_audit": (
        "Page-by-page SEO health report covering meta tags, content quality, "
        "technical issues, accessibility, and performance across your entire site."
    ),
    "sif_indexing": (
        "Indexes your brand content into our AI engine. This is the foundation "
        "for all AI features — persona matching, trend detection, and content generation."
    ),
    "deep_competitor_analysis": (
        "AI-powered competitive intelligence. Analyzes your top competitors' content, "
        "SEO strategies, and publishing patterns to find content gaps and market "
        "opportunities you can exploit."
    ),
    "market_trends": (
        "Google Trends monitoring for your industry keywords. Builds a trend "
        "history that powers content recommendations and topic discovery."
    ),
    "advertools_content": (
        "Deep content audit: discovers themes, checks link health, finds redirect "
        "issues, analyzes image SEO, and evaluates crawl budget efficiency."
    ),
    "advertools_health": (
        "Content freshness scoring and publishing velocity analysis. Identifies "
        "stale content that needs updating and tracks your content cadence."
    ),
    "website_analysis_tasks": (
        "Sets up recurring website analysis. Your site is re-analyzed monthly; "
        "competitors are tracked every 10 days for competitive intelligence."
    ),
}


def apply_defaults(prefs: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Merge user preferences with defaults, returning complete preference dict."""
    result = {}
    for task_id, defaults in DEFAULT_TASK_PREFERENCES.items():
        user_choice = (prefs or {}).get(task_id, {})
        result[task_id] = {
            **defaults,
            **user_choice,  # user overrides win
        }
    return result


def get_task_delay_mins(task_id: str, prefs: Dict[str, Any]) -> int:
    """Get the delay in minutes for a task, or -1 if disabled."""
    task_pref = prefs.get(task_id, DEFAULT_TASK_PREFERENCES.get(task_id, {}))
    if not task_pref.get("enabled", True):
        return -1
    return int(task_pref.get("delay_mins", 5))


def get_task_label(task_id: str) -> str:
    """Get the display label for a task."""
    return DEFAULT_TASK_PREFERENCES.get(task_id, {}).get("label", task_id)


def get_task_description(task_id: str) -> str:
    """Get the description for a task."""
    return TASK_DESCRIPTIONS.get(task_id, "Background analysis task.")
