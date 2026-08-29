"""
Onboarding context digest for Strategic Content Opportunities.

Builds a compact, size-capped digest of the data already collected during
onboarding so the single "Strategic Content Opportunities" LLM call can be
grounded in real Step-1 (website analysis) and Step-2 (industry research)
intel — audience, brand voice, positioning/SWOT, competitor content focus,
threat level and publishing cadence — instead of relying on generic guesses.

Kept as its own module so ``sitemap_service.py`` stays focused on sitemap
mechanics and the "one enriched LLM call" stays cheap (the digest is capped
so the prompt is never overstuffed).
"""

import json
from typing import Dict, List, Optional

from loguru import logger

# Size caps for the digest. These keep the prompt lean (cost + output quality).
_ONBOARDING_CTX_SECTION_CHAR_CAP = 900   # per labeled section
_ONBOARDING_CTX_TOTAL_CHAR_CAP = 3200    # overall digest across sections
_ONBOARDING_CTX_MAX_COMPETITORS = 6      # keep the digest cheap + focused
_ONBOARDING_CTX_MAX_SECONDS = 4          # research key findings to reuse


def cap_text(text: str, max_chars: int) -> str:
    """Truncate ``text`` to ``max_chars``, preferring to break on a word
    boundary near the cut so the prompt stays clean and compact."""
    if not text:
        return ""
    if max_chars <= 0:
        return ""
    text = text.strip()
    if len(text) <= max_chars:
        return text
    cut = text[:max_chars]
    space = cut.rfind(" ")
    if space > max_chars * 0.6:
        cut = cut[:space]
    return cut.rstrip(" ,;:") + "..."


