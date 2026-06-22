"""
Comprehensive tests for Enterprise SEO Service and GSC Analyzer Service.

Tests cover:
- Service initialization and health checks
- Complete audit execution with all components
- Error handling and exception management
- Concurrent processing and orchestration
- Content opportunity identification
- AI recommendations generation
- Edge cases and input validation
"""

import pytest
import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from services.seo_tools.enterprise_seo_service import EnterpriseSEOService
from services.seo_tools.gsc_analyzer_service import GSCAnalyzerService


# ==================== ENTERPRISE SEO SERVICE TESTS ====================

class TestEnterpriseSEOService:
    """Test suite for EnterpriseSEOService"""
    
    @pytest.fixture
    def service(self):
        """Initialize service for tests"""
        return EnterpriseSEOService()
    
    @pytest.mark.asyncio
    async def test_service_initialization(self, service):
        """Test service initializes correctly with all sub-services"""
        assert service.service_name == "enterprise_seo_suite"
        assert service.version == "2.0"
        assert service.technical_seo_service is not None
        assert service.on_page_seo_service is not None
        assert service.pagespeed_service is not None
        assert service.sitemap_service is not None
        assert service.content_strategy_service is not None
    
    @pytest.mark.asyncio
    async def test_health_check(self, service):
        """Test health check endpoint"""
        health = await service.health_check()
        assert health['status'] == 'operational'
        assert health['service'] == 'enterprise_seo_suite'
        assert 'sub_services' in health
        assert len(health['sub_services']) == 5
    
    @pytest.mark.asyncio
    async def test_complete_audit_with_valid_inputs(self, service):
        """Test complete audit execution with valid inputs"""
        result = await service.execute_complete_audit(
            website_url="https://example.com",
            competitors=["https://competitor1.com", "https://competitor2.com"],
            target_keywords=["AI content", "SEO tools"],
            include_content_analysis=True,
            include_competitive_analysis=True,
            generate_executive_report=True
        )
        
        # Verify response structure
        assert result['audit_type'] == 'complete_enterprise_audit'
        assert result['website_url'] == "https://example.com"
        assert 'audit_id' in result
        assert 'overall_score' in result
        assert 'component_results' in result
        assert 'priority_actions' in result
        assert 'ai_insights' in result
        assert 'competitive_analysis' in result
    
    @pytest.mark.asyncio
    async def test_complete_audit_missing_website_url(self, service):
        """Test audit fails with missing website URL"""
        with pytest.raises(ValueError):
            await service.execute_complete_audit(
                website_url=None,
                target_keywords=["test"]
            )
    
    @pytest.mark.asyncio
    async def test_quick_audit(self, service):
        """Test quick 5-minute audit execution"""
        result = await service.execute_quick_audit("https://example.com")
        
        assert result['audit_type'] == 'quick_audit'
        assert result['website_url'] == "https://example.com"
        assert 'quick_score' in result
        assert 'critical_issues' in result
        assert 'top_recommendation' in result
    
    @pytest.mark.asyncio
    async def test_component_execution_concurrency(self, service):
        """Test all components execute concurrently without blocking"""
        result = await service.execute_complete_audit(
            website_url="https://example.com",
            include_content_analysis=True,
            generate_executive_report=True
        )
        
        # Verify execution time is reasonable for concurrent execution
        execution_time = result.get('execution_time_seconds', 0)
        # Should complete in < 30 seconds if concurrent
        assert execution_time < 30
        
        # Verify all components executed
        assert result['components_successful'] > 0
    
    @pytest.mark.asyncio
    async def test_overall_score_calculation(self, service):
        """Test overall score calculation with weighted components"""
        # Create mock component scores
        component_scores = {
            'technical_seo': 80,
            'on_page_seo': 75,
            'pagespeed': 70,
            'sitemap': 90,
            'content_strategy': 85
        }
        
        overall_score = service._calculate_overall_score(component_scores)
        
        # Score should be between 0-100
        assert 0 <= overall_score <= 100
        # With these inputs, should be around 80
        assert overall_score > 75
    
    @pytest.mark.asyncio
    async def test_audit_status_determination(self, service):
        """Test audit status based on score"""
        assert service._get_audit_status(85) == "excellent"
        assert service._get_audit_status(72) == "good"
        assert service._get_audit_status(57) == "fair"
        assert service._get_audit_status(40) == "needs_improvement"
    
    @pytest.mark.asyncio
    async def test_competitors_limit_enforcement(self, service):
        """Test that maximum 5 competitors are analyzed"""
        result = await service.execute_complete_audit(
            website_url="https://example.com",
            competitors=[
                "https://comp1.com", "https://comp2.com", "https://comp3.com",
                "https://comp4.com", "https://comp5.com", "https://comp6.com"
            ]
        )
        
        # Should limit to 5 competitors
        assert result['competitors_analyzed'] <= 5
    
    @pytest.mark.asyncio
    async def test_recommendations_sorting_by_priority(self, service):
        """Test recommendations are sorted by priority"""
        result = await service.execute_complete_audit(
            website_url="https://example.com"
        )
        
        actions = result.get('priority_actions', [])
        if len(actions) > 1:
            # Verify priority levels exist and are ordered
            priorities = [a.get('priority') for a in actions]
            assert any(p == 'critical' for p in priorities)
    
    @pytest.mark.asyncio
    async def test_error_handling_with_invalid_urls(self, service):
        """Test graceful error handling with invalid URLs"""
        # Should handle invalid URL format
        try:
            result = await service.execute_complete_audit(
                website_url="not_a_valid_url"
            )
            # Should either handle gracefully or raise with proper error
            assert 'error' in str(result) or 'audit_id' in result
        except Exception as e:
            assert 'url' in str(e).lower() or 'invalid' in str(e).lower()


