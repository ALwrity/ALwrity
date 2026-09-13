import { useSEODashboardStore } from '../seoDashboardStore';

// SEO-owned cache scheme (Phase 5): versioned key + 60m TTL enforced on
// hydrate. Stale or legacy-versioned payloads are treated as a MISS
// (fail fast), never silently served.
// Out of scope by design: onboarding-owned keys (competitor_analysis_*,
// backgroundSetupCache, seo_cache:*) — owned and tested by onboarding.

const KEY = 'seo-dashboard-analysis-cache:v1';
const LEGACY_KEY = 'seo-dashboard-analysis-cache';

const payload = (updatedAt: number, data: any = { overall_score: 80 }) =>
  JSON.stringify({ data, updatedAt, url: 'https://example.com' });

describe('Phase 5 — SEO analysis cache scheme', () => {
  beforeEach(() => {
    localStorage.clear();
    useSEODashboardStore.setState({
      analysisData: null,
      analysisUpdatedAt: null,
      analysisUrl: undefined,
      hasRunInitialAnalysis: false,
    });
  });

  it('hydrates a fresh versioned payload', () => {
    localStorage.setItem(KEY, payload(Date.now()));
    useSEODashboardStore.getState().checkAndRunInitialAnalysis();
    expect(useSEODashboardStore.getState().analysisData).not.toBeNull();
  });

  it('treats stale payloads (>60m) as a miss, never serving them', () => {
    localStorage.setItem(KEY, payload(Date.now() - 61 * 60 * 1000));
    useSEODashboardStore.getState().checkAndRunInitialAnalysis();
    const state = useSEODashboardStore.getState();
    expect(state.analysisData).toBeNull();
    expect(state.hasRunInitialAnalysis).toBe(true);
  });

  it('ignores legacy unversioned payloads', () => {
    localStorage.setItem(LEGACY_KEY, payload(Date.now()));
    useSEODashboardStore.getState().checkAndRunInitialAnalysis();
    expect(useSEODashboardStore.getState().analysisData).toBeNull();
  });
});
