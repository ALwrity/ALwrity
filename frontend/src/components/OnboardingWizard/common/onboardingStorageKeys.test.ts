import { beforeEach, describe, expect, it } from 'vitest';
import {
  ONBOARDING_STORAGE_KEYS,
  clearDownstreamForWebsiteChange,
  getStoredWebsiteSessionKey,
  storeWebsiteSessionKey,
  syncWebsiteAnalysisStorage,
} from './onboardingStorageKeys';
import { buildWebsiteSessionKey } from './onboardingSessionKey';

describe('ONBOARDING_STORAGE_KEYS', () => {
  it('registers all downstream onboarding cache keys', () => {
    expect(ONBOARDING_STORAGE_KEYS.websiteUrl).toBe('website_url');
    expect(ONBOARDING_STORAGE_KEYS.websiteAnalysisData).toBe('website_analysis_data');
    expect(ONBOARDING_STORAGE_KEYS.competitorAnalysisData).toBe('competitor_analysis_data');
    expect(ONBOARDING_STORAGE_KEYS.competitorAnalysisUrl).toBe('competitor_analysis_url');
    expect(ONBOARDING_STORAGE_KEYS.competitorAnalysisTimestamp).toBe(
      'competitor_analysis_timestamp'
    );
    expect(ONBOARDING_STORAGE_KEYS.competitorAnalysisSessionKey).toBe(
      'competitor_analysis_session_key'
    );
    expect(ONBOARDING_STORAGE_KEYS.personaGenerationData).toBe('persona_generation_data');
    expect(ONBOARDING_STORAGE_KEYS.personaGenerationSessionKey).toBe(
      'persona_generation_session_key'
    );
    expect(ONBOARDING_STORAGE_KEYS.contentAuditResult).toBe('content_audit_result');
    expect(ONBOARDING_STORAGE_KEYS.siteHealthResult).toBe('site_health_result');
    expect(ONBOARDING_STORAGE_KEYS.seoPreviewResult).toBe('seo_preview_result');
    expect(ONBOARDING_STORAGE_KEYS.sitemapState).toBe('alwrity_sitemap_state');
    expect(ONBOARDING_STORAGE_KEYS.websiteSessionKey).toBe('website_session_key');
  });
});

describe('clearDownstreamForWebsiteChange', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('removes research, persona, and background-setup caches but keeps active step', () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.websiteUrl, 'https://old.com');
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.competitorAnalysisData, '{"competitors":[]}');
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.personaGenerationData, '{"core_persona":{}}');
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.contentAuditResult, '{"success":true}');
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.onboardingActiveStep, '2');

    clearDownstreamForWebsiteChange({ preserveActiveStep: true });

    expect(localStorage.getItem(ONBOARDING_STORAGE_KEYS.competitorAnalysisData)).toBeNull();
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEYS.personaGenerationData)).toBeNull();
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEYS.contentAuditResult)).toBeNull();
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEYS.onboardingActiveStep)).toBe('2');
  });

  it('clears stored website session key', () => {
    storeWebsiteSessionKey(buildWebsiteSessionKey('https://acme.com', { id: 1 }));
    clearDownstreamForWebsiteChange();
    expect(getStoredWebsiteSessionKey()).toBeNull();
  });

  it('removes persona server-cache session flag', () => {
    sessionStorage.setItem('persona_server_cache_checked', '404');
    clearDownstreamForWebsiteChange();
    expect(sessionStorage.getItem('persona_server_cache_checked')).toBeNull();
  });

  it('marks persona as requiring regeneration after a website change', () => {
    sessionStorage.setItem('persona_requires_regeneration', '0');
    clearDownstreamForWebsiteChange({ preserveActiveStep: true });
    expect(sessionStorage.getItem('persona_requires_regeneration')).toBe('1');
  });
});

describe('website session key storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and retrieves the current website session key', () => {
    const key = buildWebsiteSessionKey('https://acme.com', { id: 99 });
    storeWebsiteSessionKey(key);
    expect(getStoredWebsiteSessionKey()).toBe(key);
  });
});

describe('syncWebsiteAnalysisStorage when loading a previous analysis', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('clears other-site research/persona caches even if session key was already wiped', () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.websiteUrl, 'https://www.hexaurum.com');
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.competitorAnalysisUrl, 'https://www.hexaurum.com');
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.competitorAnalysisData, '{"competitors":[1]}');
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.personaGenerationData, '{"core_persona":{}}');
    localStorage.setItem(
      ONBOARDING_STORAGE_KEYS.personaGenerationSessionKey,
      buildWebsiteSessionKey('https://www.hexaurum.com', { id: 1 })
    );

    const result = syncWebsiteAnalysisStorage('https://www.alwrity.com', { id: 99 });

    expect(result.didInvalidateDownstream).toBe(true);
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEYS.competitorAnalysisData)).toBeNull();
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEYS.personaGenerationData)).toBeNull();
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEYS.websiteUrl)).toBe(
      'https://www.alwrity.com'
    );
    expect(sessionStorage.getItem('persona_requires_regeneration')).toBe('1');
  });

  it('clears leftover competitor cache when stored website URL already matches the loaded site', () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.websiteUrl, 'https://www.alwrity.com');
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.competitorAnalysisUrl, 'https://www.hexaurum.com');
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.competitorAnalysisData, '{"competitors":[1]}');

    syncWebsiteAnalysisStorage('https://www.alwrity.com', { id: 42 });

    expect(localStorage.getItem(ONBOARDING_STORAGE_KEYS.competitorAnalysisData)).toBeNull();
    expect(sessionStorage.getItem('persona_requires_regeneration')).toBe('1');
  });

  it('forces persona regeneration when no local persona cache exists for the loaded site', () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.websiteUrl, 'https://www.alwrity.com');

    syncWebsiteAnalysisStorage('https://www.alwrity.com', { id: 42 });

    expect(sessionStorage.getItem('persona_requires_regeneration')).toBe('1');
  });

  it('keeps matching same-site persona cache when reloading that site analysis', () => {
    const sessionKey = buildWebsiteSessionKey('https://www.alwrity.com', { id: 42 });
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.websiteUrl, 'https://www.alwrity.com');
    storeWebsiteSessionKey(sessionKey);
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.personaGenerationData, '{"core_persona":{"ok":true}}');
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.personaGenerationSessionKey, sessionKey);
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.competitorAnalysisUrl, 'https://www.alwrity.com');
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.competitorAnalysisData, '{"competitors":[1]}');

    const result = syncWebsiteAnalysisStorage('https://www.alwrity.com', { id: 42 });

    expect(result.didInvalidateDownstream).toBe(false);
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEYS.competitorAnalysisData)).toBe(
      '{"competitors":[1]}'
    );
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEYS.personaGenerationData)).toBe(
      '{"core_persona":{"ok":true}}'
    );
    expect(sessionStorage.getItem('persona_requires_regeneration')).toBeNull();
  });
});
