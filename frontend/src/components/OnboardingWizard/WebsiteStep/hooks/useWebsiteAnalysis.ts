import { useState, useEffect, useRef } from 'react';
import type { StyleAnalysis } from '../components/UnifiedAnalysisContainer/types';
import { 
  AnalysisProgress,
  ExistingAnalysis,
  INITIAL_PROGRESS_STEPS
} from '../utils/constants';
import {
  fixUrlFormat,
  checkExistingAnalysis,
  loadExistingAnalysis,
  performAnalysis,
  fetchLastAnalysis,
  extractDomainName
} from '../utils/websiteUtils';

interface UseWebsiteAnalysisProps {
  setSuccess: (msg: string | null) => void;
  setError: (msg: string | null) => void;
  setAnalysisWarning: (msg: string | null) => void;
}

export function useWebsiteAnalysis({
  setSuccess,
  setError,
  setAnalysisWarning
}: UseWebsiteAnalysisProps) {
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<StyleAnalysis | null>(null);
  const [crawlResult, setCrawlResult] = useState<any>(null);
  const [existingAnalysis, setExistingAnalysis] = useState<ExistingAnalysis | null>(null);
  const [domainName, setDomainName] = useState<string>('');
  const [hasCheckedExisting, setHasCheckedExisting] = useState(false);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress[]>(INITIAL_PROGRESS_STEPS);
  const urlWasPreFilledRef = useRef(false);

  // A. Load active analysis from previous session silently on mount (Auto-hydration)
  useEffect(() => {
    const loadLastAnalysis = async () => {
      console.log('[useWebsiteAnalysis] Checking for active session on mount...');
      try {
        const result = await fetchLastAnalysis();
        if (result.success) {
          if (result.website) {
            setWebsite(result.website);
            urlWasPreFilledRef.current = true; // Mark as pre-filled to bypass inline alert checks
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
      }
    };
    loadLastAnalysis();
  }, []);

  // B. Handle typing URL: reset checking states, clear mismatched active dashboards
  useEffect(() => {
    if (website.trim()) {
      if (urlWasPreFilledRef.current) {
        setHasCheckedExisting(true);
        urlWasPreFilledRef.current = false;
        return;
      }
      setHasCheckedExisting(false);
      setExistingAnalysis(null);

      // Clear mismatched old content to prevent confusing UI while typing
      setAnalysis(null);
      setCrawlResult(null);
      setDomainName('');
      setError(null);
      setSuccess(null);
      setAnalysisWarning(null);
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
        setDomainName(result.domainName || extractDomainName(website));
        setAnalysis(result.analysis);
        setCrawlResult(result.crawlResult);
        setAnalysisWarning(result.warning || null);
        setSuccess('Previous analysis loaded successfully!');

        // Sync to local storage for downstream steps
        const fixedUrl = fixUrlFormat(website) || website;
        localStorage.setItem('website_url', fixedUrl);
        localStorage.setItem('website_analysis_data', JSON.stringify(result.analysis));
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
      // 1. Double check database first to prevent duplicate LLM/crawler API waste
      if (!isExplicitReanalyze) {
        console.log('[useWebsiteAnalysis] Pre-analysis guard checking URL:', fixedUrl);
        const result = await checkExistingAnalysis(fixedUrl);
        if (result.exists && result.analysis) {
          console.log('[useWebsiteAnalysis] Intercepted request: loaded existing to save API calls.');
          setExistingAnalysis(result.analysis);
          
          const loadResult = await loadExistingAnalysis(result.analysis.analysis_id, fixedUrl);
          if (loadResult.success) {
            setDomainName(loadResult.domainName || extractDomainName(fixedUrl));
            setAnalysis(loadResult.analysis);
            setCrawlResult(loadResult.crawlResult);
            setSuccess('We found and loaded your previous analysis to save you time and API resources!');
            
            localStorage.setItem('website_url', fixedUrl);
            localStorage.setItem('website_analysis_data', JSON.stringify(loadResult.analysis));
          } else {
            setError('Failed to load existing analysis database record.');
          }
          setLoading(false);
          return;
        }
      }

      // 2. Real crawler + analysis execution (for new URLs or explicit Re-Analyze requests)
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

        localStorage.setItem('website_url', fixedUrl);
        localStorage.setItem('website_analysis_data', JSON.stringify(analysisResult.analysis));

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
    urlWasPreFilledRef.current = false;

    localStorage.removeItem('website_url');
    localStorage.removeItem('website_analysis_data');
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
    progress,
    handleAnalyze,
    handleLoadExistingConfirm,
    handleStartFresh,
  };
}
