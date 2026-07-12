import { useCallback, useEffect, useState } from 'react';
import {
  linkedInPymkApi,
  PYMK_COHORT_OPTIONS,
  type PymkCohort,
  type PymkCohortDefaults,
  type PymkListResponse,
  type PymkSuggestionItem,
} from '../../../services/linkedInPymkApi';
import {
  clearPymkSessionCache,
  getPymkDefaultsSessionCache,
  getPymkSessionCache,
  setPymkDefaultsSessionCache,
  setPymkSessionCache,
  type PymkCacheKey,
} from '../utils/pymkSessionCache';

const PAGE_SIZE = 10;

function defaultIdForCohort(
  cohort: PymkCohort,
  defaults: PymkCohortDefaults | null,
): string {
  if (!defaults) return '';
  const option = PYMK_COHORT_OPTIONS.find((item) => item.id === cohort);
  if (!option?.defaultsKey) return '';
  const value = defaults[option.defaultsKey];
  return value ? String(value) : '';
}

function buildCacheKey(cohort: PymkCohort, cohortId: string, defaults: PymkCohortDefaults | null): PymkCacheKey {
  const effectiveId = cohortId.trim() || defaultIdForCohort(cohort, defaults);
  return { cohort, cohortId: effectiveId };
}

export function usePeopleYouMayKnow() {
  const [data, setData] = useState<PymkListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [cohort, setCohort] = useState<PymkCohort>('recent_activity');
  const [cohortId, setCohortId] = useState('');
  const [cohortDefaults, setCohortDefaults] = useState<PymkCohortDefaults | null>(() =>
    getPymkDefaultsSessionCache(),
  );

  useEffect(() => {
    const cachedDefaults = getPymkDefaultsSessionCache();
    if (cachedDefaults) {
      setCohortDefaults(cachedDefaults);
    }

    void linkedInPymkApi
      .fetchCohortDefaults()
      .then((defaults) => {
        setCohortDefaults(defaults);
        setPymkDefaultsSessionCache(defaults);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const cacheKey = buildCacheKey(cohort, cohortId, cohortDefaults);
    const cached = getPymkSessionCache(cacheKey);
    if (cached && cached.cohort === cohort) {
      setData(cached);
      setError('');
    }
  }, [cohort, cohortId, cohortDefaults]);

  const fetchSuggestions = useCallback(
    async (opts?: { append?: boolean; pageStart?: number; refresh?: boolean }) => {
      const pageStart = opts?.pageStart ?? 0;
      const append = opts?.append ?? false;
      const forceRefresh = opts?.refresh ?? false;
      const effectiveCohortId = cohortId.trim() || defaultIdForCohort(cohort, cohortDefaults);
      const cacheKey = buildCacheKey(cohort, cohortId, cohortDefaults);

      if (!append && pageStart === 0 && !forceRefresh) {
        const sessionCached = getPymkSessionCache(cacheKey);
        if (sessionCached && sessionCached.cohort === cohort) {
          setData(sessionCached);
          setError('');
          return sessionCached;
        }
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        if (forceRefresh) {
          setData(null);
        }
      }
      setError('');

      try {
        const response = await linkedInPymkApi.fetchSuggestions({
          cohort,
          pageStart,
          pageSize: PAGE_SIZE,
          cohortId: effectiveCohortId || undefined,
          refresh: forceRefresh && pageStart === 0,
        });

        if (response.cohort !== cohort) {
          throw new Error('Cohort mismatch in PYMK response. Please reload.');
        }

        setData((prev) => {
          const next: PymkListResponse =
            !append || !prev || prev.cohort !== cohort
              ? response
              : {
                  ...response,
                  suggestions: mergeSuggestions(prev.suggestions, response.suggestions),
                };
          setPymkSessionCache(cacheKey, next);
          return next;
        });

        return response;
      } catch (err: unknown) {
        const axiosError = err as {
          response?: {
            status?: number;
            data?: {
              detail?: { error_code?: string; message?: string } | string;
            };
          };
        };
        const status = axiosError.response?.status;
        const detail = axiosError.response?.data?.detail;

        let message: string;
        const errorCode = typeof detail === 'object' ? detail?.error_code : null;
        const detailMessage =
          typeof detail === 'object' ? detail?.message : typeof detail === 'string' ? detail : null;

        if (status === 401) {
          if (errorCode === 'NOT_CONNECTED') {
            message =
              detailMessage || 'LinkedIn not connected. Please connect your LinkedIn profile in Settings.';
          } else {
            message = 'Authentication failed. Please sign in again.';
          }
        } else if (status === 429) {
          message = 'Too many requests to LinkedIn. Please wait a minute and try again.';
        } else if (status === 502 && errorCode === 'MEDIA_FETCH_FAILED') {
          message = 'Could not load LinkedIn profile images. The images may be temporarily unavailable.';
        } else if (status === 502 && errorCode === 'PYMK_FETCH_FAILED') {
          message = detailMessage || 'LinkedIn is temporarily unavailable. Please try again in a moment.';
        } else if (status === 400 && errorCode === 'INVALID_REQUEST') {
          message = detailMessage || 'Invalid request. Please check your filters and try again.';
        } else if (errorCode === 'INVALID_COHORT') {
          message = detailMessage || 'Invalid filter selected. Please choose a different option.';
        } else {
          message =
            detailMessage ||
            (err instanceof Error ? err.message : 'Failed to load People You May Know');
        }

        console.error('[PYMK] Fetch failed:', {
          status,
          errorCode,
          message: detailMessage,
          append,
          cohort,
          pageStart,
        });

        setError(message);
        if (!append && !getPymkSessionCache(cacheKey)) {
          setData(null);
        }
        throw err;
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [cohort, cohortId, cohortDefaults],
  );

  const loadMore = useCallback(async () => {
    if (!data?.has_more || loadingMore) return;
    const nextStart = (data.page_start ?? 0) + (data.page_size ?? PAGE_SIZE);
    try {
      await fetchSuggestions({ append: true, pageStart: nextStart });
    } catch (err) {
      console.error('[PYMK] Load more failed:', err);
    }
  }, [data, fetchSuggestions, loadingMore]);

  const refresh = useCallback(async () => {
    const cacheKey = buildCacheKey(cohort, cohortId, cohortDefaults);
    clearPymkSessionCache(cacheKey);
    setData(null);
    await fetchSuggestions({ pageStart: 0, refresh: true });
  }, [cohort, cohortId, cohortDefaults, fetchSuggestions]);

  const changeCohort = useCallback(
    (next: PymkCohort) => {
      const nextId = defaultIdForCohort(next, cohortDefaults);
      setCohort(next);
      setCohortId(nextId);
      setError('');
      const cached = getPymkSessionCache({ cohort: next, cohortId: nextId });
      setData(cached && cached.cohort === next ? cached : null);
    },
    [cohortDefaults],
  );

  const changeCohortId = useCallback(
    (value: string) => {
      setCohortId(value);
      setError('');
      const cached = getPymkSessionCache(buildCacheKey(cohort, value, cohortDefaults));
      setData(cached && cached.cohort === cohort ? cached : null);
    },
    [cohort, cohortDefaults],
  );

  const visibleData = data && data.cohort === cohort ? data : null;

  return {
    data: visibleData,
    loading,
    loadingMore,
    error,
    cohort,
    setCohort: changeCohort,
    cohortId,
    setCohortId: changeCohortId,
    cohortDefaults,
    fetchSuggestions,
    loadMore,
    refresh,
  };
}

function mergeSuggestions(
  existing: PymkSuggestionItem[],
  incoming: PymkSuggestionItem[],
): PymkSuggestionItem[] {
  const seen = new Set(existing.map((item) => item.profile_id));
  const merged = [...existing];
  for (const item of incoming) {
    if (!seen.has(item.profile_id)) {
      seen.add(item.profile_id);
      merged.push(item);
    }
  }
  return merged;
}
