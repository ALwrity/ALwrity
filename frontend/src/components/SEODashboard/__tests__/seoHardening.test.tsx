import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, screen, waitFor } from '@testing-library/react';
import KeywordGapAnalysis from '../components/KeywordGapAnalysis';
import { apiClient } from '../../../api/client';
import { seoApiService } from '../../../services/seoApiService';

vi.mock('../../../api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const HERE = dirname(fileURLToPath(import.meta.url));
const dashSrc = () =>
  readFileSync(resolve(HERE, '../SEODashboard.tsx'), 'utf-8');
const storeSrc = () =>
  readFileSync(resolve(HERE, '../../../stores/seoDashboardStore.ts'), 'utf-8');

describe('Phase 6 — prod hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aborted fetches never surface as errors (actionable empty state instead)', async () => {
    const canceled: any = new Error('canceled');
    canceled.code = 'ERR_CANCELED';
    vi.mocked(apiClient.get).mockRejectedValue(canceled);
    render(<KeywordGapAnalysis />);
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalled();
    });
    // Cancellation is not a failure: no error card, but the retry CTA stays.
    expect(screen.queryByText(/failed to load keyword gap data/i)).toBeNull();
    expect(screen.getByText(/no keyword data yet/i)).toBeInTheDocument();
  });

  it('shared service supports AbortSignal pass-through', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { health_score: 90 } });
    const controller = new AbortController();
    await (seoApiService as any).makeRequest('/api/seo/health-score', 'GET', undefined, {
      signal: controller.signal,
    });
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/seo/health-score',
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('competitor accordions paginate (max 8 + show-more, not 25 dumps)', () => {
    const src = dashSrc();
    expect(src).toMatch(/visibleCompetitorCount/);
    expect(src).not.toMatch(/\.slice\(0, 25\)\.map/);
  });

  it('no payload/PII dumps in dashboard logs (errors and warns stay)', () => {
    const src = dashSrc();
    for (const banned of [
      'Real SEO data received',
      'Platform status data:',
      'Loading competitor analysis data from API:',
      'Loading competitor analysis data from localStorage (fallback):',
    ]) {
      expect(src).not.toMatch(banned);
    }
    // Fail-fast reporting intact
    expect(src).toMatch(/console\.error\('Error fetching SEO dashboard data:'/);
  });

  it('no payload/PII dumps in store logs', () => {
    const src = storeSrc();
    for (const banned of [
      'API result received:',
      'SEO analysis completed successfully:',
      'Store state after setting analysis data:',
      'Current store state:',
      'Fetched URL from user data:',
    ]) {
      expect(src).not.toMatch(banned);
    }
    expect(src).toMatch(/console\.error\('SEO Analysis error:'/);
  });

  it('store devtools integration is dev-only (off in production)', () => {
    const src = readFileSync(
      resolve(HERE, '../../../stores/seoDashboardStore.ts'),
      'utf-8',
    );
    expect(src).toMatch(/enabled:\s*import\.meta\.env\.DEV/);
  });

  it('unused mock-only getSEOSuggestions is gone (load-bearing mocks stay)', () => {
    const svc = readFileSync(
      resolve(HERE, '../../../services/seoApiService.ts'),
      'utf-8',
    );
    expect(svc).not.toMatch(/async getSEOSuggestions\(/);
    // Still backing the mounted Copilot flow (backend pending)
    expect(svc).toMatch(/async getPersonalizationData\(/);
    expect(svc).toMatch(/async updateDashboardLayout\(/);
  });
});
