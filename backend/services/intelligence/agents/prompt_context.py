"""
Prompt context builder for ALwrity agents.

Builds a structured placeholder context from the raw integrated onboarding
data, plus a comma-joined variant for ``{placeholder}`` template substitution.
This is the single authoritative context used by:

  * AI-Optimize / Preview (agent personalization)
  * prompt template rendering (``{placeholder}`` substitution)
  * runtime agent prompts (``_load_prompt_context``)

``build_prompt_context`` returns **structured** values (lists for list fields,
strings for scalars) so consumers can select/format as needed;
``comma_join_context`` produces the flattened string variant used to render
catalog prompt templates.
"""

from typing import Dict, Any, List

from services.intelligence.pillar_context import extract_content_pillar_topics

# Fields that are lists of strings in the structured context.
_LIST_FIELDS = {
    "content_pillars",
    "competitors",
    "content_types",
    "connected_platforms",
    "business_goals",
    "permissible_tones",
    "forbidden_tones",
    "go_to_phrases",
    "go_to_words",
    "avoid_words",
    "preferred_formats",
    "content_topics",
    "engagement_goals",
}

# List fields that keep more items when flattened (richer persona detail).
_LONG_LIST_FIELDS = {"go_to_phrases", "go_to_words", "avoid_words"}


def _str(value: Any) -> str:
    return str(value or "").strip()


def _list(value: Any) -> List[str]:
    """Normalize a string/dict/list of items into a flat list of strings."""
    if not value:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        value = [value]

    items: List[str] = []
    for item in value:
        if isinstance(item, str):
            items.append(_str(item))
        elif isinstance(item, dict):
            name = (
                item.get("name")
                or item.get("topic")
                or item.get("title")
                or item.get("domain")
                or item.get("competitor_domain")
                or item.get("url")
                or item.get("competitor_url")
                or ""
            )
            if name:
                items.append(_str(name))
        else:
            items.append(_str(item))

    return [i for i in items if i]


def _join(items: List[str], limit: int) -> str:
    if len(items) > limit:
        return ", ".join(items[:limit]) + f" (and {len(items) - limit} more)"
    return ", ".join(items)


def _scalar_text(value: Any) -> str:
    """Coerce a scalar or list-of-scalars into a single comma-joined string.

    Some onboarding fields (e.g. ``target_audience``, ``industry``) are stored
    as lists in the raw data but must render as one inline string inside
    ``{placeholder}`` templates. Lists are flattened here instead of leaking a
    Python ``repr`` (``['a', 'b']``) into the prompt.
    """
    if isinstance(value, (list, tuple)):
        return _join([_str(v) for v in value], 10)
    return _str(value)


