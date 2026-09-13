/**
 * LLM Insights Generator Service
 * Generates actionable, business-focused insights from SEO audit and analysis data
 * Uses LLM prompts to provide personalized, traffic-focused recommendations
 */

import { apiClient, longRunningApiClient } from './client';
import {
  EnterpriseAuditResult,
  GSCAnalysisResult,
  AIInsight,
  ContentOpportunity,
  KeywordAnalysis,
} from './enterpriseSeoApi';

export interface ActionableInsight {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'easy' | 'medium' | 'complex';
  timeToImplement: string;
  estimatedTrafficGain: number;
  steps: string[];
  tools?: string[];
  priority: number; // 1-10, where 10 is highest priority
}

export interface TrafficImprovementStrategy {
  phase: 'quick_wins' | 'medium_term' | 'long_term';
  title: string;
  description: string;
  targetKeywords: string[];
  estimatedTrafficGain: number;
  timeframe: string;
  keyActions: string[];
  expectedROI: string;
}

export interface InsightGenerationResult {
  insights: AIInsight[];
  actionableInsights: ActionableInsight[];
  trafficStrategies: TrafficImprovementStrategy[];
  summary: string;
}

class LLMInsightsGenerator {
  /**
   * Generate actionable insights from enterprise audit results
   * Focuses on traffic improvement and conversion opportunities
   */
  async generateEnterpriseAuditInsights(
    auditResult: EnterpriseAuditResult,
    websiteUrl: string,
    websiteContext?: {
      currentMonthlyTraffic?: number;
      targetAudience?: string;
      primaryGoal?: string;
      budget?: 'startup' | 'small' | 'medium' | 'enterprise';
      targetKeywords?: string[];
    }
  ): Promise<InsightGenerationResult> {
    try {
      // Note: buildAuditInsightPrompt is a client-side preview helper; the
      // backend generates insights from the payload below (prompt not sent).
      // Body matches backend EnterpriseAuditInsightsRequest (fail fast on 422).
      const response = await apiClient.post('/api/seo/llm/generate-audit-insights', {
        audit_results: auditResult,
        website_url: websiteUrl,
        target_keywords: websiteContext?.targetKeywords,
      });

      return response.data;
    } catch (error) {
      console.error('Error generating audit insights:', error);
      throw error;
    }
  }

  /**
   * Generate actionable insights from GSC analysis results
   * Focuses on quick wins and keyword optimization
   */
  async generateGSCAnalysisInsights(
    analysisResult: GSCAnalysisResult,
    websiteUrl: string
  ): Promise<InsightGenerationResult> {
    try {
      // Backend GSCAnalysisInsightsRequest takes only gsc_analysis + website_url.
      // Body matches backend GSCAnalysisInsightsRequest.
      const response = await apiClient.post('/api/seo/llm/generate-gsc-insights', {
        gsc_analysis: analysisResult,
        website_url: websiteUrl,
      });

      return response.data;
    } catch (error) {
      console.error('Error generating GSC insights:', error);
      throw error;
    }
  }

  /**
   * Generate content strategy recommendations
   * Provides specific content ideas and gaps to address
   */
  async generateContentStrategy(
    params: {
      currentContent: Record<string, unknown>;
      contentGaps: string[];
      targetKeywords: string[];
      competitorContent?: Record<string, unknown>;
    }
  ): Promise<{
    contentIdeas: string[];
    gapAnalysis: string[];
    prioritizedTopics: { topic: string; estimatedTraffic: number; difficulty: string }[];
    contentCalendar: {
      month: string;
      topics: string[];
      expectedTraffic: number;
    }[];
  }> {
    try {
      // Body matches backend ContentStrategyRequest (all required keys sent).
      const response = await apiClient.post('/api/seo/llm/generate-content-strategy', {
        current_content: params.currentContent,
        content_gaps: params.contentGaps,
        target_keywords: params.targetKeywords,
        competitor_content: params.competitorContent,
      });

      return response.data;
    } catch (error) {
      console.error('Error generating content strategy:', error);
      throw error;
    }
  }

