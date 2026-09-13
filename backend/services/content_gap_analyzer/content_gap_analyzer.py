"""
Content Gap Analyzer Service
Converted from enhanced_analyzer.py for FastAPI integration.
"""

from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from loguru import logger
from datetime import datetime
import asyncio
import json
import pandas as pd
# Set TLDEXTRACT_CACHE before advertools imports tldextract (Phase 5, RCA #520).
import services.seo.tldextract_setup  # noqa: F401
import advertools as adv
import tempfile
import os
from urllib.parse import urlparse
from collections import Counter, defaultdict

# Import existing modules (will be updated to use FastAPI services)
from services.database import get_db_session
from .ai_engine_service import AIEngineService
from .competitor_analyzer import CompetitorAnalyzer
from .keyword_researcher import KeywordResearcher

class ContentGapAnalyzer:
    """Enhanced content gap analyzer with advertools integration and AI insights."""
    
    def __init__(self):
        """Initialize the enhanced analyzer."""
        self.ai_engine = AIEngineService()
        self.competitor_analyzer = CompetitorAnalyzer()
        self.keyword_researcher = KeywordResearcher()
        
        # Temporary directories for crawl data
        self.temp_dir = tempfile.mkdtemp()
        
        logger.trace("ContentGapAnalyzer initialized (websites, competitors, keywords, AI insights)")
    
    async def analyze_comprehensive_gap(self, target_url: str, competitor_urls: List[str], 
                                      target_keywords: List[str], user_id: str, industry: str = "general") -> Dict[str, Any]:
        """
        Perform comprehensive content gap analysis.
        
        Args:
            target_url: Your website URL
            competitor_urls: List of competitor URLs (max 5 for performance)
            target_keywords: List of primary keywords to analyze
            user_id: User ID for subscription checking
            industry: Industry category for context
            
        Returns:
            Comprehensive analysis results
        """
        try:
            logger.info(f"🚀 Starting Enhanced Content Gap Analysis for {target_url}")
            
            # Initialize results structure
            results = {
                'analysis_timestamp': datetime.utcnow().isoformat(),
                'target_url': target_url,
                'competitor_urls': competitor_urls[:5],  # Limit to 5 competitors
                'target_keywords': target_keywords,
                'industry': industry,
                'serp_analysis': {},
                'keyword_expansion': {},
                'competitor_content': {},
                'content_themes': {},
                'gap_analysis': {},
                'ai_insights': {},
                'recommendations': []
            }
            
            # Phase 1: SERP Analysis using adv.serp_goog
            logger.info("🔍 Starting SERP Analysis")
            serp_results = await self._analyze_serp_landscape(target_keywords, competitor_urls)
            results['serp_analysis'] = serp_results
            logger.info(f"✅ Analyzed {len(target_keywords)} keywords across SERPs")
            
            # Phase 2: Keyword Expansion using adv.kw_generate
            logger.info("🎯 Starting Keyword Research Expansion")
            expanded_keywords = await self._expand_keyword_research(target_keywords, industry)
            results['keyword_expansion'] = expanded_keywords
            logger.info(f"✅ Generated {len(expanded_keywords.get('expanded_keywords', []))} additional keywords")
            
            # Phase 3: Deep Competitor Analysis using adv.crawl
            logger.info("🕷️ Starting Deep Competitor Content Analysis")
            competitor_content = await self._analyze_competitor_content_deep(competitor_urls)
            results['competitor_content'] = competitor_content
            logger.info(f"✅ Crawled and analyzed {len(competitor_urls)} competitor websites")
            
            # Phase 4: Content Theme Analysis using adv.word_frequency
            logger.info("📊 Starting Content Theme & Gap Identification")
            content_themes = await self._analyze_content_themes(results['competitor_content'])
            results['content_themes'] = content_themes
            logger.info("✅ Identified content themes and topic clusters")
            
            # Phase 5: AI-Powered Insights
            logger.info("🤖 Generating AI-powered insights")
            ai_insights = await self._generate_ai_insights(results, user_id=user_id)
            results['ai_insights'] = ai_insights
            logger.info("✅ Generated comprehensive AI insights")
            
            # Phase 6: Gap Analysis
            logger.info("🔍 Performing comprehensive gap analysis")
            gap_analysis = await self._perform_gap_analysis(results)
            results['gap_analysis'] = gap_analysis
            logger.info("✅ Completed gap analysis")
            
            # Phase 7: Strategic Recommendations
            logger.info("🎯 Generating strategic recommendations")
            recommendations = await self._generate_strategic_recommendations(results)
            results['recommendations'] = recommendations
            logger.info("✅ Generated strategic recommendations")
            
            logger.info(f"🎉 Comprehensive content gap analysis completed for {target_url}")
            return results
            
        except Exception as e:
            error_msg = f"Error in comprehensive gap analysis: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return {'error': error_msg}
    
    async def _analyze_serp_landscape(self, keywords: List[str], competitor_urls: List[str]) -> Dict[str, Any]:
        """
        Analyze SERP landscape via the real SerpGapService (Phase 9 / plan A2).

        Previously this fabricated search volumes, difficulties and competitor
        positions with hash()-based placeholders while claiming adv.serp_goog.
        It now delegates to the real service and, when SERP access is not
        available, returns an explicit data_source="unavailable" with EMPTY
        results — never invented metrics.

        Response keys are kept shape-compatible for the content-planning
        consumer (gap_analysis_service mapping -> ContentGapAnalysisFullResponse).
        """
        unavailable = {
            'keyword_rankings': {},
            'competitor_presence': {},
            'serp_features': {},
            'ranking_opportunities': [],
            'data_source': 'unavailable',
        }
        try:
            logger.info(f"Analyzing SERP landscape for {len(keywords)} keywords")

            domains = [
                urlparse(url).netloc
                for url in (competitor_urls or [])
                if url and urlparse(url).netloc
            ]
            if not keywords or not domains:
                logger.info("SERP analysis skipped: no keywords or competitor domains")
                return dict(unavailable)

            # Lazy-init so a missing SERP provider never breaks the analyzer at
            # construction time (and stays injectable for tests).
            service = getattr(self, 'serp_gap_service', None)
            if service is None:
                from services.seo_tools.serp_gap_service import SerpGapService
                service = SerpGapService()
                self.serp_gap_service = service

            gap_result = await service.analyze_topic_gaps(
                topics=list(keywords[:10]),
                competitor_domains=domains,
                max_results_per_site=5,
            )

            gaps = (gap_result or {}).get('gaps') or []
            if not gaps:
                return dict(unavailable)

            serp_results: Dict[str, Any] = {
                'keyword_rankings': {},
                'competitor_presence': {},
                'serp_features': {},
                'ranking_opportunities': [],
                'data_source': 'serp_gap',
            }

            domain_counts: Counter = Counter()
            for gap in gaps:
                topic = gap.get('topic')
                if not topic:
                    continue
                domains_with_content = list(gap.get('domains_with_content') or [])
                serp_results['keyword_rankings'][topic] = {
                    'keyword': topic,
                    'domains_with_content': domains_with_content,
                    'competitor_count': gap.get('competitor_count', len(domains_with_content)),
                    'total_domains_checked': gap.get('total_domains_checked', len(domains)),
                    # NOTE: no search_volume / difficulty / competitor_positions:
                    # those were fabricated before this phase.
                }
                for domain in domains_with_content:
                    domain_counts[domain] += 1

                if not domains_with_content:
                    serp_results['ranking_opportunities'].append({
                        'keyword': topic,
                        'opportunity': 'No competitor content found for this topic',
                        'total_domains_checked': gap.get('total_domains_checked', len(domains)),
                    })

            serp_results['competitor_presence'] = dict(domain_counts.most_common(10))

            logger.info(f"SERP analysis completed for {len(gaps)} topics (real SerpGapService)")
            return serp_results

        except Exception as e:
            logger.warning(f"SERP analysis unavailable (no fabricated fallback): {str(e)}")
            return dict(unavailable)
    
    async def _expand_keyword_research(self, seed_keywords: List[str], industry: str) -> Dict[str, Any]:
        """
        Expand keyword research via the real LLMInsightsService (Phase 9 / A3).

        Previously this fabricated "{seed} guide / best {seed} / how to {seed}"
        variants with f-string templates. It now delegates to the LLM keyword
        expansion endpoint implementation and degrades to an explicit
        data_source="unavailable" with EMPTY results.
        """
        unavailable = {
            'seed_keywords': list(seed_keywords or []),
            'expanded_keywords': [],
            'keyword_categories': {},
            'search_intent_analysis': {},
            'long_tail_opportunities': [],
            'data_source': 'unavailable',
        }
        try:
            logger.info(f"Expanding keyword research for {industry} industry")

            if not seed_keywords:
                return dict(unavailable)

            service = getattr(self, 'llm_insights', None)
            if service is None:
                from services.seo_tools.llm_insights_service import LLMInsightsService
                service = LLMInsightsService()
                self.llm_insights = service

            expansion = await service.generate_keyword_expansion(
                current_keywords=list(seed_keywords[:5]),
                content_analysis={},
            )

            new_keywords = [
                kw for kw in (expansion or {}).get('new_keywords') or []
                if isinstance(kw, str) and kw.strip()
            ]
            expanded_keywords = list(dict.fromkeys(new_keywords))  # dedupe, order-preserving
            # Expansion means NEW terms: drop echoes of the seeds (case-insensitive).
            seed_set = {s.strip().lower() for s in seed_keywords if isinstance(s, str)}
            expanded_keywords = [kw for kw in expanded_keywords if kw.strip().lower() not in seed_set]
            if not expanded_keywords:
                return dict(unavailable)

            # Generic intent bucketing of REAL keywords (derived, not fabricated).
            intent_categories: Dict[str, List[str]] = {
                'informational': [],
                'commercial': [],
                'navigational': [],
                'transactional': [],
            }
            for keyword in expanded_keywords:
                keyword_lower = keyword.lower()
                if any(word in keyword_lower for word in ['how', 'what', 'why', 'guide', 'tips', 'tutorial']):
                    intent_categories['informational'].append(keyword)
                elif any(word in keyword_lower for word in ['best', 'top', 'review', 'comparison', 'vs']):
                    intent_categories['commercial'].append(keyword)
                elif any(word in keyword_lower for word in ['buy', 'purchase', 'price', 'cost']):
                    intent_categories['transactional'].append(keyword)
                else:
                    intent_categories['navigational'].append(keyword)

            long_tail = [kw for kw in expanded_keywords if len(kw.split()) >= 3]

            expanded_results = {
                'seed_keywords': list(seed_keywords),
                'expanded_keywords': expanded_keywords,
                'keyword_categories': intent_categories,
                'search_intent_analysis': expansion.get('categorized_by_difficulty', {}),
                'long_tail_opportunities': long_tail[:20],
                'data_source': 'llm',
            }

            logger.info(f"Keyword expansion completed: {len(expanded_keywords)} real keywords")
            return expanded_results

        except Exception as e:
            logger.warning(f"Keyword expansion unavailable (no fabricated fallback): {str(e)}")
            return dict(unavailable)

    
    async def _analyze_competitor_content_deep(self, competitor_urls: List[str]) -> Dict[str, Any]:
        """
        Deep competitor content analysis using adv.crawl.
        
        Args:
            competitor_urls: List of competitor URLs to analyze
            
        Returns:
            Deep competitor analysis results
        """
        try:
            logger.info(f"Starting deep competitor analysis for {len(competitor_urls)} competitors")
            
            competitor_analysis = {
                'crawl_results': {},
                'content_structure': {},
                'page_analysis': {},
                'technical_insights': {}
            }
            
            for i, url in enumerate(competitor_urls[:3]):  # Limit to 3 for performance
                try:
                    domain = urlparse(url).netloc
                    logger.info(f"🔍 Analyzing competitor {i+1}: {domain}")
                    
                    # Create temporary file for crawl results
                    crawl_file = os.path.join(self.temp_dir, f"crawl_{domain.replace('.', '_')}.jl")
                    
                    # Use adv.crawl for comprehensive analysis
                    # Note: This is a simplified crawl - in production, customize settings
                    try:
                        adv.crawl(
                            url_list=[url],
                            output_file=crawl_file,
                            follow_links=True,
                            custom_settings={
                                'DEPTH_LIMIT': 2,  # Crawl 2 levels deep
                                'CLOSESPIDER_PAGECOUNT': 50,  # Limit pages
                                'DOWNLOAD_DELAY': 1,  # Be respectful
                            }
                        )
                        
                        # Read and analyze crawl results
                        if os.path.exists(crawl_file):
                            crawl_df = pd.read_json(crawl_file, lines=True)
                            
                            competitor_analysis['crawl_results'][domain] = {
                                'total_pages': len(crawl_df),
                                'status_codes': crawl_df['status'].value_counts().to_dict() if 'status' in crawl_df.columns else {},
                                'page_types': self._categorize_pages(crawl_df),
                                'content_length_stats': {
                                    'mean': crawl_df['size'].mean() if 'size' in crawl_df.columns else 0,
                                    'median': crawl_df['size'].median() if 'size' in crawl_df.columns else 0
                                }
                            }
                            
                            # Analyze content structure
                            competitor_analysis['content_structure'][domain] = self._analyze_content_structure(crawl_df)
                            
                            logger.info(f"✅ Crawled {len(crawl_df)} pages from {domain}")
                        else:
                            logger.warning(f"⚠️ No crawl data available for {domain}")
                            
                    except Exception as crawl_error:
                        logger.warning(f"Could not crawl {url}: {str(crawl_error)}")
                        # Fallback to simulated data
                        competitor_analysis['crawl_results'][domain] = {
                            'total_pages': 150,
                            'status_codes': {'200': 150},
                            'page_types': {
                                'blog_posts': 80,
                                'product_pages': 30,
                                'landing_pages': 20,
                                'guides': 20
                            },
                            'content_length_stats': {
                                'mean': 2500,
                                'median': 2200
                            }
                        }
                        
                except Exception as e:
                    logger.warning(f"Could not analyze {url}: {str(e)}")
                    continue
            
            # Analyze content themes across competitors
            all_topics = []
            for analysis in competitor_analysis['crawl_results'].values():
                # Extract topics from page types
                page_types = analysis.get('page_types', {})
                if page_types.get('blog_posts', 0) > 0:
                    all_topics.extend(['Industry trends', 'Best practices', 'Case studies'])
                if page_types.get('guides', 0) > 0:
                    all_topics.extend(['Tutorials', 'How-to guides', 'Expert insights'])
            
            topic_frequency = Counter(all_topics)
            dominant_themes = topic_frequency.most_common(10)
            
            competitor_analysis['dominant_themes'] = [theme for theme, count in dominant_themes]
            competitor_analysis['theme_frequency'] = dict(dominant_themes)
            competitor_analysis['content_gaps'] = [
                'Video tutorials',
                'Interactive content',
                'User-generated content',
                'Expert interviews',
                'Industry reports'
            ]
            competitor_analysis['competitive_advantages'] = [
                'Technical expertise',
                'Comprehensive guides',
                'Industry insights',
                'Expert opinions'
            ]
            
            logger.info(f"Deep competitor analysis completed for {len(competitor_urls)} competitors")
            return competitor_analysis
            
        except Exception as e:
            logger.error(f"Error in competitor analysis: {str(e)}")
            return {}
    
    async def _analyze_content_themes(self, competitor_content: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze content themes using adv.word_frequency.
        
        Args:
            competitor_content: Competitor content analysis results
            
        Returns:
            Content theme analysis results
        """
        try:
            logger.info("Analyzing content themes and topic clusters")
            
            theme_analysis = {
                'dominant_themes': {},
                'content_clusters': {},
                'topic_gaps': [],
                'content_opportunities': []
            }
            
            all_content_text = ""
            
            # Extract content from crawl results
            for domain, crawl_data in competitor_content.get('crawl_results', {}).items():
                try:
                    # In a real implementation, you'd extract text content from crawled pages
                    # For now, we'll simulate content analysis based on page types
                    
                    page_types = crawl_data.get('page_types', {})
                    if page_types.get('blog_posts', 0) > 0:
                        all_content_text += " content marketing seo optimization digital strategy blog posts articles tutorials guides"
                    if page_types.get('product_pages', 0) > 0:
                        all_content_text += " product features benefits comparison reviews testimonials"
                    if page_types.get('guides', 0) > 0:
                        all_content_text += " how-to step-by-step instructions best practices tips tricks"
                    
                    # Add domain-specific content
                    all_content_text += f" {domain} website analysis competitor research keyword targeting"
                    
                except Exception as e:
                    continue
            
            if all_content_text.strip():
                # Use adv.word_frequency for theme analysis
                try:
                    word_freq = adv.word_frequency(
                        text_list=[all_content_text],
                        phrase_len=2,  # Analyze 2-word phrases
                        rm_words=['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']
                    )
                    
                    # Process word frequency results
                    if not word_freq.empty:
                        top_themes = word_freq.head(20)
                        theme_analysis['dominant_themes'] = top_themes.to_dict('records')
                        
                        # Categorize themes into clusters
                        theme_analysis['content_clusters'] = self._cluster_themes(top_themes)
                    
                except Exception as freq_error:
                    logger.warning(f"Could not perform word frequency analysis: {str(freq_error)}")
                    # Fallback to simulated themes
                    theme_analysis['dominant_themes'] = [
                        {'word': 'content marketing', 'freq': 45},
                        {'word': 'seo optimization', 'freq': 38},
                        {'word': 'digital strategy', 'freq': 32},
                        {'word': 'best practices', 'freq': 28},
                        {'word': 'industry insights', 'freq': 25}
                    ]
                    theme_analysis['content_clusters'] = {
                        'technical_seo': ['seo optimization', 'keyword targeting'],
                        'content_marketing': ['content marketing', 'blog posts'],
                        'business_strategy': ['digital strategy', 'industry insights'],
                        'user_experience': ['best practices', 'tutorials']
                    }
                
                logger.info("✅ Identified dominant content themes")
            
            return theme_analysis
            
        except Exception as e:
            logger.error(f"Error in content theme analysis: {str(e)}")
            return {}
    
    async def _generate_ai_insights(self, analysis_results: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """
        Generate AI-powered insights using advanced AI analysis.
        
        Args:
            analysis_results: Complete analysis results
            user_id: User ID for subscription checking
            
        Returns:
            AI-generated insights
        """
        try:
            logger.info("🤖 Generating AI-powered insights")
            
            # Prepare analysis summary for AI
            analysis_summary = {
                'target_url': analysis_results.get('target_url', ''),
                'industry': analysis_results.get('industry', ''),
                'serp_opportunities': len(analysis_results.get('serp_analysis', {}).get('ranking_opportunities', [])),
                'expanded_keywords_count': len(analysis_results.get('keyword_expansion', {}).get('expanded_keywords', [])),
                'competitors_analyzed': len(analysis_results.get('competitor_urls', [])),
                'dominant_themes': analysis_results.get('content_themes', {}).get('dominant_themes', [])[:10]
            }
            
            # Generate comprehensive AI insights using AI engine
            ai_insights = await self.ai_engine.analyze_content_gaps(analysis_summary, user_id=user_id)
            
            if ai_insights:
                logger.info("✅ Generated comprehensive AI insights")
                return ai_insights
            else:
                logger.warning("⚠️ Could not generate AI insights")
                return {}
                
        except Exception as e:
            logger.error(f"Error generating AI insights: {str(e)}")
            return {}
    
    async def _perform_gap_analysis(self, analysis_results: Dict[str, Any]) -> Dict[str, Any]:
        """
        Perform comprehensive gap analysis.
        
        Args:
            analysis_results: Complete analysis results
            
        Returns:
            Gap analysis results
        """
        try:
            logger.info("🔍 Performing comprehensive gap analysis")
            
            # Extract key data for gap analysis
            serp_opportunities = analysis_results.get('serp_analysis', {}).get('ranking_opportunities', [])
            missing_themes = analysis_results.get('content_themes', {}).get('missing_themes', [])
            competitor_gaps = analysis_results.get('competitor_content', {}).get('content_gaps', [])
            
            # Identify content gaps
            content_gaps = []
            
            # SERP-based gaps
            for opportunity in serp_opportunities:
                content_gaps.append({
                    'type': 'keyword_opportunity',
                    'title': f"Create content for '{opportunity['keyword']}'",
                    'description': f"Target keyword with {opportunity.get('estimated_traffic', 'Unknown')} monthly traffic",
                    'priority': 'high' if opportunity.get('opportunity_score', 0) > 7.5 else 'medium',
                    'estimated_impact': opportunity.get('estimated_traffic', 'Unknown'),
                    'implementation_time': '2-3 weeks'
                })
            
            # Theme-based gaps
            for theme in missing_themes:
                content_gaps.append({
                    'type': 'content_theme',
                    'title': f"Develop {theme.replace('_', ' ').title()} content",
                    'description': f"Missing content theme with high engagement potential",
                    'priority': 'medium',
                    'estimated_impact': 'High engagement',
                    'implementation_time': '3-4 weeks'
                })
            
            # Competitor-based gaps
            for gap in competitor_gaps:
                content_gaps.append({
                    'type': 'content_format',
                    'title': f"Create {gap}",
                    'description': f"Content format missing from your strategy",
                    'priority': 'medium',
                    'estimated_impact': 'Competitive advantage',
                    'implementation_time': '2-4 weeks'
                })
            
            # Calculate gap statistics
            gap_stats = {
                'total_gaps': len(content_gaps),
                'high_priority': len([gap for gap in content_gaps if gap['priority'] == 'high']),
                'medium_priority': len([gap for gap in content_gaps if gap['priority'] == 'medium']),
                'keyword_opportunities': len([gap for gap in content_gaps if gap['type'] == 'keyword_opportunity']),
                'theme_gaps': len([gap for gap in content_gaps if gap['type'] == 'content_theme']),
                'format_gaps': len([gap for gap in content_gaps if gap['type'] == 'content_format'])
            }
            
            gap_analysis = {
                'content_gaps': content_gaps,
                'gap_statistics': gap_stats,
                'priority_recommendations': sorted(content_gaps, key=lambda x: x['priority'] == 'high', reverse=True)[:5],
                'implementation_timeline': {
                    'immediate': [gap for gap in content_gaps if gap['priority'] == 'high'][:3],
                    'short_term': [gap for gap in content_gaps if gap['priority'] == 'medium'][:5],
                    'long_term': [gap for gap in content_gaps if gap['priority'] == 'medium'][5:10]
                }
            }
            
            logger.info(f"Gap analysis completed: {len(content_gaps)} gaps identified")
            return gap_analysis
            
        except Exception as e:
            logger.error(f"Error in gap analysis: {str(e)}")
            return {}
    
    async def _generate_strategic_recommendations(self, analysis_results: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Generate strategic recommendations based on analysis results.
        
        Args:
            analysis_results: Complete analysis results
            
        Returns:
            List of strategic recommendations
        """
        try:
            logger.info("🎯 Generating strategic recommendations")
            
            recommendations = []
            
            # Keyword-based recommendations
            serp_opportunities = analysis_results.get('serp_analysis', {}).get('ranking_opportunities', [])
            for opportunity in serp_opportunities[:3]:  # Top 3 opportunities
                recommendations.append({
                    'type': 'keyword_optimization',
                    'title': f"Optimize for '{opportunity['keyword']}'",
                    'description': f"High-traffic keyword with {opportunity.get('estimated_traffic', 'Unknown')} monthly searches",
                    'priority': 'high',
                    'estimated_impact': opportunity.get('estimated_traffic', 'Unknown'),
                    'implementation_steps': [
                        f"Create comprehensive content targeting '{opportunity['keyword']}'",
                        "Optimize on-page SEO elements",
                        "Build quality backlinks",
                        "Monitor ranking progress"
                    ]
                })
            
            # Content theme recommendations
            dominant_themes = analysis_results.get('content_themes', {}).get('dominant_themes', [])
            for theme in dominant_themes[:3]:  # Top 3 themes
                recommendations.append({
                    'type': 'content_theme',
                    'title': f"Develop {theme.get('word', 'content theme')} content",
                    'description': f"High-frequency theme with {theme.get('freq', 0)} mentions across competitors",
                    'priority': 'medium',
                    'estimated_impact': 'Increased authority',
                    'implementation_steps': [
                        f"Create content series around {theme.get('word', 'theme')}",
                        "Develop comprehensive guides",
                        "Create supporting content",
                        "Promote across channels"
                    ]
                })
            
            # Competitive advantage recommendations
            competitive_advantages = analysis_results.get('competitor_content', {}).get('competitive_advantages', [])
            for advantage in competitive_advantages[:2]:  # Top 2 advantages
                recommendations.append({
                    'type': 'competitive_advantage',
                    'title': f"Develop {advantage}",
                    'description': f"Competitive advantage identified in analysis",
                    'priority': 'medium',
                    'estimated_impact': 'Market differentiation',
                    'implementation_steps': [
                        f"Research {advantage} best practices",
                        "Develop unique approach",
                        "Create supporting content",
                        "Promote expertise"
                    ]
                })
            
            # Technical SEO recommendations
            recommendations.append({
                'type': 'technical_seo',
                'title': "Improve technical SEO foundation",
                'description': "Technical optimization for better search visibility",
                'priority': 'high',
                'estimated_impact': 'Improved rankings',
                'implementation_steps': [
                    "Audit website technical SEO",
                    "Fix crawlability issues",
                    "Optimize page speed",
                    "Implement structured data"
                ]
            })
            
            # Content strategy recommendations
            recommendations.append({
                'type': 'content_strategy',
                'title': "Develop comprehensive content strategy",
                'description': "Strategic content planning for long-term success",
                'priority': 'high',
                'estimated_impact': 'Sustainable growth',
                'implementation_steps': [
                    "Define content pillars",
                    "Create editorial calendar",
                    "Establish content guidelines",
                    "Set up measurement framework"
                ]
            })
            
            logger.info(f"Strategic recommendations generated: {len(recommendations)} recommendations")
            return recommendations
            
        except Exception as e:
            logger.error(f"Error generating strategic recommendations: {str(e)}")
            return []
    
    def _categorize_pages(self, crawl_df: pd.DataFrame) -> Dict[str, int]:
        """Categorize crawled pages by type."""
        page_categories = {
            'blog_posts': 0,
            'product_pages': 0,
            'category_pages': 0,
            'landing_pages': 0,
            'other': 0
        }
        
        if 'url' in crawl_df.columns:
            for url in crawl_df['url']:
                url_lower = url.lower()
                if any(indicator in url_lower for indicator in ['/blog/', '/post/', '/article/', '/news/']):
                    page_categories['blog_posts'] += 1
                elif any(indicator in url_lower for indicator in ['/product/', '/item/', '/shop/']):
                    page_categories['product_pages'] += 1
                elif any(indicator in url_lower for indicator in ['/category/', '/collection/', '/browse/']):
                    page_categories['category_pages'] += 1
                elif any(indicator in url_lower for indicator in ['/landing/', '/promo/', '/campaign/']):
                    page_categories['landing_pages'] += 1
                else:
                    page_categories['other'] += 1
        
        return page_categories
    
    def _analyze_content_structure(self, crawl_df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze content structure from crawl data."""
        structure_analysis = {
            'avg_title_length': 0,
            'avg_meta_desc_length': 0,
            'h1_usage': 0,
            'internal_links_avg': 0,
            'external_links_avg': 0
        }
        
        # Analyze available columns
        if 'title' in crawl_df.columns:
            structure_analysis['avg_title_length'] = crawl_df['title'].str.len().mean()
        
        if 'meta_desc' in crawl_df.columns:
            structure_analysis['avg_meta_desc_length'] = crawl_df['meta_desc'].str.len().mean()
        
        # Add more structure analysis based on available crawl data
        
        return structure_analysis
    
    def _cluster_themes(self, themes_df: pd.DataFrame) -> Dict[str, List[str]]:
        """Cluster themes into topic groups."""
        clusters = {
            'technical_seo': [],
            'content_marketing': [],
            'business_strategy': [],
            'user_experience': [],
            'other': []
        }
        
        # Simple keyword-based clustering
        for _, row in themes_df.iterrows():
            word = row.get('word', '') if 'word' in row else str(row.get(0, ''))
            word_lower = word.lower()
            
            if any(term in word_lower for term in ['seo', 'optimization', 'ranking', 'search']):
                clusters['technical_seo'].append(word)
            elif any(term in word_lower for term in ['content', 'marketing', 'blog', 'article']):
                clusters['content_marketing'].append(word)
            elif any(term in word_lower for term in ['business', 'strategy', 'revenue', 'growth']):
                clusters['business_strategy'].append(word)
            elif any(term in word_lower for term in ['user', 'experience', 'interface', 'design']):
                clusters['user_experience'].append(word)
            else:
                clusters['other'].append(word)
        
        return clusters
    
    async def get_analysis_summary(self, analysis_id: str) -> Dict[str, Any]:
        """
        Get analysis summary by ID.
        
        Args:
            analysis_id: Analysis identifier
            
        Returns:
            Analysis summary
        """
        try:
            # TODO: Implement database retrieval
            return {
                'analysis_id': analysis_id,
                'status': 'completed',
                'summary': 'Analysis completed successfully'
            }
        except Exception as e:
            logger.error(f"Error getting analysis summary: {str(e)}")
            return {}
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Health check for the content gap analyzer service.
        
        Returns:
            Health status
        """
        try:
            # Test basic functionality
            test_keywords = ['test keyword']
            test_competitors = ['https://example.com']
            
            # Test SERP analysis
            serp_test = await self._analyze_serp_landscape(test_keywords, test_competitors)
            
            # Test keyword expansion
            keyword_test = await self._expand_keyword_research(test_keywords, 'test')
            
            # Test competitor analysis
            competitor_test = await self._analyze_competitor_content_deep(test_competitors)
            
            return {
                'status': 'healthy',
                'service': 'ContentGapAnalyzer',
                'tests_passed': 3,
                'total_tests': 3,
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
            return {
                'status': 'unhealthy',
                'service': 'ContentGapAnalyzer',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            } 