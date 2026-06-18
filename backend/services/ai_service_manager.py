"""
AI Service Manager
Centralized AI service management for content planning system.
"""

from typing import Dict, Any, List, Optional
from loguru import logger
from datetime import datetime
import json
import asyncio
from dataclasses import dataclass
from enum import Enum

# Import AI providers
from services.llm_providers.main_text_generation import llm_text_gen
# Prefer the extended gemini provider if available; fallback to base
try:
    from services.llm_providers.gemini_provider import gemini_structured_json_response as _gemini_fn
    _GEMINI_EXTENDED = True
except Exception:
    from services.llm_providers.gemini_provider import gemini_structured_json_response as _gemini_fn
    _GEMINI_EXTENDED = False

class AIServiceType(Enum):
    """AI service types for monitoring."""
    CONTENT_GAP_ANALYSIS = "content_gap_analysis"
    MARKET_POSITION_ANALYSIS = "market_position_analysis"
    KEYWORD_ANALYSIS = "keyword_analysis"
    PERFORMANCE_PREDICTION = "performance_prediction"
    STRATEGIC_INTELLIGENCE = "strategic_intelligence"
    CONTENT_QUALITY_ASSESSMENT = "content_quality_assessment"
    CONTENT_SCHEDULE_GENERATION = "content_schedule_generation"

@dataclass
class AIServiceMetrics:
    """Metrics for AI service performance."""
    service_type: AIServiceType
    response_time: float
    success: bool
    error_message: Optional[str] = None
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()

class AIServiceManager:
    """Centralized AI service management for content planning system."""
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        """Implement singleton pattern to prevent multiple initializations."""
        if cls._instance is None:
            cls._instance = super(AIServiceManager, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize AI service manager (only once)."""
        if not self._initialized:
            self.logger = logger
            self.metrics: List[AIServiceMetrics] = []
            self.prompts = self._load_centralized_prompts()
            self.schemas = self._load_centralized_schemas()
            self.config = self._load_ai_configuration()
            
            logger.debug("AIServiceManager initialized")
            self._initialized = True
    
    def _load_ai_configuration(self) -> Dict[str, Any]:
        """Load AI configuration settings."""
        return {
            'max_retries': 2,  # Reduced from 3
            'timeout_seconds': 45,  # increased from 15 to accommodate structured 30+ fields
            'temperature': 0.3,  # more deterministic for schema-constrained JSON
            'top_p': 0.9,
            'top_k': 40,
            'max_tokens': 8192,  # increased from 4096 to prevent JSON truncation
            'enable_caching': False,  # 🚨 CRITICAL: Disabled caching to ensure fresh AI responses
            'cache_duration_minutes': 0,  # 🚨 CRITICAL: Zero cache duration
            'performance_monitoring': True,
            'fallback_enabled': False  # Disabled fallback to prevent false positives
        } 
    
    def _load_centralized_prompts(self) -> Dict[str, str]:
        """Load centralized AI prompts."""
        return {
            'content_gap_analysis': """
As an expert SEO content strategist, analyze the provided client profile and competitive landscape to find specific content gaps.

CLIENT PROFILE & COMPETITIVE DATA:
{analysis_data}

CRITICAL INSTRUCTIONS:
1. **HYPER-RELEVANCE**: Recommendations must be strictly about the client's specific niche (e.g., if "Vegan Cooking", don't suggest "Steak recipes" or "Cloud Hosting").
2. **LOW-HANGING FRUIT**: Identify topics competitors are covering but the client is missing, or topics where competitors have weak content.
3. **SPECIFIC TITLES**: Suggest actual blog post titles or keywords, not generic categories (e.g., suggest "Best Vegan Cheese for Pizza 2024" instead of "Cheese reviews").

PROVIDE CONTENT GAPS (JSON Format):
1. **Low Hanging Fruit (Content Recommendations)**:
   - recommendation: A specific, high-potential content topic or title.
   - priority: High/Medium/Low.
   - estimated_traffic: A realistic estimate (e.g., "Medium", "High", or numeric range).
   - roi_estimate: Why this brings value (e.g., "High conversion intent").
   - implementation_time: e.g., "2-4 hours".

Format as structured JSON matching the schema exactly.
""",

            'market_position_analysis': """
As a senior competitive intelligence analyst specializing in digital marketing and content strategy, analyze the market position of competitors in the {industry} industry:

COMPETITOR ANALYSES:
{competitor_analyses}

MARKET CONTEXT:
- Industry: {industry}
- Market Size: {market_size}
- Growth Rate: {growth_rate}
- Key Trends: {key_trends}

