// SiteAnalyticsService - Golden Backend Tests (real SEOAnalysisData contract)
// Realigned service derives analytics from the real SEOAnalysisData shape
// (health_score, critical_issues, traffic_metrics, ranking_data, mobile_speed,
// keyword_data). No fabricated fields and no mock/random metrics.

import SiteAnalyticsService from '../siteAnalyticsService';
import type { SEOAnalysisData } from '../../types/seoCopilotTypes';
import { seoApiService } from '../seoApiService';
import { apiClient } from '../../api/client';
import type { Mock } from 'vitest';

vi.mock('../../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const buildAnalysisData = (overrides: Partial<SEOAnalysisData> = {}): SEOAnalysisData => ({
  health_score: 72,
  url: 'https://example.com',
  last_updated: new Date().toISOString(),
  status: 'completed',
  critical_issues: [
    {
      id: 'iss-1',
      title: 'Missing meta descriptions',
      description: 'Several pages lack meta descriptions',
      severity: 'high',
      category: 'content',
      impact: 'Reduced click-through rate',
      recommendation: 'Add unique meta descriptions to all pages',
      effort: 'easy',
      priority: 8,
    },
    {
      id: 'iss-2',
      title: 'Slow LCP on mobile',
      description: 'Largest contentful paint exceeds 4.0s',
      severity: 'critical',
      category: 'performance',
      impact: 'Poor Core Web Vitals and rankings',
      recommendation: 'Optimize hero images and enable lazy loading',
      effort: 'medium',
      priority: 9,
    },
  ],
  traffic_metrics: {
    organic_traffic: 15400,
    traffic_growth: 18.5,
    top_pages: [
      { url: 'https://example.com/', traffic: 4200, growth: 22 },
      { url: 'https://example.com/services', traffic: 3100, growth: 15 },
      { url: 'https://example.com/blog/seo-guide', traffic: 2200, growth: 41 },
    ],
    traffic_sources: [
      { source: 'organic', traffic: 9800, percentage: 63.6 },
      { source: 'direct', traffic: 3200, percentage: 20.8 },
    ],
  },
  ranking_data: {
    average_position: 11.4,
    ranking_keywords: [
      { keyword: 'seo audit tool', position: 4, volume: 2900, difficulty: 42 },
      { keyword: 'website analyzer', position: 7, volume: 1800, difficulty: 38 },
      { keyword: 'on page seo checker', position: 19, volume: 1100, difficulty: 51 },
    ],
    position_changes: [
      { keyword: 'seo audit tool', old_position: 9, new_position: 4, change: 5 },
    ],
  },
  mobile_speed: {
    mobile_score: 61,
    desktop_score: 88,
    load_time: 3.2,
    core_web_vitals: { lcp: 4.1, fid: 120, cls: 0.11 },
  },
  keyword_data: {
    total_keywords: 240,
    ranking_keywords: 86,
    keyword_opportunities: [
      { keyword: 'free seo analysis', volume: 5200, difficulty: 45, opportunity_score: 82 },
      { keyword: 'seo site checker', volume: 3600, difficulty: 41, opportunity_score: 76 },
    ],
  },
  ...overrides,
});

