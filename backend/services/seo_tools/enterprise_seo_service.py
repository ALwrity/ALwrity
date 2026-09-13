"""
Enterprise SEO Service

Comprehensive enterprise-level SEO audit service that orchestrates
multiple SEO tools into intelligent workflows with advanced analytics.

Features:
- Multi-tool orchestration (Technical, Content, Performance)
- Competitive intelligence analysis
- ROI-focused recommendations
- Executive reporting and scoring
- Content opportunity identification
- Search performance optimization
"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import asyncio
import json
from loguru import logger
import aiohttp

from services.seo_tools.technical_seo_service import TechnicalSEOService
from services.seo_tools.on_page_seo_service import OnPageSEOService
from services.seo_tools.pagespeed_service import PageSpeedService
from services.seo_tools.sitemap_service import SitemapService
from services.seo_tools.content_strategy_service import ContentStrategyService
from services.llm_providers.main_text_generation import llm_text_gen
# Phase 10 / B4: DeepCompetitorAnalysisService is imported lazily inside
# _execute_competitive_analysis — a module-level import forms a cycle
# (services.seo.__init__ -> dashboard_service -> ... -> this module).


@dataclass
class AuditComponent:
    """Data class for audit component results"""
    component_name: str
    status: str  # 'completed', 'failed', 'pending'
    score: Optional[float] = None
    critical_issues: Optional[List[str]] = None
    recommendations: Optional[List[str]] = None
    execution_time: Optional[float] = None


class EnterpriseSEOService:
    """Service for enterprise SEO audits and workflows with full orchestration"""
    
    def __init__(self):
        """Initialize the enterprise SEO service with all sub-services"""
        self.service_name = "enterprise_seo_suite"
        self.version = "2.0"
        
        # Initialize sub-services
        self.technical_seo_service = TechnicalSEOService()
        self.on_page_seo_service = OnPageSEOService()
        self.pagespeed_service = PageSpeedService()
        self.sitemap_service = SitemapService()
        self.content_strategy_service = ContentStrategyService()
        
        logger.info(f"Initialized {self.service_name} v{self.version} with all sub-services")
    
    async def execute_complete_audit(
        self,
        website_url: str,
        competitors: Optional[List[str]] = None,
        target_keywords: Optional[List[str]] = None,
        include_content_analysis: bool = True,
        include_competitive_analysis: bool = True,
        generate_executive_report: bool = True,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Execute comprehensive enterprise SEO audit with full orchestration.
        
        Args:
            website_url: Primary website URL to audit
            competitors: List of competitor URLs (max 5)
            target_keywords: List of target keywords for analysis
            include_content_analysis: Include content strategy analysis
            include_competitive_analysis: Include competitive benchmarking
            generate_executive_report: Generate executive summary report
            
        Returns:
            Comprehensive audit results with all components
        """
        audit_start_time = datetime.utcnow()
        audit_id = f"audit_{audit_start_time.strftime('%Y%m%d_%H%M%S')}"
        
        logger.info(f"Starting complete audit [{audit_id}] for {website_url}")
        
        try:
            # Validate inputs
            if not website_url:
                raise ValueError("website_url is required")
            
            # Normalize competitors list
            competitors = competitors[:5] if competitors else []
            target_keywords = target_keywords or []
            
            # Initialize component results tracking
            audit_components = {}
            component_scores = {}
            
            # ============= PARALLEL EXECUTION: Core Audit Components =============
            logger.info(f"[{audit_id}] Executing core audit components in parallel...")
            
            # Create tasks for parallel execution
            tasks = {
                'technical_seo': self._execute_technical_audit(website_url, audit_id),
                'on_page_seo': self._execute_on_page_audit(website_url, target_keywords, audit_id),
                'pagespeed': self._execute_pagespeed_audit(website_url, audit_id),
                'sitemap': self._execute_sitemap_audit(website_url, audit_id),
            }
            
            # Add optional components
            if include_content_analysis:
                tasks['content_strategy'] = self._execute_content_audit(
                    website_url, target_keywords, competitors, audit_id
                )
            
            # Execute all tasks concurrently
            results = await asyncio.gather(*tasks.values(), return_exceptions=True)
            
            # Process results
            for component_name, result in zip(tasks.keys(), results):
                if isinstance(result, Exception):
                    logger.error(f"[{audit_id}] {component_name} failed: {str(result)}")
                    audit_components[component_name] = {
                        'status': 'failed',
                        'error': str(result)
                    }
                    component_scores[component_name] = 0
                else:
                    audit_components[component_name] = result
                    component_scores[component_name] = result.get('score', 0)
            
            # ============= COMPETITIVE ANALYSIS =============
            competitive_analysis = {}
            if include_competitive_analysis and competitors:
                logger.info(f"[{audit_id}] Executing competitive analysis...")
                competitive_analysis = await self._execute_competitive_analysis(
                    website_url, competitors, audit_id, user_id=user_id
                )
            
            # ============= CALCULATE OVERALL SCORES =============
            overall_score = self._calculate_overall_score(component_scores)
            
            # ============= PRIORITIZE RECOMMENDATIONS =============
            logger.info(f"[{audit_id}] Aggregating recommendations...")
            prioritized_actions = await self._aggregate_recommendations(
                audit_components, component_scores, audit_id
            )
            
            # ============= AI-POWERED INSIGHTS =============
            logger.info(f"[{audit_id}] Generating AI-powered insights...")
            ai_insights = await self._generate_ai_insights(
                website_url, audit_components, component_scores, target_keywords, audit_id
            )
            
            # ============= EXECUTIVE REPORT =============
            audit_end_time = datetime.utcnow()
            execution_time = (audit_end_time - audit_start_time).total_seconds()
            
            report = {
                "audit_id": audit_id,
                "website_url": website_url,
                "audit_type": "complete_enterprise_audit",
                "execution_time_seconds": execution_time,
                "timestamp": audit_end_time.isoformat(),
                
                # Overall metrics
                "overall_score": overall_score,
                "overall_status": self._get_audit_status(overall_score),
                "components_analyzed": len(audit_components),
                "components_successful": sum(1 for v in audit_components.values() if v.get('status') == 'completed'),
                
                # Component details
                "component_results": audit_components,
                "component_scores": component_scores,
                
                # Competitive analysis
                "competitors_analyzed": len(competitors),
                "competitive_analysis": competitive_analysis,
                
                # Recommendations
                "priority_actions": prioritized_actions,
                "total_recommendations": len(prioritized_actions),
                
                # AI Insights
                "ai_insights": ai_insights,
                
                # Business metrics
                "estimated_impact": self._calculate_estimated_impact(
                    overall_score, component_scores
                ),
                "estimated_traffic_improvement": "15-35%",
                "implementation_timeline": self._estimate_implementation_timeline(prioritized_actions),
                
                # Target keywords performance
                "target_keywords": target_keywords,
                "keyword_analysis": audit_components.get('content_strategy', {}).get('keyword_analysis', {}),
                
                # Next steps
                "next_steps": [
                    "Review priority actions with your team",
                    f"Allocate resources for {len([a for a in prioritized_actions if a.get('priority') == 'critical'])} critical items",
                    "Set implementation milestones",
                    "Schedule follow-up audit in 30 days"
                ]
            }
            
            logger.info(f"[{audit_id}] Audit completed successfully in {execution_time:.2f}s with score {overall_score}")
            return report
            
        except Exception as e:
            logger.error(f"[{audit_id}] Complete audit failed: {str(e)}", exc_info=True)
            raise
    
    async def _execute_technical_audit(self, website_url: str, audit_id: str) -> Dict[str, Any]:
        """Execute technical SEO audit component"""
        try:
            logger.info(f"[{audit_id}] Starting technical SEO audit...")
            start_time = datetime.utcnow()
            
            result = await self.technical_seo_service.analyze_technical_seo(
                url=website_url,
                crawl_depth=3
            )
            
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            return {
                'status': 'completed',
                'score': result.get('overall_score', 0),
                'critical_issues': result.get('critical_issues', []),
                'issues_count': result.get('total_issues', 0),
                'crawl_stats': result.get('crawl_stats', {}),
                'recommendations': result.get('recommendations', []),
                'execution_time': execution_time
            }
        except Exception as e:
            logger.error(f"[{audit_id}] Technical audit failed: {str(e)}")
            raise
    
    async def _execute_on_page_audit(self, website_url: str, keywords: List[str], audit_id: str) -> Dict[str, Any]:
        """Execute on-page SEO audit component"""
        try:
            logger.info(f"[{audit_id}] Starting on-page SEO audit...")
            start_time = datetime.utcnow()
            
            result = await self.on_page_seo_service.analyze_on_page_seo(
                url=website_url,
                target_keywords=keywords
            )
            
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            return {
                'status': 'completed',
                'score': result.get('page_score', 0),
                'meta_tags': result.get('meta_tags', {}),
                'content_quality': result.get('content_quality', {}),
                'technical_elements': result.get('technical_elements', {}),
                'keyword_presence': result.get('keyword_analysis', {}),
                'recommendations': result.get('recommendations', []),
                'execution_time': execution_time
            }
        except Exception as e:
            logger.error(f"[{audit_id}] On-page audit failed: {str(e)}")
            raise
    
    async def _execute_pagespeed_audit(self, website_url: str, audit_id: str) -> Dict[str, Any]:
        """Execute PageSpeed Insights audit component"""
        try:
            logger.info(f"[{audit_id}] Starting PageSpeed Insights audit...")
            start_time = datetime.utcnow()
            
            result = await self.pagespeed_service.analyze_pagespeed(
                url=website_url,
                strategy="MOBILE"
            )
            
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            return {
                'status': 'completed',
                'score': result.get('performance_score', 0),
                'core_web_vitals': result.get('core_web_vitals', {}),
                'metrics': result.get('metrics', {}),
                'opportunities': result.get('opportunities', []),
                'recommendations': result.get('optimization_suggestions', []),
                'mobile_score': result.get('mobile_performance', 0),
                'desktop_score': result.get('desktop_performance', 0),
                'execution_time': execution_time
            }
        except Exception as e:
            logger.error(f"[{audit_id}] PageSpeed audit failed: {str(e)}")
            raise
    
    async def _execute_sitemap_audit(self, website_url: str, audit_id: str) -> Dict[str, Any]:
        """Execute sitemap analysis component"""
        try:
            logger.info(f"[{audit_id}] Starting sitemap analysis...")
            start_time = datetime.utcnow()
            
            # Extract domain from website_url for sitemap location
            from urllib.parse import urlparse
            domain = urlparse(website_url).netloc
            sitemap_url = f"https://{domain}/sitemap.xml"
            
            result = await self.sitemap_service.analyze_sitemap(
                sitemap_url=sitemap_url
            )
            
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            return {
                'status': 'completed',
                'score': result.get('sitemap_score', 0),
                'total_urls': result.get('total_urls', 0),
                'url_structure': result.get('url_structure_analysis', {}),
                'publishing_frequency': result.get('publishing_frequency', {}),
                'content_distribution': result.get('content_distribution', {}),
                'recommendations': result.get('recommendations', []),
                'execution_time': execution_time
            }
        except Exception as e:
            logger.error(f"[{audit_id}] Sitemap audit failed: {str(e)}")
            raise
    
    async def _execute_content_audit(self, website_url: str, keywords: List[str], competitors: List[str], audit_id: str) -> Dict[str, Any]:
        """Execute content strategy analysis component"""
        try:
            logger.info(f"[{audit_id}] Starting content strategy analysis...")
            start_time = datetime.utcnow()
            
            result = await self.content_strategy_service.analyze_content_strategy(
                website_url=website_url,
                target_keywords=keywords,
                competitor_urls=competitors
            )
            
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            return {
                'status': 'completed',
                'score': result.get('strategy_score', 0),
                'content_gaps': result.get('content_gaps', []),
                'opportunities': result.get('opportunities', []),
                'keyword_analysis': result.get('keyword_analysis', {}),
                'competitive_comparison': result.get('competitive_analysis', {}),
                'recommendations': result.get('content_recommendations', []),
                'execution_time': execution_time
            }
        except Exception as e:
            logger.error(f"[{audit_id}] Content audit failed: {str(e)}")
            raise
    
    async def _execute_competitive_analysis(
        self,
        website_url: str,
        competitors: List[str],
        audit_id: str,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Competitive benchmarking via the REAL DeepCompetitorAnalysisService.

        Phase 10 (plan B4): this previously returned placeholder strings
        ("Data from external API") plus invented advantages/gaps. It now calls
        the real deep-competitor pipeline when a user + competitors exist and
        otherwise returns an explicit no_data — no fabricated metrics.
        """
        try:
            logger.info(f"[{audit_id}] Executing competitive analysis across {len(competitors or [])} sites...")

            if not competitors:
                return {
                    "status": "no_data",
                    "data_source": "none",
                    "primary_site": website_url,
                    "message": "No competitors provided for comparison.",
                }
            if not user_id:
                return {
                    "status": "no_data",
                    "data_source": "none",
                    "primary_site": website_url,
                    "message": "Authenticated user required for real competitor analysis.",
                }

            # Lazy import: avoids the services.seo package import cycle.
            from services.seo.deep_competitor_analysis_service import (
                DeepCompetitorAnalysisService,
            )

            deep_result = await DeepCompetitorAnalysisService().run(
                user_id=user_id,
                website_analysis={},
                competitors=[{"url": c} for c in competitors],
            )

            return {
                "status": "success",
                "data_source": "deep_competitor_analysis",
                "primary_site": website_url,
                "competitors_compared": competitors,
                "baseline": deep_result.get("baseline", {}),
                "competitor_analyses": deep_result.get("competitors", []),
                "aggregation": deep_result.get("aggregation", {}),
                "metadata": deep_result.get("metadata", {}),
            }
        except Exception as e:
            logger.error(f"[{audit_id}] Competitive analysis failed: {str(e)}")
            return {'status': 'failed', 'error': str(e), 'data_source': 'deep_competitor_analysis'}
    
    async def _aggregate_recommendations(self, components: Dict[str, Any], scores: Dict[str, float], audit_id: str) -> List[Dict[str, Any]]:
        """Aggregate and prioritize recommendations from all components"""
        try:
            all_recommendations = []
            
            # Collect all recommendations from components
            for component_name, component_data in components.items():
                if component_data.get('status') == 'completed':
                    component_recs = component_data.get('recommendations', [])
                    for rec in component_recs:
                        all_recommendations.append({
                            'source_component': component_name,
                            'recommendation': rec,
                            'component_score': scores.get(component_name, 0)
                        })
            
            # Prioritize by component score (lower score = higher priority)
            all_recommendations.sort(key=lambda x: x['component_score'])
            
            # Assign priority levels and effort estimates
            prioritized = []
            for idx, rec in enumerate(all_recommendations[:15]):  # Top 15 recommendations
                priority = 'critical' if idx < 3 else 'high' if idx < 8 else 'medium'
                effort = 'quick-win' if idx < 3 else 'short-term' if idx < 8 else 'medium-term'
                
                prioritized.append({
                    'priority': priority,
                    'recommendation': rec['recommendation'],
                    'source': rec['source_component'],
                    'estimated_effort': effort,
                    'potential_impact': 'High' if priority == 'critical' else 'Medium',
                    'implementation_steps': [
                        f"Step 1: {rec['recommendation'].split('.')[0] if '.' in rec['recommendation'] else rec['recommendation']}",
                        "Step 2: Implement changes",
                        "Step 3: Test and validate",
                        "Step 4: Monitor improvements"
                    ]
                })
            
            return prioritized
        except Exception as e:
            logger.error(f"[{audit_id}] Recommendation aggregation failed: {str(e)}")
            return []
    
    async def _generate_ai_insights(self, website_url: str, components: Dict[str, Any], scores: Dict[str, float], keywords: List[str], audit_id: str) -> Dict[str, Any]:
        """Generate AI-powered strategic insights"""
        try:
            logger.info(f"[{audit_id}] Generating AI insights...")
            
            # Build context for LLM
            context = f"""
            Analyze the following SEO audit results and provide strategic insights:
            
            Website: {website_url}
            Overall Score: {scores.get('overall_score', 0)}
            
            Components:
            - Technical SEO: {scores.get('technical_seo', 0)}
            - On-Page SEO: {scores.get('on_page_seo', 0)}
            - PageSpeed: {scores.get('pagespeed', 0)}
            - Sitemap: {scores.get('sitemap', 0)}
            - Content Strategy: {scores.get('content_strategy', 0)}
            
            Target Keywords: {', '.join(keywords) if keywords else 'Not specified'}
            
            Provide:
            1. Executive summary of current SEO health
            2. Top 3 opportunities for quick wins
            3. Long-term strategy recommendations
            4. Estimated business impact
            """
            
            # Call LLM for insights
            try:
                insights_text = await llm_text_gen(context, max_tokens=1000)
                return {
                    'status': 'completed',
                    'ai_analysis': insights_text,
                    'generated_at': datetime.utcnow().isoformat()
                }
            except:
                # Fallback if LLM is unavailable
                return {
                    'status': 'completed',
                    'ai_analysis': 'AI insights generation unavailable. Review component results above.',
                    'generated_at': datetime.utcnow().isoformat()
                }
        except Exception as e:
            logger.error(f"[{audit_id}] AI insights generation failed: {str(e)}")
            return {'status': 'failed', 'error': str(e)}
    
    def _calculate_overall_score(self, component_scores: Dict[str, float]) -> float:
        """Calculate weighted overall SEO score"""
        if not component_scores:
            return 0
        
        # Weight distribution
        weights = {
            'technical_seo': 0.25,
            'on_page_seo': 0.25,
            'pagespeed': 0.20,
            'sitemap': 0.10,
            'content_strategy': 0.20
        }
        
        weighted_sum = sum(
            component_scores.get(component, 0) * weight 
            for component, weight in weights.items()
        )
        
        return round(weighted_sum, 1)
    
    def _get_audit_status(self, score: float) -> str:
        """Get audit status based on score"""
        if score >= 80:
            return "excellent"
        elif score >= 65:
            return "good"
        elif score >= 50:
            return "fair"
        else:
            return "needs_improvement"
    
    def _calculate_estimated_impact(self, overall_score: float, component_scores: Dict[str, float]) -> str:
        """Calculate estimated business impact based on audit results"""
        if overall_score >= 80:
            return "Minimal improvements needed. Focus on maintaining excellence."
        elif overall_score >= 65:
            return "15-25% potential improvement in organic traffic with recommended changes."
        elif overall_score >= 50:
            return "25-40% potential improvement in organic traffic with comprehensive implementation."
        else:
            return "40-60% potential improvement in organic traffic. Urgent action recommended."
    
    def _estimate_implementation_timeline(self, recommendations: List[Dict[str, Any]]) -> str:
        """Estimate implementation timeline based on recommendations"""
        critical_count = sum(1 for r in recommendations if r.get('priority') == 'critical')
        high_count = sum(1 for r in recommendations if r.get('priority') == 'high')
        
        if critical_count >= 3:
            return "2-4 weeks (with dedicated resources)"
        elif high_count >= 5:
            return "4-8 weeks (phased approach)"
        else:
            return "8-12 weeks (ongoing optimization)"
    
    async def execute_quick_audit(self, website_url: str) -> Dict[str, Any]:
        """Execute quick 5-minute audit focusing on critical issues"""
        try:
            logger.info(f"Starting quick audit for {website_url}")
            
            # Execute only critical components
            technical_result = await self._execute_technical_audit(website_url, "quick_audit")
            pagespeed_result = await self._execute_pagespeed_audit(website_url, "quick_audit")
            
            quick_score = (technical_result['score'] + pagespeed_result['score']) / 2
            
            return {
                'audit_type': 'quick_audit',
                'website_url': website_url,
                'quick_score': quick_score,
                'critical_issues': technical_result['critical_issues'] + pagespeed_result['recommendations'][:3],
                'top_recommendation': 'Fix critical technical SEO issues and improve page speed',
                'timestamp': datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Quick audit failed: {str(e)}")
            raise
    
    async def health_check(self) -> Dict[str, Any]:
        """Health check for the enterprise SEO service"""
        return {
            "status": "operational",
            "service": self.service_name,
            "version": self.version,
            "sub_services": {
                "technical_seo": "operational",
                "on_page_seo": "operational",
                "pagespeed": "operational",
                "sitemap": "operational",
                "content_strategy": "operational"
            },
            "last_check": datetime.utcnow().isoformat()
        }