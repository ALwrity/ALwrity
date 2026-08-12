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
  contentPillars: ContentPillarData | null;
  isLoadingPillars: boolean;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  isAnalyzing: boolean;
  analysisProgress: number;
  analysisStep: string;
  showProgressModal: boolean;
  usingCachedData: boolean;
  startCompetitorDiscovery: (force?: boolean) => Promise<void>;
  updateCacheWithSitemapAnalysis: (sitemapResult: any) => void;
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
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [socialMediaAccounts, setSocialMediaAccounts] = useState<any>({});
  const [researchSummary, setResearchSummary] = useState<any>(null);
  const [contentPillars, setContentPillars] = useState<ContentPillarData | null>(null);
  const [isLoadingPillars, setIsLoadingPillars] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [usingCachedData, setUsingCachedData] = useState(false);

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
      }
    } catch (err) {
      console.warn('Failed to update cache with sitemap analysis:', err);
    }
  }, []);

  const startCompetitorDiscovery = useCallback(async (force = false) => {
    if (!force && loadCachedAnalysis()) {
      return;
    }

    if (!force) {
      try {
        const dbResult = await longRunningApiClient.get('/api/onboarding/competitor-analysis');
        if (dbResult?.data?.competitors?.length > 0) {
          const comps = dbResult.data.competitors.map((c: any) => ({
            url: c.url || '', domain: c.domain || '', title: c.url || '',
            summary: '', relevance_score: 0.8,
            highlights: [], favicon: null, image: null, published_date: null, author: null,
            competitive_insights: { business_model: '', target_audience: '' },
            content_insights: { content_focus: '', content_quality: '' },
          }));
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
        industry_context: industryContext,
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
          localStorage.setItem('competitor_analysis_data', JSON.stringify({ ...analysisData, social_media_accounts: mergedAccounts }));
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

  // Initialize: Check cache first, then run analysis if needed
  useEffect(() => {
    const initialize = async () => {
      if (initializationStarted.current) return;
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
        setUsingCachedData(true);

        try {
          const analysisData = {
            competitors: initialData.competitors || [],
            social_media_accounts: initialData.social_media_accounts || {},
            social_media_citations: initialData.social_media_citations || [],
            research_summary: initialData.researchSummary || null,
            sitemap_analysis: initialData.sitemapAnalysis || null
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    competitors,
    setCompetitors,
    socialMediaAccounts,
    setSocialMediaAccounts,
    researchSummary,
    contentPillars,
    isLoadingPillars,
    error,
    setError,
    isAnalyzing,
    analysisProgress,
    analysisStep,
    showProgressModal,
    usingCachedData,
    startCompetitorDiscovery,
    updateCacheWithSitemapAnalysis,
  };
}
