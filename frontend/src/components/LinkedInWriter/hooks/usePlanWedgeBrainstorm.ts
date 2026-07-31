import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient, aiApiClient } from '../../../api/client';
import type { PersonalizedIdeaItem } from '../components/Brainstorm/PersonalizedIdeasPanel';

export interface BrainstormOptions {
  usePersona: boolean;
  includeTrending: boolean;
  remarketContent: boolean;
}

export interface BrainstormIdea {
  prompt: string;
  rationale?: string;
  evidence?: string;
  source_index?: number;
}

export interface BrainstormSource {
  title: string;
  url: string;
  snippet: string;
}

interface BrainstormCacheData {
  ideas: BrainstormIdea[];
  sources: BrainstormSource[];
  timestamp: number;
}

export type PlanBrainstormPhase = 'idle' | 'loading' | 'results';

const isBrainstormCacheData = (data: unknown): data is BrainstormCacheData =>
  Boolean(
    data &&
      typeof data === 'object' &&
      Array.isArray((data as BrainstormCacheData).ideas) &&
      typeof (data as BrainstormCacheData).timestamp === 'number'
  );

const LOADER_MESSAGES = [
  'Searching the web for recent coverage...',
  'Analyzing content and extracting insights...',
  'Aligning findings with your persona...',
  'Formulating high-signal brainstorm prompts...',
];

interface UsePlanWedgeBrainstormParams {
  corePersona: unknown;
  platformPersona: unknown;
  onSavedCountChange?: (count: number) => void;
}

