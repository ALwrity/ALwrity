// CacheBlocker - Golden Backend Tests
// Blocks stale SEO results from being served. Grounded in the repo's real
// versioned-key convention (seo-tools-history:v1) and the analyticsCache TTL
// semantics (in-memory Map + timestamp/ttl). A blocked entry forces a refetch
// from the real service rather than serving stale data.

import CacheBlocker from '../cacheBlocker';

describe('CacheBlocker — versioned TTL cache that refuses stale data', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-13T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and returns fresh entries within TTL', () => {
    const blocker = new CacheBlocker();

    const stored = blocker.set('analyze', { url: 'https://example.com' }, { health_score: 72 }, 60_000);
    expect(stored).toBe(true);

    const hit = blocker.get<{ health_score: number }>('analyze', { url: 'https://example.com' });
    expect(hit).toEqual({ health_score: 72 });
  });

  it('serves real data for uncached keys (cache miss → undefined)', () => {
    const blocker = new CacheBlocker();

    const miss = blocker.get('analyze', { url: 'https://unknown.example' });
    expect(miss).toBeUndefined();
    expect(blocker.isBlocked('analyze', { url: 'https://unknown.example' })).toBe(false);
  });

  it('refuses (blocks) expired entries and reports them stale', () => {
    const blocker = new CacheBlocker();

    blocker.set('analyze', { url: 'https://example.com' }, { health_score: 72 }, 10_000);
    expect(blocker.isStale('analyze', { url: 'https://example.com' })).toBe(false);

    // 20s later the 10s TTL has expired.
    vi.advanceTimersByTime(20_000);

    expect(blocker.isStale('analyze', { url: 'https://example.com' })).toBe(true);
    expect(blocker.isBlocked('analyze', { url: 'https://example.com' })).toBe(true);
    expect(blocker.get('analyze', { url: 'https://example.com' })).toBeUndefined();
  });

  it('uses the versioned cache key namespace (seo-cache:v1)', () => {
    const blocker = new CacheBlocker();
    const key = blocker.buildKey('analyze', { url: 'https://example.com', strategy: 'DESKTOP' });

    expect(key.startsWith('seo-cache:v1:')).toBe(true);
  });

  it('bumps the version to invalidate everything under a namespace', () => {
    const blocker = new CacheBlocker();

    blocker.set('analyze', { url: 'https://example.com' }, { health_score: 72 }, 60_000);
    blocker.set('pagespeed', { url: 'https://example.com' }, { performance_score: 85 }, 60_000);
    expect(blocker.getStats().total_entries).toBe(2);

    blocker.bumpVersion();
    expect(blocker.getStats().total_entries).toBe(0);
    expect(blocker.get('analyze', { url: 'https://example.com' })).toBeUndefined();
  });

  it('invalidates a single namespace without touching others', () => {
    const blocker = new CacheBlocker();

    blocker.set('analyze', { url: 'https://example.com' }, { health_score: 72 }, 60_000);
    blocker.set('pagespeed', { url: 'https://example.com' }, { performance_score: 85 }, 60_000);

    blocker.invalidateNamespace('analyze');

    expect(blocker.get('analyze', { url: 'https://example.com' })).toBeUndefined();
    expect(blocker.get('pagespeed', { url: 'https://example.com' })).toEqual({ performance_score: 85 });
  });

  it('evicts the oldest entry when the cache is full', () => {
    const blocker = new CacheBlocker({ max_entries: 2 });

    blocker.set('analyze', { url: 'https://a.example' }, { health_score: 60 }, 60_000);
    vi.advanceTimersByTime(5_000);
    blocker.set('analyze', { url: 'https://b.example' }, { health_score: 61 }, 60_000);
    vi.advanceTimersByTime(5_000);
    blocker.set('analyze', { url: 'https://c.example' }, { health_score: 62 }, 60_000);

    expect(blocker.get('analyze', { url: 'https://a.example' })).toBeUndefined();
    expect(blocker.get('analyze', { url: 'https://b.example' })).toEqual({ health_score: 61 });
    expect(blocker.get('analyze', { url: 'https://c.example' })).toEqual({ health_score: 62 });
  });

  it('keeps entries fresh when they are re-set (no false staleness)', () => {
    const blocker = new CacheBlocker();

    blocker.set('analyze', { url: 'https://example.com' }, { health_score: 70 }, 60_000);

    // Half-life: refresh with a new value well before expiry.
    vi.advanceTimersByTime(30_000);
    blocker.set('analyze', { url: 'https://example.com' }, { health_score: 84 }, 60_000);

    vi.advanceTimersByTime(30_000);
    expect(blocker.isStale('analyze', { url: 'https://example.com' })).toBe(false);
    expect(blocker.get('analyze', { url: 'https://example.com' })).toEqual({ health_score: 84 });
  });
});