PROVIDE COMPREHENSIVE MARKET ANALYSIS:
1. Market Leader Identification (with reasoning)
2. Content Leader Analysis (content strategy assessment)
3. Quality Leader Assessment (content quality metrics)
4. Market Gaps Identification (3-5 major gaps)
5. Opportunities Analysis (high-impact opportunities)
6. Competitive Advantages (unique positioning)
7. Strategic Positioning Recommendations (differentiation)
8. Content Strategy Insights (format, frequency, quality)
9. Innovation Opportunities (emerging trends)
10. Risk Assessment (competitive threats)

Include market share estimates, competitive positioning matrix, and strategic recommendations with implementation timeline.
Format as structured JSON with detailed analysis and confidence levels.
""",

            'keyword_analysis': """
As an expert keyword research specialist with deep understanding of search algorithms and user behavior, analyze keyword opportunities for {industry} industry:

KEYWORD DATA:
- Target Keywords: {target_keywords}
- Industry Context: {industry}
- Search Volume Data: {search_volume_data}
- Competition Analysis: {competition_analysis}
- Trend Analysis: {trend_analysis}

PROVIDE COMPREHENSIVE KEYWORD ANALYSIS:
1. Search Volume Estimates (with confidence intervals)
2. Competition Level Assessment (difficulty scoring)
3. Trend Analysis (seasonal, cyclical, emerging)
4. Opportunity Scoring (ROI potential)
5. Content Format Recommendations (based on intent)
6. Keyword Clustering (semantic relationships)
7. Long-tail Opportunities (specific, low-competition)
8. Seasonal Variations (trending patterns)
9. Search Intent Classification (informational, commercial, navigational, transactional)
10. Implementation Priority (quick wins vs long-term)

Consider search intent, user journey stages, and conversion potential in your analysis.
Format as structured JSON with detailed metrics and strategic recommendations.
""",

            'performance_prediction': """
As a data-driven content strategist with expertise in predictive analytics and content performance optimization, predict content performance based on comprehensive analysis:

CONTENT DATA:
{content_data}

MARKET CONTEXT:
- Industry: {industry}
- Target Audience: {target_audience}
- Competition Level: {competition_level}
- Content Quality Score: {quality_score}

PROVIDE DETAILED PERFORMANCE PREDICTIONS:
1. Traffic Predictions (monthly, peak, growth rate)
2. Engagement Predictions (time on page, bounce rate, social shares)
3. Ranking Predictions (position, timeline, competition)
4. Conversion Predictions (CTR, conversion rate, leads)
5. Revenue Impact (estimated revenue, ROI)
6. Risk Factors (content saturation, algorithm changes)
7. Success Factors (quality indicators, optimization opportunities)
8. Competitive Response (market reaction)
9. Seasonal Variations (performance fluctuations)
10. Long-term Sustainability (content lifecycle)

Include confidence intervals, risk assessments, and optimization recommendations.
Format as structured JSON with detailed predictions and actionable insights.
""",

            'strategic_intelligence': """
As a senior content strategy consultant with expertise in digital marketing, competitive intelligence, and strategic planning, generate comprehensive strategic insights.

ANALYSIS DATA (Includes Advertools site hierarchy and word frequency themes):
{analysis_data}

CRITICAL INSTRUCTIONS:
1. **DATA-DRIVEN PRECISION**: Use the `augmented_themes` and `competitor_content_themes` to identify specific topic authority shifts.
2. **STRICT NICHE RELEVANCE**: Only suggest actions relevant to the user's specific industry and topics. Avoid generic tech/cloud storage jargon unless that is the user's niche.
3. **SITE HIERARCHY INSIGHTS**: Analyze the `competitor_hierarchies` to suggest structural improvements to the user's website.
4. **STALE CONTENT STRATEGY**: If stale content is detected in market intelligence, suggest a "Refresh & Relaunch" strategy.

PROVIDE STRATEGIC INTELLIGENCE:
1. Content Strategy Recommendations (pillar content, topic clusters based on themes)
2. Competitive Positioning Advice (differentiation strategies using site hierarchy)
3. Content Optimization Suggestions (quality, format, frequency)
4. Innovation Opportunities (emerging trends from competitor word frequency)
5. Risk Mitigation Strategies (competitive threats, cadence shifts)

Format as structured JSON with strategic insights and implementation guidance.
""",

            'content_quality_assessment': """
As an expert content quality analyst with deep understanding of SEO, user experience, and content marketing best practices, assess content quality comprehensively:

CONTENT DATA:
{content_data}

