import { useState, useEffect, useCallback } from 'react';
import { aiApiClient, longRunningApiClient } from '../../../api/client';
import type { Competitor } from '../WebsiteStep/components';
import { isStepDataValid } from '../common/wizardStepValidation';

interface UseCompetitorResearchWorkflowProps {
  userUrl: string;
  industryContext?: string;
  initialData?: any;
  missingData: boolean;
  onDataReady?: (getData: () => any) => void;
  onValidationChange?: (isValid: boolean) => void;
  mergeCrawlSocialMedia: (exaData: Record<string, any>) => Record<string, any>;
  competitors: Competitor[];
  setCompetitors: React.Dispatch<React.SetStateAction<Competitor[]>>;
  socialMediaAccounts: Record<string, string>;
  setSocialMediaAccounts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  researchSummary: any;
  isAnalyzing: boolean;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  updateCacheWithSitemapAnalysis: (sitemapResult: any) => void;
  sitemapAnalysis: any;
  setSitemapAnalysis: React.Dispatch<React.SetStateAction<any>>;
  isAnalyzingSitemap: boolean;
  setIsAnalyzingSitemap: React.Dispatch<React.SetStateAction<boolean>>;
  isDiscoveringSocial: boolean;
  setIsDiscoveringSocial: React.Dispatch<React.SetStateAction<boolean>>;
  sitemapAutoTriggered: React.MutableRefObject<boolean>;
}

