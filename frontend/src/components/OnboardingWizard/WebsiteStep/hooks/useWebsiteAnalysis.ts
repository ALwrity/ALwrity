import { useState, useEffect, useRef } from 'react';
import type { StyleAnalysis } from '../components/UnifiedAnalysisContainer/types';
import {
  AnalysisProgress,
  ExistingAnalysis,
  INITIAL_PROGRESS_STEPS,
} from '../utils/constants';
import {
  fixUrlFormat,
  checkExistingAnalysis,
  loadExistingAnalysis,
  performAnalysis,
  fetchLastAnalysis,
  extractDomainName,
} from '../utils/websiteUtils';
import {
  getStoredWebsiteUrl,
  isWebsiteStartFreshSession,
  markDownstreamDirty,
} from '../../utils/onboardingWebsiteReset';
import {
  resetWebsiteInputForStartFresh,
  resolveWebsiteAnalysisWizardNotify,
} from '../../utils/onboardingWebsiteSessionChange';
import {
  clearDownstreamForWebsiteChange,
  ONBOARDING_STORAGE_KEYS,
  syncWebsiteAnalysisStorage,
} from '../../common/onboardingStorageKeys';
import {
  resolveLoadedAnalysisWebsiteUrl,
  stageTypedWebsiteUrl,
} from '../../common/wizardLiveWebsiteSession';

interface UseWebsiteAnalysisProps {
  setSuccess: (msg: string | null) => void;
  setError: (msg: string | null) => void;
  setAnalysisWarning: (msg: string | null) => void;
  onWebsiteAnalysisChanged?: (params: {
    websiteUrl: string;
    reason: 'reanalyze' | 'new_website' | 'start_fresh' | 'load_existing';
  }) => void | Promise<void>;
  onLiveWebsiteSessionChange?: (payload: {
    website: string;
    analysis: StyleAnalysis | null;
  }) => void;
}

