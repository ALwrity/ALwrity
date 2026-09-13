import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import SeoAdvancedTools from '../components/SeoAdvancedTools/SeoAdvancedTools';
import { enterpriseSeoAPI } from '../../../api/enterpriseSeoApi';
import { llmInsightsGenerator } from '../../../api/llmInsightsGenerator';
import { seoApiService } from '../../../services/seoApiService';

vi.mock('../../../api/enterpriseSeoApi', () => ({
  enterpriseSeoAPI: {
    executeQuickAudit: vi.fn(),
    getContentOpportunitiesReport: vi.fn(),
    getGSCStrategyInsights: vi.fn(),
    getGSCOpportunityRanking: vi.fn(),
    getGSCHealthMetrics: vi.fn(),
    getGSCPerformanceTrends: vi.fn(),
  },
}));
vi.mock('../../../api/llmInsightsGenerator', () => ({
  llmInsightsGenerator: {
    generateQuickWins: vi.fn(),
    generatePrioritizedRecommendations: vi.fn(),
    generateKeywordExpansion: vi.fn(),
    generateTrafficRoadmap: vi.fn(),
    generateContentStrategy: vi.fn(),
    generateCompetitiveInsights: vi.fn(),
  },
}));
// Phase 8E: the workflow endpoints are reached through the canonical
// seoApiService functions (performWebsiteAudit / analyzeContentComprehensive).
vi.mock('../../../services/seoApiService', () => ({
  seoApiService: {
    performWebsiteAudit: vi.fn(),
    analyzeContentComprehensive: vi.fn(),
  },
}));

const HERE = dirname(fileURLToPath(import.meta.url));
const dashSrc = () =>
  readFileSync(resolve(HERE, '../SEODashboard.tsx'), 'utf-8');
const mocked = (fn: unknown) => vi.mocked(fn as (...a: any[]) => Promise<any>);

const AUDIT: any = {
  website_url: 'https://example.com',
  executive_summary: { top_opportunities: ['Meta descriptions'], critical_issues: ['Titles'] },
};

