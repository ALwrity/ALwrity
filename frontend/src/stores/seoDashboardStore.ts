import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { SEODashboardData } from '../api/seoDashboard';
import { SEOAnalysisData } from '../components/shared/types';
import { seoAnalysisAPI } from '../api/seoAnalysis';

// SEO-owned analysis cache scheme (Phase 5): versioned key + 60m TTL enforced
// on every read. Stale or legacy-versioned payloads are a MISS (fail fast),
// never silently served. Out of scope by design: onboarding-owned keys
// (competitor_analysis_*, backgroundSetupCache, seo_cache:*) — owned and
// tested by onboarding; do not rename them here.
const ANALYSIS_CACHE_KEY = 'seo-dashboard-analysis-cache:v1';
const ANALYSIS_CACHE_TTL_MS = 60 * 60 * 1000;
const LEGACY_ANALYSIS_CACHE_KEY = 'seo-dashboard-analysis-cache';

type AnalysisCache = {
  data: SEOAnalysisData;
  updatedAt: number;
  url?: string;
};

function isFresh(updatedAt: number): boolean {
  return Date.now() - updatedAt <= ANALYSIS_CACHE_TTL_MS;
}

function loadAnalysisCache(): AnalysisCache | null {
  try {
    const raw = localStorage.getItem(ANALYSIS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnalysisCache;
    if (parsed && parsed.data && typeof parsed.updatedAt === 'number' && isFresh(parsed.updatedAt)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveAnalysisCache(payload: AnalysisCache | null) {
  try {
    // One-time migration: drop the legacy unversioned entry if present.
    localStorage.removeItem(LEGACY_ANALYSIS_CACHE_KEY);
    if (!payload) {
      localStorage.removeItem(ANALYSIS_CACHE_KEY);
      return;
    }
    localStorage.setItem(ANALYSIS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export interface SEODashboardStore {
  // State
  data: SEODashboardData | null;
  loading: boolean;
  error: string | null;
  analysisData: SEOAnalysisData | null;
  analysisLoading: boolean;
  analysisError: string | null;
  hasRunInitialAnalysis: boolean;
  analysisUpdatedAt: number | null;
  analysisUrl?: string;

  // Actions (data is null while loading or after a failed fetch — fail fast)
  setData: (data: SEODashboardData | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAnalysisData: (data: SEOAnalysisData | null) => void;
  setAnalysisLoading: (loading: boolean) => void;
  setAnalysisError: (error: string | null) => void;
  runSEOAnalysis: () => Promise<void>;
  clearAnalysisError: () => void;
  checkAndRunInitialAnalysis: () => void;
  refreshSEOAnalysis: () => Promise<void>;
  clearAnalysisCache: () => void;
  getAnalysisFreshness: () => { label: string; minutes: number; isStale: boolean };
}

export const useSEODashboardStore = create<SEODashboardStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      data: null,
      loading: false,
      error: null,
      analysisData: loadAnalysisCache()?.data || null,
      analysisLoading: false,
      analysisError: null,
      hasRunInitialAnalysis: false,
      analysisUpdatedAt: loadAnalysisCache()?.updatedAt || null,
      analysisUrl: loadAnalysisCache()?.url || undefined,

      // Actions
      setData: (data) => set({ data }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      setAnalysisData: (data) => {
        const updatedAt = data ? Date.now() : null;
        set({ analysisData: data, analysisUpdatedAt: updatedAt });
        if (data) {
          const currentUrl = get().data?.website_url || get().analysisUrl;
          saveAnalysisCache({ data, updatedAt: updatedAt!, url: currentUrl });
          set({ analysisUrl: currentUrl });
        } else {
          saveAnalysisCache(null);
          set({ analysisUrl: undefined });
        }
      },
      setAnalysisLoading: (loading) => set({ analysisLoading: loading }),
      setAnalysisError: (error) => set({ analysisError: error }),
      
      clearAnalysisError: () => set({ analysisError: null }),

      runSEOAnalysis: async () => {
        const currentData = get().data;
        
        // Get URL from onboarding data or use a fallback
        let url = currentData?.website_url;
        
        // If no URL from dashboard data, try to fetch from onboarding
        if (!url) {
          try {
            // Import the user data API to get user's website URL
            const { userDataAPI } = await import('../api/userData');
            const userData = await userDataAPI.getUserData();
            url = userData?.website_url || userData?.website_analysis?.website_url;
          } catch (error) {
            console.warn('Could not fetch URL from user data:', error);
          }
        }
        
        // If still no URL, try the dedicated website URL endpoint
        if (!url) {
          try {
            const { userDataAPI } = await import('../api/userData');
            const websiteUrl = await userDataAPI.getWebsiteURL();
            if (websiteUrl) {
              url = websiteUrl;
            }
          } catch (error) {
            console.warn('Could not fetch URL from dedicated endpoint:', error);
          }
        }
        
        // Fail fast: never analyze a placeholder URL as the user's site.
        // A missing URL means onboarding is incomplete or user-data fetch
        // failed — report it so the UI shows an error instead of fake results.
        if (!url) {
          set({
            analysisError: 'No website URL found. Complete onboarding Step 1 to connect your site, then retry.',
            analysisLoading: false,
            hasRunInitialAnalysis: true,
          });
          return;
        }

        // Prod hardening: log events, never URLs, payloads, or store dumps.
        console.log('Starting SEO analysis.');
        set({ analysisLoading: true, analysisError: null });

        try {
          const result = await seoAnalysisAPI.analyzeURL(url);

          if (result) {
            const updatedAt = Date.now();
            set({ 
              analysisData: result,
              analysisUpdatedAt: updatedAt,
              analysisUrl: url,
              analysisLoading: false,
              hasRunInitialAnalysis: true 
            });
            saveAnalysisCache({ data: result, updatedAt, url });

            // Update main dashboard data based on analysis
            if (currentData) {
              const updatedData = {
                ...currentData,
                health_score: {
                  score: result.overall_score,
                  change: 0,
                  trend: 'stable',
                  label: result.health_status.replace('_', ' ').toUpperCase(),
                  color: result.health_status === 'poor' ? '#D32F2F' : 
                         result.health_status === 'needs_improvement' ? '#FF9800' : '#4CAF50'
                },
                key_insight: result.critical_issues.length > 0 
                  ? `${result.critical_issues.length} critical issues found`
                  : 'SEO analysis completed successfully',
                priority_alert: result.health_status === 'poor' 
                  ? 'Immediate attention required'
                  : result.health_status === 'needs_improvement'
                  ? 'Improvements recommended'
                  : 'Good SEO health',
                website_url: url // Update the website URL with the actual URL used
              };
              set({ data: updatedData });
            }
          } else {
            console.error('Analysis returned null result');
            set({ 
              analysisError: 'Analysis failed to return results', 
              analysisLoading: false 
            });
          }
        } catch (error: any) {
          console.error('SEO Analysis error:', error);
          
          let errorMessage = 'Analysis failed';
          if (error.code === 'ECONNABORTED') {
            errorMessage = 'Analysis timed out. Please try again.';
          } else if (error.response?.status === 500) {
            errorMessage = 'Server error. Please try again later.';
          } else if (error.response?.status === 404) {
            errorMessage = 'Analysis service not found.';
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          set({ 
            analysisError: errorMessage, 
            analysisLoading: false 
          });
        }
      },

      checkAndRunInitialAnalysis: () => {
        // Hydrate from cache only; do not auto-trigger network analysis.
        const cache = loadAnalysisCache();
        if (cache) {
          set({ analysisData: cache.data, analysisUpdatedAt: cache.updatedAt, analysisUrl: cache.url, hasRunInitialAnalysis: true });
        } else {
          set({ hasRunInitialAnalysis: true });
        }
      },

      refreshSEOAnalysis: async () => {
        // Explicit user-triggered refresh: clears cache and runs analysis
        saveAnalysisCache(null);
        await get().runSEOAnalysis();
      },

      clearAnalysisCache: () => {
        saveAnalysisCache(null);
        set({ analysisData: null, analysisUpdatedAt: null, analysisUrl: undefined });
      },

      getAnalysisFreshness: () => {
        const updatedAt = get().analysisUpdatedAt;
        if (!updatedAt) return { label: 'No analysis yet', minutes: Infinity, isStale: true };
        const minutes = Math.max(0, Math.floor((Date.now() - updatedAt) / 60000));
        const label = minutes === 0 ? 'Just now' : `${minutes}m ago`;
        return { label, minutes, isStale: minutes > 60 };
      }
    }),
    {
      name: 'seo-dashboard-store',
      // Prod hardening: Redux DevTools integration off in production builds.
      enabled: import.meta.env.DEV,
    }
  )
); 