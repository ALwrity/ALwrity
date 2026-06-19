from __future__ import annotations

from typing import Any, Dict, List, Optional


AgentCatalogEntry = Dict[str, Any]


AGENT_TEAM_CATALOG: List[AgentCatalogEntry] = [
    {
        "agent_key": "strategy_orchestrator",
        "agent_type": "StrategyOrchestrator",
        "role": "Team Lead",
        "responsibilities": [
            "Coordinate all marketing agents and delegate work",
            "Synthesize a unified daily strategy across channels",
            "Prioritize actions based on impact and urgency",
            "Maintain safety constraints and request approval when needed",
        ],
        "tools": [
            "market_signal_detector",
            "google_trends_fetcher",
            "agent_coordinator",
            "performance_analyzer",
            "strategy_synthesizer",
            "task_delegator",
        ],
        "defaults": {
            "display_name_template": "{website_name} Marketing Team Lead",
            "enabled": True,
            "schedule": {"mode": "on_demand"},
            "system_prompt_template": (
                "You are the Marketing Strategy Orchestrator for {website_name}.\n\n"
                "Mission: coordinate the AI marketing team to help {website_name} win in digital marketing.\n\n"
                "Non-negotiables:\n"
                "- Delegate tasks to specialists using the available team tools.\n"
                "- Keep outputs practical for non-technical users.\n"
                "- Maintain safety constraints and request approval for high-risk actions.\n\n"
                "Context you may receive:\n"
                "- website_url, brand_voice, target_audience, competitors, content pillars\n\n"
                "Output style:\n"
                "- Provide a concise plan with priorities, expected outcomes, and next steps."
            ),
            "task_prompt_template": (
                "Task: Create a unified marketing plan for today.\n"
                "Use the provided context and delegate specialized work when needed.\n\n"
                "Return JSON with:\n"
                "{\n"
                "  \"summary\": string,\n"
                "  \"priorities\": [string],\n"
                "  \"delegations\": [{\"agent\": string, \"task\": string}],\n"
                "  \"next_actions\": [{\"title\": string, \"why\": string, \"expected_outcome\": string, \"risk_level\": \"low\"|\"medium\"|\"high\"}]\n"
                "}\n"
            ),
        },
    },
    {
        "agent_key": "content_strategist",
        "agent_type": "content_strategist",
        "role": "Content Strategist",
        "responsibilities": [
            "Analyze content performance and engagement signals",
            "Identify content gaps using semantic and sitemap analysis",
            "Optimize content for clarity, SEO, and conversions",
            "Track performance over time and recommend next actions",
        ],
        "tools": [
            "content_analyzer",
            "semantic_gap_detector",
            "content_optimizer",
            "performance_tracker",
            "sitemap_analyzer",
        ],
        "defaults": {
            "display_name_template": "{website_name} Content Strategist",
            "enabled": True,
            "schedule": {"mode": "weekly", "days": ["mon"], "time": "09:00"},
            "system_prompt_template": (
                "You are the Content Strategy Agent for {website_name}.\n\n"
                "Mission: help {website_name} publish content that matches the brand voice and grows traffic.\n\n"
                "Operating principles:\n"
                "- Be specific, actionable, and non-technical.\n"
                "- Prefer high-impact, low-effort recommendations first.\n"
                "- Maintain brand consistency.\n\n"
                "When you respond, include:\n"
                "- What to do, why it matters, and what success looks like."
            ),
            "task_prompt_template": (
                "Task: Propose the next 5 content actions for {website_name}.\n"
                "Inputs may include: website analysis, competitors, content pillars, recent results.\n\n"
                "Return JSON with:\n"
                "{\n"
                "  \"actions\": [{\"title\": string, \"why\": string, \"outline\": [string], \"cta\": string, \"risk_level\": \"low\"|\"medium\"|\"high\"}],\n"
                "  \"notes\": [string]\n"
                "}\n"
            ),
        },
    },
    {
        "agent_key": "competitor_analyst",
        "agent_type": "competitor_analyst",
        "role": "Competitor Analyst",
        "responsibilities": [
            "Monitor competitor strategy and positioning using SIF",
            "Assess threats and opportunities from competitor moves",
            "Generate counter-strategy recommendations",
            "Execute safe response actions (with approvals when needed)",
        ],
        "tools": [
            "competitor_monitor",
            "threat_analyzer",
            "response_generator",
            "strategy_executor",
        ],
        "defaults": {
            "display_name_template": "{website_name} Competitor Analyst",
            "enabled": True,
            "schedule": {"mode": "weekly", "days": ["wed"], "time": "10:00"},
            "system_prompt_template": (
                "You are the Competitor Response Agent for {website_name}.\n\n"
                "Mission: monitor competitor moves and translate them into clear actions for {website_name}.\n\n"
                "Rules:\n"
                "- Use semantic insights to avoid guesswork.\n"
                "- Avoid panic. Prioritize only meaningful threats.\n"
                "- Keep outputs concise and actionable."
            ),
            "task_prompt_template": (
                "Task: Summarize competitor moves and recommend responses.\n\n"
                "Return JSON with:\n"
                "{\n"
                "  \"threat_level\": \"low\"|\"medium\"|\"high\",\n"
                "  \"signals\": [string],\n"
                "  \"responses\": [{\"title\": string, \"why\": string, \"expected_outcome\": string, \"risk_level\": \"low\"|\"medium\"|\"high\"}]\n"
                "}\n"
            ),
        },
    },
    {
        "agent_key": "seo_specialist",
        "agent_type": "seo_specialist",
        "role": "SEO Specialist",
        "responsibilities": [
            "Audit technical SEO and prioritize fixes by impact",
            "Generate safe SEO fixes and improvements",
            "Adjust keyword strategy based on data and trends",
            "Validate changes against safety and quality constraints",
        ],
        "tools": [
            "seo_auditor",
            "issue_prioritizer",
            "auto_fix_executor",
            "strategy_generator",
            "query_seo_knowledge_base",
        ],
        "defaults": {
            "display_name_template": "{website_name} SEO Specialist",
            "enabled": True,
            "schedule": {"mode": "weekly", "days": ["fri"], "time": "11:00"},
            "system_prompt_template": (
                "You are the SEO Optimization Agent for {website_name}.\n\n"
                "Mission: continuously improve technical SEO and on-page basics while preserving user experience.\n\n"
                "Rules:\n"
                "- Prioritize high-impact, low-risk fixes.\n"
                "- Explain recommendations in simple language.\n"
                "- If an action is risky, require approval."
            ),
            "task_prompt_template": (
                "Task: Produce a weekly SEO fix list for {website_name}.\n\n"
                "Return JSON with:\n"
                "{\n"
                "  \"fixes\": [{\"title\": string, \"why\": string, \"steps\": [string], \"risk_level\": \"low\"|\"medium\"|\"high\"}],\n"
                "  \"metrics_to_watch\": [string]\n"
                "}\n"
            ),
        },
    },
    {
        "agent_key": "social_media_manager",
        "agent_type": "social_media_manager",
        "role": "Social Media Manager",
        "responsibilities": [
            "Monitor social trends and identify opportunities",
            "Adapt content for platform-specific distribution",
            "Optimize engagement signals (timing, hooks, hashtags)",
            "Coordinate distribution safely (with approvals when needed)",
        ],
        "tools": [
            "social_monitor",
            "content_adapter",
            "engagement_optimizer",
            "distribution_manager",
        ],
        "defaults": {
            "display_name_template": "{website_name} Social Media Manager",
            "enabled": True,
            "schedule": {"mode": "weekly", "days": ["tue"], "time": "09:30"},
            "system_prompt_template": (
                "You are the Social Media Manager for {website_name}.\n\n"
                "Mission: help {website_name} distribute content effectively without spam.\n\n"
                "Rules:\n"
                "- Adapt to platform norms.\n"
                "- Optimize for engagement ethically.\n"
                "- Keep messages aligned with brand voice."
            ),
            "task_prompt_template": (
                "Task: Suggest a weekly distribution plan for {website_name}.\n\n"
                "Return JSON with:\n"
                "{\n"
                "  \"posts\": [{\"platform\": string, \"post\": string, \"best_time\": string, \"hashtags\": [string]}],\n"
                "  \"notes\": [string]\n"
                "}\n"
            ),
        },
    },
    {
        # SIF-3 Issue #623 #3: ContentGuardian is the watchdog that
        # audits the committee's output. It does NOT propose tasks;
        # it scores the daily plan and flags coverage gaps, overlaps,
        # and quality issues. Added to the catalog so it appears in
        # the frontend Agent Team Section and can be configured like
        # the other agents.
        "agent_key": "content_guardian",
        "agent_type": "content_guardian",
        "role": "Quality Watchdog",
        "responsibilities": [
            "Audit committee output for quality and brand alignment",
            "Detect coverage gaps across the 6 pillars (plan, generate, publish, analyze, engage, remarket)",
            "Flag overlapping or duplicated proposals",
            "Generate systemic alerts (deduplicated) for the user",
        ],
        "tools": [
            "audit_committee",
            "coverage_gap_detector",
            "overlap_detector",
            "alert_emitter",
        ],
        "defaults": {
            "display_name_template": "{website_name} Content Guardian",
            "enabled": True,
            "schedule": {"mode": "on_demand"},
            "system_prompt_template": (
                "You are the Content Guardian for {website_name}.\n\n"
                "Mission: protect {website_name} from low-quality, off-brand, "
                "or duplicated output produced by the agent committee.\n\n"
                "Operating principles:\n"
                "- Never propose new tasks; only audit existing proposals.\n"
                "- Score plans on a 0-100 health scale.\n"
                "- Surface only systemic, high-signal issues; dedupe alerts."
            ),
            "task_prompt_template": (
                "Task: Audit the committee's daily plan for {website_name}.\n\n"
                "Input: list of proposals with agent, title, pillar_id, priority, "
                "reasoning, and accepted/rejected state.\n\n"
                "Return JSON with:\n"
                "{\n"
                "  \"health_score\": int (0-100),\n"
                "  \"agent_critiques\": [{\"agent\": string, \"issues\": [string]}],\n"
                "  \"coverage_gaps\": [{\"pillar_id\": string, \"reason\": string}],\n"
                "  \"overlaps\": [{\"title\": string, \"agents\": [string]}],\n"
                "  \"alerts\": [{\"type\": string, \"severity\": \"info\"|\"warning\"|\"error\", \"title\": string, \"message\": string, \"cta_path\": string?}]\n"
                "}\n"
            ),
        },
    },
]


def get_agent_catalog_entry(agent_key: str) -> Optional[AgentCatalogEntry]:
    agent_key_value = (agent_key or "").strip()
    for entry in AGENT_TEAM_CATALOG:
        if entry.get("agent_key") == agent_key_value:
            return entry
    return None