QUALITY METRICS:
- Readability Score: {readability_score}
- SEO Optimization: {seo_score}
- User Engagement: {engagement_score}
- Content Depth: {depth_score}

PROVIDE COMPREHENSIVE QUALITY ASSESSMENT:
1. Overall Quality Score (comprehensive evaluation)
2. Readability Analysis (clarity, accessibility, flow)
3. SEO Optimization Analysis (technical, on-page, off-page)
4. Engagement Potential (user experience, interaction)
5. Content Depth Assessment (comprehensiveness, authority)
6. Improvement Suggestions (specific, actionable)
7. Competitive Benchmarking (industry standards)
8. Performance Optimization (conversion, retention)
9. Accessibility Assessment (inclusive design)
10. Future-Proofing (algorithm resilience)

Include specific recommendations with implementation steps and expected impact.
Format as structured JSON with detailed assessment and optimization guidance.
"""
        }
    
    def _load_centralized_schemas(self) -> Dict[str, Dict[str, Any]]:
        """Load centralized JSON schemas."""
        return {
            'content_gap_analysis': {
                "type": "object",
                "properties": {
                    "strategic_insights": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "type": {"type": "string"},
                                "insight": {"type": "string"},
                                "confidence": {"type": "number"},
                                "priority": {"type": "string"},
                                "estimated_impact": {"type": "string"},
                                "implementation_time": {"type": "string"},
                                "risk_level": {"type": "string"}
                            }
                        }
                    },
                    "content_recommendations": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "type": {"type": "string"},
                                "recommendation": {"type": "string"},
                                "priority": {"type": "string"},
                                "estimated_traffic": {"type": "string"},
                                "implementation_time": {"type": "string"},
                                "roi_estimate": {"type": "string"},
                                "success_metrics": {
                                    "type": "array",
                                    "items": {"type": "string"}
                                }
                            }
                        }
                    }
                }
            },
            
            'market_position_analysis': {
                "type": "object",
                "properties": {
                    "market_leader": {"type": "string"},
                    "content_leader": {"type": "string"},
                    "quality_leader": {"type": "string"},
                    "market_gaps": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "opportunities": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "competitive_advantages": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "strategic_recommendations": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "type": {"type": "string"},
                                "recommendation": {"type": "string"},
                                "priority": {"type": "string"},
                                "estimated_impact": {"type": "string"},
                                "implementation_time": {"type": "string"},
                                "confidence_level": {"type": "string"}
                            }
                        }
                    }
                }
            },
            
            'keyword_analysis': {
                "type": "object",
                "properties": {
                    "keyword_opportunities": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "keyword": {"type": "string"},
                                "search_volume": {"type": "number"},
                                "competition_level": {"type": "string"},
                                "difficulty_score": {"type": "number"},
                                "trend": {"type": "string"},
                                "intent": {"type": "string"},
                                "opportunity_score": {"type": "number"},
                                "recommended_format": {"type": "string"},
                                "estimated_traffic": {"type": "string"},
                                "implementation_priority": {"type": "string"}
                            }
                        }
                    }
                }
            },
            
            'performance_prediction': {
                "type": "object",
                "properties": {
                    "traffic_predictions": {
                        "type": "object",
                        "properties": {
                            "estimated_monthly_traffic": {"type": "string"},
                            "traffic_growth_rate": {"type": "string"},
                            "peak_traffic_month": {"type": "string"},
                            "confidence_level": {"type": "string"}
                        }
                    },
                    "engagement_predictions": {
                        "type": "object",
                        "properties": {
                            "estimated_time_on_page": {"type": "string"},
                            "estimated_bounce_rate": {"type": "string"},
                            "estimated_social_shares": {"type": "string"},
                            "estimated_comments": {"type": "string"},
                            "confidence_level": {"type": "string"}
                        }
                    }
                }
            },
            
            'strategic_intelligence': {
                "type": "object",
                "properties": {
                    "strategic_insights": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "type": {"type": "string"},
                                "insight": {"type": "string"},
                                "reasoning": {"type": "string"},
                                "priority": {"type": "string"},
                                "estimated_impact": {"type": "string"},
                                "implementation_time": {"type": "string"},
                                "confidence_level": {"type": "string"}
                            }
                        }
                    }
                }
            },
            
            'content_quality_assessment': {
                "type": "object",
                "properties": {
                    "overall_score": {"type": "number"},
                    "readability_score": {"type": "number"},
                    "seo_score": {"type": "number"},
                    "engagement_potential": {"type": "string"},
                    "improvement_suggestions": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "timestamp": {"type": "string"}
                }
            },
            'content_schedule_generation': {
                "type": "object",
                "properties": {
                    "schedule": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "day": {"type": "number"},
                                "title": {"type": "string"},
                                "description": {"type": "string"},
                                "content_type": {"type": "string"},
                                "platform": {"type": "string"},
                                "pillar": {"type": "string"},
                                "priority": {"type": "string"},
                                "keywords": {
                                    "type": "array",
                                    "items": {"type": "string"}
                                },
                                "estimated_impact": {"type": "string"},
                                "implementation_time": {"type": "string"}
                            }
                        }
                    }
                }
            }
        }
    
    async def _execute_ai_call(self, service_type: AIServiceType, prompt: str, schema: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Execute AI call with comprehensive error handling and monitoring.
        
        Args:
            service_type: Type of AI service being called
            prompt: The prompt to send to AI
            schema: Expected response schema
            user_id: Clerk user ID for subscription checking (REQUIRED - no fallback)
            
        Returns:
            Dictionary with AI response or error information
            
        Raises:
            RuntimeError: If user_id is not provided
        """
        if not user_id:
            raise RuntimeError("user_id is required for subscription checking. All AI calls must be authenticated.")
        
        start_time = datetime.utcnow()
        success = False
        error_message = None
        
        try:
            logger.info(f"🤖 Executing AI call for {service_type.value}, user_id={user_id}")
            
            # Emit educational content for frontend
            await self._emit_educational_content(service_type, "start")
            
            # Execute the AI call through llm_text_gen for subscription checks
            # Use llm_text_gen which has subscription checks and usage tracking
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    self._call_llm_with_checks,
                    prompt,
                    schema,
                    user_id,
                ),
                timeout=self.config['timeout_seconds']
            )
            
            # Check for errors in response
            if response.get("error"):
                error_message = response["error"]
                logger.error(f"AI call error for {service_type.value}: {error_message}")
                await self._emit_educational_content(service_type, "error", error_message)
                raise Exception(error_message)
            
            # Validate response structure
            if not response or not isinstance(response, dict):
                error_message = "Invalid response structure from AI service"
                logger.error(f"AI call error for {service_type.value}: {error_message}")
                await self._emit_educational_content(service_type, "error", error_message)
                raise Exception(error_message)
            
            success = True
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            
            # Emit success educational content
            await self._emit_educational_content(service_type, "success", processing_time=processing_time)
            
            # Record metrics
            self._record_metrics(service_type, processing_time, success, error_message)
            
            logger.info(f"✅ AI call for {service_type.value} completed successfully in {processing_time:.2f}s")
            
            return {
                "data": response,
                "processing_time": processing_time,
                "service_type": service_type.value,
                "success": True
            }
            
        except Exception as e:
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            error_message = str(e)
            
            # Emit error educational content
            await self._emit_educational_content(service_type, "error", error_message)
            
            # Record metrics
            self._record_metrics(service_type, processing_time, success, error_message)
            
            logger.error(f"❌ AI call error for {service_type.value}: {error_message}")
            
            return {
                "error": error_message,
                "processing_time": processing_time,
                "service_type": service_type.value,
                "success": False
            }
    
    def _call_llm_with_checks(self, prompt: str, schema: Dict[str, Any], user_id: str):
        """
        Call LLM through main_text_generation with subscription checks.
        
        Args:
            prompt: The prompt to send to AI
            schema: Expected response schema
            user_id: Clerk user ID for subscription checking (required)
            
        Returns:
            Dictionary with AI response
        """
        if not user_id:
            raise RuntimeError("user_id is required for subscription checking")
        
        # Use llm_text_gen which has subscription checks and usage tracking
        from services.llm_providers.main_text_generation import llm_text_gen
        
        logger.info(f"[AIServiceManager] Calling llm_text_gen with user_id={user_id} for subscription checks")
        
        # Call through main_text_generation for subscription checks
        result = llm_text_gen(
            prompt=prompt,
            json_struct=schema,
            user_id=user_id  # Pass user_id for subscription checks
        )
        
        # llm_text_gen returns string or dict, ensure we return dict
        if isinstance(result, str):
            try:
                return json.loads(result)
            except json.JSONDecodeError:
                logger.warning(f"[AIServiceManager] Failed to parse JSON from llm_text_gen response")
                return {"error": "Failed to parse AI response", "raw_response": result}
        
        return result if isinstance(result, dict) else {"data": result}
    
    def _call_gemini_structured(self, prompt: str, schema: Dict[str, Any]):
        """
        Call gemini structured JSON directly (backward compatibility only).
        
        ⚠️ WARNING: This bypasses subscription checks. Use _call_llm_with_checks() instead.
        """
        try:
            # Attempt extended signature (temperature/top_p/top_k/max_tokens/system_prompt)
            return _gemini_fn(
                prompt,
                schema,
                self.config['temperature'],
                self.config['top_p'],
                self.config.get('top_k', 40),
                self.config['max_tokens'],
                None
            )
        except TypeError:
            logger.debug("Falling back to base gemini provider signature (prompt, schema)")
            return _gemini_fn(prompt, schema)

    async def execute_structured_json_call(self, service_type: AIServiceType, prompt: str, schema: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """
        Public wrapper to execute a structured JSON AI call with a provided schema.
        
        Args:
            service_type: Type of AI service being called
            prompt: The prompt to send to AI
            schema: Expected response schema
            user_id: Clerk user ID for subscription checking (REQUIRED - no fallback)
            
        Returns:
            Dictionary with AI response or error information
            
        Raises:
            RuntimeError: If user_id is not provided
        """
        if not user_id:
            raise RuntimeError("user_id is required for subscription checking. All AI calls must be authenticated.")
        return await self._execute_ai_call(service_type, prompt, schema, user_id=user_id)
    
    async def generate_content_gap_analysis(self, analysis_data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """
        Generate content gap analysis using centralized AI service.
        
        Args:
            analysis_data: Analysis data
            user_id: User ID for subscription checking
            
        Returns:
            Content gap analysis results
        """
        try:
            # Format prompt
            prompt = self.prompts['content_gap_analysis'].format(
                analysis_data=json.dumps(analysis_data, indent=2),
                target_url=analysis_data.get('target_url', 'N/A'),
                industry=analysis_data.get('industry', 'N/A'),
                serp_opportunities=analysis_data.get('serp_opportunities', 0),
                expanded_keywords_count=analysis_data.get('expanded_keywords_count', 0),
                competitors_analyzed=analysis_data.get('competitors_analyzed', 0),
                content_quality_score=analysis_data.get('content_quality_score', 7.0),
                competition_level=analysis_data.get('competition_level', 'medium'),
                dominant_themes=json.dumps(analysis_data.get('dominant_themes', {}), indent=2),
                competitive_landscape=json.dumps(analysis_data.get('competitive_landscape', {}), indent=2)
            )
            
            # Execute AI call
            result = await self._execute_ai_call(
                AIServiceType.CONTENT_GAP_ANALYSIS,
                prompt,
                self.schemas['content_gap_analysis'],
                user_id=user_id
            )
            
            return result if result else {}
            
        except Exception as e:
            logger.error(f"Error in content gap analysis: {str(e)}")
            raise Exception(f"Failed to generate content gap analysis: {str(e)}")
    
    async def generate_market_position_analysis(self, market_data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """
        Generate market position analysis using centralized AI service.
        
        Args:
            market_data: Market analysis data
            user_id: User ID for subscription checking
            
        Returns:
            Market position analysis results
        """
        try:
            # Format prompt
            prompt = self.prompts['market_position_analysis'].format(
                industry=market_data.get('industry', 'N/A'),
                competitor_analyses=json.dumps(market_data.get('competitors', []), indent=2),
                market_size=market_data.get('market_size', 'N/A'),
                growth_rate=market_data.get('growth_rate', 'N/A'),
                key_trends=json.dumps(market_data.get('key_trends', []), indent=2)
            )
            
            # Execute AI call
            result = await self._execute_ai_call(
                AIServiceType.MARKET_POSITION_ANALYSIS,
                prompt,
                self.schemas['market_position_analysis'],
                user_id=user_id
            )
            
            return result if result else {}
            
        except Exception as e:
            logger.error(f"Error in market position analysis: {str(e)}")
            raise Exception(f"Failed to generate market position analysis: {str(e)}")
    
    async def generate_keyword_analysis(self, keyword_data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """
        Generate keyword analysis using centralized AI service.
        
        Args:
            keyword_data: Keyword analysis data
            user_id: User ID for subscription checking
            
        Returns:
            Keyword analysis results
        """
        try:
            # Format prompt
            prompt = self.prompts['keyword_analysis'].format(
                industry=keyword_data.get('industry', 'N/A'),
                target_keywords=json.dumps(keyword_data.get('target_keywords', []), indent=2),
                search_volume_data=json.dumps(keyword_data.get('search_volume_data', {}), indent=2),
                competition_analysis=json.dumps(keyword_data.get('competition_analysis', {}), indent=2),
                trend_analysis=json.dumps(keyword_data.get('trend_analysis', {}), indent=2)
            )
            
            # Execute AI call
            result = await self._execute_ai_call(
                AIServiceType.KEYWORD_ANALYSIS,
                prompt,
                self.schemas['keyword_analysis'],
                user_id=user_id
            )
            
            return result if result else {}
            
        except Exception as e:
            logger.error(f"Error in keyword analysis: {str(e)}")
            raise Exception(f"Failed to generate keyword analysis: {str(e)}")
    
    async def generate_performance_prediction(self, content_data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """
        Generate performance prediction using centralized AI service.
        
        Args:
            content_data: Content data for prediction
            user_id: User ID for subscription checking
            
        Returns:
            Performance prediction results
        """
        try:
            # Format prompt
            prompt = self.prompts['performance_prediction'].format(
                industry=content_data.get('industry', 'N/A'),
                target_audience=json.dumps(content_data.get('target_audience', {})),
                competition_level=content_data.get('competition_level', 'medium'),
                quality_score=content_data.get('quality_score', 7.0)
            )
            
            # Execute AI call
            result = await self._execute_ai_call(
                AIServiceType.PERFORMANCE_PREDICTION,
                prompt,
                self.schemas['performance_prediction'],
                user_id=user_id
            )
            
            return result if result else {}
            
        except Exception as e:
            logger.error(f"Error in performance prediction: {str(e)}")
            raise Exception(f"Failed to generate performance prediction: {str(e)}")
    
    async def generate_strategic_intelligence(self, analysis_data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """
        Generate strategic intelligence using centralized AI service.
        
        Args:
            analysis_data: Analysis data for strategic insights
            user_id: User ID for subscription checking
            
        Returns:
            Strategic intelligence results
        """
        try:
            # Format prompt
            prompt = self.prompts['strategic_intelligence'].format(
                analysis_data=json.dumps(analysis_data, indent=2),
                business_objectives=json.dumps(analysis_data.get('business_objectives', {})),
                target_audience=json.dumps(analysis_data.get('target_audience', {})),
                competitive_landscape=json.dumps(analysis_data.get('competitive_landscape', {}), indent=2),
                market_opportunities=json.dumps(analysis_data.get('market_opportunities', []), indent=2)
            )
            
            # Execute AI call
            result = await self._execute_ai_call(
                AIServiceType.STRATEGIC_INTELLIGENCE,
                prompt,
                self.schemas['strategic_intelligence'],
                user_id=user_id
            )
            
            return result if result else {}
            
        except Exception as e:
            logger.error(f"Error in strategic intelligence: {str(e)}")
            raise Exception(f"Failed to generate strategic intelligence: {str(e)}")
    
    async def generate_content_quality_assessment(self, content_data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """
        Generate content quality assessment using centralized AI service.
        
        Args:
            content_data: Content data for assessment
            user_id: User ID for subscription checking
            
        Returns:
            Content quality assessment results
        """
        try:
            # Format prompt
            prompt = self.prompts['content_quality_assessment'].format(
                content_data=json.dumps(content_data, indent=2),
                readability_score=content_data.get('readability_score', 80.0),
                seo_score=content_data.get('seo_score', 90.0),
                engagement_score=content_data.get('engagement_score', 75.0),
                depth_score=content_data.get('depth_score', 85.0)
            )
            
            # Execute AI call
            result = await self._execute_ai_call(
                AIServiceType.CONTENT_QUALITY_ASSESSMENT,
                prompt,
                self.schemas['content_quality_assessment'],
                user_id=user_id
            )
            
            return result if result else {}
            
        except Exception as e:
            logger.error(f"Error in content quality assessment: {str(e)}")
            raise Exception(f"Failed to generate content quality assessment: {str(e)}")
    
    async def generate_content_schedule(self, prompt: str, user_id: str) -> Dict[str, Any]:
        """
        Generate content schedule using AI.
        
        Args:
            prompt: Prompt for schedule generation
            user_id: User ID for subscription checking
        """
        try:
            logger.info("Generating content schedule using AI")
            
            # Use the content schedule prompt
            enhanced_prompt = f"""
            {prompt}
            
            Please return a structured JSON response with the following format:
            {{
                "schedule": [
                    {{
                        "day": 1,
                        "title": "Content Title",
                        "description": "Content description",
                        "content_type": "blog_post",
                        "platform": "website",
                        "pillar": "Educational Content",
                        "priority": "high",
                        "keywords": ["keyword1", "keyword2"],
                        "estimated_impact": "High",
                        "implementation_time": "2-4 weeks"
                    }}
                ]
            }}
            """
            
            response = await self._execute_ai_call(
                AIServiceType.CONTENT_SCHEDULE_GENERATION,
                enhanced_prompt,
                self.schemas.get('content_schedule_generation', {}),
                user_id=user_id
            )
            
            logger.info("Content schedule generated successfully")
            return response
            
        except Exception as e:
            logger.error(f"Error generating content schedule: {str(e)}")
            return {"schedule": []}
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """
        Get AI service performance metrics.
        
        Returns:
            Performance metrics
        """
        if not self.metrics:
            return {
                'total_calls': 0,
                'success_rate': 0,
                'average_response_time': 0,
                'service_breakdown': {}
            }
        
        total_calls = len(self.metrics)
        successful_calls = len([m for m in self.metrics if m.success])
        success_rate = (successful_calls / total_calls) * 100 if total_calls > 0 else 0
        average_response_time = sum(m.response_time for m in self.metrics) / total_calls if total_calls > 0 else 0
        
        # Service breakdown
        service_breakdown = {}
        for service_type in AIServiceType:
            service_metrics = [m for m in self.metrics if m.service_type == service_type]
            if service_metrics:
                service_breakdown[service_type.value] = {
                    'total_calls': len(service_metrics),
                    'success_rate': (len([m for m in service_metrics if m.success]) / len(service_metrics)) * 100,
                    'average_response_time': sum(m.response_time for m in service_metrics) / len(service_metrics)
                }
        
        return {
            'total_calls': total_calls,
            'success_rate': success_rate,
            'average_response_time': average_response_time,
            'service_breakdown': service_breakdown,
            'last_updated': datetime.utcnow().isoformat()
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Health check for the AI service manager.
        
        Returns:
            Health status information
        """
        try:
            logger.info("Performing health check for AIServiceManager")
            
            # Test AI functionality with a simple prompt
            test_prompt = "Hello, this is a health check test."
            try:
                test_response = llm_text_gen(test_prompt)
                ai_status = "operational" if test_response else "degraded"
            except Exception as e:
                ai_status = "error"
                logger.warning(f"AI health check failed: {str(e)}")
            
            # Get performance metrics
            performance_metrics = self.get_performance_metrics()
            
            health_status = {
                'service': 'AIServiceManager',
                'status': 'healthy',
                'capabilities': {
                    'content_gap_analysis': 'operational',
                    'market_position_analysis': 'operational',
                    'keyword_analysis': 'operational',
                    'performance_prediction': 'operational',
                    'strategic_intelligence': 'operational',
                    'content_quality_assessment': 'operational',
                    'ai_integration': ai_status
                },
                'performance_metrics': performance_metrics,
                'prompts_loaded': len(self.prompts),
                'schemas_loaded': len(self.schemas),
                'configuration': self.config,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            logger.info("AIServiceManager health check passed")
            return health_status
            
        except Exception as e:
            logger.error(f"AIServiceManager health check failed: {str(e)}")
            return {
                'service': 'AIServiceManager',
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            } 

    async def _emit_educational_content(self, service_type: AIServiceType, status: str, error_message: str = None, processing_time: float = None):
        """
        Emit educational content for frontend during AI calls.
        
        Args:
            service_type: Type of AI service being called
            status: Current status (start, success, error)
            error_message: Error message if applicable
            processing_time: Processing time if applicable
        """
        try:
            educational_content = self._get_educational_content(service_type, status, error_message, processing_time)
            
            # Emit to any connected SSE clients
            # This would integrate with your SSE system
            logger.info(f"📚 Emitting educational content for {service_type.value}: {status}")
            
            # For now, just log the educational content
            # In a real implementation, this would be sent to connected SSE clients
            logger.debug(f"Educational content: {educational_content}")
            
        except Exception as e:
            logger.error(f"Error emitting educational content: {e}")
    
    def _get_educational_content(self, service_type: AIServiceType, status: str, error_message: str = None, processing_time: float = None) -> Dict[str, Any]:
        """
        Generate educational content based on service type and status.
        
        Args:
            service_type: Type of AI service being called
            status: Current status (start, success, error)
            error_message: Error message if applicable
            processing_time: Processing time if applicable
            
        Returns:
            Dictionary with educational content
        """
        base_content = {
            "service_type": service_type.value,
            "status": status,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if status == "start":
            content_map = {
                AIServiceType.STRATEGIC_INTELLIGENCE: {
                    "title": "🧠 Strategic Intelligence Analysis",
                    "description": "AI is analyzing your market position and identifying strategic opportunities.",
                    "details": [
                        "🎯 Market positioning analysis",
                        "💡 Opportunity identification", 
                        "📈 Growth potential assessment",
                        "🎪 Competitive advantage mapping"
                    ],
                    "insight": "Strategic insights help you understand where you stand in the market and how to differentiate.",
                    "ai_prompt_preview": "Analyzing market position, identifying strategic opportunities, assessing growth potential, and mapping competitive advantages...",
                    "estimated_time": "15-20 seconds"
                },
                AIServiceType.MARKET_POSITION_ANALYSIS: {
                    "title": "🔍 Competitive Intelligence Analysis",
                    "description": "AI is analyzing your competitors to identify gaps and opportunities.",
                    "details": [
                        "🏢 Competitor content strategies",
                        "📊 Market gap analysis",
                        "🎯 Differentiation opportunities",
                        "📈 Industry trend analysis"
                    ],
                    "insight": "Understanding your competitors helps you find unique angles and underserved market segments.",
                    "ai_prompt_preview": "Analyzing competitor content strategies, identifying market gaps, finding differentiation opportunities, and assessing industry trends...",
                    "estimated_time": "20-25 seconds"
                },
                AIServiceType.PERFORMANCE_PREDICTION: {
                    "title": "📊 Performance Forecasting",
                    "description": "AI is predicting content performance and ROI based on industry data.",
                    "details": [
                        "📈 Traffic growth projections",
                        "💰 ROI predictions",
                        "🎯 Conversion rate estimates",
                        "📊 Engagement metrics forecasting"
                    ],
                    "insight": "Performance predictions help you set realistic expectations and optimize resource allocation.",
                    "ai_prompt_preview": "Analyzing industry benchmarks, predicting traffic growth, estimating ROI, forecasting conversion rates, and projecting engagement metrics...",
                    "estimated_time": "15-20 seconds"
                },
                AIServiceType.CONTENT_SCHEDULE_GENERATION: {
                    "title": "📅 Content Calendar Creation",
                    "description": "AI is building a comprehensive content schedule optimized for your audience.",
                    "details": [
                        "📝 Content piece generation",
                        "📅 Optimal publishing schedule",
                        "🎯 Audience engagement timing",
                        "🔄 Content repurposing strategy"
                    ],
                    "insight": "A well-planned content calendar ensures consistent engagement and maximizes content ROI.",
                    "ai_prompt_preview": "Generating content pieces, optimizing publishing schedule, determining audience engagement timing, and planning content repurposing...",
                    "estimated_time": "25-30 seconds"
                }
            }
            
            content = content_map.get(service_type, {
                "title": "🤖 AI Analysis in Progress",
                "description": "AI is processing your data and generating insights.",
                "details": ["Processing data", "Analyzing patterns", "Generating insights"],
                "insight": "AI analysis provides data-driven insights to improve your strategy.",
                "estimated_time": "15-20 seconds"
            })
            
            return {**base_content, **content}
            
        elif status == "success":
            return {
                **base_content,
                "title": f"✅ {service_type.value.replace('_', ' ').title()} Complete",
                "description": f"Successfully completed {service_type.value.replace('_', ' ')} analysis.",
                "achievement": f"Completed in {processing_time:.1f} seconds",
                "next_step": "Moving to next analysis component..."
            }
            
        elif status == "error":
            return {
                **base_content,
                "title": f"⚠️ {service_type.value.replace('_', ' ').title()} Issue",
                "description": f"We encountered an issue with {service_type.value.replace('_', ' ')} analysis.",
                "error": error_message,
                "fallback": "Will use industry best practices for this component."
            }
        
        return base_content

    def _record_metrics(self, service_type: AIServiceType, processing_time: float, success: bool, error_message: str = None):
        """
        Record metrics for AI service calls.
        
        Args:
            service_type: Type of AI service being called
            processing_time: Time taken for the call
            success: Whether the call was successful
            error_message: Error message if applicable
        """
        try:
            metrics = AIServiceMetrics(
                service_type=service_type,
                response_time=processing_time,
                success=success,
                error_message=error_message
            )
            self.metrics.append(metrics)
            
            # Log metrics for monitoring
            if success:
                logger.debug(f"📊 AI metrics recorded for {service_type.value}: {processing_time:.2f}s")
            else:
                logger.warning(f"📊 AI metrics recorded for {service_type.value}: {processing_time:.2f}s (failed)")
                
        except Exception as e:
            logger.error(f"Error recording AI metrics: {e}") 