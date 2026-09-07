import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyLiveWebsiteSessionToStepData,
  mergeOnboardingSeedIntoStepData,
  canReuseServerPersona,
  resolveLoadedAnalysisWebsiteUrl,
  shouldMergeBackendDownstreamSteps,
  stageTypedWebsiteUrl,
} from './wizardLiveWebsiteSession';

describe('applyLiveWebsiteSessionToStepData', () => {
  const stale = {
    website: 'https://hexaurum.com',
    website_url: 'https://hexaurum.com',
    analysis: { id: 1, writing_style: { tone: 'old' } },
    competitors: [{ url: 'https://old-competitor.com' }],
    researchSummary: { market_insights: 'old' },
    sitemapAnalysis: { pages: 10 },
    corePersona: { name: 'Hexaurum Voice' },
    platformPersonas: { linkedin: { tone: 'old' } },
    qualityMetrics: { overall_score: 80 },
    content_pillars: { status: 'complete' },
    social_media_accounts: { linkedin: 'https://linkedin.com/old' },
    email: 'user@example.com',
  };

  it('updates the live website/analysis and drops research + persona data', () => {
    const next = applyLiveWebsiteSessionToStepData(stale, {
      website: 'https://www.alwrity.com',
      analysis: { id: 99, writing_style: { tone: 'new' } },
    });

    expect(next.website).toBe('https://www.alwrity.com');
    expect(next.website_url).toBe('https://www.alwrity.com');
    expect(next.analysis).toEqual({ id: 99, writing_style: { tone: 'new' } });
    expect(next.email).toBe('user@example.com');
    expect(next.competitors).toBeUndefined();
    expect(next.researchSummary).toBeUndefined();
    expect(next.sitemapAnalysis).toBeUndefined();
    expect(next.corePersona).toBeUndefined();
    expect(next.platformPersonas).toBeUndefined();
    expect(next.qualityMetrics).toBeUndefined();
    expect(next.content_pillars).toBeUndefined();
    expect(next.social_media_accounts).toBeUndefined();
  });

  it('preserves downstream research when reloading analysis for the same website', () => {
    const sameSite = {
      website: 'https://www.alwrity.com',
      website_url: 'https://www.alwrity.com',
      analysis: { id: 1, writing_style: { tone: 'old' } },
      competitors: [{ url: 'https://competitor.com' }],
      researchSummary: { market_insights: 'saved' },
      corePersona: { name: 'Alwrity Voice' },
    };

    const next = applyLiveWebsiteSessionToStepData(sameSite, {
      website: 'https://www.alwrity.com',
      analysis: { id: 99, writing_style: { tone: 'new' } },
    });

    expect(next.website).toBe('https://www.alwrity.com');
    expect(next.competitors).toEqual([{ url: 'https://competitor.com' }]);
    expect(next.researchSummary).toEqual({ market_insights: 'saved' });
    expect(next.corePersona).toEqual({ name: 'Alwrity Voice' });
    expect(next.analysis).toEqual({ id: 99, writing_style: { tone: 'new' } });
  });

  it('clears website identity on start-fresh without inventing analysis data', () => {
    const next = applyLiveWebsiteSessionToStepData(stale, {
      website: '',
      analysis: null,
    });

    expect(next.website).toBe('');
    expect(next.analysis).toBeUndefined();
    expect(next.corePersona).toBeUndefined();
    expect(next.competitors).toBeUndefined();
  });
});

