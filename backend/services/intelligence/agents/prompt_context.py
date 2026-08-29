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
    content_pillars = (
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

    return {
        "website_name": website_name,
        "website_url": website_url,
        "domain": domain,
        "industry": _str(industry),
        "brand_voice": _str(identity.get("brand_voice_description") or canonical.get("brand_voice")),
        "target_audience": _str(target_audience),
        "content_pillars": _list(content_pillars),
        "competitors": _list(competitor_names),
        "research_depth": _str(research.get("research_depth")),
        "content_types": _list(research.get("content_types")),
        "connected_platforms": _list(platforms.get("connected_platforms")),
        "posting_cadence": _str(research.get("posting_cadence")),
        "business_goals": _list(canonical.get("business_goals")),
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
    }


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
