// RouteExplainerService - Golden Backend Tests
// Explains site routes strictly from real SEOAnalysisData fields:
// traffic_metrics.top_pages (url/traffic/growth), ranking_data,
// mobile_speed and critical_issues. No fabricated per-route data.

import RouteExplainerService, {
  RouteExplanation,
  RouteSummary,
} from '../routeExplainerService';
import type { SEOAnalysisData } from '../../types/seoCopilotTypes';

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
      description: 'LCP exceeds 4.0s',
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
      { url: 'https://example.com/services', traffic: 3100, growth: -8 },
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
    position_changes: [],
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
    ],
  },
  ...overrides,
});

describe('RouteExplainerService — real SEOAnalysisData routes', () => {
  const service = new RouteExplainerService();

  it('explains every real top page route deterministically', async () => {
    const routes = await service.explainRoutes(buildAnalysisData());

    expect(routes.length).toBe(3);
    const urls = routes.map(r => r.url);
    expect(urls).toContain('https://example.com/');
    expect(urls).toContain('https://example.com/services');
    expect(urls).toContain('https://example.com/blog/seo-guide');

    routes.forEach(route => {
      expect(route.traffic_share).toBeGreaterThan(0);
      expect(route.traffic_share).toBeLessThanOrEqual(100);
      expect(route.traffic).toBeGreaterThan(0);
      expect(['high', 'developing', 'underperforming']).toContain(route.performance_band);
      expect(['critical', 'high', 'medium', 'low']).toContain(route.priority);
      expect(typeof route.recommendation).toBe('string');
      expect(route.recommendation.length).toBeGreaterThan(5);
    });
  });

  it('classifies growing routes as high priority / underperformers correctly', async () => {
    const routes = await service.explainRoutes(buildAnalysisData());

    const home = routes.find(r => r.url === 'https://example.com/')!;
    const services = routes.find(r => r.url === 'https://example.com/services')!;
    const guide = routes.find(r => r.url === 'https://example.com/blog/seo-guide')!;

    expect(guide.performance_band).toBe('high');
    expect(guide.priority).toBe('high');
    expect(services.performance_band).toBe('underperforming');
    expect(services.recommendation.toLowerCase()).toContain('met');
  });

  it('computes traffic share as a percentage of organic traffic', async () => {
    const routes = await service.explainRoutes(buildAnalysisData());
    const total = routes.reduce((sum, r) => sum + r.traffic, 0);
    expect(total).toBeCloseTo(9500, 0);

    const home = routes.find(r => r.url === 'https://example.com/')!;
    const expectedShare = (4200 / 15400) * 100;
    expect(home.traffic_share).toBeCloseTo(expectedShare, 1);
  });

  it('grades page speed from real mobile/desktop scores', async () => {
    const routes = await service.explainRoutes(buildAnalysisData());
    // mobile_speed: mobile 61, desktop 88 → average 74.5 → 'medium'
    routes.forEach(route => {
      expect(route.page_speed_grade).toBe('medium');
    });
  });

  it('derives the issue burden from real critical_issues', async () => {
    const routes = await service.explainRoutes(buildAnalysisData());
    const summary = await service.summarizeRoutes(buildAnalysisData());

    expect(summary.critical_issue_count).toBe(1);
    expect(summary.critical_issue_count).toBeGreaterThan(0);
    expect(summary.total_routes).toBe(3);
  });

  it('explains a single route by URL', async () => {
    const route = await service.explainRoute(
      buildAnalysisData(),
      'https://example.com/services',
    );

    expect(route).not.toBeNull();
    expect(route!.url).toBe('https://example.com/services');
    expect(route!.traffic).toBe(3100);
  });

  it('returns null for unknown routes', async () => {
    const route = await service.explainRoute(
      buildAnalysisData(),
      'https://example.com/does-not-exist',
    );
    expect(route).toBeNull();
  });

  it('recommends fixing critical issues across the site when present', async () => {
    const summary = await service.summarizeRoutes(buildAnalysisData());
    expect(summary.focus_recommendations.length).toBeGreaterThan(0);
    expect(summary.focus_recommendations.some(r => r.includes('Core Web Vitals'))).toBe(true);
  });

  it('handles empty top pages gracefully', async () => {
    const data = buildAnalysisData({
      traffic_metrics: {
        organic_traffic: 0,
        traffic_growth: 0,
        top_pages: [],
        traffic_sources: [],
      },
    });

    const routes = await service.explainRoutes(data);
    expect(routes).toEqual([]);

    const summary = await service.summarizeRoutes(data);
    expect(summary.total_routes).toBe(0);
    expect(typeof summary.overall_status).toBe('string');
  });
});