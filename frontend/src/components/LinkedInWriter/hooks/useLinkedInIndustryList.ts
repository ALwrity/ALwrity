import { useCallback, useEffect, useRef, useState } from "react";

import {
  getLinkedInIndustries,
  getLinkedInSearchParameters,
  type LinkedInIndustryCacheStatus,
} from "../../../api/linkedinSocial";
import {
  LINKEDIN_INDUSTRY_MAX_QUERY_LENGTH,
  type LinkedInIndustryItem,
} from "../utils/filterLinkedInIndustries";

const LOG_PREFIX = "[LinkedInIndustryList]";
const SESSION_KEY = "alwrity_linkedin_industry_cache_v1";
const SESSION_TTL_MS = 30 * 60 * 1000;
const LIVE_FALLBACK_DEBOUNCE_MS = 300;
const LIVE_FALLBACK_MIN_QUERY_LENGTH = 2;

interface IndustrySessionCache {
  items: LinkedInIndustryItem[];
  cacheStatus: LinkedInIndustryCacheStatus;
  syncedAt?: string | null;
  fetchedAt: number;
}

interface UseLinkedInIndustryListOptions {
  connected: boolean;
  query: string;
  /** Load catalog when the persona panel is open. */
  enabled?: boolean;
}

interface UseLinkedInIndustryListResult {
  industries: LinkedInIndustryItem[];
  isLoading: boolean;
  cacheStatus: LinkedInIndustryCacheStatus;
  /** True when catalog fetch failed — show subtle unavailable hint. */
  suggestionsUnavailable: boolean;
  isLiveFallback: boolean;
  fetchLiveSuggestions: (keywords: string) => Promise<LinkedInIndustryItem[]>;
}

let memoryCatalogCache: IndustrySessionCache | null = null;
let catalogLoadPromise: Promise<IndustrySessionCache | null> | null = null;

function readSessionCache(): IndustrySessionCache | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as IndustrySessionCache;
    if (!parsed?.items || !Array.isArray(parsed.items)) {
      return null;
    }
    if (Date.now() - parsed.fetchedAt > SESSION_TTL_MS) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch (error) {
    console.debug(`${LOG_PREFIX} session cache read failed`, error);
    return null;
  }
}

function writeSessionCache(payload: IndustrySessionCache): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch (error) {
    console.debug(`${LOG_PREFIX} session cache write failed`, error);
  }
}

function normalizeIndustryItems(items: unknown): LinkedInIndustryItem[] {
  if (!Array.isArray(items)) {
    return [];
  }
  const normalized: LinkedInIndustryItem[] = [];
  const seen = new Set<string>();
  for (const entry of items) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const candidate = entry as { id?: unknown; title?: unknown };
    if (typeof candidate.id !== "string" || typeof candidate.title !== "string") {
      continue;
    }
    const title = candidate.title.trim();
    if (!title || seen.has(candidate.id)) {
      continue;
    }
    seen.add(candidate.id);
    normalized.push({ id: candidate.id, title });
  }
  return normalized;
}

async function loadIndustryCatalog(): Promise<IndustrySessionCache | null> {
  if (memoryCatalogCache) {
    console.debug(
      `${LOG_PREFIX} using in-memory cache item_count=${memoryCatalogCache.items.length}`,
    );
    return memoryCatalogCache;
  }

  const cached = readSessionCache();
  if (cached) {
    memoryCatalogCache = cached;
    console.debug(
      `${LOG_PREFIX} using session cache item_count=${cached.items.length}`,
    );
    return cached;
  }

  if (!catalogLoadPromise) {
    catalogLoadPromise = (async () => {
      try {
        const response = await getLinkedInIndustries();
        const payload: IndustrySessionCache = {
          items: normalizeIndustryItems(response.items),
          cacheStatus: response.cache_status || "empty",
          syncedAt: response.synced_at,
          fetchedAt: Date.now(),
        };
        memoryCatalogCache = payload;
        writeSessionCache(payload);
        console.debug(
          `${LOG_PREFIX} catalog loaded cache_status=${payload.cacheStatus} item_count=${payload.items.length}`,
        );
        return payload;
      } catch (error) {
        console.debug(`${LOG_PREFIX} catalog load failed`, error);
        return null;
      } finally {
        catalogLoadPromise = null;
      }
    })();
  }

  return catalogLoadPromise;
}