// Phase D: enterprise gating dissolved — one unified dashboard. Advanced
// tools (quick-audit, content-opps, 6 orphan LLM tools) are user-fired cards.
describe('Phase D — enterprise unification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dashboard has no Overview/Enterprise tab split; analysis flows inline', () => {
    const src = dashSrc();
    expect(src).not.toMatch(/dashboardTab/);
    expect(src).not.toMatch(/Enterprise Analysis/);
    expect(src).toMatch(/<SEOAnalysisController \/>/);
  });

  it.each([
    ['Quick Audit'],
    ['Content Opportunities'],
    ['Strategy Insights'],
    ['Opportunity Ranking'],
    ['Health Metrics'],
    ['Trend Analysis'],
    ['Website Audit Workflow'],
    ['Content Analysis Workflow'],
    ['Quick Wins'],
    ['Prioritized Recommendations'],
    ['Keyword Expansion'],
    ['Traffic Roadmap'],
    ['Content Strategy'],
    ['Competitive Insights'],
  ])('advanced panel renders the %s tool', (title) => {
    render(
      <SeoAdvancedTools
        websiteUrl="https://example.com"
        targetKeywords={['seo']}
        auditResult={AUDIT}
        gscResult={null}
      />,
    );
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  });

  it('quick audit fires with the site URL', async () => {
    mocked(enterpriseSeoAPI.executeQuickAudit).mockResolvedValue({ quick_score: 75 });
    render(
      <SeoAdvancedTools websiteUrl="https://example.com" targetKeywords={[]} auditResult={null} gscResult={null} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /run quick audit/i }));
    await waitFor(() => {
      expect(enterpriseSeoAPI.executeQuickAudit).toHaveBeenCalledWith('https://example.com');
    });
    expect(await screen.findByText(/75/)).toBeInTheDocument();
  });

  it('quick wins prefills audit data and fires the LLM backend', async () => {
    mocked(llmInsightsGenerator.generateQuickWins).mockResolvedValue([{ title: 'Fix titles' }]);
    render(
      <SeoAdvancedTools websiteUrl="https://example.com" targetKeywords={[]} auditResult={AUDIT} gscResult={null} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /run quick wins/i }));
    await waitFor(() => {
      expect(llmInsightsGenerator.generateQuickWins).toHaveBeenCalledWith(
        expect.objectContaining({}),
        7,
      );
    });
    const [auditData, maxDays] = mocked(llmInsightsGenerator.generateQuickWins).mock.calls[0];
    expect(auditData).toEqual(AUDIT);
    expect(maxDays).toBe(7);
    expect(await screen.findByText(/Fix titles/)).toBeInTheDocument();
  });

  it('context-dependent tools stay disabled without audit data (no fabrication)', () => {
    render(
      <SeoAdvancedTools websiteUrl="https://example.com" targetKeywords={[]} auditResult={null} gscResult={null} />,
    );
    expect(screen.getByRole('button', { name: /run quick wins/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /run keyword expansion/i })).toBeDisabled();
    // Site-URL-only tools stay enabled
    expect(screen.getByRole('button', { name: /run quick audit/i })).not.toBeDisabled();
  });

  // Phase 8D — the 3 previously-unreachable GSC endpoints become user-fired.
  it.each([
    ['run strategy insights', 'getGSCStrategyInsights'] as const,
    ['run opportunity ranking', 'getGSCOpportunityRanking'] as const,
    ['run health metrics', 'getGSCHealthMetrics'] as const,
  ])('%s GSC tool fires with the prefilled site-url payload', async (buttonName, apiFn) => {
    const api = enterpriseSeoAPI as unknown as Record<string, ReturnType<typeof vi.fn>>;
    api[apiFn].mockResolvedValue({ success: true, data: {} });
    render(
      <SeoAdvancedTools websiteUrl="https://example.com" targetKeywords={[]} auditResult={null} gscResult={null} />,
    );
    fireEvent.click(screen.getByRole('button', { name: new RegExp(buttonName, 'i') }));
    await waitFor(() => {
      expect(api[apiFn]).toHaveBeenCalled();
    });
    expect(api[apiFn].mock.calls[0][0]).toBe('https://example.com');
  });

  it('strategy insights payload matches the backend GSCStrategyInsightsRequest model', async () => {
    const api = enterpriseSeoAPI as unknown as Record<string, ReturnType<typeof vi.fn>>;
    api.getGSCStrategyInsights.mockResolvedValue({ success: true, data: {} });
    render(
      <SeoAdvancedTools websiteUrl="https://example.com" targetKeywords={[]} auditResult={null} gscResult={null} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /run strategy insights/i }));
    await waitFor(() => expect(api.getGSCStrategyInsights).toHaveBeenCalled());
    expect(api.getGSCStrategyInsights.mock.calls[0][1]).toEqual({
      includeTrends: true,
      includeCompetitive: false,
      topN: 20,
    });
  });

  it('opportunity ranking payload ranks by roi_score with a sane limit', async () => {
    const api = enterpriseSeoAPI as unknown as Record<string, ReturnType<typeof vi.fn>>;
    api.getGSCOpportunityRanking.mockResolvedValue({ success: true, data: {} });
    render(
      <SeoAdvancedTools websiteUrl="https://example.com" targetKeywords={[]} auditResult={null} gscResult={null} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /run opportunity ranking/i }));
    await waitFor(() => expect(api.getGSCOpportunityRanking).toHaveBeenCalled());
    expect(api.getGSCOpportunityRanking.mock.calls[0][1]).toEqual({
      rankingMetric: 'roi_score',
      limit: 20,
    });
  });

  it('health metrics includes the keyword distribution breakdown by default', async () => {
    const api = enterpriseSeoAPI as unknown as Record<string, ReturnType<typeof vi.fn>>;
    api.getGSCHealthMetrics.mockResolvedValue({ success: true, data: {} });
    render(
      <SeoAdvancedTools websiteUrl="https://example.com" targetKeywords={[]} auditResult={null} gscResult={null} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /run health metrics/i }));
    await waitFor(() => expect(api.getGSCHealthMetrics).toHaveBeenCalled());
    expect(api.getGSCHealthMetrics.mock.calls[0][1]).toEqual({
      includeDistribution: true,
    });
  });

  it('trend analysis requests the full metric set over a 90-day window and the stub contract is retired', async () => {
    const api = enterpriseSeoAPI as unknown as Record<string, ReturnType<typeof vi.fn>>;
    api.getGSCPerformanceTrends.mockResolvedValue({ success: true, data: { status: 'success' } });
    render(
      <SeoAdvancedTools websiteUrl="https://example.com" targetKeywords={[]} auditResult={null} gscResult={null} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /run trend analysis/i }));
    await waitFor(() => expect(api.getGSCPerformanceTrends).toHaveBeenCalled());
    expect(api.getGSCPerformanceTrends.mock.calls[0][1]).toEqual({
      metric: 'all',
      daysBack: 90,
    });
  });

  it.each([
    ['run strategy insights'],
    ['run opportunity ranking'],
    ['run health metrics'],
  ])('%s stays disabled without a site URL (no fabricated GSC target)', (buttonName) => {
    render(
      <SeoAdvancedTools websiteUrl="" targetKeywords={[]} auditResult={null} gscResult={null} />,
    );
    expect(screen.getByRole('button', { name: new RegExp(buttonName, 'i') })).toBeDisabled();
  });

  // Phase 8E — the /api/seo/workflow/* endpoints become user-fired cards via
  // the existing seoApiService functions (no API-module duplication).
  it('website audit workflow fires with the comprehensive defaults from the backend model', async () => {
    mocked(seoApiService.performWebsiteAudit as any).mockResolvedValue({ overall_score: 72 });
    render(
      <SeoAdvancedTools websiteUrl="https://example.com" targetKeywords={[]} auditResult={null} gscResult={null} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /run website audit workflow/i }));
    await waitFor(() => {
      const [url, options] = mocked(seoApiService.performWebsiteAudit as any).mock.calls[0];
      expect(url).toBe('https://example.com');
      expect(options).toEqual({ audit_type: 'comprehensive', include_recommendations: true });
    });
    expect(await screen.findByText(/72/)).toBeInTheDocument();
  });

  it('content analysis workflow fires with seo optimization on and no fabricated focus', async () => {
    mocked(seoApiService.analyzeContentComprehensive as any).mockResolvedValue({ status: 'ok' });
    render(
      <SeoAdvancedTools websiteUrl="https://example.com" targetKeywords={[]} auditResult={null} gscResult={null} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /run content analysis workflow/i }));
    await waitFor(() => {
      const [url, options] = mocked(seoApiService.analyzeContentComprehensive as any).mock.calls[0];
      expect(url).toBe('https://example.com');
      // content_focus stays unset — the editable payload carries NO fabricated focus
      expect('content_focus' in options).toBe(false);
      expect(options.seo_optimization).toBe(true);
    });
  });

  it.each([
    ['run website audit workflow'],
    ['run content analysis workflow'],
  ])('%s stays disabled without a site URL', (buttonName) => {
    render(
      <SeoAdvancedTools websiteUrl="" targetKeywords={[]} auditResult={null} gscResult={null} />,
    );
    expect(screen.getByRole('button', { name: new RegExp(buttonName, 'i') })).toBeDisabled();
  });

  it('both workflow endpoints exist on the live backend router (phase-6 contract style)', () => {
    const toolsSrc = readFileSync(
      resolve(HERE, '../../../../../backend/routers/seo_tools.py'),
      'utf-8',
    );
    for (const path of ['/workflow/website-audit', '/workflow/content-analysis']) {
      expect(toolsSrc).toContain(path);
    }
  });

  it('all previously-stub GSC tool endpoints exist on the live backend router (phase-6 contract style)', () => {
    const toolsSrc = readFileSync(
      resolve(HERE, '../../../../../backend/routers/seo_tools.py'),
      'utf-8',
    );
    for (const path of [
      '/gsc/strategy-insights',
      '/gsc/opportunity-ranking',
      '/gsc/health-metrics',
      '/gsc/trend-analysis',
    ]) {
      expect(toolsSrc).toContain(path);
    }
  });

  it('invalid JSON in the payload editor fails fast with an error', async () => {
    render(
      <SeoAdvancedTools websiteUrl="https://example.com" targetKeywords={['seo']} auditResult={AUDIT} gscResult={null} />,
    );
    fireEvent.change(screen.getByLabelText(/quick wins payload json/i), {
      target: { value: '{broken' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run quick wins/i }));
    expect(await screen.findByText(/invalid json/i)).toBeInTheDocument();
    expect(llmInsightsGenerator.generateQuickWins).not.toHaveBeenCalled();
  });
});