def build_prompt_context(integrated: Dict[str, Any]) -> Dict[str, Any]:
    """Build the full structured prompt context from integrated onboarding data.

    Pulls the richest available value for each field directly from the raw
    sources (website analysis, research preferences, persona, competitor
    analysis, platform integrations) rather than relying on the flattened
    canonical profile, so step-2 SIF insights and the full persona survive.
    """
    website = integrated.get("website_analysis") or {}
    research = integrated.get("research_preferences") or {}
    persona = integrated.get("persona_data") or {}
    competitor_analysis = integrated.get("competitor_analysis") or []
    platforms = integrated.get("platform_integrations") or {}
    linkedin = integrated.get("linkedin_profile") or {}
    canonical = integrated.get("canonical_profile") or {}

    core = persona.get("core_persona") or persona.get("corePersona") or {}
    identity = core.get("identity") or {}
    tonal = core.get("tonal_range") or {}
    linguistic = core.get("linguistic_fingerprint") or {}
    lexical = linguistic.get("lexical_features") or {}

    # ── Website identity ────────────────────────────────────────────
    website_url = _str(
        website.get("website_url")
        or website.get("website")
        or canonical.get("website_url")
        or canonical.get("website")
    )
    domain = _str(website.get("domain") or canonical.get("domain"))
    website_name = domain.split(".")[0] if domain else ""
    if not website_name and website_url:
        try:
            from urllib.parse import urlparse
            host = urlparse(website_url).hostname or ""
            host = host.replace("www.", "")
            website_name = host.split(".")[0].strip() or host
        except Exception:
            website_name = ""
    if not website_name:
        website_name = _str(linkedin.get("name")) or "Your"

    # ── Content pillars (step-2 SIF insights first) ─────────────────
    style_analysis = website.get("style_analysis") or {}
    strategy_insights = style_analysis.get("content_strategy_insights") or {}
    sitemap_analysis = style_analysis.get("sitemap_analysis") or {}
    content_pillars_value = (
        strategy_insights.get("content_pillars")
        or sitemap_analysis.get("content_pillars")
        or canonical.get("content_pillars")
        or research.get("content_pillars")
        or []
    )

    # ── Competitors (step-2 discovered competitors first) ───────────
    competitor_names = list(competitor_analysis or [])
    if not competitor_names:
        competitor_names = list(canonical.get("competitors") or research.get("competitors") or [])

    # ── Target audience / industry (explicit research choice wins) ──
    research_target = research.get("target_audience") or {}
    website_target = website.get("target_audience") or {}
    if not isinstance(research_target, dict):
        research_target = {}
    if not isinstance(website_target, dict):
        website_target = {}

    target_audience = (
        research_target.get("demographics")
        or research_target.get("target_audience")
        or website_target.get("demographics")
        or website_target.get("target_audience")
        or canonical.get("target_audience")
        or ""
    )
    industry = (
        research_target.get("industry_focus")
        or website_target.get("industry_focus")
        or canonical.get("industry")
        or ""
    )

    # ── Style guidelines / SEO (structured step-2 outputs) ──────────
    style_guidelines = website.get("style_guidelines") or {}
    if isinstance(style_guidelines, dict):
        aesthetic = _str(style_guidelines.get("aesthetic"))
        visual = _str(style_guidelines.get("visual_style"))
        style_guidelines_text = "; ".join(x for x in (aesthetic, visual) if x)
        if not style_guidelines_text:
            style_guidelines_text = _str(website.get("writing_style"))
    else:
        style_guidelines_text = _str(style_guidelines)

    seo_audit = website.get("seo_audit") or {}
    seo_summary = ""
    if isinstance(seo_audit, dict):
        overall = seo_audit.get("overall_score")
        summary = seo_audit.get("summary")
        seo_summary = _str(summary if overall in (None, "", 0) else overall)

    writing_style = canonical.get("writing_style") or {}
    writing_tone = _str(writing_style.get("tone")) if isinstance(writing_style, dict) else ""
    writing_voice = _str(writing_style.get("voice")) if isinstance(writing_style, dict) else ""

    # ── Posting cadence (fallback chain: research → persona platform personas → platforms) ──
    posting_cadence = _resolve_posting_cadence(research, persona, platforms)

    # ── P2.x: SMM agent rich fields from flat store / integrated data ────────────────
    growth_summary = _build_growth_summary(research, competitor_analysis, platforms)
    preferred_formats = _list(research.get("preferred_formats") or research.get("content_types") or [])
    content_topics = extract_content_pillar_topics(content_pillars_value)
    engagement_goals = _build_engagement_goals(persona, research)

    # ── P3.x: Business goals from multiple sources ─────────────────────────────────
    business_goals = _resolve_business_goals(canonical, research, persona)

    return {
        "website_name": website_name,
        "website_url": website_url,
        "domain": domain,
        "industry": _scalar_text(industry),
        "brand_voice": _str(identity.get("brand_voice_description") or canonical.get("brand_voice")),
        "target_audience": _scalar_text(target_audience),
        "content_pillars": content_topics,
        "competitors": _list(competitor_names),
        "research_depth": _str(research.get("research_depth")),
        "content_types": _list(research.get("content_types")),
        "connected_platforms": _list(platforms.get("connected_platforms")),
        "posting_cadence": posting_cadence,
        "business_goals": business_goals,
        "persona_name": _str(identity.get("persona_name")),
        "archetype": _str(identity.get("archetype")),
        "core_belief": _str(identity.get("core_belief")),
        "default_tone": _str(tonal.get("default_tone")),
        "permissible_tones": _list(tonal.get("permissible_tones")),
        "forbidden_tones": _list(tonal.get("forbidden_tones")),
        "go_to_phrases": _list(lexical.get("go_to_phrases")),
        "go_to_words": _list(lexical.get("go_to_words")),
        "avoid_words": _list(lexical.get("avoid_words") or lexical.get("avoid_phrases")),
        "style_guidelines": style_guidelines_text,
        "seo_summary": seo_summary,
        "writing_tone": writing_tone,
        "writing_voice": writing_voice,
        # P2.x: SMM agent rich fields
        "growth_summary": growth_summary,
        "preferred_formats": preferred_formats,
        "content_topics": content_topics,
        "engagement_goals": engagement_goals,
    }


