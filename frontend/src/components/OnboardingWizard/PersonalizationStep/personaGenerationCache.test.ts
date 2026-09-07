import { beforeEach, describe, expect, it } from 'vitest';
import { buildWebsiteSessionKey } from '../common/onboardingSessionKey';
import {
  clearPersonaCache,
  clearPersonaServerCacheStatus,
  getPersonaServerCacheStatus,
  isPersonaCacheValid,
  readPersonaCache,
  readPersonaCacheSessionKey,
  setPersonaServerCacheStatus,
  writePersonaCache,
  writePersonaCacheSessionKey,
} from './personaGenerationCache';

describe('isPersonaCacheValid', () => {
  const siteAKey = buildWebsiteSessionKey('https://site-a.com', { id: 1 });
  const siteAReanalyzedKey = buildWebsiteSessionKey('https://site-a.com', { id: 99 });

  it('accepts cache when session key matches and timestamp is fresh', () => {
    expect(
      isPersonaCacheValid({
        cachedSessionKey: siteAKey,
        currentSessionKey: siteAKey,
        cacheTimestamp: new Date().toISOString(),
      })
    ).toBe(true);
  });

  it('rejects cache when website session key changed (re-analyze same URL)', () => {
    expect(
      isPersonaCacheValid({
        cachedSessionKey: siteAKey,
        currentSessionKey: siteAReanalyzedKey,
        cacheTimestamp: new Date().toISOString(),
      })
    ).toBe(false);
  });

  it('rejects cache when session key is missing from stored cache', () => {
    expect(
      isPersonaCacheValid({
        cachedSessionKey: null,
        currentSessionKey: siteAKey,
        cacheTimestamp: new Date().toISOString(),
      })
    ).toBe(false);
  });

  it('rejects expired cache entries older than 24 hours', () => {
    const expired = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect(
      isPersonaCacheValid({
        cachedSessionKey: siteAKey,
        currentSessionKey: siteAKey,
        cacheTimestamp: expired,
      })
    ).toBe(false);
  });

  it('rejects cache when timestamp is missing', () => {
    expect(
      isPersonaCacheValid({
        cachedSessionKey: siteAKey,
        currentSessionKey: siteAKey,
        cacheTimestamp: null,
      })
    ).toBe(false);
  });
});

describe('persona cache storage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('persists and reads persona cache scoped to session key', () => {
    const sessionKey = buildWebsiteSessionKey('https://acme.com', { id: 5 });
    writePersonaCache(sessionKey, {
      core_persona: { name: 'Acme Voice' },
      platform_personas: { linkedin: { tone: 'professional' } },
      quality_metrics: { overall_score: 90 },
      timestamp: new Date().toISOString(),
    });

    expect(readPersonaCacheSessionKey()).toBe(sessionKey);
    const cached = readPersonaCache(sessionKey);
    expect(cached?.core_persona).toEqual({ name: 'Acme Voice' });
    expect(cached?.platform_personas?.linkedin).toEqual({ tone: 'professional' });
  });

  it('returns null when reading cache for a different session key', () => {
    const oldKey = buildWebsiteSessionKey('https://acme.com', { id: 1 });
    const newKey = buildWebsiteSessionKey('https://acme.com', { id: 2 });
    writePersonaCache(oldKey, {
      core_persona: { name: 'Stale' },
      timestamp: new Date().toISOString(),
    });

    expect(readPersonaCache(newKey)).toBeNull();
  });

  it('clears persona cache and session key', () => {
    const sessionKey = buildWebsiteSessionKey('https://acme.com', { id: 1 });
    writePersonaCacheSessionKey(sessionKey);
    writePersonaCache(sessionKey, {
      core_persona: { name: 'Acme' },
      timestamp: new Date().toISOString(),
    });

    clearPersonaCache();

    expect(readPersonaCacheSessionKey()).toBeNull();
    expect(readPersonaCache(sessionKey)).toBeNull();
  });
});

describe('persona server cache status', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('stores and reads server cache status scoped to website session key', () => {
    const sessionKey = buildWebsiteSessionKey('https://acme.com', { id: 1 });
    setPersonaServerCacheStatus(sessionKey, 'found');
    expect(getPersonaServerCacheStatus(sessionKey)).toBe('found');
  });

  it('returns null when status was recorded for a different session key', () => {
    const oldKey = buildWebsiteSessionKey('https://acme.com', { id: 1 });
    const newKey = buildWebsiteSessionKey('https://acme.com', { id: 2 });
    setPersonaServerCacheStatus(oldKey, '404');
    expect(getPersonaServerCacheStatus(newKey)).toBeNull();
  });

  it('clears server cache status flag', () => {
    const sessionKey = buildWebsiteSessionKey('https://acme.com', { id: 1 });
    setPersonaServerCacheStatus(sessionKey, '404');
    clearPersonaServerCacheStatus();
    expect(getPersonaServerCacheStatus(sessionKey)).toBeNull();
  });
});