export function useLinkedInIndustryList({
  connected,
  query,
  enabled = true,
}: UseLinkedInIndustryListOptions): UseLinkedInIndustryListResult {
  const [catalogItems, setCatalogItems] = useState<LinkedInIndustryItem[]>([]);
  const [cacheStatus, setCacheStatus] =
    useState<LinkedInIndustryCacheStatus>("empty");
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [suggestionsUnavailable, setSuggestionsUnavailable] = useState(false);

  const [liveItems, setLiveItems] = useState<LinkedInIndustryItem[]>([]);
  const [isLoadingLive, setIsLoadingLive] = useState(false);

  const liveAbortRef = useRef<AbortController | null>(null);
  const liveSeqRef = useRef(0);
  const catalogLoadedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (catalogLoadedRef.current && memoryCatalogCache) {
      setCatalogItems(memoryCatalogCache.items);
      setCacheStatus(memoryCatalogCache.cacheStatus);
      setSuggestionsUnavailable(false);
      return;
    }

    let cancelled = false;
    setIsLoadingCatalog(true);
    setSuggestionsUnavailable(false);

    loadIndustryCatalog()
      .then((payload) => {
        if (cancelled) {
          return;
        }
        catalogLoadedRef.current = true;
        if (!payload) {
          setSuggestionsUnavailable(true);
          setCatalogItems([]);
          setCacheStatus("empty");
          return;
        }
        setCatalogItems(payload.items);
        setCacheStatus(payload.cacheStatus);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingCatalog(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const useLiveFallback = enabled && catalogItems.length === 0 && connected;

  const fetchLiveSuggestions = useCallback(
    async (keywords: string): Promise<LinkedInIndustryItem[]> => {
      const trimmed = keywords.trim();
      if (
        !connected ||
        trimmed.length < LIVE_FALLBACK_MIN_QUERY_LENGTH ||
        trimmed.length > LINKEDIN_INDUSTRY_MAX_QUERY_LENGTH
      ) {
        return [];
      }

      liveAbortRef.current?.abort();
      const controller = new AbortController();
      liveAbortRef.current = controller;
      const seq = ++liveSeqRef.current;

      setIsLoadingLive(true);

      try {
        console.debug(
          `${LOG_PREFIX} live fallback request keywords_len=${trimmed.length}`,
        );
        const response = await getLinkedInSearchParameters(
          { type: "INDUSTRY", keywords: trimmed, limit: 20 },
          controller.signal,
        );
        if (seq !== liveSeqRef.current) {
          return [];
        }
        return normalizeIndustryItems(response.items);
      } catch (error) {
        if (seq !== liveSeqRef.current) {
          return [];
        }
        console.debug(`${LOG_PREFIX} live fallback failed — freestyle only`, error);
        return [];
      } finally {
        if (seq === liveSeqRef.current) {
          setIsLoadingLive(false);
        }
      }
    },
    [connected],
  );

  useEffect(() => {
    if (!useLiveFallback) {
      liveAbortRef.current?.abort();
      setLiveItems([]);
      setIsLoadingLive(false);
      return;
    }

    const trimmed = query.trim();
    if (
      trimmed.length < LIVE_FALLBACK_MIN_QUERY_LENGTH ||
      trimmed.length > LINKEDIN_INDUSTRY_MAX_QUERY_LENGTH
    ) {
      liveAbortRef.current?.abort();
      setLiveItems([]);
      setIsLoadingLive(false);
      return;
    }

    const timer = window.setTimeout(() => {
      fetchLiveSuggestions(trimmed).then((items) => {
        setLiveItems(items);
      });
    }, LIVE_FALLBACK_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fetchLiveSuggestions, query, useLiveFallback]);

  useEffect(() => {
    return () => {
      liveAbortRef.current?.abort();
    };
  }, []);

  const industries = catalogItems.length > 0 ? catalogItems : liveItems;
  const isLoading =
    isLoadingCatalog || (useLiveFallback && isLoadingLive && industries.length === 0);

  return {
    industries,
    isLoading,
    cacheStatus,
    suggestionsUnavailable,
    isLiveFallback: useLiveFallback,
    fetchLiveSuggestions,
  };
}
