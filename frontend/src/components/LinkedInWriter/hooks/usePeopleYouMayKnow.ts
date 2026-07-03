import { useCallback, useEffect, useState } from 'react';
import {
  linkedInPymkApi,
  PYMK_COHORT_OPTIONS,
  type PymkCohort,
  type PymkCohortDefaults,
  type PymkListResponse,
  type PymkSuggestionItem,
} from '../../../services/linkedInPymkApi';

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

export function usePeopleYouMayKnow() {
  const [data, setData] = useState<PymkListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [cohort, setCohort] = useState<PymkCohort>('recent_activity');
  const [cohortId, setCohortId] = useState('');
  const [cohortDefaults, setCohortDefaults] = useState<PymkCohortDefaults | null>(null);

  useEffect(() => {
    void linkedInPymkApi.fetchCohortDefaults()
      .then((defaults) => setCohortDefaults(defaults))
      .catch(() => undefined);
  }, []);

  const fetchSuggestions = useCallback(
    async (opts?: { append?: boolean; pageStart?: number }) => {
      const pageStart = opts?.pageStart ?? 0;
      const append = opts?.append ?? false;
      const effectiveCohortId = cohortId.trim() || defaultIdForCohort(cohort, cohortDefaults);

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setData(null);
      }
      setError('');

      try {
        const response = await linkedInPymkApi.fetchSuggestions({
          cohort,
          pageStart,
          pageSize: PAGE_SIZE,
          cohortId: effectiveCohortId || undefined,
        });

        if (response.cohort !== cohort) {
          throw new Error('Cohort mismatch in PYMK response. Please reload.');
        }

        setData((prev) => {
          if (!append || !prev || prev.cohort !== cohort) {
            return response;
          }
          const merged: PymkListResponse = {
            ...response,
            suggestions: mergeSuggestions(prev.suggestions, response.suggestions),
          };
          return merged;
        });

        return response;
      } catch (err: unknown) {
        // Extract detailed error information from the response
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

        // Build user-friendly error message based on error type
        let message: string;
        const errorCode = typeof detail === 'object' ? detail?.error_code : null;
        const detailMessage = typeof detail === 'object' ? detail?.message : typeof detail === 'string' ? detail : null;

        if (status === 401) {
          if (errorCode === 'NOT_CONNECTED') {
            message = detailMessage || 'LinkedIn not connected. Please connect your LinkedIn profile in Settings.';
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
          // Generic error - use server message or fallback
          message =
            detailMessage ||
            (err instanceof Error ? err.message : 'Failed to load People You May Know');
        }

        // Log detailed error for debugging
        console.error('[PYMK] Fetch failed:', {
          status,
          errorCode,
          message: detailMessage,
          append,
          cohort,
          pageStart,
        });

        setError(message);
        if (!append) {
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
      // Error is already handled in fetchSuggestions, but we log for debugging
      console.error('[PYMK] Load more failed:', err);
    }
  }, [data, fetchSuggestions, loadingMore]);

  const refresh = useCallback(async () => {
    setData(null);
    await fetchSuggestions({ pageStart: 0 });
  }, [fetchSuggestions]);

  const changeCohort = useCallback(
    (next: PymkCohort) => {
      setCohort(next);
      setCohortId(defaultIdForCohort(next, cohortDefaults));
      setData(null);
      setError('');
    },
    [cohortDefaults],
  );

  const changeCohortId = useCallback((value: string) => {
    setCohortId(value);
    setData(null);
    setError('');
  }, []);

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
