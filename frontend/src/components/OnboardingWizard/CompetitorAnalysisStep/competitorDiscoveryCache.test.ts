import { beforeEach, describe, expect, it } from 'vitest';
import {
  isCompetitorCacheValid,
  readCompetitorCacheSessionKey,
  writeCompetitorCacheSessionKey,
} from './competitorDiscoveryCache';
import { buildWebsiteSessionKey } from '../common/onboardingSessionKey';

describe('isCompetitorCacheValid', () => {
  const siteAKey = buildWebsiteSessionKey('https://site-a.com', { id: 1 });
  const siteBKey = buildWebsiteSessionKey('https://site-b.com', { id: 2 });
  const siteAReanalyzedKey = buildWebsiteSessionKey('https://site-a.com', { id: 99 });

  it('accepts cache when URL and session key match the current website session', () => {
    expect(
      isCompetitorCacheValid({
        cachedUrl: 'https://site-a.com',
        cachedSessionKey: siteAKey,
        currentSessionKey: siteAKey,
        userUrl: 'https://site-a.com',
        cacheTimestamp: Date.now().toString(),
      })
    ).toBe(true);
  });

  it('rejects cache when URL matches but analysis session key changed (re-analyze same URL)', () => {
    expect(
      isCompetitorCacheValid({
        cachedUrl: 'https://site-a.com',
        cachedSessionKey: siteAKey,
        currentSessionKey: siteAReanalyzedKey,
        userUrl: 'https://site-a.com',
        cacheTimestamp: Date.now().toString(),
      })
    ).toBe(false);
  });

  it('rejects cache when URL differs even if session key is accidentally equal', () => {
    expect(
      isCompetitorCacheValid({
        cachedUrl: 'https://site-a.com',
        cachedSessionKey: siteAKey,
        currentSessionKey: siteBKey,
        userUrl: 'https://site-b.com',
        cacheTimestamp: Date.now().toString(),
      })
    ).toBe(false);
  });

  it('rejects expired cache entries older than 24 hours', () => {
    const expired = Date.now() - 25 * 60 * 60 * 1000;
    expect(
      isCompetitorCacheValid({
        cachedUrl: 'https://site-a.com',
        cachedSessionKey: siteAKey,
        currentSessionKey: siteAKey,
        userUrl: 'https://site-a.com',
        cacheTimestamp: expired.toString(),
      })
    ).toBe(false);
  });

  it('rejects cache when required timestamp is missing', () => {
    expect(
      isCompetitorCacheValid({
        cachedUrl: 'https://site-a.com',
        cachedSessionKey: siteAKey,
        currentSessionKey: siteAKey,
        userUrl: 'https://site-a.com',
        cacheTimestamp: null,
      })
    ).toBe(false);
  });
});

describe('competitor cache session key storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists and reads the competitor cache session key', () => {
    const key = buildWebsiteSessionKey('https://site-a.com', { id: 5 });
    writeCompetitorCacheSessionKey(key);
    expect(readCompetitorCacheSessionKey()).toBe(key);
  });
});
