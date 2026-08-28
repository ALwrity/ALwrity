import { useState, useEffect, useCallback, useRef } from 'react';
import type { Competitor } from '../WebsiteStep/components';
import type { ContentPillarData } from './ContentPillarsSection';
import { aiApiClient, longRunningApiClient } from '../../../api/client';

interface UseCompetitorDiscoveryProps {
  userUrl: string;
  industryContext?: string;
  initialData: any;
  sitemapAnalysis: any;
  mergeCrawlSocialMedia: (exaData: Record<string, any>) => Record<string, any>;
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

  const initializationStarted = useRef(false);
  const crawlSocialMediaRef = useRef<Record<string, string>>({});

  const loadCachedAnalysis = useCallback((): boolean => {
    try {
      const cachedData = localStorage.getItem('competitor_analysis_data');
      const cachedUrl = localStorage.getItem('competitor_analysis_url') || '';
      const cacheTimestamp = localStorage.getItem('competitor_analysis_timestamp');

      const finalUserUrl = userUrl || localStorage.getItem('website_url') || '';

      const normalizeUrl = (url: string) => {
        if (!url) return '';
        return url.trim().toLowerCase().replace(/\/$/, '').replace(/^https?:\/\//, '').replace(/^www\./, '');
      };

      if (cachedData && normalizeUrl(cachedUrl) === normalizeUrl(finalUserUrl) && cacheTimestamp) {
        const cacheAge = Date.now() - parseInt(cacheTimestamp);
        const cacheValidDuration = 24 * 60 * 60 * 1000;

        if (cacheAge < cacheValidDuration) {
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
          } else {
            localStorage.removeItem('competitor_analysis_data');
            localStorage.removeItem('competitor_analysis_url');
            localStorage.removeItem('competitor_analysis_timestamp');
          }
        }
      }
      return false;
    } catch (err) {
      console.error('Error loading cached analysis:', err);
      return false;
    }
  }, [userUrl]);

