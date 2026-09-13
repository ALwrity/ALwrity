/**
 * Phase 8C — client-side correctness (TDD).
 *
 * Phase 3 of the seo-tools UI completion plan:
 *  P8C-1: checkSEOHealth(url) forwards the url as a QUERY param. The old
 *         makeRequest(endpoint, 'GET', params) call silently dropped `params`
 *         (apiClient.get only takes (url, config)) — the url never reached
 *         the backend on the health branch.
 *  P8C-2: analyzeSEOFull is DELETED. Zero callers anywhere; it posts the
 *         deprecated /analyze-full backend alias. The canonical path is
 *         analyzeSEO → /api/seo-dashboard/analyze-comprehensive.
 */
import type { Mock } from 'vitest';

vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { apiClient } from '../../api/client';
import { seoApiService } from '../seoApiService';

const mockedGet = apiClient.get as unknown as Mock;

describe('Phase 8C — checkSEOHealth query-param fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards the url as a query param on the health branch', async () => {
    mockedGet.mockResolvedValue({ data: { status: 'operational' } });

    await seoApiService.checkSEOHealth('https://example.com');

    expect(mockedGet).toHaveBeenCalledWith(
      '/api/seo/health?url=https%3A%2F%2Fexample.com',
      expect.objectContaining({}),
    );
  });

  it('keeps the tools/status branch unchanged when no url is given', async () => {
    mockedGet.mockResolvedValue({ data: { status: 'operational' } });

    await seoApiService.checkSEOHealth();

    expect(mockedGet).toHaveBeenCalledWith(
      '/api/seo/tools/status',
      expect.objectContaining({}),
    );
  });
});

describe('Phase 8C — analyzeSEOFull retirement', () => {
  it('no longer exposes analyzeSEOFull (deprecated /analyze-full alias)', () => {
    expect((seoApiService as any).analyzeSEOFull).toBeUndefined();
  });

  it('keeps the canonical analyzeSEO path intact', async () => {
    (apiClient.post as unknown as Mock).mockResolvedValue({ data: { ok: true } });

    await seoApiService.analyzeSEO('https://example.com');

    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/seo-dashboard/analyze-comprehensive',
      expect.objectContaining({ url: 'https://example.com' }),
      expect.objectContaining({}),
    );
  });
});
