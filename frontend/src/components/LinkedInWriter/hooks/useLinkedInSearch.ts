import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getLinkedInSearchErrorMessage,
  getLinkedInSearchErrorType,
  searchLinkedIn,
  type LinkedInSearchCategory as ApiSearchCategory,
} from '../../../api/linkedinSocial';
import {
  DEFAULT_LINKEDIN_SEARCH_CATEGORY,
  LINKEDIN_SEARCH_NOT_CONNECTED_MESSAGE,
} from '../components/search/linkedinSearchConstants';
import type {
  LinkedInSearchCategory,
  LinkedInSearchErrorType,
  LinkedInSearchPaging,
  LinkedInSearchResultItem,
  LinkedInSearchResultType,
  UseLinkedInSearchOptions,
} from '../components/search/linkedinSearchTypes';

const CATEGORY_DEBOUNCE_MS = 300;
const DEFAULT_SEARCH_LIMIT = 10;

const CATEGORY_TO_RESULT_TYPE: Record<LinkedInSearchCategory, LinkedInSearchResultType> = {
  posts: 'POST',
  jobs: 'JOB',
  people: 'PEOPLE',
  companies: 'COMPANY',
};

export interface UseLinkedInSearchReturn {
  query: string;
  category: LinkedInSearchCategory;
  items: LinkedInSearchResultItem[];
  cursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  errorType: LinkedInSearchErrorType | null;
  paging: LinkedInSearchPaging | null;
  modalOpen: boolean;
  hasSearched: boolean;
  setQuery: (value: string) => void;
  setCategory: (category: LinkedInSearchCategory) => void;
  openModal: () => void;
  closeModal: () => void;
  runSearch: (searchQuery?: string) => Promise<void>;
  loadMore: () => Promise<void>;
  reset: () => void;
}

function normalizeSearchItems(
  rawItems: Array<Record<string, unknown>>,
  category: LinkedInSearchCategory
): LinkedInSearchResultItem[] {
  const fallbackType = CATEGORY_TO_RESULT_TYPE[category];

  return rawItems
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const rawType = item.type;
      const type =
        typeof rawType === 'string' && rawType.trim()
          ? (rawType.toUpperCase() as LinkedInSearchResultType)
          : fallbackType;
      return { ...item, type } as LinkedInSearchResultItem;
    });
}

/**
 * LinkedIn search state hook — wired to backend Unipile search proxy (Phase 3).
 */
export function useLinkedInSearch(options: UseLinkedInSearchOptions): UseLinkedInSearchReturn {
  const { connected } = options;

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<LinkedInSearchCategory>(DEFAULT_LINKEDIN_SEARCH_CATEGORY);
  const [items, setItems] = useState<LinkedInSearchResultItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<LinkedInSearchErrorType | null>(null);
  const [paging, setPaging] = useState<LinkedInSearchPaging | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const categoryDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelInFlight = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cancelInFlight();
      if (categoryDebounceRef.current) {
        clearTimeout(categoryDebounceRef.current);
      }
    };
  }, [cancelInFlight]);

  const reset = useCallback(() => {
    cancelInFlight();
    if (categoryDebounceRef.current) {
      clearTimeout(categoryDebounceRef.current);
      categoryDebounceRef.current = null;
    }
    setQuery('');
    setCategory(DEFAULT_LINKEDIN_SEARCH_CATEGORY);
    setItems([]);
    setCursor(null);
    setLoading(false);
    setLoadingMore(false);
    setError(null);
    setErrorType(null);
    setPaging(null);
    setModalOpen(false);
    setHasSearched(false);
  }, [cancelInFlight]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  const openModal = useCallback(() => {
    setModalOpen(true);
  }, []);

  const executeSearch = useCallback(
    async (options: {
      searchQuery: string;
      searchCategory: LinkedInSearchCategory;
      append?: boolean;
      cursorOverride?: string | null;
    }) => {
      const { searchQuery, searchCategory, append = false, cursorOverride = null } = options;
      const trimmed = searchQuery.trim();
      if (!trimmed) return;

      if (!connected) {
        setErrorType('not_connected');
        setError(LINKEDIN_SEARCH_NOT_CONNECTED_MESSAGE);
        if (!append) {
          setItems([]);
          setCursor(null);
          setPaging(null);
        }
        return;
      }

      cancelInFlight();
      const controller = new AbortController();
      abortRef.current = controller;

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
        setErrorType(null);
        setItems([]);
        setCursor(null);
        setPaging(null);
      }

      try {
        const response = await searchLinkedIn(
          {
            keywords: trimmed,
            category: searchCategory as ApiSearchCategory,
            api: 'classic',
            limit: DEFAULT_SEARCH_LIMIT,
            cursor: append ? cursorOverride : null,
          },
          controller.signal
        );

        const normalized = normalizeSearchItems(response.items ?? [], searchCategory);

        setItems((prev) => (append ? [...prev, ...normalized] : normalized));
        setCursor(response.cursor ?? null);
        setPaging(response.paging ?? null);
        setError(null);
        setErrorType(null);
      } catch (err: unknown) {
        const message = getLinkedInSearchErrorMessage(err);
        if (!message) {
          return;
        }

        const classified = getLinkedInSearchErrorType(err, connected);
        setError(message);
        setErrorType(classified === 'not_connected' ? 'not_connected' : 'generic');

        if (!append) {
          setItems([]);
          setCursor(null);
          setPaging(null);
        }

        console.warn('[LinkedInSearch] search failed', {
          category: searchCategory,
          append,
          message,
        });
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [connected, cancelInFlight]
  );

  const runSearch = useCallback(
    async (searchQuery?: string) => {
      const trimmed = (searchQuery ?? query).trim();
      if (!trimmed) return;

      if (categoryDebounceRef.current) {
        clearTimeout(categoryDebounceRef.current);
        categoryDebounceRef.current = null;
      }

      setQuery(trimmed);
      setModalOpen(true);
      setHasSearched(true);
      await executeSearch({ searchQuery: trimmed, searchCategory: category });
    },
    [query, category, executeSearch]
  );

  const setCategoryAndRefetch = useCallback(
    (nextCategory: LinkedInSearchCategory) => {
      setCategory(nextCategory);
      if (!hasSearched || !query.trim()) return;

      if (categoryDebounceRef.current) {
        clearTimeout(categoryDebounceRef.current);
      }

      categoryDebounceRef.current = setTimeout(() => {
        categoryDebounceRef.current = null;
        void executeSearch({
          searchQuery: query,
          searchCategory: nextCategory,
        });
      }, CATEGORY_DEBOUNCE_MS);
    },
    [hasSearched, query, executeSearch]
  );

  const loadMore = useCallback(async () => {
    if (!cursor || loading || loadingMore || !query.trim()) return;
    await executeSearch({
      searchQuery: query,
      searchCategory: category,
      append: true,
      cursorOverride: cursor,
    });
  }, [cursor, loading, loadingMore, query, category, executeSearch]);

  return {
    query,
    category,
    items,
    cursor,
    loading,
    loadingMore,
    error,
    errorType,
    paging,
    modalOpen,
    hasSearched,
    setQuery,
    setCategory: setCategoryAndRefetch,
    openModal,
    closeModal,
    runSearch,
    loadMore,
    reset,
  };
}
