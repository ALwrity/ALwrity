/**
 * Cached Analytics API Client
 * 
 * Wraps the analytics API with intelligent caching to reduce redundant requests
 * and improve performance while managing cache invalidation.
 */

import { apiClient, aiApiClient } from './client';
import analyticsCache from '../services/analyticsCache';

interface PlatformAnalytics {
  platform: string;
  metrics: Record<string, any>;
  date_range: { start: string; end: string };
  last_updated: string;
  status: string;
  error_message?: string;
}

interface AnalyticsSummary {
  total_platforms: number;
  connected_platforms: number;
  successful_data: number;
  total_clicks: number;
  total_impressions: number;
  overall_ctr: number;
  platforms: Record<string, any>;
}

interface PlatformConnectionStatus {
  connected: boolean;
  sites_count: number;
  sites: any[];
  error?: string;
}

interface AnalyticsResponse {
  data: Record<string, PlatformAnalytics>;
  summary: AnalyticsSummary;
  status: Record<string, PlatformConnectionStatus>;
}

class CachedAnalyticsAPI {
  private readonly CACHE_TTL = {
    PLATFORM_STATUS: 30 * 60 * 1000, // 30 minutes - status changes rarely
    ANALYTICS_DATA: 60 * 60 * 1000,  // 60 minutes - analytics data cached for 1 hour
    USER_SITES: 120 * 60 * 1000,     // 120 minutes - user sites change very rarely
  };

  /**
   * Check if existing analytics data exists in the database
   */
  async checkExistingAnalytics(platform: string, siteUrl?: string): Promise<{
    exists: boolean;
    analysis_id?: number;
    analysis_date?: string;
    status?: string;
    summary?: any;
  }> {
    const params = siteUrl ? { site_url: siteUrl } : undefined;
    const response = await apiClient.get(`/api/analytics/check-existing/${platform}`, { params });
    return response.data;
  }

  /**
   * Load full analytics data from the database by analysis ID
   */
  async loadAnalyticsFromDB(analysisId: number): Promise<any> {
    const response = await apiClient.get(`/api/analytics/db/${analysisId}`);
    return response.data;
  }

  /**
   * Get platform connection status with caching
   */
  async getPlatformStatus(): Promise<{ platforms: Record<string, PlatformConnectionStatus> }> {
    const endpoint = '/api/analytics/platforms';
    
    // Try to get from cache first
    const cached = analyticsCache.get<{ platforms: Record<string, PlatformConnectionStatus> }>(endpoint);
    if (cached) {
      console.log('📦 Analytics Cache HIT: Platform status (cached for 30 minutes)');
      return cached;
    }

    // Fetch from API
    console.log('🌐 Analytics API: Fetching platform status... (will cache for 30 minutes)');
    const response = await apiClient.get(endpoint);
    
    // Cache the result with extended TTL
    analyticsCache.set(endpoint, undefined, response.data, this.CACHE_TTL.PLATFORM_STATUS);
    
    return response.data;
  }

  /**
   * Get analytics data with caching
   */
  async getAnalyticsData(platforms?: string[], bypassCache: boolean = false, opts?: { start_date?: string; end_date?: string; site_url?: string }): Promise<AnalyticsResponse> {
    const baseParams: any = platforms ? { platforms: platforms.join(',') } : {};
    if (opts?.site_url) baseParams.site_url = opts.site_url;
    const endpoint = '/api/analytics/data';
    
    // If bypassing cache, add timestamp to force fresh request
    const requestParams = bypassCache ? { ...baseParams, _t: Date.now(), ...(opts || {}) } : { ...baseParams, ...(opts || {}) };
    
    // Try to get from cache first (unless bypassing)
    if (!bypassCache) {
      const cached = analyticsCache.get<AnalyticsResponse>(endpoint, requestParams);
      if (cached) {
        console.log('📦 Analytics Cache HIT: Analytics data (cached for 60 minutes)');
        return cached;
      }
    }

    // Fetch from API
    console.log('🌐 Analytics API: Fetching analytics data... (will cache for 60 minutes)', requestParams);
    const response = await apiClient.get(endpoint, { params: requestParams });
    
    // Cache the result with extended TTL (unless bypassing)
    if (!bypassCache) {
      analyticsCache.set(endpoint, requestParams, response.data, this.CACHE_TTL.ANALYTICS_DATA);
    }
    
    return response.data;
  }

