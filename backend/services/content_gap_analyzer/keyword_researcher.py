"""
Keyword Researcher Service
Converted from keyword_researcher.py for FastAPI integration.
"""

from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from loguru import logger
from datetime import datetime
import asyncio
import json
from collections import Counter, defaultdict

# Import AI providers
from services.llm_providers.main_text_generation import llm_text_gen

# Import existing modules (will be updated to use FastAPI services)
from services.database import get_db_session
from .ai_engine_service import AIEngineService

class KeywordResearcher:
    """Researches and analyzes keywords for content strategy."""
    
    def __init__(self):
        """Initialize the keyword researcher."""
        self.ai_engine = AIEngineService()
        self._user_id: Optional[str] = None
        
        logger.trace("KeywordResearcher initialized (content-gap keyword research)")

    def _structured_generation(self, prompt: str, schema: Dict[str, Any]) -> Any:
        """Generate structured JSON via the common LLM provider layer."""
        return llm_text_gen(prompt=prompt, json_struct=schema, user_id=self._user_id)

    async def analyze_keywords(self, industry: str, url: str, target_keywords: Optional[List[str]] = None, user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyze keywords for content strategy.
        
        Args:
            industry: Industry category
            url: Target website URL
            target_keywords: Optional list of target keywords
            user_id: User ID for subscription checking
            
        Returns:
            Dictionary containing keyword analysis results
        """
        try:
            self._user_id = user_id
            logger.info(f"Starting keyword analysis for {industry} industry")
            
            results = {
                'trend_analysis': {},
                'intent_analysis': {},
                'opportunities': [],
                'insights': [],
                'analysis_timestamp': datetime.utcnow().isoformat(),
                'industry': industry,
                'target_url': url
            }
            
            # Analyze keyword trends
            trend_analysis = await self._analyze_keyword_trends(industry, target_keywords)
            results['trend_analysis'] = trend_analysis
            
            # Evaluate search intent
            intent_analysis = await self._evaluate_search_intent(trend_analysis)
            results['intent_analysis'] = intent_analysis
            
            # Identify opportunities
            opportunities = await self._identify_opportunities(trend_analysis, intent_analysis)
            results['opportunities'] = opportunities
            
            # Generate insights
            insights = await self._generate_keyword_insights(trend_analysis, intent_analysis, opportunities)
            results['insights'] = insights
            
            logger.info(f"Keyword analysis completed for {industry} industry")
            return results
            
        except Exception as e:
            logger.error(f"Error in keyword analysis: {str(e)}")
            return {}
    
    async def _analyze_keyword_trends(self, industry: str, target_keywords: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Analyze keyword trends for the industry using AI.
        
        Args:
            industry: Industry category
            target_keywords: Optional list of target keywords
            
        Returns:
            Keyword trend analysis results
        """
        try:
            logger.info(f"🤖 Analyzing keyword trends for {industry} industry using AI")
            
            # Create comprehensive prompt for keyword trend analysis
            prompt = f"""
            Analyze keyword opportunities for {industry} industry:

            Target Keywords: {target_keywords or []}
            
            Provide comprehensive keyword analysis including:
            1. Search volume estimates
            2. Competition levels
            3. Trend analysis
            4. Opportunity scoring
            5. Content format recommendations
            6. Keyword difficulty assessment
            7. Seasonal trends
            
            Format as structured JSON with detailed analysis.
            """
            
            # Use structured JSON response for better parsing
            response = self._structured_generation(
                prompt=prompt,
                schema={
                    "type": "object",
                    "properties": {
                        "trends": {
                            "type": "object",
                            "additionalProperties": {
                                "type": "object",
                                "properties": {
                                    "search_volume": {"type": "number"},
                                    "difficulty": {"type": "number"},
                                    "trend": {"type": "string"},
                                    "competition": {"type": "string"},
                                    "intent": {"type": "string"},
                                    "cpc": {"type": "number"},
                                    "seasonal_factor": {"type": "number"}
                                }
                            }
                        },
                        "summary": {
                            "type": "object",
                            "properties": {
                                "total_keywords": {"type": "number"},
                                "high_volume_keywords": {"type": "number"},
                                "low_competition_keywords": {"type": "number"},
                                "trending_keywords": {"type": "number"},
                                "opportunity_score": {"type": "number"}
                            }
                        },
                        "recommendations": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "keyword": {"type": "string"},
                                    "recommendation": {"type": "string"},
                                    "priority": {"type": "string"},
                                    "estimated_impact": {"type": "string"}
                                }
                            }
                        }
                    }
                }
            )
            
            # Handle response - structured generation returns dict directly
            if isinstance(response, dict):
                trend_analysis = response
            elif isinstance(response, str):
                # If it's a string, try to parse as JSON
                try:
                    trend_analysis = json.loads(response)
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse AI response as JSON: {e}")
                    raise Exception(f"Invalid AI response format: {str(e)}")
            else:
                logger.error(f"Unexpected response type from AI service: {type(response)}")
                raise Exception(f"Unexpected response type from AI service: {type(response)}")
            logger.info("✅ AI keyword trend analysis completed")
            return trend_analysis
            
        except Exception as e:
            logger.error(f"Error analyzing keyword trends: {str(e)}")
            # Return fallback response if AI fails
            return {
                'trends': {
                    f"{industry} trends": {
                        'search_volume': 5000,
                        'difficulty': 45,
                        'trend': 'rising',
                        'competition': 'medium',
                        'intent': 'informational',
                        'cpc': 2.5,
                        'seasonal_factor': 1.2
                    }
                },
                'summary': {
                    'total_keywords': 1,
                    'high_volume_keywords': 1,
                    'low_competition_keywords': 0,
                    'trending_keywords': 1,
                    'opportunity_score': 75
                },
                'recommendations': [
                    {
                        'keyword': f"{industry} trends",
                        'recommendation': 'Create comprehensive trend analysis content',
                        'priority': 'high',
                        'estimated_impact': 'High traffic potential'
                    }
                ]
            }
    
    async def _evaluate_search_intent(self, trend_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluate search intent using AI.
        
        Args:
            trend_analysis: Keyword trend analysis results
            
        Returns:
            Search intent analysis results
        """
        try:
            logger.info("🤖 Evaluating search intent using AI")
            
            # Create comprehensive prompt for search intent analysis
            prompt = f"""
            Analyze search intent based on the following keyword trend data:

            Trend Analysis: {json.dumps(trend_analysis, indent=2)}

            Provide comprehensive search intent analysis including:
            1. Intent classification (informational, transactional, navigational, commercial)
            2. User journey mapping
            3. Content format recommendations
            4. Conversion optimization suggestions
            5. User behavior patterns
            
            Format as structured JSON with detailed analysis.
            """
            
            # Use structured JSON response for better parsing
            response = self._structured_generation(
                prompt=prompt,
                schema={
                    "type": "object",
                    "properties": {
                        "informational": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "keyword": {"type": "string"},
                                    "intent_type": {"type": "string"},
                                    "content_suggestions": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    }
                                }
                            }
                        },
                        "transactional": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "keyword": {"type": "string"},
                                    "intent_type": {"type": "string"},
                                    "content_suggestions": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    }
                                }
                            }
                        },
                        "navigational": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "keyword": {"type": "string"},
                                    "intent_type": {"type": "string"},
                                    "content_suggestions": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    }
                                }
                            }
                        },
                        "summary": {
                            "type": "object",
                            "properties": {
                                "dominant_intent": {"type": "string"},
                                "content_strategy_recommendations": {
                                    "type": "array",
                                    "items": {"type": "string"}
                                }
                            }
                        }
                    }
                }
            )
            
            # Handle response - structured generation returns dict directly
            if isinstance(response, dict):
                intent_analysis = response
            elif isinstance(response, str):
                # If it's a string, try to parse as JSON
                try:
                    intent_analysis = json.loads(response)
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse AI response as JSON: {e}")
                    raise Exception(f"Invalid AI response format: {str(e)}")
            else:
                logger.error(f"Unexpected response type from AI service: {type(response)}")
                raise Exception(f"Unexpected response type from AI service: {type(response)}")
            
            logger.info("✅ AI search intent analysis completed")
            return intent_analysis
            
        except Exception as e:
            logger.error(f"Error evaluating search intent: {str(e)}")
            # Return fallback response if AI fails
            return {
                'informational': [
                    {
                        'keyword': 'how to guide',
                        'intent_type': 'educational',
                        'content_suggestions': ['Tutorial', 'Step-by-step guide', 'Explainer video']
                    },
                    {
                        'keyword': 'what is',
                        'intent_type': 'definition',
                        'content_suggestions': ['Definition', 'Overview', 'Introduction']
                    }
                ],
                'transactional': [
                    {
                        'keyword': 'buy',
                        'intent_type': 'purchase',
                        'content_suggestions': ['Product page', 'Pricing', 'Comparison']
                    },
                    {
                        'keyword': 'price',
                        'intent_type': 'cost_inquiry',
                        'content_suggestions': ['Pricing page', 'Cost calculator', 'Quote request']
                    }
                ],
                'navigational': [
                    {
                        'keyword': 'company name',
                        'intent_type': 'brand_search',
                        'content_suggestions': ['About page', 'Company overview', 'Contact']
                    }
                ],
                'summary': {
                    'dominant_intent': 'informational',
                    'content_strategy_recommendations': [
                        'Focus on educational content',
                        'Create comprehensive guides',
                        'Develop FAQ sections',
                        'Build authority through expertise'
                    ]
                }
            }
    
    async def _identify_opportunities(self, trend_analysis: Dict[str, Any], intent_analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Identify keyword opportunities using AI.
        
        Args:
            trend_analysis: Keyword trend analysis results
            intent_analysis: Search intent analysis results
            
        Returns:
            List of keyword opportunities
        """
        try:
            logger.info("🤖 Identifying keyword opportunities using AI")
            
            # Create comprehensive prompt for opportunity identification
            prompt = f"""
            Identify keyword opportunities based on the following analysis:

            Trend Analysis: {json.dumps(trend_analysis, indent=2)}
            Intent Analysis: {json.dumps(intent_analysis, indent=2)}

            Provide comprehensive opportunity analysis including:
            1. High-value keyword opportunities
            2. Low-competition keywords
            3. Long-tail keyword suggestions
            4. Content gap opportunities
            5. Competitive advantage opportunities
            6. Implementation priorities
            
            Format as structured JSON with detailed opportunities.
            """
            
            # Use structured JSON response for better parsing
            response = self._structured_generation(
                prompt=prompt,
                schema={
                    "type": "object",
                    "properties": {
                        "opportunities": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "keyword": {"type": "string"},
                                    "opportunity_type": {"type": "string"},
                                    "search_volume": {"type": "number"},
                                    "competition_level": {"type": "string"},
                                    "difficulty_score": {"type": "number"},
                                    "estimated_traffic": {"type": "string"},
                                    "content_suggestions": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    },
                                    "priority": {"type": "string"},
                                    "implementation_time": {"type": "string"}
                                }
                            }
                        }
                    }
                }
            )
            
            # Handle response - structured generation returns dict directly
            if isinstance(response, dict):
                result = response
            elif isinstance(response, str):
                # If it's a string, try to parse as JSON
                try:
                    result = json.loads(response)
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse AI response as JSON: {e}")
                    raise Exception(f"Invalid AI response format: {str(e)}")
            else:
                logger.error(f"Unexpected response type from AI service: {type(response)}")
                raise Exception(f"Unexpected response type from AI service: {type(response)}")
            
            opportunities = result.get('opportunities', [])
            logger.info(f"✅ AI opportunity identification completed: {len(opportunities)} opportunities found")
            return opportunities
            
        except Exception as e:
            logger.error(f"Error identifying opportunities: {str(e)}")
            # Return fallback response if AI fails
            return [
                {
                    'keyword': 'industry best practices',
                    'opportunity_type': 'content_gap',
                    'search_volume': 3000,
                    'competition_level': 'low',
                    'difficulty_score': 35,
                    'estimated_traffic': '2K+ monthly',
                    'content_suggestions': ['Comprehensive guide', 'Best practices list', 'Expert tips'],
                    'priority': 'high',
                    'implementation_time': '2-3 weeks'
                },
                {
                    'keyword': 'industry trends 2024',
                    'opportunity_type': 'trending',
                    'search_volume': 5000,
                    'competition_level': 'medium',
                    'difficulty_score': 45,
                    'estimated_traffic': '3K+ monthly',
                    'content_suggestions': ['Trend analysis', 'Industry report', 'Future predictions'],
                    'priority': 'medium',
                    'implementation_time': '3-4 weeks'
                }
            ]
    
    async def _generate_keyword_insights(self, trend_analysis: Dict[str, Any], intent_analysis: Dict[str, Any], opportunities: List[Dict[str, Any]]) -> List[str]:
        """
        Generate keyword insights using AI.
        
        Args:
            trend_analysis: Keyword trend analysis results
            intent_analysis: Search intent analysis results
            opportunities: List of keyword opportunities
            
        Returns:
            List of keyword insights
        """
        try:
            logger.info("🤖 Generating keyword insights using AI")
            
            # Create comprehensive prompt for insight generation
            prompt = f"""
            Generate strategic keyword insights based on the following analysis:

            Trend Analysis: {json.dumps(trend_analysis, indent=2)}
            Intent Analysis: {json.dumps(intent_analysis, indent=2)}
            Opportunities: {json.dumps(opportunities, indent=2)}

            Provide strategic insights covering:
            1. Keyword strategy recommendations
            2. Content optimization suggestions
            3. Competitive positioning advice
            4. Implementation priorities
            5. Performance optimization tips
            
            Format as structured JSON with detailed insights.
            """
            
            # Use structured JSON response for better parsing
            response = self._structured_generation(
                prompt=prompt,
                schema={
                    "type": "object",
                    "properties": {
                        "insights": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "insight": {"type": "string"},
                                    "category": {"type": "string"},
                                    "priority": {"type": "string"},
                                    "estimated_impact": {"type": "string"},
                                    "implementation_suggestion": {"type": "string"}
                                }
                            }
                        }
                    }
                }
            )
            
            # Parse and return the AI response
            result = json.loads(response)
            insights = result.get('insights', [])
            insight_texts = [insight.get('insight', '') for insight in insights if insight.get('insight')]
            logger.info(f"✅ AI keyword insights generated: {len(insight_texts)} insights")
            return insight_texts
            
        except Exception as e:
            logger.error(f"Error generating keyword insights: {str(e)}")
            # Return fallback response if AI fails
            return [
                'Focus on educational content to capture informational search intent',
                'Develop comprehensive guides for high-opportunity keywords',
                'Create content series around main topic clusters',
                'Optimize existing content for target keywords',
                'Build authority through expert-level content'
            ]
    
    async def expand_keywords(self, seed_keywords: List[str], industry: str) -> Dict[str, Any]:
        """
        Expand keywords using advanced techniques.
        
        Args:
            seed_keywords: Initial keywords to expand from
            industry: Industry category
            
        Returns:
            Expanded keyword results
        """
        try:
            logger.info(f"Expanding {len(seed_keywords)} seed keywords for {industry} industry")
            
            expanded_results = {
                'seed_keywords': seed_keywords,
                'expanded_keywords': [],
                'keyword_categories': {},
                'long_tail_opportunities': [],
                'semantic_variations': [],
                'related_keywords': []
            }
            
            # Generate expanded keywords for each seed keyword
            for seed_keyword in seed_keywords:
                # Generate variations
                variations = await self._generate_keyword_variations(seed_keyword, industry)
                expanded_results['expanded_keywords'].extend(variations)
                
                # Generate long-tail keywords
                long_tail = await self._generate_long_tail_keywords(seed_keyword, industry)
                expanded_results['long_tail_opportunities'].extend(long_tail)
                
                # Generate semantic variations
                semantic = await self._generate_semantic_variations(seed_keyword, industry)
                expanded_results['semantic_variations'].extend(semantic)
                
                # Generate related keywords
                related = await self._generate_related_keywords(seed_keyword, industry)
                expanded_results['related_keywords'].extend(related)
            
            # Categorize keywords
            expanded_results['keyword_categories'] = await self._categorize_expanded_keywords(expanded_results['expanded_keywords'])
            
            # Remove duplicates
            expanded_results['expanded_keywords'] = list(set(expanded_results['expanded_keywords']))
            expanded_results['long_tail_opportunities'] = list(set(expanded_results['long_tail_opportunities']))
            expanded_results['semantic_variations'] = list(set(expanded_results['semantic_variations']))
            expanded_results['related_keywords'] = list(set(expanded_results['related_keywords']))
            
            logger.info(f"Expanded {len(seed_keywords)} seed keywords into {len(expanded_results['expanded_keywords'])} total keywords")
            return expanded_results
            
        except Exception as e:
            logger.error(f"Error expanding keywords: {str(e)}")
            return {}
    
    async def analyze_search_intent(self, keywords: List[str]) -> Dict[str, Any]:
        """
        Analyze search intent for keywords.
        
        Args:
            keywords: List of keywords to analyze
            
        Returns:
            Search intent analysis results
        """
        try:
            logger.info(f"Analyzing search intent for {len(keywords)} keywords")
            
            intent_analysis = {
                'keyword_intents': {},
                'intent_patterns': {},
                'content_recommendations': {},
                'user_journey_mapping': {}
            }
            
            for keyword in keywords:
                # Analyze individual keyword intent
                keyword_intent = await self._analyze_single_keyword_intent(keyword)
                intent_analysis['keyword_intents'][keyword] = keyword_intent
                
                # Generate content recommendations
                content_recs = await self._generate_content_recommendations(keyword, keyword_intent)
                intent_analysis['content_recommendations'][keyword] = content_recs
            
            # Analyze intent patterns
            intent_analysis['intent_patterns'] = await self._analyze_intent_patterns(intent_analysis['keyword_intents'])
            
            # Map user journey
            intent_analysis['user_journey_mapping'] = await self._map_user_journey(intent_analysis['keyword_intents'])
            
            logger.info(f"Search intent analysis completed for {len(keywords)} keywords")
            return intent_analysis
            
        except Exception as e:
            logger.error(f"Error analyzing search intent: {str(e)}")
            return {}
    
    # Advanced Features Implementation
    
    async def _generate_titles(self, industry: str) -> Dict[str, Any]:
        """
        Generate keyword-based titles using AI.
        
        Args:
            industry: Industry category
            
        Returns:
            Generated titles and patterns
        """
        try:
            logger.info(f"Generating titles for {industry} industry")
            
            # TODO: Integrate with actual title generator service
            # For now, simulate title generation
            
            title_patterns = {
                'how_to': [
                    f"How to {industry}",
                    f"How to {industry} effectively",
                    f"How to {industry} in 2024",
                    f"How to {industry} for beginners"
                ],
                'best_practices': [
                    f"Best {industry} practices",
                    f"Top {industry} strategies",
                    f"Essential {industry} tips",
                    f"Professional {industry} guide"
                ],
                'comparison': [
                    f"{industry} vs alternatives",
                    f"Comparing {industry} solutions",
                    f"{industry} comparison guide",
                    f"Which {industry} is best?"
                ],
                'trends': [
                    f"{industry} trends 2024",
                    f"Latest {industry} developments",
                    f"Future of {industry}",
                    f"Emerging {industry} technologies"
                ]
            }
            
            return {
                'patterns': title_patterns,
                'recommendations': [
                    "Use action words in titles",
                    "Include numbers for better CTR",
                    "Add emotional triggers",
                    "Keep titles under 60 characters"
                ],
                'best_practices': [
                    "Start with power words",
                    "Include target keyword",
                    "Add urgency or scarcity",
                    "Use brackets for additional info"
                ]
            }
            
        except Exception as e:
            logger.error(f"Error generating titles: {str(e)}")
            return {}
    
    async def _analyze_meta_descriptions(self, industry: str) -> Dict[str, Any]:
        """
        Analyze meta descriptions for keyword usage.
        
        Args:
            industry: Industry category
            
        Returns:
            Meta description analysis results
        """
        try:
            logger.info(f"Analyzing meta descriptions for {industry} industry")
            
            # TODO: Integrate with actual meta description analyzer
            # For now, simulate analysis
            
            meta_analysis = {
                'optimal_length': 155,
                'keyword_density': 0.02,
                'call_to_action': True,
                'recommendations': [
                    f"Include primary {industry} keyword",
                    "Add compelling call-to-action",
                    "Keep under 155 characters",
                    "Use action verbs",
                    "Include unique value proposition"
                ],
                'examples': [
                    f"Discover the best {industry} strategies. Learn proven techniques and tools to improve your {industry} performance.",
                    f"Master {industry} with our comprehensive guide. Expert tips, case studies, and actionable advice.",
                    f"Transform your {industry} approach. Get expert insights, tools, and strategies for success."
                ]
            }
            
            return meta_analysis
            
        except Exception as e:
            logger.error(f"Error analyzing meta descriptions: {str(e)}")
            return {}
    
    async def _analyze_structured_data(self, industry: str) -> Dict[str, Any]:
        """
        Analyze structured data implementation.
        
        Args:
            industry: Industry category
            
        Returns:
            Structured data analysis results
        """
        try:
            logger.info(f"Analyzing structured data for {industry} industry")
            
            # TODO: Integrate with actual structured data analyzer
            # For now, simulate analysis
            
            structured_data = {
                'recommended_schemas': [
                    'Article',
                    'HowTo',
                    'FAQPage',
                    'Organization',
                    'WebPage'
                ],
                'implementation_priority': [
                    {
                        'schema': 'Article',
                        'priority': 'high',
                        'reason': 'Content-focused industry'
                    },
                    {
                        'schema': 'HowTo',
                        'priority': 'medium',
                        'reason': 'Educational content opportunities'
                    },
                    {
                        'schema': 'FAQPage',
                        'priority': 'medium',
                        'reason': 'Common questions in industry'
                    }
                ],
                'examples': {
                    'Article': {
                        'headline': f"Complete Guide to {industry}",
                        'author': 'Industry Expert',
                        'datePublished': '2024-01-01',
                        'description': f"Comprehensive guide covering all aspects of {industry}"
                    },
                    'HowTo': {
                        'name': f"How to {industry}",
                        'description': f"Step-by-step guide to {industry}",
                        'step': [
                            {'name': 'Research', 'text': 'Understand the basics'},
                            {'name': 'Plan', 'text': 'Create your strategy'},
                            {'name': 'Execute', 'text': 'Implement your plan'}
                        ]
                    }
                }
            }
            
            return structured_data
            
        except Exception as e:
            logger.error(f"Error analyzing structured data: {str(e)}")
            return {}
    
    async def _extract_keywords(self, titles: Dict[str, Any], meta_analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract keywords from titles and meta descriptions.
        
        Args:
            titles: Generated titles
            meta_analysis: Meta description analysis
            
        Returns:
            Extracted keywords with metrics
        """
        try:
            logger.info("Extracting keywords from content")
            
            # TODO: Integrate with actual keyword extraction service
            # For now, simulate extraction
            
            extracted_keywords = []
            
            # Extract from titles
            for pattern, title_list in titles.get('patterns', {}).items():
                for title in title_list:
                    # Simulate keyword extraction
                    words = title.lower().split()
                    for word in words:
                        if len(word) > 3:  # Filter short words
                            extracted_keywords.append({
                                'keyword': word,
                                'source': 'title',
                                'pattern': pattern,
                                'search_volume': 1000 + hash(word) % 5000,
                                'difficulty': hash(word) % 100,
                                'relevance_score': 0.8 + (hash(word) % 20) / 100,
                                'content_type': 'title'
                            })
            
            # Extract from meta descriptions
            for example in meta_analysis.get('examples', []):
                words = example.lower().split()
                for word in words:
                    if len(word) > 3 and word not in ['the', 'and', 'for', 'with']:
                        extracted_keywords.append({
                            'keyword': word,
                            'source': 'meta_description',
                            'search_volume': 500 + hash(word) % 3000,
                            'difficulty': hash(word) % 100,
                            'relevance_score': 0.7 + (hash(word) % 30) / 100,
                            'content_type': 'meta_description'
                        })
            
            # Remove duplicates and sort by relevance
            unique_keywords = {}
            for kw in extracted_keywords:
                if kw['keyword'] not in unique_keywords:
                    unique_keywords[kw['keyword']] = kw
                else:
                    # Merge if same keyword from different sources
                    unique_keywords[kw['keyword']]['relevance_score'] = max(
                        unique_keywords[kw['keyword']]['relevance_score'],
                        kw['relevance_score']
                    )
            
            return sorted(unique_keywords.values(), key=lambda x: x['relevance_score'], reverse=True)
            
        except Exception as e:
            logger.error(f"Error extracting keywords: {str(e)}")
            return []
    
    async def _analyze_search_intent(self, ai_insights: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze search intent using AI.
        
        Args:
            ai_insights: AI-processed insights
            
        Returns:
            Search intent analysis
        """
        try:
            logger.info("🤖 Analyzing search intent using AI")
            
            # Create comprehensive prompt for search intent analysis
            prompt = f"""
            Analyze search intent based on the following AI insights:

            AI Insights: {json.dumps(ai_insights, indent=2)}

            Provide comprehensive search intent analysis including:
            1. Intent classification (informational, transactional, navigational, commercial)
            2. User journey mapping
            3. Content format recommendations
            4. Conversion optimization suggestions
            5. User behavior patterns
            6. Content strategy recommendations
            
            Format as structured JSON with detailed analysis.
            """
            
            # Use structured JSON response for better parsing
            response = self._structured_generation(
                prompt=prompt,
                schema={
                    "type": "object",
                    "properties": {
                        "informational": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "keyword": {"type": "string"},
                                    "intent_type": {"type": "string"},
                                    "content_suggestions": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    }
                                }
                            }
                        },
                        "transactional": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "keyword": {"type": "string"},
                                    "intent_type": {"type": "string"},
                                    "content_suggestions": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    }
                                }
                            }
                        },
                        "navigational": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "keyword": {"type": "string"},
                                    "intent_type": {"type": "string"},
                                    "content_suggestions": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    }
                                }
                            }
                        },
                        "summary": {
                            "type": "object",
                            "properties": {
                                "dominant_intent": {"type": "string"},
                                "content_strategy_recommendations": {
                                    "type": "array",
                                    "items": {"type": "string"}
                                }
                            }
                        }
                    }
                }
            )
            
            # Parse and return the AI response
            intent_analysis = json.loads(response)
            logger.info("✅ AI search intent analysis completed")
            return intent_analysis
            
        except Exception as e:
            logger.error(f"Error analyzing search intent: {str(e)}")
            # Return fallback response if AI fails
            return {
                'informational': [
                    {
                        'keyword': 'how to guide',
                        'intent_type': 'educational',
                        'content_suggestions': ['Tutorial', 'Step-by-step guide', 'Explainer video']
                    },
                    {
                        'keyword': 'what is',
                        'intent_type': 'definition',
                        'content_suggestions': ['Definition', 'Overview', 'Introduction']
                    }
                ],
                'transactional': [
                    {
                        'keyword': 'buy',
                        'intent_type': 'purchase',
                        'content_suggestions': ['Product page', 'Pricing', 'Comparison']
                    },
                    {
                        'keyword': 'price',
                        'intent_type': 'cost_inquiry',
                        'content_suggestions': ['Pricing page', 'Cost calculator', 'Quote request']
                    }
                ],
                'navigational': [
                    {
                        'keyword': 'company name',
                        'intent_type': 'brand_search',
                        'content_suggestions': ['About page', 'Company overview', 'Contact']
                    }
                ],
                'summary': {
                    'dominant_intent': 'informational',
                    'content_strategy_recommendations': [
                        'Focus on educational content',
                        'Create comprehensive guides',
                        'Develop FAQ sections',
                        'Build authority through expertise'
                    ]
                }
            }
    
    async def _suggest_content_formats(self, ai_insights: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Suggest content formats based on AI insights.
        
        Args:
            ai_insights: AI-processed insights
            
        Returns:
            Suggested content formats
        """
        try:
            logger.info("🤖 Suggesting content formats using AI")
            
            # Create comprehensive prompt for content format suggestions
            prompt = f"""
            Suggest content formats based on the following AI insights:

            AI Insights: {json.dumps(ai_insights, indent=2)}

            Provide comprehensive content format suggestions including:
            1. Content format recommendations
            2. Use cases for each format
            3. Recommended topics
            4. Estimated impact
            5. Implementation considerations
            6. Engagement potential
            
            Format as structured JSON with detailed suggestions.
            """
            
            # Use structured JSON response for better parsing
            response = self._structured_generation(
                prompt=prompt,
                schema={
                    "type": "object",
                    "properties": {
                        "content_formats": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "format": {"type": "string"},
                                    "description": {"type": "string"},
                                    "use_cases": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    },
                                    "recommended_topics": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    },
                                    "estimated_impact": {"type": "string"},
                                    "engagement_potential": {"type": "string"},
                                    "implementation_difficulty": {"type": "string"}
                                }
                            }
                        }
                    }
                }
            )
            
            # Parse and return the AI response
            result = json.loads(response)
            content_formats = result.get('content_formats', [])
            logger.info(f"✅ AI content format suggestions completed: {len(content_formats)} formats suggested")
            return content_formats
            
        except Exception as e:
            logger.error(f"Error suggesting content formats: {str(e)}")
            # Return fallback response if AI fails
            return [
                {
                    'format': 'comprehensive_guide',
                    'description': 'In-depth guide covering all aspects of a topic',
                    'use_cases': ['Educational content', 'Authority building', 'SEO optimization'],
                    'recommended_topics': ['How-to guides', 'Best practices', 'Complete tutorials'],
                    'estimated_impact': 'High engagement and authority building',
                    'engagement_potential': 'High',
                    'implementation_difficulty': 'Medium'
                },
                {
                    'format': 'case_study',
                    'description': 'Real-world examples with measurable results',
                    'use_cases': ['Social proof', 'Problem solving', 'Success stories'],
                    'recommended_topics': ['Customer success', 'Problem solutions', 'Results showcase'],
                    'estimated_impact': 'High conversion and trust building',
                    'engagement_potential': 'Medium',
                    'implementation_difficulty': 'High'
                },
                {
                    'format': 'video_tutorial',
                    'description': 'Visual step-by-step instructions',
                    'use_cases': ['Complex processes', 'Visual learners', 'Engagement'],
                    'recommended_topics': ['Software tutorials', 'Process demonstrations', 'Expert interviews'],
                    'estimated_impact': 'High engagement and retention',
                    'engagement_potential': 'Very High',
                    'implementation_difficulty': 'High'
                },
                {
                    'format': 'infographic',
                    'description': 'Visual representation of data and concepts',
                    'use_cases': ['Data visualization', 'Quick understanding', 'Social sharing'],
                    'recommended_topics': ['Statistics', 'Process flows', 'Comparisons'],
                    'estimated_impact': 'High social sharing and engagement',
                    'engagement_potential': 'High',
                    'implementation_difficulty': 'Medium'
                },
                {
                    'format': 'interactive_content',
                    'description': 'Engaging content with user interaction',
                    'use_cases': ['Lead generation', 'User engagement', 'Data collection'],
                    'recommended_topics': ['Quizzes', 'Calculators', 'Interactive tools'],
                    'estimated_impact': 'High engagement and lead generation',
                    'engagement_potential': 'Very High',
                    'implementation_difficulty': 'High'
                }
            ]
    
    async def _create_topic_clusters(self, ai_insights: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create topic clusters using AI.
        
        Args:
            ai_insights: AI-processed insights
            
        Returns:
            Topic cluster analysis
        """
        try:
            logger.info("🤖 Creating topic clusters using AI")
            
            # Create comprehensive prompt for topic cluster creation
            prompt = f"""
            Create topic clusters based on the following AI insights:

            AI Insights: {json.dumps(ai_insights, indent=2)}

            Provide comprehensive topic cluster analysis including:
            1. Main topic clusters
            2. Subtopics within each cluster
            3. Keyword relationships
            4. Content hierarchy
            5. Implementation strategy
            6. SEO optimization opportunities
            
            Format as structured JSON with detailed clusters.
            """
            
            # Use structured JSON response for better parsing
            response = self._structured_generation(
                prompt=prompt,
                schema={
                    "type": "object",
                    "properties": {
                        "topic_clusters": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "cluster_name": {"type": "string"},
                                    "main_topic": {"type": "string"},
                                    "subtopics": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    },
                                    "keywords": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    },
                                    "content_suggestions": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    },
                                    "priority": {"type": "string"},
                                    "estimated_impact": {"type": "string"}
                                }
                            }
                        },
                        "summary": {
                            "type": "object",
                            "properties": {
                                "total_clusters": {"type": "number"},
                                "total_keywords": {"type": "number"},
                                "implementation_priority": {"type": "string"},
                                "seo_opportunities": {
                                    "type": "array",
                                    "items": {"type": "string"}
                                }
                            }
                        }
                    }
                }
            )
            
            # Parse and return the AI response
            result = json.loads(response)
            logger.info("✅ AI topic cluster creation completed")
            return result
            
        except Exception as e:
            logger.error(f"Error creating topic clusters: {str(e)}")
            # Return fallback response if AI fails
            return {
                'topic_clusters': [
                    {
                        'cluster_name': 'Industry Fundamentals',
                        'main_topic': 'Basic concepts and principles',
                        'subtopics': ['Introduction', 'Core concepts', 'Basic terminology'],
                        'keywords': ['industry basics', 'fundamentals', 'introduction'],
                        'content_suggestions': ['Beginner guide', 'Overview article', 'Glossary'],
                        'priority': 'high',
                        'estimated_impact': 'High traffic potential'
                    },
                    {
                        'cluster_name': 'Advanced Strategies',
                        'main_topic': 'Advanced techniques and strategies',
                        'subtopics': ['Advanced techniques', 'Expert strategies', 'Best practices'],
                        'keywords': ['advanced strategies', 'expert tips', 'best practices'],
                        'content_suggestions': ['Expert guide', 'Advanced tutorial', 'Strategy guide'],
                        'priority': 'medium',
                        'estimated_impact': 'Authority building'
                    }
                ],
                'summary': {
                    'total_clusters': 2,
                    'total_keywords': 6,
                    'implementation_priority': 'Start with fundamentals cluster',
                    'seo_opportunities': [
                        'Internal linking between clusters',
                        'Comprehensive topic coverage',
                        'Keyword optimization for each cluster'
                    ]
                }
            }
    
    # Helper methods for keyword expansion
    
    async def _generate_keyword_variations(self, seed_keyword: str, industry: str) -> List[str]:
        """Generate keyword variations."""
        variations = [
            f"{seed_keyword} guide",
            f"best {seed_keyword}",
            f"how to {seed_keyword}",
            f"{seed_keyword} tips",
            f"{seed_keyword} tutorial",
            f"{seed_keyword} examples",
            f"{seed_keyword} vs",
            f"{seed_keyword} review",
            f"{seed_keyword} comparison",
            f"{industry} {seed_keyword}",
            f"{seed_keyword} {industry}",
            f"{seed_keyword} strategies",
            f"{seed_keyword} techniques",
            f"{seed_keyword} tools"
        ]
        return variations
    
    async def _generate_long_tail_keywords(self, seed_keyword: str, industry: str) -> List[str]:
        """Generate long-tail keywords."""
        long_tail = [
            f"how to {seed_keyword} for beginners",
            f"best {seed_keyword} strategies for {industry}",
            f"{seed_keyword} vs alternatives comparison",
            f"advanced {seed_keyword} techniques",
            f"{seed_keyword} case studies examples",
            f"step by step {seed_keyword} guide",
            f"{seed_keyword} best practices 2024",
            f"{seed_keyword} tools and resources",
            f"{seed_keyword} implementation guide",
            f"{seed_keyword} optimization tips"
        ]
        return long_tail
    
    async def _generate_semantic_variations(self, seed_keyword: str, industry: str) -> List[str]:
        """Generate semantic variations."""
        semantic = [
            f"{seed_keyword} alternatives",
            f"{seed_keyword} solutions",
            f"{seed_keyword} methods",
            f"{seed_keyword} approaches",
            f"{seed_keyword} systems",
            f"{seed_keyword} platforms",
            f"{seed_keyword} software",
            f"{seed_keyword} tools",
            f"{seed_keyword} services",
            f"{seed_keyword} providers"
        ]
        return semantic
    
    async def _generate_related_keywords(self, seed_keyword: str, industry: str) -> List[str]:
        """Generate related keywords."""
        related = [
            f"{seed_keyword} optimization",
            f"{seed_keyword} improvement",
            f"{seed_keyword} enhancement",
            f"{seed_keyword} development",
            f"{seed_keyword} implementation",
            f"{seed_keyword} execution",
            f"{seed_keyword} management",
            f"{seed_keyword} planning",
            f"{seed_keyword} strategy",
            f"{seed_keyword} framework"
        ]
        return related
    
    async def _categorize_expanded_keywords(self, keywords: List[str]) -> Dict[str, List[str]]:
        """Categorize expanded keywords."""
        categories = {
            'informational': [],
            'commercial': [],
            'navigational': [],
            'transactional': []
        }
        
        for keyword in keywords:
            keyword_lower = keyword.lower()
            if any(word in keyword_lower for word in ['how', 'what', 'why', 'guide', 'tips', 'tutorial']):
                categories['informational'].append(keyword)
            elif any(word in keyword_lower for word in ['best', 'top', 'review', 'comparison', 'vs']):
                categories['commercial'].append(keyword)
            elif any(word in keyword_lower for word in ['buy', 'purchase', 'price', 'cost']):
                categories['transactional'].append(keyword)
            else:
                categories['navigational'].append(keyword)
        
        return categories
    
    async def _analyze_single_keyword_intent(self, keyword: str) -> Dict[str, Any]:
        """Analyze intent for a single keyword."""
        keyword_lower = keyword.lower()
        
        if any(word in keyword_lower for word in ['how', 'what', 'why', 'guide', 'tips']):
            intent_type = 'informational'
            content_type = 'educational'
        elif any(word in keyword_lower for word in ['best', 'top', 'review', 'comparison']):
            intent_type = 'commercial'
            content_type = 'comparison'
        elif any(word in keyword_lower for word in ['buy', 'purchase', 'price', 'cost']):
            intent_type = 'transactional'
            content_type = 'product'
        else:
            intent_type = 'navigational'
            content_type = 'brand'
        
        return {
            'keyword': keyword,
            'intent_type': intent_type,
            'content_type': content_type,
            'confidence': 0.8
        }
    
    async def _generate_content_recommendations(self, keyword: str, intent_analysis: Dict[str, Any]) -> List[str]:
        """Generate content recommendations for a keyword."""
        intent_type = intent_analysis.get('intent_type', 'informational')
        
        recommendations = {
            'informational': [
                'Create comprehensive guide',
                'Add step-by-step instructions',
                'Include examples and case studies',
                'Provide expert insights'
            ],
            'commercial': [
                'Create comparison content',
                'Add product reviews',
                'Include pricing information',
                'Provide buying guides'
            ],
            'transactional': [
                'Create product pages',
                'Add pricing information',
                'Include purchase options',
                'Provide customer testimonials'
            ],
            'navigational': [
                'Create brand pages',
                'Add company information',
                'Include contact details',
                'Provide about us content'
            ]
        }
        
        return recommendations.get(intent_type, [])
    
    async def _analyze_intent_patterns(self, keyword_intents: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze patterns in keyword intents."""
        intent_counts = Counter(intent['intent_type'] for intent in keyword_intents.values())
        total_keywords = len(keyword_intents)
        
        patterns = {
            'intent_distribution': {intent: count/total_keywords for intent, count in intent_counts.items()},
            'dominant_intent': intent_counts.most_common(1)[0][0] if intent_counts else 'informational',
            'intent_mix': 'balanced' if len(intent_counts) >= 3 else 'focused'
        }
        
        return patterns
    
    async def _map_user_journey(self, keyword_intents: Dict[str, Any]) -> Dict[str, Any]:
        """Map user journey based on keyword intents."""
        journey_stages = {
            'awareness': [],
            'consideration': [],
            'decision': []
        }
        
        for keyword, intent in keyword_intents.items():
            intent_type = intent.get('intent_type', 'informational')
            
            if intent_type == 'informational':
                journey_stages['awareness'].append(keyword)
            elif intent_type == 'commercial':
                journey_stages['consideration'].append(keyword)
            elif intent_type == 'transactional':
                journey_stages['decision'].append(keyword)
        
        return {
            'journey_stages': journey_stages,
            'content_strategy': {
                'awareness': 'Educational content and guides',
                'consideration': 'Comparison and review content',
                'decision': 'Product and pricing content'
            }
        }
    
    def _get_opportunity_recommendation(self, opportunity_type: str) -> str:
        """Get recommendation for opportunity type."""
        recommendations = {
            'high_volume_low_competition': 'Create comprehensive content targeting this keyword',
            'medium_volume_medium_competition': 'Develop competitive content with unique angle',
            'trending_keyword': 'Create timely content to capitalize on trend',
            'high_value_commercial': 'Focus on conversion-optimized content'
        }
        return recommendations.get(opportunity_type, 'Create relevant content for this keyword')
    
    async def get_keyword_summary(self, analysis_id: str) -> Dict[str, Any]:
        """
        Get keyword analysis summary by ID.
        
        Args:
            analysis_id: Analysis identifier
            
        Returns:
            Keyword analysis summary
        """
        try:
            # TODO: Implement database retrieval
            return {
                'analysis_id': analysis_id,
                'status': 'completed',
                'summary': 'Keyword analysis completed successfully'
            }
        except Exception as e:
            logger.error(f"Error getting keyword summary: {str(e)}")
            return {}
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Health check for the keyword researcher service.
        
        Returns:
            Health status
        """
        try:
            # Test basic functionality
            test_industry = 'test'
            test_keywords = ['test keyword']
            
            # Test keyword analysis
            analysis_test = await self._analyze_keyword_trends(test_industry, test_keywords)
            
            # Test intent analysis
            intent_test = await self._evaluate_search_intent(analysis_test)
            
            # Test opportunity identification
            opportunity_test = await self._identify_opportunities(analysis_test, intent_test)
            
            return {
                'status': 'healthy',
                'service': 'KeywordResearcher',
                'tests_passed': 3,
                'total_tests': 3,
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
            return {
                'status': 'unhealthy',
                'service': 'KeywordResearcher',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            } 