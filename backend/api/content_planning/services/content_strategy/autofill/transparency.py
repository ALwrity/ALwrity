from typing import Any, Dict, List, Optional


def build_data_sources_map(website: Dict[str, Any], research: Dict[str, Any], api_keys: Dict[str, Any], persona: Dict[str, Any] = None, competitor: Dict[str, Any] = None, analytics: Dict[str, Any] = None) -> Dict[str, str]:
    sources: Dict[str, str] = {}

    website_fields = ['business_objectives', 'target_metrics', 'content_budget', 'team_size',
                      'implementation_timeline', 'market_share', 'competitive_position',
                      'conversion_rates', 'content_roi_targets']
    
    analytics_fields = ['performance_metrics', 'engagement_metrics', 'traffic_sources']

    research_fields = ['content_preferences', 'consumption_patterns', 'audience_pain_points',
                       'buying_journey', 'seasonal_trends', 'preferred_formats', 'content_mix',
                       'content_frequency', 'optimal_timing', 'quality_metrics', 'editorial_guidelines']

    competitor_fields = ['top_competitors', 'competitor_content_strategies', 'market_gaps', 
                         'industry_trends', 'emerging_trends']

    persona_fields = ['brand_voice']

    api_fields = ['ab_testing_capabilities']

    for f in website_fields:
        sources[f] = 'website_analysis'
    for f in research_fields:
        sources[f] = 'research_preferences'
    for f in competitor_fields:
        sources[f] = 'competitor_analysis' if competitor else 'onboarding_session'
    for f in persona_fields:
        sources[f] = 'persona_data' if persona else 'research_preferences'
    for f in analytics_fields:
        sources[f] = 'analytics_data' if analytics else 'website_analysis'
    for f in api_fields:
        sources[f] = 'api_keys_data'

    return sources


