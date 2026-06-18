from typing import Any, Dict

REQUIRED_TOP_LEVEL_KEYS = {
    'fields': dict,
    'sources': dict,
    'quality_scores': dict,
    'confidence_levels': dict,
    'data_freshness': dict,
    'input_data_points': dict,
}


def validate_output(payload: Dict[str, Any]) -> None:
    # Top-level keys and types
    for key, typ in REQUIRED_TOP_LEVEL_KEYS.items():
        if key not in payload:
            raise ValueError(f"Autofill payload missing key: {key}")
        if not isinstance(payload[key], typ):
            raise ValueError(f"Autofill payload key '{key}' must be {typ.__name__}")

    fields = payload['fields']
    if not isinstance(fields, dict):
        raise ValueError("fields must be an object")

    # Allow empty fields, but validate structure when present
    for field_id, spec in fields.items():
        if not isinstance(spec, dict):
            raise ValueError(f"Field '{field_id}' must be an object")
        for k in ('value', 'source', 'confidence'):
            if k not in spec:
                raise ValueError(f"Field '{field_id}' missing '{k}'")
        if spec['source'] not in {
            'website_analysis',
            'research_preferences',
            'api_keys_data',
            'onboarding_session',
            'persona_data',
            'competitor_analysis',
            'analytics_data',
            'deep_competitor_analysis',
            'gsc_analytics',
            'bing_analytics',
            'ai_generated',
            'unified',
        }:
            raise ValueError(f"Field '{field_id}' has invalid source: {spec['source']}")
        try:
            c = float(spec['confidence'])
        except Exception:
            raise ValueError(f"Field '{field_id}' confidence must be numeric")
        if c < 0.0 or c > 1.0:
            raise ValueError(f"Field '{field_id}' confidence must be in [0,1]") 