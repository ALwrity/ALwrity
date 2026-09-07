import { beforeEach, describe, expect, it } from 'vitest';
import { buildWebsiteSessionKey } from '../common/onboardingSessionKey';
import { ONBOARDING_STORAGE_KEYS } from '../common/onboardingStorageKeys';
import {
  isBackgroundSetupCacheValid,
  readBackgroundSetupCache,
  writeBackgroundSetupCache,
} from './backgroundSetupCache';

describe('isBackgroundSetupCacheValid', () => {
  const siteAKey = buildWebsiteSessionKey('https://site-a.com', { id: 1 });
  const siteAReanalyzedKey = buildWebsiteSessionKey('https://site-a.com', { id: 99 });

  it('accepts cache when session key matches and timestamp is fresh', () => {
    expect(
      isBackgroundSetupCacheValid({
        cachedSessionKey: siteAKey,
        currentSessionKey: siteAKey,
        cacheTimestamp: new Date().toISOString(),
      })
    ).toBe(true);
  });

  it('rejects cache when website session key changed', () => {
    expect(
      isBackgroundSetupCacheValid({
        cachedSessionKey: siteAKey,
        currentSessionKey: siteAReanalyzedKey,
        cacheTimestamp: new Date().toISOString(),
      })
    ).toBe(false);
  });

  it('rejects expired cache entries older than 24 hours', () => {
    const expired = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect(
      isBackgroundSetupCacheValid({
        cachedSessionKey: siteAKey,
        currentSessionKey: siteAKey,
        cacheTimestamp: expired,
      })
    ).toBe(false);
  });
});

describe('background setup cache storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('writes and reads content audit cache scoped to session key', () => {
    const sessionKey = buildWebsiteSessionKey('https://acme.com', { id: 3 });
    writeBackgroundSetupCache('contentAudit', sessionKey, {
      success: true,
      audit: { themes: ['growth'] },
    });

    const cached = readBackgroundSetupCache<{ audit?: { themes?: string[] } }>(
      'contentAudit',
      sessionKey
    );
    expect(cached?.audit?.themes).toEqual(['growth']);
  });

  it('returns null when reading cache for a different session key', () => {
    const oldKey = buildWebsiteSessionKey('https://acme.com', { id: 1 });
    const newKey = buildWebsiteSessionKey('https://acme.com', { id: 2 });
    writeBackgroundSetupCache('siteHealth', oldKey, {
      success: true,
      site_health: { total_urls: 10 },
    });

    expect(readBackgroundSetupCache('siteHealth', newKey)).toBeNull();
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEYS.siteHealthResult)).toBeNull();
  });
});
