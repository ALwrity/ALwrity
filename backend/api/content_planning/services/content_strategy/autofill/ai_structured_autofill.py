import json
import logging
import traceback
from typing import Any, Dict, List
from datetime import datetime

from services.ai_service_manager import AIServiceManager, AIServiceType

logger = logging.getLogger(__name__)

# Complete core fields - all 30+ fields that the frontend expects
CORE_FIELDS = [
    # Business Context (8 fields)
    'business_objectives', 'target_metrics', 'content_budget', 'team_size', 'implementation_timeline',
    'market_share', 'competitive_position', 'performance_metrics',
    
    # Audience Intelligence (6 fields)
    'content_preferences', 'consumption_patterns', 'audience_pain_points', 
    'buying_journey', 'seasonal_trends', 'engagement_metrics',
    
    # Competitive Intelligence (5 fields)
    'top_competitors', 'competitor_content_strategies', 'market_gaps', 'industry_trends', 'emerging_trends',
    
    # Content Strategy (7 fields)
    'preferred_formats', 'content_mix', 'content_frequency', 'optimal_timing',
    'quality_metrics', 'editorial_guidelines', 'brand_voice',
    
    # Performance & Analytics (4 fields)
    'traffic_sources', 'conversion_rates', 'content_roi_targets', 'ab_testing_capabilities'
]

JSON_FIELDS = {
    'business_objectives', 'target_metrics', 'content_preferences', 'consumption_patterns',
    'audience_pain_points', 'buying_journey', 'seasonal_trends', 'engagement_metrics',
    'competitor_content_strategies', 'market_gaps', 'industry_trends', 'emerging_trends',
    'content_mix', 'optimal_timing', 'quality_metrics', 'editorial_guidelines',
    'conversion_rates', 'content_roi_targets', 'performance_metrics'
}

ARRAY_FIELDS = {
    'preferred_formats', 'top_competitors', 'market_gaps', 'industry_trends', 'traffic_sources'
}

