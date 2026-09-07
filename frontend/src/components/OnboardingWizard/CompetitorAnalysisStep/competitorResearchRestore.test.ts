import { describe, it, expect } from 'vitest';
import {
  canTrustBackendResearchData,
  hasPersistedResearchPayload,
  mapDbCompetitorsToUi,
  mergeResearchSeedIntoStepData,
  resolveResearchWebsiteUrl,
  shouldHydrateResearchFromBackend,
} from './competitorResearchRestore';

describe('competitorResearchRestore', () => {
  describe('resolveResearchWebsiteUrl', () => {
    it('prefers initialData userUrl when website fields are absent', () => {
      expect(
        resolveResearchWebsiteUrl({
          initialData: { userUrl: 'https://www.alwrity.com', competitors: [{ url: 'x' }] },
          userUrl: 'https://www.alwrity.com',
        })
      ).toBe('https://www.alwrity.com');
    });
  });

  describe('canTrustBackendResearchData', () => {
    it('trusts completed backend research when userUrl matches live website', () => {
      expect(
        canTrustBackendResearchData({
          initialData: {
            userUrl: 'https://www.alwrity.com',
            competitors: [{ url: 'https://competitor.com' }],
            researchSummary: { total_competitors: 1 },
          },
          userUrl: 'https://www.alwrity.com',
          liveWebsiteUrl: 'https://www.alwrity.com',
        })
      ).toBe(true);
    });

    it('rejects backend research for a different website', () => {
      expect(
        canTrustBackendResearchData({
          initialData: {
            website: 'https://site-a.com',
            competitors: [{ url: 'https://competitor.com' }],
          },
          userUrl: 'https://site-b.com',
          liveWebsiteUrl: 'https://site-b.com',
        })
      ).toBe(false);
    });

    it('does not reject research that only has userUrl identity', () => {
      expect(
        canTrustBackendResearchData({
          initialData: {
            userUrl: 'https://www.alwrity.com',
            competitors: [{ url: 'https://competitor.com' }],
          },
          userUrl: 'https://www.alwrity.com',
        })
      ).toBe(true);
    });
  });

  describe('mapDbCompetitorsToUi', () => {
    it('maps persisted DB competitor rows into UI shape', () => {
      const mapped = mapDbCompetitorsToUi([
        {
          url: 'https://competitor.com',
          domain: 'competitor.com',
          analysis_data: { title: 'Competitor', relevance_score: 0.9 },
        },
      ]);

      expect(mapped[0]).toMatchObject({
        url: 'https://competitor.com',
        domain: 'competitor.com',
        title: 'Competitor',
        relevance_score: 0.9,
      });
    });
  });

  describe('shouldHydrateResearchFromBackend', () => {
    it('hydrates when research step is complete but live stepData lost competitors', () => {
      expect(
        shouldHydrateResearchFromBackend(
          { website: 'https://www.alwrity.com', analysis: { id: 1 } },
          {
            userUrl: 'https://www.alwrity.com',
            competitors: [{ url: 'https://competitor.com' }],
          },
          'https://www.alwrity.com',
          'https://www.alwrity.com',
          true
        )
      ).toBe(true);
    });

    it('does not hydrate when stepData already has competitors', () => {
      expect(
        shouldHydrateResearchFromBackend(
          { competitors: [{ url: 'https://existing.com' }] },
          { competitors: [{ url: 'https://backend.com' }] },
          'https://www.alwrity.com',
          'https://www.alwrity.com',
          true
        )
      ).toBe(false);
    });
  });

  describe('mergeResearchSeedIntoStepData', () => {
    it('merges backend research and preserves website identity', () => {
      const merged = mergeResearchSeedIntoStepData(
        { analysis: { id: 10 } },
        {
          competitors: [{ url: 'https://competitor.com' }],
          researchSummary: { total_competitors: 1 },
          userUrl: 'https://www.alwrity.com',
        },
        'https://www.alwrity.com'
      );

      expect(hasPersistedResearchPayload(merged)).toBe(true);
      expect(merged.website).toBe('https://www.alwrity.com');
      expect(merged.analysis).toEqual({ id: 10 });
    });
  });
});
