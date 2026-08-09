"""Style Detection Logic Service for ALwrity Backend.

This service handles business logic for content style detection and analysis,
migrated from the legacy StyleAnalyzer functionality.
"""

from typing import Dict, Any, List, Optional
from loguru import logger
from datetime import datetime
import json
import re
import sys
import os
import requests
from ..seo_analyzer.analyzers import (
    MetaDataAnalyzer,
    TechnicalSEOAnalyzer,
    ContentAnalyzer,
    PerformanceAnalyzer,
    URLStructureAnalyzer,
    AccessibilityAnalyzer,
    UserExperienceAnalyzer
)
from bs4 import BeautifulSoup

# Add the backend directory to Python path for absolute imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

# Import the new backend LLM providers from services
from ..llm_providers.main_text_generation import llm_text_gen

class StyleDetectionLogic:
    """Business logic for content style detection and analysis."""
    
    def __init__(self):
        """Initialize the Style Detection Logic service."""
        logger.info("[StyleDetectionLogic.__init__] Initializing style detection service")
        
    def _clean_json_response(self, text: str) -> str:
        """
        Clean the LLM response to extract valid JSON.
        
        Args:
            text (str): Raw response from LLM
            
        Returns:
            str: Cleaned JSON string
        """
        try:
            if not isinstance(text, str):
                text = str(text)
            # Remove markdown code block markers
            cleaned_string = text.replace("```json", "").replace("```", "").strip()
            
            # Log the cleaned JSON for debugging
            logger.debug(f"[StyleDetectionLogic._clean_json_response] Cleaned JSON: {cleaned_string}")
            
            return cleaned_string
            
        except Exception as e:
            logger.error(f"[StyleDetectionLogic._clean_json_response] Error cleaning response: {str(e)}")
            return ""

    def _generate_json_via_llm(self, prompt: str, user_id: str, max_repairs: int = 2) -> Dict[str, Any]:
        """Generate JSON from LLM with structured output + repair retry.

        Uses native JSON mode (response_format=json_object) for WaveSpeed
        to guarantee valid JSON on first attempt. Falls back to repair
        prompts only if the structured output path itself fails.
        """
        last_raw = ""
        last_error = None
        json_struct = {"type": "object"}  # triggers native JSON mode

        for attempt in range(max_repairs + 1):
            if attempt == 0:
                raw = llm_text_gen(prompt, user_id=user_id, json_struct=json_struct, trace_id=f"alwrity_step1_{user_id}", retry_count=0)
            else:
                raw_display = str(last_raw)[:2000] if not isinstance(last_raw, str) else last_raw[:2000]
                repair_prompt = (
                    f"Your previous JSON output could not be parsed: {last_error}\n\n"
                    f"PREVIOUS RAW OUTPUT:\n{raw_display}\n\n"
                    f"FIX THE PARSE ERROR and return ONLY valid minified JSON matching "
                    f"the original schema. No markdown, no code fences.\n\n"
                    f"ORIGINAL TASK:\n{prompt}"
                )
                logger.info(f"[style_detection_logic] JSON repair attempt {attempt}/{max_repairs}")
                raw = llm_text_gen(repair_prompt, user_id=user_id, json_struct=json_struct, trace_id=f"alwrity_step1_{user_id}", retry_count=attempt)

            cleaned = self._clean_json_response(raw)
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError as e:
                # Fallback 1: Python dict syntax (single quotes)
                try:
                    import ast
                    parsed = ast.literal_eval(cleaned)
                    return parsed if isinstance(parsed, dict) else json.loads(cleaned)
                except (ValueError, SyntaxError):
                    pass
                # Fallback 2: extract JSON/dict from surrounding text
                import re
                match = re.search(r'\{.*\}', cleaned, re.DOTALL)
                if match:
                    extracted = match.group(0)
                    try:
                        return json.loads(extracted)
                    except json.JSONDecodeError:
                        try:
                            import ast
                            return ast.literal_eval(extracted)
                        except (ValueError, SyntaxError):
                            pass
                last_raw = raw
                last_error = str(e)[:300]
                logger.warning(
                    f"[style_detection_logic] JSON parse failed (attempt {attempt + 1}/{max_repairs + 1}): {last_error} | cleaned[:150]={cleaned[:150]}"
                )

        raise ValueError(f"JSON generation failed after {max_repairs + 1} attempts: {last_error}")

    def analyze_content_style(self, content: Dict[str, Any], user_id: str = None) -> Dict[str, Any]:
        """
        Analyze the style of the provided content using AI with enhanced prompts.
        
        Args:
            content (Dict): Content to analyze, containing main_content, title, etc.
            user_id (str): User ID for subscription checking.
            
        Returns:
            Dict: Analysis results with writing style, characteristics, and recommendations
        """
        try:
            logger.info("[StyleDetectionLogic.analyze_content_style] Starting enhanced style analysis")
            
            # Extract content components
            title = content.get('title', '')
            description = content.get('description', '')
            main_content = content.get('main_content', '')
            headings = content.get('headings', [])
            domain_info = content.get('domain_info', {})
            brand_info = content.get('brand_info', {})
            social_media = content.get('social_media', {})
            content_structure = content.get('content_structure', {})
            exa_summary = content.get('exa_summary', '')
            exa_highlights = content.get('exa_highlights', [])

            # Build Exa context block if available
            exa_context = ""
            if exa_summary:
                exa_context += f"\n            PAGE SUMMARY (AI-generated):\n            {exa_summary[:500]}\n"
            if exa_highlights:
                exa_context += f"\n            KEY POINTS:\n            " + "\n            ".join(f"- {h}" for h in exa_highlights[:6]) + "\n"

            # Construct the enhanced analysis prompt (strict JSON, minified, stable keys)
            prompt = f"""Analyze the following website content for comprehensive writing style, tone, and characteristics for personalization and AI generation.

            RULES:
            - Return ONE single-line MINIFIED JSON object only. No markdown, code fences, comments, or prose.
            - Use EXACTLY the keys and ordering from the schema below. Do not add extra top-level keys.
            - For unknown/unavailable fields use empty string "" or empty array [] and explain in meta.uncertainty.
            - Keep text concise; avoid repeating input text.
            - Focus analysis on the first 8000 chars of main content and first 15 headings.{exa_context}

            WEBSITE INFORMATION:
            - Domain: {domain_info.get('domain_name', 'Unknown')}
            - Website Type: {self._determine_website_type(domain_info)}
            - Brand Name: {brand_info.get('company_name', 'Not specified')}
            - Tagline: {brand_info.get('tagline', 'Not specified')}
            - Social Media Presence: {', '.join(social_media.keys()) if social_media else 'None detected'}

            CONTENT STRUCTURE:
            - Headings: {len(headings)} total ({content_structure.get('headings', {}).get('h1', 0)} H1, {content_structure.get('headings', {}).get('h2', 0)} H2)
            - Paragraphs: {content_structure.get('paragraphs', 0)}
            - Images: {content_structure.get('images', 0)}
            - Links: {content_structure.get('links', 0)}
            - Has Navigation: {content_structure.get('has_navigation', False)}
            - Has Call-to-Action: {content_structure.get('has_call_to_action', False)}

            CONTENT TO ANALYZE:
            - Title: {title}
            - Description: {description}
            - Main Content: {main_content[:8000]}
            - Key Headings (first 15): {headings[:15]}

            ANALYSIS REQUIREMENTS:
            1. Analyze the writing style, tone, and voice characteristics
            2. Identify target audience demographics and expertise level
            3. Determine content type and purpose
            4. Assess content structure and organization patterns
            5. Evaluate brand voice consistency and personality
            6. Identify unique style elements and patterns
            7. Consider the website type and industry context
            8. Analyze social media presence impact on content style

            REQUIRED JSON SCHEMA (stable key order):
            {{
              "writing_style": {{
                "tone": "", "voice": "", "complexity": "", "engagement_level": "",
                "brand_personality": "", "formality_level": "", "emotional_appeal": ""
              }},
              "content_characteristics": {{
                "sentence_structure": "", "vocabulary_level": "", "paragraph_organization": "",
                "content_flow": "", "readability_score": "", "content_density": "",
                "visual_elements_usage": ""
              }},
              "target_audience": {{
                "demographics": [], "expertise_level": "", "industry_focus": "", "geographic_focus": "",
                "psychographic_profile": "", "pain_points": [], "motivations": []
              }},
              "content_type": {{
                "primary_type": "", "secondary_types": [], "purpose": "", "call_to_action": "",
                "conversion_focus": "", "educational_value": ""
              }},
              "brand_analysis": {{
                "brand_voice": "", "brand_values": [], "brand_positioning": "", "competitive_differentiation": "",
                "trust_signals": [], "authority_indicators": []
              }},
              "content_strategy_insights": {{
                "strengths": [], "weaknesses": [], "opportunities": [], "threats": [],
                "recommended_improvements": [], "content_gaps": []
              }},
              "recommended_settings": {{
                "writing_tone": "", "target_audience": "", "content_type": "", "creativity_level": "",
                "geographic_location": "", "industry_context": "", "brand_alignment": ""
              }},
              "meta": {{"schema_version": "1.1", "confidence": 0.0, "notes": "", "uncertainty": {{"fields": []}}}}
            }}
            """
            
            logger.debug("[StyleDetectionLogic.analyze_content_style] Sending enhanced prompt to LLM")
            max_repairs = 2
            try:
                analysis_results = self._generate_json_via_llm(prompt, user_id, max_repairs=max_repairs)
                logger.info("[StyleDetectionLogic.analyze_content_style] Successfully parsed enhanced analysis results")
                return {
                    'success': True,
                    'analysis': analysis_results
                }
            except Exception as e:
                logger.error(f"[StyleDetectionLogic.analyze_content_style] AI analysis failed after all retries: {str(e)}")
                return {
                    'success': False,
                    'error': f'Style analysis failed after {max_repairs + 1} attempts: {str(e)}'
                }
                
        except Exception as e:
            logger.error(f"[StyleDetectionLogic.analyze_content_style] Critical error: {str(e)}")
            return {
                'success': False,
                'error': f'Critical error in style analysis: {str(e)}'
            }

    def _determine_website_type(self, domain_info: Dict[str, Any]) -> str:
        """Determine the type of website based on domain and content analysis."""
        if domain_info.get('is_blog'):
            return 'Blog/Content Platform'
        elif domain_info.get('is_ecommerce'):
            return 'E-commerce/Online Store'
        elif domain_info.get('is_corporate'):
            return 'Corporate/Business Website'
        elif domain_info.get('has_blog_section'):
            return 'Business with Blog'
        elif domain_info.get('has_about_page') and domain_info.get('has_contact_page'):
            return 'Professional Services'
        else:
            return 'General Website'
    
    
    def analyze_style_patterns(self, content: Dict[str, Any], user_id: str = None) -> Dict[str, Any]:
        """
        Analyze recurring patterns in the content style.
        
        Args:
            content (Dict): Content to analyze
            user_id (str): User ID for subscription checking.
            
        Returns:
            Dict: Pattern analysis results
        """
        try:
            logger.info("[StyleDetectionLogic.analyze_style_patterns] Starting pattern analysis")
            
            main_content = content.get("main_content", "")
            
            prompt = f"""Analyze the content for recurring writing patterns and style characteristics.
            
            RULES:
            - Return ONE single-line MINIFIED JSON object only. No markdown, code fences, comments, or prose.
            - Use EXACTLY the keys and ordering from the schema below. No extra top-level keys.
            - If uncertain, set empty values and list field names in meta.uncertainty.fields.
            - Keep responses concise and avoid quoting long input spans.
            
            Content (truncated to 5000 chars): {main_content[:5000]}
            
            REQUIRED JSON SCHEMA (stable key order):
            {{
              "patterns": {{
                "sentence_length": "", "vocabulary_patterns": [], "rhetorical_devices": [],
                "paragraph_structure": "", "transition_phrases": []
              }},
              "style_consistency": "",
              "unique_elements": [],
              "meta": {{"schema_version": "1.1", "confidence": 0.0, "notes": "", "uncertainty": {{"fields": []}}}}
            }}
            """
            
            pattern_results = self._generate_json_via_llm(prompt, user_id, max_repairs=2)
            return {
                    'success': True,
                    'patterns': pattern_results
                }
                
        except Exception as e:
            logger.error(f"[StyleDetectionLogic.analyze_style_patterns] Error during analysis: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def generate_style_guidelines(self, analysis_results: Dict[str, Any], user_id: str = None) -> Dict[str, Any]:
        """
        Generate comprehensive content guidelines based on enhanced style analysis.
        
        Args:
            analysis_results (Dict): Results from enhanced style analysis
            user_id (str): User ID for subscription checking.
            
        Returns:
            Dict: Generated comprehensive guidelines
        """
        try:
            logger.info("[StyleDetectionLogic.generate_style_guidelines] Generating comprehensive style guidelines")
            
            # Extract key information from analysis
            writing_style = analysis_results.get('writing_style', {})
            content_characteristics = analysis_results.get('content_characteristics', {})
            target_audience = analysis_results.get('target_audience', {})
            brand_analysis = analysis_results.get('brand_analysis', {})
            content_strategy_insights = analysis_results.get('content_strategy_insights', {})
            
            prompt = f"""Generate actionable content creation guidelines based on the style analysis.

            ANALYSIS DATA:
            Writing Style: {writing_style}
            Content Characteristics: {content_characteristics}
            Target Audience: {target_audience}
            Brand Analysis: {brand_analysis}
            Content Strategy Insights: {content_strategy_insights}

            REQUIREMENTS:
            - Return ONE single-line MINIFIED JSON object only. No markdown, code fences, comments, or prose.
            - Use EXACTLY the keys and ordering from the schema below. No extra top-level keys.
            - Provide concise, implementation-ready bullets with an example for key items (e.g., tone and CTA examples).
            - Include negative guidance (what to avoid) tied to brand constraints where applicable.
            - If uncertain, set empty values and list field names in meta.uncertainty.fields.

            IMPORTANT: REQUIRED JSON SCHEMA (stable key order):
            {{
              "guidelines": {{
                "tone_recommendations": [],
                "structure_guidelines": [],
                "vocabulary_suggestions": [],
                "engagement_tips": [],
                "audience_considerations": [],
                "brand_alignment": [],
                "seo_optimization": [],
                "conversion_optimization": []
              }},
              "best_practices": [],
              "avoid_elements": [],
              "content_strategy": "",
              "ai_generation_tips": [],
              "competitive_advantages": [],
              "content_calendar_suggestions": [],
              "meta": {{"schema_version": "1.1", "confidence": 0.0, "notes": "", "uncertainty": {{"fields": []}}}}
            }}
            """
            
            guidelines = self._generate_json_via_llm(prompt, user_id, max_repairs=2)
            return {
                    'success': True,
                    'guidelines': guidelines
                }
                
        except Exception as e:
            logger.error(f"[StyleDetectionLogic.generate_style_guidelines] Error generating guidelines: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def validate_style_analysis_request(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate style analysis request data.
        
        Args:
            request_data (Dict): Request data to validate
            
        Returns:
            Dict: Validation results
        """
        errors = []
        
        # Check if content is provided
        if not request_data.get('content') and not request_data.get('url') and not request_data.get('text_sample'):
            errors.append("Content is required for style analysis")
        
        # Check content length
        content = request_data.get('content', {})
        main_content = content.get('main_content', '')
        if len(main_content) < 50:
            errors.append("Content must be at least 50 characters long for meaningful analysis")
        
        # Check for required fields
        if not content.get('title') and not content.get('main_content'):
            errors.append("Either title or main content must be provided")
        
        return {
            'valid': len(errors) == 0,
            'errors': errors
        }

    def perform_seo_audit(self, url: str, content: Dict[str, Any]) -> Dict[str, Any]:
        """
        Perform a comprehensive SEO audit using the seo_analyzer tools.
        
        Args:
            url (str): The URL of the page being analyzed.
            content (Dict): The content dictionary containing HTML content.
            
        Returns:
            Dict: Aggregated SEO audit results.
        """
        logger.info(f"[StyleDetectionLogic.perform_seo_audit] Starting SEO audit for {url}")
        
        audit_results = {
            'meta': {},
            'technical': {},
            'content_health': {},
            'performance': {},
            'url_structure': {},
            'accessibility': {},
            'ux': {},
            'overall_score': 0,
            'summary': {
                'critical_issues': [],
                'warnings': [],
                'passed_checks': 0,
                'total_checks': 0
            }
        }
        
        # Need actual HTML content for analysis
        # If content dictionary has 'html_content', use it.
        # Otherwise, we might need to fetch it or use 'main_content' if it's HTML.
        # Ideally, the crawler should pass the full HTML.
        # For now, let's assume content['html'] or we fetch it if missing.
        
        html_content = content.get('html', '')
        if not html_content and url:
            try:
                logger.info(f"Fetching HTML for SEO audit: {url}")
                response = requests.get(url, timeout=10, headers={'User-Agent': 'ALwrity-SEO-Audit/1.0'})
                if response.status_code == 200:
                    html_content = response.text
            except Exception as e:
                logger.warning(f"Failed to fetch HTML for SEO audit: {e}")
        
        if not html_content:
            logger.warning("No HTML content available for SEO audit")
            audit_results['html_unavailable'] = True
            audit_results['warning'] = 'SEO audit unavailable — could not fetch page HTML for analysis'
            return audit_results
            
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Helper to run analyzer safely
        def run_analyzer(analyzer_class, *analyze_args):
            try:
                analyzer = analyzer_class()
                return analyzer.analyze(*analyze_args)
            except Exception as e:
                logger.error(f"Error running {analyzer_class.__name__}: {e}")
                return {'score': 0, 'issues': [f"Analysis failed: {str(e)}"], 'warnings': []}

        # 1. Meta Data Analysis
        audit_results['meta'] = run_analyzer(MetaDataAnalyzer, html_content, url)
        
        # 2. Technical Analysis (Requires URL)
        audit_results['technical'] = run_analyzer(TechnicalSEOAnalyzer, html_content, url)
        
        # 3. Content Analysis
        audit_results['content_health'] = run_analyzer(ContentAnalyzer, html_content, url)
        
        # 4. Performance Analysis (Requires URL)
        audit_results['performance'] = run_analyzer(PerformanceAnalyzer, url)
        
        # 5. URL Structure
        audit_results['url_structure'] = run_analyzer(URLStructureAnalyzer, url)
        
        # 6. Accessibility
        audit_results['accessibility'] = run_analyzer(AccessibilityAnalyzer, html_content)
        
        # 7. User Experience
        audit_results['ux'] = run_analyzer(UserExperienceAnalyzer, html_content, url)
        
        # Calculate summary metrics
        total_score = 0
        categories = ['meta', 'technical', 'content_health', 'performance', 'url_structure', 'accessibility', 'ux']
        valid_categories = 0
        
        for cat in categories:
            result = audit_results.get(cat, {})
            score = result.get('score', 0)
            total_score += score
            if score > 0: # valid run
                valid_categories += 1
                
            # Aggregate issues
            for issue in result.get('issues', []):
                if isinstance(issue, dict):
                    enriched_issue = dict(issue)
                    enriched_issue.setdefault('category', cat)
                    audit_results['summary']['critical_issues'].append(enriched_issue)
                else:
                    audit_results['summary']['critical_issues'].append({
                        'category': cat,
                        'type': 'critical',
                        'message': str(issue)
                    })
                
            for warning in result.get('warnings', []):
                if isinstance(warning, dict):
                    enriched_warning = dict(warning)
                    enriched_warning.setdefault('category', cat)
                    audit_results['summary']['warnings'].append(enriched_warning)
                else:
                    audit_results['summary']['warnings'].append({
                        'category': cat,
                        'type': 'warning',
                        'message': str(warning)
                    })

        # Average score
        audit_results['overall_score'] = round(total_score / len(categories)) if categories else 0
        
        logger.info(f"[StyleDetectionLogic.perform_seo_audit] SEO audit completed. Score: {audit_results['overall_score']}")
        return audit_results 
