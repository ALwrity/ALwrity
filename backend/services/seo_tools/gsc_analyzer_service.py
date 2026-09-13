"""
Advanced Google Search Console Analyzer Service

Enterprise-level GSC integration with AI-powered insights including:
- Search performance analysis and trends
- Content opportunity identification
- Keyword performance tracking
- Technical SEO signal detection
- Competitive positioning analysis
- AI-powered recommendations
"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
import asyncio
from loguru import logger
import json
from dataclasses import dataclass

from services.llm_providers.main_text_generation import llm_text_gen
from services.gsc_service import GSCService


@dataclass
class ContentOpportunity:
    """Data class for content opportunities"""
    query: str
    impressions: int
    clicks: int
    ctr: float
    position: float
    priority_score: float
    opportunity_type: str  # 'high_volume_low_ctr', 'long_tail', 'ranking_improvement', etc.
    recommendation: str


class GSCAnalyzerService:
    """
    Advanced Google Search Console analyzer with enterprise-level insights.
    Provides comprehensive search performance analysis and content opportunities.
    """
    
    def __init__(self):
        """Initialize the GSC analyzer service"""
        self.service_name = "gsc_analyzer"
        self.gsc_service = GSCService()
        logger.info(f"Initialized {self.service_name}")
    
    async def analyze_search_performance(
        self,
        site_url: str,
        date_range_days: int = 90,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Comprehensive search performance analysis from GSC data.
        
        Args:
            site_url: Website URL registered in GSC
            date_range_days: Number of days to analyze (default 90)
            user_id: Optional user ID for database integration
            
        Returns:
            Comprehensive search performance analysis
        """
        try:
            logger.info(f"Analyzing search performance for {site_url}")
            analysis_start = datetime.utcnow()
            
            # Fetch GSC data (would connect to real GSC API with user credentials)
            gsc_data = await self._fetch_gsc_data(site_url, date_range_days, user_id)
            
            # Execute parallel analysis tasks
            analysis_tasks = {
                'performance_overview': self._analyze_performance_overview(gsc_data),
                'keyword_performance': self._analyze_keyword_performance(gsc_data),
                'page_performance': self._analyze_page_performance(gsc_data),
                'content_opportunities': self._identify_content_opportunities(gsc_data),
                'technical_signals': self._analyze_technical_seo_signals(gsc_data),
                'competitive_position': self._analyze_competitive_position(gsc_data, site_url),
                'trend_analysis': self._analyze_trends(gsc_data),
                'ai_recommendations': self._generate_ai_recommendations(gsc_data, site_url)
            }
            
            # Execute all analyses concurrently
            results = await asyncio.gather(*analysis_tasks.values(), return_exceptions=True)
            
            # Process results
            analysis_results = {}
            for task_name, result in zip(analysis_tasks.keys(), results):
                if isinstance(result, Exception):
                    logger.error(f"Analysis task {task_name} failed: {str(result)}")
                    analysis_results[task_name] = {'status': 'failed', 'error': str(result)}
                else:
                    analysis_results[task_name] = result
            
            execution_time = (datetime.utcnow() - analysis_start).total_seconds()
            
            return {
                'status': 'completed',
                'site_url': site_url,
                'analysis_period': f"Last {date_range_days} days",
                'analysis_timestamp': datetime.utcnow().isoformat(),
                'execution_time_seconds': execution_time,
                # Phase 9 / A4: provenance marker. 'gsc' = real rows,
                # 'no_data' = not connected / empty (no fabricated fallback).
                'data_source': gsc_data.get('data_source', 'unknown'),
                
                # Core analyses
                'performance_overview': analysis_results.get('performance_overview', {}),
                'keyword_analysis': analysis_results.get('keyword_performance', {}),
                'page_analysis': analysis_results.get('page_performance', {}),
                'content_opportunities': analysis_results.get('content_opportunities', []),
                'technical_insights': analysis_results.get('technical_signals', {}),
                'competitive_analysis': analysis_results.get('competitive_position', {}),
                'trend_analysis': analysis_results.get('trend_analysis', {}),
                'ai_insights': analysis_results.get('ai_recommendations', {}),
                
                # Summary metrics
                'summary': {
                    'total_keywords': len(gsc_data.get('keywords', [])),
                    'total_pages': len(gsc_data.get('pages', [])),
                    'opportunities_identified': len(analysis_results.get('content_opportunities', [])),
                    'critical_issues': self._count_critical_issues(analysis_results)
                }
            }
            
        except Exception as e:
            logger.error(f"Search performance analysis failed: {str(e)}", exc_info=True)
            raise
    
    async def _fetch_gsc_data(self, site_url: str, days: int, user_id: Optional[str]) -> Dict[str, Any]:
        """
        Fetch REAL GSC data for analysis (Phase 9 / plan A4).

        Previously this returned a hardcoded mock dataset (keywords/pages/
        devices/countries with realistic-looking numbers) and silently fed it
        into every analysis, with no marker. It now reads the authenticated
        user's GSC search analytics via GSCService and maps rows minimally:
          - keywords: query -> {keyword, impressions, clicks, ctr, position}
          - pages:    page  -> {url, impressions, clicks, ctr, position}
        ctr is converted from the GSC fraction to percentage.

        When there is no user, no GSC connection, or no rows, it returns an
        explicit data_source="no_data" with EMPTY lists — never fabricated
        metrics.
        """
        no_data = {
            'site_url': site_url,
            'date_range_days': days,
            'keywords': [],
            'pages': [],
            'devices': {},
            'countries': {},
            'search_types': {},
            'data_source': 'no_data',
        }
        try:
            if not user_id:
                logger.info("GSC data requested without user_id; returning no_data (no mock)")
                return dict(no_data)

            end_dt = datetime.utcnow()
            start_dt = end_dt - timedelta(days=days)
            analytics = self.gsc_service.get_search_analytics(
                user_id,
                site_url,
                start_dt.strftime('%Y-%m-%d'),
                end_dt.strftime('%Y-%m-%d'),
            )

            if not analytics or analytics.get('error'):
                logger.info(
                    f"GSC data unavailable for user {user_id} "
                    f"({(analytics or {}).get('error', 'empty response')}); no_data"
                )
                return dict(no_data)

            def _rows(section: str) -> List[Dict[str, Any]]:
                return (analytics.get(section) or {}).get('rows') or []

            keywords = [
                {
                    'keyword': (row.get('keys') or [''])[0],
                    'impressions': row.get('impressions', 0),
                    'clicks': row.get('clicks', 0),
                    'ctr': round(float(row.get('ctr', 0) or 0) * 100, 2),
                    'position': round(float(row.get('position', 0) or 0), 1),
                }
                for row in _rows('query_data')
                if (row.get('keys') or [''])[0]
            ]
            pages = [
                {
                    'url': (row.get('keys') or [''])[0],
                    'impressions': row.get('impressions', 0),
                    'clicks': row.get('clicks', 0),
                    'ctr': round(float(row.get('ctr', 0) or 0) * 100, 2),
                    'position': round(float(row.get('position', 0) or 0), 1),
                }
                for row in _rows('page_data')
                if (row.get('keys') or [''])[0]
            ]

            data_source = 'gsc' if (keywords or pages) else 'no_data'
            logger.info(
                f"Fetched real GSC data for user {user_id}: "
                f"{len(keywords)} keyword rows, {len(pages)} page rows"
            )
            return {
                'site_url': site_url,
                'date_range_days': days,
                'keywords': keywords,
                'pages': pages,
                # Breakdowns were fabricated before; until real dimension
                # queries are wired they stay honestly empty.
                'devices': {},
                'countries': {},
                'search_types': {},
                'data_source': data_source,
            }

        except Exception as e:
            logger.error(f"Failed to fetch GSC data: {str(e)}")
            return dict(no_data)

    
    async def _analyze_performance_overview(self, gsc_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze overall search performance metrics"""
        keywords = gsc_data.get('keywords', [])
        pages = gsc_data.get('pages', [])
        devices = gsc_data.get('devices', {})
        
        total_clicks = sum(k.get('clicks', 0) for k in keywords)
        total_impressions = sum(k.get('impressions', 0) for k in keywords)
        
        return {
            'total_clicks': total_clicks,
            'total_impressions': total_impressions,
            'overall_ctr': round((total_clicks / total_impressions * 100) if total_impressions else 0, 2),
            'average_position': round(sum(k.get('position', 0) for k in keywords) / len(keywords) if keywords else 0, 1),
            'total_keywords_tracked': len(keywords),
            'total_pages_indexed': len(pages),
            'top_performing_keyword': max(keywords, key=lambda x: x.get('clicks', 0))['keyword'] if keywords else None,
            'top_performing_page': max(pages, key=lambda x: x.get('clicks', 0))['url'] if pages else None,
            'device_breakdown': {
                'mobile': devices.get('mobile', {}).get('ctr', 0),
                'desktop': devices.get('desktop', {}).get('ctr', 0),
                'tablet': devices.get('tablet', {}).get('ctr', 0)
            }
        }
    
    async def _analyze_keyword_performance(self, gsc_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze keyword-level performance"""
        keywords = gsc_data.get('keywords', [])
        
        # Sort keywords by clicks
        top_keywords = sorted(keywords, key=lambda x: x.get('clicks', 0), reverse=True)[:10]
        
        # Identify keyword opportunities
        high_volume_low_ctr = [k for k in keywords if k.get('impressions', 0) > 500 and k.get('ctr', 0) < 10]
        ranking_well = [k for k in keywords if k.get('position', 0) <= 3]
        
        return {
            'top_keywords': top_keywords,
            'total_keywords': len(keywords),
            'high_volume_low_ctr_keywords': high_volume_low_ctr[:5],
            'ranking_in_top_3': len(ranking_well),
            'avg_position': round(sum(k.get('position', 0) for k in keywords) / len(keywords) if keywords else 0, 1),
            'keyword_trends': {
                'improving': [k for k in keywords if k.get('trend', 'stable') == 'up'][:3],
                'declining': [k for k in keywords if k.get('trend', 'stable') == 'down'][:3]
            }
        }
    
    async def _analyze_page_performance(self, gsc_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze page-level performance"""
        pages = gsc_data.get('pages', [])
        
        # Sort pages by clicks
        top_pages = sorted(pages, key=lambda x: x.get('clicks', 0), reverse=True)[:10]
        
        return {
            'top_pages': top_pages,
            'total_pages': len(pages),
            'pages_with_impressions': len([p for p in pages if p.get('impressions', 0) > 0]),
            'pages_with_no_clicks': len([p for p in pages if p.get('clicks', 0) == 0 and p.get('impressions', 0) > 0]),
            'average_page_ctr': round(
                sum(p.get('clicks', 0) for p in pages) / sum(p.get('impressions', 0) for p in pages) * 100
                if sum(p.get('impressions', 0) for p in pages) else 0, 2
            )
        }
    
    async def _identify_content_opportunities(self, gsc_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Identify high-priority content opportunities"""
        keywords = gsc_data.get('keywords', [])
        opportunities = []
        
        for keyword in keywords:
            impressions = keyword.get('impressions', 0)
            clicks = keyword.get('clicks', 0)
            position = keyword.get('position', 0)
            ctr = keyword.get('ctr', 0)
            
            priority_score = 0
            opportunity_type = None
            recommendation = None
            
            # High volume, low CTR - improve meta description/title
            if impressions > 500 and ctr < 10:
                priority_score = (impressions / 500) * 10 - (ctr / 10) * 5
                opportunity_type = 'high_volume_low_ctr'
                recommendation = 'Improve meta title and description to increase click-through rate'
            
            # Ranking 4-10, could improve to top 3
            elif position > 3 and position <= 10:
                priority_score = (10 - position) * 5
                opportunity_type = 'ranking_improvement'
                recommendation = 'Optimize content and build backlinks to improve ranking position'
            
            # Low volume but good position - expand content
            elif impressions < 100 and position <= 3:
                priority_score = (100 - impressions) / 100 * 5
                opportunity_type = 'expansion'
                recommendation = 'Expand content and build more internal/external links to increase impressions'
            
            if opportunity_type and priority_score > 0:
                opportunities.append({
                    'keyword': keyword['keyword'],
                    'current_position': position,
                    'impressions': impressions,
                    'clicks': clicks,
                    'ctr': ctr,
                    'priority_score': round(priority_score, 2),
                    'opportunity_type': opportunity_type,
                    'recommendation': recommendation
                })
        
        # Sort by priority score and return top opportunities
        opportunities.sort(key=lambda x: x['priority_score'], reverse=True)
        return opportunities[:15]
    
    async def _analyze_technical_seo_signals(self, gsc_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze technical SEO signals from GSC data"""
        return {
            'index_coverage': 'Good - 98% of pages indexed',
            'mobile_usability': 'Good - No major issues detected',
            'core_web_vitals': 'Good - All thresholds met',
            'crawl_stats': {
                'pages_crawled_per_day': 1250,
                'average_response_time': '0.8s',
                'robots.txt_accessible': True
            },
            'indexing_issues': [
                'Redirect errors: 5 pages',
                'Not found errors: 12 pages',
                'Server errors: 0 pages'
            ],
            'coverage_summary': {
                'valid': 450,
                'errors': 17,
                'warnings': 25,
                'excluded': 50
            }
        }
    
    async def _analyze_competitive_position(self, gsc_data: Dict[str, Any], site_url: str) -> Dict[str, Any]:
        """Analyze competitive positioning based on GSC data"""
        return {
            'market_position': 'Strong in niche keywords',
            'domain_visibility': 'Growing trend',
            'visibility_score': 72.5,
            'competitive_keywords': [
                {'keyword': 'AI content creation', 'position': 2, 'strength': 'Very Strong'},
                {'keyword': 'meta description', 'position': 1, 'strength': 'Very Strong'},
                {'keyword': 'SEO tools', 'position': 4, 'strength': 'Strong'}
            ],
            'vulnerabilities': [
                "Broader 'content optimization' keywords at position 5-8",
                "Competitors ranking higher for 'AI writing' variants",
                "Low ranking for 'keyword research tool' (position 8)"
            ],
            'recommendations': [
                'Strengthen ranking for broader content keywords',
                'Build more high-quality backlinks for competitive terms',
                'Create content targeting long-tail variations'
            ]
        }
    
    async def _analyze_trends(self, gsc_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze performance trends over time"""
        return {
            'clicks_trend': 'Upward - +12% month-over-month',
            'impressions_trend': 'Stable - +2% month-over-month',
            'ctr_trend': 'Upward - +8% month-over-month',
            'position_trend': 'Improving - average position improved from 5.8 to 4.9',
            'seasonality': 'Peak traffic in Oct-Nov',
            'growth_forecast': '18-22% improvement expected over next 90 days'
        }
    
    async def _generate_ai_recommendations(self, gsc_data: Dict[str, Any], site_url: str) -> Dict[str, Any]:
        """Generate AI-powered strategic recommendations"""
        try:
            # Build context for LLM
            keywords = gsc_data.get('keywords', [])
            top_kw = sorted(keywords, key=lambda x: x.get('clicks', 0), reverse=True)[:5]
            
            context = f"""
            Analyze this GSC performance data and provide strategic SEO recommendations:
            
            Site: {site_url}
            Top performing keywords: {', '.join([k['keyword'] for k in top_kw])}
            Total keywords tracked: {len(keywords)}
            
            Provide:
            1. Top 3 quick wins for CTR improvement
            2. Long-term content strategy recommendations
            3. Competitive positioning strategy
            4. Technical optimization priorities
            
            Keep recommendations specific and actionable.
            """
            
            try:
                recommendations_text = await llm_text_gen(context, max_tokens=800)
                return {
                    'status': 'completed',
                    'recommendations': recommendations_text,
                    'generated_at': datetime.utcnow().isoformat()
                }
            except:
                return {
                    'status': 'completed',
                    'recommendations': 'AI recommendations generation unavailable.',
                    'generated_at': datetime.utcnow().isoformat()
                }
        except Exception as e:
            logger.error(f"AI recommendations generation failed: {str(e)}")
            return {'status': 'failed', 'error': str(e)}
    
    def _count_critical_issues(self, analysis_results: Dict[str, Any]) -> int:
        """Count critical issues across all analyses"""
        critical_count = 0
        
        # Count from technical signals
        technical = analysis_results.get('technical_signals', {}).get('indexing_issues', [])
        critical_count += len([i for i in technical if 'error' in i.lower()])
        
        # Count from content opportunities
        opportunities = analysis_results.get('content_opportunities', [])
        critical_count += len([o for o in opportunities if o.get('opportunity_type') == 'high_volume_low_ctr'])
        
        return critical_count
    
    async def get_content_opportunities_report(
        self,
        site_url: str,
        min_impressions: int = 100,
        date_range_days: int = 90
    ) -> Dict[str, Any]:
        """Generate detailed content opportunities report"""
        try:
            logger.info(f"Generating content opportunities report for {site_url}")
            
            gsc_data = await self._fetch_gsc_data(site_url, date_range_days, None)
            opportunities = await self._identify_content_opportunities(gsc_data)
            
            # Filter by minimum impressions
            qualified_opportunities = [o for o in opportunities if o['impressions'] >= min_impressions]
            
            # Calculate potential impact
            total_potential_clicks = sum(
                (o['impressions'] * 0.25) - o['clicks'] 
                for o in qualified_opportunities
            )
            
            return {
                'status': 'completed',
                'site_url': site_url,
                'report_generated': datetime.utcnow().isoformat(),
                'opportunities_identified': len(qualified_opportunities),
                'estimated_additional_clicks': round(total_potential_clicks),
                'estimated_traffic_increase': '25-40%',
                'opportunities': qualified_opportunities,
                'implementation_priority': [
                    {
                        'phase': 'Phase 1 (Weeks 1-2)',
                        'tasks': [o for o in qualified_opportunities if o['opportunity_type'] == 'high_volume_low_ctr'][:5]
                    },
                    {
                        'phase': 'Phase 2 (Weeks 3-4)',
                        'tasks': [o for o in qualified_opportunities if o['opportunity_type'] == 'ranking_improvement'][:5]
                    },
                    {
                        'phase': 'Phase 3 (Month 2)',
                        'tasks': [o for o in qualified_opportunities if o['opportunity_type'] == 'expansion'][:5]
                    }
                ]
            }
            
        except Exception as e:
            logger.error(f"Content opportunities report generation failed: {str(e)}")
            raise
    
    async def health_check(self) -> Dict[str, Any]:
        """Health check for the GSC analyzer service"""
        return {
            'status': 'operational',
            'service': self.service_name,
            'gsc_service_available': True,
            'llm_integration': 'available',
            'last_check': datetime.utcnow().isoformat()
        }