export function usePlanWedgeBrainstorm({
  corePersona,
  platformPersona,
  onSavedCountChange,
}: UsePlanWedgeBrainstormParams) {
  const [phase, setPhase] = useState<PlanBrainstormPhase>('idle');
  const [personalizedPhase, setPersonalizedPhase] = useState<PlanBrainstormPhase>('idle');
  const [ideas, setIdeas] = useState<BrainstormIdea[]>([]);
  const [sources, setSources] = useState<BrainstormSource[]>([]);
  const [personalizedIdeas, setPersonalizedIdeas] = useState<PersonalizedIdeaItem[]>([]);
  const [personalizedDataSummary, setPersonalizedDataSummary] = useState('');
  const [seedError, setSeedError] = useState<string | null>(null);
  const [personalizedError, setPersonalizedError] = useState<string | null>(null);
  const [loaderMessageIndex, setLoaderMessageIndex] = useState(0);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [savedPromptHashes, setSavedPromptHashes] = useState<Set<string>>(() => new Set());
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const lastSeedRef = useRef('');
  const lastOptionsRef = useRef<{ seed: string; options: BrainstormOptions } | null>(null);
  const loaderIntervalRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);

  const hashPrompt = useCallback((p: string) => p.trim().toLowerCase(), []);

  const getCacheKey = useCallback(
    (seed: string, personaId?: string, platformPersonaId?: string) =>
      `brainstorm_ideas_v2_${seed}_${personaId || 'default'}_${platformPersonaId || 'default'}`,
    []
  );

  const getCachedIdeas = useCallback((cacheKey: string): BrainstormCacheData | null => {
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (!cached) return null;
      const data = JSON.parse(cached);
      if (isBrainstormCacheData(data) && Date.now() - data.timestamp < 3600000) {
        return data;
      }
      sessionStorage.removeItem(cacheKey);
    } catch {
      /* ignore */
    }
    return null;
  }, []);

  const setCachedIdeas = useCallback(
    (cacheKey: string, data: BrainstormIdea[], src?: BrainstormSource[]) => {
      try {
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({ ideas: data, sources: src || [], timestamp: Date.now() })
        );
      } catch {
        /* ignore */
      }
    },
    []
  );

  const clearLoaderInterval = useCallback(() => {
    if (loaderIntervalRef.current != null) {
      window.clearInterval(loaderIntervalRef.current);
      loaderIntervalRef.current = null;
    }
  }, []);

  const startLoaderAnimation = useCallback(() => {
    clearLoaderInterval();
    setLoaderMessageIndex(0);
    loaderIntervalRef.current = window.setInterval(() => {
      setLoaderMessageIndex((idx) => Math.min(idx + 1, LOADER_MESSAGES.length - 1));
    }, 700);
  }, [clearLoaderInterval]);

  useEffect(() => () => clearLoaderInterval(), [clearLoaderInterval]);

  const refreshSavedHashes = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/brainstorm/saved-ideas', {
        params: { limit: 100, offset: 0 },
      });
      const total = Number(res.data?.total) || 0;
      onSavedCountChange?.(total);
      if (Array.isArray(res.data?.ideas)) {
        setSavedPromptHashes(
          new Set(res.data.ideas.map((it: { prompt: string }) => hashPrompt(it.prompt)))
        );
      }
    } catch {
      /* best-effort */
    }
  }, [hashPrompt, onSavedCountChange]);

  useEffect(() => {
    void refreshSavedHashes();
  }, [refreshSavedHashes]);

  const resetResults = useCallback(() => {
    setPhase('idle');
    setPersonalizedPhase('idle');
    setIdeas([]);
    setSources([]);
    setPersonalizedIdeas([]);
    setPersonalizedDataSummary('');
    setSeedError(null);
    setPersonalizedError(null);
    setIsUsingCache(false);
    clearLoaderInterval();
  }, [clearLoaderInterval]);

  const runPersonalized = useCallback(
    async (seed: string, options: BrainstormOptions, forceRefresh = false) => {
      lastOptionsRef.current = { seed, options };
      setPersonalizedError(null);
      setSeedError(null);
      setSources([]);
      setPersonalizedPhase('loading');
      setPhase('idle');
      startLoaderAnimation();

      try {
        const res = await aiApiClient.post('/api/brainstorm/personalized-ideas', {
          seed,
          count: 5,
          include_trending: options.includeTrending,
          remarket_content: options.remarketContent,
          use_persona: options.usePersona,
        });
        clearLoaderInterval();
        const list = Array.isArray(res.data?.ideas) ? res.data.ideas : [];
        const srcList = Array.isArray(res.data?.sources) ? res.data.sources : [];
        setPersonalizedIdeas(list);
        setPersonalizedDataSummary(res.data?.data_summary || '');
        setSources(srcList);
        if (list.length > 0) {
          setPersonalizedPhase('results');
        } else {
          setPersonalizedPhase('idle');
          setPersonalizedError(
            res.data?.data_summary ||
              'No personalized ideas could be generated. Try different options or connect LinkedIn.'
          );
        }
      } catch (e: unknown) {
        clearLoaderInterval();
        const err = e as { response?: { data?: { detail?: string } }; message?: string };
        setPersonalizedError(
          err?.response?.data?.detail || err?.message || 'Failed to generate personalized ideas'
        );
        setPersonalizedDataSummary('');
        setSources([]);
        setPersonalizedPhase('idle');
      }
    },
    [clearLoaderInterval, startLoaderAnimation]
  );

  const runSeedOnly = useCallback(
    async (seed: string, forceRefresh = false) => {
      lastSeedRef.current = seed;
      setSeedError(null);
      setPersonalizedError(null);
      setPhase('loading');
      setPersonalizedPhase('idle');
      startLoaderAnimation();

      const personaId = (corePersona as { id?: number })?.id?.toString();
      const platformPersonaId = (platformPersona as { id?: number })?.id?.toString();
      const cacheKey = getCacheKey(seed, personaId, platformPersonaId);

      if (!forceRefresh) {
        const cached = getCachedIdeas(cacheKey);
        if (cached) {
          clearLoaderInterval();
          setIdeas(cached.ideas);
          setSources(cached.sources || []);
          setIsUsingCache(true);
          setPhase('results');
          return;
        }
      }

      setIsUsingCache(false);

      try {
        const ir = await aiApiClient.post('/api/brainstorm/ideas', {
          seed,
          persona: corePersona || null,
          platformPersona: platformPersona || null,
          count: 5,
        });
        clearLoaderInterval();
        const list = Array.isArray(ir.data?.ideas) ? ir.data.ideas : [];
        const srcList = Array.isArray(ir.data?.sources) ? ir.data.sources : [];
        setIdeas(list);
        setSources(srcList);
        if (list.length > 0) setCachedIdeas(cacheKey, list, srcList);
      } catch (e: unknown) {
        clearLoaderInterval();
        const err = e as { response?: { data?: { detail?: string } }; message?: string };
        setSeedError(
          err?.response?.data?.detail || err?.message || 'Failed to generate brainstorm ideas'
        );
        setIdeas([]);
      }

      setPhase('results');
    },
    [
      corePersona,
      platformPersona,
      getCacheKey,
      getCachedIdeas,
      setCachedIdeas,
      clearLoaderInterval,
      startLoaderAnimation,
    ]
  );

  const runBrainstorm = useCallback(
    async (seed: string, options: BrainstormOptions, forceRefresh = false) => {
      if (isRunningRef.current) return;
      isRunningRef.current = true;

      const trimmedSeed = seed.trim();
      const hasOptions =
        options.usePersona || options.includeTrending || options.remarketContent;

      if (!trimmedSeed && !hasOptions) {
        isRunningRef.current = false;
        return;
      }

      try {
        if (hasOptions) {
          await runPersonalized(trimmedSeed, options, forceRefresh);
        } else {
          await runSeedOnly(trimmedSeed, forceRefresh);
        }
      } catch (e: unknown) {
        const err = e as { message?: string };
        const msg =
          err?.message ||
          'Unable to reach the server. Check that the backend is running and try again.';
        if (hasOptions) {
          setPersonalizedError(msg);
          setPersonalizedPhase('idle');
        } else {
          setSeedError(msg);
          setPhase('results');
        }
        console.error('[Brainstorm] runBrainstorm failed:', e);
      } finally {
        isRunningRef.current = false;
      }
    },
    [runPersonalized, runSeedOnly]
  );

  const refreshPersonalized = useCallback(async () => {
    const last = lastOptionsRef.current;
    if (!last) return;
    await runPersonalized(last.seed, last.options, true);
  }, [runPersonalized]);

  const retrySeed = useCallback(async () => {
    if (!lastSeedRef.current) return;
    await runSeedOnly(lastSeedRef.current, true);
  }, [runSeedOnly]);

  const handleSaveIdea = useCallback(
    async (idx: number, sourceSeed: string) => {
      const idea = ideas[idx];
      if (!idea) return;
      const prompt = idea.prompt?.trim() || '';
      if (!prompt) return;
      const hash = hashPrompt(prompt);
      if (savedPromptHashes.has(hash)) return;

      setSavingIndex(idx);
      setSaveError(null);
      try {
        await apiClient.post('/api/brainstorm/saved-ideas', {
          prompt,
          rationale: idea.rationale || '',
          source_seed: sourceSeed,
        });
        setSavedPromptHashes((prev) => {
          const next = new Set(prev);
          next.add(hash);
          return next;
        });
        onSavedCountChange?.(savedPromptHashes.size + 1);
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => setSavingIndex(null), 1200);
        void refreshSavedHashes();
      } catch (e: unknown) {
        const err = e as { response?: { data?: { detail?: string } }; message?: string };
        setSaveError(err?.response?.data?.detail || err?.message || 'Failed to save idea');
        setSavingIndex(null);
      }
    },
    [ideas, savedPromptHashes, hashPrompt, onSavedCountChange, refreshSavedHashes]
  );

  const handleSavePersonalizedIdea = useCallback(
    async (idx: number, sourceSeed: string) => {
      const idea = personalizedIdeas[idx];
      if (!idea) return;
      const prompt = idea.title?.trim() || '';
      if (!prompt) return;
      const hash = hashPrompt(prompt);
      if (savedPromptHashes.has(hash)) return;

      setSavingIndex(idx);
      setSaveError(null);
      try {
        await apiClient.post('/api/brainstorm/saved-ideas', {
          prompt,
          rationale: idea.rationale || '',
          source_seed: sourceSeed,
        });
        setSavedPromptHashes((prev) => {
          const next = new Set(prev);
          next.add(hash);
          return next;
        });
        onSavedCountChange?.(savedPromptHashes.size + 1);
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => setSavingIndex(null), 1200);
        void refreshSavedHashes();
      } catch (e: unknown) {
        const err = e as { response?: { data?: { detail?: string } }; message?: string };
        setSaveError(err?.response?.data?.detail || err?.message || 'Failed to save idea');
        setSavingIndex(null);
      }
    },
    [
      personalizedIdeas,
      savedPromptHashes,
      hashPrompt,
      onSavedCountChange,
      refreshSavedHashes,
    ]
  );

  const isLoading = phase === 'loading' || personalizedPhase === 'loading';
  const hasResults =
    phase === 'results' ||
    (personalizedPhase === 'results' && personalizedIdeas.length > 0);
  const activeStep = isLoading ? 2 : hasResults ? 3 : 1;

  const loaderMessages = useMemo(() => LOADER_MESSAGES, []);
  const lastOptions = lastOptionsRef.current?.options;

  return {
    phase,
    personalizedPhase,
    ideas,
    sources,
    personalizedIdeas,
    personalizedDataSummary,
    seedError,
    personalizedError,
    loaderMessageIndex,
    loaderMessages,
    isUsingCache,
    savedPromptHashes,
    savingIndex,
    saveError,
    isLoading,
    hasResults,
    activeStep,
    lastOptions,
    hashPrompt,
    runBrainstorm,
    refreshPersonalized,
    retrySeed,
    handleSaveIdea,
    handleSavePersonalizedIdea,
    resetResults,
  };
}