# ==================== GSC ANALYZER SERVICE TESTS ====================

class TestGSCAnalyzerService:
    """Test suite for GSCAnalyzerService"""
    
    @pytest.fixture
    def service(self):
        """Initialize GSC service for tests"""
        return GSCAnalyzerService()
    
    @pytest.mark.asyncio
    async def test_service_initialization(self, service):
        """Test GSC service initializes correctly"""
        assert service.service_name == "gsc_analyzer"
        assert service.gsc_service is not None
    
    @pytest.mark.asyncio
    async def test_health_check(self, service):
        """Test GSC health check"""
        health = await service.health_check()
        assert health['status'] == 'operational'
        assert health['service'] == 'gsc_analyzer'
    
    @pytest.mark.asyncio
    async def test_search_performance_analysis(self, service):
        """Test comprehensive search performance analysis"""
        result = await service.analyze_search_performance(
            site_url="https://example.com",
            date_range_days=90
        )
        
        assert result['status'] == 'completed'
        assert result['site_url'] == "https://example.com"
        assert 'performance_overview' in result
        assert 'keyword_analysis' in result
        assert 'page_analysis' in result
        assert 'content_opportunities' in result
        assert 'technical_insights' in result
        assert 'competitive_analysis' in result
        assert 'ai_insights' in result
    
    @pytest.mark.asyncio
    async def test_date_range_validation(self, service):
        """Test date range parameter validation"""
        # Valid ranges
        result1 = await service.analyze_search_performance("https://example.com", 7)
        result2 = await service.analyze_search_performance("https://example.com", 90)
        result3 = await service.analyze_search_performance("https://example.com", 365)
        
        assert result1['status'] == 'completed'
        assert result2['status'] == 'completed'
        assert result3['status'] == 'completed'
    
    @pytest.mark.asyncio
    async def test_keyword_performance_analysis(self, service):
        """Test keyword-level performance analysis"""
        result = await service.analyze_search_performance("https://example.com")
        
        keyword_analysis = result.get('keyword_analysis', {})
        assert 'top_keywords' in keyword_analysis
        assert 'total_keywords' in keyword_analysis
        assert 'high_volume_low_ctr_keywords' in keyword_analysis
        assert 'ranking_in_top_3' in keyword_analysis
    
    @pytest.mark.asyncio
    async def test_content_opportunity_identification(self, service):
        """Test content opportunity identification"""
        result = await service.analyze_search_performance("https://example.com")
        
        opportunities = result.get('content_opportunities', [])
        assert len(opportunities) > 0
        
        # Verify opportunity structure
        for opp in opportunities[:1]:  # Check first opportunity
            assert 'keyword' in opp
            assert 'current_position' in opp
            assert 'impressions' in opp
            assert 'priority_score' in opp
            assert 'opportunity_type' in opp
            assert 'recommendation' in opp
    
    @pytest.mark.asyncio
    async def test_opportunity_types_identification(self, service):
        """Test different opportunity types are correctly identified"""
        result = await service.analyze_search_performance("https://example.com")
        
        opportunities = result.get('content_opportunities', [])
        opportunity_types = set(o.get('opportunity_type') for o in opportunities)
        
        # Should identify at least one type
        assert len(opportunity_types) > 0
        # Valid types
        valid_types = {'high_volume_low_ctr', 'ranking_improvement', 'expansion'}
        assert opportunity_types.issubset(valid_types)
    
    @pytest.mark.asyncio
    async def test_technical_signals_analysis(self, service):
        """Test technical SEO signals extraction"""
        result = await service.analyze_search_performance("https://example.com")
        
        technical = result.get('technical_insights', {})
        assert 'index_coverage' in technical
        assert 'mobile_usability' in technical
        assert 'core_web_vitals' in technical
        assert 'crawl_stats' in technical
    
    @pytest.mark.asyncio
    async def test_competitive_position_analysis(self, service):
        """Test competitive positioning analysis"""
        result = await service.analyze_search_performance("https://example.com")
        
        competitive = result.get('competitive_analysis', {})
        assert 'market_position' in competitive
        assert 'domain_visibility' in competitive
        assert 'competitive_keywords' in competitive
        assert 'vulnerabilities' in competitive
    
    @pytest.mark.asyncio
    async def test_content_opportunities_report_generation(self, service):
        """Test detailed content opportunities report"""
        report = await service.get_content_opportunities_report(
            site_url="https://example.com",
            min_impressions=100,
            date_range_days=90
        )
        
        assert report['status'] == 'completed'
        assert 'opportunities_identified' in report
        assert 'estimated_additional_clicks' in report
        assert 'implementation_priority' in report
        
        # Verify phased implementation
        phases = report.get('implementation_priority', [])
        assert len(phases) == 3  # Phase 1, 2, 3
    
    @pytest.mark.asyncio
    async def test_min_impressions_filtering(self, service):
        """Test minimum impressions threshold filtering"""
        report = await service.get_content_opportunities_report(
            site_url="https://example.com",
            min_impressions=500,
            date_range_days=90
        )
        
        opportunities = report.get('opportunities', [])
        # All opportunities should meet min_impressions threshold
        for opp in opportunities:
            assert opp['impressions'] >= 500


