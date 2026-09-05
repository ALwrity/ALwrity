import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  applyDownstreamDirtyProgressOverride,
  clearDownstreamLocalCaches,
  getCommittedStep1WebsiteUrl,
  hasWebsiteChangedFromCommitted,
  isDownstreamDirty,
  markDownstreamDirty,
  normalizeWebsiteUrl,
  ONBOARDING_DOWNSTREAM_DIRTY_KEY,
  ONBOARDING_STEP1_WEBSITE_KEY,
  setCommittedStep1WebsiteUrl,
  shouldInvalidateDownstream,
  stripDownstreamStepData,
} from '../onboardingWebsiteReset';

describe('onboardingWebsiteReset', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('normalizes website URLs for comparison', () => {
    expect(normalizeWebsiteUrl('https://www.Example.com/')).toBe('example.com');
    expect(normalizeWebsiteUrl('http://example.com')).toBe('example.com');
  });

  it('strips downstream fields from wizard step data', () => {
    const stripped = stripDownstreamStepData({
      website: 'https://example.com',
      analysis: { id: 1 },
      competitors: [{ url: 'https://other.com' }],
      corePersona: { name: 'Old' },
      email: 'user@example.com',
    });

    expect(stripped.website).toBe('https://example.com');
    expect(stripped.analysis).toEqual({ id: 1 });
    expect(stripped.email).toBe('user@example.com');
    expect(stripped.competitors).toBeUndefined();
    expect(stripped.corePersona).toBeUndefined();
  });

  it('clears downstream local caches', () => {
    localStorage.setItem('competitor_analysis_data', '{}');
    localStorage.setItem('persona_generation_data', '{}');
    sessionStorage.setItem('persona_server_cache_checked', 'found');

    clearDownstreamLocalCaches();

    expect(localStorage.getItem('competitor_analysis_data')).toBeNull();
    expect(localStorage.getItem('persona_generation_data')).toBeNull();
    expect(sessionStorage.getItem('persona_server_cache_checked')).toBeNull();
  });

  it('tracks committed step1 website and dirty downstream state', () => {
    setCommittedStep1WebsiteUrl('https://www.brand-a.com');
    expect(getCommittedStep1WebsiteUrl()).toBe('brand-a.com');
    expect(hasWebsiteChangedFromCommitted('https://brand-b.com')).toBe(true);
    expect(hasWebsiteChangedFromCommitted('https://www.brand-a.com/')).toBe(false);

    markDownstreamDirty();
    expect(isDownstreamDirty()).toBe(true);
    setCommittedStep1WebsiteUrl('https://brand-b.com');
    expect(isDownstreamDirty()).toBe(false);
  });

  it('decides when downstream invalidation is required', () => {
    expect(
      shouldInvalidateDownstream({
        previousUrl: 'https://site-a.com',
        nextUrl: 'https://site-b.com',
      })
    ).toBe(true);

    expect(
      shouldInvalidateDownstream({
        previousUrl: 'https://site-a.com',
        nextUrl: 'https://site-a.com',
        isExplicitReanalyze: true,
      })
    ).toBe(true);

    expect(
      shouldInvalidateDownstream({
        previousUrl: 'https://site-a.com',
        nextUrl: 'https://site-a.com',
      })
    ).toBe(false);

    expect(
      shouldInvalidateDownstream({
        previousUrl: '',
        nextUrl: 'https://site-a.com',
        isStartFresh: true,
      })
    ).toBe(true);
  });

  it('locks progress while downstream dirty flag is set', () => {
    localStorage.setItem(ONBOARDING_DOWNSTREAM_DIRTY_KEY, 'true');
    expect(
      applyDownstreamDirtyProgressOverride({
        percent: 75,
        completedCount: 3,
        completedFrontier: 2,
        furthestAccessibleStep: 2,
      })
    ).toEqual({
      percent: 0,
      completedCount: 0,
      completedFrontier: -1,
      furthestAccessibleStep: 0,
    });
  });

  it('uses stable storage keys', () => {
    expect(ONBOARDING_STEP1_WEBSITE_KEY).toBe('onboarding_step1_website_url');
    expect(ONBOARDING_DOWNSTREAM_DIRTY_KEY).toBe('onboarding_downstream_dirty');
  });
});
