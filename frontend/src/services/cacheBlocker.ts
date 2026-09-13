// CacheBlocker - versioned TTL cache for SEO tool results.
// It refuses to serve stale data: expired entries are treated as a miss so the
// caller refetches from the real seoApiService. Grounded in the repo's
// versioned-key convention (seo-tools-history:v1) and the analyticsCache TTL
// semantics (in-memory Map + timestamp/ttl, oldest-entries-first eviction).

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheBlockerOptions {
  max_entries: number;
  default_ttl: number;
  namespace_version: string;
}

interface CacheBlockerStats {
  total_entries: number;
  stale_entries: number;
  version: string;
}

class CacheBlocker {
  private cache = new Map<string, CacheEntry<any>>();
  private options: CacheBlockerOptions;

  constructor(options: Partial<CacheBlockerOptions> = {}) {
    this.options = {
      max_entries: 100,
      default_ttl: 10 * 60 * 1000, // 10 minutes
      namespace_version: 'v1',
      ...options,
    };
  }

  /**
   * Build the versioned cache key (seo-cache:v1:<namespace>:<canonical params>).
   */
  buildKey(namespace: string, params?: Record<string, any>): string {
    const canonical = params
      ? Object.keys(params)
          .sort()
          .map(key => `${key}=${JSON.stringify(params[key])}`)
          .join('&')
      : '';
    return `seo-cache:${this.options.namespace_version}:${namespace}:${canonical}`;
  }

  /**
   * Set an entry. Returns true when stored.
   */
  set<T>(namespace: string, params: Record<string, any> | undefined, data: T, ttl?: number): boolean {
    const key = this.buildKey(namespace, params);
    const now = Date.now();

    if (this.cache.size >= this.options.max_entries) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      ttl: ttl || this.options.default_ttl,
    });

    return true;
  }

  /**
   * Get a fresh entry; undefined means blocked/miss → refetch from the service.
   */
  get<T>(namespace: string, params?: Record<string, any>): T | undefined {
    const key = this.buildKey(namespace, params);
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.timestamp <= entry.ttl) {
      return entry.data as T;
    }

    // Stale — block it and drop it so we never serve expired data.
    this.cache.delete(key);
    return undefined;
  }

  /**
   * True when the entry exists but has outlived its TTL (blocked as stale).
   */
  isStale(namespace: string, params?: Record<string, any>): boolean {
    const key = this.buildKey(namespace, params);
    const entry = this.cache.get(key);
    if (!entry) return false;
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * True when a cached entry exists but is stale — the call must go to the
   * service. Missing keys are NOT blocked (plain miss).
   */
  isBlocked(namespace: string, params?: Record<string, any>): boolean {
    const key = this.buildKey(namespace, params);
    const entry = this.cache.get(key);
    if (!entry) return false;
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Bump the version, effective-invalidating every cached entry.
   */
  bumpVersion(): void {
    const next = parseInt(this.options.namespace_version.replace(/\D/g, '') || '0', 10) + 1;
    this.options.namespace_version = `v${next}`;
    this.cache.clear();
  }

  /**
   * Clear every entry under a namespace pattern.
   */
  invalidateNamespace(namespace: string): void {
    const prefix = `seo-cache:${this.options.namespace_version}:${namespace}:`;
    Array.from(this.cache.keys())
      .filter(key => key.startsWith(prefix))
      .forEach(key => this.cache.delete(key));
  }

  /**
   * Drop expired entries.
   */
  cleanup(): void {
    const now = Date.now();
    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    });
  }

  getStats(): CacheBlockerStats {
    const now = Date.now();
    let stale = 0;
    this.cache.forEach(entry => {
      if (now - entry.timestamp > entry.ttl) stale += 1;
    });
    return {
      total_entries: this.cache.size,
      stale_entries: stale,
      version: this.options.namespace_version,
    };
  }

  private evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Date.now();
    this.cache.forEach((entry, key) => {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    });
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

export default CacheBlocker;