def _resolve_posting_cadence(
    research: Dict[str, Any],
    persona: Dict[str, Any],
    platforms: Dict[str, Any],
) -> str:
    """Resolve posting cadence from multiple sources (fallback chain).

    Priority:
    1. research.posting_cadence (direct field)
    2. research.recommended_settings.posting_cadence / posting_frequency
    3. persona.platform_personas[].engagement_patterns.posting_frequency
    4. platforms.postingCadence / posting_cadence
    """
    # 1. Direct research field (tests + future producer)
    direct = research.get("posting_cadence") if isinstance(research, dict) else None
    if direct:
        return _str(direct)

    # 2. Recommended settings (step-3 style detection)
    recommended = research.get("recommended_settings") if isinstance(research, dict) else {}
    if isinstance(recommended, dict):
        for key in ("posting_cadence", "posting_frequency", "cadence"):
            val = recommended.get(key)
            if val:
                return _str(val)

    # 3. Step-4 platform personas (richest real source)
    platform_personas = persona.get("platform_personas") or persona.get("platformPersonas") or {}
    if isinstance(platform_personas, dict):
        for platform, persona_data in platform_personas.items():
            if isinstance(persona_data, dict):
                engagement = persona_data.get("engagement_patterns") or {}
                freq = engagement.get("posting_frequency")
                if freq:
                    return _str(freq)

    # 4. Step-5 platform integrations (LinkedIn session payload)
    for key in ("postingCadence", "posting_cadence", "cadence"):
        val = platforms.get(key)
        if val:
            return _str(val)

    return ""


def _build_growth_summary(
    research: Dict[str, Any],
    competitor_analysis: List[Dict[str, Any]],
    platforms: Dict[str, Any],
) -> str:
    """Build growth summary from research, competitors, and platform data."""
    parts = []

    if research:
        research_depth = research.get("research_depth")
        if research_depth:
            parts.append(f"Research depth: {research_depth}")

        auto_research = research.get("auto_research")
        if auto_research is not None:
            parts.append("Auto-research enabled" if auto_research else "Auto-research disabled")

    if competitor_analysis:
        competitor_count = len(competitor_analysis) if isinstance(competitor_analysis, list) else 0
        if competitor_count:
            parts.append(f"Tracking {competitor_count} competitors")

    if platforms:
        connected = platforms.get("connected_platforms") or []
        if isinstance(connected, list) and connected:
            parts.append(f"Connected platforms: {', '.join(connected)}")

    return "; ".join(parts) if parts else ""


def _build_engagement_goals(
    persona: Dict[str, Any],
    research: Dict[str, Any],
) -> List[str]:
    """Build engagement goals from persona and research data."""
    goals = []

    if persona:
        core_persona = persona.get("core_persona") or persona.get("corePersona") or {}
        primary_goal = core_persona.get("primary_goal") or core_persona.get("goal")
        if primary_goal:
            goals.append(str(primary_goal))

        platform_personas = persona.get("platform_personas") or persona.get("platformPersonas") or {}
        if isinstance(platform_personas, dict):
            for platform, p_data in platform_personas.items():
                if isinstance(p_data, dict):
                    eng = p_data.get("engagement_patterns") or {}
                    goal = eng.get("primary_goal") or eng.get("engagement_goal")
                    if goal and goal not in goals:
                        goals.append(str(goal))

    if research:
        content_goals = research.get("engagement_goals") or research.get("content_goals")
        if isinstance(content_goals, list):
            for g in content_goals:
                if g and str(g) not in goals:
                    goals.append(str(g))

    return goals


def _resolve_business_goals(
    canonical: Dict[str, Any],
    research: Dict[str, Any],
    persona: Dict[str, Any],
) -> List[str]:
    """Resolve business goals from multiple sources (fallback chain).

    Priority:
    1. canonical.business_goals (canonical profile)
    2. research.business_goals (research preferences)
    3. persona.core_persona.primary_goal (persona goal)
    """
    goals: List[str] = []

    # 1. Canonical profile business_goals
    canonical_goals = canonical.get("business_goals") if isinstance(canonical, dict) else None
    if canonical_goals:
        goals.extend(_list(canonical_goals))

    # 2. Research preferences business_goals
    if not goals and isinstance(research, dict):
        research_goals = research.get("business_goals")
        if research_goals:
            goals.extend(_list(research_goals))

    # 3. Persona core_persona primary_goal as fallback
    if not goals and isinstance(persona, dict):
        core_persona = persona.get("core_persona") or persona.get("corePersona") or {}
        primary_goal = core_persona.get("primary_goal") or core_persona.get("goal")
        if primary_goal:
            goals.append(str(primary_goal))

    return goals