describe('SiteAnalyticsService — real SEOAnalysisData contract', () => {
  let service: SiteAnalyticsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SiteAnalyticsService({ enable_real_time_updates: false });
  });

  afterEach(() => {
    service.cleanup();
  });

  it('derives a snapshot strictly from real SEOAnalysisData fields', async () => {
    const snapshot = await service.createSnapshot('https://example.com', buildAnalysisData());

    expect(snapshot.url).toBe('https://example.com');
    expect(snapshot.health_score).toBe(72);
    expect(snapshot.performance_metrics.seo_score).toBeGreaterThanOrEqual(0);
    expect(snapshot.performance_metrics.seo_score).toBeLessThanOrEqual(100);
    expect(snapshot.technical_analysis.indexability_score).toBeGreaterThanOrEqual(0);
    expect(snapshot.content_analysis.quality_score).toBeGreaterThanOrEqual(0);
    expect(snapshot.competitive_insights.traffic_estimation).toBe(15400);
    expect(snapshot.trends_analysis.engagement_trend).toBe('stable');
    expect(Array.isArray(snapshot.recommendations)).toBe(true);
    expect(snapshot.recommendations.length).toBeGreaterThan(0);
    expect(typeof snapshot.timestamp).toBe('string');
    expect(new Date(snapshot.timestamp)).toBeInstanceOf(Date);
  });

  it('flags a low health score with a critical alert using real thresholds', async () => {
    const data = buildAnalysisData({ health_score: 45 });
    const snapshot = await service.createSnapshot('https://example.com', data);
    const alerts = service.getAlertsForSnapshot(snapshot);

    expect(alerts.length).toBeGreaterThan(0);
    const healthAlert = alerts.find(a => a.type === 'health');
    expect(healthAlert).toBeDefined();
    expect(healthAlert?.severity).toBe('critical');
    expect(healthAlert?.message).toContain('45');
  });

  it('counts critical issues by severity and category from real issues', async () => {
    const snapshot = await service.createSnapshot('https://example.com', buildAnalysisData());

    expect(snapshot.critical_issues_count).toBe(2);
    const categoryCounts = snapshot.issue_counts.by_category;
    expect(categoryCounts).toHaveProperty('performance', 1);
    expect(categoryCounts).toHaveProperty('content', 1);
    const severityCounts = snapshot.issue_counts.by_severity;
    expect(severityCounts).toHaveProperty('critical', 1);
    expect(severityCounts).toHaveProperty('high', 1);
  });

  it('surfaces page speed recommendations for slow mobile when real LCP is poor', async () => {
    const snapshot = await service.createSnapshot('https://example.com', buildAnalysisData());

    expect(snapshot.performance_metrics.page_speed.mobile).toBe(61);
    const speedRecommendation = snapshot.recommendations.find(r =>
      r.toLowerCase().includes('core web vitals') ||
      r.toLowerCase().includes('lcp')
    );
    expect(speedRecommendation).toBeDefined();
  });

  it('stores and retrieves historical snapshots within retention window', async () => {
    const data = buildAnalysisData();
    const first = await service.analyzeSite('https://example.com', data, true);
    const second = await service.analyzeSite('https://example.com', buildAnalysisData(), true);
    expect(first.id).not.toBe(second.id);

    const history = await service.getHistoricalAnalytics('https://example.com', 30);
    expect(history.length).toBeGreaterThanOrEqual(2);

    const latest = await service.getSiteAnalytics('https://example.com');
    expect(latest?.id).toBe(second.id);
  });

  it('does not derive metrics from fabricated fields or randomness', async () => {
    const data = buildAnalysisData();
    const snapshotA = await service.createSnapshot('https://example.com', data);
    const snapshotB = await service.createSnapshot('https://example.com', data);

    expect(snapshotA.performance_metrics.conversion_rate).toBe(snapshotB.performance_metrics.conversion_rate);
    expect(snapshotA.performance_metrics.bounce_rate).toBe(snapshotB.performance_metrics.bounce_rate);
    expect(snapshotA.competitive_insights.ranking_distribution.top_3).toBe(0);
  });

  it('can fetch and analyze a real site through seoApiService', async () => {
    (apiClient.post as Mock).mockResolvedValue({ data: buildAnalysisData() });

    const snapshot = await service.analyzeWebsite('https://example.com');

    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/seo-dashboard/analyze-comprehensive',
      expect.objectContaining({ url: 'https://example.com' }),
      expect.anything(),
    );
    expect(snapshot.health_score).toBe(72);
  });

  it('reports analytics stats across snapshots', async () => {
    await service.analyzeSite('https://example.com', buildAnalysisData(), true);
    const stats = service.getAnalyticsStats();

    expect(stats.total_urls).toBe(1);
    expect(stats.total_snapshots).toBe(1);
    expect(stats.active_alerts).toBe(0);
  });
});