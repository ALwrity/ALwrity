/**
 * Enterprise SEO API client for ALwrity frontend
 * Handles Phase 2A endpoints: Enterprise Audit and GSC Analysis
 */

import { longRunningApiClient, apiClient } from './client';

// ============================================================================
// Type Definitions
// ============================================================================

export interface AuditIssue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  affected_pages?: number;
  estimated_impact?: string;
  recommendation?: string;
}

export interface TechnicalAuditResult {
  status: string;
  pages_audited: number;
  avg_score: number;
  issues: AuditIssue[];
  core_web_vitals?: {
    lcp: number; // Largest Contentful Paint
    fid: number; // First Input Delay
    cls: number; // Cumulative Layout Shift
  };
}

export interface PagePerformance {
  url: string;
  score: number;
  status: string;
  issues_count: number;
  priority: string;
}

export interface KeywordAnalysis {
  keyword: string;
  volume: number;
  difficulty: number;
  current_ranking: number;
  trend: string;
  opportunity_score: number;
}

export interface ContentOpportunity {
  type: string; // 'low_ctr', 'ready_to_rank', 'long_tail', etc.
  keyword: string;
  current_position: number;
  impressions: number;
  clicks: number;
  ctr: number;
  estimated_traffic_gain: number;
  difficulty_score: number;
  recommended_action: string;
  priority: 'high' | 'medium' | 'low';
}

export interface PerformanceOverview {
  clicks: number;
  impressions: number;
  ctr: number;
  avg_position: number;
  traffic_trend: string;
  top_keywords: KeywordAnalysis[];
}

export interface CompetitiveAnalysis {
  competitor_keywords: string[];
  content_gaps: string[];
  opportunity_score: number;
  positioning_strength: string;
  recommendations: string[];
}

export interface AIInsight {
  category: string;
  insight: string;
  priority: 'high' | 'medium' | 'low';
  action_required: boolean;
  estimated_impact: string;
  implementation_difficulty: string;
}

export interface ExecutiveSummary {
  overall_score: number;
  key_findings: string[];
  top_opportunities: string[];
  critical_issues: string[];
  estimated_traffic_potential: string;
  timeframe_to_implement: string;
}

export interface EnterpriseAuditResult {
  website_url: string;
  audit_date: string;
  executive_summary: ExecutiveSummary;
  technical_audit: TechnicalAuditResult;
  on_page_analysis: {
    pages_analyzed: number;
    avg_score: number;
    top_issues: AuditIssue[];
    top_performers: PagePerformance[];
  };
  content_strategy: {
    current_strategy: string;
    gaps_identified: string[];
    recommendations: string[];
    content_calendar_suggestion?: string;
  };
  competitive_analysis: CompetitiveAnalysis;
  keyword_research: {
    target_keywords: KeywordAnalysis[];
    long_tail_opportunities: KeywordAnalysis[];
    competitor_keywords: KeywordAnalysis[];
  };
  ai_insights: AIInsight[];
  implementation_roadmap: {
    phase1_quick_wins: string[];
    phase2_medium_term: string[];
    phase3_long_term: string[];
  };
  metrics_summary: {
    current_organic_traffic: number;
    estimated_traffic_potential: number;
    estimated_growth_percentage: number;
  };
}

export interface GSCAnalysisResult {
  site_url: string;
  analysis_date: string;
  analysis_period_days: number;
  performance_overview: PerformanceOverview;
  page_performance: PagePerformance[];
  keyword_analysis: {
    top_performers: KeywordAnalysis[];
    opportunities: KeywordAnalysis[];
    declining_keywords: KeywordAnalysis[];
  };
  content_opportunities: ContentOpportunity[];
  technical_signals: {
    core_web_vitals_score: number;
    mobile_usability_issues: number;
    indexing_issues: number;
    security_issues: number;
  };
  competitive_positioning: CompetitiveAnalysis;
  ai_recommendations: AIInsight[];
  traffic_potential: {
    low_hanging_fruit: string; // Quick wins
    medium_term_opportunities: string;
    long_term_growth: string;
    estimated_additional_traffic: number;
  };
}

