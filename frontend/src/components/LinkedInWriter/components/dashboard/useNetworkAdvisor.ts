import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  linkedInGrowthApi,
  type NetworkSuggestionItem,
  type NetworkSuggestionsResponse,
} from "../../../../services/linkedInGrowthApi";
import {
  mergeNetworkSuggestionsIntoCache,
  readGrowthCacheData,
} from "./engagementWedgeGrowthCache";

function extractApiError(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: string } } })
    ?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}

export interface UseNetworkAdvisorOptions {
  /** When true, automatically fetch if cache has no suggestions. */
  autoLoad?: boolean;
  connected?: boolean;
}

export interface UseNetworkAdvisorResult {
  suggestions: NetworkSuggestionItem[];
  dataSourceSummary: string;
  hasAttemptedFetch: boolean;
  loading: boolean;
  error: string;
  loadSuggestions: () => Promise<NetworkSuggestionsResponse | null>;
}

/**
 * Loads network suggestions via POST /api/linkedin/growth/network-suggestions.
 * Keeps anti-hallucination grounding on the backend — never fabricates people client-side.
 */
export function useNetworkAdvisor(
  open: boolean,
  options: UseNetworkAdvisorOptions = {},
): UseNetworkAdvisorResult {
  const { autoLoad = true, connected = true } = options;
  const [networkData, setNetworkData] =
    useState<NetworkSuggestionsResponse | null>(null);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const autoLoadStartedRef = useRef(false);

  const hydrateFromCache = useCallback(() => {
    const cached = readGrowthCacheData()?.network_suggestions ?? null;
    setNetworkData(cached);
    return cached;
  }, []);

  useEffect(() => {
    if (!open) {
      autoLoadStartedRef.current = false;
      return;
    }
    hydrateFromCache();
    setError("");
    setLoading(false);
  }, [open, hydrateFromCache]);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await linkedInGrowthApi.getNetworkSuggestions();
      mergeNetworkSuggestionsIntoCache(result);
      setNetworkData(result);
      setHasAttemptedFetch(true);
      return result;
    } catch (err) {
      setHasAttemptedFetch(true);
      setError(
        extractApiError(
          err,
          "Could not load network suggestions. Please try again.",
        ),
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const suggestions = useMemo(
    () => networkData?.suggestions?.filter(Boolean) ?? [],
    [networkData],
  );

  const dataSourceSummary = networkData?.data_source_summary?.trim() ?? "";

  // Auto-fetch when modal opens with no grounded suggestions (connected users only).
  useEffect(() => {
    if (!open || !autoLoad || !connected || loading) return;
    if (suggestions.length > 0) return;
    if (autoLoadStartedRef.current) return;
    autoLoadStartedRef.current = true;
    void loadSuggestions();
  }, [
    open,
    autoLoad,
    connected,
    loading,
    suggestions.length,
    loadSuggestions,
  ]);

  return {
    suggestions,
    dataSourceSummary,
    hasAttemptedFetch,
    loading,
    error,
    loadSuggestions,
  };
}
