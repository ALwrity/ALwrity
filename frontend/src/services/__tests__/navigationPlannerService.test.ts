// NavigationPlannerService - Golden Backend Tests
// Plans internal-link navigation strictly from real SEOAnalysisData fields:
// traffic_metrics.top_pages (routes), keyword_data.keyword_opportunities and
// ranking_data.ranking_keywords (cannibalization). No fabricated site graph.

import NavigationPlannerService from '../navigationPlannerService';
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
  ],
  traffic_metrics: {
    organic_traffic: 15400,
    traffic_growth: 18.5,
    top_pages: [
      { url: 'https://example.com/', traffic: 4200, growth: 22 },
      { url: 'https://example.com/services', traffic: 3100, growth: -8 },
      { url: 'https://example.com/blog/seo-guide', traffic: 2200, growth: 41 },
    ],
    traffic_sources: [],
  },
  ranking_data: {
    average_position: 8.6,
    ranking_keywords: [
      { keyword: 'seo audit tool', position: 4, volume: 2900, difficulty: 42 },
      { keyword: 'seo analysis tool', position: 6, volume: 2400, difficulty: 45 },
      { keyword: 'website analyzer', position: 7, volume: 1800, difficulty: 38 },
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
      { keyword: 'seo site checker', volume: 3600, difficulty: 41, opportunity_score: 76 },
      { keyword: 'content gap analysis', volume: 1200, difficulty: 30, opportunity_score: 61 },
    ],
  },
  ...overrides,
});

describe('NavigationPlannerService — real SEOAnalysisData navigation', () => {
  const service = new NavigationPlannerService();

  it('generates a deterministic navigation plan from real routes', async () => {
    const plan = await service.planNavigation(buildAnalysisData());

    expect(plan.site_url).toBe('https://example.com');
    expect(plan.link_recommendations.length).toBeGreaterThan(0);
    expect(plan.navigation_structure.length).toBeGreaterThan(0);
    expect(plan.summary).toBeDefined();

    plan.link_recommendations.forEach(rec => {
      expect(rec.source_url.startsWith('http')).toBe(true);
      expect(rec.target_url.startsWith('http')).toBe(true);
      expect(typeof rec.anchor_text).toBe('string');
      expect(['high', 'medium', 'low']).toContain(rec.priority);
      expect(typeof rec.rationale).toBe('string');
    });
  });

  it('routes each keyword opportunity to the most relevant real route', async () => {
    const plan = await service.planNavigation(buildAnalysisData());
    const keywords = plan.link_recommendations.map(r => r.keyword);

    expect(keywords).toContain('free seo analysis');
    expect(keywords).toContain('seo site checker');

    // 'seo' appears in the blog route URL → highest-opportunity keyword targets it.
    const top = plan.link_recommendations.find(r => r.keyword === 'free seo analysis')!;
    expect(top.target_url).toContain('seo-guide');
  });

  it('prioritizes higher opportunity keywords as high priority links', async () => {
    const plan = await service.planNavigation(buildAnalysisData());

    const high = plan.link_recommendations.filter(r => r.priority === 'high');
    expect(high.length).toBeGreaterThan(0);

    const topKeyword = plan.link_recommendations.find(r => r.keyword === 'free seo analysis')!;
    expect(topKeyword.priority).toBe('high');
  });

  it('builds a navigation structure grouped by real URL path segments', async () => {
    const plan = await service.planNavigation(buildAnalysisData());

    const labels = plan.navigation_structure.map(item => item.label.toLowerCase());
    expect(labels).toContain('home');
    expect(labels).toContain('services');
    expect(labels).toContain('blog');
  });

  it('flags near-identical ranking keywords as cannibalization', async () => {
    const plan = await service.planNavigation(buildAnalysisData());

    // seo audit tool (pos 4) and seo analysis tool (pos 6) share 'seo'/'tool'.
    const cannibal = plan.cannibalization_warnings.find(w =>
      w.keywords.includes('seo audit tool') && w.keywords.includes('seo analysis tool'),
    );
    expect(cannibal).toBeDefined();
    expect(cannibal?.recommendation.length).toBeGreaterThan(5);
  });

  it('returns empty structures for sites with no routes', async () => {
    const data = buildAnalysisData({
      traffic_metrics: {
        organic_traffic: 0,
        traffic_growth: 0,
        top_pages: [],
        traffic_sources: [],
      },
    });

    const plan = await service.planNavigation(data);
    expect(plan.link_recommendations).toEqual([]);
    expect(plan.navigation_structure).toEqual([]);
    expect(plan.summary.total_recommendations).toBe(0);
  });
});