  /**
   * Generate traffic improvement roadmap
   * Provides phased approach to increasing organic traffic
   */
  async generateTrafficRoadmap(
    params: {
      currentMetrics: Record<string, unknown>;
      opportunities: Record<string, unknown>[];
      timelineWeeks?: number;
    }
  ): Promise<{
    currentTraffic: number;
    targetTraffic: number;
    timeframe: string;
    phases: TrafficImprovementStrategy[];
    keyMetrics: {
      metric: string;
      baseline: number;
      target: number;
      unit: string;
    }[];
    risks: string[];
    opportunities: string[];
  }> {
    try {
      // Body matches backend TrafficRoadmapRequest (weeks clamped 4-52 server-side).
      const response = await apiClient.post('/api/seo/llm/generate-traffic-roadmap', {
        current_metrics: params.currentMetrics,
        identified_opportunities: params.opportunities,
        implementation_timeline_weeks: params.timelineWeeks ?? 12,
      });

      return response.data;
    } catch (error) {
      console.error('Error generating traffic roadmap:', error);
      throw error;
    }
  }

  /**
   * Generate priority-ranked recommendations
   * Ranks all possible improvements by impact vs effort
   */
  async generatePrioritizedRecommendations(
    recommendations: Record<string, unknown>[],
    businessContext: Record<string, unknown>
  ): Promise<ActionableInsight[]> {
    try {
      // Body matches backend PrioritizedRecommendationsRequest.
      const response = await apiClient.post('/api/seo/llm/prioritized-recommendations', {
        all_recommendations: recommendations,
        business_context: businessContext,
      });

      return response.data.recommendations || [];
    } catch (error) {
      console.error('Error generating prioritized recommendations:', error);
      throw error;
    }
  }

  /**
   * Generate quick wins recommendations
   * Focus on 1-2 week implementation timeline
   */
  async generateQuickWins(
    auditData: Record<string, unknown>,
    maxDays: number = 7
  ): Promise<ActionableInsight[]> {
    try {
      // Body matches backend QuickWinsRequest (days clamped 1-30 server-side).
      const response = await apiClient.post('/api/seo/llm/quick-wins', {
        audit_data: auditData,
        max_days_to_implement: maxDays,
      });

      return response.data.insights || [];
    } catch (error) {
      console.error('Error generating quick wins:', error);
      throw error;
    }
  }

  /**
   * Generate competitive positioning insights
   * Helps understand how to outrank competitors
   */
  async generateCompetitiveInsights(
    primarySiteAnalysis: Record<string, unknown>,
    competitorAnalyses: Record<string, unknown>[]
  ): Promise<{
    positioning: string;
    whiteSpaceOpportunities: string[];
    competitiveAdvantages: string[];
    recommendedActions: string[];
  }> {
    try {
      // Body matches backend CompetitiveInsightsRequest.
      const response = await apiClient.post('/api/seo/llm/generate-competitive-insights', {
        primary_site_analysis: primarySiteAnalysis,
        competitor_analyses: competitorAnalyses,
      });

      return response.data;
    } catch (error) {
      console.error('Error generating competitive insights:', error);
      throw error;
    }
  }

  /**
   * Generate keyword expansion recommendations
   * Helps find related keywords and long-tail opportunities
   */
  async generateKeywordExpansion(
    targetKeywords: string[],
    contentAnalysis: Record<string, unknown>,
    targetDifficulty?: 'low' | 'medium' | 'high'
  ): Promise<{
    expandedKeywords: KeywordAnalysis[];
    longTailVariations: string[];
    relatedSearches: string[];
    semanticVariations: string[];
    recommendedContent: string[];
  }> {
    try {
      // Body matches backend KeywordExpansionRequest (content_analysis required).
      const response = await apiClient.post('/api/seo/llm/keyword-expansion', {
        current_keywords: targetKeywords,
        content_analysis: contentAnalysis,
        target_difficulty: targetDifficulty,
      });

      return response.data;
    } catch (error) {
      console.error('Error generating keyword expansion:', error);
      throw error;
    }
  }

