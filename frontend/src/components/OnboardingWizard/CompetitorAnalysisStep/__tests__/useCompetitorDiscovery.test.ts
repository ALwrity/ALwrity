import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCompetitorDiscovery } from '../useCompetitorDiscovery';

vi.mock('../../../../api/client', () => ({
  aiApiClient: { post: vi.fn() },
  longRunningApiClient: { get: vi.fn(), post: vi.fn() },
}));

import { longRunningApiClient } from '../../../../api/client';

describe('useCompetitorDiscovery navigation restore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('does not auto-run discovery when research step is completed and DB has competitors', async () => {
    vi.mocked(longRunningApiClient.get).mockResolvedValue({
      data: {
        competitors: [
          {
            url: 'https://competitor.com',
            domain: 'competitor.com',
            analysis_data: { title: 'Competitor' },
          },
        ],
      },
    });

    const { result } = renderHook(() =>
      useCompetitorDiscovery({
        userUrl: 'https://www.alwrity.com',
        initialData: { website: 'https://www.alwrity.com' },
        sitemapAnalysis: null,
        mergeCrawlSocialMedia: (data) => data,
        researchStepCompleted: true,
      })
    );

    await waitFor(() => {
      expect(result.current.competitors).toHaveLength(1);
    });

    expect(result.current.showProgressModal).toBe(false);
    expect(result.current.isAnalyzing).toBe(false);
    expect(longRunningApiClient.get).toHaveBeenCalledWith('/api/onboarding/competitor-analysis');
  });

  it('does not auto-run discovery when backend has_data without official Continue', async () => {
    vi.mocked(longRunningApiClient.get).mockResolvedValue({
      data: {
        competitors: [
          {
            url: 'https://competitor.com',
            domain: 'competitor.com',
            analysis_data: { title: 'Competitor' },
          },
        ],
      },
    });

    const { result } = renderHook(() =>
      useCompetitorDiscovery({
        userUrl: 'https://www.alwrity.com',
        initialData: { website: 'https://www.alwrity.com' },
        sitemapAnalysis: null,
        mergeCrawlSocialMedia: (data) => data,
        researchStepCompleted: false,
        backendResearchHasData: true,
      })
    );

    await waitFor(() => {
      expect(result.current.competitors).toHaveLength(1);
    });

    expect(result.current.isAnalyzing).toBe(false);
  });
});
