import { useState, useEffect, useCallback, useRef } from 'react';
import type { Competitor } from '../WebsiteStep/components';
import type { ContentPillarData } from './ContentPillarsSection';
import { aiApiClient, longRunningApiClient } from '../../../api/client';
import {
  ONBOARDING_STORAGE_KEYS,
  resolveCurrentWebsiteSessionKey,
} from '../common/onboardingStorageKeys';
import {
  isCompetitorCacheValid,
  readCompetitorCacheSessionKey,
  writeCompetitorCacheSessionKey,
} from './competitorDiscoveryCache';
import { shouldSkipExpensiveStepRerun } from '../common/onboardingArtifactRestore';
import { isWebsiteStartFreshSession } from '../utils/onboardingWebsiteReset';
import {
  canTrustBackendResearchData,
  mapDbCompetitorsToUi,
} from './competitorResearchRestore';

interface UseCompetitorDiscoveryProps {
  userUrl: string;
  industryContext?: string;
  initialData: any;
  sitemapAnalysis: any;
  mergeCrawlSocialMedia: (exaData: Record<string, any>) => Record<string, any>;
  researchStepCompleted?: boolean;
  backendResearchHasData?: boolean;
  onResearchSessionChange?: (payload: Record<string, unknown>) => void;
}

interface UseCompetitorDiscoveryReturn {
  competitors: Competitor[];
  setCompetitors: React.Dispatch<React.SetStateAction<Competitor[]>>;
  socialMediaAccounts: any;
  setSocialMediaAccounts: React.Dispatch<React.SetStateAction<any>>;
  researchSummary: any;
  setResearchSummary: React.Dispatch<React.SetStateAction<any>>;
  contentPillars: ContentPillarData | null;
  setContentPillars: React.Dispatch<React.SetStateAction<ContentPillarData | null>>;
  isLoadingPillars: boolean;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  isAnalyzing: boolean;
  analysisProgress: number;
  analysisStep: string;
  showProgressModal: boolean;
  usingCachedData: boolean;
  isRestoring: boolean;
  startCompetitorDiscovery: (force?: boolean) => Promise<void>;
  loadCachedAnalysis: () => boolean;
  updateCacheWithSitemapAnalysis: (sitemapResult: any) => void;
  refreshContentPillars: () => Promise<void>;
}