  const updateCacheWithSitemapAnalysis = useCallback((sitemapResult: any) => {
    try {
      const cachedData = localStorage.getItem('competitor_analysis_data');
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        parsedData.sitemap_analysis = sitemapResult;
        localStorage.setItem('competitor_analysis_data', JSON.stringify(parsedData));
      } else {
        // Create the cache entry so future mounts have the sitemap data
        // even if competitor_analysis_data was never written.
        const finalUserUrl = userUrl || localStorage.getItem('website_url') || '';
        localStorage.setItem('competitor_analysis_data', JSON.stringify({
          competitors: [],
          social_media_accounts: {},
          research_summary: null,
          sitemap_analysis: sitemapResult,
          content_pillars: null,
        }));
        localStorage.setItem('competitor_analysis_url', finalUserUrl);
        localStorage.setItem('competitor_analysis_timestamp', Date.now().toString());
      }
    } catch (err) {
      console.warn('Failed to update cache with sitemap analysis:', err);
    }
  }, [userUrl]);

  const startCompetitorDiscovery = useCallback(async (force = false) => {
    if (!force && loadCachedAnalysis()) {
      return;
    }

    if (!force) {
      try {
        const dbResult = await longRunningApiClient.get('/api/onboarding/competitor-analysis');
        if (dbResult?.data?.competitors?.length > 0) {
          const comps = dbResult.data.competitors.map((c: any) => {
            const ad = c.analysis_data && typeof c.analysis_data === 'object' ? c.analysis_data : {};
            return {
              url: c.url || c.competitor_url || '',
              domain: c.domain || c.competitor_domain || '',
              title: ad.title || c.title || c.url || '',
              summary: ad.summary || '',
              relevance_score: ad.relevance_score ?? 0.8,
              highlights: ad.highlights || [],
              favicon: ad.favicon ?? null,
              image: ad.image ?? null,
              published_date: ad.published_date ?? null,
              author: ad.author ?? null,
              subpages: ad.subpages || [],
              competitive_insights: ad.competitive_analysis || ad.competitive_insights || { business_model: '', target_audience: '' },
              content_insights: ad.content_insights || { content_focus: '', content_quality: '' },
              market_positioning: ad.market_positioning || {},
            };
          });
          setCompetitors(comps);
          setUsingCachedData(true);
        }
      } catch {
        // DB check failed — proceed with fresh API call
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
      const localStorageUrl = localStorage.getItem('website_url') || '';
      const onboardingContextUrl = (window as any).onboardingContext?.websiteUrl || '';
      const finalUserUrl = propUserUrl || localStorageUrl || onboardingContextUrl || '';

      const localStorageAnalysis = localStorage.getItem('website_analysis_data');
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
        if (result.content_pillars) {
          setContentPillars(result.content_pillars);
        }

        try {
          localStorage.setItem('competitor_analysis_data', JSON.stringify({
            ...analysisData,
            social_media_accounts: mergedAccounts,
            content_pillars: result.content_pillars || null,
          }));
          localStorage.setItem('competitor_analysis_url', finalUserUrl);
          localStorage.setItem('competitor_analysis_timestamp', Date.now().toString());
        } catch (cacheErr) {
          console.warn('Failed to cache competitor analysis:', cacheErr);
        }

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
  }, [userUrl, industryContext, loadCachedAnalysis, sitemapAnalysis, mergeCrawlSocialMedia]);

  const refreshContentPillars = useCallback(async () => {
    setIsLoadingPillars(true);
    setError(null);

    try {
      const finalUserUrl = userUrl || localStorage.getItem('website_url') || '';
      if (!finalUserUrl || finalUserUrl.trim() === '') {
        throw new Error('No website URL available for content pillar discovery.');
      }

      const response = await aiApiClient.post('/api/onboarding/step3/discover-content-pillars', {
        user_url: finalUserUrl,
      });

      const result = response.data;
      if (result.success && result.content_pillars) {
        setContentPillars(result.content_pillars);

        try {
          const cachedData = localStorage.getItem('competitor_analysis_data');
          if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            parsedData.content_pillars = result.content_pillars;
            localStorage.setItem('competitor_analysis_data', JSON.stringify(parsedData));
          }
        } catch (cacheErr) {
          console.warn('Failed to update cache with content pillars:', cacheErr);
        }
      } else {
        setError(result.error || 'Content pillar discovery failed');
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
      if (initialData === undefined || initialData === null) return;

      initializationStarted.current = true;

      const crawlData = initialData?.crawl_social_media || initialData?.crawlResult?.content?.social_media || {};
      if (Object.keys(crawlData).length > 0) {
        crawlSocialMediaRef.current = crawlData;
      }

      if (initialData?.social_media_accounts) {
        setSocialMediaAccounts(mergeCrawlSocialMedia(initialData.social_media_accounts));
      }

      // 1. Check for backend competitors data (SSOT)
      if (initialData?.competitors?.length > 0) {
        setCompetitors(initialData.competitors);
        if (initialData.researchSummary) setResearchSummary(initialData.researchSummary);
        setContentPillars(initialData.content_pillars || null);
        setUsingCachedData(true);

        try {
          const analysisData = {
            competitors: initialData.competitors || [],
            social_media_accounts: initialData.social_media_accounts || {},
            social_media_citations: initialData.social_media_citations || [],
            research_summary: initialData.researchSummary || null,
            sitemap_analysis: initialData.sitemapAnalysis || null,
            content_pillars: initialData.content_pillars || null
          };
          const finalUserUrl = userUrl || localStorage.getItem('website_url') || '';
          localStorage.setItem('competitor_analysis_data', JSON.stringify(analysisData));
          localStorage.setItem('competitor_analysis_url', finalUserUrl);
          localStorage.setItem('competitor_analysis_timestamp', Date.now().toString());
        } catch (e) {
          console.warn('Failed to prime cache from backend data', e);
        }
        return;
      }

      // 2. Try to load from cache
      const cacheLoaded = loadCachedAnalysis();

      // 3. If no cache found, run fresh analysis
      if (!cacheLoaded) {
        await startCompetitorDiscovery(false);
      }
    };

    initialize();
  }, [initialData, loadCachedAnalysis, startCompetitorDiscovery, mergeCrawlSocialMedia]);

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
    startCompetitorDiscovery,
    loadCachedAnalysis,
    updateCacheWithSitemapAnalysis,
    refreshContentPillars,
  };
}
