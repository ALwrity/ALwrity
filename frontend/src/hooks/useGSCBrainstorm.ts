import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  gscBrainstormAPI,
  BrainstormResult,
  ContentOpportunity,
  KeywordGap,
  QuickWin,
  PageOpportunity,
  AIRecommendations,
  AIRecommendation,
  BrainstormSummary,
} from '../api/gscBrainstorm';
import { useGSCBrainstormConnection } from './useGSCBrainstormConnection';

interface UseGSCBrainstormReturn {
  gscConnected: boolean;
  gscSites: { siteUrl: string; permissionLevel: string }[] | null;
  isConnecting: boolean;
  connectError: string | null;
  isBrainstorming: boolean;
  brainstormError: string | null;
  brainstormResult: BrainstormResult | null;
  contentOpportunities: ContentOpportunity[];
  keywordGaps: KeywordGap[];
  quickWins: QuickWin[];
  pageOpportunities: PageOpportunity[];
  aiRecommendations: AIRecommendations | null;
  summary: BrainstormSummary | null;
  connectGSC: () => Promise<void>;
  brainstorm: (keywords: string, siteUrl?: string, forceRefresh?: boolean) => Promise<BrainstormResult | null>;
  reset: () => void;
  progressMessage: string;
  lastKeywords: string;
}

const PROGRESS_MESSAGES = [
  'Fetching your Google Search Console data for the last 30 days...',
  'Analyzing which keywords bring traffic to your site and which ones need work...',
  'Scanning for quick wins — keywords already on page 1 that just need a boost...',
  'Identifying keyword gaps where better content could move you to page 1...',
  'Reviewing your pages for optimization opportunities...',
  'Computing your SEO health score and benchmark metrics...',
  'Generating AI-powered blog post recommendations tailored to your GSC data...',
  'Formatting insights into actionable topic suggestions you can use today...',
];

const LAST_KEYWORDS_KEY = 'gsc_last_keywords';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const readLS = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
};

const writeLS = (key: string, value: string): void => {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, value); } catch { /* quota exceeded */ }
};

export const useGSCBrainstorm = (): UseGSCBrainstormReturn => {
  const { getToken } = useAuth();
  const {
    gscConnected,
    gscSites,
    isConnecting,
    connectError,
    checkConnection,
    connectGSC,
  } = useGSCBrainstormConnection();

  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [brainstormError, setBrainstormError] = useState<string | null>(null);
  const [brainstormResult, setBrainstormResult] = useState<BrainstormResult | null>(null);
  const [progressMessage, setProgressMessage] = useState('');
  const [lastKeywords, setLastKeywords] = useState('');
  const progressIndexRef = useRef(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRestoreDoneRef = useRef(false);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  // Auto-restore last brainstorm on mount
  useEffect(() => {
    if (autoRestoreDoneRef.current) return;
    const savedKw = readLS(LAST_KEYWORDS_KEY);
    if (savedKw && savedKw.trim()) {
      setLastKeywords(savedKw.trim());
      // Restore cached result for this keyword
      const cacheKey = makeCacheKey(savedKw.trim());
      const cached = readLS(cacheKey);
      if (cached) {
        try {
          const parsed: BrainstormResult = JSON.parse(cached);
          if (parsed && !parsed.error && parsed.content_opportunities?.length && isFresh(parsed)) {
            setBrainstormResult(parsed);
          }
        } catch { /* ignore corrupt cache */ }
      }
    }
    autoRestoreDoneRef.current = true;
  }, []);

  const startProgressMessages = () => {
    progressIndexRef.current = 0;
    setProgressMessage(PROGRESS_MESSAGES[0]);
    progressTimerRef.current = setInterval(() => {
      progressIndexRef.current += 1;
      if (progressIndexRef.current < PROGRESS_MESSAGES.length) {
        setProgressMessage(PROGRESS_MESSAGES[progressIndexRef.current]);
      } else if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    }, 3000);
  };

  const stopProgressMessages = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setProgressMessage('');
  };

  const makeCacheKey = (keywords: string, siteUrl?: string) => {
    const norm = keywords.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200);
    return `gsc_brainstorm_${norm}_${siteUrl || ''}`;
  };

  const isFresh = (result: BrainstormResult): boolean => {
    const ts = (result as any)._cachedAt;
    if (!ts) return false;
    return Date.now() - ts < CACHE_TTL;
  };

  const brainstorm = useCallback(
    async (keywords: string, siteUrl?: string, forceRefresh?: boolean): Promise<BrainstormResult | null> => {
      setIsBrainstorming(true);
      setBrainstormError(null);
      startProgressMessages();

      const cacheKey = makeCacheKey(keywords, siteUrl);

      if (!forceRefresh) {
        const cached = readLS(cacheKey);
        if (cached) {
          try {
            const parsed: BrainstormResult = JSON.parse(cached);
            if (parsed && !parsed.error && parsed.content_opportunities?.length && isFresh(parsed)) {
              setBrainstormResult(parsed);
              stopProgressMessages();
              setIsBrainstorming(false);
              return parsed;
            }
          } catch { /* cache read failed — proceed with API call */ }
        }
      }

      try {
        gscBrainstormAPI.setAuthTokenGetter(async () => {
          try { return await getToken(); } catch { return null; }
        });

        const result = await gscBrainstormAPI.brainstorm(keywords, siteUrl, forceRefresh);
        setBrainstormResult(result);
        if (result && !result.error) {
          (result as any)._cachedAt = Date.now();
          writeLS(cacheKey, JSON.stringify(result));
          // Persist last keywords
          setLastKeywords(keywords.trim());
          writeLS(LAST_KEYWORDS_KEY, keywords.trim());
        }
        return result;
      } catch (error: any) {
        let message = 'Failed to brainstorm topics. Please try again.';
        if (error?.response?.data?.detail) {
          message = error.response.data.detail;
        } else if (error instanceof Error) {
          message = error.message;
        }
        setBrainstormError(message);
        return null;
      } finally {
        setIsBrainstorming(false);
        stopProgressMessages();
      }
    },
    [getToken],
  );

  const reset = useCallback(() => {
    setBrainstormResult(null);
    setBrainstormError(null);
    setIsBrainstorming(false);
    stopProgressMessages();
  }, []);

  return {
    gscConnected,
    gscSites,
    isConnecting,
    connectError,
    isBrainstorming,
    brainstormError,
    brainstormResult,
    contentOpportunities: brainstormResult?.content_opportunities ?? [],
    keywordGaps: brainstormResult?.keyword_gaps ?? [],
    quickWins: brainstormResult?.quick_wins ?? [],
    pageOpportunities: brainstormResult?.page_opportunities ?? [],
    aiRecommendations: brainstormResult?.ai_recommendations
      && Array.isArray(brainstormResult.ai_recommendations?.immediate_opportunities)
      ? (brainstormResult.ai_recommendations as AIRecommendations)
      : null,
    summary: brainstormResult?.summary
      && brainstormResult.summary.site_url
      ? (brainstormResult.summary as BrainstormSummary)
      : null,
    connectGSC,
    brainstorm,
    reset,
    progressMessage,
    lastKeywords,
  };
};

export default useGSCBrainstorm;
