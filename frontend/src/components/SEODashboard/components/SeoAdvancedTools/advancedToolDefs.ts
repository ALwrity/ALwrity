import { enterpriseSeoAPI } from '../../../../api/enterpriseSeoApi';
import { llmInsightsGenerator } from '../../../../api/llmInsightsGenerator';
import { seoApiService } from '../../../../services/seoApiService';

export interface AdvancedToolContext {
  websiteUrl: string;
  targetKeywords: string[];
  auditResult: any | null;
  gscResult: any | null;
}

export interface AdvancedToolDef {
  id: string;
  title: string;
  description: string;
  runLabel: string;
  /** Null means required context is missing — card renders disabled, no fabrication. */
  buildPayload: (ctx: AdvancedToolContext) => Record<string, unknown> | null;
  missingHint: string;
  run: (payload: Record<string, any>) => Promise<unknown>;
}

const hasContext = (ctx: AdvancedToolContext): boolean =>
  !!ctx.auditResult || !!ctx.gscResult;

const recommendationsFrom = (ctx: AdvancedToolContext): Record<string, unknown>[] => {
  const out: Record<string, unknown>[] = [];
  const summary = ctx.auditResult?.executive_summary;
  for (const text of summary?.top_opportunities ?? []) {
    out.push({ recommendation: text, priority: 'high' });
  }
  for (const text of summary?.critical_issues ?? []) {
    out.push({ recommendation: text, priority: 'critical' });
  }
  return out;
};