export function useCompetitorDiscovery({
  userUrl,
  industryContext,
  initialData,
  sitemapAnalysis,
  mergeCrawlSocialMedia,
  researchStepCompleted = false,
  backendResearchHasData = false,
  onResearchSessionChange,
}: UseCompetitorDiscoveryProps): UseCompetitorDiscoveryReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState('');
  // Seed from initialData so the component can render cached/DB results
  // immediately and doesn't overwrite Wizard state with empty defaults.
  const [competitors, setCompetitors] = useState<Competitor[]>(initialData?.competitors ?? []);
  const [socialMediaAccounts, setSocialMediaAccounts] = useState<any>(initialData?.social_media_accounts ?? {});
  const [researchSummary, setResearchSummary] = useState<any>(initialData?.researchSummary ?? null);
  const [contentPillars, setContentPillars] = useState<ContentPillarData | null>(initialData?.content_pillars ?? null);
  const [isLoadingPillars, setIsLoadingPillars] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [usingCachedData, setUsingCachedData] = useState(!!(initialData?.competitors?.length > 0));
  const [isRestoring, setIsRestoring] = useState(
    initialData === undefined || initialData === null
  );

  const initializationStarted = useRef(false);
  const crawlSocialMediaRef = useRef<Record<string, string>>({});

  const canTrustInitialResearchData = useCallback((): boolean => {
    const liveUrl = localStorage.getItem(ONBOARDING_STORAGE_KEYS.websiteUrl) || '';
    return canTrustBackendResearchData({
      initialData,
      userUrl,
      liveWebsiteUrl: liveUrl,
    });
  }, [initialData, userUrl]);

  const applyPersistedResearchState = useCallback(
    (payload: {
      competitors?: Competitor[];
      social_media_accounts?: Record<string, unknown>;
      research_summary?: unknown;
      researchSummary?: unknown;
      content_pillars?: ContentPillarData | null;
      sitemap_analysis?: unknown;
    }) => {
      const comps = payload.competitors || [];
      if (comps.length > 0) {
        setCompetitors(comps);
      }
      if (payload.social_media_accounts) {
        setSocialMediaAccounts(mergeCrawlSocialMedia(payload.social_media_accounts));
      }
      const summary = payload.researchSummary || payload.research_summary;
      if (summary) {
        setResearchSummary(summary);
      }
      if (payload.content_pillars) {
        setContentPillars(payload.content_pillars);
      }
      setUsingCachedData(true);
    },
    [mergeCrawlSocialMedia]
  );

  const persistCompetitorCache = useCallback(
    (finalUserUrl: string, analysisData: Record<string, unknown>) => {
      const sessionKey = resolveCurrentWebsiteSessionKey(finalUserUrl);
      try {
        localStorage.setItem(
          ONBOARDING_STORAGE_KEYS.competitorAnalysisData,
          JSON.stringify(analysisData)
        );
        localStorage.setItem(ONBOARDING_STORAGE_KEYS.competitorAnalysisUrl, finalUserUrl);
        localStorage.setItem(
          ONBOARDING_STORAGE_KEYS.competitorAnalysisTimestamp,
          Date.now().toString()
        );
        writeCompetitorCacheSessionKey(sessionKey);
        onResearchSessionChange?.({
          ...analysisData,
          userUrl: finalUserUrl,
        });
      } catch (cacheErr) {
        console.warn('[useCompetitorDiscovery] Failed to cache competitor analysis:', cacheErr);
      }
    },
    [onResearchSessionChange]
  );

  const loadCachedAnalysis = useCallback((): boolean => {
    try {
      const cachedData = localStorage.getItem(ONBOARDING_STORAGE_KEYS.competitorAnalysisData);
      const cachedUrl = localStorage.getItem(ONBOARDING_STORAGE_KEYS.competitorAnalysisUrl) || '';
      const cacheTimestamp = localStorage.getItem(
        ONBOARDING_STORAGE_KEYS.competitorAnalysisTimestamp
      );
      const cachedSessionKey = readCompetitorCacheSessionKey();

      const finalUserUrl =
        userUrl || localStorage.getItem(ONBOARDING_STORAGE_KEYS.websiteUrl) || '';
      const currentSessionKey = resolveCurrentWebsiteSessionKey(finalUserUrl);

      if (
        !cachedData ||
        !isCompetitorCacheValid({
          cachedUrl,
          cachedSessionKey,
          currentSessionKey,
          userUrl: finalUserUrl,
          cacheTimestamp,
        })
      ) {
        return false;
      }

      const parsedData = JSON.parse(cachedData);
      const hasCompetitors = (parsedData.competitors || []).length > 0;
      const hasResearch = !!parsedData.research_summary;

      if (hasCompetitors || hasResearch) {
        setCompetitors(parsedData.competitors || []);
        setSocialMediaAccounts(parsedData.social_media_accounts || {});
        setResearchSummary(parsedData.research_summary || null);
        setContentPillars(parsedData.content_pillars || null);
        setUsingCachedData(true);
        return true;
      }

      localStorage.removeItem(ONBOARDING_STORAGE_KEYS.competitorAnalysisData);
      localStorage.removeItem(ONBOARDING_STORAGE_KEYS.competitorAnalysisUrl);
      localStorage.removeItem(ONBOARDING_STORAGE_KEYS.competitorAnalysisTimestamp);
      localStorage.removeItem(ONBOARDING_STORAGE_KEYS.competitorAnalysisSessionKey);
      return false;
    } catch (err) {
      console.error('[useCompetitorDiscovery] Error loading cached analysis:', err);
      return false;
    }
  }, [userUrl]);

  const updateCacheWithSitemapAnalysis = useCallback((sitemapResult: any) => {
    try {
      const cachedData = localStorage.getItem(ONBOARDING_STORAGE_KEYS.competitorAnalysisData);
      const finalUserUrl =
        userUrl || localStorage.getItem(ONBOARDING_STORAGE_KEYS.websiteUrl) || '';
      const sessionKey = resolveCurrentWebsiteSessionKey(finalUserUrl);

      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        parsedData.sitemap_analysis = sitemapResult;
        localStorage.setItem(
          ONBOARDING_STORAGE_KEYS.competitorAnalysisData,
          JSON.stringify(parsedData)
        );
      } else {
        persistCompetitorCache(finalUserUrl, {
          competitors: [],
          social_media_accounts: {},
          research_summary: null,
          sitemap_analysis: sitemapResult,
          content_pillars: null,
        });
      }
      writeCompetitorCacheSessionKey(sessionKey);
    } catch (err) {
      console.warn('[useCompetitorDiscovery] Failed to update cache with sitemap analysis:', err);
    }
  }, [userUrl, persistCompetitorCache]);

  const loadPersistedCompetitorsFromDatabase = useCallback(async (): Promise<boolean> => {
    const finalUserUrl =
      userUrl || localStorage.getItem(ONBOARDING_STORAGE_KEYS.websiteUrl) || '';
    if (!finalUserUrl.trim()) {
      return false;
    }

    try {
      const dbResult = await longRunningApiClient.get('/api/onboarding/competitor-analysis');
      const records = dbResult?.data?.competitors;
      if (!Array.isArray(records) || records.length === 0) {
        return false;
      }

      const comps = mapDbCompetitorsToUi(records);
      applyPersistedResearchState({
        competitors: comps,
        social_media_accounts: initialData?.social_media_accounts,
        researchSummary: initialData?.researchSummary,
        content_pillars: initialData?.content_pillars || null,
        sitemap_analysis: initialData?.sitemapAnalysis,
      });

      persistCompetitorCache(finalUserUrl, {
        competitors: comps,
        social_media_accounts: initialData?.social_media_accounts || {},
        social_media_citations: initialData?.social_media_citations || [],
        research_summary: initialData?.researchSummary || null,
        sitemap_analysis: initialData?.sitemapAnalysis || sitemapAnalysis || null,
        content_pillars: initialData?.content_pillars || null,
      });

      console.log(
        '[useCompetitorDiscovery] Restored persisted competitor research from database',
        { count: comps.length }
      );
      return true;
    } catch (err) {
      console.warn('[useCompetitorDiscovery] Failed to restore competitors from database:', err);
      return false;
    }
  }, [
    applyPersistedResearchState,
    initialData,
    persistCompetitorCache,
    sitemapAnalysis,
    userUrl,
  ]);

  const startCompetitorDiscovery = useCallback(async (force = false) => {
    if (!force && loadCachedAnalysis()) {
      return;
    }

    if (!force) {
      const restoredFromDb = await loadPersistedCompetitorsFromDatabase();
      if (restoredFromDb) {
        return;
      }
    }

    setIsAnalyzing(true);
    setShowProgressModal(true);
    setIsLoadingPillars(true);
    setError(null);
    setAnalysisProgress(0);
    setAnalysisStep('Initializing competitor discovery...');
    setUsingCachedData(false);

    try {
      setAnalysisStep('Validating session...');
      setAnalysisProgress(20);
      await new Promise(resolve => setTimeout(resolve, 500));

      setAnalysisStep('Discovering competitors using AI...');
      setAnalysisProgress(40);
      await new Promise(resolve => setTimeout(resolve, 1000));

      setAnalysisStep('Analyzing competitor content and strategy...');
      setAnalysisProgress(60);
      await new Promise(resolve => setTimeout(resolve, 1500));

      setAnalysisStep('Generating competitive insights...');
      setAnalysisProgress(80);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const propUserUrl = userUrl || '';
      const localStorageUrl = localStorage.getItem(ONBOARDING_STORAGE_KEYS.websiteUrl) || '';
      const onboardingContextUrl = (window as any).onboardingContext?.websiteUrl || '';
      const finalUserUrl = propUserUrl || localStorageUrl || onboardingContextUrl || '';

      const localStorageAnalysis = localStorage.getItem(
        ONBOARDING_STORAGE_KEYS.websiteAnalysisData
      );
      let websiteAnalysisData = null;
      if (localStorageAnalysis) {
        try { websiteAnalysisData = JSON.parse(localStorageAnalysis); } catch (e) {}
      }

      if (!finalUserUrl || finalUserUrl.trim() === '') {
        throw new Error('No website URL available for competitor analysis. Please complete Step 2 (Website Analysis) first.');
      }

      const response = await aiApiClient.post('/api/onboarding/step3/discover-competitors', {
        user_url: finalUserUrl,
        industry_context: industryContext ?? '',
        num_results: 25,
        website_analysis_data: websiteAnalysisData
      });

      const result = response.data;

      if (result.success) {
        setAnalysisStep('Finalizing analysis...');
        setAnalysisProgress(100);
        await new Promise(resolve => setTimeout(resolve, 500));

        const analysisData = {
          competitors: result.competitors || [],
          social_media_accounts: result.social_media_accounts || {},
          social_media_citations: result.social_media_citations || [],
          research_summary: result.research_summary || null,
          sitemap_analysis: sitemapAnalysis || null
        };

        setCompetitors(analysisData.competitors);
        const mergedAccounts = mergeCrawlSocialMedia(analysisData.social_media_accounts);
        setSocialMediaAccounts(mergedAccounts);
        setResearchSummary(analysisData.research_summary);
        // The backend now always returns a normalized payload (complete or
        // failed), so both states are surfaced instead of an eternal pending.
        setContentPillars(result.content_pillars || {
          status: 'failed',
          error: 'Content pillar discovery returned no data',
          timestamp: new Date().toISOString(),
        });

        persistCompetitorCache(finalUserUrl, {
          ...analysisData,
          social_media_accounts: mergedAccounts,
          content_pillars: result.content_pillars || null,
        });

        setShowProgressModal(false);
        setIsAnalyzing(false);
        setIsLoadingPillars(false);
      } else {
        throw new Error(result.error || 'Competitor discovery failed');
      }
    } catch (err) {
      console.error('Competitor discovery error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsAnalyzing(false);
      setIsLoadingPillars(false);
      setShowProgressModal(false);
    }
  }, [userUrl, industryContext, loadCachedAnalysis, loadPersistedCompetitorsFromDatabase, sitemapAnalysis, mergeCrawlSocialMedia, persistCompetitorCache]);

  const refreshContentPillars = useCallback(async () => {
    setIsLoadingPillars(true);
    setError(null);

    try {
      const finalUserUrl = userUrl || localStorage.getItem(ONBOARDING_STORAGE_KEYS.websiteUrl) || '';
      if (!finalUserUrl || finalUserUrl.trim() === '') {
        throw new Error('No website URL available for content pillar discovery.');
      }

      const response = await aiApiClient.post('/api/onboarding/step3/discover-content-pillars', {
        user_url: finalUserUrl,
      });

      const result = response.data;
      // Always set a truthy payload so the section can render tri-state
      // (complete / failed / pending). The endpoint returns a complete
      // payload even when persistence fails, plus an error message.
      const payload: ContentPillarData = result.content_pillars || {
        status: 'failed',
        error: result.error || 'Content pillar discovery failed',
        timestamp: new Date().toISOString(),
      };
      setContentPillars(payload);
      if (result.error) {
        setError(result.error);
      }

      try {
        const cachedData = localStorage.getItem(ONBOARDING_STORAGE_KEYS.competitorAnalysisData);
        if (cachedData) {
          const parsedData = JSON.parse(cachedData);
          parsedData.content_pillars = payload;
          localStorage.setItem(
            ONBOARDING_STORAGE_KEYS.competitorAnalysisData,
            JSON.stringify(parsedData)
          );
        }
      } catch (cacheErr) {
        console.warn('Failed to update cache with content pillars:', cacheErr);
      }
    } catch (err) {
      console.error('Content pillar refresh error:', err);
      setError(err instanceof Error ? err.message : 'Content pillar discovery failed');
    } finally {
      setIsLoadingPillars(false);
    }
  }, [userUrl]);

  // Initialize: Check cache first, then run analysis if needed
  useEffect(() => {
    const initialize = async () => {
      if (initializationStarted.current) return;

      // Wait until the Wizard has loaded the backend step data. On the first
      // render initialData can be null, which would otherwise cause an
      // unnecessary AI call. When it populates, the effect re-runs.
      if (initialData === undefined || initialData === null) {
        setIsRestoring(true);
        return;
      }

      initializationStarted.current = true;
      setIsRestoring(true);

      try {
      const crawlData = initialData?.crawl_social_media || initialData?.crawlResult?.content?.social_media || {};
      if (Object.keys(crawlData).length > 0) {
        crawlSocialMediaRef.current = crawlData;
      }

      if (initialData?.social_media_accounts) {
        setSocialMediaAccounts(mergeCrawlSocialMedia(initialData.social_media_accounts));
      }

      // 1. Check for backend competitors data when it matches the current website session
      if (canTrustInitialResearchData()) {
        setCompetitors(initialData.competitors);
        if (initialData.researchSummary) setResearchSummary(initialData.researchSummary);
        setContentPillars(initialData.content_pillars || null);
        setUsingCachedData(true);

        const finalUserUrl =
          userUrl || localStorage.getItem(ONBOARDING_STORAGE_KEYS.websiteUrl) || '';
        persistCompetitorCache(finalUserUrl, {
          competitors: initialData.competitors || [],
          social_media_accounts: initialData.social_media_accounts || {},
          social_media_citations: initialData.social_media_citations || [],
          research_summary: initialData.researchSummary || null,
          sitemap_analysis: initialData.sitemapAnalysis || null,
          content_pillars: initialData.content_pillars || null,
        });

        // Self-heal: only when the DB has *no* pillars at all (e.g. a legacy
        // session). A persisted "failed" state is left visible with its Retry
        // button instead of silently re-running Exa on every reload, which
        // would incur recurring API cost without user intent.
        const dbPillars = initialData.content_pillars;
        if (!dbPillars) {
          await refreshContentPillars();
        }
        return;
      }

      // 2. Try to load from cache
      const cacheLoaded = loadCachedAnalysis();

      // 3. Restore from database for completed research steps / cleared local caches
      if (!cacheLoaded) {
        const dbLoaded = await loadPersistedCompetitorsFromDatabase();
        if (dbLoaded) {
          return;
        }
      } else {
        return;
      }

      // 4. Saved research artifacts should not silently re-run expensive discovery
      if (
        shouldSkipExpensiveStepRerun({
          hasRestorableArtifacts: backendResearchHasData || researchStepCompleted,
          isStartFreshSession: isWebsiteStartFreshSession(),
        })
      ) {
        console.warn(
          '[useCompetitorDiscovery] Research artifacts exist but could not be restored locally. Use Run Fresh Analysis to regenerate.'
        );
        return;
      }

      // 5. First-time research only
      await startCompetitorDiscovery(false);
      } finally {
        setIsRestoring(false);
      }
    };

    initialize();
  }, [
    initialData,
    loadCachedAnalysis,
    loadPersistedCompetitorsFromDatabase,
    startCompetitorDiscovery,
    mergeCrawlSocialMedia,
    refreshContentPillars,
    canTrustInitialResearchData,
    persistCompetitorCache,
    userUrl,
    researchStepCompleted,
    backendResearchHasData,
  ]);

  return {
    competitors,
    setCompetitors,
    socialMediaAccounts,
    setSocialMediaAccounts,
    researchSummary,
    setResearchSummary,
    contentPillars,
    setContentPillars,
    isLoadingPillars,
    error,
    setError,
    isAnalyzing,
    analysisProgress,
    analysisStep,
    showProgressModal,
    usingCachedData,
    isRestoring,
    startCompetitorDiscovery,
    loadCachedAnalysis,
    updateCacheWithSitemapAnalysis,
    refreshContentPillars,
  };
}
