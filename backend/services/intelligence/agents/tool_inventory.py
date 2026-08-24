"""Inventory of tools registered with the agent team.

The inventory is intentionally explicit: a catalog description alone is not
evidence that a tool is production-ready.
"""

from __future__ import annotations

from typing import Any, Dict, List

from .tool_contracts import TOOL_CLASSIFICATIONS


def _tool(
    name: str,
    owner: str,
    classification: str,
    input_contract: str,
    output_contract: str,
    source: str,
    auth: str,
    failure: str,
    mutates: bool = False,
    real_provider_tested: bool = False,
) -> Dict[str, Any]:
    return {
        "tool_name": name,
        "agent_owner": owner,
        "classification": classification,
        "input_contract": input_contract,
        "output_contract": output_contract,
        "real_data_source": source,
        "authentication_requirement": auth,
        "failure_behavior": failure,
        "mutates_data": mutates,
        "tested_with_real_provider": real_provider_tested,
    }


AGENT_TOOL_INVENTORY: List[Dict[str, Any]] = [
    _tool("market_signal_detector", "strategy_orchestrator", "provider_dependent", "context dict", "tool result with market signals", "market signal providers", "provider configuration", "error result", real_provider_tested=False),
    _tool("google_trends_fetcher", "strategy_orchestrator", "provider_dependent", "keywords, timeframe, geo", "tool result with trend data", "Google Trends", "provider configuration", "error result", mutates=True),
    _tool("agent_coordinator", "strategy_orchestrator", "production_real", "optional context dict", "available agent roster", "in-memory orchestrator", "none", "empty roster"),
    _tool("performance_analyzer", "strategy_orchestrator", "provider_dependent", "optional context dict", "performance rows and derived recommendations", "AgentPerformanceMonitor", "workspace database", "error result"),
    _tool("kickoff_gsc_first_pass", "strategy_orchestrator", "provider_dependent", "start_date, end_date", "combined SEO/content plans", "GSC and specialized agents", "GSC/provider configuration", "error result"),
    _tool("strategy_synthesizer", "strategy_orchestrator", "provider_dependent", "strategy context", "grounded strategy synthesis", "onboarding context and LLM", "LLM configuration", "empty-state or digest fallback"),
    _tool("task_delegator", "strategy_orchestrator", "production_real", "agent_name, instruction, task_context", "delegated agent result", "in-memory agent roster", "none", "error result"),
    _tool("content_daily_proposals", "content_strategist", "provider_dependent", "grounding context", "grounded TaskProposal list", "ContentStrategyAgent services", "GSC/SIF/workspace providers", "empty proposal list or error result"),
    _tool("strategy_daily_proposals", "strategy_architect", "provider_dependent", "grounding context", "grounded TaskProposal list", "StrategyArchitectAgent SIF index", "SIF configuration", "empty proposal list or error result"),
    _tool("seo_daily_proposals", "seo_specialist", "provider_dependent", "grounding context", "grounded TaskProposal list", "SEOOptimizationAgent services", "SEO/SIF providers", "empty proposal list or error result"),
    _tool("social_daily_proposals", "social_media_manager", "provider_dependent", "grounding context", "grounded TaskProposal list", "SocialAmplificationAgent services", "social provider configuration", "empty proposal list or explicit unavailable result"),
    _tool("competitor_daily_proposals", "competitor_analyst", "provider_dependent", "grounding context", "grounded TaskProposal list", "CompetitorResponseAgent SIF index", "SIF configuration", "empty proposal list or error result"),
    _tool("content_gap_daily_proposals", "content_gap_radar", "provider_dependent", "grounding context", "grounded TaskProposal list", "ContentGapRadarAgent SIF/SEO sources", "SIF/SEO provider configuration", "empty proposal list or error result"),
    _tool("guardian_proposal_review", "content_guardian", "production_real", "normalized proposals", "Guardian decision list", "deterministic quality and safety checks", "none", "quarantine or reject result"),
    _tool("guardian_committee_audit", "content_guardian", "production_real", "committee proposal list", "health score and audit findings", "deterministic committee audit", "none", "structured audit error"),
    _tool("content_analyzer", "content_strategist", "provider_dependent", "target_url, date_range, competitor flag", "content analysis result with GSC, SIF, and asset evidence", "GSC/SIF/content asset library", "provider configuration and workspace database", "partial data or explicit unavailable result"),
    _tool("semantic_gap_detector", "content_strategist", "provider_dependent", "topics/context", "gap list with SIF evidence", "SIF", "SIF configuration", "explicit unavailable result"),
    _tool("content_optimizer", "content_strategist", "provider_dependent", "content, target_url, optimization goal", "LLM-generated content result with quality decision", "LLM and user input", "LLM configuration", "error or no-data result"),
    _tool("performance_tracker", "content_strategist", "provider_dependent", "date range, metrics", "performance summary", "PlatformAnalyticsService", "analytics provider configuration", "no-data or error result"),
    _tool("sitemap_analyzer", "content_strategist", "provider_dependent", "sitemap_url or website_url", "sitemap analysis", "SitemapService/ContentStrategyService", "website access", "unavailable result"),
    _tool("gsc_low_ctr_queries", "content_strategist", "provider_dependent", "date range, limit", "query rows with CTR evidence", "Google Search Console", "GSC OAuth", "unavailable result"),
    _tool("gsc_striking_distance_queries", "content_strategist", "provider_dependent", "position range, limit", "query rows with position evidence", "Google Search Console", "GSC OAuth", "unavailable result"),
    _tool("gsc_declining_queries", "content_strategist", "provider_dependent", "comparison range, limit", "period comparison rows", "Google Search Console", "GSC OAuth", "unavailable result"),
    _tool("gsc_low_ctr_pages", "content_strategist", "provider_dependent", "date range, limit", "page rows with CTR evidence", "Google Search Console", "GSC OAuth", "unavailable result"),
    _tool("gsc_cannibalization_candidates", "content_strategist", "provider_dependent", "limit", "query/page overlap rows", "Google Search Console", "GSC OAuth", "unavailable result"),
    _tool("default_content_gsc_plan", "content_strategist", "provider_dependent", "target URL, date range", "GSC-backed action plan", "Google Search Console", "GSC OAuth", "unavailable result"),
    _tool("competitor_monitor", "competitor_analyst", "unavailable", "competitor URL", "competitor changes", "SIF async analysis", "SIF", "explicit unavailable result"),
    _tool("threat_analyzer", "competitor_analyst", "unavailable", "focus area", "threat assessment", "SIF async analysis", "SIF", "explicit unavailable result"),
    _tool("seo_auditor", "seo_specialist", "unavailable", "website URL", "SEO audit", "SIF async analysis", "SIF", "explicit unavailable result"),
    _tool("keyword_researcher", "seo_specialist", "unavailable", "seed keywords/topic", "keyword opportunities", "SIF async analysis", "SIF", "explicit unavailable result"),
    _tool("on_page_optimizer", "seo_specialist", "unavailable", "content/page context", "optimization result", "async SEO service", "SEO provider", "explicit unavailable result"),
    _tool("technical_fixer", "seo_specialist", "unavailable", "issue ID", "technical fix result", "platform-specific service", "platform credentials", "explicit unavailable result"),
    _tool("social_monitor", "social_media_manager", "provider_dependent", "topics/platforms", "social trends or explicit unavailable result", "platform provider", "platform provider configuration", "explicit unavailable result"),
    _tool("content_adapter", "social_media_manager", "provider_dependent", "content/platform", "adapted content or explicit unavailable result", "LLM/platform rules", "LLM and platform configuration", "explicit unavailable result"),
    _tool("engagement_optimizer", "social_media_manager", "provider_dependent", "content", "optimization suggestions or explicit unavailable result", "platform analytics", "platform analytics configuration", "explicit unavailable result"),
    _tool("distribution_manager", "social_media_manager", "provider_dependent", "post content/schedule", "distribution plan or explicit unavailable result", "platform publishing provider", "platform credentials", "explicit unavailable result"),
]


def get_tool_health_report() -> Dict[str, Any]:
    from services.tool_certification import get_tool_certification_report

    counts = {classification: 0 for classification in TOOL_CLASSIFICATIONS}
    unknown = []
    for entry in AGENT_TOOL_INVENTORY:
        classification = entry.get("classification")
        if classification not in TOOL_CLASSIFICATIONS:
            unknown.append(entry.get("tool_name"))
        else:
            counts[classification] += 1
    certification = get_tool_certification_report(AGENT_TOOL_INVENTORY)
    return {
        "status": "healthy" if not unknown else "error",
        "total_tools": len(AGENT_TOOL_INVENTORY),
        "classification_counts": counts,
        "unknown_tools": unknown,
        "certification": certification,
        "production_real": certification["default_meeting_ready"],
        "tools": AGENT_TOOL_INVENTORY,
    }
