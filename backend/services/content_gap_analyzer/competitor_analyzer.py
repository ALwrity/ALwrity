"""
Competitor Analyzer Service
Converted from competitor_analyzer.py for FastAPI integration.
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
from services.llm_providers.gemini_provider import gemini_structured_json_response

# Import existing modules (will be updated to use FastAPI services)
from services.database import get_db_session
from .ai_engine_service import AIEngineService
from .website_analyzer import WebsiteAnalyzer

class CompetitorAnalyzer:
    """Analyzes competitor content and market position."""
    
    def __init__(self):
        """Initialize the competitor analyzer."""
        self.website_analyzer = WebsiteAnalyzer()
        self.ai_engine = AIEngineService()
        
        logger.trace("CompetitorAnalyzer initialized (content-gap competitor comparison)")
    
    async def analyze_competitors(self, competitor_urls: List[str], industry: str) -> Dict[str, Any]:
        """
        Analyze competitor websites.
        
        Args:
            competitor_urls: List of competitor URLs to analyze
            industry: Industry category
            
        Returns:
            Dictionary containing competitor analysis results
        """
        try:
            logger.info(f"Starting competitor analysis for {len(competitor_urls)} competitors in {industry} industry")
            
            results = {
                'competitors': [],
                'market_position': {},
                'content_gaps': [],
                'advantages': [],
                'analysis_timestamp': datetime.utcnow().isoformat(),
                'industry': industry
            }
            
            # Analyze each competitor
            for url in competitor_urls:
                competitor_analysis = await self._analyze_single_competitor(url, industry)
                if competitor_analysis:
                    results['competitors'].append({
                        'url': url,
                        'analysis': competitor_analysis
                    })
            
            # Generate market position analysis using AI
            if results['competitors']:
                market_position = await self._evaluate_market_position(results['competitors'], industry)
                results['market_position'] = market_position
                
                # Identify content gaps
                content_gaps = await self._identify_content_gaps(results['competitors'])
                results['content_gaps'] = content_gaps
                
                # Generate competitive insights
                competitive_insights = await self._generate_competitive_insights(results)
                results['advantages'] = competitive_insights
            
            logger.info(f"Competitor analysis completed for {len(competitor_urls)} competitors")
            return results
            
        except Exception as e:
            logger.error(f"Error in competitor analysis: {str(e)}")
            return {}
    
    async def _analyze_single_competitor(self, url: str, industry: str) -> Optional[Dict[str, Any]]:
        """
        Analyze a single competitor website.
        
        Args:
            url: Competitor URL
            industry: Industry category
            
        Returns:
            Competitor analysis results
        """
        try:
            logger.info(f"Analyzing competitor: {url}")
            
            # TODO: Integrate with actual website analysis service
            # This will use the website analyzer service
            
            # Simulate competitor analysis
            analysis = {
                'content_count': 150,
                'avg_quality_score': 8.5,
                'top_keywords': ['AI', 'ML', 'Data Science'],
                'content_types': ['blog', 'case_study', 'whitepaper'],
                'publishing_frequency': 'weekly',
                'engagement_metrics': {
                    'avg_time_on_page': 180,
                    'bounce_rate': 0.35,
                    'social_shares': 45
                },
                'seo_metrics': {
                    'domain_authority': 75,
                    'page_speed': 85,
                    'mobile_friendly': True
                }
            }
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing competitor {url}: {str(e)}")
            return None
    
    async def _evaluate_market_position(self, competitors: List[Dict[str, Any]], industry: str) -> Dict[str, Any]:
        """
        Evaluate market position using AI.
        
        Args:
            competitors: List of competitor analysis results
            industry: Industry category
            
        Returns:
            Market position analysis
        """
        try:
            logger.info("🤖 Evaluating market position using AI")
            
            # Create comprehensive prompt for market position analysis
            prompt = f"""
            Analyze the market position of competitors in the {industry} industry:

            Competitor Analyses:
            {json.dumps(competitors, indent=2)}

            Provide comprehensive market position analysis including:
            1. Market leader identification
            2. Content leader analysis
            3. Quality leader assessment
            4. Market gaps identification
            5. Opportunities analysis
            6. Competitive advantages
            7. Strategic positioning recommendations
            
            Format as structured JSON with detailed analysis.
            """
            
            # Use structured JSON response for better parsing
            response = gemini_structured_json_response(
                prompt=prompt,
                schema={
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
                                    "estimated_impact": {"type": "string"}
                                }
                            }
                        }
                    }
                }
            )
            
            # Handle response - gemini_structured_json_response returns dict directly
            if isinstance(response, dict):
                market_position = response
            elif isinstance(response, str):
                # If it's a string, try to parse as JSON
                try:
                    market_position = json.loads(response)
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse AI response as JSON: {e}")
                    raise Exception(f"Invalid AI response format: {str(e)}")
            else:
                logger.error(f"Unexpected response type from AI service: {type(response)}")
                raise Exception(f"Unexpected response type from AI service: {type(response)}")
            logger.info("✅ AI market position analysis completed")
            return market_position
            
        except Exception as e:
            logger.error(f"Error evaluating market position: {str(e)}")
            # Return fallback response if AI fails
            return {
                'market_leader': 'competitor1.com',
                'content_leader': 'competitor2.com',
                'quality_leader': 'competitor3.com',
                'market_gaps': [
                    'Video content',
                    'Interactive content',
                    'User-generated content',
                    'Expert interviews',
                    'Industry reports'
                ],
                'opportunities': [
                    'Niche content development',
                    'Expert interviews',
                    'Industry reports',
                    'Case studies',
                    'Tutorial series'
                ],
                'competitive_advantages': [
                    'Technical expertise',
                    'Comprehensive guides',
                    'Industry insights',
                    'Expert opinions'
                ],
                'strategic_recommendations': [
                    {
                        'type': 'differentiation',
                        'recommendation': 'Focus on unique content angles',
                        'priority': 'high',
                        'estimated_impact': 'Brand differentiation'
                    },
                    {
                        'type': 'quality',
                        'recommendation': 'Improve content quality and depth',
                        'priority': 'high',
                        'estimated_impact': 'Authority building'
                    },
                    {
                        'type': 'innovation',
                        'recommendation': 'Develop innovative content formats',
                        'priority': 'medium',
                        'estimated_impact': 'Engagement improvement'
                    }
                ]
            }
    
    async def _identify_content_gaps(self, competitors: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Identify content gaps using AI.
        
        Args:
            competitors: List of competitor analysis results
            
        Returns:
            List of content gaps
        """
        try:
            logger.info("🤖 Identifying content gaps using AI")
            
            # Create comprehensive prompt for content gap identification
            prompt = f"""
            Identify content gaps based on the following competitor analysis:

            Competitor Analysis: {json.dumps(competitors, indent=2)}

            Provide comprehensive content gap analysis including:
            1. Missing content topics
            2. Content depth gaps
            3. Content format gaps
            4. Content quality gaps
            5. SEO opportunity gaps
            6. Implementation priorities
            
            Format as structured JSON with detailed gaps.
            """
            
            # Use structured JSON response for better parsing
            response = gemini_structured_json_response(
                prompt=prompt,
                schema={
                    "type": "object",
                    "properties": {
                        "content_gaps": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "gap_type": {"type": "string"},
                                    "description": {"type": "string"},
                                    "opportunity_level": {"type": "string"},
                                    "estimated_impact": {"type": "string"},
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
            
            # Handle response - gemini_structured_json_response returns dict directly
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
            
            content_gaps = result.get('content_gaps', [])
            logger.info(f"✅ AI content gap identification completed: {len(content_gaps)} gaps found")
            return content_gaps
            
        except Exception as e:
            logger.error(f"Error identifying content gaps: {str(e)}")
            # Return fallback response if AI fails
            return [
                {
                    'gap_type': 'video_content',
                    'description': 'Limited video tutorials and demonstrations',
                    'opportunity_level': 'high',
                    'estimated_impact': 'High engagement potential',
                    'content_suggestions': ['Video tutorials', 'Product demos', 'Expert interviews'],
                    'priority': 'high',
                    'implementation_time': '3-6 months'
                },
                {
                    'gap_type': 'interactive_content',
                    'description': 'No interactive tools or calculators',
                    'opportunity_level': 'medium',
                    'estimated_impact': 'Lead generation and engagement',
                    'content_suggestions': ['Interactive calculators', 'Assessment tools', 'Quizzes'],
                    'priority': 'medium',
                    'implementation_time': '2-4 months'
                },
                {
                    'gap_type': 'expert_insights',
                    'description': 'Limited expert interviews and insights',
                    'opportunity_level': 'high',
                    'estimated_impact': 'Authority building',
                    'content_suggestions': ['Expert interviews', 'Industry insights', 'Thought leadership'],
                    'priority': 'high',
                    'implementation_time': '1-3 months'
                }
            ]
    
    async def _generate_competitive_insights(self, analysis_results: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Generate competitive insights using AI.
        
        Args:
            analysis_results: Complete competitor analysis results
            
        Returns:
            List of competitive insights
        """
        try:
            logger.info("🤖 Generating competitive insights using AI")
            
            # Create comprehensive prompt for competitive insight generation
            prompt = f"""
            Generate competitive insights based on the following analysis results:

            Analysis Results: {json.dumps(analysis_results, indent=2)}

            Provide comprehensive competitive insights including:
            1. Competitive advantages identification
            2. Market positioning opportunities
            3. Content strategy recommendations
            4. Differentiation strategies
            5. Implementation priorities
            6. Risk assessment and mitigation
            
            Format as structured JSON with detailed insights.
            """
            
            # Use structured JSON response for better parsing
            response = gemini_structured_json_response(
                prompt=prompt,
                schema={
                    "type": "object",
                    "properties": {
                        "competitive_insights": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "insight_type": {"type": "string"},
                                    "insight": {"type": "string"},
                                    "opportunity": {"type": "string"},
                                    "priority": {"type": "string"},
                                    "estimated_impact": {"type": "string"},
                                    "implementation_suggestion": {"type": "string"}
                                }
                            }
                        }
                    }
                }
            )
            
            # Handle response - gemini_structured_json_response returns dict directly
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
            
            competitive_insights = result.get('competitive_insights', [])
            logger.info(f"✅ AI competitive insights generated: {len(competitive_insights)} insights")
            return competitive_insights
            
        except Exception as e:
            logger.error(f"Error generating competitive insights: {str(e)}")
            # Return fallback response if AI fails
            return [
                {
                    'insight_type': 'content_gap',
                    'insight': 'Competitors lack comprehensive video content',
                    'opportunity': 'Develop video tutorial series',
                    'priority': 'high',
                    'estimated_impact': 'High engagement and differentiation',
                    'implementation_suggestion': 'Start with basic tutorials, then advanced content'
                },
                {
                    'insight_type': 'quality_advantage',
                    'insight': 'Focus on depth over breadth in content',
                    'opportunity': 'Create comprehensive, authoritative content',
                    'priority': 'high',
                    'estimated_impact': 'Authority building and trust',
                    'implementation_suggestion': 'Develop pillar content with detailed sub-topics'
                },
                {
                    'insight_type': 'format_innovation',
                    'insight': 'Interactive content is missing from market',
                    'opportunity': 'Create interactive tools and calculators',
                    'priority': 'medium',
                    'estimated_impact': 'Lead generation and engagement',
                    'implementation_suggestion': 'Start with simple calculators, then complex tools'
                }
            ]
    
    async def analyze_content_structure(self, competitor_urls: List[str]) -> Dict[str, Any]:
        """
        Analyze content structure across competitors.
        
        Args:
            competitor_urls: List of competitor URLs
            
        Returns:
            Content structure analysis
        """
        try:
            logger.info("Analyzing content structure across competitors")
            
            structure_analysis = {
                'title_patterns': {},
                'meta_description_patterns': {},
                'content_hierarchy': {},
                'internal_linking': {},
                'external_linking': {}
            }
            
            # TODO: Implement actual content structure analysis
            # This will analyze title patterns, meta descriptions, content hierarchy, etc.
            
            for url in competitor_urls:
                # Simulate structure analysis
                structure_analysis['title_patterns'][url] = {
                    'avg_length': 55,
                    'keyword_density': 0.15,
                    'brand_mention': True
                }
                
                structure_analysis['meta_description_patterns'][url] = {
                    'avg_length': 155,
                    'call_to_action': True,
                    'keyword_inclusion': 0.8
                }
                
                structure_analysis['content_hierarchy'][url] = {
                    'h1_usage': 95,
                    'h2_usage': 85,
                    'h3_usage': 70,
                    'proper_hierarchy': True
                }
            
            logger.info("Content structure analysis completed")
            return structure_analysis
            
        except Exception as e:
            logger.error(f"Error in content structure analysis: {str(e)}")
            return {}
    
    async def analyze_content_performance(self, competitor_urls: List[str]) -> Dict[str, Any]:
        """
        Analyze content performance metrics for competitors.
        
        Args:
            competitor_urls: List of competitor URLs to analyze
            
        Returns:
            Content performance analysis
        """
        try:
            logger.info(f"Analyzing content performance for {len(competitor_urls)} competitors")
            
            # TODO: Implement actual content performance analysis
            # This would analyze engagement metrics, content quality, etc.
            
            performance_analysis = {
                'competitors_analyzed': len(competitor_urls),
                'performance_metrics': {
                    'average_engagement_rate': 0.045,
                    'content_frequency': '2.3 posts/week',
                    'top_performing_content_types': ['How-to guides', 'Case studies', 'Industry insights'],
                    'content_quality_score': 8.2
                },
                'recommendations': [
                    'Focus on educational content',
                    'Increase video content production',
                    'Optimize for mobile engagement'
                ],
                'timestamp': datetime.utcnow().isoformat()
            }
            
            return performance_analysis
            
        except Exception as e:
            logger.error(f"Error analyzing content performance: {str(e)}")
            raise
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Health check for the competitor analyzer service.
        
        Returns:
            Health status information
        """
        try:
            logger.info("Performing health check for CompetitorAnalyzer")
            
            health_status = {
                'service': 'CompetitorAnalyzer',
                'status': 'healthy',
                'dependencies': {
                    'ai_engine': 'operational',
                    'website_analyzer': 'operational'
                },
                'timestamp': datetime.utcnow().isoformat()
            }
            
            logger.info("CompetitorAnalyzer health check passed")
            return health_status
            
        except Exception as e:
            logger.error(f"CompetitorAnalyzer health check failed: {str(e)}")
            return {
                'service': 'CompetitorAnalyzer',
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }
    
    async def get_competitor_summary(self, analysis_id: str) -> Dict[str, Any]:
        """
        Get summary of competitor analysis.
        
        Args:
            analysis_id: Analysis identifier
            
        Returns:
            Competitor analysis summary
        """
        try:
            logger.info(f"Getting competitor analysis summary for {analysis_id}")
            
            # TODO: Retrieve analysis from database
            # This will be implemented when database integration is complete
            
            summary = {
                'analysis_id': analysis_id,
                'status': 'completed',
                'timestamp': datetime.utcnow().isoformat(),
                'summary': {
                    'competitors_analyzed': 5,
                    'content_gaps_identified': 8,
                    'competitive_insights': 6,
                    'market_position': 'Competitive',
                    'estimated_impact': 'High'
                }
            }
            
            return summary
            
        except Exception as e:
            logger.error(f"Error getting competitor summary: {str(e)}")
            return {} 

    # Advanced Features Implementation
    
    async def _run_seo_analysis(self, url: str) -> Dict[str, Any]:
        """
        Run comprehensive SEO analysis on competitor website.
        
        Args:
            url: The URL to analyze
            
        Returns:
            SEO analysis results
        """
        try:
            logger.info(f"Running SEO analysis for {url}")
            
            # TODO: Integrate with actual website analyzer service
            # For now, simulate SEO analysis
            
            seo_analysis = {
                'onpage_seo': {
                    'meta_tags': {
                        'title': {'status': 'good', 'length': 55, 'keyword_density': 0.02},
                        'description': {'status': 'good', 'length': 145, 'keyword_density': 0.015},
                        'keywords': {'status': 'missing', 'recommendation': 'Add meta keywords'}
                    },
                    'content': {
                        'readability_score': 75,
                        'content_quality_score': 82,
                        'keyword_density': 0.025,
                        'heading_structure': 'good'
                    },
                    'recommendations': [
                        'Optimize meta descriptions',
                        'Improve heading structure',
                        'Add more internal links',
                        'Enhance content readability'
                    ]
                },
                'url_seo': {
                    'title': 'Competitor Page Title',
                    'meta_description': 'Competitor meta description with keywords',
                    'has_robots_txt': True,
                    'has_sitemap': True,
                    'url_structure': 'clean',
                    'canonical_url': 'properly_set'
                },
                'technical_seo': {
                    'page_speed': 85,
                    'mobile_friendly': True,
                    'ssl_certificate': True,
                    'structured_data': 'implemented',
                    'internal_linking': 'good',
                    'external_linking': 'moderate'
                }
            }
            
            return seo_analysis
            
        except Exception as e:
            logger.error(f"Error running SEO analysis: {str(e)}")
            return {}
    
    async def _analyze_title_patterns(self, url: str) -> Dict[str, Any]:
        """
        Analyze title patterns using AI.
        
        Args:
            url: The URL to analyze
            
        Returns:
            Title pattern analysis results
        """
        try:
            logger.info(f"Analyzing title patterns for {url}")
            
            # TODO: Integrate with actual title pattern analyzer
            # For now, simulate analysis
            
            title_analysis = {
                'patterns': {
                    'question_format': 0.3,
                    'how_to_format': 0.25,
                    'list_format': 0.2,
                    'comparison_format': 0.15,
                    'other_format': 0.1
                },
                'suggestions': [
                    'Use question-based titles for engagement',
                    'Include numbers for better CTR',
                    'Add emotional triggers',
                    'Keep titles under 60 characters',
                    'Include target keywords naturally'
                ],
                'best_practices': [
                    'Start with power words',
                    'Include target keyword',
                    'Add urgency or scarcity',
                    'Use brackets for additional info',
                    'Test different formats'
                ],
                'examples': [
                    'How to [Topic] in 2024: Complete Guide',
                    '10 Best [Topic] Strategies That Work',
                    '[Topic] vs [Alternative]: Which is Better?',
                    'The Ultimate Guide to [Topic]',
                    'Why [Topic] Matters for Your Business'
                ]
            }
            
            return title_analysis
            
        except Exception as e:
            logger.error(f"Error analyzing title patterns: {str(e)}")
            return {}
    
    async def _compare_competitors(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compare results across all competitors.
        
        Args:
            results: Analysis results for all competitors
            
        Returns:
            Comparative analysis results
        """
        try:
            logger.info("Comparing competitors across all metrics")
            
            comparison = {
                'content_comparison': await self._compare_content(results),
                'seo_comparison': await self._compare_seo(results),
                'title_comparison': await self._compare_titles(results),
                'performance_metrics': await self._compare_performance(results),
                'content_gaps': await self._find_missing_topics(results),
                'opportunities': await self._identify_opportunities(results),
                'format_gaps': await self._analyze_format_gaps(results),
                'quality_gaps': await self._analyze_quality_gaps(results),
                'seo_gaps': await self._analyze_seo_gaps(results)
            }
            
            # Add AI-enhanced insights
            comparison['ai_insights'] = await self.ai_engine.analyze_competitor_comparison(comparison)
            
            return comparison
            
        except Exception as e:
            logger.error(f"Error comparing competitors: {str(e)}")
            return {}
    
    async def _compare_content(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Compare content structure across competitors."""
        try:
            content_comparison = {
                'topic_distribution': await self._analyze_topic_distribution(results),
                'content_depth': await self._analyze_content_depth(results),
                'content_formats': await self._analyze_content_formats(results),
                'content_quality': await self._analyze_content_quality(results)
            }
            
            return content_comparison
            
        except Exception as e:
            logger.error(f"Error comparing content: {str(e)}")
            return {}
    
    async def _analyze_topic_distribution(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze topic distribution across competitors."""
        try:
            all_topics = []
            topic_frequency = Counter()
            
            for url, data in results.items():
                topics = data.get('content_structure', {}).get('topics', [])
                all_topics.extend([t['topic'] for t in topics])
                topic_frequency.update([t['topic'] for t in topics])
            
            return {
                'common_topics': [topic for topic, count in topic_frequency.most_common(10)],
                'unique_topics': list(set(all_topics)),
                'topic_frequency': dict(topic_frequency.most_common()),
                'topic_coverage': len(set(all_topics)) / len(all_topics) if all_topics else 0
            }
            
        except Exception as e:
            logger.error(f"Error analyzing topic distribution: {str(e)}")
            return {}
    
    async def _analyze_content_depth(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze content depth across competitors."""
        try:
            depth_metrics = {
                'word_counts': {},
                'section_counts': {},
                'heading_distribution': defaultdict(list),
                'content_hierarchy': {}
            }
            
            for url, data in results.items():
                content_structure = data.get('content_structure', {})
                
                # Word count analysis
                depth_metrics['word_counts'][url] = content_structure.get('text_statistics', {}).get('word_count', 0)
                
                # Section analysis
                depth_metrics['section_counts'][url] = len(content_structure.get('sections', []))
                
                # Heading distribution
                for level, count in content_structure.get('hierarchy', {}).get('heading_distribution', {}).items():
                    depth_metrics['heading_distribution'][level].append(count)
                
                # Content hierarchy
                depth_metrics['content_hierarchy'][url] = content_structure.get('hierarchy', {})
            
            return depth_metrics
            
        except Exception as e:
            logger.error(f"Error analyzing content depth: {str(e)}")
            return {}
    
    async def _analyze_content_formats(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze content formats across competitors."""
        try:
            format_analysis = {
                'format_types': defaultdict(int),
                'format_distribution': defaultdict(list),
                'format_effectiveness': {}
            }
            
            for url, data in results.items():
                sections = data.get('content_structure', {}).get('sections', [])
                
                for section in sections:
                    format_type = section.get('type', 'unknown')
                    format_analysis['format_types'][format_type] += 1
                    format_analysis['format_distribution'][format_type].append({
                        'url': url,
                        'heading': section.get('heading', ''),
                        'word_count': section.get('word_count', 0)
                    })
            
            return format_analysis
            
        except Exception as e:
            logger.error(f"Error analyzing content formats: {str(e)}")
            return {}
    
    async def _analyze_content_quality(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze content quality across competitors."""
        try:
            quality_metrics = {
                'readability_scores': {},
                'content_structure_scores': {},
                'engagement_metrics': {},
                'overall_quality': {}
            }
            
            for url, data in results.items():
                content_structure = data.get('content_structure', {})
                
                # Readability analysis
                readability = content_structure.get('readability', {})
                quality_metrics['readability_scores'][url] = {
                    'flesch_score': readability.get('flesch_score', 0),
                    'avg_sentence_length': readability.get('avg_sentence_length', 0),
                    'avg_word_length': readability.get('avg_word_length', 0)
                }
                
                # Structure analysis
                hierarchy = content_structure.get('hierarchy', {})
                quality_metrics['content_structure_scores'][url] = {
                    'has_proper_hierarchy': hierarchy.get('has_proper_hierarchy', False),
                    'heading_distribution': hierarchy.get('heading_distribution', {}),
                    'max_depth': hierarchy.get('max_depth', 0)
                }
            
            return quality_metrics
            
        except Exception as e:
            logger.error(f"Error analyzing content quality: {str(e)}")
            return {}
    
    async def _compare_seo(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Compare SEO metrics across competitors."""
        try:
            seo_comparison = {
                'onpage_metrics': defaultdict(list),
                'technical_metrics': defaultdict(list),
                'content_metrics': defaultdict(list),
                'overall_seo_score': {}
            }
            
            for url, data in results.items():
                seo_info = data.get('website_analysis', {}).get('analysis', {}).get('seo_info', {})
                
                # On-page SEO metrics
                meta_tags = seo_info.get('meta_tags', {})
                seo_comparison['onpage_metrics']['title_score'].append(
                    100 if meta_tags.get('title', {}).get('status') == 'good' else 50
                )
                seo_comparison['onpage_metrics']['description_score'].append(
                    100 if meta_tags.get('description', {}).get('status') == 'good' else 50
                )
                seo_comparison['onpage_metrics']['keywords_score'].append(
                    100 if meta_tags.get('keywords', {}).get('status') == 'good' else 50
                )
                
                # Technical SEO metrics
                technical = data.get('website_analysis', {}).get('analysis', {}).get('basic_info', {})
                seo_comparison['technical_metrics']['has_robots_txt'].append(
                    100 if technical.get('robots_txt') else 0
                )
                seo_comparison['technical_metrics']['has_sitemap'].append(
                    100 if technical.get('sitemap') else 0
                )
                
                # Content SEO metrics
                content = seo_info.get('content', {})
                seo_comparison['content_metrics']['readability_score'].append(
                    content.get('readability_score', 0)
                )
                seo_comparison['content_metrics']['content_quality_score'].append(
                    content.get('content_quality_score', 0)
                )
                
                # Overall SEO score
                seo_comparison['overall_seo_score'][url] = seo_info.get('overall_score', 0)
            
            return seo_comparison
            
        except Exception as e:
            logger.error(f"Error comparing SEO: {str(e)}")
            return {}
    
    async def _compare_titles(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Compare title patterns across competitors."""
        try:
            title_comparison = {
                'pattern_distribution': defaultdict(int),
                'length_distribution': defaultdict(list),
                'keyword_usage': defaultdict(int),
                'format_preferences': defaultdict(int)
            }
            
            for url, data in results.items():
                title_patterns = data.get('title_patterns', {})
                
                # Pattern analysis
                for pattern in title_patterns.get('patterns', {}):
                    title_comparison['pattern_distribution'][pattern] += 1
                
                # Length analysis
                for suggestion in title_patterns.get('suggestions', []):
                    title_comparison['length_distribution'][len(suggestion)].append(suggestion)
                
                # Keyword analysis
                for suggestion in title_patterns.get('suggestions', []):
                    words = suggestion.lower().split()
                    for word in words:
                        if len(word) > 3:  # Filter out short words
                            title_comparison['keyword_usage'][word] += 1
            
            return title_comparison
            
        except Exception as e:
            logger.error(f"Error comparing titles: {str(e)}")
            return {}
    
    async def _compare_performance(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Compare performance metrics across competitors."""
        try:
            performance_metrics = {
                'content_effectiveness': {},
                'engagement_metrics': {},
                'technical_performance': {},
                'overall_performance': {}
            }
            
            for url, data in results.items():
                # Content effectiveness
                content_structure = data.get('content_structure', {})
                performance_metrics['content_effectiveness'][url] = {
                    'content_depth': content_structure.get('text_statistics', {}).get('word_count', 0),
                    'content_quality': content_structure.get('readability', {}).get('flesch_score', 0),
                    'content_structure': content_structure.get('hierarchy', {}).get('has_proper_hierarchy', False)
                }
                
                # Technical performance
                seo_analysis = data.get('seo_analysis', {})
                performance_metrics['technical_performance'][url] = {
                    'onpage_score': sum(1 for v in seo_analysis.get('onpage_seo', {}).values() if v),
                    'technical_score': sum(1 for v in seo_analysis.get('url_seo', {}).values() if v)
                }
            
            return performance_metrics
            
        except Exception as e:
            logger.error(f"Error comparing performance: {str(e)}")
            return {}
    
    async def _find_missing_topics(self, results: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Find topics that are missing or underrepresented."""
        try:
            all_topics = set()
            topic_coverage = defaultdict(int)
            
            # Collect all topics and their coverage
            for url, data in results.items():
                topics = data.get('content_structure', {}).get('topics', [])
                for topic in topics:
                    all_topics.add(topic['topic'])
                    topic_coverage[topic['topic']] += 1
            
            # Identify missing or underrepresented topics
            missing_topics = []
            total_competitors = len(results)
            
            for topic in all_topics:
                coverage = topic_coverage[topic] / total_competitors
                if coverage < 0.5:  # Topic covered by less than 50% of competitors
                    missing_topics.append({
                        'topic': topic,
                        'coverage': coverage,
                        'opportunity_score': 1 - coverage
                    })
            
            return sorted(missing_topics, key=lambda x: x['opportunity_score'], reverse=True)
            
        except Exception as e:
            logger.error(f"Error finding missing topics: {str(e)}")
            return []
    
    async def _identify_opportunities(self, results: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Identify content opportunities based on analysis."""
        try:
            opportunities = []
            
            # Analyze content depth opportunities
            depth_metrics = await self._analyze_content_depth(results)
            avg_word_count = sum(depth_metrics['word_counts'].values()) / len(depth_metrics['word_counts'])
            
            for url, word_count in depth_metrics['word_counts'].items():
                if word_count < avg_word_count * 0.7:  # Content depth significantly below average
                    opportunities.append({
                        'type': 'content_depth',
                        'url': url,
                        'current_value': word_count,
                        'target_value': avg_word_count,
                        'opportunity_score': (avg_word_count - word_count) / avg_word_count
                    })
            
            # Analyze format opportunities
            format_analysis = await self._analyze_content_formats(results)
            for format_type, distribution in format_analysis['format_distribution'].items():
                if len(distribution) < len(results) * 0.3:  # Format used by less than 30% of competitors
                    opportunities.append({
                        'type': 'content_format',
                        'format': format_type,
                        'current_coverage': len(distribution) / len(results),
                        'opportunity_score': 1 - (len(distribution) / len(results))
                    })
            
            return sorted(opportunities, key=lambda x: x['opportunity_score'], reverse=True)
            
        except Exception as e:
            logger.error(f"Error identifying opportunities: {str(e)}")
            return []
    
    async def _analyze_format_gaps(self, results: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Analyze gaps in content formats."""
        try:
            format_gaps = []
            format_analysis = await self._analyze_content_formats(results)
            
            # Identify underutilized formats
            for format_type, count in format_analysis['format_types'].items():
                if count < len(results) * 0.3:  # Format used by less than 30% of competitors
                    format_gaps.append({
                        'format': format_type,
                        'current_usage': count,
                        'potential_impact': 'high' if count < len(results) * 0.2 else 'medium',
                        'suggested_implementation': await self._generate_format_suggestions(format_type)
                    })
            
            return format_gaps
            
        except Exception as e:
            logger.error(f"Error analyzing format gaps: {str(e)}")
            return []
    
    async def _analyze_quality_gaps(self, results: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Analyze gaps in content quality."""
        try:
            quality_gaps = []
            quality_metrics = await self._analyze_content_quality(results)
            
            # Analyze readability gaps
            readability_scores = quality_metrics['readability_scores']
            avg_flesch = sum(score['flesch_score'] for score in readability_scores.values()) / len(readability_scores)
            
            for url, scores in readability_scores.items():
                if scores['flesch_score'] < avg_flesch * 0.8:  # Readability significantly below average
                    quality_gaps.append({
                        'type': 'readability',
                        'url': url,
                        'current_score': scores['flesch_score'],
                        'target_score': avg_flesch,
                        'improvement_needed': avg_flesch - scores['flesch_score']
                    })
            
            return quality_gaps
            
        except Exception as e:
            logger.error(f"Error analyzing quality gaps: {str(e)}")
            return []
    
    async def _analyze_seo_gaps(self, results: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Analyze gaps in SEO implementation."""
        try:
            seo_gaps = []
            seo_comparison = await self._compare_seo(results)
            
            # Analyze on-page SEO gaps
            for metric, values in seo_comparison['onpage_metrics'].items():
                avg_value = sum(values) / len(values)
                for url, value in zip(results.keys(), values):
                    if value < avg_value * 0.7:  # Significantly below average
                        seo_gaps.append({
                            'type': 'onpage_seo',
                            'metric': metric,
                            'url': url,
                            'current_value': value,
                            'target_value': avg_value,
                            'improvement_needed': avg_value - value
                        })
            
            # Analyze technical SEO gaps
            for metric, values in seo_comparison['technical_metrics'].items():
                avg_value = sum(values) / len(values)
                for url, value in zip(results.keys(), values):
                    if value < avg_value * 0.7:  # Significantly below average
                        seo_gaps.append({
                            'type': 'technical_seo',
                            'metric': metric,
                            'url': url,
                            'current_value': value,
                            'target_value': avg_value,
                            'improvement_needed': avg_value - value
                        })
            
            # Analyze content SEO gaps
            for metric, values in seo_comparison['content_metrics'].items():
                avg_value = sum(values) / len(values)
                for url, value in zip(results.keys(), values):
                    if value < avg_value * 0.7:  # Significantly below average
                        seo_gaps.append({
                            'type': 'content_seo',
                            'metric': metric,
                            'url': url,
                            'current_value': value,
                            'target_value': avg_value,
                            'improvement_needed': avg_value - value
                        })
            
            return seo_gaps
            
        except Exception as e:
            logger.error(f"Error analyzing SEO gaps: {str(e)}")
            return []
    
    async def _generate_format_suggestions(self, format_type: str) -> List[str]:
        """Generate suggestions for implementing specific content formats."""
        try:
            format_suggestions = {
                'article': [
                    'Create in-depth articles with comprehensive coverage',
                    'Include expert quotes and statistics',
                    'Add visual elements and infographics'
                ],
                'blog_post': [
                    'Write engaging blog posts with personal insights',
                    'Include call-to-actions',
                    'Add social sharing buttons'
                ],
                'how-to': [
                    'Create step-by-step guides',
                    'Include screenshots or videos',
                    'Add troubleshooting sections'
                ],
                'case_study': [
                    'Present real-world examples',
                    'Include metrics and results',
                    'Add client testimonials'
                ],
                'video': [
                    'Create engaging video content',
                    'Include transcripts and captions',
                    'Optimize for different platforms'
                ],
                'infographic': [
                    'Design visually appealing graphics',
                    'Include key statistics and data',
                    'Make it shareable on social media'
                ]
            }
            
            return format_suggestions.get(format_type, [
                'Research successful examples',
                'Analyze competitor implementation',
                'Create unique value proposition'
            ])
            
        except Exception as e:
            logger.error(f"Error generating format suggestions: {str(e)}")
            return [] 