export interface ContentOpportunitiesReport {
  site_url: string;
  report_date: string;
  analysis_period_days: number;
  total_opportunities: number;
  opportunities_by_priority: {
    high: ContentOpportunity[];
    medium: ContentOpportunity[];
    low: ContentOpportunity[];
  };
  phased_roadmap: {
    phase1: {
      target: string;
      opportunities: ContentOpportunity[];
      estimated_traffic_gain: number;
      timeframe_weeks: number;
    };
    phase2: {
      target: string;
      opportunities: ContentOpportunity[];
      estimated_traffic_gain: number;
      timeframe_weeks: number;
    };
    phase3: {
      target: string;
      opportunities: ContentOpportunity[];
      estimated_traffic_gain: number;
      timeframe_weeks: number;
    };
  };
  implementation_guide: string[];
  success_metrics: string[];
}

export interface BaseResponse<T> {
  success: boolean;
  message: string;
  data: T;
  execution_time?: number;
}

// ============================================================================
// API Client
// ============================================================================

export const enterpriseSeoAPI = {
  /**
   * Execute comprehensive enterprise SEO audit
   */
  async executeEnterpriseAudit(
    websiteUrl: string,
    options?: {
      competitors?: string[];
      targetKeywords?: string[];
      includeContentAnalysis?: boolean;
      includeCompetitiveAnalysis?: boolean;
      generateExecutiveReport?: boolean;
    }
  ): Promise<BaseResponse<EnterpriseAuditResult>> {
    try {
      const request = {
        website_url: websiteUrl,
        competitors: options?.competitors || [],
        target_keywords: options?.targetKeywords || [],
        include_content_analysis: options?.includeContentAnalysis ?? true,
        include_competitive_analysis: options?.includeCompetitiveAnalysis ?? true,
        generate_executive_report: options?.generateExecutiveReport ?? true,
      };

      console.log('Starting enterprise audit request:', request);
      const response = await longRunningApiClient.post(
        '/api/seo/enterprise/complete-audit',
        request
      );
      console.log('Enterprise audit response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error executing enterprise audit:', error);
      throw error;
    }
  },

  /**
   * Execute quick enterprise audit (faster version).
   * Backend QuickAuditRequest takes website_url only — no extra keys.
   */
  async executeQuickAudit(
    websiteUrl: string
  ): Promise<BaseResponse<EnterpriseAuditResult>> {
    try {
      const request = {
        website_url: websiteUrl,
      };

      console.log('Starting quick audit request:', request);
      const response = await longRunningApiClient.post(
        '/api/seo/enterprise/quick-audit',
        request
      );
      console.log('Quick audit response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error executing quick audit:', error);
      throw error;
    }
  },

  /**
   * Analyze GSC search performance with comprehensive insights
   */
  async analyzeGSCSearchPerformance(
    siteUrl: string,
    options?: {
      dateRangeDays?: number;
      includeOpportunities?: boolean;
      includeCompetitive?: boolean;
    }
  ): Promise<BaseResponse<GSCAnalysisResult>> {
    try {
      const request = {
        site_url: siteUrl,
        date_range_days: options?.dateRangeDays || 90,
        include_opportunities: options?.includeOpportunities ?? true,
        include_competitive: options?.includeCompetitive ?? true,
      };

      console.log('Starting GSC analysis request:', request);
      const response = await longRunningApiClient.post(
        '/api/seo/gsc/analyze-search-performance',
        request
      );
      console.log('GSC analysis response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error analyzing GSC search performance:', error);
      throw error;
    }
  },

  /**
   * Generate content opportunities report from GSC data
   */
  async getContentOpportunitiesReport(
    siteUrl: string,
    options?: {
      minImpressions?: number;
      dateRangeDays?: number;
    }
  ): Promise<BaseResponse<ContentOpportunitiesReport>> {
    try {
      const request = {
        site_url: siteUrl,
        min_impressions: options?.minImpressions || 100,
        date_range_days: options?.dateRangeDays || 90,
      };

      console.log('Starting content opportunities request:', request);
      const response = await longRunningApiClient.post(
        '/api/seo/gsc/content-opportunities',
        request
      );
      console.log('Content opportunities response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error getting content opportunities report:', error);
      throw error;
    }
  },

  /**
   * Phase 8D: ROI-scored strategy insights from GSC data (dashboard context).
   * Backend: GSCStrategyInsightsRequest — site_url + include_trends +
   * include_competitive + top_n (ge=5, le=100).
   */
  async getGSCStrategyInsights(
    siteUrl: string,
    options?: {
      includeTrends?: boolean;
      includeCompetitive?: boolean;
      topN?: number;
    }
  ): Promise<BaseResponse<any>> {
    try {
      const request = {
        site_url: siteUrl,
        include_trends: options?.includeTrends ?? true,
        include_competitive: options?.includeCompetitive ?? false,
        top_n: options?.topN || 20,
      };
      const response = await longRunningApiClient.post(
        '/api/seo/gsc/strategy-insights',
        request
      );
      return response.data;
    } catch (error) {
      console.error('Error getting GSC strategy insights:', error);
      throw error;
    }
  },

  /**
   * Phase 8D: ROI-ranked opportunities from GSC data.
   * Backend: GSCOpportunityRankingRequest — ranking_metric is
   * roi_score/effort/impact/timeline; limit ge=5 le=100.
   */
  async getGSCOpportunityRanking(
    siteUrl: string,
    options?: {
      rankingMetric?: string;
      limit?: number;
      severityFilter?: string;
    }
  ): Promise<BaseResponse<any>> {
    try {
      const request: Record<string, unknown> = {
        site_url: siteUrl,
        ranking_metric: options?.rankingMetric || 'roi_score',
        limit: options?.limit || 20,
      };
      if (options?.severityFilter) request.severity_filter = options.severityFilter;
      const response = await longRunningApiClient.post(
        '/api/seo/gsc/opportunity-ranking',
        request
      );
      return response.data;
    } catch (error) {
      console.error('Error getting GSC opportunity ranking:', error);
      throw error;
    }
  },

  /**
   * Phase 8D: GSC health score, trend, and keyword distribution.
   * Backend: GSCHealthMetricsRequest — NOTE the model explicitly dropped
   * trend comparison (needs historical snapshots that don't exist yet), so
   * no include_trends option is offered here.
   */
  async getGSCHealthMetrics(
    siteUrl: string,
    options?: {
      includeDistribution?: boolean;
    }
  ): Promise<BaseResponse<any>> {
    try {
      const request = {
        site_url: siteUrl,
        include_distribution: options?.includeDistribution ?? true,
      };
      const response = await longRunningApiClient.post(
        '/api/seo/gsc/health-metrics',
        request
      );
      return response.data;
    } catch (error) {
      console.error('Error getting GSC health metrics:', error);
      throw error;
    }
  },

  /**
   * Phase 8F: performance trend analysis over two equal-length GSC windows.
   * Backend: GSCTrendAnalysisRequest — metric is
   * position/impressions/clicks/ctr/all; days_back ge=7 le=365.
   */
  async getGSCPerformanceTrends(
    siteUrl: string,
    options?: {
      metric?: string;
      daysBack?: number;
    }
  ): Promise<BaseResponse<any>> {
    try {
      const request = {
        site_url: siteUrl,
        metric: options?.metric || 'all',
        days_back: options?.daysBack || 90,
      };
      const response = await longRunningApiClient.post(
        '/api/seo/gsc/trend-analysis',
        request
      );
      return response.data;
    } catch (error) {
      console.error('Error getting GSC performance trends:', error);
      throw error;
    }
  },

  /**
   * Check health of enterprise services
   */
  async checkServicesHealth(): Promise<BaseResponse<any>> {
    try {
      const response = await apiClient.get('/api/seo/enterprise/health');
      return response.data;
    } catch (error) {
      console.error('Error checking enterprise services health:', error);
      throw error;
    }
  },

  // Removed: the insight/traffic helpers that duplicated llmInsightsGenerator
  // canonicals with wrong paths and bodies. Use llmInsightsGenerator instead.
};
