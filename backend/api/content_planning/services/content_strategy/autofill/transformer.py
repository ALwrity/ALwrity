from typing import Any, Dict
import logging

logger = logging.getLogger(__name__)


def transform_to_fields(*, website: Dict[str, Any], research: Dict[str, Any], api_keys: Dict[str, Any], session: Dict[str, Any], persona: Dict[str, Any] = None, competitor: Dict[str, Any] = None, analytics: Dict[str, Any] = None) -> Dict[str, Any]:
    """Transform normalized onboarding data to frontend field map.

    Only fields with real data from onboarding sources are included.
    No hardcoded placeholders — missing data is left for AI fill or user input.
    """
    fields: Dict[str, Any] = {}

    audience_research = research.get('audience_intelligence', {})
    content_prefs = research.get('content_preferences', {})

    # ── Business Context ──────────────────────────────────────────────
    if website.get('content_goals'):
        fields['business_objectives'] = {
            'value': website.get('content_goals'),
            'source': 'website_analysis',
            'confidence': website.get('confidence_level')
        }

    if website.get('target_metrics'):
        fields['target_metrics'] = {
            'value': website.get('target_metrics'),
            'source': 'website_analysis',
            'confidence': website.get('confidence_level')
        }
    elif website.get('performance_metrics'):
        fields['target_metrics'] = {
            'value': website.get('performance_metrics'),
            'source': 'website_analysis',
            'confidence': website.get('confidence_level')
        }

    if website.get('content_budget') is not None:
        fields['content_budget'] = {
            'value': website.get('content_budget'),
            'source': 'website_analysis',
            'confidence': website.get('confidence_level')
        }
    elif isinstance(session, dict) and session.get('budget') is not None:
        fields['content_budget'] = {
            'value': session.get('budget'),
            'source': 'onboarding_session',
            'confidence': 0.7
        }

    if website.get('team_size') is not None:
        fields['team_size'] = {
            'value': website.get('team_size'),
            'source': 'website_analysis',
            'confidence': website.get('confidence_level')
        }
    elif isinstance(session, dict) and session.get('team_size') is not None:
        fields['team_size'] = {
            'value': session.get('team_size'),
            'source': 'onboarding_session',
            'confidence': 0.7
        }

    if website.get('implementation_timeline'):
        fields['implementation_timeline'] = {
            'value': website.get('implementation_timeline'),
            'source': 'website_analysis',
            'confidence': website.get('confidence_level')
        }
    elif isinstance(session, dict) and session.get('timeline'):
        fields['implementation_timeline'] = {
            'value': session.get('timeline'),
            'source': 'onboarding_session',
            'confidence': 0.7
        }

    if website.get('market_share'):
        fields['market_share'] = {
            'value': website.get('market_share'),
            'source': 'website_analysis',
            'confidence': website.get('confidence_level')
        }
    elif website.get('performance_metrics'):
        estimated_share = website.get('performance_metrics', {}).get('estimated_market_share')
        if estimated_share:
            fields['market_share'] = {
                'value': estimated_share,
                'source': 'website_analysis',
                'confidence': website.get('confidence_level')
            }

    # ── Performance Metrics ───────────────────────────────────────────
    if analytics and analytics.get('performance_metrics'):
        analytics_perf = analytics['performance_metrics']
        website_perf = website.get('performance_metrics', {})
        fields['performance_metrics'] = {
            'value': {
                'traffic': analytics_perf.get('traffic', website_perf.get('traffic', 0)),
                'conversion_rate': website_perf.get('conversion_rate', analytics_perf.get('conversion_rate', 0)),
                'bounce_rate': website_perf.get('bounce_rate', analytics_perf.get('bounce_rate', 0)),
                'avg_session_duration': website_perf.get('avg_session_duration', analytics_perf.get('avg_session_duration', 0))
            },
            'source': 'analytics_data' if analytics.get('performance_metrics', {}).get('traffic') else 'website_analysis',
            'confidence': 0.9 if analytics.get('performance_metrics', {}).get('traffic') else website.get('confidence_level', 0.8)
        }
    elif website.get('performance_metrics'):
        fields['performance_metrics'] = {
            'value': website.get('performance_metrics', {}),
            'source': 'website_analysis',
            'confidence': website.get('confidence_level', 0.8)
        }

    # ── Audience Intelligence ─────────────────────────────────────────
    if content_prefs:
        fields['content_preferences'] = {
            'value': content_prefs,
            'source': 'research_preferences',
            'confidence': research.get('confidence_level', 0.8)
        }

    consumption_patterns = audience_research.get('consumption_patterns', {})
    if consumption_patterns:
        fields['consumption_patterns'] = {
            'value': consumption_patterns,
            'source': 'research_preferences',
            'confidence': research.get('confidence_level', 0.8)
        }

    pain_points = audience_research.get('pain_points', [])
    if pain_points:
        fields['audience_pain_points'] = {
            'value': pain_points,
            'source': 'research_preferences',
            'confidence': research.get('confidence_level', 0.8)
        }

    buying_journey = audience_research.get('buying_journey', {})
    if buying_journey:
        fields['buying_journey'] = {
            'value': buying_journey,
            'source': 'research_preferences',
            'confidence': research.get('confidence_level', 0.8)
        }

    # ── Engagement Metrics ────────────────────────────────────────────
    if analytics and analytics.get('engagement_metrics'):
        analytics_eng = analytics['engagement_metrics']
        website_perf = website.get('performance_metrics', {})
        fields['engagement_metrics'] = {
            'value': {
                'click_through_rate': analytics_eng.get('click_through_rate', 0),
                'time_on_page': website_perf.get('avg_session_duration', 0),
                'engagement_rate': analytics_eng.get('click_through_rate', 0)
            },
            'source': 'analytics_data',
            'confidence': 0.9
        }

    # ── Competitive Intelligence ──────────────────────────────────────
    if competitor and isinstance(competitor.get('top_competitors'), list):
        top_competitors = competitor['top_competitors']
        if len(top_competitors) > 0:
            fields['top_competitors'] = {
                'value': top_competitors,
                'source': 'competitor_analysis',
                'confidence': 0.9
            }

    if competitor and competitor.get('competitor_content_strategies'):
        competitor_strategies = competitor['competitor_content_strategies']
        has_data = (
            competitor_strategies.get('content_types') or
            competitor_strategies.get('publishing_frequency') or
            competitor_strategies.get('content_themes') or
            competitor_strategies.get('distribution_channels') or
            competitor_strategies.get('engagement_approach')
        )
        if has_data:
            fields['competitor_content_strategies'] = {
                'value': competitor_strategies,
                'source': 'competitor_analysis',
                'confidence': 0.9
            }

    if competitor and isinstance(competitor.get('market_gaps'), list):
        market_gaps = competitor['market_gaps']
        if len(market_gaps) > 0:
            fields['market_gaps'] = {
                'value': market_gaps,
                'source': 'competitor_analysis',
                'confidence': 0.9
            }

    if competitor and isinstance(competitor.get('industry_trends'), list):
        industry_trends = competitor['industry_trends']
        if len(industry_trends) > 0:
            fields['industry_trends'] = {
                'value': industry_trends,
                'source': 'competitor_analysis',
                'confidence': 0.9
            }

    if competitor and isinstance(competitor.get('emerging_trends'), list):
        emerging_trends = competitor['emerging_trends']
        if len(emerging_trends) > 0:
            fields['emerging_trends'] = {
                'value': emerging_trends,
                'source': 'competitor_analysis',
                'confidence': 0.9
            }

    # ── Content Strategy ──────────────────────────────────────────────
    if content_prefs and content_prefs.get('preferred_formats'):
        fields['preferred_formats'] = {
            'value': content_prefs.get('preferred_formats'),
            'source': 'research_preferences',
            'confidence': research.get('confidence_level', 0.8)
        }

    if content_prefs and (content_prefs.get('content_style') or content_prefs.get('content_length')):
        guidelines = {}
        if content_prefs.get('content_style'):
            guidelines['tone'] = content_prefs.get('content_style')
        if content_prefs.get('content_length'):
            guidelines['length'] = content_prefs.get('content_length')
        fields['editorial_guidelines'] = {
            'value': guidelines,
            'source': 'research_preferences',
            'confidence': research.get('confidence_level', 0.8)
        }

    # ── Brand Voice ───────────────────────────────────────────────────
    if persona and persona.get('brand_voice_insights'):
        brand_voice_insights = persona['brand_voice_insights']
        fields['brand_voice'] = {
            'value': {
                'personality_traits': brand_voice_insights.get('personality_traits', []),
                'communication_style': brand_voice_insights.get('communication_style', ''),
                'key_messages': brand_voice_insights.get('key_messages', []),
            },
            'source': 'persona_data',
            'confidence': 0.9
        }

    # ── Traffic Sources ───────────────────────────────────────────────
    if analytics and analytics.get('traffic_sources'):
        analytics_traffic = analytics['traffic_sources']
        website_traffic = website.get('traffic_sources', {})
        merged_traffic = website_traffic.copy() if website_traffic else {}
        if 'organic_search' in analytics_traffic:
            merged_traffic['Organic Search'] = {
                'clicks': analytics_traffic['organic_search'].get('clicks', 0),
                'impressions': analytics_traffic['organic_search'].get('impressions', 0),
                'ctr': analytics_traffic['organic_search'].get('ctr', 0)
            }
        fields['traffic_sources'] = {
            'value': merged_traffic if merged_traffic else {},
            'source': 'analytics_data',
            'confidence': 0.9
        }
    elif website.get('traffic_sources'):
        fields['traffic_sources'] = {
            'value': website.get('traffic_sources', {}),
            'source': 'website_analysis',
            'confidence': website.get('confidence_level', 0.8)
        }

    # ── A/B Testing Capabilities ──────────────────────────────────────
    if api_keys and api_keys.get('ab_testing_capabilities') is not None:
        fields['ab_testing_capabilities'] = {
            'value': api_keys.get('ab_testing_capabilities'),
            'source': 'api_keys_data',
            'confidence': api_keys.get('confidence_level', 0.8)
        }

    return fields
