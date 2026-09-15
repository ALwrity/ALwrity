import { useCallback, useRef, useState } from 'react';
import {
  brandBrainSemanticSearch,
  type BrandBrainSearchScope,
  type BrandBrainSemanticSearchResult,
} from '../services/brandBrainApi';

/**
 * Scoped Brand Brain semantic search hook.
 *
 * Drives the Phase 5 ``SemanticQuery`` panel. State is owned by the hook so
 * callers only deal with ``search(query, scope, limit)`` / ``reset()``. The
 * underlying API is honest: an embedding failure surfaces an ``error`` string
 * and an empty ``hits`` array (never fabricated).
 */
export function useBrandBrainSemanticSearch(): {
  loading: boolean;
  error: string | null;
  results: BrandBrainSemanticSearchResult | null;
  search: (query: string, scope?: BrandBrainSearchScope, limit?: number) => Promise<void>;
  reset: () => void;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BrandBrainSemanticSearchResult | null>(null);
  const inflight = useRef(0);

  const search = useCallback(
    async (query: string, scope?: BrandBrainSearchScope, limit?: number): Promise<void> => {
      const ticket = ++inflight.current;
      setLoading(true);
      setError(null);
      try {
        const result = await brandBrainSemanticSearch(query, scope, limit);
        if (ticket !== inflight.current) return;
        setResults(result);
        if (result?.error) setError(result.error);
      } catch (e: any) {
        if (ticket !== inflight.current) return;
        setError(e?.message || 'Brand Brain search failed');
        setResults(null);
      } finally {
        if (ticket === inflight.current) setLoading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    inflight.current++;
    setLoading(false);
    setError(null);
    setResults(null);
  }, []);

  return { loading, error, results, search, reset };
}