def comma_join_context(
    context: Dict[str, Any],
    default_limit: int = 10,
    long_limit: int = 20,
) -> Dict[str, str]:
    """Return a copy of ``context`` with list fields flattened to comma-joined strings.

    Scalar (string) fields are passed through unchanged. Used to render catalog
    prompt templates where ``{content_pillars}`` must inline as text.
    """
    out: Dict[str, str] = {}
    for key, value in context.items():
        if key in _LIST_FIELDS and isinstance(value, list):
            limit = long_limit if key in _LONG_LIST_FIELDS else default_limit
            out[key] = _join(value, limit)
        else:
            out[key] = _str(value)
    return out


# Fields always relevant to every agent (brand identity).
_ALWAYS_FIELDS: List[str] = ["website_name"]

# Per-agent relevance map: only the fields each role's prompt actually uses.
# Keeps personalization hyper-relevant without stuffing unrelated context.
_AGENT_CONTEXT_FIELDS: Dict[str, List[str]] = {
    "strategy_orchestrator": ["industry", "brand_voice", "target_audience", "content_pillars", "competitors", "business_goals"],
    "strategy_architect": ["industry", "brand_voice", "target_audience", "content_pillars", "competitors", "business_goals"],
    "content_strategist": ["brand_voice", "target_audience", "content_pillars", "content_types", "research_depth", "style_guidelines", "business_goals", "default_tone"],
    "competitor_analyst": ["brand_voice", "target_audience", "competitors", "content_pillars", "industry", "business_goals"],
    "seo_specialist": ["website_url", "brand_voice", "target_audience", "industry", "content_pillars", "seo_summary", "research_depth"],
    "social_media_manager": ["connected_platforms", "brand_voice", "target_audience", "content_types", "posting_cadence", "business_goals", "growth_summary", "preferred_formats", "content_topics", "engagement_goals"],
    "content_guardian": ["brand_voice", "target_audience", "forbidden_tones", "avoid_words", "default_tone"],
    "trend_surfer": ["industry", "content_pillars", "target_audience", "content_types"],
    "content_gap_radar": ["content_pillars", "competitors", "industry", "target_audience", "seo_summary"],
}

# Fallback for unknown agent keys.
_DEFAULT_FIELDS: List[str] = ["brand_voice", "target_audience", "content_pillars", "industry", "competitors"]


def select_agent_context(agent_key: str, context: Dict[str, Any]) -> Dict[str, Any]:
    """Return only the role-relevant subset of ``context`` for ``agent_key``.

    Always includes brand identity (``website_name``), then the fields mapped to
    that agent's role. Empty values (``""``, ``[]``, ``None``) are omitted so the
    LLM never receives blank or fabricated context.
    """
    fields = _ALWAYS_FIELDS + _AGENT_CONTEXT_FIELDS.get(agent_key, _DEFAULT_FIELDS)
    selected: Dict[str, Any] = {}
    for field in fields:
        value = context.get(field)
        if value:
            selected[field] = value
    return selected


# Human-readable labels for the concise "Relevant context" block.
_FIELD_LABELS: Dict[str, str] = {
    "website_name": "Website name",
    "website_url": "Website URL",
    "domain": "Domain",
    "industry": "Industry",
    "brand_voice": "Brand voice",
    "target_audience": "Target audience",
    "content_pillars": "Content pillars",
    "competitors": "Competitors",
    "research_depth": "Research depth",
    "content_types": "Content types",
    "connected_platforms": "Connected platforms",
    "posting_cadence": "Posting cadence",
    "business_goals": "Business goals",
    "persona_name": "Persona name",
    "archetype": "Archetype",
    "core_belief": "Core belief",
    "default_tone": "Default tone",
    "permissible_tones": "Permissible tones",
    "forbidden_tones": "Forbidden tones",
    "go_to_phrases": "Go-to phrases",
    "go_to_words": "Go-to words",
    "avoid_words": "Words to avoid",
    "style_guidelines": "Style guidelines",
    "seo_summary": "SEO summary",
    "growth_summary": "Growth summary",
    "preferred_formats": "Preferred formats",
    "content_topics": "Content topics",
    "engagement_goals": "Engagement goals",
    "profile_name": "Profile name",
    "profile_url": "Profile URL",
}


def format_context(context: Dict[str, Any]) -> str:
    """Render a selected context as concise, labeled lines for an LLM prompt.

    List fields are comma-joined; empty fields are omitted. Produces a compact
    block (not a raw JSON dump) to keep prompts lean.
    """
    flat = comma_join_context(context)
    lines: List[str] = []
    for key, value in flat.items():
        if not value:
            continue
        label = _FIELD_LABELS.get(key, key.replace("_", " ").title())
        lines.append(f"- {label}: {value}")
    return "\n".join(lines)
