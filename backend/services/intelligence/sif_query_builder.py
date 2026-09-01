"""Contextual SIF query builder (Phase A of the SIF query quality work).

Composes semantic-index queries from the user's onboarding context
(grounding, or the AgentFlatContextStore documents via ``AgentContextVFS``)
instead of the hardcoded generic keyword bags the agents used before.

Contract:
- Context-rich grounding -> the query contains the user's own terms
  (industry, brand voice, content types, competitor domains, platforms).
- Thin/missing grounding (and no flat-context data either) -> the caller's
  legacy fallback string is returned UNCHANGED, so every call site keeps
  its previous behavior when no context exists.
- Deterministic: identical inputs produce identical queries, so the
  semantic cache can serve repeated queries within its TTL instead of
  logging a permanent ``miss`` for every slightly-different phrasing.

Per-agent selection plans map each committee agent to the context
categories that actually inform its proposals:

    strategy_architect      industry, content types
    seo_specialist          industry, content types, brand voice
    competitor_analyst      competitor domains, industry
    content_strategist      content types, industry, audience
    social_media_manager    platforms, content types, audience
    content_guardian        brand voice, writing tone, audience
    content_gap_radar       content types, industry, audience
    citation_expert         industry, content types

An intent suffix anchors each query to the agent's job so retrieval stays
topical even when the user context is sparse.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from loguru import logger

# Per-agent intent anchors: appended first so the query stays topical.
_AGENT_INTENTS: Dict[str, str] = {
    "strategy_architect": "content pillars strategy",
    "seo_specialist": "seo audit keywords metadata",
    "competitor_analyst": "competitor positioning pricing",
    "content_strategist": "content performance gaps",
    "social_media_manager": "social engagement amplification",
    "content_guardian": "brand voice style consistency",
    "content_gap_radar": "content gap opportunities",
    "citation_expert": "statistics citations evidence",
}

# Which context categories each agent's query should include, in
# priority order (earlier categories survive a small max_terms cap).
_AGENT_QUERY_PLAN: Dict[str, List[str]] = {
    "strategy_architect": ["industry", "content_types"],
    "seo_specialist": ["industry", "content_types", "brand_voice"],
    "competitor_analyst": ["competitors", "industry"],
    "content_strategist": ["content_types", "industry", "brand_voice", "audience"],
    "social_media_manager": ["platforms", "content_types", "audience"],
    "content_guardian": ["brand_voice", "writing_tone", "audience"],
    "content_gap_radar": ["content_types", "industry", "audience"],
    "citation_expert": ["industry", "content_types"],
}


def _clean(value: Any) -> str:
    """Normalize a scalar term: string, collapse whitespace, strip."""
    if value is None:
        return ""
    text = " ".join(str(value).split()).strip()
    return text


def _tokenize(value: Any) -> List[str]:
    """Turn a scalar/list/dict-ish value into clean query tokens."""
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        tokens: List[str] = []
        for item in value:
            tokens.extend(_tokenize(item))
        return tokens
    if isinstance(value, dict):
        tokens = []
        for key in ("name", "voice", "tone", "industry", "domain", "url", "platform"):
            if value.get(key):
                tokens.extend(_tokenize(value.get(key)))
        return tokens
    text = _clean(value)
    if not text:
        return []
    # Underscores/hyphens read better as words for embedding search.
    return [text.replace("_", " ").replace("-", " ").strip()]


def _domain_from_url(url: Any) -> str:
    text = _clean(url)
    if not text:
        return ""
    if "://" not in text and "." in text and " " not in text:
        return text.lower()
    try:
        host = urlparse(text).netloc or ""
    except Exception:
        host = ""
    host = host.lower().strip()
    if host.startswith("www."):
        host = host[4:]
    return host


def _context_terms(grounding: Optional[Dict[str, Any]]) -> Dict[str, List[str]]:
    """Extract query-relevant context categories from a grounding dict."""
    onboarding: Dict[str, Any] = {}
    if isinstance(grounding, dict):
        raw = grounding.get("onboarding_data")
        if isinstance(raw, dict):
            onboarding = raw

    canonical = onboarding.get("canonical_profile") if isinstance(onboarding.get("canonical_profile"), dict) else {}
    website = onboarding.get("website_analysis") if isinstance(onboarding.get("website_analysis"), dict) else {}
    research = onboarding.get("research_preferences") if isinstance(onboarding.get("research_preferences"), dict) else {}
    persona = onboarding.get("persona_data") if isinstance(onboarding.get("persona_data"), dict) else {}
    integrations = onboarding.get("platform_integrations") if isinstance(onboarding.get("platform_integrations"), dict) else {}
    competitors_raw = onboarding.get("competitor_analysis")
    competitors_raw = competitors_raw if isinstance(competitors_raw, list) else []

    industry = (
        _clean(canonical.get("industry"))
        or _clean((website.get("target_audience") or {}).get("industry_focus"))
        or _clean((research.get("target_audience") or {}).get("industry_focus"))
    )

    brand_voice = ""
    canonical_voice = canonical.get("brand_voice")
    if isinstance(canonical_voice, dict):
        brand_voice = _clean(canonical_voice.get("voice") or canonical_voice.get("tone"))
    else:
        brand_voice = _clean(canonical_voice)
    if not brand_voice:
        brand_analysis = website.get("brand_analysis") if isinstance(website.get("brand_analysis"), dict) else {}
        brand_voice = _clean(brand_analysis.get("brand_voice"))

    writing_tone = _clean(canonical.get("writing_tone")) or _clean(
        (website.get("writing_style") or {}).get("tone") if isinstance(website.get("writing_style"), dict) else ""
    )

    content_types = _tokenize(canonical.get("content_types")) or _tokenize(research.get("content_types"))

    audience = _clean(canonical.get("target_audience"))
    if isinstance(audience, dict) or not audience:
        audience = _clean(
            (research.get("target_audience") or {}).get("demographics")
            or (website.get("target_audience") or {}).get("demographics")
        )

    platforms = _tokenize(canonical.get("platform_preferences")) or _tokenize(
        integrations.get("connected_platforms")
    ) or _tokenize(persona.get("selectedPlatforms") or persona.get("selected_platforms"))

    competitors: List[str] = []
    for comp in competitors_raw:
        if not isinstance(comp, dict):
            continue
        domain = _domain_from_url(
            comp.get("competitor_domain") or comp.get("domain")
            or comp.get("competitor_url") or comp.get("url")
            or comp.get("website_url")
        )
        name = _clean(comp.get("competitor_name") or comp.get("name"))
        for candidate in (domain, name):
            if candidate and candidate not in competitors:
                competitors.append(candidate)

    return {
        "industry": [industry] if industry else [],
        "brand_voice": [brand_voice] if brand_voice else [],
        "writing_tone": [writing_tone] if writing_tone else [],
        "content_types": content_types[:3],
        "audience": [audience] if audience else [],
        "platforms": platforms[:3],
        "competitors": competitors[:3],
    }


def _context_terms_from_vfs(user_id: str) -> Dict[str, List[str]]:
    """Read query-relevant context from the user's flat context documents.

    Uses ``AgentContextVFS.read_struct`` (summary-first, dependency-aware
    reads) so the VFS becomes the agents' context read API. Failures are
    swallowed: a missing or unreadable document just means fewer terms.
    """
    terms: Dict[str, List[str]] = {}
    try:
        from services.intelligence.agent_context_vfs import AgentContextVFS
        from services.intelligence.agent_flat_context import AgentFlatContextStore

        vfs = AgentContextVFS(user_id)
        step2 = AgentFlatContextStore.STEP2_FILENAME
        step3 = AgentFlatContextStore.STEP3_FILENAME

        def _read(filename: str, path: str) -> Any:
            try:
                out = vfs.read_struct(filename, path)
                if isinstance(out, dict) and out.get("ok"):
                    return out.get("data")
            except Exception:
                return None
            return None

        brand_voice = _read(step2, "data.brand_analysis.brand_voice")
        industry = _read(step2, "data.target_audience.industry_focus")
        website_url = _read(step2, "data.website_url")
        content_types = _read(step3, "data.content_types")

        terms = {
            "industry": [t for t in [_clean(industry)] if t],
            "brand_voice": [t for t in [_clean(brand_voice)] if t],
            "writing_tone": [],
            "content_types": [t for t in _tokenize(content_types) if t][:3],
            "audience": [],
            "platforms": [],
            "competitors": [t for t in [_domain_from_url(website_url)] if t][:3],
        }
    except Exception as exc:
        logger.debug(f"[sif_query_builder] VFS context read failed for user {user_id}: {exc}")
        terms = {}
    return terms


def build_contextual_query(
    agent_key: str,
    grounding: Optional[Dict[str, Any]] = None,
    *,
    user_id: Optional[str] = None,
    hints: Optional[List[str]] = None,
    fallback: str = "",
    max_terms: int = 8,
) -> str:
    """Compose a user-specific SIF query for ``agent_key``.

    Args:
        agent_key: committee agent key (e.g. ``seo_specialist``).
        grounding: the committee grounding dict (uses
            ``grounding["onboarding_data"]``).
        user_id: optional; when grounding is thin, flat-context documents
            are read through AgentContextVFS for this user.
        hints: extra focus tokens (e.g. the current topic/claim).
        fallback: the legacy static query returned when no context exists.
        max_terms: cap on total term groups (intent + context + hints).

    Returns:
        The composed query string, or exactly ``fallback`` when no
        user-specific context could be found.
    """
    terms = _context_terms(grounding)
    if not any(terms.values()) and user_id:
        terms = _context_terms_from_vfs(user_id)

    intent = _AGENT_INTENTS.get(agent_key, "")
    plan = _AGENT_QUERY_PLAN.get(agent_key, ["industry", "content_types"])

    clean_hints: List[str] = []
    for hint in hints or []:
        text = _clean(hint)
        if text and text not in clean_hints:
            clean_hints.append(text)

    # Hints are the caller's current focus — reserve slots for them so a
    # small max_terms cap never drops them in favor of bulkier categories.
    context_budget = max(1, max_terms - min(len(clean_hints), max_terms))

    groups: List[str] = []
    if intent:
        groups.append(intent)
    for category in plan:
        if len(groups) >= context_budget:
            break
        for token in terms.get(category, []):
            if len(groups) >= context_budget:
                break
            if token and token not in groups:
                groups.append(token)

    for hint in clean_hints:
        if len(groups) >= max_terms:
            break
        if hint not in groups:
            groups.append(hint)

    if not groups or groups == [intent]:
        # No user-specific context available (or only the generic intent):
        # preserve the caller's legacy query verbatim.
        return fallback

    return " ".join(groups)