def build_onboarding_opportunity_context(
    user_id: Optional[str],
    competitor_urls: Optional[List[str]] = None,
) -> Dict[str, str]:
    """Build a compact, size-capped context digest for Strategic Content
    Opportunities from data already collected during onboarding.

    Returns a dict of rendered ``label -> text`` sections. Empty sections are
    excluded so the prompt stays lean. Any DB/parse failure degrades gracefully
    to an empty dict rather than breaking the sitemap analysis.
    """
    if not user_id:
        return {}

    try:
        from services.database import get_session_for_user
        from models.onboarding import (
            OnboardingSession,
            WebsiteAnalysis,
            ResearchPreferences,
            CompetitorAnalysis,
        )
    except Exception:
        return {}

    db = get_session_for_user(user_id)
    if not db:
        return {}

    try:
        session = db.query(OnboardingSession).filter(
            OnboardingSession.user_id == user_id
        ).order_by(OnboardingSession.updated_at.desc()).first()
        if not session:
            return {}

        website = db.query(WebsiteAnalysis).filter(
            WebsiteAnalysis.session_id == session.id
        ).order_by(WebsiteAnalysis.updated_at.desc()).first()

        research = db.query(ResearchPreferences).filter(
            ResearchPreferences.session_id == session.id
        ).first()

        sections: Dict[str, str] = {}

        # ---- Step 1: audience + brand voice ----
        audience_bits = []
        if website:
            if website.target_audience:
                audience_bits.append(
                    f"Target audience: {json.dumps(website.target_audience, ensure_ascii=False)}"
                )
            if website.writing_style:
                audience_bits.append(
                    f"Brand voice / writing style: {json.dumps(website.writing_style, ensure_ascii=False)}"
                )
        if audience_bits:
            sections["AUDIENCE & BRAND VOICE"] = cap_text(
                " ".join(audience_bits), _ONBOARDING_CTX_SECTION_CHAR_CAP
            )

        brand_bits = []
        if website:
            if website.brand_analysis:
                brand_bits.append(
                    f"Brand analysis: {json.dumps(website.brand_analysis, ensure_ascii=False)}"
                )
            if website.content_strategy_insights:
                brand_bits.append(
                    f"Content strategy (SWOT): {json.dumps(website.content_strategy_insights, ensure_ascii=False)}"
                )
        if brand_bits:
            sections["BRAND POSITIONING & STRATEGY"] = cap_text(
                " ".join(brand_bits), _ONBOARDING_CTX_SECTION_CHAR_CAP
            )

        # ---- Step 2: research preferences / already-learned findings ----
        research_bits = []
        if research:
            if research.content_types:
                research_bits.append(
                    f"Preferred content channels: {json.dumps(research.content_types, ensure_ascii=False)}"
                )
            if research.research_depth:
                research_bits.append(f"Research depth: {research.research_depth}")
            rs = research.research_summary if isinstance(research.research_summary, dict) else {}
            key_findings = rs.get("key_findings") if isinstance(rs.get("key_findings"), list) else None
            if key_findings:
                research_bits.append(
                    f"Key findings: {json.dumps(key_findings[:_ONBOARDING_CTX_MAX_SECONDS], ensure_ascii=False)}"
                )
            recommendations = rs.get("recommendations") if isinstance(rs.get("recommendations"), list) else None
            if recommendations:
                research_bits.append(
                    f"Earlier recommendations: {json.dumps(recommendations[:_ONBOARDING_CTX_MAX_SECONDS], ensure_ascii=False)}"
                )
            if research.content_pillars:
                research_bits.append(
                    f"Existing content pillars: {json.dumps(research.content_pillars, ensure_ascii=False)}"
                )
        if research_bits:
            sections["STEP 2 RESEARCH (ALREADY LEARNED)"] = cap_text(
                " ".join(research_bits), _ONBOARDING_CTX_SECTION_CHAR_CAP
            )

        # ---- Step 2: competitor intelligence (grounded, not just URL strings) ----
        comp_records = db.query(CompetitorAnalysis).filter(
            CompetitorAnalysis.session_id == session.id
        ).order_by(CompetitorAnalysis.updated_at.desc()).limit(
            _ONBOARDING_CTX_MAX_COMPETITORS
        ).all()

        comp_lines = []
        for rec in comp_records:
            ad = rec.analysis_data if isinstance(rec.analysis_data, dict) else {}
            domain = rec.competitor_domain or rec.competitor_url or ""
            title = ad.get("title") or domain
            cins = ad.get("content_insights") if isinstance(ad.get("content_insights"), dict) else {}
            can = ad.get("competitive_analysis") if isinstance(ad.get("competitive_analysis"), dict) else {}
            mpos = ad.get("market_positioning") if isinstance(ad.get("market_positioning"), dict) else {}

            focus = cins.get("content_focus", "")
            band = can.get("threat_level", "")
            freq = cins.get("publishing_frequency", "")
            tier = mpos.get("market_tier", "")
            strengths = can.get("competitive_strengths") if isinstance(can.get("competitive_strengths"), list) else []
            diff = can.get("differentiation_opportunities") if isinstance(can.get("differentiation_opportunities"), list) else []

            line_parts = [f"- {title} ({domain})"]
            if focus:
                line_parts.append(f"content_focus={focus}")
            if band:
                line_parts.append(f"threat={band}")
            if tier:
                line_parts.append(f"tier={tier}")
            if freq:
                line_parts.append(f"frequency={freq}")
            if strengths:
                line_parts.append("strengths=" + ", ".join(str(s) for s in strengths[:3]))
            if diff:
                line_parts.append("differentiation=" + ", ".join(str(d) for d in diff[:2]))
            comp_lines.append("; ".join(line_parts))

        if not comp_lines and competitor_urls:
            comp_lines = [f"- {u}" for u in competitor_urls[:_ONBOARDING_CTX_MAX_COMPETITORS]]
        if comp_lines:
            sections["COMPETITOR INTEL (GROUNDED)"] = cap_text(
                "\n".join(comp_lines), _ONBOARDING_CTX_SECTION_CHAR_CAP
            )

        # Enforce a global cap so the digest can never overstuff the prompt.
        ordered = list(sections.items())
        remaining = _ONBOARDING_CTX_TOTAL_CHAR_CAP
        trimmed: Dict[str, str] = {}
        for label, text in ordered:
            if remaining <= 0:
                break
            keep = min(len(text), remaining)
            trimmed[label] = text[:keep]
            remaining -= keep
        return trimmed

    except Exception as e:
        logger.warning(f"[onboarding_ctx] Failed to build context digest: {e}")
        return {}
    finally:
        db.close()