export function useWebsiteAnalysis({
  setSuccess,
  setError,
  setAnalysisWarning,
  onWebsiteAnalysisChanged,
  onLiveWebsiteSessionChange,
}: UseWebsiteAnalysisProps) {
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<StyleAnalysis | null>(null);
  const [crawlResult, setCrawlResult] = useState<any>(null);
  const [existingAnalysis, setExistingAnalysis] = useState<ExistingAnalysis | null>(null);
  const [domainName, setDomainName] = useState<string>('');
  const [hasCheckedExisting, setHasCheckedExisting] = useState(false);
  const [isHydratingAnalysis, setIsHydratingAnalysis] = useState(true);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress[]>(INITIAL_PROGRESS_STEPS);
  const urlWasPreFilledRef = useRef(false);
  const userChangedUrlRef = useRef(false);
  const lastCommittedAnalysisUrlRef = useRef<string>(getStoredWebsiteUrl());

  const notifyLiveWebsiteSession = (
    nextWebsite: string,
    nextAnalysis: StyleAnalysis | null
  ) => {
    onLiveWebsiteSessionChange?.({
      website: nextWebsite,
      analysis: nextAnalysis,
    });
  };

  const notifyWebsiteAnalysisChanged = async (
    websiteUrl: string,
    reason: 'reanalyze' | 'new_website' | 'start_fresh' | 'load_existing'
  ) => {
    markDownstreamDirty();
    lastCommittedAnalysisUrlRef.current = websiteUrl;
    try {
      await onWebsiteAnalysisChanged?.({ websiteUrl, reason });
    } catch (err) {
      console.error('[useWebsiteAnalysis] Failed to invalidate downstream onboarding state:', err);
    }
  };

  const persistWebsiteSession = async (
    websiteUrl: string,
    nextAnalysis: StyleAnalysis | null,
    reason: 'reanalyze' | 'new_website' | 'start_fresh' | 'load_existing'
  ) => {
    const { didInvalidateDownstream } = syncWebsiteAnalysisStorage(websiteUrl, nextAnalysis);
    notifyLiveWebsiteSession(websiteUrl, nextAnalysis);

    if (
      resolveWebsiteAnalysisWizardNotify({
        reason,
        didInvalidateDownstream,
      })
    ) {
      await notifyWebsiteAnalysisChanged(websiteUrl, reason);
    }
  };

  // A. Load active analysis from previous session silently on mount (Auto-hydration)
  useEffect(() => {
    let cancelled = false;
    const loadLastAnalysis = async () => {
      if (isWebsiteStartFreshSession()) {
        console.log(
          '[useWebsiteAnalysis] Skipping last-analysis hydration during start-fresh session'
        );
        if (!cancelled) setIsHydratingAnalysis(false);
        return;
      }

      console.log('[useWebsiteAnalysis] Checking for active session on mount...');
      setIsHydratingAnalysis(true);
      try {
        const result = await fetchLastAnalysis();
        if (cancelled || userChangedUrlRef.current) {
          console.log('[useWebsiteAnalysis] Ignoring stale last-analysis hydration');
          return;
        }
        if (result.success) {
          if (result.website) {
            setWebsite(result.website);
            urlWasPreFilledRef.current = true;
          }
          if (result.analysis) {
            setAnalysis(result.analysis);
            console.log('[useWebsiteAnalysis] Hydrated active analysis successfully:', result.analysis.id);
          }
          if (result.domainName) {
            setDomainName(result.domainName);
          }
        } else {
          console.log('[useWebsiteAnalysis] No active previous session to pre-fill.');
        }
      } catch (err) {
        console.warn('[useWebsiteAnalysis] Non-critical pre-fill failure:', err);
      } finally {
        if (!cancelled) setIsHydratingAnalysis(false);
      }
    };
    loadLastAnalysis();
    return () => {
      cancelled = true;
    };
  }, []);

  // B. Handle typing URL: reset checking states, clear mismatched active dashboards
  useEffect(() => {
    if (website.trim()) {
      if (urlWasPreFilledRef.current) {
        setHasCheckedExisting(true);
        urlWasPreFilledRef.current = false;
        return;
      }
      userChangedUrlRef.current = true;
      setHasCheckedExisting(false);
      setExistingAnalysis(null);

      setAnalysis(null);
      setCrawlResult(null);
      setDomainName('');
      setError(null);
      setSuccess(null);
      setAnalysisWarning(null);

      const fixedUrl = fixUrlFormat(website);
      if (stageTypedWebsiteUrl(fixedUrl || website)) {
        console.log('[useWebsiteAnalysis] URL changed while typing — clearing downstream caches');
        clearDownstreamForWebsiteChange({ preserveActiveStep: true });
        notifyLiveWebsiteSession(fixedUrl || website, null);
      }
    }
  }, [website, setError, setSuccess, setAnalysisWarning]);

  // C. 300ms Typing Debounce check for the Inline Banner (extremely fast DB lookup)
  useEffect(() => {
    if (website.trim() && !hasCheckedExisting) {
      const checkExisting = async () => {
        const fixedUrl = fixUrlFormat(website);
        if (fixedUrl) {
          console.log('[useWebsiteAnalysis] Debounce check: checking existing analysis for:', fixedUrl);
          try {
            const result = await checkExistingAnalysis(fixedUrl);
            if (result.exists && result.analysis) {
              setExistingAnalysis(result.analysis);
              console.log('[useWebsiteAnalysis] Found previous analysis. Setting inline banner data.');
            }
          } catch (err) {
            console.error('[useWebsiteAnalysis] Error checking existing analysis:', err);
          } finally {
            setHasCheckedExisting(true);
          }
        }
      };

      const timeoutId = setTimeout(checkExisting, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [website, hasCheckedExisting]);

  const updateProgress = (step: number, message: string, subMessage?: string) => {
    setProgress(prev => {
      const existing = prev.find(p => p.step === step);
      if (existing) {
        return prev.map(p =>
          p.step === step ? { ...p, message, subMessage: subMessage || p.subMessage, completed: true } : p
        );
      }
      return [...prev, { step, message, subMessage, completed: true }];
    });
  };

  // D. Confirmed loading action from Inline Banner
  const handleLoadExistingConfirm = async () => {
    if (!existingAnalysis?.analysis_id) return;

    setLoading(true);
    console.log('[useWebsiteAnalysis] Loading previous analysis ID:', existingAnalysis.analysis_id);
    try {
      const result = await loadExistingAnalysis(existingAnalysis.analysis_id, website);
      if (result.success && result.analysis) {
        const bound = resolveLoadedAnalysisWebsiteUrl(
          fixUrlFormat(website) || website,
          result.analysis
        );
        if (bound.error || !bound.url) {
          setError(bound.error || 'Failed to load previous analysis. Please trigger a new one.');
          return;
        }

        setDomainName(result.domainName || extractDomainName(bound.url));
        setAnalysis(result.analysis);
        setCrawlResult(result.crawlResult);
        setAnalysisWarning(result.warning || null);
        setSuccess('Previous analysis loaded successfully!');

        await persistWebsiteSession(bound.url, result.analysis, 'load_existing');
      } else {
        setError('Failed to load previous analysis. Please trigger a new one.');
      }
    } catch (err) {
      console.error('[useWebsiteAnalysis] Failed loading analysis:', err);
      setError('An error occurred loading the analysis.');
    } finally {
      setLoading(false);
    }
  };

  // E. Bulletproof interceptor: prevents API waste on instant paste + click
  const handleAnalyze = async () => {
    const isExplicitReanalyze = !!analysis;
    setError(null);
    setSuccess(null);
    setAnalysisWarning(null);

    const fixedUrl = fixUrlFormat(website);
    if (!fixedUrl) {
      setError('Please enter a valid website URL (starting with http:// or https://)');
      return;
    }

    setLoading(true);

    try {
      if (!isExplicitReanalyze) {
        console.log('[useWebsiteAnalysis] Pre-analysis guard checking URL:', fixedUrl);
        const result = await checkExistingAnalysis(fixedUrl);
        if (result.exists && result.analysis) {
          console.log('[useWebsiteAnalysis] Intercepted request: loaded existing to save API calls.');
          setExistingAnalysis(result.analysis);

          const loadResult = await loadExistingAnalysis(result.analysis.analysis_id, fixedUrl);
          if (loadResult.success && loadResult.analysis) {
            const bound = resolveLoadedAnalysisWebsiteUrl(fixedUrl, loadResult.analysis);
            if (bound.error || !bound.url) {
              setError(bound.error || 'Failed to load existing analysis database record.');
              setLoading(false);
              return;
            }

            setDomainName(loadResult.domainName || extractDomainName(bound.url));
            setAnalysis(loadResult.analysis);
            setCrawlResult(loadResult.crawlResult);
            setSuccess('We found and loaded your previous analysis to save you time and API resources!');

            await persistWebsiteSession(
              bound.url,
              loadResult.analysis,
              'load_existing'
            );
          } else {
            setError('Failed to load existing analysis database record.');
          }
          setLoading(false);
          return;
        }
      }

      console.log('[useWebsiteAnalysis] Triggering fresh crawl & LLM brand voice analysis...');
      setAnalysis(null);
      setCrawlResult(null);
      setProgress(prev => prev.map(p => ({ ...p, completed: false })));
      setIsProgressModalOpen(true);

      const analysisResult = await performAnalysis(fixedUrl, updateProgress);
      if (analysisResult.success) {
        setDomainName(analysisResult.domainName || extractDomainName(fixedUrl));
        setAnalysis(analysisResult.analysis);
        setCrawlResult(analysisResult.crawlResult);
        setAnalysisWarning(analysisResult.warning || null);

        await persistWebsiteSession(
          fixedUrl,
          analysisResult.analysis,
          isExplicitReanalyze ? 'reanalyze' : 'new_website'
        );

        if (analysisResult.warning) {
          setSuccess(`Website style analysis completed successfully! Note: ${analysisResult.warning}`);
        } else {
          setSuccess('Website style analysis completed successfully!');
        }
      } else {
        setError(analysisResult.error || 'Analysis failed');
      }
    } catch (err) {
      console.error('[useWebsiteAnalysis] Real-crawl error boundary caught:', err);
      setError('Failed to analyze website. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
      setTimeout(() => setIsProgressModalOpen(false), 1000);
    }
  };

  // F. Clean "Start Fresh" trigger
  const handleStartFresh = () => {
    console.log('[useWebsiteAnalysis] Clearing previous state data for fresh session.');
    setWebsite('');
    setExistingAnalysis(null);
    setAnalysis(null);
    setCrawlResult(null);
    setDomainName('');
    setError(null);
    setSuccess(null);
    setAnalysisWarning(null);
    setHasCheckedExisting(false);
    setIsHydratingAnalysis(false);
    urlWasPreFilledRef.current = false;
    userChangedUrlRef.current = true;

    resetWebsiteInputForStartFresh();
    notifyLiveWebsiteSession('', null);
    lastCommittedAnalysisUrlRef.current = '';
    void notifyWebsiteAnalysisChanged('', 'start_fresh');
    setProgress(prev => prev.map(p => ({ ...p, completed: false })));
  };

  return {
    website,
    setWebsite,
    loading,
    analysis,
    setAnalysis,
    crawlResult,
    existingAnalysis,
    domainName,
    isProgressModalOpen,
    isHydratingAnalysis,
    progress,
    handleAnalyze,
    handleLoadExistingConfirm,
    handleStartFresh,
  };
}
