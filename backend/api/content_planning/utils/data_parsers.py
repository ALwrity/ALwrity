"""
Data Parsing Utilities
Shared utilities for parsing and validating strategy data.
"""

import json
import re
from typing import Any, Optional, Dict, List


def parse_float(value: Any) -> Optional[float]:
    """
    Parse a value to float, handling various formats.
    
    Supports:
    - Numbers (int, float)
    - Strings with numbers
    - Percentages (e.g., "25%")
    - Suffixes (e.g., "10k", "5m")
    - Comma-separated numbers
    
    Args:
        value: Value to parse
        
    Returns:
        Parsed float value or None if parsing fails
    """
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        s = value.strip().lower().replace(",", "")
        # Handle percentage
        if s.endswith('%'):
            try:
                return float(s[:-1])
            except Exception:
                pass
        # Handle k/m suffix
        mul = 1.0
        if s.endswith('k'):
            mul = 1_000.0
            s = s[:-1]
        elif s.endswith('m'):
            mul = 1_000_000.0
            s = s[:-1]
        m = re.search(r"[-+]?\d*\.?\d+", s)
        if m:
            try:
                return float(m.group(0)) * mul
            except Exception:
                return None
    return None


def parse_int(value: Any) -> Optional[int]:
    """
    Parse a value to integer.
    
    Args:
        value: Value to parse
        
    Returns:
        Parsed integer value or None if parsing fails
    """
    f = parse_float(value)
    if f is None:
        return None
    try:
        return int(round(f))
    except Exception:
        return None


def parse_json(value: Any) -> Optional[Any]:
    """
    Parse a value to JSON (dict/list) or return as-is if already structured.
    
    Args:
        value: Value to parse
        
    Returns:
        Parsed JSON value, original value if already structured, or None
    """
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            # Accept plain strings in JSON columns
            return value
    return None


def parse_array(value: Any) -> Optional[List]:
    """
    Parse a value to array/list.
    
    Supports:
    - Lists (returned as-is)
    - JSON strings
    - Comma-separated strings
    
    Args:
        value: Value to parse
        
    Returns:
        Parsed list or None if parsing fails
    """
    if value is None:
        return None
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        # Try JSON first
        try:
            j = json.loads(value)
            if isinstance(j, list):
                return j
        except Exception:
            pass
        # Try comma-separated
        parts = [p.strip() for p in value.split(',') if p.strip()]
        return parts if parts else None
    return None


def parse_strategy_data(strategy_data: Dict[str, Any]) -> tuple[Dict[str, Any], Dict[str, str]]:
    """
    Parse and validate strategy data, returning cleaned data and warnings.
    
    Args:
        strategy_data: Raw strategy data dictionary
        
    Returns:
        Tuple of (cleaned_data, warnings_dict)
    """
    warnings: Dict[str, str] = {}
    cleaned = dict(strategy_data)
    
    # Numeric fields
    content_budget = parse_float(strategy_data.get('content_budget'))
    if strategy_data.get('content_budget') is not None and content_budget is None:
        warnings['content_budget'] = 'Could not parse number; saved as null'
    cleaned['content_budget'] = content_budget
    
    team_size = parse_int(strategy_data.get('team_size'))
    if strategy_data.get('team_size') is not None and team_size is None:
        warnings['team_size'] = 'Could not parse integer; saved as null'
    cleaned['team_size'] = team_size
    
    # Array fields
    array_fields = ['preferred_formats']
    for field in array_fields:
        if field in strategy_data:
            parsed = parse_array(strategy_data.get(field))
            if strategy_data.get(field) is not None and parsed is None:
                warnings[field] = 'Could not parse list; saved as null'
            cleaned[field] = parsed
    
    # JSON fields
    json_fields = [
        'business_objectives', 'target_metrics', 'performance_metrics', 'content_preferences',
        'consumption_patterns', 'audience_pain_points', 'buying_journey', 'seasonal_trends',
        'engagement_metrics', 'top_competitors', 'competitor_content_strategies', 'market_gaps',
        'industry_trends', 'emerging_trends', 'content_mix', 'optimal_timing', 'quality_metrics',
        'editorial_guidelines', 'brand_voice', 'traffic_sources', 'conversion_rates', 'content_roi_targets',
        'target_audience', 'content_pillars', 'ai_recommendations'
    ]
    for field in json_fields:
        if field in strategy_data:
            cleaned[field] = parse_json(strategy_data.get(field))
    
    # Boolean fields
    if 'ab_testing_capabilities' in strategy_data:
        cleaned['ab_testing_capabilities'] = bool(strategy_data.get('ab_testing_capabilities'))

    return cleaned, warnings