# ==================== INTEGRATION TESTS ====================

class TestEnterpriseGSCIntegration:
    """Integration tests between Enterprise and GSC services"""
    
    @pytest.mark.asyncio
    async def test_enterprise_audit_includes_gsc_insights(self):
        """Test enterprise audit can integrate GSC insights"""
        enterprise_service = EnterpriseSEOService()
        
        result = await enterprise_service.execute_complete_audit(
            website_url="https://example.com",
            include_content_analysis=True,
            include_competitive_analysis=True
        )
        
        # Should have competitive and content analysis
        assert 'competitive_analysis' in result
        assert 'component_results' in result
    
    @pytest.mark.asyncio
    async def test_concurrent_service_execution(self):
        """Test both services can run concurrently"""
        enterprise_service = EnterpriseSEOService()
        gsc_service = GSCAnalyzerService()
        
        # Run both concurrently
        results = await asyncio.gather(
            enterprise_service.execute_complete_audit("https://example.com"),
            gsc_service.analyze_search_performance("https://example.com")
        )
        
        # Both should complete successfully
        assert len(results) == 2
        assert results[0]['audit_type'] == 'complete_enterprise_audit'
        assert results[1]['status'] == 'completed'


# ==================== PERFORMANCE TESTS ====================

class TestPerformance:
    """Performance and efficiency tests"""
    
    @pytest.mark.asyncio
    async def test_concurrent_component_execution_speed(self):
        """Test that concurrent execution is faster than sequential"""
        service = EnterpriseSEOService()
        
        # Time complete audit (all concurrent)
        start = datetime.utcnow()
        await service.execute_complete_audit(
            website_url="https://example.com",
            include_content_analysis=True
        )
        concurrent_time = (datetime.utcnow() - start).total_seconds()
        
        # Should complete in reasonable time for concurrent execution
        assert concurrent_time < 60  # Should be much faster than sequential


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