# Select field options mapping for value normalization
SELECT_FIELD_OPTIONS = {
    'implementation_timeline': ['3 months', '6 months', '1 year', '2 years', 'Ongoing'],
    'competitive_position': ['Leader', 'Challenger', 'Niche', 'Emerging'],
    'content_frequency': ['Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'Quarterly'],
    'brand_voice': ['Professional', 'Casual', 'Friendly', 'Authoritative', 'Innovative']
}

class AIStructuredAutofillService:
    """Generate the complete Strategy Builder fields strictly from AI using onboarding context only."""

    def __init__(self) -> None:
        self.ai = AIServiceManager()
        self.max_retries = 2  # Maximum retry attempts for malformed JSON

    def _build_context_summary(self, context: Dict[str, Any]) -> Dict[str, Any]:
        website = context.get('website_analysis') or {}
        research = context.get('research_preferences') or {}
        api_keys = context.get('api_keys_data') or {}
        session = context.get('onboarding_session') or {}
        
        # Extract detailed personalization data
        writing_style = website.get('writing_style', {})
        target_audience = website.get('target_audience', {})
        content_type = website.get('content_type', {})
        recommended_settings = website.get('recommended_settings', {})
        content_characteristics = website.get('content_characteristics', {})
        
        summary = {
            'user_profile': {
                'website_url': website.get('website_url'),
                'business_size': session.get('business_size'),
                'region': session.get('region'),
                'onboarding_progress': session.get('progress', 0)
            },
            'content_analysis': {
                'writing_style': {
                    'tone': writing_style.get('tone'),
                    'voice': writing_style.get('voice'),
                    'complexity': writing_style.get('complexity'),
                    'engagement_level': writing_style.get('engagement_level')
                },
                'content_characteristics': {
                    'sentence_structure': content_characteristics.get('sentence_structure'),
                    'vocabulary': content_characteristics.get('vocabulary'),
                    'paragraph_organization': content_characteristics.get('paragraph_organization')
                },
                'content_type': {
                    'primary_type': content_type.get('primary_type'),
                    'secondary_types': content_type.get('secondary_types'),
                    'purpose': content_type.get('purpose')
                }
            },
            'audience_insights': {
                'demographics': target_audience.get('demographics'),
                'expertise_level': target_audience.get('expertise_level'),
                'industry_focus': target_audience.get('industry_focus'),
                'pain_points': target_audience.get('pain_points'),
                'content_preferences': target_audience.get('content_preferences')
            },
            'ai_recommendations': {
                'recommended_tone': recommended_settings.get('writing_tone'),
                'recommended_audience': recommended_settings.get('target_audience'),
                'recommended_content_type': recommended_settings.get('content_type'),
                'style_guidelines': website.get('style_guidelines')
            },
            'research_config': {
                'research_depth': research.get('research_depth'),
                'content_types': research.get('content_types'),
                'auto_research': research.get('auto_research'),
                'factual_content': research.get('factual_content')
            },
            'api_capabilities': {
                'providers': api_keys.get('providers', []),
                'total_keys': api_keys.get('total_keys', 0),
                'available_services': self._extract_available_services(api_keys)
            },
            'data_quality': {
                'website_freshness': website.get('data_freshness'),
                'confidence_level': website.get('confidence_level'),
                'analysis_status': website.get('status')
            }
        }
        
        try:
            logger.debug(
                "AI Structured Autofill: personalized context | website=%s research=%s api=%s session=%s",
                bool(website), bool(research), bool(api_keys), bool(session)
            )
            logger.debug(
                "AI Structured Autofill: personalization data | writing_style=%s target_audience=%s content_type=%s",
                bool(writing_style), bool(target_audience), bool(content_type)
            )
        except Exception:
            pass
        return summary

    def _extract_available_services(self, api_keys: Dict[str, Any]) -> List[str]:
        """Extract available services from API keys."""
        services = []
        providers = api_keys.get('providers', [])
        
        # Map providers to services
        provider_service_map = {
            'google_search_console': ['SEO Analytics', 'Search Performance'],
            'google_analytics': ['Web Analytics', 'User Behavior'],
            'semrush': ['Competitive Analysis', 'Keyword Research'],
            'ahrefs': ['Backlink Analysis', 'SEO Tools'],
            'moz': ['SEO Tools', 'Rank Tracking'],
            'social_media': ['Social Media Analytics', 'Social Listening']
        }
        
        for provider in providers:
            if provider in provider_service_map:
                services.extend(provider_service_map[provider])
        
        return list(set(services))  # Remove duplicates

    def _build_schema(self) -> Dict[str, Any]:
        # Simplified schema following Gemini best practices
        # Reduce complexity by flattening nested structures and simplifying constraints
        properties: Dict[str, Any] = {}
        
        # Simplified field definitions - avoid complex constraints that cause 400 errors
        field_definitions = {
            # Core business fields (simplified)
            'business_objectives': {"type": "STRING", "description": "Business goals and objectives"},
            'target_metrics': {"type": "STRING", "description": "KPIs and success metrics"},
            'content_budget': {"type": "NUMBER", "description": "Monthly content budget in dollars"},
            'team_size': {"type": "NUMBER", "description": "Number of people in content team"},
            'implementation_timeline': {"type": "STRING", "description": "Strategy implementation timeline"},
            'market_share': {"type": "STRING", "description": "Current market share percentage"},
            'competitive_position': {"type": "STRING", "description": "Market competitive position"},
            'performance_metrics': {"type": "STRING", "description": "Current performance data"},
            
            # Audience fields (simplified)
            'content_preferences': {"type": "STRING", "description": "Content format and topic preferences"},
            'consumption_patterns': {"type": "STRING", "description": "When and how audience consumes content"},
            'audience_pain_points': {"type": "STRING", "description": "Key audience challenges and pain points"},
            'buying_journey': {"type": "STRING", "description": "Customer journey stages and touchpoints"},
            'seasonal_trends': {"type": "STRING", "description": "Seasonal content patterns and trends"},
            'engagement_metrics': {"type": "STRING", "description": "Current engagement data and metrics"},
            
            # Competitive fields (simplified)
            'top_competitors': {"type": "STRING", "description": "Main competitors"},
            'competitor_content_strategies': {"type": "STRING", "description": "Analysis of competitor content approaches"},
            'market_gaps': {"type": "STRING", "description": "Market opportunities and gaps"},
            'industry_trends': {"type": "STRING", "description": "Current industry trends"},
            'emerging_trends': {"type": "STRING", "description": "Upcoming trends and opportunities"},
            
            # Content strategy fields (simplified)
            'preferred_formats': {"type": "STRING", "description": "Preferred content formats"},
            'content_mix': {"type": "STRING", "description": "Content mix distribution"},
            'content_frequency': {"type": "STRING", "description": "Content publishing frequency"},
            'optimal_timing': {"type": "STRING", "description": "Best times for publishing content"},
            'quality_metrics': {"type": "STRING", "description": "Content quality standards and metrics"},
            'editorial_guidelines': {"type": "STRING", "description": "Style and tone guidelines"},
            'brand_voice': {"type": "STRING", "description": "Brand voice and tone"},
            
            # Performance fields (simplified)
            'traffic_sources': {"type": "STRING", "description": "Primary traffic sources"},
            'conversion_rates': {"type": "STRING", "description": "Target conversion rates and metrics"},
            'content_roi_targets': {"type": "STRING", "description": "ROI goals and targets for content"},
            'ab_testing_capabilities': {"type": "BOOLEAN", "description": "Whether A/B testing capabilities are available"}
        }
        
        # Build properties from field definitions
        for field_id in CORE_FIELDS:
            if field_id in field_definitions:
                properties[field_id] = field_definitions[field_id]
            else:
                # Fallback for any missing fields
                properties[field_id] = {"type": "STRING", "description": f"Value for {field_id}"}
        
        # Use propertyOrdering as recommended by Gemini docs for consistent output
        schema = {
            "type": "OBJECT",
            "properties": properties,
            "required": CORE_FIELDS,  # Make all fields required
            "propertyOrdering": CORE_FIELDS,  # Critical for consistent JSON output
            "description": "Content strategy fields with simplified constraints"
        }
        
        logger.debug("AI Structured Autofill: simplified schema built with %d properties and property ordering", len(CORE_FIELDS))
        return schema

    def _build_prompt(self, context_summary: Dict[str, Any]) -> str:
        # Build personalized prompt using actual user data
        user_profile = context_summary.get('user_profile', {})
        content_analysis = context_summary.get('content_analysis', {})
        audience_insights = context_summary.get('audience_insights', {})
        ai_recommendations = context_summary.get('ai_recommendations', {})
        research_config = context_summary.get('research_config', {})
        api_capabilities = context_summary.get('api_capabilities', {})
        
        # Extract specific personalization data
        website_url = user_profile.get('website_url', 'your website')
        writing_tone = content_analysis.get('writing_style', {}).get('tone', 'professional')
        target_demographics = audience_insights.get('demographics', ['professionals'])
        industry_focus = audience_insights.get('industry_focus', 'general')
        expertise_level = audience_insights.get('expertise_level', 'intermediate')
        primary_content_type = content_analysis.get('content_type', {}).get('primary_type', 'blog')
        research_depth = research_config.get('research_depth', 'Standard')
        available_services = api_capabilities.get('available_services', [])
        
        # Build personalized context description
        personalization_context = f"""
PERSONALIZED CONTEXT FOR {website_url.upper()}:

🎯 YOUR BUSINESS PROFILE:
- Website: {website_url}
- Industry Focus: {industry_focus}
- Business Size: {user_profile.get('business_size', 'SME')}
- Region: {user_profile.get('region', 'Global')}

📝 YOUR CONTENT ANALYSIS:
- Current Writing Tone: {writing_tone}
- Primary Content Type: {primary_content_type}
- Target Demographics: {', '.join(target_demographics) if isinstance(target_demographics, list) else target_demographics}
- Audience Expertise Level: {expertise_level}
- Content Purpose: {content_analysis.get('content_type', {}).get('purpose', 'informational')}

🔍 YOUR AUDIENCE INSIGHTS:
- Pain Points: {audience_insights.get('pain_points', 'time constraints, complexity')}
- Content Preferences: {audience_insights.get('content_preferences', 'educational, actionable')}
- Industry Focus: {industry_focus}

🤖 AI RECOMMENDATIONS FOR YOUR SITE:
- Recommended Tone: {ai_recommendations.get('recommended_tone', writing_tone)}
- Recommended Content Type: {ai_recommendations.get('recommended_content_type', primary_content_type)}
- Style Guidelines: {ai_recommendations.get('style_guidelines', 'professional, engaging')}

⚙️ YOUR RESEARCH CONFIGURATION:
- Research Depth: {research_depth}
- Content Types: {', '.join(research_config.get('content_types', ['blog', 'article'])) if isinstance(research_config.get('content_types'), list) else research_config.get('content_types', 'blog, article')}
- Auto Research: {research_config.get('auto_research', True)}
- Factual Content: {research_config.get('factual_content', True)}

🔧 YOUR AVAILABLE TOOLS:
- Analytics Services: {', '.join(available_services) if available_services else 'Basic analytics'}
- API Providers: {', '.join(api_capabilities.get('providers', [])) if api_capabilities.get('providers') else 'Manual tracking'}
"""

        # Personalized prompt with specific instructions
        prompt = f"""
You are a content strategy expert analyzing {website_url}. Based on the detailed analysis of this website and user's onboarding data, generate a personalized content strategy with exactly 30 fields.

{personalization_context}

IMPORTANT: Make each field specific to {website_url} and the user's actual data. Avoid generic placeholder values. Use the real insights from their website analysis.

Generate a JSON object with exactly 30 fields using this exact format:

{{
"business_objectives": "Specific goals for {website_url} based on {industry_focus} industry",
"target_metrics": "Realistic KPIs for {user_profile.get('business_size', 'SME')} business",
"content_budget": 3000,
"team_size": 3,
"implementation_timeline": "6 months",
"market_share": "15%",
"competitive_position": "Leader",
"performance_metrics": "Current performance data for {website_url}",
"content_preferences": "Content formats preferred by {', '.join(target_demographics) if isinstance(target_demographics, list) else target_demographics} audience",
"consumption_patterns": "When {expertise_level} level audience consumes content",
"audience_pain_points": "Specific challenges for {industry_focus} professionals",
"buying_journey": "Customer journey for {industry_focus} industry",
"seasonal_trends": "Seasonal patterns in {industry_focus}",
"engagement_metrics": "Expected engagement for {writing_tone} tone content",
"top_competitors": "Main competitors in {industry_focus} space",
"competitor_content_strategies": "How competitors approach {primary_content_type} content",
"market_gaps": "Opportunities in {industry_focus} content market",
"industry_trends": "Current trends in {industry_focus} industry",
"emerging_trends": "Upcoming trends for {industry_focus}",
"preferred_formats": "Formats that work for {expertise_level} audience",
"content_mix": "Optimal mix for {primary_content_type} focus",
"content_frequency": "Frequency for {research_depth} research depth",
"optimal_timing": "Best times for {target_demographics[0] if isinstance(target_demographics, list) and target_demographics else 'your'} audience",
"quality_metrics": "Quality standards for {writing_tone} content",
"editorial_guidelines": "Guidelines matching {writing_tone} tone",
"brand_voice": "{writing_tone.title()}",
"traffic_sources": "Primary sources for {industry_focus} content",
"conversion_rates": "Realistic rates for {user_profile.get('business_size', 'SME')}",
"content_roi_targets": "ROI goals for {industry_focus} content",
"ab_testing_capabilities": true
}}

Generate the complete JSON with all 30 fields personalized for {website_url}:
"""
        
        logger.debug("AI Structured Autofill: personalized prompt (%d chars)", len(prompt))
        return prompt

    def _normalize_value(self, key: str, value: Any) -> Any:
        if value is None:
            return None
            
        # Handle numeric fields that might come as text
        if key in ['content_budget', 'team_size']:
            if isinstance(value, (int, float)):
                return value
            elif isinstance(value, str):
                # Extract numeric value from text
                import re
                # Remove currency symbols, commas, and common words
                cleaned = re.sub(r'[$,€£¥]', '', value.lower())
                cleaned = re.sub(r'\b(monthly|yearly|annual|people|person|specialist|creator|writer|editor|team|member)\b', '', cleaned)
                cleaned = re.sub(r'\s+', ' ', cleaned).strip()
                
                # Extract first number found
                numbers = re.findall(r'\d+(?:\.\d+)?', cleaned)
                if numbers:
                    try:
                        num_value = float(numbers[0])
                        # For team_size, convert to integer
                        if key == 'team_size':
                            return int(num_value)
                        return num_value
                    except (ValueError, TypeError):
                        pass
                
                logger.warning(f"Could not extract numeric value from '{key}' field: '{value}'")
                return None
        
        # Handle boolean fields
        if key == 'ab_testing_capabilities':
            if isinstance(value, bool):
                return value
            elif isinstance(value, str):
                normalized_value = value.lower().strip()
                if normalized_value in ['true', 'yes', 'available', 'enabled', '1']:
                    return True
                elif normalized_value in ['false', 'no', 'unavailable', 'disabled', '0']:
                    return False
                logger.warning(f"Could not parse boolean value for '{key}': '{value}'")
                return None
        
        # Handle select fields with predefined options
        if key in SELECT_FIELD_OPTIONS:
            if isinstance(value, str):
                # Try exact match first (case-insensitive)
                normalized_value = value.lower().strip()
                for option in SELECT_FIELD_OPTIONS[key]:
                    if normalized_value == option.lower():
                        return option
                
                # Try partial matching for common variations
                for option in SELECT_FIELD_OPTIONS[key]:
                    option_lower = option.lower()
                    # Handle common variations
                    if (normalized_value.startswith(option_lower) or 
                        option_lower in normalized_value or
                        normalized_value.endswith(option_lower)):
                        return option
                
                # Special handling for content_frequency
                if key == 'content_frequency':
                    if 'daily' in normalized_value:
                        return 'Daily'
                    elif 'weekly' in normalized_value or 'week' in normalized_value:
                        return 'Weekly'
                    elif 'bi-weekly' in normalized_value or 'biweekly' in normalized_value:
                        return 'Bi-weekly'
                    elif 'monthly' in normalized_value or 'month' in normalized_value:
                        return 'Monthly'
                    elif 'quarterly' in normalized_value or 'quarter' in normalized_value:
                        return 'Quarterly'
                
                # If no match found, return the first option as fallback
                logger.warning(f"Could not normalize select field '{key}' value: '{value}' to valid options: {SELECT_FIELD_OPTIONS[key]}")
                return SELECT_FIELD_OPTIONS[key][0]  # Return first option as fallback
        
        # For all other fields, ensure they're strings and not empty
        if isinstance(value, str):
            # Special handling for multiselect fields
            if key in ['preferred_formats', 'top_competitors', 'market_gaps', 'industry_trends', 'traffic_sources']:
                # Split by comma and clean up each item
                items = [item.strip() for item in value.split(',') if item.strip()]
                if items:
                    return items  # Return as array for multiselect fields
                return None
            return value.strip() if value.strip() else None
        elif isinstance(value, (int, float, bool)):
            return str(value)
        elif isinstance(value, list):
            # For multiselect fields, return the list as-is
            if key in ['preferred_formats', 'top_competitors', 'market_gaps', 'industry_trends', 'traffic_sources']:
                return [str(item) for item in value if item]
            # For other fields, convert arrays to comma-separated strings
            return ', '.join(str(item) for item in value if item)
        else:
            return str(value) if value else None

    def _calculate_success_rate(self, result: Dict[str, Any]) -> float:
        """Calculate the percentage of successfully filled fields."""
        if not isinstance(result, dict):
            return 0.0
        
        filled_fields = 0
        for key in CORE_FIELDS:
            value = result.get(key)
            if value is not None and value != "" and value != []:
                # Additional checks for different data types
                if isinstance(value, str) and value.strip():
                    filled_fields += 1
                elif isinstance(value, (int, float)) and value != 0:
                    filled_fields += 1
                elif isinstance(value, bool):
                    filled_fields += 1
                elif isinstance(value, list) and len(value) > 0:
                    filled_fields += 1
                elif value is not None and value != "":
                    filled_fields += 1
        
        return (filled_fields / len(CORE_FIELDS)) * 100

    def _should_retry(self, result: Dict[str, Any], attempt: int) -> bool:
        """Determine if we should retry based on success rate and attempt count."""
        if attempt >= self.max_retries:
            return False
        
        # Check if result has error
        if 'error' in result:
            logger.info(f"Retry attempt {attempt + 1} due to error: {result.get('error')}")
            return True
        
        # Check success rate - stop immediately if we have 100% success
        success_rate = self._calculate_success_rate(result)
        logger.info(f"Success rate: {success_rate:.1f}% (attempt {attempt + 1})")
        
        # If we have 100% success, don't retry
        if success_rate >= 100.0:
            logger.info(f"Perfect success rate achieved: {success_rate:.1f}% - no retry needed")
            return False
        
        # Retry if success rate is below 80% (more aggressive than 50%)
        if success_rate < 80.0:
            logger.info(f"Retry attempt {attempt + 1} due to low success rate: {success_rate:.1f}% (need 80%+)")
            return True
        
        # Also retry if we're missing more than 6 fields (20% of 30 fields)
        missing_count = len([k for k in CORE_FIELDS if not result.get(k) or result.get(k) == "" or result.get(k) == []])
        if missing_count > 6:
            logger.info(f"Retry attempt {attempt + 1} due to too many missing fields: {missing_count} missing (max 6)")
            return True
        
        return False

    async def generate_autofill_fields(self, user_id: int, context: Dict[str, Any]) -> Dict[str, Any]:
        context_summary = self._build_context_summary(context)
        schema = self._build_schema()
        prompt = self._build_prompt(context_summary)

        logger.info("AIStructuredAutofillService: generating %d fields | user=%s", len(CORE_FIELDS), user_id)
        logger.debug("AIStructuredAutofillService: properties=%d", len(schema.get('properties', {})))
        
        # Log context summary for debugging
        logger.info("AIStructuredAutofillService: context summary | user=%s", user_id)
        logger.info("  - Website analysis exists: %s", bool(context_summary.get('user_profile', {}).get('website_url')))
        logger.info("  - Research config: %s", context_summary.get('research_config', {}).get('research_depth', 'None'))
        logger.info("  - API capabilities: %s", len(context_summary.get('api_capabilities', {}).get('providers', [])))
        logger.info("  - Content analysis: %s", bool(context_summary.get('content_analysis')))
        logger.info("  - Audience insights: %s", bool(context_summary.get('audience_insights')))
        
        # Log prompt length for debugging
        logger.info("AIStructuredAutofillService: prompt length=%d chars | user=%s", len(prompt), user_id)
        
        last_result = None
        for attempt in range(self.max_retries + 1):
            try:
                logger.info(f"AI structured call attempt {attempt + 1}/{self.max_retries + 1} | user=%s", user_id)
                result = await self.ai.execute_structured_json_call(
                    service_type=AIServiceType.STRATEGIC_INTELLIGENCE,
                    prompt=prompt,
                    schema=schema
                )
                last_result = result
                
                # Log AI response details
                logger.info(f"AI response received | attempt={attempt + 1} | user=%s", user_id)
                if isinstance(result, dict):
                    logger.info(f"  - Response keys: {list(result.keys())}")
                    logger.info(f"  - Response type: dict with {len(result)} items")
                    
                    # Handle wrapped response from AI service manager
                    if 'data' in result and 'success' in result:
                        # This is a wrapped response from AI service manager
                        if result.get('success'):
                            # Extract the actual AI response from the 'data' field
                            ai_response = result.get('data', {})
                            logger.info(f"  - Extracted AI response from wrapped response")
                            logger.info(f"  - AI response keys: {list(ai_response.keys()) if isinstance(ai_response, dict) else 'N/A'}")
                            last_result = ai_response
                        else:
                            # AI service failed
                            error_msg = result.get('error', 'Unknown AI service error')
                            logger.error(f"  - AI service failed: {error_msg}")
                            last_result = {'error': error_msg}
                    elif 'error' in result:
                        logger.error(f"  - AI returned error: {result['error']}")
                else:
                    logger.warning(f"  - Response type: {type(result)}")
                
                # Check if we should retry
                if not self._should_retry(last_result, attempt):
                    logger.info(f"Retry not needed | attempt={attempt + 1} | user=%s", user_id)
                    break
                    
                # Add a small delay before retry
                if attempt < self.max_retries:
                    import asyncio
                    await asyncio.sleep(1)
                    
            except Exception as e:
                logger.error(f"AI structured call failed (attempt {attempt + 1}) | user=%s | err=%s", user_id, repr(e))
                logger.error("Traceback:\n%s", traceback.format_exc())
                last_result = {
                    'error': str(e)
                }
                if attempt < self.max_retries:
                    import asyncio
                    await asyncio.sleep(1)
                    continue
                break

        # Process the final result
        if not isinstance(last_result, dict):
            logger.warning("AI did not return a structured JSON object, got: %s", type(last_result))
            return {
                'fields': {},
                'sources': {},
                'meta': {
                    'ai_used': False,
                    'ai_overrides_count': 0,
                    'missing_fields': CORE_FIELDS,
                    'error': f"AI returned {type(last_result)} instead of dict",
                    'attempts': self.max_retries + 1
                }
            }

        # Check if AI returned an error
        if 'error' in last_result:
            logger.warning("AI returned error after all attempts: %s", last_result.get('error'))
            return {
                'fields': {},
                'sources': {},
                'meta': {
                    'ai_used': False,
                    'ai_overrides_count': 0,
                    'missing_fields': CORE_FIELDS,
                    'error': last_result.get('error', 'Unknown AI error'),
                    'attempts': self.max_retries + 1
                }
            }

        # Try to extract fields from malformed JSON if needed
        if len(last_result) < len(CORE_FIELDS) * 0.5:  # If we got less than 50% of fields
            logger.warning("AI returned incomplete result, attempting to extract from raw response")
            # Try to extract key-value pairs from the raw response
            extracted_result = self._extract_fields_from_raw_response(last_result)
            if extracted_result and len(extracted_result) > len(last_result):
                logger.info("Successfully extracted additional fields from raw response")
                last_result = extracted_result

        try:
            logger.debug("AI structured result keys=%d | sample keys=%s", len(list(last_result.keys())), list(last_result.keys())[:8])
        except Exception:
            pass

        # Build UI fields map using only non-null normalized values
        fields: Dict[str, Any] = {}
        sources: Dict[str, str] = {}
        non_null_keys = []
        missing_fields = []
        
        for key in CORE_FIELDS:
            raw_value = last_result.get(key)
            norm_value = self._normalize_value(key, raw_value)
            if norm_value is not None and norm_value != "" and norm_value != []:
                # Add personalization metadata to each field
                personalized_metadata = self._add_personalization_metadata(key, norm_value, context_summary)
                fields[key] = { 
                    'value': norm_value, 
                    'source': 'ai_generated', 
                    'confidence': 0.8,
                    'personalized': True,
                    'personalization_data': personalized_metadata
                }
                sources[key] = 'ai_generated'
                non_null_keys.append(key)
            else:
                missing_fields.append(key)
        
        # Log detailed field analysis
        logger.info("AI structured autofill field analysis:")
        logger.info("✅ Generated fields (%d): %s", len(non_null_keys), non_null_keys)
        logger.info("❌ Missing fields (%d): %s", len(missing_fields), missing_fields)
        
        # Categorize missing fields
        field_categories = {
            'business_context': ['business_objectives', 'target_metrics', 'content_budget', 'team_size', 'implementation_timeline', 'market_share', 'competitive_position', 'performance_metrics'],
            'audience_intelligence': ['content_preferences', 'consumption_patterns', 'audience_pain_points', 'buying_journey', 'seasonal_trends', 'engagement_metrics'],
            'competitive_intelligence': ['top_competitors', 'competitor_content_strategies', 'market_gaps', 'industry_trends', 'emerging_trends'],
            'content_strategy': ['preferred_formats', 'content_mix', 'content_frequency', 'optimal_timing', 'quality_metrics', 'editorial_guidelines', 'brand_voice'],
            'performance_analytics': ['traffic_sources', 'conversion_rates', 'content_roi_targets', 'ab_testing_capabilities']
        }
        
        # Log category-wise success rates
        for category, category_fields in field_categories.items():
            generated_count = len([f for f in category_fields if f in non_null_keys])
            missing_count = len([f for f in category_fields if f in missing_fields])
            logger.info(f"📊 {category.upper()}: {generated_count}/{len(category_fields)} fields generated ({missing_count} missing: {[f for f in category_fields if f in missing_fields]})")
        
        success_rate = self._calculate_success_rate(last_result)
        logger.info(f"AI structured autofill completed | non_null_fields={len(non_null_keys)} missing={len(missing_fields)} success_rate={success_rate:.1f}% attempts={self.max_retries + 1}")

        return {
            'fields': fields,
            'sources': sources,
            'meta': {
                'ai_used': True,
                'ai_overrides_count': len(non_null_keys),
                'missing_fields': missing_fields,
                'success_rate': success_rate,
                'attempts': self.max_retries + 1,
                'personalization_level': 'high',
                'data_sources_used': list(set(sources.values())),
                'website_analyzed': context_summary.get('user_profile', {}).get('website_url'),
                'generated_at': datetime.utcnow().isoformat()
            }
        }

    def _add_personalization_metadata(self, field_key: str, value: Any, context_summary: Dict[str, Any]) -> Dict[str, Any]:
        """Add personalization metadata to explain how the value was personalized."""
        user_profile = context_summary.get('user_profile', {})
        content_analysis = context_summary.get('content_analysis', {})
        audience_insights = context_summary.get('audience_insights', {})
        ai_recommendations = context_summary.get('ai_recommendations', {})
        
        website_url = user_profile.get('website_url', 'your website')
        writing_tone = content_analysis.get('writing_style', {}).get('tone', 'professional')
        industry_focus = audience_insights.get('industry_focus', 'general')
        expertise_level = audience_insights.get('expertise_level', 'intermediate')
        
        # Create personalized explanation for each field
        personalization_explanations = {
            'business_objectives': f"Based on {industry_focus} industry analysis and {user_profile.get('business_size', 'SME')} business profile",
            'target_metrics': f"Realistic KPIs for {user_profile.get('business_size', 'SME')} business in {industry_focus}",
            'content_budget': f"Budget recommendation based on {user_profile.get('business_size', 'SME')} scale and {industry_focus} content needs",
            'team_size': f"Team size optimized for {user_profile.get('business_size', 'SME')} business and {content_analysis.get('content_type', {}).get('primary_type', 'blog')} content",
            'implementation_timeline': f"Timeline based on {user_profile.get('business_size', 'SME')} resources and {industry_focus} complexity",
            'market_share': f"Market position analysis for {industry_focus} industry",
            'competitive_position': f"Competitive analysis for {industry_focus} market",
            'performance_metrics': f"Current performance data from {website_url} analysis",
            'content_preferences': f"Formats preferred by {', '.join(audience_insights.get('demographics', ['professionals']))} audience",
            'consumption_patterns': f"Patterns for {expertise_level} level audience in {industry_focus}",
            'audience_pain_points': f"Specific challenges for {industry_focus} professionals",
            'buying_journey': f"Customer journey mapped for {industry_focus} industry",
            'seasonal_trends': f"Seasonal patterns specific to {industry_focus} content",
            'engagement_metrics': f"Expected engagement for {writing_tone} tone content",
            'top_competitors': f"Main competitors in {industry_focus} space",
            'competitor_content_strategies': f"Competitor analysis for {industry_focus} content strategies",
            'market_gaps': f"Opportunities identified in {industry_focus} content market",
            'industry_trends': f"Current trends in {industry_focus} industry",
            'emerging_trends': f"Upcoming trends for {industry_focus} content",
            'preferred_formats': f"Formats optimized for {expertise_level} audience",
            'content_mix': f"Optimal mix for {content_analysis.get('content_type', {}).get('primary_type', 'blog')} focus",
            'content_frequency': f"Frequency based on {context_summary.get('research_config', {}).get('research_depth', 'Standard')} research depth",
            'optimal_timing': f"Best times for {audience_insights.get('demographics', ['professionals'])[0] if isinstance(audience_insights.get('demographics'), list) and audience_insights.get('demographics') else 'your'} audience",
            'quality_metrics': f"Quality standards for {writing_tone} content",
            'editorial_guidelines': f"Guidelines matching {writing_tone} tone from {website_url} analysis",
            'brand_voice': f"Voice derived from {writing_tone} tone analysis of {website_url}",
            'traffic_sources': f"Primary sources for {industry_focus} content",
            'conversion_rates': f"Realistic rates for {user_profile.get('business_size', 'SME')} business",
            'content_roi_targets': f"ROI goals for {industry_focus} content",
            'ab_testing_capabilities': f"A/B testing availability based on {user_profile.get('business_size', 'SME')} capabilities"
        }
        
        return {
            'explanation': personalization_explanations.get(field_key, f"Personalized for {website_url}"),
            'data_sources': {
                'website_analysis': bool(context_summary.get('content_analysis')),
                'audience_insights': bool(context_summary.get('audience_insights')),
                'ai_recommendations': bool(context_summary.get('ai_recommendations')),
                'research_config': bool(context_summary.get('research_config'))
            },
            'personalization_factors': {
                'website_url': website_url,
                'industry_focus': industry_focus,
                'writing_tone': writing_tone,
                'expertise_level': expertise_level,
                'business_size': user_profile.get('business_size', 'SME')
            }
        }

    def _extract_fields_from_raw_response(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Extract fields from malformed JSON response using regex patterns."""
        import re
        
        # Convert result to string for pattern matching
        result_str = str(result)
        
        extracted = {}
        
        # Pattern to match key-value pairs in JSON-like format
        patterns = [
            r'"([^"]+)":\s*"([^"]*)"',  # String values
            r'"([^"]+)":\s*(\d+(?:\.\d+)?)',  # Numeric values
            r'"([^"]+)":\s*(true|false)',  # Boolean values
            r'"([^"]+)":\s*\[([^\]]*)\]',  # Array values
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, result_str)
            for key, value in matches:
                if key in CORE_FIELDS:
                    # Clean up the value
                    if value.lower() in ['true', 'false']:
                        extracted[key] = value.lower() == 'true'
                    elif value.replace('.', '').isdigit():
                        extracted[key] = float(value) if '.' in value else int(value)
                    else:
                        extracted[key] = value.strip('"')
        
        logger.info("Extracted %d fields from raw response: %s", len(extracted), list(extracted.keys()))
        return extracted 