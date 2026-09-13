import type { Mock } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { apiClient } from '../client';
import { onboardingSeoInsightsApi } from '../onboardingSeoInsights';

vi.mock('../client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND_SRC = resolve(HERE, '../..');

describe('Phase 12 (plan C) — onboarding SEO insights client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists the on-page audit via the persisting onboarding route', async () => {
    (apiClient.post as unknown as Mock).mockResolvedValue({ data: { success: true, audit: { overall_score: 80 } } });
    const result = await onboardingSeoInsightsApi.persistOnPageAudit('https://x.com', ['seo']);
    expect(apiClient.post).toHaveBeenCalledWith('/api/onboarding/seo-insights/on-page-audit', {
      website_url: 'https://x.com',
      target_keywords: ['seo'],
    });
    expect(result.audit.overall_score).toBe(80);
  });

  it('requests a GSC snapshot with the site url + range', async () => {
    (apiClient.post as unknown as Mock).mockResolvedValue({ data: { success: true } });
    await onboardingSeoInsightsApi.requestGscSnapshot('https://x.com', 30);
    expect(apiClient.post).toHaveBeenCalledWith('/api/onboarding/seo-insights/gsc-snapshot', {
      site_url: 'https://x.com',
      date_range_days: 30,
    });
  });

  it('fetches the prefill payload', async () => {
    (apiClient.get as unknown as Mock).mockResolvedValue({
      data: { website_url: 'https://x.com', keywords: ['seo'], source: 'onboarding' },
    });
    const prefill = await onboardingSeoInsightsApi.getPrefill();
    expect(apiClient.get).toHaveBeenCalledWith('/api/onboarding/seo-insights/prefill');
    expect(prefill.keywords).toEqual(['seo']);
  });
});

describe('Phase 12 (plan C) — onboarding wiring contracts', () => {
  const read = (rel: string) =>
    readFileSync(resolve(FRONTEND_SRC, rel), 'utf-8');

  it('the wizard Step-0 analysis persists via the SEO-insights route', () => {
    const src = read('components/OnboardingWizard/WebsiteStep/components/UnifiedAnalysisContainer/index.tsx');
    expect(src).toContain('/api/onboarding/seo-insights/on-page-audit');
    expect(src).not.toContain("'/api/seo/on-page-analysis'");
  });

  it('the GSC connect flow requests the post-connect snapshot (best effort)', () => {
    const src = read('components/OnboardingWizard/common/useGSCConnection.ts');
    expect(src).toContain('onboardingSeoInsights');
    expect(src).toContain('requestGscSnapshot');
  });

  it('the tools panel prefeeds the meta tool from onboarding pillars', () => {
    const src = read('components/SEODashboard/components/SeoToolsPanel/SeoToolsPanel.tsx');
    expect(src).toContain('getPrefill');
    expect(src).toContain('metaPrefill');
  });
});
