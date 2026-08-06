/**
 * Analytics Cache Service
 * 
 * Provides caching for analytics API calls to reduce redundant requests
 * and improve performance while managing cache invalidation.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface AnalyticsCacheConfig {
  defaultTTL: number; // Default TTL in milliseconds
  maxCacheSize: number; // Maximum number of entries to cache
  databaseDataTTL?: number; // Special TTL for database-stored data (longer)
}

class AnalyticsCacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private config: AnalyticsCacheConfig;

  constructor(config: Partial<AnalyticsCacheConfig> = {}) {
    this.config = {
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      maxCacheSize: 100,
      databaseDataTTL: 2 * 60 * 60 * 1000, // 2 hours for database data
      ...config
    };
  }

  /**
   * Generate cache key from parameters
   */
  private generateKey(endpoint: string, params?: Record<string, any>): string {
    const sortedParams = params ? Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key];
        return result;
      }, {} as Record<string, any>) : {};
    
    return `${endpoint}:${JSON.stringify(sortedParams)}`;
  }

  /**
   * Get cached data if valid
   */
  get<T>(endpoint: string, params?: Record<string, any>): T | null {
    const key = this.generateKey(endpoint, params);
    const entry = this.cache.get(key);

    if (entry) {
      const now = Date.now();
      if (now - entry.timestamp <= entry.ttl) {
        console.log(`📦 Analytics Cache HIT (memory): ${key}`);
        return entry.data;
      }
      this.cache.delete(key);
    }

    // Fallback: check sessionStorage for cross-refresh persistence
    try {
      const raw = sessionStorage.getItem(`analytics:${key}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Date.now() < parsed.expiresAt) {
          this.cache.set(key, { data: parsed.data, timestamp: parsed.timestamp, ttl: parsed.ttl });
          console.log(`📦 Analytics Cache HIT (sessionStorage): ${key}`);
          return parsed.data as T;
        }
        sessionStorage.removeItem(`analytics:${key}`);
      }
    } catch { /* sessionStorage may be unavailable */ }

    return null;
  }

  /**
   * Set cache entry
   */
  set<T>(endpoint: string, params: Record<string, any> | undefined, data: T, ttl?: number): void {
    const key = this.generateKey(endpoint, params);
    const now = Date.now();

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      ttl: ttl || this.config.defaultTTL
    });

    // Persist to sessionStorage so cache survives page refresh
    try {
      sessionStorage.setItem(`analytics:${key}`, JSON.stringify({
        data,
        timestamp: now,
        ttl: ttl || this.config.defaultTTL,
        expiresAt: now + (ttl || this.config.defaultTTL),
      }));
    } catch { /* sessionStorage may be full or unavailable */ }

    console.log(`💾 Analytics Cache SET: ${key} (TTL: ${ttl || this.config.defaultTTL}ms)`);
  }

  /**
   * Set cache entry with database TTL (longer cache for DB-stored data)
   */
  setDatabaseData<T>(endpoint: string, params: Record<string, any> | undefined, data: T): void {
    const ttl = this.config.databaseDataTTL || this.config.defaultTTL;
    this.set(endpoint, params, data, ttl);
    console.log(`🗄️ Analytics Cache SET (DB): ${this.generateKey(endpoint, params)} (TTL: ${ttl}ms)`);
  }

  /**
   * Invalidate cache entries matching pattern
   */
  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      try {
        for (const key of Object.keys(sessionStorage)) {
          if (key.startsWith('analytics:')) sessionStorage.removeItem(key);
        }
      } catch {}
      console.log('🗑️ Analytics Cache CLEARED: All entries');
      return;
    }

    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    try {
      for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith('analytics:') && key.includes(pattern)) {
          sessionStorage.removeItem(key);
        }
      }
    } catch {}
    console.log(`🗑️ Analytics Cache INVALIDATED: ${keysToDelete.length} entries matching "${pattern}"`);
  }

  /**
   * Invalidate entries older than specified time
   */
  invalidateOlderThan(olderThanMs: number): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > olderThanMs) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    console.log(`🗑️ Analytics Cache INVALIDATED: ${keysToDelete.length} entries older than ${olderThanMs}ms`);
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[]; oldestEntry?: number; newestEntry?: number } {
    const keys = Array.from(this.cache.keys());
    const timestamps = Array.from(this.cache.values()).map(entry => entry.timestamp);
    
    return {
      size: this.cache.size,
      keys,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : undefined
    };
  }

  /**
   * Remove oldest cache entry
   */
  private evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log(`🗑️ Analytics Cache EVICTED: ${oldestKey}`);
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`🧹 Analytics Cache CLEANUP: Removed ${keysToDelete.length} expired entries`);
    }
  }
}

// Create singleton instance
export const analyticsCache = new AnalyticsCacheService({
  defaultTTL: 60 * 60 * 1000, // 60 minutes for analytics data (since it's stored in DB)
  maxCacheSize: 100, // Increased cache size since we're keeping data longer
  databaseDataTTL: 2 * 60 * 60 * 1000 // 2 hours for database-stored data
});

// Cleanup expired entries every 5 minutes (since we have longer TTL)
setInterval(() => {
  analyticsCache.cleanup();
}, 5 * 60 * 1000);

export default analyticsCache;
