"""
Canonical profile builders for onboarding data integration.

Pure, self-contained functions that map onboarding data sources (website
analysis, research preferences, persona, competitor analysis) into the
canonical profile shape consumed downstream. Extracted from
``data_integration.py`` to keep that module focused on orchestration and
data access.
"""

from typing import Dict, Any, Optional, List

from utils.logger_utils import get_service_logger

logger = get_service_logger("onboarding.canonical_profile_builder")


def build_persona_synthesis(persona_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Map ``PersonaData.core_persona`` into a compact structured ``persona`` block.

    Read paths mirror ``PersonaPromptBuilder.get_persona_schema`` (the generator
    contract). Returns ``None`` when there is no core_persona, so the block is
    ABSENT (not empty) for no-persona users — never populated from website data.
    """
    if not persona_data or not isinstance(persona_data, dict):
        return None
    core = persona_data.get('core_persona') or persona_data.get('corePersona')
    if not core or not isinstance(core, dict):
        return None

    identity = core.get('identity') or {}
    tonal = core.get('tonal_range') or {}
    linguistic = core.get('linguistic_fingerprint') or {}
    lexical = linguistic.get('lexical_features') or {}
    rhetorical = linguistic.get('rhetorical_devices') or {}
    stylistic = core.get('stylistic_constraints') or {}

    return {
        'identity': {
            'persona_name': identity.get('persona_name'),
            'archetype': identity.get('archetype'),
            'core_belief': identity.get('core_belief'),
            'brand_voice_description': identity.get('brand_voice_description'),
        },
        'tonal_range': {
            'default_tone': tonal.get('default_tone'),
            'permissible_tones': tonal.get('permissible_tones') or [],
            'forbidden_tones': tonal.get('forbidden_tones') or [],
            'emotional_range': tonal.get('emotional_range'),
        },
        'linguistic_fingerprint': {
            'go_to_phrases': lexical.get('go_to_phrases') or [],
            'go_to_words': lexical.get('go_to_words') or [],
            'avoid_words': lexical.get('avoid_words') or [],
            'vocabulary_level': lexical.get('vocabulary_level'),
            'storytelling_style': rhetorical.get('storytelling_style'),
        },
        'stylistic_constraints': {
            'punctuation': stylistic.get('punctuation') or {},
            'formatting': stylistic.get('formatting') or {},
        },
        'quality_metrics': persona_data.get('quality_metrics') or {},
        # Verbatim mirror of PersonaData.platform_personas (E.2b). No consumer
        # reads a normalized platform slice from canonical_profile (they read the
        # raw persona_data), so keep it lossless rather than inventing a shape.
        'platform_personas': persona_data.get('platform_personas') or persona_data.get('platformPersonas') or {},
    }

def build_brand_voice(persona_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Build a flat, structured ``brand_voice`` summary from the persona (NOT prose).

    Present only when a persona exists (source ``persona_core``); never populated
    from ``website_analysis.writing_style`` (that legacy path is retired in E.4).
    """
    if not persona_data or not isinstance(persona_data, dict):
        return None
    core = persona_data.get('core_persona') or persona_data.get('corePersona')
    if not core or not isinstance(core, dict):
        return None

    identity = core.get('identity') or {}
    tonal = core.get('tonal_range') or {}
    linguistic = core.get('linguistic_fingerprint') or {}
    lexical = linguistic.get('lexical_features') or {}

    return {
        'default_tone': tonal.get('default_tone'),
        'voice_description': identity.get('brand_voice_description'),
        'go_to_phrases': lexical.get('go_to_phrases') or [],
        'avoid_words': lexical.get('avoid_words') or [],
        'vocabulary_level': lexical.get('vocabulary_level'),
        'emotional_range': tonal.get('emotional_range'),
    }

def build_canonical_profile(
    website_analysis: Dict[str, Any],
    research_preferences: Dict[str, Any],
    persona_data: Dict[str, Any],
    onboarding_session: Dict[str, Any],
    competitor_analysis: List[Dict[str, Any]],
    deep_competitor_analysis: Dict[str, Any],
    linkedin_profile: Dict[str, Any] = None,
) -> Dict[str, Any]:
    try:
        core_persona = None
        if persona_data:
            if isinstance(persona_data, dict):
                core_persona = persona_data.get('corePersona') or persona_data.get('core_persona')

        persona_block = build_persona_synthesis(persona_data)
        brand_voice = build_brand_voice(persona_data)

        website_target = {}
        if website_analysis and isinstance(website_analysis, dict):
            value = website_analysis.get('target_audience') or {}
            if isinstance(value, dict):
                website_target = value

        research_target = {}
        if research_preferences and isinstance(research_preferences, dict):
            value = research_preferences.get('target_audience') or {}
            if isinstance(value, dict):
                research_target = value

        # industry source-of-record = WebsiteAnalysis (persona has no `industry`
        # field), fallback ResearchPreferences — matches §3.
        industry = None
        if website_target:
            value = website_target.get('industry_focus')
            if value:
                industry = value
        if not industry and research_target:
            value = research_target.get('industry_focus')
            if value:
                industry = value

        target_audience = None
        target_source = None
        # ResearchPreferences is the explicit user choice — source-of-record for
        # target_audience (§3). Read it before the crawl-inferred website value.
        if research_target:
            value = research_target.get('demographics') or research_target.get('target_audience')
            if value:
                target_audience = value
                target_source = 'research_preferences'
        if not target_audience and website_target:
            value = website_target.get('demographics') or website_target.get('target_audience')
            if value:
                target_audience = value
                target_source = 'website_analysis'

        writing_style = {}
        if website_analysis and isinstance(website_analysis, dict):
            value = website_analysis.get('writing_style')
            if isinstance(value, dict):
                writing_style = value
        if not writing_style and research_preferences and isinstance(research_preferences, dict):
            value = research_preferences.get('writing_style')
            if isinstance(value, dict):
                writing_style = value

        writing_tone = None
        writing_voice = None
        writing_complexity = None
        writing_engagement = None
        writing_source = None
        if writing_style:
            value = writing_style.get('tone')
            if value:
                writing_tone = value
            
            value = writing_style.get('voice')
            if value:
                writing_voice = value

            value = writing_style.get('complexity')
            if value:
                writing_complexity = value

            value = writing_style.get('engagement_level')
            if value:
                writing_engagement = value

            if website_analysis and website_analysis.get('writing_style'):
                writing_source = 'website_analysis'
            elif research_preferences and research_preferences.get('writing_style'):
                writing_source = 'research_preferences'

        # Brand & Visual Identity
        brand_colors = []
        brand_values = []
        visual_style = {}
        brand_source = None
        
        if website_analysis and isinstance(website_analysis, dict):
            brand_analysis = website_analysis.get('brand_analysis', {})
            if brand_analysis:
                brand_colors = brand_analysis.get('color_palette', [])
                brand_values = brand_analysis.get('brand_values', [])
                brand_source = 'website_analysis'
            
            style_guidelines = website_analysis.get('style_guidelines', {})
            if style_guidelines:
                visual_style = {
                    'aesthetic': style_guidelines.get('aesthetic'),
                    'visual_style': style_guidelines.get('visual_style')
                }

        # Content Strategy Insights
        strategy_insights = {}
        if website_analysis and isinstance(website_analysis, dict):
            strategy_insights = website_analysis.get('content_strategy_insights', {})

        seo_profile: Dict[str, Any] = {}
        if website_analysis and isinstance(website_analysis, dict):
            seo_profile["homepage_seo_audit"] = website_analysis.get("seo_audit") or {}
            seo_profile["full_site_seo_summary"] = website_analysis.get("full_site_seo_summary") or {}
            sitemap_strategy = website_analysis.get("sitemap_strategy_insights")
            if sitemap_strategy:
                seo_profile["sitemap_strategy_insights"] = sitemap_strategy

        competitor_seo_benchmarks = build_competitor_seo_benchmarks(competitor_analysis)
        if competitor_seo_benchmarks:
            seo_profile["competitor_seo_benchmarks"] = competitor_seo_benchmarks

        # Platform Preferences
        platform_preferences = []
        platform_source = None
        
        if core_persona and isinstance(core_persona, dict):
            # Check persona_data for platforms
            if isinstance(persona_data, dict):
                selected = persona_data.get('selectedPlatforms')
                if selected:
                    platform_preferences = selected
                    platform_source = 'persona_data'
                else:
                    platform_personas = persona_data.get('platformPersonas')
                    if platform_personas:
                        platform_preferences = list(platform_personas.keys())
                        platform_source = 'persona_data'

        content_types = []
        content_source = None
        if research_preferences and isinstance(research_preferences, dict):
            prefs_content = research_preferences.get('content_types')
            if isinstance(prefs_content, list):
                content_types = list(prefs_content)
                if content_types:
                    content_source = 'research_preferences'
        if not content_types and website_analysis and isinstance(website_analysis, dict):
            content_type_data = website_analysis.get('content_type') or {}
            if isinstance(content_type_data, dict):
                primary = content_type_data.get('primary_type')
                if primary:
                    content_types.append(primary)
                secondary = content_type_data.get('secondary_types')
                if isinstance(secondary, list):
                    content_types.extend(secondary)
                if content_types:
                    content_source = 'website_analysis'

        research_depth = None
        auto_research = None
        factual_content = None
        if research_preferences and isinstance(research_preferences, dict):
            research_depth = research_preferences.get('research_depth')
            auto_research = research_preferences.get('auto_research')
            factual_content = research_preferences.get('factual_content')

        business_info = {}
        if industry:
            business_info['industry'] = industry
        if target_audience:
            business_info['target_audience'] = target_audience

        sources = {
            'industry': None,
            'target_audience': target_source,
            'writing_tone': writing_source,
            'content_types': content_source,
            'brand_identity': brand_source,
            'platform_preferences': platform_source,
            'persona': 'persona_core' if persona_block else None,
            'brand_voice': 'persona_core' if brand_voice else None,
            'seo_profile': 'website_analysis' if website_analysis else None
        }
        if website_target.get('industry_focus'):
            sources['industry'] = 'website_analysis'
        elif research_target.get('industry_focus'):
            sources['industry'] = 'research_preferences'

        competitive_sitemap_benchmarking = {}
        try:
            if website_analysis and isinstance(website_analysis, dict):
                seo_audit = website_analysis.get("seo_audit")
                if isinstance(seo_audit, dict):
                    report = seo_audit.get("competitive_sitemap_benchmarking")
                    if isinstance(report, dict):
                        benchmark = report.get("benchmark") if isinstance(report.get("benchmark"), dict) else {}
                        gaps = benchmark.get("gaps") if isinstance(benchmark.get("gaps"), dict) else {}
                        missing_sections = gaps.get("missing_sections") if isinstance(gaps.get("missing_sections"), list) else []
                        competitive_sitemap_benchmarking = {
                            "status": "available",
                            "last_run": report.get("timestamp") or report.get("analysis_date"),
                            "competitors_analyzed": benchmark.get("competitors_analyzed"),
                            "missing_sections_count": len(missing_sections)
                        }
        except Exception:
            competitive_sitemap_benchmarking = {}

        competitive_intelligence = {
            'deep_competitor_analysis': deep_competitor_analysis or {},
            'competitive_sitemap_benchmarking': competitive_sitemap_benchmarking,
            'strategic_insights_history': website_analysis.get("strategic_insights_history", []) if isinstance(website_analysis, dict) else []
        }

        return {
            'industry': industry,
            'target_audience': target_audience,
            'writing_tone': writing_tone,
            'writing_voice': writing_voice,
            'writing_complexity': writing_complexity,
            'writing_engagement': writing_engagement,
            'content_types': content_types,
            'brand_colors': brand_colors,
            'brand_values': brand_values,
            'visual_style': visual_style,
            'strategy_insights': strategy_insights,
            'seo_profile': seo_profile,
            'competitive_intelligence': competitive_intelligence,
            'platform_preferences': platform_preferences,
            'research_depth': research_depth,
            'auto_research': auto_research,
            'factual_content': factual_content,
            'business_info': business_info,
            'persona': persona_block,
            'brand_voice': brand_voice,
            'sources': sources
        }
    except Exception as e:
        logger.error(f"Error building canonical profile: {str(e)}")
        return {}

def build_competitor_seo_benchmarks(competitor_analysis: List[Dict[str, Any]]) -> Dict[str, Any]:
    try:
        if not competitor_analysis:
            return {}

        rows = []
        for comp in competitor_analysis:
            analysis_data = comp.get("analysis_data") if isinstance(comp, dict) else None
            if not isinstance(analysis_data, dict):
                continue
            seo_audit = analysis_data.get("seo_audit")
            if not isinstance(seo_audit, dict):
                continue
            score = seo_audit.get("overall_score")
            if score is None:
                continue
            rows.append({
                "competitor_url": comp.get("competitor_url") or comp.get("url") or comp.get("website_url"),
                "competitor_domain": comp.get("competitor_domain") or comp.get("domain"),
                "overall_score": score,
                "last_analyzed_at": comp.get("updated_at") or comp.get("analysis_date")
            })

        if not rows:
            return {}

        scores = [r["overall_score"] for r in rows if isinstance(r.get("overall_score"), (int, float))]
        avg_score = round(sum(scores) / len(scores), 1) if scores else None

        best = max(rows, key=lambda r: r.get("overall_score") or 0)
        worst = min(rows, key=lambda r: r.get("overall_score") or 0)

        return {
            "competitors_with_seo_audit": len(rows),
            "avg_homepage_seo_score": avg_score,
            "best_competitor": best,
            "worst_competitor": worst
        }
    except Exception as e:
        logger.error(f"Error building competitor SEO benchmarks: {str(e)}")
        return {}