export function useCompetitorResearchWorkflow({
  userUrl,
  industryContext,
  initialData,
  missingData,
  onDataReady,
  onValidationChange,
  mergeCrawlSocialMedia,
  competitors,
  setCompetitors,
  socialMediaAccounts,
  setSocialMediaAccounts,
  researchSummary,
  isAnalyzing,
  setError,
  updateCacheWithSitemapAnalysis,
  sitemapAnalysis,
  setSitemapAnalysis,
  isAnalyzingSitemap,
  setIsAnalyzingSitemap,
  isDiscoveringSocial,
  setIsDiscoveringSocial,
  sitemapAutoTriggered,
}: UseCompetitorResearchWorkflowProps) {
  const [benchmarkReport, setBenchmarkReport] = useState<any>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);

  const discoverSocialMedia = useCallback(async () => {
    if (isDiscoveringSocial) return;

    setIsDiscoveringSocial(true);
    try {
      const finalUserUrl = userUrl || localStorage.getItem('website_url') || '';
      console.log('Starting targeted social media discovery for:', finalUserUrl);

      const response = await aiApiClient.post('/api/onboarding/step3/discover-social-media', {
        user_url: finalUserUrl
      });

      const result = response.data;

      if (result.success) {
        console.log('Social media discovery completed:', result.social_media_accounts);
        const newAccounts = mergeCrawlSocialMedia(result.social_media_accounts || {});

        const hasNewAccounts = Object.values(newAccounts).some((val: any) => val && String(val).trim() !== '' && String(val) !== '1');
        const hasExistingAccounts = Object.values(socialMediaAccounts).some((val: any) => val && String(val).trim() !== '' && String(val) !== '1');

        if (hasNewAccounts || !hasExistingAccounts) {
          setSocialMediaAccounts(newAccounts);

          try {
            const cachedData = localStorage.getItem('competitor_analysis_data');
            if (cachedData) {
              const parsedData = JSON.parse(cachedData);
              parsedData.social_media_accounts = newAccounts;
              localStorage.setItem('competitor_analysis_data', JSON.stringify(parsedData));
            }
          } catch (e) {
            console.warn('Failed to update cache for social accounts', e);
          }
        } else {
          console.warn('Re-discovery returned no accounts. Keeping existing ones to prevent vanishing.');
        }
      } else {
        console.error('Social media discovery failed:', result.error);
        setError(result.error || 'Social media discovery failed');
      }
    } catch (err) {
      console.error('Social media discovery error:', err);
      setError(err instanceof Error ? err.message : 'Social media discovery failed');
    } finally {
      setIsDiscoveringSocial(false);
    }
  }, [userUrl, isDiscoveringSocial, socialMediaAccounts, mergeCrawlSocialMedia, setSocialMediaAccounts, setError, setIsDiscoveringSocial]);

  const startSitemapAnalysis = useCallback(async (force = false) => {
    if (isAnalyzingSitemap) return;

    const finalUserUrl = userUrl || localStorage.getItem('website_url') || '';
    const stateKey = 'alwrity_sitemap_state';

    if (!force && finalUserUrl) {
      try {
        const dbResp = await aiApiClient.get('/api/onboarding/step3/sitemap-analysis', {
          params: { user_url: finalUserUrl }
        });
        if (dbResp?.data?.success && dbResp.data.sitemap_analysis) {
          const cached = dbResp.data.sitemap_analysis;
          console.log('[sitemap] Loaded persisted analysis from DB');
          setSitemapAnalysis(cached);
          updateCacheWithSitemapAnalysis(cached);
          return;
        }
      } catch (e) {
        console.warn('[sitemap] DB lookup failed, will fall through to LLM', e);
      }
    }

    if (!force && finalUserUrl) {
      try {
        const prev = JSON.parse(localStorage.getItem(stateKey) || 'null');
        if (prev && prev.url === finalUserUrl) {
          const ageMs = Date.now() - (prev.ts || 0);
          if (prev.status === 'inflight' && ageMs < 5 * 60_000) {
            console.log('[sitemap] Blocked: already inflight');
            return;
          }
          if (prev.status === 'done' && ageMs < 24 * 60 * 60_000) {
            console.log('[sitemap] Blocked: completed within 24h');
            return;
          }
        }
      } catch { /* corrupted — ignore */ }
    }

    setIsAnalyzingSitemap(true);
    if (force) {
      setSitemapAnalysis(null);
    }

    if (finalUserUrl) {
      try {
        localStorage.setItem(stateKey, JSON.stringify({ url: finalUserUrl, status: 'inflight', ts: Date.now() }));
      } catch { /* non-critical */ }
    }

    try {
      const competitorDomains = competitors.map(c => c.domain).filter(Boolean);

      console.log('[sitemap] Starting analysis for:', finalUserUrl);

      const response = await aiApiClient.post('/api/onboarding/step3/analyze-sitemap', {
        user_url: finalUserUrl,
        competitors: competitorDomains,
        industry_context: industryContext,
        analyze_content_trends: true,
        analyze_publishing_patterns: true,
        force
      });

      const result = response.data;

      if (result.success) {
        console.log('[sitemap] Analysis completed successfully');
        setSitemapAnalysis(result);
        updateCacheWithSitemapAnalysis(result);

        if (finalUserUrl) {
          try {
            localStorage.setItem(stateKey, JSON.stringify({ url: finalUserUrl, status: 'done', ts: Date.now() }));
          } catch { /* non-critical */ }
        }
      } else if (result.error === 'analysis_in_progress') {
        console.log('[sitemap] Backend busy — another request running');
      } else {
        console.error('[sitemap] Analysis failed:', result.error);
        setError(result.error || 'Sitemap analysis failed');
        if (finalUserUrl) localStorage.removeItem(stateKey);
      }
    } catch (err) {
      console.error('[sitemap] Request error:', err);
      setError(err instanceof Error ? err.message : 'Sitemap analysis failed');
      if (finalUserUrl) localStorage.removeItem(stateKey);
    } finally {
      setIsAnalyzingSitemap(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userUrl, competitors, industryContext, isAnalyzingSitemap]);

  useEffect(() => {
    if (initialData?.sitemapAnalysis) {
      setSitemapAnalysis(initialData.sitemapAnalysis);
    }
  }, [initialData?.sitemapAnalysis, setSitemapAnalysis]);

  useEffect(() => {
    if (competitors.length > 0 && !sitemapAnalysis) {
      const cachedData = localStorage.getItem('competitor_analysis_data');
      if (cachedData) {
        try {
          const parsedData = JSON.parse(cachedData);
          if (parsedData.sitemap_analysis) {
            setSitemapAnalysis(parsedData.sitemap_analysis);
          }
        } catch (err) {
          console.warn('Error loading cached sitemap analysis:', err);
        }
      }
    }
  }, [competitors.length, sitemapAnalysis, setSitemapAnalysis]);

  useEffect(() => {
    if (
      competitors.length > 0 &&
      !sitemapAnalysis &&
      !isAnalyzing &&
      !isAnalyzingSitemap &&
      !sitemapAutoTriggered.current
    ) {
      if (initialData?.sitemapAnalysis) return;

      let hasCached = false;
      try {
        const cachedData = JSON.parse(localStorage.getItem('competitor_analysis_data') || 'null');
        if (cachedData?.sitemap_analysis) {
          setSitemapAnalysis(cachedData.sitemap_analysis);
          hasCached = true;
        }
      } catch {
        // Corrupted cache — treat as absent
      }
      if (hasCached) {
        console.log('CompetitorAnalysisStep: Using cached sitemap analysis, skipping auto-trigger');
        return;
      }

      sitemapAutoTriggered.current = true;
      console.log('CompetitorAnalysisStep: Auto-triggering sitemap analysis');
      startSitemapAnalysis(false);
    }
  }, [competitors.length, isAnalyzing, sitemapAnalysis, isAnalyzingSitemap, startSitemapAnalysis, initialData?.sitemapAnalysis, sitemapAutoTriggered, setSitemapAnalysis]);

  useEffect(() => {
    if (!competitors.length || isAnalyzing) return;
    let cancelled = false;
    setBenchmarkLoading(true);
    longRunningApiClient.get('/api/onboarding/step3/sitemap-benchmark-report')
      .then((resp) => {
        if (!cancelled) setBenchmarkReport(resp.data || null);
      })
      .catch(() => {
        if (!cancelled) setBenchmarkReport(null);
      })
      .finally(() => {
        if (!cancelled) setBenchmarkLoading(false);
      });
    return () => { cancelled = true; };
  }, [competitors.length, isAnalyzing]);

  const normalizeCompetitorUrl = (c: Competitor): string | null => {
    const raw = (c?.url || c?.domain || '').trim();
    if (!raw) return null;
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
      ? raw
      : `https://${raw}`;
    return candidate;
  };

  const runSitemapBenchmark = async () => {
    const validCompetitors = competitors
      .map(normalizeCompetitorUrl)
      .filter((u): u is string => !!u);
    setBenchmarkError(null);
    if (!validCompetitors.length) {
      setBenchmarkError('No competitor URLs available. Add or refresh competitors before running the benchmark.');
      return;
    }
    setIsRunningBenchmark(true);
    try {
      await longRunningApiClient.post('/api/seo/competitive-sitemap-benchmarking/run', {
        max_competitors: 5,
        competitors: validCompetitors.slice(0, 5)
      });
      setBenchmarkError(null);
      for (let attempt = 0; attempt < 12; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        try {
          const resp = await aiApiClient.get('/api/onboarding/step3/sitemap-benchmark-report');
          const report = resp.data || resp.data?.benchmark;
          if (report && (report?.competitors?.summaries || report?.competitors?.errors)) {
            setBenchmarkReport(report);
            break;
          }
        } catch {
          break;
        }
      }
    } catch (err) {
      console.warn('Sitemap benchmark run failed (may already be running):', err);
      setBenchmarkError('Failed to start the sitemap benchmark. Please try again.');
    }
    setIsRunningBenchmark(false);
  };

  const getResearchData = useCallback(() => {
    return {
      competitors,
      social_media_accounts: socialMediaAccounts,
      researchSummary,
      sitemapAnalysis,
      userUrl,
      industryContext,
      analysisTimestamp: new Date().toISOString()
    };
  }, [competitors, socialMediaAccounts, researchSummary, sitemapAnalysis, userUrl, industryContext]);

  useEffect(() => {
    if (onDataReady) {
      console.log('CompetitorAnalysisStep: Exposing data collection function to parent');
      const safeGetData = () => {
        console.log('CompetitorAnalysisStep: getResearchData called');
        return getResearchData();
      };
      onDataReady(safeGetData);
    }
  }, [onDataReady, getResearchData]);

  useEffect(() => {
    if (!onValidationChange) return;

    if (missingData || isAnalyzing) {
      onValidationChange(false);
      return;
    }

    onValidationChange(isStepDataValid(1, getResearchData(), 'website'));
  }, [
    onValidationChange,
    missingData,
    isAnalyzing,
    getResearchData,
    competitors,
    researchSummary,
    sitemapAnalysis,
  ]);

  const handleUpdateSocialAccounts = (newAccounts: { [key: string]: string }) => {
    setSocialMediaAccounts(newAccounts);
    try {
      const cachedData = localStorage.getItem('competitor_analysis_data');
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        parsedData.social_media_accounts = newAccounts;
        localStorage.setItem('competitor_analysis_data', JSON.stringify(parsedData));
      }
    } catch (e) {
      console.warn('Failed to update cache for social accounts', e);
    }
  };

  const handleRemoveCompetitor = (index: number) => {
    const removed = competitors[index];
    const newCompetitors = [...competitors];
    newCompetitors.splice(index, 1);
    setCompetitors(newCompetitors);
    try {
      if (newCompetitors.length === 0) {
        localStorage.removeItem('competitor_analysis_data');
        localStorage.removeItem('competitor_analysis_url');
        localStorage.removeItem('competitor_analysis_timestamp');
        console.log('Cleared competitor cache after deleting last competitor');
      } else {
        const cachedData = localStorage.getItem('competitor_analysis_data');
        if (cachedData) {
          const parsedData = JSON.parse(cachedData);
          parsedData.competitors = newCompetitors;
          localStorage.setItem('competitor_analysis_data', JSON.stringify(parsedData));
        }
      }
    } catch (e) {
      console.warn('Failed to update cache for competitors', e);
    }
    const removedUrl = removed?.url || removed?.domain || '';
    if (removedUrl) {
      longRunningApiClient.delete('/api/onboarding/competitor-analysis', { params: { competitor_url: removedUrl } })
        .then(() => console.log('Deleted competitor from DB:', removedUrl))
        .catch((e: any) => console.warn('Failed to delete competitor from DB:', e));
    }
  };

  const handleAddCompetitor = (competitor: Competitor) => {
    const newCompetitors = [...competitors, competitor];
    setCompetitors(newCompetitors);
    try {
      const cachedData = localStorage.getItem('competitor_analysis_data');
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        parsedData.competitors = newCompetitors;
        localStorage.setItem('competitor_analysis_data', JSON.stringify(parsedData));
      }
    } catch (e) {
      console.warn('Failed to update cache for competitors', e);
    }
  };

  return {
    discoverSocialMedia,
    startSitemapAnalysis,
    benchmarkReport,
    benchmarkLoading,
    isRunningBenchmark,
    benchmarkError,
    setBenchmarkError,
    runSitemapBenchmark,
    handleUpdateSocialAccounts,
    handleRemoveCompetitor,
    handleAddCompetitor,
  };
}