def build_input_data_points(*, website_raw: Dict[str, Any], research_raw: Dict[str, Any], api_raw: Dict[str, Any], persona_raw: Dict[str, Any] = None, competitor_raw: List[Dict[str, Any]] = None, gsc_raw: Dict[str, Any] = None, bing_raw: Dict[str, Any] = None) -> Dict[str, Any]:
    input_data_points: Dict[str, Any] = {}

    if website_raw:
        input_data_points['business_objectives'] = {
            'website_content': website_raw.get('content_goals', 'Not available'),
            'meta_description': website_raw.get('meta_description', 'Not available'),
            'about_page': website_raw.get('about_page_content', 'Not available'),
            'page_title': website_raw.get('page_title', 'Not available'),
            'content_analysis': website_raw.get('content_analysis', {})
        }

    if research_raw:
        input_data_points['target_metrics'] = {
            'research_preferences': research_raw.get('target_audience', 'Not available'),
            'industry_benchmarks': research_raw.get('industry_benchmarks', 'Not available'),
            'competitor_analysis': research_raw.get('competitor_analysis', 'Not available'),
            'market_research': research_raw.get('market_research', 'Not available')
        }

    if research_raw:
        input_data_points['content_preferences'] = {
            'user_preferences': research_raw.get('content_types', 'Not available'),
            'industry_trends': research_raw.get('industry_trends', 'Not available'),
            'consumption_patterns': research_raw.get('consumption_patterns', 'Not available'),
            'audience_research': research_raw.get('audience_research', 'Not available')
        }

    if website_raw or research_raw:
        input_data_points['preferred_formats'] = {
            'existing_content': website_raw.get('existing_content_types', 'Not available') if website_raw else 'Not available',
            'engagement_metrics': website_raw.get('engagement_metrics', 'Not available') if website_raw else 'Not available',
            'platform_analysis': research_raw.get('platform_preferences', 'Not available') if research_raw else 'Not available',
            'content_performance': website_raw.get('content_performance', 'Not available') if website_raw else 'Not available'
        }

    if research_raw:
        input_data_points['content_frequency'] = {
            'audience_research': research_raw.get('content_frequency_preferences', 'Not available'),
            'industry_standards': research_raw.get('industry_frequency', 'Not available'),
            'competitor_frequency': research_raw.get('competitor_frequency', 'Not available'),
            'optimal_timing': research_raw.get('optimal_timing', 'Not available')
        }

    if website_raw:
        input_data_points['content_budget'] = {
            'website_analysis': website_raw.get('budget_indicators', 'Not available'),
            'industry_standards': website_raw.get('industry_budget', 'Not available'),
            'company_size': website_raw.get('company_size', 'Not available'),
            'market_position': website_raw.get('market_position', 'Not available')
        }

    if website_raw:
        input_data_points['team_size'] = {
            'company_profile': website_raw.get('company_profile', 'Not available'),
            'content_volume': website_raw.get('content_volume', 'Not available'),
            'industry_standards': website_raw.get('industry_team_size', 'Not available'),
            'budget_constraints': website_raw.get('budget_constraints', 'Not available')
        }

    if research_raw:
        input_data_points['implementation_timeline'] = {
            'project_scope': research_raw.get('project_scope', 'Not available'),
            'resource_availability': research_raw.get('resource_availability', 'Not available'),
            'industry_timeline': research_raw.get('industry_timeline', 'Not available'),
            'complexity_assessment': research_raw.get('complexity_assessment', 'Not available')
        }

    if competitor_raw:
        input_data_points['top_competitors'] = {
            'competitor_analysis': competitor_raw,
            'analysis_count': len(competitor_raw),
            'competitor_urls': [c.get('competitor_url') or c.get('url', '') for c in competitor_raw]
        }

    # E.3 (deferred): raw persona_data read bypasses canonical_profile — route via
    # canonical_profile.persona.platform_personas (verbatim, §5).
    if persona_raw:
        input_data_points['brand_voice'] = {
            'core_persona': persona_raw.get('core_persona') or persona_raw.get('corePersona', 'Not available'),
            'platform_personas': persona_raw.get('platform_personas') or persona_raw.get('platformPersonas', 'Not available'),
            'quality_metrics': persona_raw.get('quality_metrics') or persona_raw.get('qualityMetrics', 'Not available')
        }

    if gsc_raw:
        input_data_points['traffic_sources'] = {
            'gsc_analytics': gsc_raw.get('data', 'Not available'),
            'gsc_metrics': gsc_raw.get('metrics', 'Not available'),
            'gsc_date_range': gsc_raw.get('date_range', 'Not available')
        }
        input_data_points['performance_metrics'] = {
            'gsc_clicks': gsc_raw.get('metrics', {}).get('total_clicks', 'Not available') if isinstance(gsc_raw.get('metrics'), dict) else 'Not available',
            'gsc_impressions': gsc_raw.get('metrics', {}).get('total_impressions', 'Not available') if isinstance(gsc_raw.get('metrics'), dict) else 'Not available',
            'gsc_ctr': gsc_raw.get('metrics', {}).get('avg_ctr', 'Not available') if isinstance(gsc_raw.get('metrics'), dict) else 'Not available'
        }

    if bing_raw:
        bing_summary = bing_raw.get('summary', {})
        if bing_summary and not bing_summary.get('error'):
            input_data_points['traffic_sources'] = {
                **input_data_points.get('traffic_sources', {}),
                'bing_analytics': bing_summary,
                'bing_total_clicks': bing_summary.get('total_clicks', 'Not available'),
                'bing_total_impressions': bing_summary.get('total_impressions', 'Not available'),
                'bing_avg_ctr': bing_summary.get('avg_ctr', 'Not available')
            }
            input_data_points['performance_metrics'] = {
                **input_data_points.get('performance_metrics', {}),
                'bing_clicks': bing_summary.get('total_clicks', 'Not available'),
                'bing_impressions': bing_summary.get('total_impressions', 'Not available'),
                'bing_ctr': bing_summary.get('avg_ctr', 'Not available')
            }

    return input_data_points 