  // Removed: generateContentOptimization + generateTechnicalImprovementPlan.
  // No backend routes exist for these (verified route table) and no callers.
  // Re-add alongside a backend endpoint if the features are planned.

  // ============================================================================
  // Helper Methods - Prompt Building
  // ============================================================================

  private buildAuditInsightPrompt(
    auditResult: EnterpriseAuditResult,
    context?: any
  ): string {
    return `
As an expert SEO strategist, analyze this enterprise audit and provide actionable, traffic-focused insights.

AUDIT DATA:
- Overall Score: ${auditResult.executive_summary.overall_score}/100
- Traffic Potential: ${auditResult.executive_summary.estimated_traffic_potential}
- Critical Issues: ${auditResult.executive_summary.critical_issues.length}
- Top Opportunities: ${auditResult.executive_summary.top_opportunities.join('; ')}

WEBSITE CONTEXT:
- Current Monthly Traffic: ${context?.currentMonthlyTraffic || 'Unknown'}
- Target Audience: ${context?.targetAudience || 'Not specified'}
- Primary Goal: ${context?.primaryGoal || 'Increase organic traffic'}
- Budget Level: ${context?.budget || 'Not specified'}

TASK:
1. Generate 5-7 high-impact, actionable insights (prioritize quick wins first)
2. For each insight, provide:
   - Clear title and description
   - Expected traffic impact (number or percentage)
   - Implementation difficulty (easy/medium/complex)
   - Estimated time to implement
   - Step-by-step implementation guide

3. Identify the top 3 traffic improvement strategies with specific, measurable outcomes
4. Provide competitive positioning recommendations
5. Highlight any urgent/critical items that need immediate attention

Focus on traffic improvement and revenue impact. Make recommendations specific and actionable, not generic.
Return structured JSON with insights array containing objects with: title, description, impact, effort, timeToImplement, estimatedTraffic, steps[], priority (1-10).
    `;
  }

  private buildGSCInsightPrompt(
    analysisResult: GSCAnalysisResult,
    context?: any
  ): string {
    return `
As an expert SEO strategist specializing in GSC optimization, analyze this search performance data and provide traffic-focused recommendations.

SEARCH PERFORMANCE DATA:
- Total Clicks: ${analysisResult.performance_overview.clicks}
- Total Impressions: ${analysisResult.performance_overview.impressions}
- Average CTR: ${(analysisResult.performance_overview.ctr * 100).toFixed(2)}%
- Average Position: ${analysisResult.performance_overview.avg_position}
- Content Opportunities: ${analysisResult.content_opportunities.length}

KEYWORD DATA:
- Top Keywords: ${analysisResult.keyword_analysis.top_performers.slice(0, 3).map(k => k.keyword).join(', ')}
- Keywords Ready for Improvement: ${analysisResult.keyword_analysis.opportunities.length}
- Declining Keywords: ${analysisResult.keyword_analysis.declining_keywords.length}

WEBSITE CONTEXT:
- Current Monthly Traffic: ${context?.currentMonthlyTraffic || 'Unknown'}
- Target Keywords: ${context?.targetKeywords?.join(', ') || 'Not specified'}
- Primary Goal: ${context?.primaryGoal || 'Increase click-through rate'}

TASK:
1. Identify 5-10 high-potential opportunities for traffic growth
2. Prioritize by: (a) Current position (rank 4-10), (b) Volume, (c) CTR improvement potential

3. For each top opportunity, provide:
   - Keyword and current metrics
   - Specific on-page optimization recommendations
   - Estimated traffic gain
   - Implementation timeframe

4. Generate quick wins (things that can be done in 1-2 weeks)
5. Identify any technical SEO issues affecting CTR or rankings
6. Provide long-tail keyword expansion opportunities

Focus on practical, measurable improvements to clicks and rankings.
Return structured JSON with insights array and trafficStrategies array.
    `;
  }
}

// Export singleton instance
export const llmInsightsGenerator = new LLMInsightsGenerator();

// For React component usage
export { LLMInsightsGenerator };
