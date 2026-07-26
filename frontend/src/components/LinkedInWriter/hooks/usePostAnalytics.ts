import { useCallback, useEffect, useRef, useState } from "react";
import {
  postAnalyticsApi,
  type FetchPostsParams,
  type PostListResponse,
} from "../../../services/postAnalyticsApi";

export type PostAnalyticsPanelState = "idle" | "loading" | "loaded" | "error";

const CACHE_KEY = "alwrity_post_analytics";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry {
  data: PostListResponse;
  cursor: string | undefined;
  fetchedAt: number;
}

function getCache(): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CacheEntry = JSON.parse(raw);
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function setCache(entry: CacheEntry) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // ignore storage errors
  }
}

function clearCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

/** Normalize API cursor (may be null) to string | undefined for cache/state. */
function normalizeCursor(
  cursor: string | null | undefined,
): string | undefined {
  return cursor ?? undefined;
}

function extractErrorMessage(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })
    ?.response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (detail && typeof detail === "object" && "message" in detail) {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  return "Failed to load LinkedIn posts";
}

export function usePostAnalytics() {
  const [data, setData] = useState<PostListResponse | null>(null);
  const [panelState, setPanelState] = useState<PostAnalyticsPanelState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const inFlightRef = useRef(false);

  // Load from cache on mount
  useEffect(() => {
    const cached = getCache();
    if (cached) {
      setData(cached.data);
      setPanelState("loaded");
    }
  }, []);

  const fetchPosts = useCallback(async (params?: FetchPostsParams) => {
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    setPanelState("loading");
    setErrorMessage("");

    try {
      const result = await postAnalyticsApi.fetchPosts(params);
      setData(result);
      setCache({ data: result, cursor: undefined, fetchedAt: Date.now() });
      setPanelState("loaded");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const message = status === 404
        ? "LinkedIn account not found. Try reconnecting your account."
        : extractErrorMessage(err);
      console.error("[PostAnalytics] Failed to fetch posts:", err);
      setErrorMessage(message);
      setPanelState("error");
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  const loadMorePosts = useCallback(async () => {
    if (inFlightRef.current || !data?.has_more || !data.cursor) {
      return;
    }

    inFlightRef.current = true;
    setPanelState("loading");

    try {
      const result = await postAnalyticsApi.fetchPosts({ cursor: data.cursor });
      const nextCursor = normalizeCursor(result.cursor);
      const merged: PostListResponse = {
        posts: [...data.posts, ...result.posts],
        cursor: nextCursor,
        has_more: result.has_more,
        total_count: result.total_count,
      };
      setData(merged);
      setCache({ data: merged, cursor: nextCursor, fetchedAt: Date.now() });
      setPanelState("loaded");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const message = status === 404
        ? "LinkedIn account not found. Try reconnecting."
        : extractErrorMessage(err);
      console.error("[PostAnalytics] Failed to load more posts:", err);
      setErrorMessage(message);
      setPanelState("error");
    } finally {
      inFlightRef.current = false;
    }
  }, [data]);

  const refreshPosts = useCallback(async () => {
    clearCache();
    setData(null);
    setPanelState("idle");
    // Match Post Analytics / personal-analytics fetch size so page viewers
    // and other creator metrics sum the same post set on dashboard + modal.
    await fetchPosts({ limit: 50, refresh: true });
  }, [fetchPosts]);

  return {
    data,
    panelState,
    errorMessage,
    fetchPosts,
    loadMorePosts,
    refreshPosts,
  };
}