  async getAIInsights(opts: { start_date: string; end_date: string }): Promise<{ success: boolean; insights?: any; error?: string }> {
    const endpoint = '/api/analytics/ai-insights';
    const params = { start_date: opts.start_date, end_date: opts.end_date, _t: Date.now() };
    const response = await aiApiClient.get(endpoint, { params });
    return response.data;
  }

  /**
   * Invalidate platform status cache
   */
  invalidatePlatformStatus(): void {
    analyticsCache.invalidate('/api/analytics/platforms');
    console.log('🔄 Analytics Cache: Platform status invalidated');
  }

  /**
   * Invalidate analytics data cache
   */
  invalidateAnalyticsData(): void {
    analyticsCache.invalidate('/api/analytics/data');
    console.log('🔄 Analytics Cache: Analytics data invalidated');
  }

  /**
   * Invalidate all analytics cache
   */
  invalidateAll(): void {
    analyticsCache.invalidate('analytics');
    console.log('🔄 Analytics Cache: All analytics cache invalidated');
  }

  /**
   * Force refresh analytics data (bypass cache)
   */
  async forceRefreshAnalyticsData(platforms?: string[], opts?: { start_date?: string; end_date?: string }): Promise<AnalyticsResponse> {
    // Try to clear backend cache first (but don't fail if it doesn't work)
    try {
      await this.clearBackendCache(platforms);
    } catch (error) {
      console.warn('⚠️ Backend cache clearing failed, continuing with frontend cache clear:', error);
    }
    
    // Always invalidate frontend cache
    this.invalidateAnalyticsData();
    
    // Finally get fresh data with cache bypass
    return this.getAnalyticsData(platforms, true, opts);
  }

  /**
   * Clear backend analytics cache
   */
  async clearBackendCache(platforms?: string[]): Promise<void> {
    try {
      if (platforms && platforms.length > 0) {
        // Clear cache for specific platforms
        for (const platform of platforms) {
          await apiClient.post('/api/analytics/cache/clear', null, {
            params: { platform }
          });
        }
      } else {
        // Clear all cache
        await apiClient.post('/api/analytics/cache/clear');
      }
      console.log('🔄 Backend analytics cache cleared');
    } catch (error) {
      console.error('❌ Failed to clear backend cache:', error);
      // Don't throw error, just log it - frontend cache clearing is more important
    }
  }

  /**
   * Force refresh platform status (bypass cache)
   */
  async forceRefreshPlatformStatus(): Promise<{ platforms: Record<string, PlatformConnectionStatus> }> {
    this.invalidatePlatformStatus();
    return this.getPlatformStatus();
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats() {
    return analyticsCache.getStats();
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    analyticsCache.invalidate();
    console.log('🗑️ Analytics Cache: All cache cleared');
  }

  /**
   * Get analytics data with database-first caching (most aggressive)
   * Use this when you know the data is stored in the database
   */
  async getAnalyticsDataFromDB(platforms?: string[]): Promise<AnalyticsResponse> {
    const params = platforms ? { platforms: platforms.join(',') } : undefined;
    const endpoint = '/api/analytics/data';
    
    // Try to get from cache first
    const cached = analyticsCache.get<AnalyticsResponse>(endpoint, params);
    if (cached) {
      console.log('📦 Analytics Cache HIT: Analytics data from DB (cached for 2 hours)');
      return cached;
    }

    // Fetch from API
    console.log('🌐 Analytics API: Fetching analytics data from DB... (will cache for 2 hours)', params);
    const response = await apiClient.get(endpoint, { params });
    
    // Cache the result with database TTL (very long since it's from DB)
    analyticsCache.setDatabaseData(endpoint, params, response.data);
    
    return response.data;
  }
}

// Create singleton instance
export const cachedAnalyticsAPI = new CachedAnalyticsAPI();

export default cachedAnalyticsAPI;