# The 30 canonical strategy-builder fields with their expected JSON shapes.
# Mirrors the frontend STRATEGIC_INPUT_FIELDS definitions:
#   number  -> parse_float/parse_int coercion is expected (numeric strings ok)
#   boolean -> bool / 0-1 / true-false-yes-no strings
#   array   -> list / JSON array string / CSV string (parse_array handles)
#   string  -> scalar text (select/text inputs)
#   json    -> dict / list / string (parse_json handles)
STRATEGY_FIELD_TYPES: Dict[str, str] = {
    # Business Context
    'business_objectives': 'json',
    'target_metrics': 'json',
    'content_budget': 'number',
    'team_size': 'number',
    'implementation_timeline': 'string',
    'market_share': 'string',
    'competitive_position': 'string',
    'performance_metrics': 'json',
    # Audience Intelligence
    'content_preferences': 'array',
    'consumption_patterns': 'json',
    'audience_pain_points': 'array',
    'buying_journey': 'json',
    'seasonal_trends': 'array',
    'engagement_metrics': 'json',
    # Competitive Intelligence
    'top_competitors': 'array',
    'competitor_content_strategies': 'json',
    'market_gaps': 'array',
    'industry_trends': 'array',
    'emerging_trends': 'json',
    # Content Strategy
    'preferred_formats': 'array',
    'content_mix': 'json',
    'content_frequency': 'string',
    'optimal_timing': 'array',
    'quality_metrics': 'json',
    'editorial_guidelines': 'json',
    'brand_voice': 'string',
    # Performance & Analytics
    'traffic_sources': 'array',
    'conversion_rates': 'json',
    'content_roi_targets': 'json',
    'ab_testing_capabilities': 'boolean',
}

_TRUE_STRINGS = {'true', 'yes', '1'}
_FALSE_STRINGS = {'false', 'no', '0'}


def validate_strategy_fields(
    strategy_data: Dict[str, Any],
) -> tuple[List[str], Dict[str, str]]:
    """
    Type-validate the canonical strategy-builder fields BEFORE coercion.

    Lenient by design: any value ``parse_strategy_data`` can coerce (numeric
    strings, CSV/JSON strings for arrays, bool-like strings) is accepted.
    Only structurally wrong types (e.g. a dict where a number or list is
    expected) are hard errors, so the client gets a 422 naming the exact
    fields instead of silent nulls in the database.

    Returns:
        Tuple of (errors, warnings). errors: human-readable messages naming
        each offending field. warnings: dict for coercions and unknown keys.
    """
    errors: List[str] = []
    warnings: Dict[str, str] = {}
    unknown_keys: List[str] = []

    for key, value in strategy_data.items():
        expected = STRATEGY_FIELD_TYPES.get(key)
        if expected is None:
            # Non-canonical keys (name, user_id, ...) are handled elsewhere;
            # but flag obvious client-state junk so it's visible in the response.
            if key not in {'name', 'user_id', 'strategy_name', 'completion_percentage',
                           'id', 'created_at', 'updated_at', 'config',
                           # Phase D #15: known model column carrying the
                           # autofill/personalization metadata from the builder.
                           'data_source_transparency'}:
                unknown_keys.append(key)
            continue

        if value is None:
            continue

        if expected == 'number':
            if isinstance(value, bool):
                errors.append(f"{key} must be a number, got boolean")
            elif isinstance(value, (dict, list)):
                errors.append(f"{key} must be a number, got {type(value).__name__}")
            elif isinstance(value, str) and parse_float(value) is None:
                warnings[key] = 'Could not parse number; saved as null'
        elif expected == 'boolean':
            if isinstance(value, bool):
                continue
            if isinstance(value, (int, float)) and value in (0, 1):
                continue
            if isinstance(value, str) and value.strip().lower() in (_TRUE_STRINGS | _FALSE_STRINGS):
                continue
            errors.append(f"{key} must be a boolean, got {type(value).__name__}")
        elif expected == 'array':
            if isinstance(value, (dict, bool)) or isinstance(value, (int, float)):
                errors.append(f"{key} must be a list, got {type(value).__name__}")
            elif isinstance(value, str) and parse_array(value) is None:
                warnings[key] = 'Could not parse list; saved as null'
        elif expected == 'string':
            if isinstance(value, (dict, list)):
                errors.append(f"{key} must be a string, got {type(value).__name__}")
            elif isinstance(value, (int, float)) and not isinstance(value, bool):
                warnings[key] = 'Numeric value for text field; coerced to string'
        elif expected == 'json':
            # parse_json accepts dict/list/str; anything else (number/bool)
            # would be silently nulled — surface that as a warning.
            if not isinstance(value, (dict, list, str)):
                warnings[key] = f'Expected object; got {type(value).__name__}, saved as null'

    if unknown_keys:
        warnings['unknown_fields'] = (
            'Ignored unrecognized fields: ' + ', '.join(sorted(unknown_keys))
        )

    return errors, warnings