// Advanced enterprise/GSC/LLM tools as user-fired cards (Phase D). Every tool
// maps to an already-wired backend endpoint; payloads are prefilled from live
// audit/GSC context and editable before firing. Nothing is fabricated: cards
// stay disabled until their required context exists.
export const ADVANCED_TOOL_DEFS: AdvancedToolDef[] = [
  {
    id: 'quick-audit',
    title: 'Quick Audit',
    description: 'Fast 5-minute enterprise audit for the site URL.',
    runLabel: 'Run Quick Audit',
    buildPayload: (ctx) => (ctx.websiteUrl ? { website_url: ctx.websiteUrl } : null),
    missingHint: 'Enter a site URL first.',
    run: (payload) =>
      enterpriseSeoAPI.executeQuickAudit(String(payload.website_url)),
  },
  {
    id: 'content-opportunities',
    title: 'Content Opportunities',
    description: 'GSC-backed opportunities: positions 4–10, low CTR, long-tail.',
    runLabel: 'Run Content Opportunities',
    buildPayload: (ctx) =>
      ctx.websiteUrl
        ? {
            site_url: ctx.websiteUrl,
            min_impressions: 100,
            date_range_days: 90,
          }
        : null,
    missingHint: 'Enter a site URL first.',
    run: (payload) =>
      enterpriseSeoAPI.getContentOpportunitiesReport(String(payload.site_url), {
        minImpressions: Number(payload.min_impressions) || 100,
        dateRangeDays: Number(payload.date_range_days) || 90,
      }),
  },
  // Phase 8D: the previously-unreachable GSC endpoints (strategy-insights,
  // opportunity-ranking, health-metrics) become user-fired cards. Gate =
  // site URL only, matching their backend models (no audit context needed).
  {
    id: 'gsc-strategy-insights',
    title: 'Strategy Insights',
    description: 'ROI-scored strategy insights from GSC data (0–100, severity-labeled).',
    runLabel: 'Run Strategy Insights',
    buildPayload: (ctx) =>
      ctx.websiteUrl
        ? {
            site_url: ctx.websiteUrl,
            include_trends: true,
            include_competitive: false,
            top_n: 20,
          }
        : null,
    missingHint: 'Enter a site URL first.',
    run: (payload) =>
      enterpriseSeoAPI.getGSCStrategyInsights(String(payload.site_url), {
        includeTrends: Boolean(payload.include_trends),
        includeCompetitive: Boolean(payload.include_competitive),
        topN: Number(payload.top_n) || 20,
      }),
  },
  {
    id: 'gsc-opportunity-ranking',
    title: 'Opportunity Ranking',
    description: 'ROI-ranked opportunities (roi_score/effort/impact/timeline).',
    runLabel: 'Run Opportunity Ranking',
    buildPayload: (ctx) =>
      ctx.websiteUrl
        ? {
            site_url: ctx.websiteUrl,
            ranking_metric: 'roi_score',
            limit: 20,
          }
        : null,
    missingHint: 'Enter a site URL first.',
    run: (payload) =>
      enterpriseSeoAPI.getGSCOpportunityRanking(String(payload.site_url), {
        rankingMetric: String(payload.ranking_metric || 'roi_score'),
        limit: Number(payload.limit) || 20,
      }),
  },
  {
    id: 'gsc-health-metrics',
    title: 'Health Metrics',
    description: 'GSC health score, keyword position distribution, averages.',
    runLabel: 'Run Health Metrics',
    buildPayload: (ctx) =>
      ctx.websiteUrl
        ? {
            site_url: ctx.websiteUrl,
            include_distribution: true,
          }
        : null,
    missingHint: 'Enter a site URL first.',
    run: (payload) =>
      enterpriseSeoAPI.getGSCHealthMetrics(String(payload.site_url), {
        includeDistribution: payload.include_distribution !== false,
      }),
  },
  {
    id: 'gsc-trend-analysis',
    title: 'Trend Analysis',
    description: 'Clicks/impressions/CTR/position vs the previous equal-length window.',
    runLabel: 'Run Trend Analysis',
    buildPayload: (ctx) =>
      ctx.websiteUrl
        ? {
            site_url: ctx.websiteUrl,
            metric: 'all',
            days_back: 90,
          }
        : null,
    missingHint: 'Enter a site URL first.',
    run: (payload) =>
      enterpriseSeoAPI.getGSCPerformanceTrends(String(payload.site_url), {
        metric: String(payload.metric || 'all'),
        daysBack: Number(payload.days_back) || 90,
      }),
  },
  // Phase 8E: the /api/seo/workflow/* endpoints (previously service-only with
  // zero UI callers) become user-fired cards through the existing
  // seoApiService functions — no API-module duplication. Gate = site URL only.
  {
    id: 'workflow-website-audit',
    title: 'Website Audit Workflow',
    description: 'Full website-audit workflow: comprehensive with recommendations.',
    runLabel: 'Run Website Audit Workflow',
    buildPayload: (ctx) =>
      ctx.websiteUrl
        ? {
            url: ctx.websiteUrl,
            audit_type: 'comprehensive',
            include_recommendations: true,
          }
        : null,
    missingHint: 'Enter a site URL first.',
    run: (payload) =>
      seoApiService.performWebsiteAudit(String(payload.url), {
        audit_type: String(payload.audit_type || 'comprehensive'),
        include_recommendations: payload.include_recommendations !== false,
      }),
  },
  {
    id: 'workflow-content-analysis',
    title: 'Content Analysis Workflow',
    description: 'Content strategy analysis for the site (gaps, clusters, performance).',
    runLabel: 'Run Content Analysis Workflow',
    buildPayload: (ctx) =>
      ctx.websiteUrl
        ? {
            url: ctx.websiteUrl,
            seo_optimization: true,
          }
        : null,
    missingHint: 'Enter a site URL first.',
    run: (payload) =>
      seoApiService.analyzeContentComprehensive(String(payload.url), {
        // content_focus is intentionally unset unless the user edits the
        // payload — nothing is fabricated.
        ...(payload.content_focus ? { content_focus: payload.content_focus } : {}),
        seo_optimization: payload.seo_optimization !== false,
      }),
  },
  {
    id: 'quick-wins',
    title: 'Quick Wins',
    description: 'LLM quick wins from the latest audit data.',
    runLabel: 'Run Quick Wins',
    buildPayload: (ctx) =>
      hasContext(ctx)
        ? { audit_data: ctx.auditResult ?? ctx.gscResult, max_days_to_implement: 7 }
        : null,
    missingHint: 'Run an enterprise audit or GSC analysis first.',
    run: (payload) =>
      llmInsightsGenerator.generateQuickWins(
        payload.audit_data as Record<string, unknown>,
        Number(payload.max_days_to_implement) || 7,
      ),
  },
  {
    id: 'prioritized',
    title: 'Prioritized Recommendations',
    description: 'Rank improvements by impact vs effort with business context.',
    runLabel: 'Run Prioritized Recommendations',
    buildPayload: (ctx) =>
      hasContext(ctx)
        ? {
            all_recommendations: recommendationsFrom(ctx),
            business_context: { goal: 'Increase organic traffic' },
          }
        : null,
    missingHint: 'Run an enterprise audit or GSC analysis first.',
    run: (payload) =>
      llmInsightsGenerator.generatePrioritizedRecommendations(
        payload.all_recommendations as Record<string, unknown>[],
        payload.business_context as Record<string, unknown>,
      ),
  },
  {
    id: 'keyword-expansion',
    title: 'Keyword Expansion',
    description: 'Long-tail and semantic variants for target keywords.',
    runLabel: 'Run Keyword Expansion',
    buildPayload: (ctx) =>
      ctx.targetKeywords.length > 0 && hasContext(ctx)
        ? {
            current_keywords: ctx.targetKeywords,
            content_analysis: ctx.gscResult ?? ctx.auditResult,
          }
        : null,
    missingHint: 'Add target keywords and run an analysis first.',
    run: (payload) =>
      llmInsightsGenerator.generateKeywordExpansion(
        payload.current_keywords as string[],
        payload.content_analysis as Record<string, unknown>,
      ),
  },
  {
    id: 'traffic-roadmap',
    title: 'Traffic Roadmap',
    description: 'Phased traffic improvement plan with KPIs.',
    runLabel: 'Run Traffic Roadmap',
    buildPayload: (ctx) =>
      hasContext(ctx)
        ? {
            current_metrics: { site_url: ctx.websiteUrl },
            identified_opportunities: recommendationsFrom(ctx),
            implementation_timeline_weeks: 12,
          }
        : null,
    missingHint: 'Run an enterprise audit or GSC analysis first.',
    run: (payload) =>
      llmInsightsGenerator.generateTrafficRoadmap({
        currentMetrics: payload.current_metrics as Record<string, unknown>,
        opportunities: (payload.identified_opportunities ?? []) as Record<string, unknown>[],
        timelineWeeks: Number(payload.implementation_timeline_weeks) || 12,
      }),
  },
  {
    id: 'content-strategy',
    title: 'Content Strategy',
    description: 'Content ideas, gaps, and calendar from strategy analysis.',
    runLabel: 'Run Content Strategy',
    buildPayload: (ctx) =>
      ctx.targetKeywords.length > 0
        ? {
            current_content: ctx.gscResult ?? ctx.auditResult ?? {},
            content_gaps: [],
            target_keywords: ctx.targetKeywords,
          }
        : null,
    missingHint: 'Add target keywords first (edit gaps as needed).',
    run: (payload) =>
      llmInsightsGenerator.generateContentStrategy({
        currentContent: payload.current_content as Record<string, unknown>,
        contentGaps: (payload.content_gaps ?? []) as string[],
        targetKeywords: payload.target_keywords as string[],
        competitorContent: payload.competitor_content as Record<string, unknown> | undefined,
      }),
  },
  {
    id: 'competitive',
    title: 'Competitive Insights',
    description: 'Advantages, gaps, and threats vs competitors.',
    runLabel: 'Run Competitive Insights',
    buildPayload: (ctx) =>
      hasContext(ctx)
        ? {
            primary_site_analysis: ctx.auditResult ?? ctx.gscResult,
            competitor_analyses: [],
          }
        : null,
    missingHint: 'Run an enterprise audit or GSC analysis first.',
    run: (payload) =>
      llmInsightsGenerator.generateCompetitiveInsights(
        payload.primary_site_analysis as Record<string, unknown>,
        (payload.competitor_analyses ?? []) as Record<string, unknown>[],
      ),
  },
];