describe('mergeOnboardingSeedIntoStepData', () => {
  it('does not re-merge hexaurum research/persona when live URL is alwrity', () => {
    const previous = {
      website: 'https://www.alwrity.com',
      analysis: { id: 99 },
      email: 'user@example.com',
    };
    const next = mergeOnboardingSeedIntoStepData(
      previous,
      {
        connect: {
          website: 'https://www.hexaurum.com',
          analysis: { id: 1, writing_tone: 'old' },
        },
        research: { competitors: [{ url: 'https://old.com' }] },
        personalization: { corePersona: { name: 'Hexaurum Voice' } },
      },
      'https://www.alwrity.com',
      { id: 99, writing_tone: 'new' }
    );

    expect(next.website).toBe('https://www.alwrity.com');
    expect(next.analysis).toEqual({ id: 99, writing_tone: 'new' });
    expect(next.competitors).toBeUndefined();
    expect(next.corePersona).toBeUndefined();
    expect(next.email).toBe('user@example.com');
  });

  it('resumes backend research when there is no live website URL', () => {
    const next = mergeOnboardingSeedIntoStepData(
      {},
      {
        connect: { website: 'https://www.hexaurum.com', analysis: { id: 1 } },
        research: { competitors: [{ url: 'https://old.com' }] },
        personalization: { corePersona: { name: 'Hexaurum Voice' } },
      },
      '',
      null
    );

    expect(next.website).toBe('https://www.hexaurum.com');
    expect(next.competitors).toEqual([{ url: 'https://old.com' }]);
    expect(next.corePersona).toEqual({ name: 'Hexaurum Voice' });
  });

  it('skips backend connect seed during start-fresh session', () => {
    const next = mergeOnboardingSeedIntoStepData(
      { email: 'user@example.com' },
      {
        connect: { website: 'https://www.hexaurum.com', analysis: { id: 1 } },
        research: { competitors: [{ url: 'https://old.com' }] },
        personalization: { corePersona: { name: 'Hexaurum Voice' } },
      },
      '',
      null,
      { suppressBackendConnectSeed: true }
    );

    expect(next.website).toBeUndefined();
    expect(next.analysis).toBeUndefined();
    expect(next.competitors).toBeUndefined();
    expect(next.corePersona).toBeUndefined();
    expect(next.email).toBe('user@example.com');
  });
});

describe('shouldMergeBackendDownstreamSteps', () => {
  it('keeps backend research/persona when they belong to the live website', () => {
    expect(
      shouldMergeBackendDownstreamSteps(
        'https://www.alwrity.com',
        'https://alwrity.com/'
      )
    ).toBe(true);
  });

  it('drops backend research/persona when live website differs', () => {
    expect(
      shouldMergeBackendDownstreamSteps(
        'https://hexaurum.com',
        'https://www.alwrity.com'
      )
    ).toBe(false);
  });
});

describe('canReuseServerPersona', () => {
  it('rejects an unscoped persona while a live website is selected', () => {
    expect(canReuseServerPersona('https://www.alwrity.com', undefined, 'https://www.hexaurum.com')).toBe(
      false
    );
  });

  it('rejects a persona tagged to another website', () => {
    expect(
      canReuseServerPersona(
        'https://www.alwrity.com',
        'https://www.hexaurum.com',
        'https://www.hexaurum.com'
      )
    ).toBe(false);
  });
});

describe('resolveLoadedAnalysisWebsiteUrl', () => {
  it('uses the typed URL when the saved analysis has no recorded URL', () => {
    expect(
      resolveLoadedAnalysisWebsiteUrl('https://www.alwrity.com', { id: 12 })
    ).toEqual({ url: 'https://www.alwrity.com' });
  });

  it('accepts matching saved-analysis and typed URLs', () => {
    expect(
      resolveLoadedAnalysisWebsiteUrl('https://alwrity.com/', {
        website_url: 'https://www.alwrity.com',
      })
    ).toEqual({ url: 'https://alwrity.com/' });
  });

  it('returns a clear error when the saved analysis belongs to another website', () => {
    const result = resolveLoadedAnalysisWebsiteUrl('https://www.alwrity.com', {
      website_url: 'https://www.hexaurum.com',
      id: 7,
    });
    expect(result.url).toBe('');
    expect(result.error).toMatch(/different website/i);
  });
});

describe('stageTypedWebsiteUrl', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('replaces stored previous-site URL so wizard seed cannot re-merge it', () => {
    localStorage.setItem('website_url', 'https://www.hexaurum.com');
    localStorage.setItem('website_analysis_data', '{"id":1}');

    expect(stageTypedWebsiteUrl('https://www.alwrity.com')).toBe(true);
    expect(localStorage.getItem('website_url')).toBe('https://www.alwrity.com');
    expect(localStorage.getItem('website_analysis_data')).toBeNull();
  });

  it('does not treat the same site as a change', () => {
    localStorage.setItem('website_url', 'https://www.alwrity.com');
    expect(stageTypedWebsiteUrl('https://alwrity.com/')).toBe(false);
    expect(localStorage.getItem('website_url')).toBe('https://www.alwrity.com');
  });
});
